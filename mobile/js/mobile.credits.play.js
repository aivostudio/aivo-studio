(function(){
  if (window.__AIVO_MOBILE_CREDITS__) return;
  window.__AIVO_MOBILE_CREDITS__ = true;

 
  const PLAN_MAP = {
    baslangic: {
      plan: "baslangic",
      label: "Başlangıç",
      credits: 25
    },
    standart: {
      plan: "standart",
      label: "Standart",
      credits: 100
    },
    pro: {
      plan: "pro",
      label: "Pro",
      credits: 200
    },
    studyo: {
      plan: "studyo",
      label: "Stüdyo",
      credits: 500
    }
  };
  const MOBILE_PRICE_MAP = {
  tr: {
    starter: { price: "199₺", amount: "/ 25 kredi", metric: "Kredi başına ₺7.96" },
    standard: { price: "699₺", amount: "/ 100 kredi", metric: "Kredi başına ₺6.99" },
    pro: { price: "1.299₺", amount: "/ 200 kredi", metric: "Kredi başına ₺6.49" },
    studio: { price: "2.999₺", amount: "/ 500 kredi", metric: "Kredi başına ₺6.00" }
  },
  us: {
    starter: { price: "$4.99", amount: "/ 25 credits", metric: "$0.20 per credit" },
    standard: { price: "$14.99", amount: "/ 100 credits", metric: "$0.15 per credit" },
    pro: { price: "$29.99", amount: "/ 200 credits", metric: "$0.15 per credit" },
    studio: { price: "$69.99", amount: "/ 500 credits", metric: "$0.14 per credit" }
  },
  eu: {
    starter: { price: "€4.99", amount: "/ 25 credits", metric: "€0.20 per credit" },
    standard: { price: "€14.99", amount: "/ 100 credits", metric: "€0.15 per credit" },
    pro: { price: "€29.99", amount: "/ 200 credits", metric: "€0.15 per credit" },
    studio: { price: "€69.99", amount: "/ 500 credits", metric: "€0.14 per credit" }
  }
};

function getMobilePriceRegion(){
  const lang = String(
    localStorage.getItem("aivo_mobile_language") ||
    document.documentElement.lang ||
    navigator.language ||
    "tr"
  ).toLowerCase();

  if (lang.startsWith("tr")) return "tr";

  if (
    lang.startsWith("de") ||
    lang.startsWith("fr") ||
    lang.startsWith("es") ||
    lang.startsWith("it") ||
    lang.startsWith("nl") ||
    lang.startsWith("pt")
  ) {
    return "eu";
  }

  return "us";
}

function applyMobileCreditPrices(){
  const region = getMobilePriceRegion();
  const prices = MOBILE_PRICE_MAP[region] || MOBILE_PRICE_MAP.tr;

  Object.keys(prices).forEach(function(key){
    const item = prices[key];

    const priceEl = document.querySelector('[data-mobile-price="' + key + '"]');
    const amountEl = document.querySelector('[data-mobile-price-label="' + key + '"]');
    const metricEl = document.querySelector('[data-mobile-price-metric="' + key + '"]');

    if (priceEl) priceEl.textContent = item.price;
    if (amountEl) amountEl.textContent = item.amount;
    if (metricEl) metricEl.textContent = item.metric;
  });
}

  function $(selector, root){
    return (root || document).querySelector(selector);
  }

function setBalance(value){
  const n = Number(value);
  const safeValue = Number.isFinite(n) ? String(Math.max(0, Math.floor(n))) : "0";
  const isEnglish = String(window.AIVO_LANG || localStorage.getItem("aivo_mobile_language") || document.documentElement.lang || "")
    .toLowerCase()
    .startsWith("en");

  const label = isEnglish ? "Credits " : "Kredi ";

  const el = $("#mobileCreditsBalance");
  if (el) {
    el.textContent = label + safeValue;
  }

  const topEl = document.querySelector("[data-mobile-credit-balance]");
  if (topEl) {
    topEl.removeAttribute("data-i18n");
    topEl.textContent = label + safeValue;
  }
}

async function getMe(){
  console.log("[AIVO PLAY AUTH] local email:", localStorage.getItem("aivo_user_email"));
  console.log("[AIVO PLAY AUTH] unified:", localStorage.getItem("aivo_auth_unified_v1"));

  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });

    if (res.ok) {
      const data = await res.json().catch(function(){
        return null;
      });

      const user = data && (data.user || data);
      const email = String(user && user.email ? user.email : "").trim();
      const userId = String(
        (user && (user.id || user.user_id || user.uid || user.email)) || ""
      ).trim();

      if (email && email.includes("@") && userId) {
        return {
          email: email,
          user_id: userId
        };
      }
    }
  } catch (err) {}

  const localEmail = String(localStorage.getItem("aivo_user_email") || "").trim();

  if (localEmail && localEmail.includes("@")) {
    return {
      email: localEmail,
      user_id: localEmail
    };
  }

  throw new Error("AUTH_USER_MISSING");
}

  async function hydrateCredits(){
    const localEmail = String(localStorage.getItem("aivo_user_email") || "").trim().toLowerCase();

    if (!localEmail || !localEmail.includes("@")) {
      setBalance(0);
      return;
    }

    try {
 const capHttp = window.Capacitor &&
  window.Capacitor.Plugins &&
  window.Capacitor.Plugins.CapacitorHttp;

if (capHttp && typeof capHttp.get === "function") {
  const res = await capHttp.get({
    url: "https://aivo.tr/api/play-billing/credits-get",
    params: {
      email: localEmail
    },
    headers: {
      "Accept": "application/json"
    }
  });

  const data = res && res.data ? res.data : null;

  if (!res || Number(res.status) < 200 || Number(res.status) >= 300 || !data || data.ok === false) {
    setBalance(0);
    return;
  }

  setBalance(data.credits);
  return;
}

const res = await fetch("https://aivo.tr/api/play-billing/credits-get?email=" + encodeURIComponent(localEmail), {
  method: "GET",
  cache: "no-store",
  headers: {
    "Accept": "application/json"
  }
});

const data = await res.json().catch(function(){
  return null;
});

if (!res.ok || !data || data.ok === false) {
  setBalance(0);
  return;
}

setBalance(data.credits);
    } catch (err) {
      setBalance(0);
    }
  }

  function getKvkkOk(){
    const check = $("#mobileCreditsKvkkCheck");
    return !!(check && check.checked);
  }

  function showKvkkWarning(){
    const card = $(".mobile-credits-kvkk-card");
    const hint = $("#mobileCreditsKvkkHint");

    if (hint) {
         hint.textContent =
        (window.aivoI18n && window.aivoI18n.t("credits.kvkkHint")) ||
        "You must confirm the KVKK consent to continue.";
      hint.style.display = "block";
    }

    if (card) {
      card.classList.add("needs-attention");
      try {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (err) {}

      setTimeout(function(){
        card.classList.remove("needs-attention");
      }, 1800);
    }
  }
 async function openMobileCreditsPolicy(type){
  const policyMount = document.getElementById("mobilePolicyMount");
  const creditsMount = document.getElementById("mobileCreditsMount");

  const file = type === "terms"
    ? "/mobile/modules/mobile-policy-terms.html?v=1"
    : "/mobile/modules/mobile-policy-privacy.html?v=1";

  try {
    if (creditsMount) creditsMount.hidden = true;

    if (policyMount) {
      policyMount.hidden = false;
      policyMount.innerHTML = '<div class="empty-card">Yasal metin yükleniyor...</div>';
    }

    const html = await fetch(file, { cache: "no-store" }).then(function(res){
      if (!res.ok) throw new Error("policy_load_failed");
      return res.text();
    });

    if (policyMount) {
      policyMount.innerHTML = html;
    }

    if (typeof window.aivoApplyI18n === "function") {
      window.aivoApplyI18n(policyMount);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    if (policyMount) {
      policyMount.innerHTML = '<div class="empty-card">Yasal metin yüklenemedi.</div>';
    }
  }
}

  function bindPolicyLinks(){
    const section = $("#mobileCreditsSection");
    if (!section || section.dataset.policyBound === "1") return;

    section.dataset.policyBound = "1";

    section.addEventListener("click", function(e){
      const privacyBtn = e.target.closest("[data-mobile-policy-privacy]");
      const termsBtn = e.target.closest("[data-mobile-policy-terms]");

      if (!privacyBtn && !termsBtn) return;

      e.preventDefault();
      e.stopPropagation();

      openMobileCreditsPolicy(termsBtn ? "terms" : "privacy");
    });
  }
  function setButtonLoading(button, isLoading){
    if (!button) return;

    if (isLoading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
        button.textContent =
        (window.aivoI18n && window.aivoI18n.t("credits.paymentLoading")) ||
     "Ödeme hazırlanıyor..."
      return;
    }

    button.disabled = false;
     button.textContent =
      button.dataset.originalText ||
      ((window.aivoI18n && window.aivoI18n.t("credits.pack.select")) || "Select package");
  }

function startPlayBillingPurchase(pack){
  const productId = String(pack.productId || pack.plan || "").trim();

  if (window.AivoPlayBilling && typeof window.AivoPlayBilling.purchase === "function") {
    return window.AivoPlayBilling.purchase(productId);
  }

  throw new Error("PLAY_BILLING_BRIDGE_MISSING");
}

  async function startCheckout(planKey, button){
    const pack = PLAN_MAP[planKey];

    if (!pack) {
       alert(
        (window.aivoI18n && window.aivoI18n.t("credits.invalidPackage")) ||
        "Invalid package selection."
      );
      return;
    }

    if (!getKvkkOk()) {
      showKvkkWarning();
      return;
    }

    setButtonLoading(button, true);

    try {
      const me = await getMe();

 const res = await fetch("/api/play-billing/init", {
  method: "POST",
  credentials: "include",
  cache: "no-store",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  body: JSON.stringify({
    user_id: me.user_id,
    email: me.email,
    plan: pack.plan,
    source: "play",
    return_path: "/studio.play.html#credits"
  })
});
      const raw = await res.text();
      console.error("[AIVO PLAY INIT]", res.status, raw);
      let data = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (err) {
        data = null;
      }

  if (!res.ok || !data || data.ok === false) {
  throw new Error((data && data.error) || "PLAY_BILLING_INIT_FAILED");
}

if (data.purchase_id) {
  try {
    localStorage.setItem("aivo_pending_play_purchase_id", String(data.purchase_id));
  } catch (err) {}
}

await new Promise(function(resolve){ setTimeout(resolve, 700); });

await startPlayBillingPurchase({
  ...pack,
  productId: pack.plan
});
      setButtonLoading(button, false);
    } catch (err) {
    console.error("[AIVO play credits] checkout failed:", err);
        alert(
        (window.aivoI18n && window.aivoI18n.t("credits.paymentFailed")) ||
        "Payment could not be started. Please try again."
      );
      setButtonLoading(button, false);
    }
  }
  document.addEventListener("click", function(e){
    const packBtn = e.target.closest(
      "[data-mobile-pack], [data-ios-product], [data-iap-product], .mobile-credits-pack-card button, .mobile-credits-pack-card a"
    );

    if (!packBtn) return;

    if (getKvkkOk()) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.stopImmediatePropagation) {
      e.stopImmediatePropagation();
    }

    showKvkkWarning();

    return false;
  }, true);
  function bindClicks(){
    const section = $("#mobileCreditsSection");
    if (!section || section.dataset.bound === "1") return;

    section.dataset.bound = "1";

    section.addEventListener("click", function(e){
      const button = e.target.closest("[data-mobile-pack]");
      if (!button) return;

      e.preventDefault();

      const planKey = String(button.getAttribute("data-mobile-pack") || "").trim();
      startCheckout(planKey, button);
    });
  }
function scheduleCreditsHydrate(){
  requestAnimationFrame(function(){
    setTimeout(function(){
      hydrateCredits();
    }, 300);
  });
}

window.mobileCreditsInit = function(){
  bindClicks();
  bindPolicyLinks();
  applyMobileCreditPrices();
  scheduleCreditsHydrate();
};

function boot(){
  bindClicks();
  bindPolicyLinks();
  applyMobileCreditPrices();
  scheduleCreditsHydrate();
}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
