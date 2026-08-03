/* AIVO AI Reklam Filmi — one elapsed clock and bounded transient provider resilience */
(function AIVO_AD_FILM_ELAPSED_CONTINUITY(){
  "use strict";
  if(window.__AIVO_AD_FILM_ELAPSED_CONTINUITY_V3__)return;
  window.__AIVO_AD_FILM_ELAPSED_CONTINUITY_V3__=true;

  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";
  var STALE_AFTER_MS=20*60*1000;
  var clock=null;