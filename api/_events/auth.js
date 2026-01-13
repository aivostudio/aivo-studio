// /api/_events/auth.js
// =======================================================
// AUTH EVENT HUB — v1
// Login sonrası TEK ODAK NOKTASI
// (Mail, audit, security buradan tetiklenecek)
// =======================================================

export async function onAuthLogin(event) {
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
    // ---------------------------------------------------
    // 1️⃣ ZORUNLU VALIDATION
    // ---------------------------------------------------
    if (!event || !event.email || !event.at) {
      console.warn("[AUTH_EVENT] invalid payload", event);
      return;
    }

    // ---------------------------------------------------
    // 2️⃣ DEBUG / TRACE (şimdilik)
    // ---------------------------------------------------
    console.log("[AUTH_EVENT] login", {
      email: event.email,
      role: event.role,
      at: event.at,
      ip: event.ip,
    });

    // ---------------------------------------------------
    // 3️⃣ HOOK NOKTALARI (şu an BOŞ)
    // ---------------------------------------------------
    // if (event.role === "admin") {
    //   await sendAdminLoginMail(event);
    // }
    //
    // await writeAuthAuditLog(event);

  } catch (err) {
    console.error("[AUTH_EVENT] handler error", err);
  }
}
