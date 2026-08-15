(function AIVO_MOBILE_RADIO_AD_CLICK_GUARD(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_CLICK_GUARD_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_CLICK_GUARD_V1__ = true;

  document.addEventListener("click", function(event){
    if (!event || !event.target || !event.target.closest) return;

    const productions = event.target.closest('.bottom-nav a[href="#productions"]');
    if (productions) {
      const adfilmMount = document.getElementById("mobileAdFilmMount");

      if (adfilmMount && !adfilmMount.hidden) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

        let attempts = 0;

        function openAdFilmLibrary(){
          attempts += 1;

          if (typeof window.mobileAdFilmShowLibrary === "function") {
            window.mobileAdFilmShowLibrary();
            return;
          }

          if (window.AIVOMobileAdFilmProduction && typeof window.AIVOMobileAdFilmProduction.showLibrary === "function") {
            window.AIVOMobileAdFilmProduction.showLibrary();
            return;
          }

          if (attempts < 80) {
            window.setTimeout(openAdFilmLibrary, 25);
          }
        }

        openAdFilmLibrary();
        return;
      }
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