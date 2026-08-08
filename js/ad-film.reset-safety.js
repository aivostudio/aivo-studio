/* =========================================================
   AIVO — AI REKLAM FILMI / RESET + POLL SAFETY
   - Draft reset creates a fresh project without deleting history.
   - Terminal provider errors are converted to FAILED once so polling stops.
   - Deleted outputs are never recovered automatically.
   ========================================================= */
(function AIVO_AD_FILM_RESET_POLL_SAFETY(){
  "use strict";
  if(window.__AIVO_AD_FILM_RESET_POLL_SAFETY__)return;
  window.__AIVO_AD_FILM_RESET_POLL_SAFETY__=true;

  var PROJECT_KEY="aivo_adfilm_active_project_id_v2";
  var LEGACY_KEY="aivo_adfilm_active_project_id_v1";
  var FORCE_BLANK_KEY="aivo_adfilm_force_blank_form_v1";
  var nativeFetch=window.fetch.bind(window);
  var resetting=false;

  function clean(value){return String(value==null?"":value).trim()}
  function isEnglish(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function message(tr,en){return isEnglish()?en:tr}
  function activeProjectId(scope){
    return clean(scope&&scope.dataset.adfilmProjectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id||localStorage.getItem(PROJECT_KEY)||localStorage.getItem(LEGACY_KEY));
  }
  function notify(text,type){
    try{
      var fn=window.toast&&window.toast[type||"info"];
      if(typeof fn==="function")return fn({message:text,duration:type==="error"?4600:2800});
      if(typeof window.showToast==="function")return window.showToast(text,type||"info");
    }catch(_){}
  }
  function clearDraftKeys(){
    [
      "aivo_adfilm_basic_draft_v1","aivo_adfilm_basic_draft_v2",
      "aivo_adfilm_creative_plan_v1","aivo_adfilm_reference_layout_v1",
      "aivo_adfilm_narration_review_v1"
    ].forEach(function(key){try{localStorage.removeItem(key);sessionStorage.removeItem(key)}catch(_){}});
  }
  function setForceBlankMarker(enabled){
    try{if(enabled)sessionStorage.setItem(FORCE_BLANK_KEY,"1");else sessionStorage.removeItem(FORCE_BLANK_KEY)}catch(_){}
  }
  function forceBlankPending(){
    try{return sessionStorage.getItem(FORCE_BLANK_KEY)==="1"}catch(_){return false}
  }
  function clearTextFields(scope){
    if(!scope)return;
    ["productName","brandName","description","targetAudience","cta","narrationText"].forEach(function(key){
      scope.querySelectorAll('[data-adfilm-input="'+key+'"]').forEach(function(field){
        try{
          field.value="";
          field.defaultValue="";
          if(field.tagName==="TEXTAREA")field.textContent="";
          field.removeAttribute("value");
          field.removeAttribute("aria-invalid");
          var control=field.closest(".adfilm-control");
          if(control)control.classList.remove("has-error");
          field.dispatchEvent(new Event("input",{bubbles:true}));
          field.dispatchEvent(new Event("change",{bubbles:true}));
        }catch(_){}
      });
    });
    scope.querySelectorAll("[data-adfilm-count]").forEach(function(counter){counter.textContent="0"});
  }
  function enforceBlankAfterReload(scope){
    if(!forceBlankPending())return;
    [0,60,180,500,1100].forEach(function(delay){
      setTimeout(function(){
        var target=scope&&scope.isConnected?scope:document.querySelector('[data-module-root][data-module="adfilm"]');
        clearTextFields(target);
      },delay);
    });
    setTimeout(function(){setForceBlankMarker(false)},1800);
  }
  async function json(url,options){
    var response=await nativeFetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));
    var data=await response.json().catch(function(){return{}});
    if(!response.ok)throw new Error(data&&data.error||("HTTP "+response.status));
    return data;
  }
  async function safeReset(scope){
    if(resetting)return;
    resetting=true;
    window.__AIVO_AD_FILM_RESETTING__=true;
    var oldProjectId=activeProjectId(scope);
    var handle=notify(message("Yeni boş taslak hazırlanıyor...","Preparing a fresh draft..."),"info");
    try{
      clearTextFields(scope);
      setForceBlankMarker(true);
      if(oldProjectId){
        await json("/api/ad-film/seedance/cancel",{
          method:"POST",
          body:JSON.stringify({projectId:oldProjectId,mode:"cancelled",reason:"draft_reset"})
        }).catch(function(){});
      }
      clearDraftKeys();
      var created=await json("/api/ad-film/project",{method:"POST",body:JSON.stringify({project:{}})});
      var nextId=clean(created&&created.project&&created.project.id);
      if(!nextId)throw new Error("missing_new_project_id");
      try{
        localStorage.setItem(PROJECT_KEY,nextId);
        localStorage.removeItem(LEGACY_KEY);
      }catch(_){}
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      notify(message("Yeni taslak açıldı. Eski videoların korunuyor.","New draft opened. Your previous videos are preserved."),"success");
      location.hash="#adfilm";
      location.reload();
    }catch(error){
      resetting=false;
      window.__AIVO_AD_FILM_RESETTING__=false;
      setForceBlankMarker(false);
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      console.error("[ADFILM] safe reset",error);
      notify(message("Yeni taslak oluşturulamadı. Eski proje silinmedi.","A new draft could not be created. The old project was not deleted."),"error");
    }
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-draft-reset]");
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    var scope=button.closest('[data-module-root][data-module="adfilm"]');
    setTimeout(function(){safeReset(scope)},120);
  },true);

  function terminalProviderError(data,responseStatus){
    var providerStatus=Number(data&&data.fal_status||responseStatus||0);
    var code=clean(data&&data.error).toLowerCase();
    if(code!=="fal_result_error"&&code!=="fal_status_error"&&code!=="fal_error")return false;
    return providerStatus>=400&&providerStatus<500&&![408,409,425,429].includes(providerStatus);
  }
  function errorReason(data){
    try{
      var detail=data&&data.fal_response&&data.fal_response.detail;
      if(Array.isArray(detail)&&detail[0]&&detail[0].msg)return clean(detail[0].msg).slice(0,500);
    }catch(_){}
    return clean(data&&data.error||"provider_generation_failed");
  }

  window.fetch=async function(input,options){
    var url=typeof input==="string"?input:input&&input.url||"";
    var response=await nativeFetch(input,options);
    if(url.indexOf("/api/ad-film/seedance/status")<0||response.ok)return response;

    var data=await response.clone().json().catch(function(){return{}});
    if(!terminalProviderError(data,response.status))return response;

    var match=url.match(/[?&]projectId=([^&]+)/);
    var projectId=match?decodeURIComponent(match[1]):"";
    if(projectId){
      nativeFetch("/api/ad-film/seedance/cancel",{
        method:"POST",
        credentials:"include",
        cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({projectId:projectId,mode:"failed",reason:errorReason(data)})
      }).catch(function(){});
    }

    return new Response(JSON.stringify({
      ok:true,
      projectId:projectId||null,
      status:"FAILED",
      video_url:null,
      generation:{status:"failed",error:errorReason(data)}
    }),{
      status:200,
      headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
    });
  };

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")enforceBlankAfterReload(event.detail.root);
  });
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){enforceBlankAfterReload(document.querySelector('[data-module-root][data-module="adfilm"]'))},{once:true});
  else enforceBlankAfterReload(document.querySelector('[data-module-root][data-module="adfilm"]'));

  /* Manual recovery remains available through the backend endpoint when explicitly needed.
     It is intentionally not called during module mount or page load because that resurrected
     videos the user had deliberately deleted. */
})();