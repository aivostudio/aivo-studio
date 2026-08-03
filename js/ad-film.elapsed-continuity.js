/* AIVO AI Reklam Filmi — one elapsed clock and bounded transient provider resilience */
(function AIVO_AD_FILM_ELAPSED_CONTINUITY(){
  "use strict";
  if(window.__AIVO_AD_FILM_ELAPSED_CONTINUITY_V3__)return;
  window.__AIVO_AD_FILM_ELAPSED_CONTINUITY_V3__=true;

  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";
  var STALE_AFTER_MS=20*60*1000;
  var clock=null;
  var runStartedAt=0;
  var nativeFetch=typeof window.fetch==="function"?window.fetch.bind(window):null;
  var providerFailures=Object.create(null);
  var abandoning=Object.create(null);

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function latchStartedAt(){var latch=window[LATCH_KEY];var value=Date.parse(latch&&latch.startedAt||"");return Number.isFinite(value)&&value>0?value:0}
  function effectiveStartedAt(){var values=[runStartedAt,latchStartedAt()].filter(function(value){return Number.isFinite(value)&&value>0});return values.length?Math.min.apply(Math,values):0}
  function latchActive(){var latch=window[LATCH_KEY];return Boolean(latch&&typeof latch==="object"&&Number(latch.until||0)>Date.now())}
  function statusBusy(){var scope=root(),status=scope&&scope.querySelector('[data-adfilm-engine-status]'),button=scope&&scope.querySelector('[data-adfilm-build]');return Boolean(latchActive()||status&&status.classList.contains("is-busy")||button&&(button.classList.contains("is-generating")||button.classList.contains("is-music-preparing")||button.getAttribute("aria-busy")==="true"))}
  function formatElapsed(started){var total=Math.max(0,Math.floor((Date.now()-started)/1000));return Math.floor(total/60)+" "+(english()?"min":"dk")+" "+String(total%60).padStart(2,"0")+" "+(english()?"sec":"sn")}
  function render(){var scope=root(),started=effectiveStartedAt();if(!scope||!started){stopIfIdle();return}var target=scope.querySelector('[data-adfilm-stage-time]');if(target){var value=(english()?"Total elapsed: ":"Toplam geçen süre: ")+formatElapsed(started);if(target.textContent!==value)target.textContent=value}stopIfIdle()}
  function start(){if(!runStartedAt)runStartedAt=latchStartedAt()||Date.now();if(clock)return render();render();clock=setInterval(render,500)}
  function stopIfIdle(){if(statusBusy())return;if(clock){clearInterval(clock);clock=null}runStartedAt=0}
  function captureBuild(event){var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');if(!button)return;runStartedAt=Date.now();setTimeout(start,0)}

  function requestUrl(input){if(typeof input==="string")return input;if(input&&typeof input.url==="string")return input.url;return String(input||"")}
  function requestMethod(input,options){return String(options&&options.method||input&&input.method||"GET").toUpperCase()}
  function statusProjectId(url){try{return new URL(url,window.location.href).searchParams.get("projectId")||"unknown"}catch(_){return"unknown"}}
  function isSeedanceStatusRequest(input,options){if(requestMethod(input,options)!=="GET")return false;try{return new URL(requestUrl(input),window.location.href).pathname==="/api/ad-film/seedance/status"}catch(_){return false}}
  function payloadText(data){try{return JSON.stringify(data||{}).toLowerCase()}catch(_){return String(data||"").toLowerCase()}}
  function isTransientProviderFailure(response,data){var http=Number(response&&response.status||0),fal=Number(data&&data.fal_status||0),text=payloadText(data);if([429,502,503,504].indexOf(http)>=0)return true;if([429,500,502,503,504].indexOf(fal)>=0)return true;return text.indexOf("downstream_service_unavailable")>=0||text.indexOf("downstream service unavailable")>=0||text.indexOf("gateway timeout")>=0||text.indexOf("temporarily unavailable")>=0||text.indexOf("timeout_or_network")>=0}
  function retryDelay(count){var delays=[2500,5000,10000,15000,20000,30000];return delays[Math.min(Math.max(0,count-1),delays.length-1)]}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function reconnectMessage(){return english()?"The video service is temporarily busy. Reconnecting automatically; your production will continue.":"Video servisi geçici olarak yoğun. Otomatik yeniden bağlanılıyor; üretiminiz devam edecek."}
  function markReconnect(){var scope=root(),description=scope&&scope.querySelector('[data-adfilm-stage-description]');if(description)description.textContent=reconnectMessage();start()}
  function currentGeneration(){var source=window.AIVOAdFilmActiveProject;return source&&typeof source==="object"&&source.generation&&typeof source.generation==="object"?source.generation:{}}
  function generationAgeMs(){var started=Date.parse(currentGeneration().startedAt||"");if(Number.isFinite(started)&&started>0)return Date.now()-started;var effective=effectiveStartedAt();return effective?Date.now()-effective:0}
  function runningResponse(projectId,count,delay,source){var generation=currentGeneration();var body={ok:true,provider:"fal",projectId:projectId,status:"RUNNING",video_url:null,transient_provider_error:true,retry_count:count,retry_after_ms:delay,generation:generation,provider_error:source&&source.error||"provider_temporarily_unavailable"};return new Response(JSON.stringify(body),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
  async function abandonStale(projectId){if(abandoning[projectId])return abandoning[projectId];abandoning[projectId]=nativeFetch("/api/ad-film/seedance/abandon",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:projectId})}).then(function(response){return response.json().catch(function(){return{}}).then(function(data){return{response:response,data:data}})}).finally(function(){delete abandoning[projectId]});return abandoning[projectId]}
  async function resilientFetch(input,options){
    if(!nativeFetch||!isSeedanceStatusRequest(input,options))return nativeFetch(input,options);
    var url=requestUrl(input),projectId=statusProjectId(url);
    try{
      var response=await nativeFetch(input,options);
      if(response.ok){providerFailures[projectId]=0;return response}
      var data=await response.clone().json().catch(function(){return{}});
      if(!statusBusy()||!isTransientProviderFailure(response,data))return response;
      if(generationAgeMs()>=STALE_AFTER_MS){var abandoned=await abandonStale(projectId);if(abandoned&&abandoned.response&&abandoned.response.ok)return new Response(JSON.stringify(abandoned.data),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
      var count=(Number(providerFailures[projectId])||0)+1;providerFailures[projectId]=count;var delay=retryDelay(count);markReconnect();await sleep(delay);return runningResponse(projectId,count,delay,data);
    }catch(error){
      if(!statusBusy())throw error;
      if(generationAgeMs()>=STALE_AFTER_MS){var abandoned=await abandonStale(projectId);if(abandoned&&abandoned.response&&abandoned.response.ok)return new Response(JSON.stringify(abandoned.data),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
      var count=(Number(providerFailures[projectId])||0)+1;providerFailures[projectId]=count;var delay=retryDelay(count);markReconnect();await sleep(delay);return runningResponse(projectId,count,delay,{error:String(error&&error.message||error)});
    }
  }

  if(nativeFetch)window.fetch=resilientFetch;
  document.addEventListener("click",captureBuild,true);
  document.addEventListener("aivo:adfilm-project-sync",function(){if(latchActive()||statusBusy())start()});
  document.addEventListener("aivo:adfilm-finalization-pending",function(){if(latchActive()||statusBusy())start()});
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){if(latchActive()||statusBusy())start()},100)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(function(){if(latchActive()||statusBusy())start()},50)});
  window.addEventListener("pagehide",function(){if(clock)clearInterval(clock)});
})();
