/* AIVO AI Reklam Filmi — existing credit ledger bridge */
(function AIVO_AD_FILM_CREDIT_LEDGER(){
  "use strict";
  if(window.__AIVO_AD_FILM_CREDIT_LEDGER_V2__)return;
  window.__AIVO_AD_FILM_CREDIT_LEDGER_V2__=true;

  var APP="ad_film";
  var ACTION="studio_ad_film_generate";
  var BASE_CREDITS={"720p":145,"1080p":290,"4k":575};
  var STORAGE_KEY="aivo:adfilm:credit-run";
  var consuming=false;
  var current=null;
  var observer=null;
  var refundTimer=null;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function activeProject(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function field(scope,key){return scope&&scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function value(scope,key,fallback){var node=field(scope,key);if(!node)return fallback;return node.type==="checkbox"?!!node.checked:node.value}
  function selected(scope,key,fallback){var node=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return clean(node&&node.getAttribute("data-value"))||fallback}
  function files(node){return node?Array.from(node.files||[]):[]}
  function projectId(scope){var source=activeProject();return clean(scope&&scope.dataset.adfilmProjectId||source&&source.id)}
  function notify(message,type,duration){
    try{
      var fn=window.toast&&window.toast[type||"info"];
      if(typeof fn==="function")return fn(message,{duration:duration||4600});
      if(typeof window.showToast==="function")return window.showToast(message,type||"info",{duration:duration||4600});
    }catch(_){}
  }
  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function normalizeQuality(value){value=lower(value);return value==="720p"||value==="4k"?value:"1080p"}
  function normalizeDuration(value){var duration=Math.round(Number(value)||5);return duration>=5&&duration<=15?duration:null}
  function calculateCredits(quality,duration){var base=BASE_CREDITS[quality];return Math.ceil((base*duration/15)/5)*5}
  function uniqueRequestId(project){return"adfilm:"+project+":"+Date.now()+":"+Math.random().toString(36).slice(2,10)}

  function saveCurrent(){try{if(current)sessionStorage.setItem(STORAGE_KEY,JSON.stringify(current));else sessionStorage.removeItem(STORAGE_KEY)}catch(_){} }
  function restoreCurrent(){
    try{
      var parsed=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||"null");
      if(parsed&&parsed.transactionId&&parsed.requestId&&Number(parsed.amount)>0)current=parsed;
    }catch(_){current=null}
  }
  function clearCurrent(){current=null;saveCurrent();clearTimeout(refundTimer);refundTimer=null}

  async function request(url,options,retries){
    retries=Number(retries||0);
    try{
      var response=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json",Accept:"application/json"}},options||{}));
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||data&&data.ok===false){var error=new Error(clean(data&&data.message||data&&data.error)||("HTTP "+response.status));error.status=response.status;error.data=data;throw error}
      return data;
    }catch(error){
      if(retries>0&&[502,503,504].indexOf(Number(error&&error.status))>=0){await wait(1400);return request(url,options,retries-1)}
      throw error;
    }
  }

  function applyCredits(credits){
    if(typeof credits!=="number")return;
    var node=document.getElementById("topCreditCount");if(node)node.textContent=String(credits);
    try{if(window.AIVO_STORE_V1&&typeof window.AIVO_STORE_V1.setCredits==="function")window.AIVO_STORE_V1.setCredits(credits)}catch(_){}
  }
  async function refreshCredits(){
    try{
      var response=await fetch("/api/credits/get",{credentials:"include",cache:"no-store",headers:{Accept:"application/json"}});
      var data=await response.json().catch(function(){return{}});
      if(response.ok&&data&&data.ok&&typeof data.credits==="number")applyCredits(data.credits);
      try{if(typeof window.syncCreditsUI==="function")window.syncCreditsUI({force:true})}catch(_){}
      return data&&typeof data.credits==="number"?data.credits:null;
    }catch(_){return null}
  }

  function lockButton(button,on){
    if(!button)return;
    button.disabled=!!on||button.dataset.narrationGuard==="blocked";
    button.classList.toggle("is-loading",!!on);
    if(on)button.setAttribute("aria-busy","true");else button.removeAttribute("aria-busy");
  }
  function restoreButton(button){
    lockButton(button,false);
    try{if(window.AIVOAdFilmCreditPricing&&typeof window.AIVOAdFilmCreditPricing.sync==="function")window.AIVOAdFilmCreditPricing.sync()}catch(_){}
  }

  function canConsume(scope){
    var guard=window.AIVOAdFilmNarrationBuildGuard&&typeof window.AIVOAdFilmNarrationBuildGuard.state==="function"?window.AIVOAdFilmNarrationBuildGuard.state():null;
    if(guard&&guard.ready===false)return null;
    var controller=window.AIVOAdFilmProductionController;
    if(controller&&typeof controller.active==="function"&&controller.active())return null;
    var hero=files(scope&&scope.querySelector('[data-adfilm-role-file="hero"]'));
    if(!hero.length)return null;
    if(!clean(value(scope,"productName",""))||clean(value(scope,"description","")).length<10)return null;
    if(value(scope,"voiceEnabled",true)&&clean(value(scope,"narrationText","")).length<10)return null;
    var project=projectId(scope);if(!project)return null;
    var duration=normalizeDuration(selected(scope,"duration","5"));if(!duration)return null;
    var quality=normalizeQuality(selected(scope,"quality","1080p"));
    var ratio=selected(scope,"aspectRatio","16:9");
    return{projectId:project,duration:duration,quality:quality,aspectRatio:ratio,amount:calculateCredits(quality,duration)};
  }

  async function consume(settings){
    var requestId=uniqueRequestId(settings.projectId);
    var data=await request("/api/credits/consume-ledger",{method:"POST",body:JSON.stringify({
      app:APP,
      action:ACTION,
      cost:settings.amount,
      request_id:requestId,
      job_id:settings.projectId,
      reason:ACTION
    })},2);
    var transactionId=clean(data&&data.transaction_id||data&&data.transaction&&data.transaction.id);
    if(!transactionId)throw new Error("missing_credit_transaction_id");
    current={
      projectId:settings.projectId,
      requestId:requestId,
      transactionId:transactionId,
      amount:settings.amount,
      duration:settings.duration,
      quality:settings.quality,
      aspectRatio:settings.aspectRatio,
      status:"consumed",
      refundAttempts:0,
      createdAt:Date.now()
    };
    saveCurrent();
    if(typeof data.credits==="number")applyCredits(data.credits);else await refreshCredits();
    return current;
  }

  async function refund(reason){
    if(!current||current.status==="refunded"||current.status==="completed"||current.status==="refunding")return false;
    current.status="refunding";current.refundAttempts=Number(current.refundAttempts||0)+1;saveCurrent();
    try{
      var data=await request("/api/credits/refund",{method:"POST",body:JSON.stringify({
        app:APP,
        action:ACTION,
        amount:Number(current.amount),
        request_id:current.requestId,
        job_id:current.projectId,
        related_transaction_id:current.transactionId,
        reason:clean(reason)||"ad_film_generation_failed"
      })},2);
      var accepted=!!(data&&data.ok&&(data.refunded||data.deduped||data.skipped));
      if(!accepted)throw new Error("refund_not_confirmed");
      current.status="refunded";saveCurrent();
      if(typeof data.credits==="number")applyCredits(data.credits);else await refreshCredits();
      notify(text("Üretim tamamlanamadı. Kullanılan "+current.amount+" kredi hesabınıza iade edildi.","Production could not be completed. The "+current.amount+" credits used were refunded to your account."),"error",7200);
      clearCurrent();
      return true;
    }catch(error){
      if(current){current.status="consumed";saveCurrent()}
      if(current&&current.refundAttempts<3){
        clearTimeout(refundTimer);
        refundTimer=setTimeout(function(){refund(reason)},5000);
      }else{
        notify(text("Üretim tamamlanamadı. Kredi iadesi kontrol ediliyor.","Production could not be completed. The credit refund is being checked."),"warning",7200);
      }
      console.error("[ADFILM CREDIT] refund failed",error,error&&error.data||"");
      return false;
    }
  }

  function markCompleted(){
    if(!current)return;
    current.status="completed";saveCurrent();
    clearCurrent();
  }

  function checkTerminal(scope){
    if(!current||!scope)return;
    var status=scope.querySelector('[data-adfilm-engine-status]');if(!status)return;
    if(status.classList.contains("is-success")){markCompleted();return}
    if(status.classList.contains("is-error")){
      var detail=clean(status.querySelector("small")&&status.querySelector("small").textContent)||"ad_film_generation_failed";
      refund(detail);
    }
  }
  function watch(scope){
    if(observer)observer.disconnect();
    if(!scope)return;
    observer=new MutationObserver(function(){checkTerminal(scope)});
    observer.observe(scope,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});
    setTimeout(function(){checkTerminal(scope)},120);
  }

  async function begin(button,scope,settings){
    consuming=true;lockButton(button,true);
    try{
      await consume(settings);
      notify(text(settings.amount+" kredi kullanıldı. Reklam filminiz hazırlanıyor.",settings.amount+" credits were used. Your advertising film is being prepared."),"success",5200);
      button.setAttribute("data-adfilm-credit-bypass","1");
      restoreButton(button);
      button.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}));
      watch(scope);
    }catch(error){
      console.error("[ADFILM CREDIT] consume failed",error,error&&error.data||"");
      current=null;saveCurrent();restoreButton(button);
      var code=clean(error&&error.data&&error.data.error||error&&error.message);
      if(code==="insufficient_credits"){
        var balance=await refreshCredits();
        notify(text("Bu üretim için "+settings.amount+" kredi gerekiyor. Mevcut bakiyeniz: "+(typeof balance==="number"?balance:"-")+" kredi.","This production requires "+settings.amount+" credits. Current balance: "+(typeof balance==="number"?balance:"-")+" credits."),"warning",6200);
        setTimeout(function(){var destination=encodeURIComponent(location.pathname+location.search+location.hash);location.href="/fiyatlandirma.html?from=studio&reason=insufficient_credit&to="+destination},900);
      }else if(Number(error&&error.status)===401){
        notify(text("Kredi işlemi için yeniden giriş yapmalısın.","You need to sign in again for the credit transaction."),"warning",6200);
      }else{
        notify(text("Kredi işlemi tamamlanamadı. Üretim başlatılmadı.","The credit transaction could not be completed. Production was not started."),"error",6200);
      }
    }finally{consuming=false}
  }

  window.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button)return;
    if(button.getAttribute("data-adfilm-credit-bypass")==="1"){
      button.removeAttribute("data-adfilm-credit-bypass");
      return;
    }
    if(consuming||current){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();return}
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    var settings=canConsume(scope);if(!settings)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    begin(button,scope,settings);
  },true);

  function init(){restoreCurrent();watch(root())}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){watch(event.detail.root||root())},80)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(init,80)});
  window.addEventListener("pagehide",function(){if(observer)observer.disconnect();clearTimeout(refundTimer)});
  window.AIVOAdFilmCreditLedger={state:function(){return current},refresh:refreshCredits,refund:function(reason){return refund(reason)}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
