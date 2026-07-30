/* AIVO AI Reklam Filmi — legacy mix upgrade compatibility.
   Completed projects are not upgraded automatically on mount, pageshow or
   project-sync. The current generation owns one finalization lifecycle. */
(function AIVO_AD_FILM_MIX_UPGRADE(){
  "use strict";
  if(window.__AIVO_AD_FILM_MIX_UPGRADE_V3__)return;
  window.__AIVO_AD_FILM_MIX_UPGRADE_V3__=true;

  async function run(){
    if(window.AIVOAdFilmFinalizationController&&typeof window.AIVOAdFilmFinalizationController.run==="function"){
      return window.AIVOAdFilmFinalizationController.run({reason:"manual_mix_upgrade",force:true});
    }
    if(window.AIVOAdFilmFinalizeOutput&&typeof window.AIVOAdFilmFinalizeOutput.run==="function"){
      return window.AIVOAdFilmFinalizeOutput.run();
    }
  }

  window.AIVOAdFilmMixUpgrade={run:run};
})();
