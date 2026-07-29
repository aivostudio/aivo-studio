/* AIVO AI Reklam Filmi — suppress duplicate project-sync redraws */
(function AIVO_AD_FILM_PROJECT_EVENT_STABILITY(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROJECT_EVENT_STABILITY_V1__)return;
  window.__AIVO_AD_FILM_PROJECT_EVENT_STABILITY_V1__=true;

  var lastSignature="";

  function clean(value){return String(value==null?"":value).trim()}

  function outputRows(source){
    source=source||{};
    var rows=[];
    var outputs=Array.isArray(source.outputs)?source.outputs:[];
    outputs.forEach(function(item){
      if(!item)return;
      rows.push([
        clean(item.id),
        clean(item.videoUrl),
        clean(item.sourceVideoUrl),
        String(item.version||1),
        clean(item.completedAt||item.createdAt),
        item.logoApplied===true?"1":"0"
      ].join("|"));
    });

    var generation=source.generation||{};
    rows.push([
      "generation",
      clean(generation.status),
      clean(generation.outputId||generation.requestId),
      clean(generation.videoUrl),
      clean(generation.error),
      generation.logoApplied===true?"1":"0"
    ].join("|"));

    return rows.join(";;");
  }

  function signature(source){
    source=source||{};
    return [
      clean(source.id),
      source.preparingNewVersion?"1":"0",
      clean(source.activeOutputId),
      outputRows(source)
    ].join("::");
  }

  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var source=event&&event.detail&&event.detail.project;
    var next=signature(source);

    if(!next)return;

    if(next===lastSignature){
      /* The project was saved, but its videos, active version and generation
         state did not change. The form already reflects the user's edit;
         rebuilding the right panel here only causes visible jumps. */
      event.stopImmediatePropagation();
      return;
    }

    lastSignature=next;
  },true);

  document.addEventListener("aivo:module-mounted",function(event){
    if(!(event&&event.detail&&event.detail.key==="adfilm"))return;
    var source=window.AIVOAdFilmActiveProject;
    var next=signature(source);
    if(next)lastSignature=next;
  },true);

  window.AIVOAdFilmProjectEventStability={
    reset:function(){lastSignature="";},
    signature:signature
  };
})();