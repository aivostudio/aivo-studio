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

(function AIVO_IOS_ADFILM_STAGE3_NOTE_I18N(){
  "use strict";
  if (window.__AIVO_IOS_ADFILM_STAGE3_NOTE_I18N_V1__) return;
  window.__AIVO_IOS_ADFILM_STAGE3_NOTE_I18N_V1__ = true;

  const TR = "Sahneler ve görsel akış oluşturuluyor.";
  const EN = "Scenes and visual flow are being created.";
  let observer = null;

  function isEnglish(){
    let stored = "";
    try { stored = localStorage.getItem("aivo_mobile_language") || ""; } catch (_) {}
    const value = String(window.AIVO_LANG || stored || document.documentElement.lang || "tr").toLowerCase();
    return value.indexOf("en") === 0;
  }

  function sync(){
    const root = document.getElementById("mobileAdFilmSection");
    if (!root) return;
    const node = root.querySelector("[data-mobile-adfilm-stage-description]");
    if (!node) return;
    const text = String(node.textContent || "").trim();
    if (isEnglish() && text === TR) node.textContent = EN;
    else if (!isEnglish() && text === EN) node.textContent = TR;
  }

  function attach(){
    const root = document.getElementById("mobileAdFilmSection");
    if (!root) return;
    sync();
    if (observer) return;
    observer = new MutationObserver(sync);
    observer.observe(root, { subtree:true, childList:true, characterData:true });
  }

  attach();
  document.addEventListener("aivo:language-change", function(){ setTimeout(sync, 0); });
  document.addEventListener("aivo:adfilm-project-sync", function(){ setTimeout(attach, 0); });
  window.addEventListener("pageshow", function(){ setTimeout(attach, 0); });
  window.addEventListener("pagehide", function(){ if (observer) observer.disconnect(); observer = null; }, { once:true });
})();
