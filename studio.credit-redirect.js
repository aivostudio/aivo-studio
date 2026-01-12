/* studio.credit-redirect.js
   Amaç: Studio içinde kredi modalı yok. Kredi tüketimi 400 dönerse direkt fiyatlandırmaya yönlendir.
*/
(() => {
  const PRICING_URL_BASE = "/fiyatlandirma.html#packs";

  function goPricing() {
    try {
      // İstersen geri dönüş parametresi ekleyebilirsin:
      // const ret = encodeURIComponent(location.pathname + location.search + location.hash);
      // location.href = `${PRICING_URL_BASE}&return=${ret}`;
      location.href = PRICING_URL_BASE;
    } catch {
      location.href = PRICING_URL_BASE;
    }
  }

  // 1) En sağlam: /api/credits/consume 400 -> redirect
  const _fetch = window.fetch;
  if (typeof _fetch === "function") {
    window.fetch = async function (input, init) {
      const res = await _fetch(input, init);

      try {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        const isConsume = url.includes("/api/credits/consume");

        if (isConsume && res && res.status === 400) {
          // modal açılmadan tek hedefe git
          goPricing();
        }
      } catch (_) {}

      return res;
    };
  }

  // 2) Emniyet kemeri: credits-ui / legacy "pricing modal" fonksiyonları varsa redirect'e bağla
  const overrideNames = [
    "openPricingModal",
    "openPricing",
    "showPricingModal",
    "showPricing",
    "openCreditsModal",
    "showCreditsModal",
  ];

  overrideNames.forEach((name) => {
    if (typeof window[name] === "function") {
      window[name] = goPricing;
    }
  });

  // credits-ui bir namespace ile geliyorsa
  if (window.CreditsUI && typeof window.CreditsUI.open === "function") {
    window.CreditsUI.open = goPricing;
  }
})();
