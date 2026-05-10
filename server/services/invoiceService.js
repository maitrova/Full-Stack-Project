import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const templatePath = path.join(serverRoot, "templates", "invoice.html");
const invoicesDir = path.join(serverRoot, "outputs", "invoices");

const getPuppeteerLaunchOptions = () => {
  const launchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return launchOptions;
};

const generateInvoiceNumber = () => {
  return `MT-${Date.now()}`;
};

const formatInvoiceDateForTemplate = (date) =>
  new Intl.DateTimeFormat("en-GB").format(date);

const resolveInvoiceDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parsedDate = value ? new Date(value) : null;
  if (parsedDate instanceof Date && !Number.isNaN(parsedDate?.getTime())) {
    return parsedDate;
  }

  return new Date();
};

export const generateInvoicePDF = async (order) => {
  let html = fs.readFileSync(templatePath, "utf8");

  const invoiceNumber = order.invoiceNumber || generateInvoiceNumber();
  const invoiceDate = resolveInvoiceDate(order.invoiceDate);
  const invoiceDateLabel = formatInvoiceDateForTemplate(invoiceDate);

  // 🔹 Build Items Table
  let itemsHtml = "";

  (order.items || []).forEach((item) => {
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

    const qty = Number(item.qty || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const amount = qty * unitPrice;

    itemsHtml += `
      <tr>
        <td>
          <strong>${title}</strong><br/>
          <small>${description}</small>
        </td>
        <td>${qty}</td>
        <td>${unitPrice.toFixed(2)}</td>
        <td>${amount.toFixed(2)}</td>
      </tr>
    `;
  });

  // 🔹 Customer Address Formatting
  const deliveryAddress = order.deliveryAddress || {};
  const address = `
    ${deliveryAddress.addressLine1 || ""}<br/>
    ${deliveryAddress.addressLine2 || ""}<br/>
    ${deliveryAddress.city || ""}, 
    ${deliveryAddress.state || ""} - 
    ${deliveryAddress.pincode || ""}
  `;

  html = html
    .replace("{{invoiceNumber}}", invoiceNumber)
    .replace("{{invoiceDate}}", invoiceDateLabel)
    .replace("{{customerName}}", order.user?.name || "Customer")
    .replace("{{customerAddress}}", address)
    .replace("{{items}}", itemsHtml)
    .replace("{{subtotal}}", Number(order.subtotal || order.total || 0).toFixed(2))
    .replace("{{total}}", Number(order.total || order.subtotal || 0).toFixed(2));

  // 🔹 Ensure outputs/invoices folder exists

  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const pdfPath = path.join(invoicesDir, `${invoiceNumber}.pdf`);

  // 🔹 Launch Puppeteer
  let browser;
  try {
    browser = await puppeteer.launch(getPuppeteerLaunchOptions());

    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return {
    pdfPath,
    invoiceNumber,
    invoiceDate,
  };
};
