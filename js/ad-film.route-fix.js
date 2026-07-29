/* AIVO AI Reklam Filmi — safe route bridge without modifying the core router */
(function AIVO_AD_FILM_ROUTE_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_ROUTE_FIX__)return;
  window.__AIVO_AD_FILM_ROUTE_FIX__=true;

  var opening=false;
  var openSeq=0;

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

  async function openAdFilm(){
    if(opening)return;
    var host=document.getElementById("moduleHost");
    if(!host)return;
    if(host.getAttribute("data-active-module")==="adfilm"){
      setAdFilmUrl();setActiveNav();
      try{window.RightPanel&&window.RightPanel.force&&window.RightPanel.force("adfilm",{})}catch(_){}
      return;
    }

    opening=true;
    var seq=++openSeq;
    setAdFilmUrl();setActiveNav();
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
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){if(isAdFilmHash())setTimeout(openAdFilm,80)},{once:true});
  }else if(isAdFilmHash())setTimeout(openAdFilm,80);
})();