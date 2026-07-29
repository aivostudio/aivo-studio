/* AIVO AI Reklam Filmi — safe route bridge without modifying the core router */
(function AIVO_AD_FILM_ROUTE_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_ROUTE_FIX_V2__)return;
  window.__AIVO_AD_FILM_ROUTE_FIX_V2__=true;

  var opening=false;
  var openSeq=0;
  var panelGuardUntil=0;
  var panelGuardInstalled=false;

  function isAdFilmHash(){
    return String(location.hash||"").replace(/^#/,"").split("?")[0].trim()==="adfilm";
  }

  function setAdFilmUrl(){
    var next=location.pathname+location.search+"#adfilm";
    if(location.pathname+location.search+location.hash===next)return;
    try{history.pushState({aivoRoute:"adfilm"},"",next)}catch(_){try{history.replaceState(null,"",next)}catch(__){}}
  }

  function setActiveNav(){
    document.querySelectorAll("#leftMenu .navBtn").forEach(function(node){
      var on=node.hasAttribute("data-adfilm-open");
      node.classList.toggle("active",on);
      node.classList.toggle("is-active",on);
    });
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

  async function openAdFilm(){
    if(opening)return;
    var host=document.getElementById("moduleHost");
    if(!host)return;
    installPanelGuard();

    if(host.getAttribute("data-active-module")==="adfilm"){
      setAdFilmUrl();
      setActiveNav();
      var current=window.RightPanel&&typeof window.RightPanel.getCurrentKey==="function"?window.RightPanel.getCurrentKey():"";
      if(current!=="adfilm"){
        try{window.RightPanel&&window.RightPanel.force&&window.RightPanel.force("adfilm",{})}catch(_){}
      }else{
        restoreDynamicPanel();
      }
      return;
    }

    opening=true;
    var seq=++openSeq;
    setAdFilmUrl();
    setActiveNav();
    host.setAttribute("data-loading-module","adfilm");

    try{
      if(typeof window.AIVOEnsureAdFilmAssets==="function")await window.AIVOEnsureAdFilmAssets();
      var response=await fetch("/modules/ad-film.html",{credentials:"same-origin",cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      var html=await response.text();
      if(seq!==openSeq)return;
      var wrap=document.createElement("div");wrap.innerHTML=html;
      var root=wrap.querySelector("[data-module-root]")||wrap.firstElementChild;
      if(!root)throw new Error("adfilm module empty");
      host.replaceChildren(root);
      host.setAttribute("data-active-module","adfilm");
      host.removeAttribute("data-loading-module");
      try{document.dispatchEvent(new CustomEvent("aivo:module-mounted",{detail:{key:"adfilm",host:host,root:root}}))}catch(_){}
      requestAnimationFrame(function(){
        try{window.RightPanel&&window.RightPanel.force&&window.RightPanel.force("adfilm",{})}catch(_){}
      });
    }catch(error){
      console.error("[ADFILM][ROUTE] open failed",error);
      host.removeAttribute("data-loading-module");
    }finally{
      if(seq===openSeq)opening=false;
    }
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-open]");
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAdFilm();
  },true);

  window.addEventListener("popstate",function(){if(isAdFilmHash())openAdFilm()});
  window.addEventListener("hashchange",function(){if(isAdFilmHash())setTimeout(openAdFilm,0)});

  window.AIVOOpenAdFilm=openAdFilm;
  if(!installPanelGuard()){
    var guardTries=0,guardTimer=setInterval(function(){guardTries++;if(installPanelGuard()||guardTries>80)clearInterval(guardTimer)},100);
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){if(isAdFilmHash())setTimeout(openAdFilm,80)},{once:true});
  }else if(isAdFilmHash())setTimeout(openAdFilm,80);
})();
