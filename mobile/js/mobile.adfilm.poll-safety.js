(function AIVO_MOBILE_ADFILM_POLL_SAFETY(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_POLL_SAFETY_V1__) return;
  window.__AIVO_MOBILE_ADFILM_POLL_SAFETY_V1__ = true;

  const nativeFetch = window.fetch.bind(window);
  let resumeCheckBusy = false;
  let lastResumeCheckAt = 0;

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function