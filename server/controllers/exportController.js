import Order from "../models/Order.js";
import XLSX from "xlsx";
import mongoose from "mongoose";

export const exportOrdersToExcel = async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No orders selected for export",
      });
    }

    const validIds = orderIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    const orders = await Order.find({
      _id: { $in: validIds },
      status: "PAID",
    })
      .populate("user")
      .populate("deliveryAddress")
      .populate("billingAddress")
      .populate("items.readymadeProduct")
      .populate("items.design")
      .populate("items.product")
      .populate("items.dropproduct");

    if (!orders.length) {
      return res.status(400).json({
        success: false,
        message: "No PAID orders found",
      });
    }

    const rows = [];

    for (const order of orders) {
      const user = order.user;
      const delivery = order.deliveryAddress;
      const billing = order.billingAddress;

      const [firstName = "", ...lastParts] =
        user?.name?.split(" ") || [];
      const lastName = lastParts.join(" ");

      for (const item of order.items) {

        let productName = "";
        let masterSKU = "";

        switch (item.kind) {

          case "READYMADE":

            if (item.readymadeProduct) {
              productName = item.readymadeProduct.title || "";

              const variant =
                item.readymadeProduct.variants?.find(
                  (v) => v.size === item.size
                );

              masterSKU = variant?.sku || "";
            }

            else if (item.dropproduct) {
              productName = item.dropproduct.name || "";

              const variant =
                item.dropproduct.variants?.find(
                  (v) => v.size === item.size
                );

              masterSKU = variant?.sku || "";
            }

            break;

          case "DESIGN":
            if (item.design) {
              productName = item.design.productName || "";
              masterSKU = item.design._id.toString();
            }
            break;
        }

        // ✅ THIS WAS MISSING
        rows.push({
          "Order Id": order._id.toString(),

          "Buyer's Mobile No.": user?.phone || "",
          "Buyer's First Name": firstName,
          "Buyer's LastName(Optional)": lastName,
          "Email (Optional)": user?.email || "",

          "Shipping Complete Address":
            delivery?.completeAddress || "",
          "Shipping Address Landmark (Optional)":
            delivery?.landmark || "",
          "Shipping Address Pincode":
            delivery?.pincode || "",
          "Shipping Address City":
            delivery?.city || "",
          "Shipping Address State":
            delivery?.state || "",
          "Shipping Address Country": "India",

          "Billing Complete Address (Optional)":
            billing?.completeAddress || "",
          "Billing Landmark (Optional)":
            billing?.landmark || "",
          "Billing Pincode (Optional)":
            billing?.pincode || "",
          "Billing City (Optional)":
            billing?.city || "",
          "Billing State (Optional)":
            billing?.state || "",
          "Billing Country (Optional)": "India",

          "Product Name": productName,
          "Per Unit Price in INR (Inclusive of Tax)":
            item.unitPrice || 0,
          "Product Quantity": item.qty || 0,
          "Master SKU": masterSKU,
        });

      }
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=orders_${Date.now()}.xlsx`
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);

  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export orders",
    });
  }
};



