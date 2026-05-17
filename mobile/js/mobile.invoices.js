/* =========================================================
   AIVO MOBILE — ACCOUNT INVOICES
   File: /mobile/js/mobile.invoices.js
   ========================================================= */

(function(){
  "use strict";

  if (window.__AIVO_MOBILE_INVOICES__) return;
  window.__AIVO_MOBILE_INVOICES__ = true;

  let activeFilter = "all";

  function qs(sel, root){
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeEmail(value){
    return String(value || "").trim().toLowerCase();
  }

  async function resolveEmail(){
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });

      const json = await res.json().catch(function(){ return null; });

      if (res.ok && json && json.email) {
        return normalizeEmail(json.email);
      }
    } catch (_) {}

    return "";
  }

  function toTime(value){
    const date = new Date(value || 0);
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function formatDate(value){
    const time = toTime(value);
    if (!time) return "-";

    return new Date(time).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }

  function formatMoney(value){
    const n = Number(value || 0);

    return n.toLocaleString("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0
    });
  }

  function inferType(invoice){
    const raw = String(
      invoice.type ||
      invoice.kind ||
      invoice.event ||
      invoice.action ||
      invoice.status ||
      ""
    ).toLowerCase();

    if (
      raw.includes("refund") ||
      raw.includes("refunded") ||
      raw.includes("partial_refund") ||
      raw.includes("partially_refunded") ||
      raw.includes("iade")
    ) {
      return "refund";
    }

    return "purchase";
  }

  function getAmount(invoice){
    if (invoice.amountTRY != null) return invoice.amountTRY;
    if (invoice.amount_try != null) return invoice.amount_try;
    if (invoice.price != null) return invoice.price;
    if (invoice.amount != null) return invoice.amount;
    if (invoice.total_amount != null) return invoice.total_amount;
    if (invoice.total != null) return invoice.total;
    return 0;
  }

  function getCredits(invoice){
    if (invoice.credit_count != null) return Number(invoice.credit_count);
    if (invoice.credits != null) return Number(invoice.credits);
    if (invoice.credit_amount != null) return Number(invoice.credit_amount);
    if (invoice.quantity != null) return Number(invoice.quantity);
    return 0;
  }

  function getCreatedAt(invoice){
    return (
      invoice.created_at ||
      invoice.createdAt ||
      invoice.created ||
      invoice.date ||
      invoice.ts ||
      invoice.time ||
      ""
    );
  }

  function statusLabel(invoice){
    const status = String(invoice.status || "").toLowerCase();
if (status === "paid" || status === "succeeded" || status === "success") {
  return window.t ? window.t("invoices.statusPaid") : "Ödendi";
}

if (
  status === "refunded" ||
  status === "partial_refund" ||
  status === "partially_refunded"
) {
  return window.t ? window.t("invoices.statusRefunded") : "İade Edildi";
}

if (
  status === "pending" ||
  status === "open" ||
  status === "processing"
) {
  return window.t ? window.t("invoices.statusPending") : "Beklemede";
}

if (status === "failed" || status === "error") {
  return window.t ? window.t("invoices.statusFailed") : "Başarısız";
}

if (status === "canceled" || status === "cancelled") {
  return window.t ? window.t("invoices.statusCancelled") : "İptal";
}

    return invoice.status || "-";
  }

  function invoiceCard(invoice, email){
    const type = inferType(invoice);
    const id = String(invoice.id || invoice.order_id || invoice.orderId || "").trim();
    const credits = getCredits(invoice);

  const title = credits > 0
  ? credits + " " + (window.t ? window.t("invoices.creditPackage") : "Kredilik Paket")
  : (
      invoice.pack ||
      invoice.pack_key ||
      invoice.plan ||
      invoice.title ||
      (window.t ? window.t("invoices.defaultPackage") : "Kredi Paketi")
    );

const sub = credits > 0
  ? (
      (window.t ? window.t("invoices.totalCredits") : "Toplam") +
      " " +
      credits +
      " " +
      (window.t ? window.t("invoices.creditDefined") : "kredi tanımı")
    )
  : (window.t ? window.t("invoices.purchaseDetail") : "Satın alım detayı");

    const amount = formatMoney(getAmount(invoice));
    const date = formatDate(getCreatedAt(invoice));
    const status = statusLabel(invoice);

    const openBase = type === "refund" ? "/api/invoices/refund-view" : "/api/invoices/view";
    const openUrl = id && email
      ? openBase + "?email=" + encodeURIComponent(email) + "&id=" + encodeURIComponent(id)
      : "";

    const actionText = type === "refund"
  ? (window.t ? window.t("invoices.openRefund") : "İade Belgesini Aç")
  : (window.t ? window.t("invoices.openInvoice") : "Faturayı Görüntüle");

const typeText = type === "refund"
  ? (window.t ? window.t("invoices.typeRefund") : "İade")
  : (window.t ? window.t("invoices.typePurchase") : "Satın Alım");

    return `
      <article class="mobile-invoice-card" data-mobile-invoice-type="${escapeHtml(type)}">
        <div class="mobile-invoice-top">
          <div>
            <small>AIVO FATURA KAYDI</small>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(sub)}</p>
          </div>

          <span class="mobile-invoice-type">${escapeHtml(typeText)}</span>
        </div>

        <div class="mobile-invoice-meta">
          <div>
           <small>${window.t ? window.t("invoices.date") : "Tarih"}</small>
            <strong>${escapeHtml(date)}</strong>
          </div>

          <div>
           <small>${window.t ? window.t("invoices.status") : "Durum"}</small>
            <strong>${escapeHtml(status)}</strong>
          </div>

          <div>
          <small>${window.t ? window.t("invoices.amount") : "Tutar"}</small>
            <strong>${escapeHtml(amount)}</strong>
          </div>
        </div>

        ${
          openUrl
            ? `<a class="mobile-invoice-btn" href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(actionText)}</a>`
            : `<button class="mobile-invoice-btn" type="button" disabled>Belge Hazır Değil</button>`
        }
      </article>
    `;
  }

  function applyFilter(root){
    const cards = qsa("[data-mobile-invoice-type]", root);
    const empty = qs("[data-mobile-invoices-empty]", root);

    let visibleCount = 0;

    cards.forEach(function(card){
      const type = card.getAttribute("data-mobile-invoice-type");
      const show = activeFilter === "all" || type === activeFilter;

      card.hidden = !show;

      if (show) {
        visibleCount += 1;
      }
    });

    if (empty && cards.length > 0) {
      empty.hidden = visibleCount > 0;

      if (visibleCount === 0) {
       empty.textContent = window.t
  ? window.t("invoices.emptyFilter")
  : "Bu filtre için fatura bulunamadı.";
      }
    }
  }

  function bindFilters(root){
    qsa("[data-mobile-invoices-filter]", root).forEach(function(btn){
      if (btn.__aivoMobileInvoiceFilterBound) return;
      btn.__aivoMobileInvoiceFilterBound = true;

      btn.addEventListener("click", function(){
        activeFilter = btn.getAttribute("data-mobile-invoices-filter") || "all";

        qsa("[data-mobile-invoices-filter]", root).forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });

        applyFilter(root);
      });
    });
  }

async function mobileInvoicesInit(){
  const root = qs("#mobileAccountInvoicesSection");
  if (!root) {
    console.warn("[AIVO_MOBILE_INVOICES] root_not_found");
    return;
  }

  const list = qs("[data-mobile-invoices-list]", root);
  const empty = qs("[data-mobile-invoices-empty]", root);

  if (!list || !empty) {
    console.warn("[AIVO_MOBILE_INVOICES] list_or_empty_not_found");
    return;
  }

  bindFilters(root);

  empty.hidden = false;
empty.textContent = window.t
  ? window.t("invoices.loading")
  : "Faturalar yükleniyor...";

  const email = await resolveEmail();
  console.log("[AIVO_MOBILE_INVOICES] resolved_email:", email);

  if (!email) {
    empty.hidden = false;
    empty.textContent = window.t
  ? window.t("invoices.sessionMissing")
  : "Faturaları göstermek için oturum bilgisi bulunamadı.";
    return;
  }

  try {
    const url = "/api/invoices/get?email=" + encodeURIComponent(email);
    console.log("[AIVO_MOBILE_INVOICES] fetch_url:", url);

    const res = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });

    const json = await res.json().catch(function(){
      return null;
    });

    console.log("[AIVO_MOBILE_INVOICES] response:", {
      ok: res.ok,
      status: res.status,
      json: json
    });

    if (!res.ok || !json || json.ok !== true) {
      throw new Error((json && (json.error || json.message)) || "mobile_invoices_fetch_failed");
    }

    const invoices = Array.isArray(json.invoices) ? json.invoices : [];

    if (!invoices.length) {
      list.innerHTML = "";
      empty.hidden = false;
     empty.textContent = window.t
  ? window.t("invoices.empty")
  : "Henüz fatura kaydın yok. Kredi satın aldığında burada görünecek.";
      return;
    }

    const sorted = invoices.slice().sort(function(a, b){
      return toTime(getCreatedAt(b)) - toTime(getCreatedAt(a));
    });

    list.innerHTML = sorted.map(function(invoice){
      return invoiceCard(invoice, email);
    }).join("");

    empty.hidden = true;
    applyFilter(root);
  } catch (err) {
    console.error("[AIVO_MOBILE_INVOICES] render_failed:", err);
    list.innerHTML = "";
    empty.hidden = false;
   empty.textContent = window.t
  ? window.t("invoices.loadFailed")
  : "Faturalar şu an yüklenemedi.";
  }
}

  window.mobileInvoicesInit = mobileInvoicesInit;
})();
