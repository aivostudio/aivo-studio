/* AIVO AI Reklam Filmi — compatibility bridge; core owner is StudioRouter */
(function AIVO_AD_FILM_ROUTE_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_ROUTE_FIX_V4__)return;
  window.__AIVO_AD_FILM_ROUTE_FIX_V4__=true;

  var panelGuardInstalled=false;

  function isAdFilmHash(){
    return String(location.hash||"").replace(/^#/,"").split("?")[0].trim()==="adfilm";
  }

  function currentProject(){
    return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null;
  }

  function restoreDynamicPanel(delay){
    setTimeout(function(){
      try{
        var project=currentProject();
        if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.restore==="function")window.AIVOAdFilmResultControls.restore(0);
        if(window.AIVOAdFilmOutputWorkflow&&typeof window.AIVOAdFilmOutputWorkflow.render==="function")window.AIVOAdFilmOutputWorkflow.render(project);
        if(window.AIVOAdFilmOutputGallery&&typeof window.AIVOAdFilmOutputGallery.render==="function")window.AIVOAdFilmOutputGallery.render(project);
        if(window.AIVOAdFilmProjectHistoryStable){
          if(typeof window.AIVOAdFilmProjectHistoryStable.render==="function")window.AIVOAdFilmProjectHistoryStable.render(false);
          else if(typeof window.AIVOAdFilmProjectHistoryStable.load==="function")window.AIVOAdFilmProjectHistoryStable.load(false);
        }
        if(window.AIVOAdFilmLivePreviewState&&typeof window.AIVOAdFilmLivePreviewState.sync==="function")window.AIVOAdFilmLivePreviewState.sync(project);
      }catch(error){
        console.warn("[ADFILM] dynamic panel restore",error);
      }
    },Number(delay)||0);
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
        var hasMountedPanel=!!(wrap&&wrap.isConnected&&wrap.querySelector(".adfilm-side-preview"));
        var hardRemount=!!(payload&&payload.__aivoHardRemount===true);

        /* The ad-film panel contains live video nodes and dynamically injected
           galleries. Re-running onShow replaces wrap.innerHTML and destroys all
           of them. Once mounted, ordinary form changes must never remount it. */
        if(current==="adfilm"&&hasMountedPanel&&!hardRemount){
          restoreDynamicPanel(0);
          restoreDynamicPanel(160);
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

  document.addEventListener("change",function(event){
    var toggle=event.target&&event.target.closest&&event.target.closest('[data-module="adfilm"] [data-adfilm-input="voiceEnabled"]');
    if(!toggle)return;
    restoreDynamicPanel(0);
    restoreDynamicPanel(180);
    restoreDynamicPanel(700);
  },true);

  document.addEventListener("pointerdown",function(event){
    var target=event.target&&event.target.closest&&event.target.closest(
      '.rpPanelWrap[data-panel-key="adfilm"] .adfilm-preview-play,'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-result-toolbar],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-output-gallery],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-project-history],'+
      '.rpPanelWrap[data-panel-key="adfilm"] video'
    );
    if(target)restoreDynamicPanel(0);
  },true);

  document.addEventListener("click",function(event){
    var target=event.target&&event.target.closest&&event.target.closest(
      '.rpPanelWrap[data-panel-key="adfilm"] .adfilm-preview-play,'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-result-action],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-output-action],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-history-action],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-output-id]'
    );
    if(target)restoreDynamicPanel(0);
  },true);

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-open]");
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAdFilm();
  },true);

  window.AIVOOpenAdFilm=openAdFilm;
  window.AIVOAdFilmRestorePanel=restoreDynamicPanel;

  if(!installPanelGuard()){
    var guardTries=0,guardTimer=setInterval(function(){guardTries++;if(installPanelGuard()||guardTries>80)clearInterval(guardTimer)},100);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){if(isAdFilmHash())openAdFilm()},{once:true});
  }else if(isAdFilmHash())openAdFilm();
})();