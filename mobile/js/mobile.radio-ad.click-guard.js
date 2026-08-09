(function AIVO_MOBILE_RADIO_AD_CLICK_GUARD(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_CLICK_GUARD_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_CLICK_GUARD_V1__ = true;

  document.addEventListener("click", function(event){
    if (!event || !event.target || !event.target.closest) return;

    const productionsLink = event.target.closest('.bottom-nav a[href="#productions"]');
    if (productionsLink) {
      const mount = document.getElementById("mobileAdFilmMount");
      const root = document.getElementById("mobileAdFilmSection");
      const radioView = root && root.querySelector('[data-mobile-adfilm-view="radio"]');
      const radioActive = !!(
        mount &&
        !mount.hidden &&
        radioView &&
        !radioView.hidden &&
        radioView.classList.contains("is-active")
      );

      if (radioActive) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

        Promise.resolve().then(function(){
          const sync = window.AIVOMobileRadioAdProjectSync;
          const project = sync && typeof sync.getProject === "function"
            ? sync.getProject()
            : window.AIVOMobileRadioAdProject || null;
          const production = window.AIVOMobileRadioAdProduction;

          if (production && typeof production.renderArchive === "function") {
            production.renderArchive(project);
          }

          document.querySelectorAll(".bottom-nav a").forEach(function(link){
            link.classList.toggle("active", link === productionsLink);
          });

          try {
            history.replaceState(null, "", "#productions");
          } catch (_) {}

          const finalCard = radioView.querySelector('[data-mobile-radio-card="final"]');
          if (finalCard) {
            finalCard.hidden = false;
            finalCard.scrollIntoView({ block: "start", behavior: "smooth" });
          }
        });

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