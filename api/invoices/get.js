// /api/invoices/get.js
import { kv } from "../_kv.js";

function normalizeEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return "";
  return email;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const email = normalizeEmail(req.query?.email);
    if (!email) {
      return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });
    }

    const key = `invoices:${email}`;
    const raw = await kv.get(key);

    // invoices:<email> = JSON array (string) veya array object olabilir
    let items = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (typeof raw === "string" && raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) items = parsed;
      } catch (_) {
        // bozuk data -> boş listeye düş
        items = [];
      }
    } else if (raw && typeof raw === "object") {
      // bazı KV client’lar JSON’u object döndürür
      if (Array.isArray(raw.items)) items = raw.items;
    }

    // en yeni üstte
    items = items
      .filter(Boolean)
      .sort((a, b) => (Number(b?.created || 0) - Number(a?.created || 0)));

    return res.status(200).json({ ok: true, email, items });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "INVOICES_GET_FAILED",
      message: err?.message || "UNKNOWN_ERROR",
    });
  }
}
