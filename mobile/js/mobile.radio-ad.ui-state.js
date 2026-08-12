(function AIVO_MOBILE_RADIO_AD_UI_STATE(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_UI_STATE_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_UI_STATE_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  const view = root && root.querySelector('[data-mobile-adfilm-view="radio"]');
  if (!root || !view) return;

  const durationSelect = view.querySelector("#mobileRadioDuration