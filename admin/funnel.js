(function () {
  "use strict";

  function todayValue() {
    return new Date().toISOString().slice(0, 10);
  }

  function makeCard(label, id, hint) {
    const card = document.createElement("div");
    card.style.cssText = "padding:12px 14px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.025);min-width:0";
    card.innerHTML = `
      <div class="muted" style="font-size:12px;margin-bottom:6px;">${label}</div>
      <div id="${id}" style="font-size:30px;font-weight:800;line-height:1;">0</div>
      <div class="muted" style="font-size:11px;margin-top:7px;line-height:1.35;">${hint}</div>
    `;
    return card;
  }

  function install() {
    if (document.getElementById("cardConversionFunnel")) return;

    const traffic = document.getElementById("cardTrafficStats");
    if (!traffic || !traffic.parentNode) return;

    const section = document.createElement("section");
    section.className = "card";
    section.id = "cardConversionFunnel";
    section.innerHTML = `
      <h3 style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <span>🧭 Dönüşüm Hunisi</span>
        <span class="muted" id="funnelStatus">Hazır.</span>
      </h3>
      <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <button id="btnFunnelStats" class="btn">Yenile</button>
        <input id="funnelDate" type="date" />
        <span class="muted">Ziyaretçilerin hangi adımda kaybolduğunu gösterir.</span>
      </div>
      <div id="funnelCards" style="display:grid;grid-template-columns:repeat(4,minmax(170px,1fr));gap:12px;"></div>
      <div id="funnelConversions" style="margin-top:14px;padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:16px;white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.7;">Henüz veri yüklenmedi.</div>
      <div class="muted" style="margin-top:10px;font-size:11px;line-height:1.45;">
        Not: Web ödemeleri bu kartta gösterilir. iOS ve Google Play gerçek satışları üstteki mağaza satış kartlarından izlenir.
      </div>
    `;

    traffic.parentNode.insertBefore(section, traffic);

    const cards = document.getElementById("funnelCards");
    cards.appendChild(makeCard("Landing Ziyareti", "funnelLanding", "Ana sayfa / mobil / iOS / Play girişleri"));
    cards.appendChild(makeCard("Studio'ya Geçiş", "funnelStudio", "Studio sayfalarına ulaşan ziyaretler"));
    cards.appendChild(makeCard("Yeni Kayıt", "funnelRegister", "O gün oluşturulan yeni hesaplar"));
    cards.appendChild(makeCard("İlk Üretimini Yapan", "funnelFirstProduction", "AIVO'da ilk kez üretim yapan kullanıcılar"));
    cards.appendChild(makeCard("Üretim Yapan Kullanıcı", "funnelProducers", "O gün en az bir üretim yapan tekil kullanıcı"));
    cards.appendChild(makeCard("Toplam Üretim", "funnelJobs", "O gün oluşturulan toplam job"));
    cards.appendChild(makeCard("Kredi Sayfası", "funnelCredits", "Kredi ekranına ulaşan ziyaretler"));
    cards.appendChild(makeCard("Web Satın Alma", "funnelPaid", "Başarılı web kredi siparişleri"));

    const date = document.getElementById("funnelDate");
    if (date && !date.value) date.value = todayValue();

    async function load() {
      const status = document.getElementById("funnelStatus");
      if (status) status.textContent = "Yükleniyor...";

      try {
        const selected = String(date && date.value ? date.value : todayValue());
        const res = await fetch("/api/admin/funnel-stats?date=" + encodeURIComponent(selected), {
          credentials: "include",
          cache: "no-store"
        });
        const data = await res.json().catch(function () { return null; });
        if (!res.ok || !data || !data.ok) {
          throw new Error((data && (data.error || data.message)) || "funnel_stats_failed");
        }

        const f = data.funnel || {};
        const c = data.conversion || {};
        const set = function (id, value) {
          const el = document.getElementById(id);
          if (el) el.textContent = String(Number(value || 0));
        };

        set("funnelLanding", f.landing_views);
        set("funnelStudio", f.studio_views);
        set("funnelRegister", f.registrations);
        set("funnelFirstProduction", f.first_producers);
        set("funnelProducers", f.producers);
        set("funnelJobs", f.production_jobs);
        set("funnelCredits", f.credits_views);
        set("funnelPaid", f.web_paid_orders);

        const conv = document.getElementById("funnelConversions");
        if (conv) {
          conv.textContent = [
            "Landing → Studio: %" + Number(c.studio_from_landing_pct || 0).toLocaleString("tr-TR"),
            "Landing → Kayıt: %" + Number(c.register_from_landing_pct || 0).toLocaleString("tr-TR"),
            "Kayıt → İlk Üretim: %" + Number(c.first_production_from_register_pct || 0).toLocaleString("tr-TR"),
            "Studio → Kredi Sayfası: %" + Number(c.credits_from_studio_pct || 0).toLocaleString("tr-TR"),
            "Kredi Sayfası → Web Satın Alma: %" + Number(c.web_paid_from_credits_pct || 0).toLocaleString("tr-TR")
          ].join("\n");
        }

        if (status) status.textContent = "Gün: " + String(data.date || selected);
      } catch (error) {
        if (status) status.textContent = "Hata oluştu.";
        const conv = document.getElementById("funnelConversions");
        if (conv) conv.textContent = String(error && error.message ? error.message : error);
      }
    }

    const button = document.getElementById("btnFunnelStats");
    if (button) button.addEventListener("click", load);
    if (date) date.addEventListener("change", load);

    load();
  }

  function boot() {
    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;
      if (document.getElementById("cardTrafficStats")) {
        clearInterval(timer);
        install();
      } else if (tries > 80) {
        clearInterval(timer);
      }
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
