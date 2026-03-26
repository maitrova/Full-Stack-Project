import Order from "../models/Order.js";
import { generateInvoicePDF } from "../services/invoiceService.js";
import fs from "fs";
import path from "path";

export const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate("user")
      .populate("deliveryAddress")
      .populate("items.readymadeProduct")
      .populate("items.design")
      .populate("items.dropproduct")
      .populate("items.product");

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    // 🔐 Ensure logged in user owns this order
    if (order.user._id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Unauthorized" });

    if (order.status !== "PAID")
      return res.status(400).json({ message: "Payment not completed" });

    // If invoice already exists → reuse
    if (order.invoicePdfUrl && fs.existsSync(order.invoicePdfUrl)) {
      return res.download(
        order.invoicePdfUrl,
        path.basename(order.invoicePdfUrl)
      );
    }

    // Generate invoice
    const { pdfPath, invoiceNumber, invoiceDate } =
      await generateInvoicePDF(order);

    order.invoiceNumber = invoiceNumber;
    order.invoiceDate = invoiceDate;
    order.invoicePdfUrl = pdfPath;
    await order.save();

    return res.download(pdfPath, path.basename(pdfPath));

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error?.message || "Invoice generation failed",
    });
  }
};
