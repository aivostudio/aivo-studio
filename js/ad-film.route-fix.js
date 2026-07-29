/* AIVO AI Reklam Filmi — compatibility bridge; core owner is StudioRouter */
(function AIVO_AD_FILM_ROUTE_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_ROUTE_FIX_V3__)return;
  window.__AIVO_AD_FILM_ROUTE_FIX_V3__=true;

  var panelGuardUntil=0;
  var panelGuardInstalled=false;

  function isAdFilmHash(){
    return String(location.hash||"").replace(/^#/,"").split("?")[0].trim()==="adfilm";
  }

  function protectPanel(ms){
    panelGuardUntil=Math.max(panelGuardUntil,Date.now()+(Number(ms)||8000));
  }

  function restoreDynamicPanel(){
    setTimeout(function(){
      try{
        if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.restore==="function")window.AIVOAdFilmResultControls.restore(0);
        if(window.AIVOAdFilmOutputWorkflow&&typeof window.AIVOAdFilmOutputWorkflow.render==="function")window.AIVOAdFilmOutputWorkflow.render(window.AIVOAdFilmActiveProject);
        if(window.AIVOAdFilmOutputGallery&&typeof window.AIVOAdFilmOutputGallery.render==="function")window.AIVOAdFilmOutputGallery.render(window.AIVOAdFilmActiveProject);
      }catch(_){}
    },0);
  }

  function installPanelGuard(){
    if(panelGuardInstalled)return true;
    if(!window.RightPanel||typeof window.RightPanel.force!=="function")return false;
    panelGuardInstalled=true;

    var originalForce=window.RightPanel.force;
    window.RightPanel.force=function(key,payload){
      if(String(key)==="adfilm"){
        var current=typeof window.RightPanel.getCurrentKey==="function"?window.RightPanel.getCurrentKey():"";
        var wrap=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');
        var hasPanel=!!(wrap&&wrap.querySelector(".adfilm-side-preview"));
        if(current==="adfilm"&&hasPanel&&Date.now()<panelGuardUntil){
          restoreDynamicPanel();
          return;
        }
      }
      return originalForce.apply(window.RightPanel,arguments);
    };
    return true;
  }

  function openAdFilm(){
    if(window.StudioRouter&&typeof window.StudioRouter.go==="function"){
      window.StudioRouter.go("adfilm");
      return;
    }
    if(location.hash!=="#adfilm")location.hash="adfilm";
  }

  document.addEventListener("pointerdown",function(event){
    var target=event.target&&event.target.closest&&event.target.closest(
      '.rpPanelWrap[data-panel-key="adfilm"] .adfilm-preview-play,'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-result-toolbar],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-output-gallery],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-project-history],'+
      '.rpPanelWrap[data-panel-key="adfilm"] video'
    );
    if(target)protectPanel(12000);
  },true);

  document.addEventListener("click",function(event){
    var target=event.target&&event.target.closest&&event.target.closest(
      '.rpPanelWrap[data-panel-key="adfilm"] .adfilm-preview-play,'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-result-action],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-output-action],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-history-action],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-output-id]'
    );
    if(target)protectPanel(12000);
  },true);

  document.addEventListener("play",function(event){
    var video=event.target;
    if(video&&video.tagName==="VIDEO"&&video.closest&&video.closest('.rpPanelWrap[data-panel-key="adfilm"]'))protectPanel(12000);
  },true);

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-open]");
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAdFilm();
  },true);

  window.AIVOOpenAdFilm=openAdFilm;

  if(!installPanelGuard()){
    var guardTries=0,guardTimer=setInterval(function(){guardTries++;if(installPanelGuard()||guardTries>80)clearInterval(guardTimer)},100);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){if(isAdFilmHash())openAdFilm()},{once:true});
  }else if(isAdFilmHash())openAdFilm();
})();
