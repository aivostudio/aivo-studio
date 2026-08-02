/* AIVO AI Reklam Filmi — block stale draft autosaves during active production */
(function AIVO_AD_FILM_PRODUCTION_SAVE_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_PRODUCTION_SAVE_GUARD_V1__)return;
  window.__AIVO_AD_FILM_PRODUCTION_SAVE_GUARD_V1__=true;

  var previousFetch=window.fetch.bind(window);

  function clean(value){return String(value==null?"":value).trim()}
  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function active(){
    var source=project()||{},generation=source.generation||{},pipeline=source.avatar&&source.avatar.pipeline||{};
    var states=["queued","processing","running","in_queue","finalizing","rendering"];
    return states.indexOf(clean(source.status).toLowerCase())>=0||states.indexOf(clean(generation.status).toLowerCase())>=0||states.indexOf(clean(pipeline.status).toLowerCase())>=0||generation.awaitingFinalComposite===true||generation.avatarWaiting===true||generation.finalizing===true||!!window.__AIVO_AD_FILM_FORCE_FRESH__;
  }
  function synthetic(source){
    return Promise.resolve(new Response(JSON.stringify({ok:true,project:source,guarded:true}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}}));
  }

  window.fetch=function(input,init){
    var url=urlOf(input),method=clean(init&&init.method||"GET").toUpperCase();
    if((method==="PATCH"||method==="PUT")&&url.indexOf("/api/ad-film/project?id=")>=0&&active()){
      return synthetic(project());
    }
    return previousFetch(input,init);
  };
})();
