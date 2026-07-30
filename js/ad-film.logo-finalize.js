/* AIVO AI Reklam Filmi — legacy logo finalizer compatibility.
   Automatic listeners were intentionally removed. Logo application is part of
   the single Seedance finalization request started by the active generation.
   This bridge remains only for an explicit/manual recovery action. */
(function AIVO_AD_FILM_LOGO_FINALIZE(){
  "use strict";
  if(window.__AIVO_AD_FILM_LOGO_FINALIZE_V4__)return;
  window.__AIVO_AD_FILM_LOGO_FINALIZE_V4__=true;

  async function run(){
    if(window.AIVOAdFilmFinalizationController&&typeof window.AIVOAdFilmFinalizationController.run==="function"){
      return window.AIVOAdFilmFinalizationController.run({reason:"manual_logo_recovery",force:true});
    }
    if(window.AIVOAdFilmFinalizeOutput&&typeof window.AIVOAdFilmFinalizeOutput.run==="function"){
      return window.AIVOAdFilmFinalizeOutput.run();
    }
  }

  window.AIVOAdFilmLogoFinalize={run:run};
})();
