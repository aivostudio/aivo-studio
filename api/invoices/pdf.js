import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
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

async function resolveExecutablePath() {
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  return await chromium.executablePath();
}

export default async function handler(req, res) {
  let browser;

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

    let aivoHtml = safeStr(invoice?.aivo_html);

if (!aivoHtml) {
  const origin =
    process.env.APP_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://aivo.tr";

  const viewUrl =
    origin +
    "/api/invoices/view?email=" +
    encodeURIComponent(email) +
    "&id=" +
    encodeURIComponent(id);

  const viewRes = await fetch(viewUrl, {
    method: "GET",
    headers: {
      accept: "text/html"
    }
  });

  if (!viewRes.ok) {
    return res.status(404).json({ ok: false, error: "AIVO_HTML_NOT_FOUND" });
  }

  aivoHtml = await viewRes.text();

  if (!safeStr(aivoHtml)) {
    return res.status(404).json({ ok: false, error: "AIVO_HTML_NOT_FOUND" });
  }
}

    const executablePath = await resolveExecutablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: 1400,
        height: 1800,
        deviceScaleFactor: 2
      },
      executablePath,
      headless: true
    });

    const page = await browser.newPage();

    await page.setContent(aivoHtml, {
      waitUntil: ["domcontentloaded", "networkidle0"]
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "16mm",
        right: "16mm",
        bottom: "16mm",
        left: "16mm"
      }
    });

    const filename = `aivo-invoice-${safeStr(invoice?.id || "document")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "INVOICE_PDF_FAILED",
      message: err?.message || "UNKNOWN_ERROR"
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}
