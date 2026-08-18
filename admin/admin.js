// /admin/admin.js
// Thin loader: keeps the original admin panel in admin.core.js and corrects only iOS sales rendering.
(function () {
  const originalFetch = window.fetch.bind(window);
  let lastIosReport = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMoney(value, currency) {
    const n = Number(value || 0);
    return n.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " " + String(currency || "").trim();
  }

  function extendedAppleAmount(value, units) {
    const amount = Number(value || 0);
    const qty = Number(units || 0);

    if (!Number.isFinite(amount) || !Number.isFinite(qty)) return 0;
    if (qty < 0) return -Math.abs(amount) * Math.abs(qty);
    if (qty > 0) return amount * qty;
    return amount;
  }

  function addCurrencyTotal(bucket, currency, value) {
    const code = String(currency || "").trim() || "?";
    const amount = Number(value || 0);
    bucket[code] = Number(bucket[code] || 0) + amount;
  }

  function formatCurrencyTotals(bucket) {
    const entries = Object.entries(bucket || {});
    if (!entries.length) return "0,00";

    return entries
      .map(function (entry) {
        return formatMoney(entry[1], entry[0]);
      })
      .join(" | ");
  }

  function paidIosRows(rows) {
    return (Array.isArray(rows) ? rows : []).filter(function (row) {
      const customerPrice = Number(row && row["Customer Price"] || 0);
      const developerProceeds = Number(row && row["Developer Proceeds"] || 0);
      return customerPrice !== 0 || developerProceeds !== 0;
    });
  }

  function renderIosTruth() {
    const report = lastIosReport;
    if (!report || !report.ok) return;

    const unitsEl = document.getElementById("iosSalesUnits");
    const customerEl = document.getElementById("iosSalesCustomerTotal");
    const proceedsEl = document.getElementById("iosSalesProceedsTotal");
    const statusEl = document.getElementById("iosSalesStatus");
    const tbody = document.getElementById("iosSalesTbody");
    const selectedDate = String(report.date || document.getElementById("iosSalesDate")?.value || "-");

    if (!report.report_ready) {
      if (unitsEl) unitsEl.textContent = "0";
      if (customerEl) customerEl.textContent = "—";
      if (proceedsEl) proceedsEl.textContent = "—";
      if (statusEl) statusEl.textContent = `Gün: ${selectedDate} / Rapor henüz hazır değil`;
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="muted" style="padding:12px;">
              Apple günlük satış raporu bu tarih için henüz hazır değil.
            </td>
          </tr>
        `;
      }
      return;
    }

    const rows = paidIosRows(report.rows);
    const customerTotals = {};
    const proceedsTotals = {};
    let totalUnits = 0;

    rows.forEach(function (row) {
      const units = Number(row.Units || 0);
      totalUnits += Number.isFinite(units) ? units : 0;

      addCurrencyTotal(
        customerTotals,
        row["Customer Currency"],
        extendedAppleAmount(row["Customer Price"], units)
      );

      addCurrencyTotal(
        proceedsTotals,
        row["Currency of Proceeds"],
        extendedAppleAmount(row["Developer Proceeds"], units)
      );
    });

    if (unitsEl) unitsEl.textContent = String(totalUnits);
    if (customerEl) customerEl.textContent = formatCurrencyTotals(customerTotals);
    if (proceedsEl) proceedsEl.textContent = formatCurrencyTotals(proceedsTotals);
    if (statusEl) {
      statusEl.textContent = rows.length
        ? `Gün: ${selectedDate}`
        : `Gün: ${selectedDate} / Satış yok`;
    }

    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="muted" style="padding:12px;">
            Seçilen gün için ücretli iOS satış verisi yok.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map(function (row) {
      const customerCurrency = String(row["Customer Currency"] || "-");
      const proceedsCurrency = String(row["Currency of Proceeds"] || "-");
      const currencyLabel = customerCurrency === proceedsCurrency
        ? customerCurrency
        : customerCurrency + " / " + proceedsCurrency;

      return `
        <tr>
          <td style="padding:8px 10px;">${escapeHtml(row.SKU || row.Title || "-")}</td>
          <td style="padding:8px 10px;">${Number(row.Units || 0)}</td>
          <td style="padding:8px 10px;">${escapeHtml(formatMoney(row["Customer Price"], customerCurrency))}</td>
          <td style="padding:8px 10px;">${escapeHtml(formatMoney(row["Developer Proceeds"], proceedsCurrency))}</td>
          <td style="padding:8px 10px;">${escapeHtml(currencyLabel)}</td>
          <td style="padding:8px 10px;">${escapeHtml(row["Country Code"] || "-")}</td>
          <td style="padding:8px 10px;">${escapeHtml(row.Device || "-")}</td>
        </tr>
      `;
    }).join("");
  }

  window.fetch = async function (input, init) {
    const response = await originalFetch(input, init);
    const url = typeof input === "string"
      ? input
      : String(input && input.url ? input.url : "");

    if (!url.includes("/api/admin/ios-sales")) {
      return response;
    }

    try {
      const data = await response.clone().json();

      if (data && data.ok) {
        // Never let the UI substitute historical sales for the selected date.
        data.total_rows = [];
        data.total_count = 0;
        lastIosReport = data;

        setTimeout(renderIosTruth, 0);
        setTimeout(renderIosTruth, 80);

        return new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        });
      }
    } catch (_) {}

    return response;
  };

  const core = document.createElement("script");
  core.src = "./admin.core.js?v=1";
  core.async = false;
  core.onload = function () {
    setTimeout(renderIosTruth, 100);
  };
  document.head.appendChild(core);
})();
