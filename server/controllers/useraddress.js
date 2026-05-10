import Address from "../models/address.js";

const REQUIRED = [
  "fullName",
  "mobileNumber",
  "completeAddress",
  "pincode",
  "city",
  "state",
];

function validate(addr, label) {
  if (!addr || typeof addr !== "object") return `${label} is required`;
  for (const f of REQUIRED) {
    if (!addr[f] || String(addr[f]).trim() === "") {
      return `${label}.${f} is required`;
    }
  }
  return null;
}

async function clearDefault(userId, type) {
  await Address.updateMany({ user: userId, type, isDefault: true }, { isDefault: false });
}

/**
 * POST /addresses
 * Body:
 * {
 *  "sameAsDelivery": true,
 *  "setAsDefault": true,
 *  "delivery": { fullName, mobileNumber, completeAddress, landmark?, pincode, city, state },
 *  "billing":  { fullName, mobileNumber, completeAddress, landmark?, pincode, city, state } // optional if sameAsDelivery=true
 * }
 */
export const upsertDeliveryBilling = async (req, res) => {
  try {
    const userId = req.user?.id; // from auth middleware
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { delivery, billing, sameAsDelivery = false, setAsDefault = false } = req.body;

    // ✅ validate delivery
    const dErr = validate(delivery, "delivery");
    if (dErr) return res.status(400).json({ message: dErr });

    // ✅ resolve billing
    const billingData = sameAsDelivery ? delivery : billing;
    const bErr = validate(billingData, "billing");
    if (bErr) return res.status(400).json({ message: bErr });

    // ✅ default handling
    if (setAsDefault) {
      await clearDefault(userId, "delivery");
      await clearDefault(userId, "billing");
    }

    // ✅ upsert delivery (update if exists for type, else create)
    const deliveryAddress = await Address.findOneAndUpdate(
      { user: userId, type: "delivery" },
      {
        user: userId,
        type: "delivery",
        fullName: delivery.fullName,
        mobileNumber: delivery.mobileNumber,
        completeAddress: delivery.completeAddress,
        landmark: delivery.landmark || "",
        pincode: delivery.pincode,
        city: delivery.city,
        state: delivery.state,
        ...(setAsDefault ? { isDefault: true } : {}),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // ✅ upsert billing
    const billingAddress = await Address.findOneAndUpdate(
      { user: userId, type: "billing" },
      {
        user: userId,
        type: "billing",
        fullName: billingData.fullName,
        mobileNumber: billingData.mobileNumber,
        completeAddress: billingData.completeAddress,
        landmark: billingData.landmark || "",
        pincode: billingData.pincode,
        city: billingData.city,
        state: billingData.state,
        ...(setAsDefault ? { isDefault: true } : {}),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      message: "Delivery & Billing addresses saved",
      deliveryAddress,
      billingAddress,
    });
  } catch (err) {
    console.error("upsertDeliveryBilling error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /addresses
 * Returns all addresses of logged-in user
 */
export const getMyAddresses = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const addresses = await Address.find({ user: userId }).sort({ createdAt: -1 });
    return res.status(200).json({ addresses });
  } catch (err) {
    console.error("getMyAddresses error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /addresses/:id
 * Update one address record
 */
export const updateAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    // Only allow updating own address
    const updated = await Address.findOneAndUpdate(
      { _id: id, user: userId },
      { ...req.body },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Address not found" });

    return res.status(200).json({ message: "Address updated", address: updated });
  } catch (err) {
    console.error("updateAddress error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE /addresses/:id
 */
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    const deleted = await Address.findOneAndDelete({ _id: id, user: userId });
    if (!deleted) return res.status(404).json({ message: "Address not found" });

    return res.status(200).json({ message: "Address deleted" });
  } catch (err) {
    console.error("deleteAddress error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /addresses/:id/default
 * Sets one address as default for its type (delivery/billing)
 */
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    const addr = await Address.findOne({ _id: id, user: userId });
    if (!addr) return res.status(404).json({ message: "Address not found" });

    await clearDefault(userId, addr.type);
    addr.isDefault = true;
    await addr.save();

    return res.status(200).json({ message: "Default updated", address: addr });
  } catch (err) {
    console.error("setDefaultAddress error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
