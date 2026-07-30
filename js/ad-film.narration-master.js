/* AIVO AI Reklam Filmi — narration mastering, invoked only by approval */
(function AIVO_AD_FILM_NARRATION_MASTER(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_MASTER_V5__)return;
  window.__AIVO_AD_FILM_NARRATION_MASTER_V5__=true;

  var busy=false,currentPromise=null;

  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}

  function master(){
    var source=project();
    var audio=source&&source.narration&&source.narration.audio;
    if(!source||!source.id||!audio||!clean(audio.url))return Promise.reject(new Error("narration_audio_missing"));
    if(audio.mastered===true&&Number(audio.masteringVersion)>=2)return Promise.resolve(source);
    if(busy&&currentPromise)return currentPromise;

    busy=true;
    currentPromise=(async function(){
      try{
        var response=await fetch("/api/ad-film/narration/master",{
          method:"POST",
          credentials:"include",
          cache:"no-store",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({projectId:source.id})
        });
        var data=await response.json().catch(function(){return{}});
        if(!response.ok||!data.project)throw new Error(data.message||data.error||"master_failed");
        window.AIVOAdFilmActiveProject=data.project;
        return data.project;
      }finally{
        busy=false;
        currentPromise=null;
      }
    })();
    return currentPromise;
  }

  window.AIVOAdFilmNarrationMaster={
    run:function(){return master()},
    isBusy:function(){return busy},
    promise:function(){return currentPromise}
  };
})();
