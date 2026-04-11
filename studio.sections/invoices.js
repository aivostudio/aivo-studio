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
      qs('.main-panel[data-module="invoices"]') ||
      qs('.main-panel[data-page="invoices"]') ||
      qs('[data-module="invoices"]') ||
      qs('[data-page="invoices"]') ||
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
      inv.status ||
      ""
    ).toLowerCase();

    if (
      raw.indexOf("refund") !== -1 ||
      raw.indexOf("refunded") !== -1 ||
      raw.indexOf("partial_refund") !== -1 ||
      raw.indexOf("partially_refunded") !== -1 ||
      raw.indexOf("iade") !== -1
    ) {
      return "refund";
    }

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
function rowHtml(rawInv, email) {
  var inv = normalizeInvoice(rawInv);
  var typeLabel = mapTypeLabel(inv);
  var dateText = formatDate(inv.createdAt);
  var amountText = inv.amount != null ? formatAmount(inv.amount) : "-";

  var creditCount =
    rawInv && rawInv.credit_count != null ? Number(rawInv.credit_count) :
    rawInv && rawInv.credits != null ? Number(rawInv.credits) :
    rawInv && rawInv.credit_amount != null ? Number(rawInv.credit_amount) :
    rawInv && rawInv.quantity != null ? Number(rawInv.quantity) :
    null;

  var packTitle =
    creditCount && isFinite(creditCount) && creditCount > 0
      ? String(creditCount) + " Kredilik Paket"
      : (inv.title || "Kredi Paketi");

  var packSub =
    creditCount && isFinite(creditCount) && creditCount > 0
      ? "Toplam " + String(creditCount) + " kredi tanımı"
      : "Satın alım detayı";

  var normalizedEmail = normalizeEmail(email);
  var openBase =
    inv.type === "refund"
      ? "/api/invoices/refund-view"
      : "/api/invoices/view";

  var openUrl =
    (inv.id && normalizedEmail)
      ? (openBase + "?email=" + encodeURIComponent(normalizedEmail) + "&id=" + encodeURIComponent(inv.id))
      : "";

  var statusClass =
    inv.type === "refund"
      ? "inv-badge inv-badge--refund"
      : (inv.statusRaw === "paid" || inv.statusRaw === "succeeded" || inv.statusRaw === "success")
        ? "inv-badge inv-badge--ok"
        : (inv.statusRaw === "failed" || inv.statusRaw === "error")
          ? "inv-badge inv-badge--bad"
          : "inv-badge inv-badge--status";

  var typeClass =
    inv.type === "refund"
      ? "inv-badge inv-badge--refund"
      : "inv-badge inv-badge--provider";

  var actionLabel =
    inv.type === "refund"
      ? "İade Belgesini Aç"
      : "Faturayı Görüntüle";

  var amountLabel =
    inv.type === "refund"
      ? "İade Tutarı"
      : "Ödeme Tutarı";

  var detailLine =
    inv.type === "refund"
      ? "İşlem türü iade olarak işlendi."
      : "Paket ödemesi başarıyla tamamlandı.";

  return (
    '<div class="invoice-card" data-invoice-type="' + escapeHtml(inv.type) + '">' +

      '<div class="inv-head">' +
        '<div class="inv-head__left">' +
          '<div class="inv-title">AIVO FATURA KAYDI</div>' +
          '<div class="inv-id">' + escapeHtml(packTitle) + '</div>' +
          '<div class="inv-ref">' + escapeHtml(packSub) + '</div>' +
        '</div>' +
        '<div class="inv-head__right">' +
          '<span class="' + escapeHtml(typeClass) + '">' + escapeHtml(typeLabel) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="inv-grid">' +
        '<div class="inv-item">' +
          '<span>Tarih</span>' +
          '<strong>' + escapeHtml(dateText) + '</strong>' +
        '</div>' +
        '<div class="inv-item">' +
          '<span>Durum</span>' +
          '<strong><span class="' + escapeHtml(statusClass) + '">' + escapeHtml(inv.status || "-") + '</span></strong>' +
        '</div>' +
        '<div class="inv-item">' +
          '<span>' + escapeHtml(amountLabel) + '</span>' +
          '<strong>' + escapeHtml(amountText) + '</strong>' +
        '</div>' +
      '</div>' +

      '<div class="inv-ref">' + escapeHtml(detailLine) + '</div>' +

      (
        openUrl
          ? '<a class="invoice-row__btn invoice-row__btn--primary" href="' + escapeHtml(openUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(actionLabel) + '</a>'
          : '<button class="invoice-row__btn invoice-row__btn--primary" type="button" disabled>Belge Hazır Değil</button>'
      ) +

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
  btn.classList.toggle("chip-btn--primary", on);
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

    nodes.filters.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();

        var key = String(btn.getAttribute("data-invoices-filter") || "").trim().toLowerCase();
        applyFilter(key || "all", nodes.page);
      });
    });

    applyFilter(ACTIVE_FILTER || "all", nodes.page);
  }

  function bindExport(root) {
    var nodes = getNodes(root);
    if (!nodes.page || !nodes.exportBtn || nodes.exportBtn.__aivoInvoicesExportBound) {
      return;
    }

    nodes.exportBtn.__aivoInvoicesExportBound = true;

    nodes.exportBtn.addEventListener("click", async function (e) {
      e.preventDefault();

      var activeKey = String(ACTIVE_FILTER || "all").trim().toLowerCase();
      var email = await resolveEmail();
      if (!email) {
        console.error("[AIVO_INVOICES_EXPORT_FAIL]", "email_missing");
        return;
      }

      try {
        var res = await fetch("/api/invoices/get?email=" + encodeURIComponent(email), {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store"
        });

        var json = await res.json().catch(function () { return null; });
        if (!res.ok || !json || json.ok !== true) {
          throw new Error((json && (json.error || json.message)) || "invoices_export_fetch_failed");
        }

        var invoices = Array.isArray(json.invoices) ? json.invoices : [];
        var filtered = invoices.filter(function (inv) {
          var type = inferType(inv);
          return activeKey === "all" || type === activeKey;
        });

        var payload = {
          exported_at: new Date().toISOString(),
          email: email,
          filter: activeKey,
          count: filtered.length,
          invoices: filtered
        };

        var blob = new Blob(
          [JSON.stringify(payload, null, 2)],
          { type: "application/json;charset=utf-8" }
        );

        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "aivo-invoices-" + activeKey + ".json";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(function () {
          try { URL.revokeObjectURL(url); } catch (_) {}
        }, 500);
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
    bindExport(nodes.page);

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

    nodes.cards.innerHTML = sorted.map(function (inv) {
  return rowHtml(inv, email);
}).join("");
      applyFilter(ACTIVE_FILTER || "all", nodes.page);
    } catch (err) {
      console.error("[AIVO_INVOICES_RENDER_FAIL]", err);
      showEmpty("Faturalar şu an yüklenemedi.", nodes.page);
    }
  }

  function bind(page) {
    if (!page || page.__aivoInvoicesBoundV3) return;
    page.__aivoInvoicesBoundV3 = true;

    bindFilters(page);
    bindExport(page);
    renderInvoices(page);

    window.refreshInvoices = function () {
      return renderInvoices(page);
    };
  }

  function tryInit() {
    var page = getPage();
    if (!page) return false;
    bind(page);
    return true;
  }

  function boot() {
    tryInit();

    try {
      var mo = new MutationObserver(function () {
        tryInit();
      });

      mo.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
