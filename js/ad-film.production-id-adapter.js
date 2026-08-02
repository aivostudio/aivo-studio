/* AIVO AI Reklam Filmi — last-mile canonical production ID adapter */
(function AIVO_AD_FILM_PRODUCTION_ID_ADAPTER(){
  "use strict";
  if(window.__AIVO_AD_FILM_PRODUCTION_ID_ADAPTER_V1__)return;
  window.__AIVO_AD_FILM_PRODUCTION_ID_ADAPTER_V1__=true;

  var previousFetch=window.fetch.bind(window);

  function clean(value){return String(value==null?"":value).trim()}
  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  function parseBody(init){if(!init||typeof init.body!=="string")return null;try{return JSON.parse(init.body)}catch(_){return null}}
  function withBody(init,data){var next=Object.assign({},init||{});next.headers=Object.assign({},init&&init.headers||{}, {"Content-Type":"application/json"});next.body=JSON.stringify(data);return next}
  function controllerLock(){var value=window.__AIVO_AD_FILM_PRODUCTION_LOCK__;return value&&typeof value==="object"?value:null}

  window.fetch=function(input,init){
    var url=urlOf(input),method=clean(init&&init.method||"GET").toUpperCase();
    if(method==="POST"&&url.indexOf("/api/ad-film/seedance/create")>=0){
      var body=parseBody(init),lock=controllerLock();
      if(body&&lock&&clean(lock.id)){
        body.production_id=clean(lock.id);
        var force=window.__AIVO_AD_FILM_FORCE_FRESH__;
        if(force&&typeof force==="object")force.productionId=clean(lock.id);
        var latch=window.__AIVO_AD_FILM_PRODUCTION_UI_LATCH__;
        if(latch&&typeof latch==="object")latch.productionId=clean(lock.id);
        init=withBody(init,body);
      }
    }
    return previousFetch(input,init);
  };
})();
