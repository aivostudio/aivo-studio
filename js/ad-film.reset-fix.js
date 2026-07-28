/* =========================================================
   AIVO — AI REKLAM FILMI / RESET COORDINATOR
   Keeps the existing cloud reset flow, but clears every local media
   source immediately and hides the misleading project-missing toast
   that can occur while the old draft is being deleted and recreated.
   ========================================================= */
(function AIVO_AD_FILM_RESET_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_RESET_FIX__)return;
  window.__AIVO_AD_FILM_RESET_FIX__=true;

  var resetUntil=0;
  var PROJECT_MISSING_RE=/(reklam projesi bulunamadı|advertising project was not found)/i;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
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
      if(Date.now()<resetUntil&&PROJECT_MISSING_RE.test(messageOf(value)))return null;
      return original(value,options);
    };
    wrapped.__adfilmResetWrapped=true;toast[name]=wrapped;
  }
  function patchToasts(){["error","warning","info"].forEach(wrapToastMethod)}

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-draft-reset]");
    if(!button)return;
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    resetUntil=Date.now()+10000;
    patchToasts();
    clearLocalKeys();
    clearAllMedia(scope);
    forcePreviewClear(scope);
    [120,450,1000,2200].forEach(function(delay){setTimeout(function(){forcePreviewClear(scope)},delay)});
  },true);

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(patchToasts,120);
  });

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",patchToasts,{once:true});else patchToasts();
})();