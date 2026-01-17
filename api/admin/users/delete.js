// /api/admin/users/delete.js  ✅ "Altın vuruş" sürümü
// - Soft: disabled=true + ALL indexlerden temizler
// - Hard: user + auth + session + verify/reset + credits/invoices/purchases/presence + ALL indexlerden temizler
// - Silinince tekrar login olamaz (auth/pass/session kayıtları da gider)

const { kvGetJson, kvSetJson, kvDel } = require("../../_kv");

// ---------- helpers ----------
function isAdminEmail(email) {
  const adminList = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return adminList.includes(String(email || "").trim().toLowerCase());
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

// users indexleri (projede hangisi varsa hepsini temizle)
const LIST_KEYS = [
  "users:list",
  "users",
  "users:index",
  "users:all",
  "users:items",
];

// ---------- main ----------
module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const admin = normEmail(body.admin);
    const email = normEmail(body.email);
    const mode = String(body.mode || "hard").trim().toLowerCase(); // soft | hard  (default HARD)

    if (!admin || !isAdminEmail(admin)) return json(res, 403, { ok: false, error: "admin_forbidden" });
    if (!email || !email.includes("@")) return json(res, 400, { ok: false, error: "email_invalid" });

    const USER_KEY = "user:" + email;

    // ✅ Asıl kayıt (user:<email>) yoksa "silindi say"
    const user = await kvGetJson(USER_KEY);
    if (!user && mode === "soft") return json(res, 404, { ok: false, error: "user_not_found" });

    // ---------- SOFT DELETE (disable) ----------
    if (mode === "soft") {
      const updatedAt = Date.now();
      await kvSetJson(USER_KEY, { ...(user || {}), email, disabled: true, updatedAt });

      // indexlerden temizle (aktif listede görünmesin)
      for (const lk of LIST_KEYS) {
        try {
          const list = (await kvGetJson(lk)) || [];
          if (Array.isArray(list) && list.length) {
            const next = list.filter((u) => normEmail(u && u.email) !== email);
            if (next.length !== list.length) await kvSetJson(lk, next);
          }
        } catch (_) {}
      }

      return json(res, 200, { ok: true, mode: "soft", email, updatedAt });
    }

    // ---------- HARD DELETE (tam temizlik) ----------
    // Login devam ediyorsa sebep: auth/pass/session kayıtları kalıyor.
    // ✅ Hepsini siliyoruz: user + auth + pass + session + verify/reset + credits/purchases/invoices + presence
    const keysToDelete = [
      USER_KEY,

      // auth / password / account (projede hangisi kullanılıyorsa)
      "auth:" + email,
      "pass:" + email,
      "password:" + email,
      "account:" + email,

      // session / token / login cache
      "session:" + email,
      "sessions:" + email,
      "token:" + email,
      "tokens:" + email,

      // verify/reset (not: token bazlı verify keyleri ayrıca temizlenir verify endpoint’inde)
      "verify:" + email,
      "reset:" + email,
      "forgot:" + email,

      // diğer veriler
      "credits:" + email,
      "invoices:" + email,
      "purchases:" + email,
      "presence:" + email,
    ];

    // 1) ilişkili key’leri sil
    const deleted = [];
    for (const k of keysToDelete) {
      try {
        await kvDel(k);
        deleted.push(k);
      } catch (_) {}
    }

    // 2) index/list key’lerinden emaili çıkar
    const cleanedLists = [];
    for (const lk of LIST_KEYS) {
      try {
        const list = (await kvGetJson(lk)) || [];
        if (Array.isArray(list) && list.length) {
          const next = list.filter((u) => normEmail(u && u.email) !== email);
          if (next.length !== list.length) {
            await kvSetJson(lk, next);
            cleanedLists.push(lk);
          }
        }
      } catch (_) {}
    }

    return json(res, 200, {
      ok: true,
      mode: "hard",
      email,
      deletedKeys: deleted,
      cleanedLists,
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: "delete_failed", message: String((e && e.message) || e) });
  }
};
