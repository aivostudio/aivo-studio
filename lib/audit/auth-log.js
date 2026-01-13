// /lib/audit/auth-log.js
// =======================================================
// AUTH AUDIT LOG — v1
// Login event’lerini merkezi olarak kaydetmek için
// (DB / storage implementasyonu SONRA)
// =======================================================

/*
  event = {
    userId?: string,
    email: string,
    role: "admin" | "user",
    ip?: string,
    userAgent?: string,
    at: Date
  }
*/

export async function writeAuthAuditLog(event) {
  try {
    // ---------------------------------------------------
    // 1️⃣ ZORUNLU KONTROLLER
    // ---------------------------------------------------
    if (!event || !event.email || !event.at) {
      console.warn("[AUTH_AUDIT] invalid payload", event);
      return;
    }

    // ---------------------------------------------------
    // 2️⃣ ŞU ANKİ IMPLEMENTASYON (LOG ONLY)
    // ---------------------------------------------------
    // DB henüz bağlı değil.
    // Bu katman bilinçli olarak SADE tutulur.
    console.log("[AUTH_AUDIT] login", {
      email: event.email,
      role: event.role,
      ip: event.ip,
      userAgent: event.userAgent,
      at: event.at instanceof Date ? event.at.toISOString() : event.at,
    });

    // ---------------------------------------------------
    // 3️⃣ GELECEK HOOK (DOKUNMA)
    // ---------------------------------------------------
    // await db.authLog.insert({
    //   email: event.email,
    //   role: event.role,
    //   ip: event.ip,
    //   userAgent: event.userAgent,
    //   createdAt: event.at,
    // });

  } catch (err) {
    console.error("[AUTH_AUDIT] write failed", err);
  }
}
