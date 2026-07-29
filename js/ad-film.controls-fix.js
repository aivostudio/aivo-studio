/* AIVO AI Reklam Filmi — stable download/fullscreen controls */
(function AIVO_AD_FILM_CONTROLS_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_CONTROLS_FIX__)return;
  window.__AIVO_AD_FILM_CONTROLS_FIX__=true;

  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}

  function contextFromButton(button){
    var card=button.closest("[data-history-project-id],[data-output-project-id],[data-output-id]");
    var active=project();
    var projectId=clean(
      card&&card.dataset.historyProjectId||
      card&&card.dataset.outputProjectId||
      window.AIVOAdFilmActiveOutputProjectId||
      active&&active.id
    );
    var outputId=clean(
      card&&card.dataset.historyOutputId||
      card&&card.dataset.outputId||
      window.AIVOAdFilmActiveOutputId||
      active&&active.activeOutputId||
      active&&active.generation&&active.generation.outputId
    );
    return{projectId:projectId,outputId:outputId,card:card};
  }

  function videoFromButton(button,ctx){
    if(ctx&&ctx.card){
      var cardVideo=ctx.card.querySelector("video");
      if(cardVideo)return cardVideo;
    }
    var frame=button.closest("[data-panel-frame]")||document.querySelector('.rpPanelWrap[data-panel-key="adfilm"] [data-panel-frame]');
    return frame&&frame.querySelector("video[data-adfilm-result-video],video");
  }

  function download(ctx){
    if(!ctx.projectId)return;
    var url="/api/ad-film/seedance/download?projectId="+encodeURIComponent(ctx.projectId);
    if(ctx.outputId)url+="&outputId="+encodeURIComponent(ctx.outputId);
    var anchor=document.createElement("a");
    anchor.href=url;
    anchor.download="";
    anchor.style.display="none";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(function(){anchor.remove()},0);
  }

  function fullscreen(video){
    if(!video)return;
    try{
      if(video.requestFullscreen){
        var result=video.requestFullscreen({navigationUI:"hide"});
        if(result&&result.catch)result.catch(function(){});
      }else if(video.webkitEnterFullscreen){
        video.webkitEnterFullscreen();
      }else if(video.webkitRequestFullscreen){
        video.webkitRequestFullscreen();
      }
    }catch(_){}
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest(
      '.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-result-toolbar] [data-result-action="download"],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-result-toolbar] [data-result-action="fullscreen"],'+
      '[data-adfilm-project-history] [data-history-action="download"],'+
      '[data-adfilm-project-history] [data-history-action="fullscreen"],'+
      '[data-adfilm-output-gallery] [data-output-action="download"],'+
      '[data-adfilm-output-gallery] [data-output-action="fullscreen"]'
    );
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var ctx=contextFromButton(button);
    var action=button.dataset.resultAction||button.dataset.historyAction||button.dataset.outputAction;
    if(action==="download")download(ctx);
    else if(action==="fullscreen")fullscreen(videoFromButton(button,ctx));
  },true);
})();