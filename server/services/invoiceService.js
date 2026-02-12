import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const generateInvoiceNumber = () => {
  return `MT-${Date.now()}`;
};

export const generateInvoicePDF = async (order) => {
  const templatePath = path.join(process.cwd(), "templates", "invoice.html");
  let html = fs.readFileSync(templatePath, "utf8");

  const invoiceNumber = order.invoiceNumber || generateInvoiceNumber();
  const invoiceDate = new Date().toLocaleDateString();

  // 🔹 Build Items Table
  let itemsHtml = "";

  order.items.forEach((item) => {
    let title = "Product";
    let description = "Product purchase";

    // READYMADE
    if (item.kind === "READYMADE" && item.readymadeProduct) {
      title = item.readymadeProduct.title || "Readymade Product";
      description =
        item.readymadeProduct.description || "Readymade product purchase";
    }

    // DESIGN
    if (item.kind === "DESIGN" && item.design) {
      title = item.design.title || "Design Product";
      description =
        item.design.description || "Custom design purchase";
    }

    // DROPPRODUCT
    if (item.kind === "DROPPRODUCT" && item.dropproduct) {
      title = item.dropproduct.name || "Drop Product";
      description =
        item.dropproduct.description || "Drop product purchase";
    }

    // PRODUCT
    if (item.kind === "PRODUCT" && item.product) {
      title = item.product.name || "Product";
      description =
        item.product.description || "Product purchase";
    }

    const amount = item.qty * item.unitPrice;

    itemsHtml += `
      <tr>
        <td>
          <strong>${title}</strong><br/>
          <small>${description}</small>
        </td>
        <td>${item.qty}</td>
        <td>${item.unitPrice}</td>
        <td>${amount}</td>
      </tr>
    `;
  });

  // 🔹 Customer Address Formatting
  const address = `
    ${order.deliveryAddress.addressLine1 || ""}<br/>
    ${order.deliveryAddress.addressLine2 || ""}<br/>
    ${order.deliveryAddress.city || ""}, 
    ${order.deliveryAddress.state || ""} - 
    ${order.deliveryAddress.pincode || ""}
  `;

  html = html
    .replace("{{invoiceNumber}}", invoiceNumber)
    .replace("{{invoiceDate}}", invoiceDate)
    .replace("{{customerName}}", order.user.name)
    .replace("{{customerAddress}}", address)
    .replace("{{items}}", itemsHtml)
    .replace("{{subtotal}}", order.subtotal)
    .replace("{{total}}", order.total);

  // 🔹 Ensure outputs/invoices folder exists
  const invoicesDir = path.join(process.cwd(), "outputs", "invoices");

  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const pdfPath = path.join(invoicesDir, `${invoiceNumber}.pdf`);

  // 🔹 Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle0" });

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
  });

  await browser.close();

  return {
    pdfPath,
    invoiceNumber,
    invoiceDate,
  };
};
