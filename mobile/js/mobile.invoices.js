/* =========================================================
   AIVO MOBILE — ACCOUNT INVOICES
   File: /mobile/js/mobile.invoices.js
   ========================================================= */

(function(){
  "use strict";

  if (window.__AIVO_MOBILE_INVOICES__) return;
  window.__AIVO_MOBILE_INVOICES__ = true;

  let activeFilter = "all";

  function qs(sel, root){
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function currentLanguage(){
    try {
      const value = String(
        window.AIVO_LANG ||
        localStorage.getItem("aivo_mobile_language") ||
        document.documentElement.lang ||