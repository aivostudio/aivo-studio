(function () {
  const KEY = "invoices";

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function qs(sel, root) {
    try {
      return (root || document).querySelector(sel);
    } catch (_) {
      return null;
    }
  }

  function safeReadAuth() {
    try {
      return JSON.parse(localStorage.getItem("aivo_auth_unified_v1") || "{}");
    } catch (_) {
      return {};
    }
  }

  function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
  }

  async function resolveEmail() {
    try {
      const meRes = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });

      const meJson = await meRes.json().catch(() => null);
      if (meRes.ok && meJson && meJson.ok && meJson.email) {
        return normalizeEmail(meJson.email);
      }
    } catch (_) {}

    try {
      if (window.__AIVO_SESSION__ && window.__AIVO_SESSION__.email) {
        return normalizeEmail(window.__AIVO_SESSION__.email);
      }
    } catch (_) {}

    const auth = safeReadAuth();
    return normalizeEmail(auth && auth.email);
  }

  function toTime(v) {
    if (v == null) return 0;
    if (typeof v === "number") return v;

    const n = Number(v);
    if (!isNaN(n) && isFinite(n)) return n;

    const d = new Date(v);
    const t = d.getTime();
    return isNaN(t) ? 0 : t;
  }

  function formatMoney(v) {
    const n = Number(v);
    if (!isFinite(n)) return "—";

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
    const raw = String(
      inv?.type ||
      inv?.kind ||
      inv?.event ||
      inv?.action ||
      inv?.status ||
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

  function getAmount(inv) {
    const raw =
      inv?.amount_try != null ? inv.amount_try :
      inv?.price != null ? inv.price :
      inv?.amount != null ? inv.amount :
      inv?.total != null ? inv.total :
      null;

    const n = Number(raw);
    return isFinite(n) ? n : 0;
  }

  function normalizeInvoice(inv) {
    const type = inferType(inv);
    const amount = getAmount(inv);

    return {
      id: inv?.id || inv?.order_id || inv?.orderId || "",
      type: type,
      amountSigned: type === "refund" ? -Math.abs(amount) : Math.abs(amount),
      createdAt:
        inv?.created_at ||
        inv?.createdAt ||
        inv?.created ||
        inv?.date ||
        inv?.ts ||
        inv?.time ||
        null
    };
  }

  async function fetchInvoices(email) {
    const res = await fetch("/api/invoices/get?email=" + encodeURIComponent(email), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.ok !== true) {
      throw new Error((json && (json.error || json.message)) || "invoices_fetch_failed");
    }

    return Array.isArray(json.invoices) ? json.invoices : [];
  }

  function getMonthRange(ts) {
    const d = new Date(ts || Date.now());
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
    return { start, end };
  }

  function summarizeInvoices(invoices) {
    const now = Date.now();
    const { start, end } = getMonthRange(now);

    let monthTotal = 0;
    let allTotal = 0;

    (Array.isArray(invoices) ? invoices : []).forEach((raw) => {
      const inv = normalizeInvoice(raw);
      const createdAt = toTime(inv.createdAt);
      const amount = Number(inv.amountSigned) || 0;

      allTotal += amount;

      if (createdAt >= start && createdAt < end) {
        monthTotal += amount;
      }
    });

    return {
      monthTotal,
      allTotal
    };
  }

  async function fillSummary(root) {
    const monthEl = qs('[data-kpi="month"]', root);
    const totalEl = qs('[data-kpi="total"]', root);

    if (!monthEl || !totalEl) return;
    if (root.__destroyed) return;

    monthEl.textContent = "Yükleniyor...";
    totalEl.textContent = "Yükleniyor...";

    try {
      const email = await resolveEmail();

      if (!email) {
        if (root.__destroyed) return;
        monthEl.textContent = "—";
        totalEl.textContent = "—";
        return;
      }

      const invoices = await fetchInvoices(email);
      const summary = summarizeInvoices(invoices);

      if (root.__destroyed) return;

      monthEl.textContent = formatMoney(summary.monthTotal);
      totalEl.textContent = formatMoney(summary.allTotal);
    } catch (err) {
      console.error("[panel.invoices] summary failed", err);
      if (root.__destroyed) return;
      monthEl.textContent = "—";
      totalEl.textContent = "—";
    }
  }

  function mount(host) {
    host.innerHTML = "";

    const root = el(`
      <div class="rp-card">
        <div class="rp-card__header">
          <div class="rp-title">Faturalarım</div>
          <div class="rp-subtitle">Faturalama özeti ve hızlı erişim</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-kpi">
            <div class="rp-kpi__item">
              <div class="rp-kpi__label">Bu ay</div>
              <div class="rp-kpi__value" data-kpi="month">—</div>
            </div>
            <div class="rp-kpi__item">
              <div class="rp-kpi__label">Toplam</div>
              <div class="rp-kpi__value" data-kpi="total">—</div>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">İpuçları</div>
            <ul class="rp-list">
              <li>Fatura detayları orta panelde listelenir.</li>
              <li>Satın alım ve iade hareketleri bu özete dahil edilir.</li>
              <li>Bu ay alanı yalnızca mevcut ayın net toplamını gösterir.</li>
            </ul>
          </div>
        </div>
      </div>
    `);

    root.__destroyed = false;
    host.appendChild(root);

    fillSummary(root);

    return () => destroy(host);
  }

  function destroy(host) {
    const root = host && host.firstElementChild;
    if (root) root.__destroyed = true;
    if (host) host.innerHTML = "";
  }

  function registerWhenReady() {
    const rp = window.RightPanel;
    if (rp && typeof rp.register === "function") {
      rp.register(KEY, {
        getHeader() {
          return {
            title: "Faturalarım",
            meta: "Faturalama özeti",
            searchEnabled: false,
            resetSearch: true
          };
        },
        mount,
        destroy
      });
      console.log("[panel.invoices] registered");
      return true;
    }
    return false;
  }

  if (registerWhenReady()) return;

  const t0 = Date.now();
  const timer = setInterval(() => {
    if (registerWhenReady()) {
      clearInterval(timer);
      return;
    }
    if (Date.now() - t0 > 8000) {
      clearInterval(timer);
      console.warn("[panel.invoices] RightPanel not ready after 8s; giving up");
    }
  }, 50);
})();
