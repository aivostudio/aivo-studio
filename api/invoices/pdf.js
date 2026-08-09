import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

function safeStr(v) {
  return String(v || "").trim();
}

function normEmail(v) {
  const s = safeStr(v).toLowerCase();
  return s.includes("@") ? s : "";
}

function normalizeLanguage(value) {
  return safeStr(value).toLowerCase() === "en" ? "en" : "tr";
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

    const email = normEmail(req.query?.email);
    const id = safeStr(req.query?.id);
    const lang = normalizeLanguage(req.query?.lang);
    const download = safeStr(req.query?.download) === "1";

    if (!email) {
      return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });
    }

    if (!id) {
      return res.status(400).json({ ok: false, error: "ID_REQUIRED" });
    }

    const viewUrl = new URL("/api/invoices/view", "https://aivo.tr");
    viewUrl.searchParams.set("email", email);
    viewUrl.searchParams.set("id", id);
    viewUrl.searchParams.set("lang", lang);

    const executablePath = await resolveExecutablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: 1400,
        height: 1900,
        deviceScaleFactor: 1,
      },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.emulateMediaType("screen");

    const cookieHeader = safeStr(req.headers.cookie);
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    }

    const viewResponse = await page.goto(viewUrl.href, {
      waitUntil: ["domcontentloaded", "networkidle0"],
      timeout: 30000,
    });

    if (!viewResponse || !viewResponse.ok()) {
      const status = viewResponse ? viewResponse.status() : 0;
      throw new Error(`INVOICE_VIEW_FAILED_${status}`);
    }

    const renderSize = await page.evaluate(() => {
      const el = document.querySelector(".page") || document.documentElement;
      const rect = el.getBoundingClientRect();
      const width = Math.ceil(Math.max(rect.width, el.scrollWidth || 0));
      const height = Math.ceil(Math.max(rect.height, el.scrollHeight || 0));
      return { width, height };
    });

    const a4WidthPx = 793.7008;
    const a4HeightPx = 1122.5197;
    const safety = 0.97;
    const fitScale = Math.min(
      1,
      (a4WidthPx / Math.max(1, renderSize.width)) * safety,
      (a4HeightPx / Math.max(1, renderSize.height)) * safety
    );
    const pdfScale = Math.max(0.1, Number(fitScale.toFixed(4)));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      scale: pdfScale,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    const safeId = id.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100) || "document";
    const filename = `aivo-invoice-${safeId}.pdf`;
    const disposition = download ? "attachment" : "inline";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-AIVO-PDF-Render-Width", String(renderSize.width));
    res.setHeader("X-AIVO-PDF-Render-Height", String(renderSize.height));
    res.setHeader("X-AIVO-PDF-Scale", String(pdfScale));

    return res.status(200).send(Buffer.from(pdfBuffer));
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "INVOICE_PDF_FAILED",
      message: err?.message || "UNKNOWN_ERROR",
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}
