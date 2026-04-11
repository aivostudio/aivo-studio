import Stripe from "stripe";

const ORIGIN = "https://aivo.tr";

function safeStr(v) {
  return String(v || "").trim();
}

function formatDateTR(input) {
  try {
    const d = input ? new Date(input) : new Date();
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Istanbul",
    }).format(d);
  } catch (_) {
    return "";
  }
}

function formatMoneyTRY(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat("tr-TR", {
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

function buildInvoiceHtml(data) {
  const companyName = safeStr(data.companyName || "AIVO STUDIO");
  const companyCountry = safeStr(data.companyCountry || "Türkiye");
  const customerName = safeStr(data.customerName || data.email || "-");
  const customerCountry = safeStr(data.customerCountry || "Türkiye");
  const email = safeStr(data.email || "-");
  const invoiceNo = safeStr(data.invoiceNo || "AIVO-0001");
  const issueDate = formatDateTR(data.issueDate || new Date().toISOString());
  const dueDate = formatDateTR(data.dueDate || data.issueDate || new Date().toISOString());
  const itemTitle = safeStr(data.itemTitle || "AIVO Pro");
  const quantity = Number(data.quantity || 1);
  const unitPrice = formatMoneyTRY(data.amount_try || 0);
  const totalPrice = formatMoneyTRY(data.amount_try || 0);
  const logoUrl = safeStr(data.logoUrl || `${ORIGIN}/aivo-logo.png`);

  return `
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>AIVO Fatura</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #f3f4f6;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
    }
    .page {
      width: 1120px;
      min-height: 1580px;
      margin: 0 auto;
      background: #ffffff;
      padding: 56px 58px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand img {
      height: 56px;
      width: auto;
      display: block;
      object-fit: contain;
    }
    .brand-name {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 0.3px;
      color: #111827;
    }
    .invoice-title {
      font-size: 48px;
      font-weight: 800;
      margin: 30px 0 22px;
      color: #111827;
    }
    .meta-wrap {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 20px;
    }
    .meta-box {
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      padding: 22px 24px;
      background: #fafafa;
    }
    .meta-box h3 {
      margin: 0 0 14px;
      font-size: 18px;
      font-weight: 800;
      color: #111827;
    }
    .meta-row {
      display: flex;
      gap: 10px;
      margin: 6px 0;
      font-size: 15px;
      line-height: 1.45;
    }
    .meta-row strong {
      min-width: 150px;
      color: #374151;
    }
    .summary {
      margin-top: 34px;
      padding: 24px 28px;
      border-radius: 20px;
      background: #111827;
      color: #ffffff;
    }
    .summary h2 {
      margin: 0;
      font-size: 28px;
      line-height: 1.35;
      font-weight: 800;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 34px;
    }
    .table thead th {
      text-align: left;
      font-size: 14px;
      padding: 14px 12px;
      border-bottom: 2px solid #d1d5db;
      color: #374151;
    }
    .table tbody td {
      font-size: 18px;
      padding: 18px 12px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    .table .num {
      text-align: right;
      white-space: nowrap;
    }
    .totals {
      width: 420px;
      margin-left: auto;
      margin-top: 26px;
      border-collapse: collapse;
    }
    .totals td {
      padding: 10px 0;
      font-size: 17px;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals td:last-child {
      text-align: right;
      font-weight: 700;
    }
    .totals tr:last-child td {
      border-bottom: 0;
      font-size: 24px;
      font-weight: 800;
      padding-top: 16px;
    }
    .footer {
      margin-top: 140px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div class="brand">
        <img src="${escapeHtml(logoUrl)}" alt="AIVO Logo" />
        <div class="brand-name">${escapeHtml(companyName)}</div>
      </div>
    </div>

    <div class="invoice-title">Fatura</div>

    <div class="meta-wrap">
      <div class="meta-box">
        <h3>Fatura Bilgileri</h3>
        <div class="meta-row"><strong>Fatura No</strong><span>${escapeHtml(invoiceNo)}</span></div>
        <div class="meta-row"><strong>İşlem Tarihi</strong><span>${escapeHtml(issueDate)}</span></div>
        <div class="meta-row"><strong>Vade Tarihi</strong><span>${escapeHtml(dueDate)}</span></div>
      </div>

      <div class="meta-box">
        <h3>Müşteri</h3>
        <div class="meta-row"><strong>Ad Soyad</strong><span>${escapeHtml(customerName)}</span></div>
        <div class="meta-row"><strong>Ülke</strong><span>${escapeHtml(customerCountry)}</span></div>
        <div class="meta-row"><strong>E-posta</strong><span>${escapeHtml(email)}</span></div>
      </div>
    </div>

    <div class="meta-wrap" style="margin-top:20px;">
      <div class="meta-box">
        <h3>Satıcı</h3>
        <div class="meta-row"><strong>Marka</strong><span>${escapeHtml(companyName)}</span></div>
        <div class="meta-row"><strong>Ülke</strong><span>${escapeHtml(companyCountry)}</span></div>
        <div class="meta-row"><strong>Web</strong><span>${escapeHtml(ORIGIN)}</span></div>
      </div>

      <div class="summary">
        <h2>${escapeHtml(dueDate)} tarihine kadar ${escapeHtml(totalPrice)} ödeme alındı</h2>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Açıklama</th>
          <th class="num">Miktar</th>
          <th class="num">Birim fiyatı</th>
          <th class="num">Tutar</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(itemTitle)}</td>
          <td class="num">${quantity}</td>
          <td class="num">${escapeHtml(unitPrice)}</td>
          <td class="num">${escapeHtml(totalPrice)}</td>
        </tr>
      </tbody>
    </table>

    <table class="totals">
      <tr>
        <td>Ara toplam</td>
        <td>${escapeHtml(totalPrice)}</td>
      </tr>
      <tr>
        <td>Toplam</td>
        <td>${escapeHtml(totalPrice)}</td>
      </tr>
      <tr>
        <td>Ödenen tutar</td>
        <td>${escapeHtml(totalPrice)}</td>
      </tr>
    </table>

    <div class="footer">
      <div>${escapeHtml(companyName)} • ${escapeHtml(ORIGIN)}</div>
      <div>Sayfa 1/1</div>
    </div>
  </div>
</body>
</html>
  `;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const stripeInvoiceId = safeStr(body.stripe_invoice_id);
    if (!stripeInvoiceId) {
      return res.status(400).json({ ok: false, error: "STRIPE_INVOICE_ID_REQUIRED" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId);

    const html = buildInvoiceHtml({
      invoiceNo: stripeInvoice?.number || stripeInvoice?.id || "AIVO-0001",
      issueDate: stripeInvoice?.created
        ? new Date(Number(stripeInvoice.created) * 1000).toISOString()
        : new Date().toISOString(),
      dueDate: stripeInvoice?.status_transitions?.paid_at
        ? new Date(Number(stripeInvoice.status_transitions.paid_at) * 1000).toISOString()
        : new Date().toISOString(),
      email: stripeInvoice?.customer_email || body.email || "",
      customerName: body.customer_name || stripeInvoice?.customer_name || stripeInvoice?.customer_email || "",
      customerCountry: body.customer_country || "Türkiye",
      companyName: "AIVO",
      companyCountry: "Türkiye",
      itemTitle: body.item_title || "AIVO Pro",
      quantity: 1,
      amount_try: body.amount_try || (stripeInvoice?.amount_paid ? Number(stripeInvoice.amount_paid) / 100 : 0),
      logoUrl: `${ORIGIN}/aivo-logo.png`,
    });

    return res.status(200).json({
      ok: true,
      html,
      stripe_invoice_id: stripeInvoice?.id || stripeInvoiceId,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "INVOICE_GENERATE_FAILED",
      message: err?.message || "UNKNOWN_ERROR",
    });
  }
}
