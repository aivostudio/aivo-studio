import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const getRedis = kv.getRedis;

const ORIGIN = "https://aivo.tr";

function safeStr(v) {
  return String(v || "").trim();
}

function normEmail(v) {
  const s = safeStr(v).toLowerCase();
  return s.includes("@") ? s : "";
}

function safeJsonParse(v, fallback = null) {
  try {
    if (v == null) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(String(v));
  } catch {
    return fallback;
  }
}

async function readInvoicesByEmail(email) {
  if (typeof getRedis !== "function") {
    throw new Error("KV_GETREDIS_MISSING");
  }

  const redis = getRedis();
  const key = `invoices:${email}`;
  const keyType = await redis.type(key);

  if (keyType === "list") {
    const rows = await redis.lrange(key, 0, -1);
    return Array.isArray(rows)
      ? rows
          .map((row) => safeJsonParse(row, null))
          .filter((x) => x && typeof x === "object")
      : [];
  }

  if (keyType === "string") {
    const raw = await redis.get(key);
    const arr = safeJsonParse(raw, []);
    return Array.isArray(arr)
      ? arr.filter((x) => x && typeof x === "object")
      : [];
  }

  if (keyType === "none") {
    return [];
  }

  throw new Error(`Unexpected Redis type for ${key}: ${keyType}`);
}

function normalizeLanguage(value) {
  return safeStr(value).toLowerCase() === "en" ? "en" : "tr";
}

const INVOICE_TEXT = {
  tr: {
    documentTitle: "Fatura",
    brandEyebrow: "Resmi Fatura",
    brandMeta: "Dijital ürün ve hizmet faturalandırması",
    paid: "Ödendi",
    numberPrefix: "No:",
    invoiceTitle: "Fatura",
    invoiceSubtitle:
      "Bu belge, {company} tarafından oluşturulmuş resmi satın alım kaydıdır. İşlem, ödeme ve müşteri bilgileri aşağıda düzenli ve doğrulanabilir biçimde sunulmuştur.",
    collectionSummary: "Tahsilat Özeti",
    collectionCopy:
      "{date} tarihinde tahsil edildi. Bu işlem için ödeme durumu tamamlandı ve belge oluşturuldu.",
    invoiceInfo: "Fatura Bilgileri",
    invoiceNumber: "Fatura Numarası",
    transactionDate: "İşlem Tarihi",
    dueCollection: "Vade / Tahsilat",
    customer: "Müşteri",
    fullName: "Ad Soyad",
    country: "Ülke",
    email: "E-posta",
    seller: "Satıcı",
    brand: "Marka",
    web: "Web",
    documentNote: "Belge Notu",
    documentType: "Belge Türü",
    digitalServiceInvoice: "Dijital hizmet faturası",
    paymentStatus: "Ödeme Durumu",
    channel: "Kanal",
    serviceDetail: "Hizmet Detayı",
    description: "Açıklama",
    quantity: "Miktar",
    unitPrice: "Birim Fiyat",
    amount: "Tutar",
    itemDescription:
      "AIVO dijital üyelik / kredi satın alımı kapsamında oluşturulan işlem kalemi. Satın alınan kredi: {count} kredi.",
    subtotal: "Ara Toplam",
    total: "Toplam",
    amountPaid: "Ödenen Tutar",
    note:
      "Bu belge {company} tarafından dijital ortamda oluşturulmuştur. Görsel düzen, müşteri bilgileri ve işlem özeti hızlı okunabilirlik ve profesyonel arşivleme amacıyla optimize edilmiştir.",
    page: "Sayfa 1 / 1",
    onlinePayment: "Online ödeme",
    garantiPayment: "Online ödeme / Garanti BBVA Sanal POS",
    stripePayment: "Online ödeme / Stripe",
    defaultPackage: "AIVO Paket",
    creditsPackage: "{count} Kredilik Paket",
    turkey: "Türkiye",
  },
  en: {
    documentTitle: "Invoice",
    brandEyebrow: "Official Invoice",
    brandMeta: "Digital product and service billing",
    paid: "Paid",
    numberPrefix: "No:",
    invoiceTitle: "Invoice",
    invoiceSubtitle:
      "This document is the official purchase record created by {company}. Transaction, payment and customer details are presented below in a clear and verifiable format.",
    collectionSummary: "Payment Summary",
    collectionCopy:
      "Payment was collected on {date}. The payment for this transaction was completed and the document was issued.",
    invoiceInfo: "Invoice Information",
    invoiceNumber: "Invoice Number",
    transactionDate: "Transaction Date",
    dueCollection: "Due Date / Collection",
    customer: "Customer",
    fullName: "Full Name",
    country: "Country",
    email: "Email",
    seller: "Seller",
    brand: "Brand",
    web: "Web",
    documentNote: "Document Note",
    documentType: "Document Type",
    digitalServiceInvoice: "Digital service invoice",
    paymentStatus: "Payment Status",
    channel: "Channel",
    serviceDetail: "Service Details",
    description: "Description",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    amount: "Amount",
    itemDescription:
      "Transaction item created for an AIVO digital membership / credit purchase. Credits purchased: {count}.",
    subtotal: "Subtotal",
    total: "Total",
    amountPaid: "Amount Paid",
    note:
      "This document was created digitally by {company}. The layout, customer information and transaction summary have been optimized for readability and professional record keeping.",
    page: "Page 1 / 1",
    onlinePayment: "Online payment",
    garantiPayment: "Online payment / Garanti BBVA Virtual POS",
    stripePayment: "Online payment / Stripe",
    defaultPackage: "AIVO Package",
    creditsPackage: "{count}-Credit Package",
    turkey: "Turkey",
  },
};

function formatText(template, values = {}) {
  return Object.keys(values).reduce((output, key) => {
    return output.replaceAll(`{${key}}`, String(values[key]));
  }, String(template || ""));
}

function formatDate(input, lang) {
  try {
    const d = input ? new Date(input) : new Date();
    return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Istanbul",
    }).format(d);
  } catch (_) {
    return "";
  }
}

function formatMoneyTRY(amount, lang) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "tr-TR", {
    style: "currency",
    currency: "TRY",
    ...(lang === "en" ? { currencyDisplay: "code" } : {}),
  }).format(n);
}

function localizeCountry(value, lang) {
  const country = safeStr(value);
  if (lang === "en" && country.toLowerCase() === "türkiye") {
    return "Turkey";
  }
  return country;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveProviderLabel(invoice, lang) {
  const copy = INVOICE_TEXT[lang];
  const provider = safeStr(invoice?.provider).toLowerCase();
  if (provider === "garanti") return copy.garantiPayment;
  if (provider === "stripe") return copy.stripePayment;
  return copy.onlinePayment;
}

function resolveItemTitle(invoice, lang) {
  const copy = INVOICE_TEXT[lang];
  const rawTitle =
    safeStr(invoice?.item_title) ||
    safeStr(invoice?.title) ||
    safeStr(invoice?.plan);

  if (rawTitle) {
    if (lang === "en") {
      const trCreditMatch = rawTitle.match(/^(\d+)\s+Kredilik Paket$/i);
      if (trCreditMatch) {
        return formatText(copy.creditsPackage, { count: trCreditMatch[1] });
      }

      if (rawTitle.toLowerCase() === "aivo paket") {
        return copy.defaultPackage;
      }
    }

    if (lang === "tr") {
      const enCreditMatch = rawTitle.match(/^(\d+)-Credit Package$/i);
      if (enCreditMatch) {
        return formatText(copy.creditsPackage, { count: enCreditMatch[1] });
      }

      if (rawTitle.toLowerCase() === "aivo package") {
        return copy.defaultPackage;
      }
    }

    return rawTitle;
  }

  if (invoice?.credits) {
    return formatText(copy.creditsPackage, { count: invoice.credits });
  }

  return copy.defaultPackage;
}

function resolveCreditCount(invoice) {
  if (invoice?.credit_count != null) return Number(invoice.credit_count) || 0;
  if (invoice?.credits != null) return Number(invoice.credits) || 0;
  if (invoice?.credit_amount != null) return Number(invoice.credit_amount) || 0;
  if (invoice?.quantity != null) return Number(invoice.quantity) || 0;
  return 1;
}

function resolveAmountTRY(invoice) {
  if (invoice?.amountTRY != null) return Number(invoice.amountTRY) || 0;
  if (invoice?.amount_try != null) return Number(invoice.amount_try) || 0;
  if (invoice?.total_amount != null) return Number(invoice.total_amount) || 0;
  if (invoice?.amount != null) return Number(invoice.amount) || 0;
  if (invoice?.total != null) return Number(invoice.total) || 0;
  if (invoice?.price != null) return Number(invoice.price) || 0;
  return 0;
}

function buildInvoiceHtml(data) {
  const lang = normalizeLanguage(data.lang);
  const copy = INVOICE_TEXT[lang];
  const companyName = safeStr(data.companyName || "AIVO");
  const companyCountry = localizeCountry(data.companyCountry || copy.turkey, lang);
  const customerName = safeStr(data.customerName || "-");
  const customerCountry = localizeCountry(data.customerCountry || copy.turkey, lang);
  const email = safeStr(data.email || "-");
  const invoiceNo = safeStr(data.invoiceNo || "AIVO-0001");
  const issueDate = formatDate(data.issueDate || new Date().toISOString(), lang);
  const dueDate = formatDate(
    data.dueDate || data.issueDate || new Date().toISOString(),
    lang
  );
  const itemTitle = safeStr(data.itemTitle || copy.defaultPackage);
  const creditCount = Number(data.creditCount || 1);
  const amountValue = Number(data.amount_try || 0);
  const unitPriceValue = creditCount > 0 ? amountValue / creditCount : amountValue;
  const unitPrice = formatMoneyTRY(unitPriceValue, lang);
  const totalPrice = formatMoneyTRY(amountValue, lang);
  const logoUrl = safeStr(data.logoUrl || `${ORIGIN}/aivo-logo.png`);
  const providerLabel = safeStr(data.providerLabel || copy.onlinePayment);

  return `
<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(companyName)} ${escapeHtml(copy.documentTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #eef2f7;
      color: #0f172a;
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    .page {
      width: 1240px;
      min-height: 1754px;
      margin: 0 auto;
      background:
        radial-gradient(circle at top left, rgba(124, 58, 237, 0.08), transparent 28%),
        linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
      padding: 72px 76px 56px;
      position: relative;
      overflow: hidden;
    }
    .page::before {
      content: "";
      position: absolute;
      top: -160px;
      right: -120px;
      width: 420px;
      height: 420px;
      background: radial-gradient(circle, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0.00) 68%);
      pointer-events: none;
    }
    .page::after {
      content: "";
      position: absolute;
      top: 120px;
      left: -120px;
      width: 320px;
      height: 320px;
      background: radial-gradient(circle, rgba(168,85,247,0.08) 0%, rgba(168,85,247,0.00) 68%);
      pointer-events: none;
    }
    .topbar {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 36px;
      padding-top: 42px;
      padding-bottom: 26px;
      border-bottom: 1px solid #e2e8f0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .brand-mark {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      overflow: visible;
      flex: 0 0 auto;
      background: transparent;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      width: auto;
      height: auto;
      padding: 0;
    }
    .brand-mark img {
      width: 220px;
      height: auto;
      object-fit: contain;
      display: block;
      margin-left: -22px;
    }
    .brand-copy {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .brand-eyebrow {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #64748b;
    }
    .brand-meta {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
    }
    .invoice-badge-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 14px;
    }
    .invoice-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 16px;
      border-radius: 999px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
    }
    .invoice-code {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.02em;
    }
    .hero {
      position: relative;
      z-index: 1;
      margin-top: 34px;
      display: grid;
      grid-template-columns: 1.25fr 0.75fr;
      gap: 28px;
      align-items: stretch;
    }
    .hero-left {
      padding: 0;
    }
    .invoice-title {
      margin: 0 0 12px;
      font-size: 64px;
      line-height: 0.95;
      font-weight: 900;
      letter-spacing: -0.05em;
      color: #0f172a;
    }
    .invoice-subtitle {
      max-width: 640px;
      margin: 0;
      font-size: 18px;
      line-height: 1.7;
      color: #475569;
    }
    .hero-panel {
      border-radius: 28px;
      padding: 28px 30px;
      background:
        linear-gradient(135deg, #0f172a 0%, #111827 42%, #1d4ed8 140%);
      color: #ffffff;
      box-shadow: 0 28px 60px rgba(15, 23, 42, 0.20);
      position: relative;
      overflow: hidden;
    }
    .hero-panel-label {
      position: relative;
      z-index: 1;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.20em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.72);
      margin-bottom: 16px;
    }
    .hero-panel-amount {
      position: relative;
      z-index: 1;
      margin: 0 0 10px;
      font-size: 40px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: -0.04em;
      color: #ffffff;
    }
    .hero-panel-copy {
      position: relative;
      z-index: 1;
      margin: 0;
      font-size: 16px;
      line-height: 1.7;
      color: rgba(255,255,255,0.88);
    }
    .grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 34px;
    }
    .card {
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 26px;
      background: rgba(255,255,255,0.86);
      backdrop-filter: blur(8px);
      box-shadow:
        0 18px 42px rgba(15, 23, 42, 0.07),
        inset 0 1px 0 rgba(255,255,255,0.82);
      padding: 26px 28px;
    }
    .card-title {
      margin: 0 0 18px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #475569;
    }
    .detail-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .detail-row {
      display: grid;
      grid-template-columns: 170px 1fr;
      gap: 14px;
      align-items: start;
    }
    .detail-label {
      font-size: 14px;
      font-weight: 700;
      color: #64748b;
    }
    .detail-value {
      font-size: 16px;
      line-height: 1.6;
      font-weight: 700;
      color: #0f172a;
      word-break: break-word;
    }
    .section-title {
      position: relative;
      z-index: 1;
      margin: 42px 0 18px;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #64748b;
    }
    .items-wrap {
      position: relative;
      z-index: 1;
      border-radius: 28px;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(255,255,255,0.92);
      box-shadow: 0 20px 44px rgba(15, 23, 42, 0.07);
    }
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    .table thead th {
      padding: 22px 24px;
      text-align: left;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #64748b;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .table tbody td {
      padding: 24px;
      font-size: 18px;
      line-height: 1.5;
      color: #0f172a;
      border-bottom: 1px solid #eef2f7;
      vertical-align: top;
    }
    .table tbody tr:last-child td {
      border-bottom: 0;
    }
    .table .item-name {
      font-weight: 800;
      font-size: 20px;
      color: #0f172a;
    }
    .table .item-desc {
      margin-top: 6px;
      font-size: 14px;
      line-height: 1.6;
      color: #64748b;
    }
    .table .num {
      text-align: right;
      white-space: nowrap;
      font-weight: 800;
    }
    .totals-wrap {
      position: relative;
      z-index: 1;
      margin-top: 24px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-card {
      width: 420px;
      border-radius: 26px;
      background: rgba(255,255,255,0.92);
      border: 1px solid rgba(148, 163, 184, 0.18);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.07);
      padding: 20px 24px;
    }
    .totals {
      width: 100%;
      border-collapse: collapse;
    }
    .totals td {
      padding: 12px 0;
      font-size: 16px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    .totals td:last-child {
      text-align: right;
      font-weight: 800;
      color: #0f172a;
      white-space: nowrap;
    }
    .totals tr:last-child td {
      padding-top: 18px;
      font-size: 28px;
      border-bottom: 0;
      font-weight: 900;
      color: #0f172a;
    }
    .note {
      position: relative;
      z-index: 1;
      margin-top: 28px;
      border-radius: 22px;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0;
      padding: 20px 22px;
      color: #475569;
      font-size: 14px;
      line-height: 1.75;
    }
    .footer {
      position: relative;
      z-index: 1;
      margin-top: 56px;
      padding-top: 22px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      color: #64748b;
      font-size: 14px;
    }
    .footer strong {
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">
          <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)} Logo" />
        </div>
        <div class="brand-copy">
          <div class="brand-eyebrow">${escapeHtml(copy.brandEyebrow)}</div>
          <div class="brand-meta">${escapeHtml(ORIGIN)} • ${escapeHtml(copy.brandMeta)}</div>
        </div>
      </div>

      <div class="invoice-badge-wrap">
        <div class="invoice-badge">${escapeHtml(copy.paid)}</div>
        <div class="invoice-code">${escapeHtml(copy.numberPrefix)} ${escapeHtml(invoiceNo)}</div>
      </div>
    </div>

    <div class="hero">
      <div class="hero-left">
        <h1 class="invoice-title">${escapeHtml(copy.invoiceTitle)}</h1>
        <p class="invoice-subtitle">
          ${escapeHtml(formatText(copy.invoiceSubtitle, { company: companyName }))}
        </p>
      </div>

      <div class="hero-panel">
        <div class="hero-panel-label">${escapeHtml(copy.collectionSummary)}</div>
        <div class="hero-panel-amount">${escapeHtml(totalPrice)}</div>
        <p class="hero-panel-copy">
          ${escapeHtml(formatText(copy.collectionCopy, { date: dueDate }))}
        </p>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2 class="card-title">${escapeHtml(copy.invoiceInfo)}</h2>
        <div class="detail-list">
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.invoiceNumber)}</div>
            <div class="detail-value">${escapeHtml(invoiceNo)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.transactionDate)}</div>
            <div class="detail-value">${escapeHtml(issueDate)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.dueCollection)}</div>
            <div class="detail-value">${escapeHtml(dueDate)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="card-title">${escapeHtml(copy.customer)}</h2>
        <div class="detail-list">
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.fullName)}</div>
            <div class="detail-value">${escapeHtml(customerName)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.country)}</div>
            <div class="detail-value">${escapeHtml(customerCountry)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.email)}</div>
            <div class="detail-value">${escapeHtml(email)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="card-title">${escapeHtml(copy.seller)}</h2>
        <div class="detail-list">
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.brand)}</div>
            <div class="detail-value">${escapeHtml(companyName)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Ülke</div>
            <div class="detail-value">${escapeHtml(companyCountry)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.web)}</div>
            <div class="detail-value">${escapeHtml(ORIGIN)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="card-title">${escapeHtml(copy.documentNote)}</h2>
        <div class="detail-list">
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.documentType)}</div>
            <div class="detail-value">${escapeHtml(copy.digitalServiceInvoice)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.paymentStatus)}</div>
            <div class="detail-value">${escapeHtml(copy.paid)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.channel)}</div>
            <div class="detail-value">${escapeHtml(providerLabel)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title">${escapeHtml(copy.serviceDetail)}</div>

    <div class="items-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>${escapeHtml(copy.description)}</th>
            <th class="num">${escapeHtml(copy.quantity)}</th>
            <th class="num">${escapeHtml(copy.unitPrice)}</th>
            <th class="num">${escapeHtml(copy.amount)}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="item-name">${escapeHtml(itemTitle)}</div>
              <div class="item-desc">${escapeHtml(formatText(copy.itemDescription, { count: creditCount }))}</div>
            </td>
            <td class="num">${escapeHtml(String(creditCount))}</td>
            <td class="num">${escapeHtml(unitPrice)}</td>
            <td class="num">${escapeHtml(totalPrice)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="totals-wrap">
      <div class="totals-card">
        <table class="totals">
          <tr>
            <td>${escapeHtml(copy.subtotal)}</td>
            <td>${escapeHtml(totalPrice)}</td>
          </tr>
          <tr>
            <td>${escapeHtml(copy.total)}</td>
            <td>${escapeHtml(totalPrice)}</td>
          </tr>
          <tr>
            <td>${escapeHtml(copy.amountPaid)}</td>
            <td>${escapeHtml(totalPrice)}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="note">
      ${escapeHtml(formatText(copy.note, { company: companyName }))}
    </div>

    <div class="footer">
      <div><strong>${escapeHtml(companyName)}</strong> • ${escapeHtml(ORIGIN)}</div>
      <div>${escapeHtml(copy.page)}</div>
    </div>
  </div>
</body>
</html>
  `;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (typeof getRedis !== "function") {
      return res.status(500).json({ ok: false, error: "KV_GETREDIS_MISSING" });
    }

    const email = normEmail(req.query?.email);
    const id = safeStr(req.query?.id);
    const lang = normalizeLanguage(req.query?.lang);

    if (!email) {
      return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });
    }

    if (!id) {
      return res.status(400).json({ ok: false, error: "ID_REQUIRED" });
    }

    const invoices = await readInvoicesByEmail(email);
    const invoice = invoices.find((x) => safeStr(x?.id) === id);

    if (!invoice) {
      return res.status(404).json({ ok: false, error: "INVOICE_NOT_FOUND" });
    }

    const amountTry = resolveAmountTRY(invoice);

    const reqProto = safeStr(req.headers["x-forwarded-proto"] || "https");
    const reqHost = safeStr(req.headers["x-forwarded-host"] || req.headers.host || "aivo.tr");
    const reqOrigin = `${reqProto}://${reqHost}`;

    let resolvedCustomerName = "";

    try {
      const meRes = await fetch(`${reqOrigin}/api/auth/me`, {
        method: "GET",
        headers: {
          cookie: req.headers.cookie || "",
          accept: "application/json",
        },
      });

      const meJson = await meRes.json().catch(() => null);

      const firstName =
        safeStr(meJson?.name) ||
        safeStr(meJson?.first_name) ||
        safeStr(meJson?.firstName) ||
        safeStr(meJson?.user?.name) ||
        safeStr(meJson?.user?.first_name) ||
        safeStr(meJson?.user?.firstName) ||
        safeStr(meJson?.profile?.name) ||
        safeStr(meJson?.profile?.first_name) ||
        safeStr(meJson?.profile?.firstName);

      const lastName =
        safeStr(meJson?.surname) ||
        safeStr(meJson?.last_name) ||
        safeStr(meJson?.lastName) ||
        safeStr(meJson?.user?.surname) ||
        safeStr(meJson?.user?.last_name) ||
        safeStr(meJson?.user?.lastName) ||
        safeStr(meJson?.profile?.surname) ||
        safeStr(meJson?.profile?.last_name) ||
        safeStr(meJson?.profile?.lastName);

      resolvedCustomerName = safeStr(`${firstName} ${lastName}`);
    } catch (_) {}

    const html = buildInvoiceHtml({
      lang,
      invoiceNo:
        safeStr(invoice?.invoice_id) ||
        safeStr(invoice?.invoice_no) ||
        safeStr(invoice?.invoiceNo) ||
        safeStr(invoice?.stripe?.invoice_id) ||
        safeStr(invoice?.id) ||
        "AIVO-0001",
      issueDate:
        invoice?.created_at ||
        invoice?.createdAt ||
        invoice?.created ||
        invoice?.date ||
        new Date().toISOString(),
      dueDate:
        invoice?.paid_at ||
        invoice?.updated_at ||
        invoice?.created_at ||
        invoice?.createdAt ||
        invoice?.created ||
        new Date().toISOString(),
      email,
      customerName:
        resolvedCustomerName ||
        safeStr(invoice?.customer_name) ||
        safeStr(invoice?.customerName) ||
        "-",
      customerCountry:
        safeStr(invoice?.customer_country) ||
        safeStr(invoice?.customerCountry) ||
        INVOICE_TEXT[lang].turkey,
      companyName: "AIVO",
      companyCountry: INVOICE_TEXT[lang].turkey,
      itemTitle: resolveItemTitle(invoice, lang),
      quantity: 1,
      creditCount: resolveCreditCount(invoice),
      amount_try: amountTry,
      providerLabel: resolveProviderLabel(invoice, lang),
      logoUrl: `${ORIGIN}/aivo-logo.png`,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "INVOICE_VIEW_FAILED",
      message: err?.message || "UNKNOWN_ERROR",
    });
  }
}
