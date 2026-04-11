import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGet = kv.kvGet;

function safeStr(v) {
  return String(v || "").trim();
}

function normEmail(v) {
  const s = safeStr(v).toLowerCase();
  return s.includes("@") ? s : "";
}

function parseInvoices(raw) {
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  return [];
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (typeof kvGet !== "function") {
      return res.status(500).json({ ok: false, error: "KV_GET_MISSING" });
    }

    const email = normEmail(req.query?.email);
    const id = safeStr(req.query?.id);

    if (!email) {
      return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });
    }

    if (!id) {
      return res.status(400).json({ ok: false, error: "ID_REQUIRED" });
    }

    const invoicesKey = `invoices:${email}`;
    const rawInvoices = await kvGet(invoicesKey);
    const invoices = parseInvoices(rawInvoices);

    const invoice = invoices.find((x) => safeStr(x?.id) === id);

    if (!invoice) {
      return res.status(404).json({ ok: false, error: "INVOICE_NOT_FOUND" });
    }

    const aivoHtml = safeStr(invoice?.aivo_html);

    if (!aivoHtml) {
      return res.status(404).json({ ok: false, error: "AIVO_HTML_NOT_FOUND" });
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(aivoHtml);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "INVOICE_VIEW_FAILED",
      message: err?.message || "UNKNOWN_ERROR",
    });
  }
}
