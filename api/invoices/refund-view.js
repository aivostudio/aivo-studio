import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGet = kv.kvGet;

const ORIGIN = "https://aivo.tr";

function safeStr(v) {
  return String(v || "").trim();
}

function normEmail(v) {
  const s = safeStr(v).toLowerCase();
  return s.includes("@") ? s : "";
}

function normalizeLanguage(value) {
  return safeStr(value).toLowerCase().startsWith("en") ? "en" : "tr";
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
  }).format(n);
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function localizeCountry(value, lang) {
  const raw = safeStr(value);
  if (lang !== "en") return raw;
  return /^(t\u00fcrkiye|turkiye)$/i.test(raw) ? "Turkey" : raw;
}

function localizeItemTitle(value, lang) {
  const raw = safeStr(value);
  if (lang !== "en") return raw;

  const creditMatch = raw.match(/^(\d+)\s+Kredilik\s+Paket$/i);
  if (creditMatch) return `${creditMatch[1]}-Credit Package`;
  if (/^AIVO\s+Paket$/i.test(raw)) return "AIVO Package";
  return raw;
}

const REFUND_COPY = {
  tr: {
    documentTitle: "İade Belgesi",
    brandEyebrow: "Official Refund",
    brandMeta: "Dijital ürün ve hizmet iade belgesi",
    badge: "Refunded",
    numberPrefix: "No:",
    mainTitle: "İade Belgesi",
    mainDescription(companyName) {
      return `Bu belge, ${companyName} tarafından oluşturulmuş resmi iade / geri ödeme kaydıdır. İşlem, iade ve müşteri bilgileri aşağıda düzenli ve doğrulanabilir biçimde sunulmuştur.`;
    },
    summaryTitle: "İade Özeti",
    summaryText(refundDate) {
      return `${refundDate} tarihinde iade edildi. Bu işlem için geri ödeme durumu tamamlandı ve belge oluşturuldu.`;
    },
    refundInfo: "İade Bilgileri",
    documentNumber: "Belge Numarası",
    transactionDate: "İşlem Tarihi",
    refundDate: "İade Tarihi",
    customer: "Müşteri",
    fullName: "Ad Soyad",
    country: "Ülke",
    email: "E-posta",
    seller: "Satıcı",
    brand: "Marka",
    web: "Web",
    documentNote: "Belge Notu",
    documentType: "Belge Türü",
    documentTypeValue: "İade / geri ödeme belgesi",
    paymentStatus: "Ödeme Durumu",
    paymentStatusValue: "İade Edildi",
    channel: "Kanal",
    channelValue: "Online ödeme / Stripe iadesi",
    refundDetail: "İade Detayı",
    description: "Açıklama",
    quantity: "Miktar",
    unitPrice: "Birim Fiyat",
    amount: "Tutar",
    itemDescription(creditCount) {
      return `AIVO dijital üyelik / kredi satın alımına ait iade işlem kalemi. İade edilen kredi: ${creditCount} kredi.`;
    },
    subtotal: "Ara Toplam",
    total: "Toplam",
    refundedAmount: "İade Edilen Tutar",
    note(companyName) {
      return `Bu belge ${companyName} tarafından dijital ortamda oluşturulmuştur. Görsel düzen, müşteri bilgileri ve iade özeti hızlı okunabilirlik ve profesyonel arşivleme amacıyla optimize edilmiştir.`;
    },
    page: "Sayfa 1 / 1",
    defaultCountry: "Türkiye",
    defaultItemTitle: "AIVO Pro",
  },
  en: {
    documentTitle: "Refund Document",
    brandEyebrow: "Official Refund",
    brandMeta: "Digital product and service refund document",
    badge: "Refunded",
    numberPrefix: "No:",
    mainTitle: "Refund Document",
    mainDescription(companyName) {
      return `This document is the official refund record issued by ${companyName}. Transaction, refund and customer details are presented below in a clear and verifiable format.`;
    },
    summaryTitle: "Refund Summary",
    summaryText(refundDate) {
      return `Refunded on ${refundDate}. The refund was completed and this document was generated.`;
    },
    refundInfo: "Refund Information",
    documentNumber: "Document Number",
    transactionDate: "Transaction Date",
    refundDate: "Refund Date",
    customer: "Customer",
    fullName: "Full Name",
    country: "Country",
    email: "Email",
    seller: "Seller",
    brand: "Brand",
    web: "Web",
    documentNote: "Document Note",
    documentType: "Document Type",
    documentTypeValue: "Refund document",
    paymentStatus: "Payment Status",
    paymentStatusValue: "Refunded",
    channel: "Channel",
    channelValue: "Online payment / Stripe refund",
    refundDetail: "Refund Details",
    description: "Description",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    amount: "Amount",
    itemDescription(creditCount) {
      return `Refund item for an AIVO digital membership / credit purchase. Refunded credits: ${creditCount}.`;
    },
    subtotal: "Subtotal",
    total: "Total",
    refundedAmount: "Refunded Amount",
    note(companyName) {
      return `This document was generated digitally by ${companyName}. Its visual layout, customer information and refund summary are optimized for readability and professional record keeping.`;
    },
    page: "Page 1 / 1",
    defaultCountry: "Turkey",
    defaultItemTitle: "AIVO Pro",
  },
};

function buildRefundHtml(data) {
  const lang = normalizeLanguage(data.lang);
  const copy = REFUND_COPY[lang];
  const companyName = safeStr(data.companyName || "AIVO");
  const companyCountry = localizeCountry(
    data.companyCountry || copy.defaultCountry,
    lang
  );
  const customerName = safeStr(data.customerName || "-");
  const customerCountry = localizeCountry(
    data.customerCountry || copy.defaultCountry,
    lang
  );
  const email = safeStr(data.email || "-");
  const invoiceNo = safeStr(data.invoiceNo || "AIVO-0001");
  const issueDate = formatDate(
    data.issueDate || new Date().toISOString(),
    lang
  );
  const refundDate = formatDate(
    data.refundDate || data.issueDate || new Date().toISOString(),
    lang
  );
  const itemTitle = localizeItemTitle(
    data.itemTitle || copy.defaultItemTitle,
    lang
  );
  const quantity = Number(data.quantity || 1);

  const creditCount = Number(
    data.creditCount != null
      ? data.creditCount
      : data.credits != null
        ? data.credits
        : data.credit_amount != null
          ? data.credit_amount
          : quantity
  );

  const amountValue = Number(data.amount_try || 0);
  const unitPrice = formatMoneyTRY(amountValue, lang);
  const totalPrice = formatMoneyTRY(amountValue, lang);
  const logoUrl = safeStr(data.logoUrl || `${ORIGIN}/aivo-logo.png`);

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

    .hero-panel::before {
      content: "";
      position: absolute;
      top: -40px;
      right: -40px;
      width: 180px;
      height: 180px;
      background: radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 70%);
      pointer-events: none;
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
        <div class="invoice-badge">${escapeHtml(copy.badge)}</div>
        <div class="invoice-code">${escapeHtml(copy.numberPrefix)} ${escapeHtml(invoiceNo)}</div>
      </div>
    </div>

    <div class="hero">
      <div class="hero-left">
        <h1 class="invoice-title">${escapeHtml(copy.mainTitle)}</h1>
        <p class="invoice-subtitle">
          ${escapeHtml(copy.mainDescription(companyName))}
        </p>
      </div>

      <div class="hero-panel">
        <div class="hero-panel-label">${escapeHtml(copy.summaryTitle)}</div>
        <div class="hero-panel-amount">${escapeHtml(totalPrice)}</div>
        <p class="hero-panel-copy">
          ${escapeHtml(copy.summaryText(refundDate))}
        </p>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2 class="card-title">${escapeHtml(copy.refundInfo)}</h2>
        <div class="detail-list">
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.documentNumber)}</div>
            <div class="detail-value">${escapeHtml(invoiceNo)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.transactionDate)}</div>
            <div class="detail-value">${escapeHtml(issueDate)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.refundDate)}</div>
            <div class="detail-value">${escapeHtml(refundDate)}</div>
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
            <div class="detail-label">${escapeHtml(copy.country)}</div>
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
            <div class="detail-value">${escapeHtml(copy.documentTypeValue)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.paymentStatus)}</div>
            <div class="detail-value">${escapeHtml(copy.paymentStatusValue)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(copy.channel)}</div>
            <div class="detail-value">${escapeHtml(copy.channelValue)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title">${escapeHtml(copy.refundDetail)}</div>

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
              <div class="item-desc">${escapeHtml(copy.itemDescription(creditCount))}</div>
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
            <td>${escapeHtml(copy.refundedAmount)}</td>
            <td>${escapeHtml(totalPrice)}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="note">
      ${escapeHtml(copy.note(companyName))}
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

    if (typeof kvGet !== "function") {
      return res.status(500).json({ ok: false, error: "KV_GET_MISSING" });
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

    const invoicesKey = `invoices:${email}`;
    const rawInvoices = await kvGet(invoicesKey);
    const invoices = parseInvoices(rawInvoices);

    const invoice = invoices.find((x) => safeStr(x?.id) === id);

    if (!invoice) {
      return res.status(404).json({ ok: false, error: "INVOICE_NOT_FOUND" });
    }

    const invoiceStatus = safeStr(invoice?.status).toLowerCase();
    const invoiceType = safeStr(
      invoice?.document_type ||
      invoice?.type ||
      invoice?.kind ||
      invoice?.event_type
    ).toLowerCase();

    const isRefund =
      invoiceStatus === "refunded" ||
      invoiceStatus === "refund" ||
      invoiceType === "refund" ||
      invoiceType === "refunded";

    if (!isRefund) {
      return res.status(400).json({ ok: false, error: "REFUND_RECORD_REQUIRED" });
    }

    const amountTry =
      invoice?.amount_try != null ? Number(invoice.amount_try) :
      invoice?.amount != null ? Number(invoice.amount) :
      invoice?.total != null ? Number(invoice.total) :
      invoice?.price != null ? Number(invoice.price) :
      0;

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

    const copy = REFUND_COPY[lang];

    const html = buildRefundHtml({
      lang,
      invoiceNo:
        safeStr(invoice?.refund_no) ||
        safeStr(invoice?.refundNo) ||
        safeStr(invoice?.invoice_no) ||
        safeStr(invoice?.invoiceNo) ||
        safeStr(invoice?.stripe?.refund_id) ||
        safeStr(invoice?.stripe?.invoice_id) ||
        safeStr(invoice?.id) ||
        "AIVO-REFUND-0001",
      issueDate:
        invoice?.created_at ||
        invoice?.createdAt ||
        invoice?.created ||
        invoice?.date ||
        new Date().toISOString(),
      refundDate:
        invoice?.refunded_at ||
        invoice?.refund_date ||
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
        copy.defaultCountry,
      companyName: "AIVO",
      companyCountry: copy.defaultCountry,
      itemTitle:
        safeStr(invoice?.item_title) ||
        safeStr(invoice?.title) ||
        safeStr(invoice?.plan) ||
        copy.defaultItemTitle,
      quantity: Number(invoice?.quantity || 1),
      creditCount:
        invoice?.credit_count != null ? Number(invoice.credit_count) :
        invoice?.credits != null ? Number(invoice.credits) :
        invoice?.credit_amount != null ? Number(invoice.credit_amount) :
        invoice?.quantity != null ? Number(invoice.quantity) :
        1,
      amount_try: amountTry,
      logoUrl: `${ORIGIN}/aivo-logo.png`,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "REFUND_VIEW_FAILED",
      message: err?.message || "UNKNOWN_ERROR",
    });
  }
}
