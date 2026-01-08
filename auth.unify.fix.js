/* =========================================================
   AUTH UNIFY FIX (BRIDGE) — aivo_auth_unified_v1
   Amaç:
   - Studio ve Kurumsal farklı localStorage key kullansa bile
     ortak bir "unified" auth objesi üretmek.
   - Kurumsal topbar UI’sini güvenli şekilde güncellemek.
   Not:
   - Bu dosya, index.auth.js'ten SONRA yüklenmeli.
   ========================================================= */
(function(){
  "use strict";

  var UNIFIED_KEY = "aivo_auth_unified_v1";

  // Muhtemel eski/dağınık key adayları (genel)
  var CANDIDATE_KEYS = [
    "aivo_auth_v1",
    "aivo_session_v1",
    "aivo_user_v1",
    "aivo_user",
    "auth",
    "session",
    "user",
    "token",
    "jwt"
  ];

  function safeParse(s){
    try { return JSON.parse(String(s || "")); } catch(e){ return null; }
  }

  function looksLikeUserObj(o){
    if (!o || typeof o !== "object") return false;
    // E-posta / kullanıcı / token benzeri bir işaret arıyoruz
    return !!(o.email || o.user?.email || o.userEmail || o.token || o.jwt || o.accessToken);
  }

  function pickBestCandidate(){
    // 1) Önce aday key’lere bak
    for (var i=0; i<CANDIDATE_KEYS.length; i++){
      var k = CANDIDATE_KEYS[i];
      var raw = localStorage.getItem(k);
      var obj = safeParse(raw);
      if (looksLikeUserObj(obj)) return { key: k, obj: obj };
    }

    // 2) Sonra localStorage içinden auth benzeri key’leri tarayalım
    var keys = Object.keys(localStorage || {});
    for (var j=0; j<keys.length; j++){
      var kk = keys[j];
      if (!/auth|session|token|user|login|jwt/i.test(kk)) continue;
      var raw2 = localStorage.getItem(kk);
      var obj2 = safeParse(raw2);
      if (looksLikeUserObj(obj2)) return { key: kk, obj: obj2 };
    }

    return null;
  }

  function normalize(obj){
    // Email’i olabildiğince yakala
    var email =
      obj.email ||
      obj.userEmail ||
      (obj.user && obj.user.email) ||
      (obj.profile && obj.profile.email) ||
      "";

    // token/jwt’i de sakla (varsa)
    var token =
      obj.token ||
      obj.jwt ||
      obj.accessToken ||
      (obj.session && obj.session.token) ||
      "";

    return {
      email: String(email || ""),
      token: String(token || ""),
      raw: obj,
      ts: Date.now()
    };
  }

  function setUnified(unified){
    try { localStorage.setItem(UNIFIED_KEY, JSON.stringify(unified)); } catch(e){}
  }

  function getUnified(){
    return safeParse(localStorage.getItem(UNIFIED_KEY)) || null;
  }

  function isLoggedIn(unified){
    if (!unified) return false;
    // Email veya token’dan biri varsa login say
    return !!(unified.email || unified.token);
  }

  function qs(id){ return document.getElementById(id); }

  function updateTopbarUI(){
    var guest = qs("authGuest");
    var user  = qs("authUser");
    var emailEl = qs("topUserEmail");

    // Eğer bu ID’ler yoksa dokunma (kurumsal HTML uyumsuz demektir)
    if (!guest || !user) return;

    var unified = getUnified();
    var ok = isLoggedIn(unified);

    guest.style.display = ok ? "none" : "";
    user.style.display  = ok ? "" : "none";

    if (emailEl && ok){
      emailEl.textContent = unified.email || "Hesabım";
    }
  }

  // --- main ---
  // 1) Unified yoksa üretmeyi dene
  var unifiedNow = getUnified();
  if (!isLoggedIn(unifiedNow)){
    var picked = pickBestCandidate();
    if (picked && picked.obj){
      var unified = normalize(picked.obj);
      setUnified(unified);
    }
  }

  // 2) UI güncelle
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", updateTopbarUI);
  } else {
    updateTopbarUI();
  }

  // 3) Tab değişince (kurumsal sayfada login/logout sonrası) tekrar dene
  window.addEventListener("storage", function(ev){
    if (!ev) return;
    if (ev.key === UNIFIED_KEY || /auth|session|token|user|login|jwt/i.test(String(ev.key||""))){
      // unified’i tekrar üretmeyi dene
      var picked2 = pickBestCandidate();
      if (picked2 && picked2.obj){
        setUnified(normalize(picked2.obj));
      }
      updateTopbarUI();
    }
  });
})();
