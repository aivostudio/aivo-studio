(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function text(el, val) {
    if (el) el.textContent = val;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
  }

  function safeReadAuth() {
    try {
      return JSON.parse(localStorage.getItem("aivo_auth_unified_v1") || "{}");
    } catch (_) {
      return {};
    }
  }

  async function resolveEmail() {
    try {
      var meRes = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });

      var meJson = await meRes.json().catch(function () { return null; });
      if (meRes.ok && meJson && meJson.ok && meJson.email) {
        return normalizeEmail(meJson.email);
      }
    } catch (_) {}

    try {
      if (window.__AIVO_SESSION__ && window.__AIVO_SESSION__.email) {
        return normalizeEmail(window.__AIVO_SESSION__.email);
      }
    } catch (_) {}

    var auth = safeReadAuth();
    return normalizeEmail(auth && auth.email);
  }

  function getNodes() {
    return {
      cards: qs("[data-invoices-cards]"),
      empty: qs("[data-invoices-empty]")
    };
  }

  function showEmpty(message) {
    var nodes = getNodes();
    if (!nodes.cards || !nodes.empty) return;

    nodes.cards.innerHTML = "";
    nodes.empty.hidden = false;
    nodes.empty.style.display = "";
    text(nodes.empty, message || "Henüz fatura kaydın yok. Kredi satın aldığında burada görünecek.");
  }

  function hideEmpty() {
    var nodes = getNodes();
    if (!nodes.empty) return;

    nodes.empty.hidden = true;
    nodes.empty.style.display = "none";
  }

  function toTime(v) {
    if (v == null) return 0;
    if (typeof v === "number") return v;

    var n = Number(v);
    if (!isNaN(n) && isFinite(n)) return n;

    var d = new Date(v);
    var t = d.getTime();
    return isNaN(t) ? 0 : t;
  }

  function formatDate(v) {
    var t = toTime(v);
    if (!t) return "-";

    try {
      return new Date(t).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });
    } catch (_) {
      return "-";
    }
  }

  function formatAmount(v) {
    var n = Number(v);
    if (!isFinite(n)) return "";

    try {
      return n.toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0
      });
    } catch (_) {
      return String(n);
    }
  }

  function inferType(inv) {
    var raw = String(
      inv.type ||
      inv.kind ||
      inv.event ||
      inv.action ||
      ""
    ).toLowerCase();

    if (raw.indexOf("refund") !== -1 || raw.indexOf("iade") !== -1) return "refund";
    return "purchase";
  }

  function mapTypeLabel(inv) {
    return inferType(inv) === "refund" ? "İade" : "Satın Alım";
  }

  function mapStatusLabel(status) {
    var s = String(status || "").toLowerCase().trim();

    if (s === "paid" || s === "succeeded" || s === "success") return "Ödendi";
    if (s === "pending" || s === "open" || s === "processing") return "Beklemede";
    if (s === "ready") return "Hazır";
    if (s === "refunded" || s === "partial_refund" || s === "partially_refunded") return "İade Edildi";
    if (s === "failed" || s === "error") return "Başarısız";
    if (s === "canceled" || s === "cancelled") return "İptal";

    return status ? String(status) : "-";
  }

  function normalizeInvoice(inv) {
    inv = inv && typeof inv === "object" ? inv : {};

    return {
      id: inv.id || inv.order_id || inv.orderId || "",
      type: inferType(inv),
      title: inv.pack || inv.pack_key || inv.plan || inv.title || "Satın Alım",
      status: mapStatusLabel(inv.status || ""),
      amount:
        inv.amount_try != null ? inv.amount_try :
        inv.price != null ? inv.price :
        inv.amount != null ? inv.amount :
        inv.total != null ? inv.total :
        null,
      createdAt:
        inv.created_at ||
        inv.createdAt ||
        inv.created ||
        inv.date ||
        inv.ts ||
        inv.time ||
        null,
      pdfUrl: inv.pdf_url || inv.pdfUrl || inv.url || ""
    };
  }

  function rowHtml(rawInv) {
    var inv = normalizeInvoice(rawInv);
    var typeLabel = mapTypeLabel(inv);
    var dateText = formatDate(inv.createdAt);
    var amountText = inv.amount != null ? formatAmount(inv.amount) : "";
    var actionLabel = inv.pdfUrl ? "Belge Aç" : "Belge Yok";

    return (
      '<article class="invoice-row" data-invoice-type="' + escapeHtml(inv.type) + '">' +
        '<div class="invoice-row__main">' +
          '<div class="invoice-row__title">' + escapeHtml(inv.title) + '</div>' +
          '<div class="invoice-row__sub">' + escapeHtml(dateText + " • " + typeLabel) + '</div>' +
        '</div>' +
        '<div class="invoice-row__meta">Durum: ' + escapeHtml(inv.status) + '</div>' +
        '<div class="invoice-row__amount">' + escapeHtml(amountText || "-") + '</div>' +
        '<div class="invoice-row__actions">' +
          (
            inv.pdfUrl
              ? '<a class="invoice-row__btn" href="' + escapeHtml(inv.pdfUrl) + '" target="_blank" rel="noopener noreferrer">Belge Aç</a>'
              : '<button class="invoice-row__btn" type="button" disabled>Belge Yok</button>'
          ) +
        '</div>' +
      '</article>'
    );
  }

  async function fetchInvoices(email) {
    var res = await fetch("/api/invoices/get?email=" + encodeURIComponent(email), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });

    var json = await res.json().catch(function () { return null; });
    if (!res.ok || !json || json.ok !== true) {
      throw new Error((json && (json.error || json.message)) || "invoices_fetch_failed");
    }

    return Array.isArray(json.invoices) ? json.invoices : [];
  }

  async function renderInvoices() {
    var nodes = getNodes();
    if (!nodes.cards || !nodes.empty) return;

    var email = await resolveEmail();
    if (!email) {
      showEmpty("Faturaları göstermek için oturum bilgisi bulunamadı.");
      return;
    }

    try {
      var invoices = await fetchInvoices(email);

      if (!invoices.length) {
        showEmpty("Henüz fatura kaydın yok. Kredi satın aldığında burada görünecek.");
        return;
      }

      hideEmpty();

      var sorted = invoices.slice().sort(function (a, b) {
        return toTime(
          b.created_at || b.createdAt || b.created || b.date || b.ts || b.time
        ) - toTime(
          a.created_at || a.createdAt || a.created || a.date || a.ts || a.time
        );
      });

      nodes.cards.innerHTML = sorted.map(rowHtml).join("");
    } catch (err) {
      console.error("[AIVO_INVOICES_RENDER_FAIL]", err);
      showEmpty("Faturalar şu an yüklenemedi.");
    }
  }

  function boot() {
    if (window.__aivoInvoicesSectionBooted) return;
    window.__aivoInvoicesSectionBooted = true;

    renderInvoices();
    window.refreshInvoices = renderInvoices;
  }

  document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("load", boot);
})();
