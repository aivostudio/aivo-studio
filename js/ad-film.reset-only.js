/* AIVO AI Reklam Filmi — draft reset only */
(function AIVO_AD_FILM_RESET_ONLY(){
  "use strict";
  if(window.__AIVO_AD_FILM_RESET_ONLY_V1__)return;
  window.__AIVO_AD_FILM_RESET_ONLY_V1__=true;

  var PROJECT_KEY="aivo_adfilm_active_project_id_v2";
  var LEGACY_KEY="aivo_adfilm_active_project_id_v1";
  var resetting=false;

  function clean(value){return String(value==null?"":value).trim()}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function activeProjectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id||localStorage.getItem(PROJECT_KEY)||localStorage.getItem(LEGACY_KEY))}
  function notify(message,type,duration){
    try{
      var fn=window.toast&&window.toast[type||"info"];
      if(typeof fn==="function")return fn({message:message,duration:duration||3600});
      if(typeof window.showToast==="function")return window.showToast(message,type||"info");
    }catch(_){}
  }
  function clearDraftKeys(){
    ["aivo_adfilm_basic_draft_v1","aivo_adfilm_basic_draft_v2","aivo_adfilm_creative_plan_v1","aivo_adfilm_reference_layout_v1","aivo_adfilm_narration_review_v1"].forEach(function(key){try{localStorage.removeItem(key);sessionStorage.removeItem(key)}catch(_){}});
  }
  async function request(url,options){
    var response=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));
    var data=await response.json().catch(function(){return{}});
    if(!response.ok){var error=new Error(data.error||data.message||("HTTP "+response.status));error.status=response.status;error.data=data;throw error}
    return data;
  }
  async function reset(scope){
    if(resetting)return;
    resetting=true;
    var oldProjectId=activeProjectId(scope||root());
    var handle=notify(text("Yeni boş taslak hazırlanıyor...","Preparing a fresh draft..."),"info",0);
    try{
      if(oldProjectId){
        await request("/api/ad-film/seedance/cancel",{method:"POST",body:JSON.stringify({projectId:oldProjectId,mode:"cancelled",reason:"draft_reset"})}).catch(function(){});
      }
      clearDraftKeys();
      var created=await request("/api/ad-film/project",{method:"POST",body:JSON.stringify({project:{}})});
      var nextId=clean(created&&created.project&&created.project.id);
      if(!nextId)throw new Error("missing_new_project_id");
      try{localStorage.setItem(PROJECT_KEY,nextId);localStorage.removeItem(LEGACY_KEY)}catch(_){}
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      notify(text("Yeni taslak açıldı. Eski videoların korunuyor.","New draft opened. Your previous videos are preserved."),"success");
      location.hash="#adfilm";
      location.reload();
    }catch(error){
      resetting=false;
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      console.error("[ADFILM] reset-only",error);
      notify(text("Yeni taslak oluşturulamadı. Eski proje silinmedi.","A new draft could not be created. The old project was not deleted."),"error",5200);
    }
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-draft-reset]");
    if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    reset(button.closest('[data-module-root][data-module="adfilm"]')||root());
  },true);

  window.AIVOAdFilmResetOnly={reset:function(){reset(root())}};
})();
