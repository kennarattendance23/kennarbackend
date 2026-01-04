// utils/mailer.js
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  try {
    const msg = {
      to, // recipient
      from: process.env.EMAIL_FROM, // must be a verified sender in SendGrid
      subject,
      html,
    };

    const info = await sgMail.send(msg);
    console.log("📨 Email sent:", info[0].statusCode);
    return info;
  } catch (err) {
    console.error("⚠️ Email failed:", err.message);
    throw err; // let the calling function handle the error
  }
};

export default sendEmail;
