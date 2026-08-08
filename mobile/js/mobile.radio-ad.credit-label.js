(function AIVO_MOBILE_RADIO_AD_CREDIT_LABEL(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_CREDIT_LABEL_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_CREDIT_LABEL_V1__ = true;

  const observers = new WeakMap();

  function isEnglish(){
    return String(window.AIVO_LANG || document.documentElement.lang || "tr").toLowerCase().indexOf("en") === 0;
  }

  function normalize(node){
    if (!node) return;
    const text = String(node.textContent || "").trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(text)) return;
    node.textContent = (isEnglish() ? "Credits " : "Kredi ") + text;
  }

  function watch(node){
    if (!node || observers.has(node)) return;
    normalize(node);
    const observer = new MutationObserver(function(){ normalize(node); });
    observer.observe(node, { childList:true, characterData:true, subtree:true });
    observers.set(node, observer);
  }

  function attach(){
    watch(document.getElementById("topCreditCount"));
    document.querySelectorAll("[data-mobile-credit-balance]").forEach(watch);
  }

  attach();
  document.addEventListener("aivo:mobile-radioad-project-sync", attach);
  window.addEventListener("pageshow", attach);
})();