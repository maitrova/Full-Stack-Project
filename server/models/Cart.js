import mongoose from "mongoose";

// The loose cart items one combo unit was made from (see convert-to-combo),
// so the customer can undo the combo and get them back.
const convertedFromSetSchema = new mongoose.Schema(
  {
    items: {
      type: [
        new mongoose.Schema(
          {
            readymadeProduct: { type: mongoose.Schema.Types.ObjectId, ref: "ReadymadeProduct", required: true },
            size: { type: String, default: "" },
            title: { type: String, default: "" },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const cartItemSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["READYMADE", "DESIGN", "COMBO"],
      required: true,
      index: true,
    },

    readymadeProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReadymadeProduct",
      default: null,
    },

    design: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Design",
      default: null,
    },

    dropproduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dropproduct",
      default: null,
    },

    comboPack: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ComboPack",
      default: null,
    },

    comboSelections: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    comboName: { type: String, default: "" },

    // One entry per combo unit that was made from cart items, newest last.
    convertedFrom: { type: [convertedFromSetSchema], default: [] },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    size: { type: String, default: "M" },
    qty: { type: Number, required: true, min: 1, default: 1 },

    unitPrice: { type: Number, required: true, min: 0 },
    basePrice: { type: Number, min: 0, default: 0 },
    priceDetails: { type: mongoose.Schema.Types.Mixed, default: null },
    currency: { type: String, default: "INR" },

    previewImage: { type: String, default: null },

    signature: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    guestId: {
      type: String,
      default: null,
      index: true,
    },

    items: [cartItemSchema],

    status: {
      type: String,
      enum: ["ACTIVE", "ORDERED"],
      default: "ACTIVE",
      index: true,
    },
    // Bounded idempotency markers for atomic WhatsApp batch additions.
    whatsappOperationIds: {
      type: [String],
      default: [],
      select: false,
    },
  },
  { timestamps: true }
);

cartSchema.index(
  { user: 1, status: 1 },
  { partialFilterExpression: { status: "ACTIVE", user: { $exists: true, $ne: null } } }
);

cartSchema.index(
  { guestId: 1, status: 1 },
  { partialFilterExpression: { status: "ACTIVE", guestId: { $exists: true, $ne: null } } }
);

export const Cart = mongoose.model("Cart", cartSchema);
