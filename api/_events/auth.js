// /api/_events/auth.js
// =======================================================
// AUTH EVENT HUB — v2 (MAIL + AUDIT CONNECTED)
// Login sonrası TEK ODAK NOKTASI
// =======================================================

const { sendAdminLoginMail } = require("../../lib/mail/admin-login");
const { writeAuthAuditLog } = require("../../lib/audit/auth-log");

async function onAuthLogin(event) {
  /*
    event = {
      userId: string,
      email: string,
      role: "admin" | "user",
      ip?: string,
      userAgent?: string,
      at: Date
    }
  */

  try {
    if (!event || !event.email || !event.at) return;

    // 1) Audit (her login)
    try {
      await writeAuthAuditLog(event);
    } catch (_) {}

    // 2) Admin mail (sadece admin)
    if (String(event.role || "").toLowerCase() === "admin") {
      try {
        await sendAdminLoginMail(event);
      } catch (_) {}
    }
  } catch (err) {
    console.error("[AUTH_EVENT] error", err);
  }
}

module.exports = { onAuthLogin };
