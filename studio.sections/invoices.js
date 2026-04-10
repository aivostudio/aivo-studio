(function () {
  "use strict";

  if (window.__AIVO_INVOICES_SECTION_V2__) return;
  window.__AIVO_INVOICES_SECTION_V2__ = true;

  var ACTIVE_FILTER = "all";

  function qs(sel, root) {
    try {
      return (root || document).querySelector(sel);
    } catch (_) {
      return null;
    }
  }

  function qsa(sel, root) {
    try {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    } catch (_) {
      return [];
    }
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

 function getPage() {
  return (
    qs('[data-module="invoices"]') ||
    qs('[data-page="invoices"]') ||
    qs('section.main-panel[data-module="invoices"]') ||
    qs('section.main-panel[data-page="invoices"]') ||
    qs('section.main-panel:has([data-invoices-cards])') ||
    qs('section.main-panel:has([data-invoices-filter])') ||
    null
  );
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

  function getNodes(root) {
    var page = root || getPage() || document;

    return {
      page: page,
      cards: qs("[data-invoices-cards]", page),
      empty: qs("[data-invoices-empty]", page),
      filters: qsa("[data-invoices-filter]", page),
      exportBtn: qs("[data-invoices-export]", page),
      moreBtn: qs("[data-invoices-more]", page)
    };
  }

  function showEmpty(message, root) {
    var nodes = getNodes(root);
    if (!nodes.cards || !nodes.empty) return;

    nodes.cards.innerHTML = "";
    nodes.empty.hidden = false;
    nodes.empty.style.display = "";
    text(
      nodes.empty,
      message || "Henüz fatura kaydın yok. Kredi satın aldığında burada görünecek."
    );
  }

  function hideEmpty(root) {
    var nodes = getNodes(root);
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
      statusRaw: String(inv.status || "").toLowerCase().trim(),
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
    '<div class="invoice-card" data-invoice-type="' + escapeHtml(inv.type) + '">' +
      '<div class="invoice-row__main">' +
        '<div class="invoice-row__title">' + escapeHtml(inv.title) + '</div>' +
        '<div class="invoice-row__sub">' + escapeHtml(dateText + " • " + typeLabel) + '</div>' +
      '</div>' +
      '<div class="invoice-row__meta">Durum: ' + escapeHtml(inv.status) + '</div>' +
      '<div class="invoice-row__amount">' + escapeHtml(amountText || "-") + '</div>' +
      '<div class="invoice-row__actions">' +
        (
          inv.pdfUrl
            ? '<a class="invoice-row__btn" href="' + escapeHtml(inv.pdfUrl) + '" target="_blank" rel="noopener noreferrer">' + actionLabel + '</a>'
            : '<button class="invoice-row__btn" type="button" disabled>' + actionLabel + '</button>'
        ) +
      '</div>' +
    '</div>'
  );
}

function applyFilter(filterKey, root) {
  var nodes = getNodes(root);
  if (!nodes.page) return;

  var key = String(filterKey || "all").trim().toLowerCase();
  if (!key) key = "all";
  ACTIVE_FILTER = key;

  nodes.filters.forEach(function (btn) {
    var btnKey = String(btn.getAttribute("data-invoices-filter") || "").trim().toLowerCase();
    var on = (btnKey === key);

    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });

  var rows = qsa("[data-invoice-type]", nodes.page);
  if (!rows.length) return;

  var visibleCount = 0;

  rows.forEach(function (row) {
    var rowType = String(row.getAttribute("data-invoice-type") || "").trim().toLowerCase();
    var show = (key === "all") || (rowType === key);

    row.style.display = show ? "" : "none";
    if (show) visibleCount += 1;
  });

  if (!visibleCount) {
    if (nodes.empty) {
      nodes.empty.hidden = false;
      nodes.empty.style.display = "";
      text(nodes.empty, "Bu filtre için gösterilecek fatura bulunamadı.");
    }
  } else {
    hideEmpty(nodes.page);
  }
}

function bindFilters(root) {
  var nodes = getNodes(root);
  if (!nodes.page || nodes.page.__aivoInvoicesFiltersBound) {
    applyFilter(ACTIVE_FILTER || "all", nodes.page || root);
    return;
  }

  nodes.page.__aivoInvoicesFiltersBound = true;

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest
      ? e.target.closest("[data-invoices-filter]")
      : null;

    if (!btn) return;

    var page = getPage();
    if (!page || !page.contains(btn)) return;

    e.preventDefault();

    var key = String(btn.getAttribute("data-invoices-filter") || "").trim().toLowerCase();
    applyFilter(key || "all", page);
  });

  applyFilter(ACTIVE_FILTER || "all", nodes.page);
}
  function bindExport(root) {
  var nodes = getNodes(root);
  if (!nodes.page || !nodes.exportBtn || nodes.exportBtn.__aivoInvoicesExportBound) {
    return;
  }

  nodes.exportBtn.__aivoInvoicesExportBound = true;

  nodes.exportBtn.addEventListener("click", function (e) {
    e.preventDefault();

    var activeKey = String(ACTIVE_FILTER || "all").trim().toLowerCase();
    var rows = qsa("[data-invoice-type]", nodes.page);

    var visibleRows = rows.filter(function (row) {
      var rowType = String(row.getAttribute("data-invoice-type") || "").trim().toLowerCase();
      return activeKey === "all" || rowType === activeKey;
    });

    console.log("[AIVO_INVOICES_EXPORT]", {
      activeFilter: activeKey,
      totalRows: rows.length,
      visibleRows: visibleRows.length
    });

    try {
      window.print();
    } catch (err) {
      console.error("[AIVO_INVOICES_EXPORT_FAIL]", err);
    }
  });
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

  async function renderInvoices(root) {
    var nodes = getNodes(root);
    if (!nodes.cards || !nodes.empty) return;

    bindFilters(nodes.page);

    var email = await resolveEmail();
    if (!email) {
      showEmpty("Faturaları göstermek için oturum bilgisi bulunamadı.", nodes.page);
      return;
    }

    try {
      var invoices = await fetchInvoices(email);

      if (!invoices.length) {
        showEmpty("Henüz fatura kaydın yok. Kredi satın aldığında burada görünecek.", nodes.page);
        applyFilter(ACTIVE_FILTER || "all", nodes.page);
        return;
      }

      hideEmpty(nodes.page);

      var sorted = invoices.slice().sort(function (a, b) {
        return toTime(
          b.created_at || b.createdAt || b.created || b.date || b.ts || b.time
        ) - toTime(
          a.created_at || a.createdAt || a.created || a.date || a.ts || a.time
        );
      });

      nodes.cards.innerHTML = sorted.map(rowHtml).join("");
      applyFilter(ACTIVE_FILTER || "all", nodes.page);
    } catch (err) {
      console.error("[AIVO_INVOICES_RENDER_FAIL]", err);
      showEmpty("Faturalar şu an yüklenemedi.", nodes.page);
    }
  }
function boot() {
  var page = getPage();
  if (!page) return;

  bindFilters(page);
  console.log("[INVOICES_BOOT_TEST]", "boot-running");
  bindExport(page);
  renderInvoices(page);
  window.refreshInvoices = function () {
    return renderInvoices(page);
  };
}
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("load", boot);
})();
