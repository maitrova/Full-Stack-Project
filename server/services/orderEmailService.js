import Brevo from "@getbrevo/brevo";

const apiInstance = new Brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

export const sendOrderStatusEmail = async (order, user) => {
  console.log("📩 Professional Email Triggered");

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  // 🔥 Build items table dynamically
  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          <img src="${item.previewImage}" width="60" />
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          Size: ${item.size}<br/>
          Qty: ${item.qty}
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">
          ₹${item.unitPrice}
        </td>
      </tr>
    `
    )
    .join("");

  // 🔥 Subject based on status
  const subjectMap = {
    PROCESSING: "Order Confirmed ✅",
    READY: "Your Order is Ready 📦",
    SHIPPED: "Your Order Has Been Shipped 🚚",
    DELIVERED: "Order Delivered 🎉",
  };

  const subject = subjectMap[order.orderStatus] || "Order Update";

  const htmlContent = `
  <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:8px;overflow:hidden;">
      
      <!-- Header -->
      <div style="background:#111827;color:#ffffff;padding:20px;text-align:center;">
        <h2 style="margin:0;">Maitrova</h2>
      </div>

      <!-- Body -->
      <div style="padding:20px;">
        <h3>Hello ${user.name},</h3>
        <p>Your order <strong>#${order._id}</strong> is now 
        <strong>${order.orderStatus}</strong>.</p>

        <p><strong>Order Date:</strong> ${formatDate(order.createdAt)}</p>

        <!-- Order Summary -->
        <table width="100%" style="border-collapse:collapse;margin-top:20px;">
          ${itemsHtml}
        </table>

        <div style="margin-top:20px;text-align:right;">
          <p>Subtotal: ₹${order.subtotal}</p>
          <h3>Total: ₹${order.total}</h3>
        </div>

        ${
          order.orderStatus === "SHIPPED"
            ? `<p style="margin-top:20px;">
                Your order is on the way! You will receive it soon.
               </p>`
            : ""
        }

        ${
          order.orderStatus === "DELIVERED"
            ? `<p style="margin-top:20px;">
                We hope you love your purchase ❤️  
                Please leave a review!
               </p>`
            : ""
        }

        <p style="margin-top:30px;">
          If you have any questions, contact our support team.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f3f4f6;padding:15px;text-align:center;font-size:12px;color:#555;">
        © ${new Date().getFullYear()} Maitrova. All rights reserved.
      </div>

    </div>
  </div>
  `;

  try {
    await apiInstance.sendTransacEmail({
      sender: {
        email: "maitrova122@gmail.com",
        name: "Maitrova",
      },
      to: [
        {
          email: user.email,
          name: user.name,
        },
      ],
      subject,
      htmlContent,
    });

    console.log("✅ Professional Email Sent Successfully");
  } catch (error) {
    console.error("❌ Brevo Error:", error.response?.body || error);
  }
};
