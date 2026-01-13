// /lib/mail/admin-login.js
// =======================================================
// ADMIN LOGIN MAIL — v1
// Sadece mail gönderme sorumluluğu
// Auth / event logic YOK
// =======================================================

import nodemailer from "nodemailer";

/*
  ENV BEKLENENLER:
  - SMTP_HOST
  - SMTP_PORT
  - SMTP_USER
  - SMTP_PASS
  - ADMIN_NOTIFY_EMAIL   (mailin gideceği adres)
*/

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendAdminLoginMail(payload) {
  /*
    payload = {
      email: string,
      role: "admin",
      ip?: string,
      userAgent?: string,
      at: Date
    }
  */

  if (!payload || !payload.email) return;

  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) {
    console.warn("[ADMIN_LOGIN_MAIL] ADMIN_NOTIFY_EMAIL missing");
    return;
  }

  const subject = "🔐 Yeni Admin Girişi";

  const text = `
Yeni bir admin girişi tespit edildi.

Admin Email : ${payload.email}
IP           : ${payload.ip || "-"}
Tarayıcı     : ${payload.userAgent || "-"}
Zaman        : ${payload.at?.toISOString?.() || payload.at}
`;

  try {
    await transporter.sendMail({
      from: `"AIVO System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });

    console.log("[ADMIN_LOGIN_MAIL] sent", {
      admin: payload.email,
    });
  } catch (err) {
    console.error("[ADMIN_LOGIN_MAIL] failed", err);
  }
}
