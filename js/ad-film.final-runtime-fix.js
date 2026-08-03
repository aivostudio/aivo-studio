/* AIVO AI Reklam Filmi — final runtime behavior fixes */
(function AIVO_AD_FILM_FINAL_RUNTIME_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINAL_RUNTIME_FIX_V2__)return;
  window.__AIVO_AD_FILM_FINAL_RUNTIME_FIX_V2__=true;

  var sessionRun=false;
  var originalConfirm=window.confirm.bind(window);
  var FAL_CONFIRM_RE=/(Bu test gerçek Fal\.ai üretimi başlatır|This test starts a real Fal\.ai generation)/i;

 