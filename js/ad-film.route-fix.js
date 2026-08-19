/* AIVO AI Reklam Filmi — compatibility bridge; keep mounted video DOM stable */
(function AIVO_AD_FILM_ROUTE_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_ROUTE_FIX_V9__)return;
  window.__AIVO_AD_FILM_ROUTE_FIX_V9__=true;

  if(!document.querySelector('link[href^="/css/studio.sidebar.icons.css"]')){
    var sidebarIcons=document.createElement("link");
    sidebarIcons.rel="stylesheet";
    sidebarIcons.href="/css/studio.sidebar.icons.css?v=2";
    document.head.appendChild(sidebarIcons);
  }

  if(!document.querySelector('link[href^="/css/studio.sidebar.panel-icons.css"]')){
    var panelIcons=document.createElement("link");
    panelIcons.rel="stylesheet";
    panelIcons.href="/css/studio.sidebar.panel-icons.css?v=1";
    document.head.appendChild(panelIcons);
  }

  if(!document.querySelector('script[src^="/js/ad-film.safari-download-frame.js"]')){
    var safariDownload=document.createElement("script");
    safariDownload.src="/js/ad-film.safari-download-frame.js?v=1";
    safariDownload.async=false;
    document.head.appendChild(safariDownload);
  }

  var panelGuardInstalled=false;

  function currentProject(){
    return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null;
  }

  function panel(){
    return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');
  }

  function repairMissingDynamicParts(delay){
    setTimeout(function(){
      try{
        var wrap=panel();
        if(!wrap||!wrap.isConnected)return;
        var source=currentProject();

        /* Only repair something that is actually missing. Never repaint an
           existing player/gallery during ordinary form saves; replacing their
           DOM makes all video thumbnails and the live preview flash. */
        if(!wrap.querySelector("video[data-adfilm-result-video]")&&window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.restore==="function"){
          window.AIVOAdFilmResultControls.restore(0);
        }
        if(!wrap.querySelector("[data-adfilm-output-workflow]")&&window.AIVOAdFilmOutputWorkflow&&typeof window.AIVOAdFilmOutputWorkflow.render==="function"){
          window.AIVOAdFilmOutputWorkflow.render(source);
        }
        if(!wrap.querySelector("[data-adfilm-output-gallery]")&&window.AIVOAdFilmOutputGallery&&typeof window.AIVOAdFilmOutputGallery.render==="function"){
          window.AIVOAdFilmOutputGallery.render(source);
        }
        if(window.AIVOAdFilmProjectHistoryStable&&!wrap.querySelector("[data-adfilm-project-history]")){
          if(typeof window.AIVOAdFilmProjectHistoryStable.render==="function")window.AIVOAdFilmProjectHistoryStable.render(false);
          else if(typeof window.AIVOAdFilmProjectHistoryStable.load==="function")window.AIVOAdFilmProjectHistoryStable.load(false);
        }
        if(window.AIVOAdFilmLivePreviewState&&typeof window.AIVOAdFilmLivePreviewState.sync==="function")window.AIVOAdFilmLivePreviewState.sync(source);
      }catch(error){
        console.warn("[ADFILM] dynamic panel repair",error);
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
        var wrap=panel();
        var hasMountedPanel=!!(wrap&&wrap.isConnected&&wrap.querySelector(".adfilm-side-preview"));
        var hardRemount=!!(payload&&payload.__aivoHardRemount===true);

        if(current==="adfilm"&&hasMountedPanel&&!hardRemount){
          /* RightPanel.force is called after virtually every saved form change.
             The mounted ad-film panel already reflects those changes through
             targeted project-sync listeners. Do not remount or restore it. */
          return;
        }
      }
      return originalForce.apply(window.RightPanel,arguments);
    };
    return true;
  }

  function openAdFilm(){
    var host=document.getElementById("moduleHost");
    var active=host&&host.getAttribute("data-active-module")==="adfilm";
    var loading=host&&host.getAttribute("data-loading-module")==="adfilm";
    if(active||loading)return;

    if(window.StudioRouter&&typeof window.StudioRouter.go==="function"){
      window.StudioRouter.go("adfilm");
      return;
    }
    if(location.hash!=="#adfilm")location.hash="adfilm";
  }

  function trackAdFilmTraffic(){
    if(window.__AIVO_ADFILM_TRAFFIC_HIT__)return;
    window.__AIVO_ADFILM_TRAFFIC_HIT__=true;

    try{
      fetch("/api/traffic/hit",{
        method:"POST",
        credentials:"include",
        cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          page:"/studio.v2.html#adfilm",
          platform:"desktop_web",
          source:"studio_adfilm",
          visibilityState:document.visibilityState||"unknown",
          referrer:document.referrer||""
        })
      }).catch(function(){});
    }catch(_){ }
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-open]");
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openAdFilm();
  },true);

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm"){
      trackAdFilmTraffic();
      repairMissingDynamicParts(420);
    }
  });

  window.AIVOOpenAdFilm=openAdFilm;
  window.AIVOAdFilmRestorePanel=repairMissingDynamicParts;

  if(!installPanelGuard()){
    var guardTries=0,guardTimer=setInterval(function(){guardTries++;if(installPanelGuard()||guardTries>80)clearInterval(guardTimer)},100);
  }

  /* The studio router is the only initial-route owner. Older versions also
     called openAdFilm() on DOMContentLoaded when #adfilm was present, causing
     the same module to mount twice (seq 1 and seq 2) and making all text flash. */
})();
