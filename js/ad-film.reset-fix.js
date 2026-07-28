/* =========================================================
   AIVO — AI REKLAM FILMI / RESET COORDINATOR
   Prevents cache restoration, cloud autosave races and false error
   toasts while the old draft is deleted and a clean draft is created.
   ========================================================= */
(function AIVO_AD_FILM_RESET_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_RESET_FIX__)return;
  window.__AIVO_AD_FILM_RESET_FIX__=true;

  var resetUntil=0;
  var RESET_ERROR_RE=/(reklam projesi bulunamadı|advertising project was not found|bulut kaydı tamamlanamadı|cloud save could not be completed|sunucuda geçici bir sorun oluştu|temporary server problem)/i;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function resetting(){return Date.now()<resetUntil||!!window.__AIVO_AD_FILM_RESETTING__}
  function emptyFiles(field,dispatch){
    if(!field)return;
    try{
      var transfer=new DataTransfer();
      field.files=transfer.files;
      field.value="";
      if(dispatch!==false)field.dispatchEvent(new Event("change",{bubbles:true}));
    }catch(_){try{field.value=""}catch(__){}}
  }
  function clearDb(name){
    try{var request=indexedDB.deleteDatabase(name);request.onerror=function(){};request.onblocked=function(){}}catch(_){}
  }
  function clearLocalKeys(){
    [
      "aivo_adfilm_basic_draft_v1","aivo_adfilm_basic_draft_v2",
      "aivo_adfilm_creative_plan_v1","aivo_adfilm_reference_layout_v1",
      "aivo_adfilm_narration_review_v1"
    ].forEach(function(key){try{localStorage.removeItem(key);sessionStorage.removeItem(key)}catch(_){}});
  }
  function clearAllMedia(scope){
    if(!scope)return;
    scope.querySelectorAll("[data-adfilm-role-file],[data-adfilm-file],[data-adfilm-music-file]").forEach(function(field){emptyFiles(field,true)});
    clearDb("aivo_adfilm_creative_roles");
    clearDb("aivo_adfilm_preview");
    try{if(window.AIVOAdFilmMediaCache&&typeof window.AIVOAdFilmMediaCache.clear==="function")window.AIVOAdFilmMediaCache.clear()}catch(_){}
  }
  function forcePreviewClear(scope){
    if(!scope)return;
    var legacy=scope.querySelector('[data-adfilm-file="productImages"]');
    if(legacy){legacy.dataset.adfilmSkipCloudUpload="1";emptyFiles(legacy,true);setTimeout(function(){delete legacy.dataset.adfilmSkipCloudUpload},0)}
    var logo=scope.querySelector('[data-adfilm-file="logo"]');if(logo)emptyFiles(logo,true);
    var panel=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');
    if(panel){
      var media=panel.querySelector("[data-panel-media]");if(media){media.classList.remove("has-media");media.style.backgroundImage=""}
      var logoPreview=panel.querySelector("[data-panel-logo]");if(logoPreview){logoPreview.hidden=true;logoPreview.style.backgroundImage=""}
    }
  }
  function messageOf(value){
    if(value&&typeof value==="object"&&"message" in value)return String(value.message||"");
    return String(value||"");
  }
  function wrapToastMethod(name){
    var toast=window.toast;if(!toast||typeof toast[name]!=="function"||toast[name].__adfilmResetWrapped)return;
    var original=toast[name].bind(toast);
    var wrapped=function(value,options){
      if(resetting()&&RESET_ERROR_RE.test(messageOf(value)))return null;
      return original(value,options);
    };
    wrapped.__adfilmResetWrapped=true;toast[name]=wrapped;
  }
  function patchToasts(){["error","warning","info"].forEach(wrapToastMethod)}
  function finishReset(scope){
    forcePreviewClear(scope);
    window.__AIVO_AD_FILM_RESETTING__=false;
    if(scope)delete scope.dataset.adfilmResetting;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-reset-complete",{detail:{root:scope}}));
  }

  /* Stop reset-generated input/change events from waking autosave or cache writers. */
  document.addEventListener("input",function(event){
    if(resetting()&&event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"]')){event.stopImmediatePropagation();event.stopPropagation()}
  },true);
  document.addEventListener("change",function(event){
    if(resetting()&&event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"]')){event.stopImmediatePropagation();event.stopPropagation()}
  },true);

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-draft-reset]");
    if(!button)return;
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    resetUntil=Date.now()+12000;
    window.__AIVO_AD_FILM_RESETTING__=true;
    if(scope)scope.dataset.adfilmResetting="1";
    patchToasts();
    clearLocalKeys();
    clearAllMedia(scope);
    forcePreviewClear(scope);
    [120,450,1000,2200,4200].forEach(function(delay){setTimeout(function(){forcePreviewClear(scope)},delay)});
    setTimeout(function(){finishReset(scope)},5200);
  },true);

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(patchToasts,120);
  });

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",patchToasts,{once:true});else patchToasts();
})();