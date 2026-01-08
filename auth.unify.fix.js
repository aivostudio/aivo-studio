/* =========================================================
   AUTH UNIFY FIX (BRIDGE) — aivo_auth_unified_v2
   Amaç:
   - Farklı sayfalarda farklı key kullanılsa bile TEK auth state üretmek
   - Kurumsal/Fiyatlandırma topbar UI'yi güvenli güncellemek
   Not:
   - index.auth.js'ten SONRA yüklenmeli (defer ile en sonda ideal)
   ========================================================= */
(function(){
  "use strict";

  var UNIFIED_KEY = "aivo_auth_unified_v2";

  // Öncelik: Senin sisteminde kesin kullanılan key’ler
  var DIRECT_KEYS = {
    loggedIn: ["aivo_logged_in", "aivo_auth"],       // "1" beklenir
    email:    ["aivo_user_email", "aivo_email"]      // email string
  };

  // Muhtemel eski/dağınık JSON key adayları (fallback)
  var CANDIDATE_KEYS = [
    "aivo_auth_unified_v1",
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

  function str(v){ return String(v == null ? "" : v); }

  function getFirstLS(keys){
    for (var i=0; i<keys.length; i++){
      var v = localStorage.getItem(keys[i]);
      if (v != null && String(v).trim() !== "") return v;
    }
    return null;
  }

  function looksLikeUserObj(o){
    if (!o || typeof o !== "object") return false;
    return !!(o.email || (o.user && o.user.email) || o.userEmail || o.token || o.jwt || o.accessToken);
  }

  function pickBestCandidateObj(){
    // 1) Bilinen JSON key’lere bak
    for (var i=0; i<CANDIDATE_KEYS.length; i++){
      var k = CANDIDATE_KEYS[i];
      var raw = localStorage.getItem(k);
      var obj = safeParse(raw);
      if (looksLikeUserObj(obj)) return { key: k, obj: obj };
    }

    // 2) localStorage taraması (auth/session/token/user/login/jwt)
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

  function normalizeFromObj(obj){
    var email =
      obj.email ||
      obj.userEmail ||
      (obj.user && obj.user.email) ||
      (obj.profile && obj.profile.email) ||
      "";

    var token =
      obj.token ||
      obj.jwt ||
      obj.accessToken ||
      (obj.session && obj.session.token) ||
      "";

    return {
      loggedIn: !!(email || token),
      email: str(email),
      token: str(token),
      raw: obj,
      ts: Date.now(),
      src: "object"
    };
  }

  function normalizeFromDirect(){
    var li = getFirstLS(DIRECT_KEYS.loggedIn);
    var em = getFirstLS(DIRECT_KEYS.email);

    var ok = (String(li || "") === "1");
    var email = str(em);

    // Eğer email var ama loggedIn key yoksa yine de login kabul et (bazı sayfalarda sadece email kalabiliyor)
    if (!ok && email) ok = true;

    return {
      loggedIn: !!ok,
      email: email,
      token: "",
      raw: { loggedInKey: li, emailKey: em },
      ts: Date.now(),
      src: "direct"
    };
  }

  function setUnified(u){
    try { localStorage.setItem(UNIFIED_KEY, JSON.stringify(u)); } catch(e){}
  }

  function getUnified(){
    return safeParse(localStorage.getItem(UNIFIED_KEY)) || null;
  }

  function isLoggedIn(u){
    return !!(u && (u.loggedIn || u.email || u.token));
  }

  function qs(id){ return document.getElementById(id); }

  // Topbar’da farklı yerlerde email/name göstergeleri olabilir; hepsini destekle
  function setTextIf(el, txt){
    if (!el) return;
    el.textContent = txt;
  }

  function show(el){
    if (!el) return;
    el.hidden = false;
    el.style.display = "";
  }
  function hide(el){
    if (!el) return;
    el.hidden = true;
    el.style.display = "none";
  }

  function updateTopbarUI(){
    var guest = qs("authGuest");
    var user  = qs("authUser");

    // Bu ID’ler yoksa dokunma (topbar partial / markup uyumsuz demektir)
    if (!guest || !user) return;

    var u = getUnified();
    var ok = isLoggedIn(u);

    if (ok){
      hide(guest);
      show(user);
    } else {
      show(guest);
      hide(user);
    }

    // Email alanları (hangisi varsa)
    var emailTxt = (u && u.email) ? u.email : "";
    setTextIf(qs("topUserEmail"), emailTxt || "—");
    setTextIf(qs("umEmail"),      emailTxt || "—");

    // İsim alanları (email yoksa default)
    var nameTxt = emailTxt ? emailTxt.split("@")[0] : "Hesap";
    setTextIf(qs("topUserName"), nameTxt);
    setTextIf(qs("umName"),      nameTxt);
  }

  function rebuildUnified(){
    // 1) Önce direct key’lerden üret (senin asıl sistemin)
    var u1 = normalizeFromDirect();
    if (isLoggedIn(u1)){
      setUnified(u1);
      return u1;
    }

    // 2) Sonra fallback JSON objelerden üret
    var picked = pickBestCandidateObj();
    if (picked && picked.obj){
      var u2 = normalizeFromObj(picked.obj);
      if (isLoggedIn(u2)){
        setUnified(u2);
        return u2;
      }
    }

    // 3) Hiçbir şey yoksa loggedOut unified yaz
    var u0 = { loggedIn:false, email:"", token:"", raw:null, ts:Date.now(), src:"none" };
    setUnified(u0);
    return u0;
  }

  function bindLogoutIfNeeded(){
    // Logout butonları (hangisi varsa)
    var btn = qs("btnLogoutUnified") || qs("btnLogoutTop") || qs("btnLogout");
    if (!btn) return;

    if (btn.__aivoLogoutBound) return;
    btn.__aivoLogoutBound = true;

    btn.addEventListener("click", function(e){
      e.preventDefault();

      // Senin sistemdeki ana key’leri temizle
      try { localStorage.removeItem("aivo_logged_in"); } catch(_){}
      try { localStorage.removeItem("aivo_user_email"); } catch(_){}
      try { localStorage.removeItem("aivo_auth"); } catch(_){}
      try { localStorage.removeItem("aivo_auth_v1"); } catch(_){}
      try { localStorage.removeItem(UNIFIED_KEY); } catch(_){}

      // Redirect/session anahtarları (varsa)
      try { sessionStorage.removeItem("aivo_after_login"); } catch(_){}
      try { localStorage.removeItem("aivo_redirect_after_login"); } catch(_){}

      // UI güncelle + sayfayı tazele
      rebuildUnified();
      updateTopbarUI();
      try { location.reload(); } catch(_){}
    }, true);
  }

  // --- main ---
  // 1) İlk unified üret
  rebuildUnified();

  // 2) DOM hazır olunca UI senkronla
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){
      updateTopbarUI();
      bindLogoutIfNeeded();
    });
  } else {
    updateTopbarUI();
    bindLogoutIfNeeded();
  }

  // 3) Storage değişince (login/logout başka tab/sayfa) tekrar senkronla
  window.addEventListener("storage", function(ev){
    if (!ev) return;
    var k = String(ev.key || "");

    // Bu key’lerden biri değiştiyse unified’i yeniden üret
    if (
      k === UNIFIED_KEY ||
      k === "aivo_logged_in" ||
      k === "aivo_user_email" ||
      k === "aivo_auth" ||
      /auth|session|token|user|login|jwt/i.test(k)
    ){
      rebuildUnified();
      updateTopbarUI();
    }
  });
})();
