(function AIVO_MOBILE_RADIO_AD_CLICK_GUARD(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_CLICK_GUARD_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_CLICK_GUARD_V1__ = true;

  document.addEventListener("click", function(event){
    if (!event || !event.target || !event.target.closest) return;

    const adfilmTool = event.target.closest('[data-tool="adfilm"],[data-mobile-tool="adfilm"],[data-mobile-tool-key="adfilm"]');
    if (adfilmTool && typeof window.mobileAdFilmShowEditor === "function") {
      window.mobileAdFilmShowEditor();
    }

    const button = event.target.closest('[data-mobile-adfilm-view="radio"] [data-mobile-radio-action] .mobile-adfilm-create-button');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

    Promise.resolve().then(function(){
      const production = window.AIVOMobileRadioAdProduction;
      if (production && typeof production.run === "function") production.run();
    });
  }, true);
})();