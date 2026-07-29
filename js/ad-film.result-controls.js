/* AIVO AI Reklam Filmi — generated video player controls */
(function AIVO_AD_FILM_RESULT_CONTROLS(){
  "use strict";
  if(window.__AIVO_AD_FILM_RESULT_CONTROLS__)return;
  window.__AIVO_AD_FILM_RESULT_CONTROLS__=true;

  var COPY={
    tr:{play:"Oynat",pause:"Duraklat",download:"İndir",fullscreen:"Tam ekran",mute:"Sesi kapat",unmute:"Sesi aç",remove:"Sil",removeConfirm:"Oluşturulan videoyu bu projeden kaldırmak istiyor musun?",removeFailed:"Video kaldırılamadı.",downloadFailed:"İndirme başlatılamadı; video yeni sekmede açıldı."},
    en:{play:"Play",pause:"Pause",download:"Download",fullscreen:"Fullscreen",mute:"Mute",unmute:"Unmute",remove:"Delete",removeConfirm:"Remove the generated video from this project?",removeFailed:"The video could not be removed.",downloadFailed:"Download could not start; the video was opened in a new tab."}
  };

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return(COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key}
  function projectId(){
    var root=document.querySelector('[data-module-root][data-module="adfilm"]');
    return String(root&&root.dataset.adfilmProjectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id||"").trim();
  }
  function toast(message,type){
    try{if(window.toast&&typeof window.toast[type||"info"]==="function")return window.toast[type||"info"](message);if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){}
  }
  function icon(name){
    var paths={
      play:'<path d="m9 6 9 6-9 6V6Z" fill="currentColor"/>',
      pause:'<path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor"/>',
      download:'<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      fullscreen:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      volume:'<path d="M5 10v4h3l4 3V7l-4 3H5Zm10-1.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
      muted:'<path d="M5 10v4h3l4 3V7l-4 3H5Zm10-1 5 5m0-5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
      trash:'<path d="M5 7h14M9 7V4h6v3M8 10v8m4-8v8m4-8v8M7 7l1 14h8l1-14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.play)+'</svg>';
  }
  function button(action,label,iconName,danger){
    var b=document.createElement("button");b.type="button";b.className="adfilm-result-control"+(danger?" is-danger":"");b.dataset.resultAction=action;b.title=label;b.setAttribute("aria-label",label);b.innerHTML=icon(iconName)+"<span>"+label+"</span>";return b;
  }

  async function downloadVideo(video){
    var url=video.currentSrc||video.src;if(!url)return;
    try{
      var response=await fetch(url,{mode:"cors"});
      if(!response.ok)throw new Error("download_failed_"+response.status);
      var blob=await response.blob();
      var objectUrl=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=objectUrl;a.download="aivo-reklam-filmi.mp4";document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(objectUrl)},2000);
    }catch(_){window.open(url,"_blank","noopener");toast(t("downloadFailed"),"warning")}
  }

  async function removeVideo(frame,video,toolbar){
    if(!window.confirm(t("removeConfirm")))return;
    var id=projectId();
    try{
      if(id){
        var response=await fetch("/api/ad-film/seedance/result?projectId="+encodeURIComponent(id),{method:"DELETE",credentials:"include"});
        var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||"remove_failed");
        if(data.project){window.AIVOAdFilmActiveProject=data.project;document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project}}))}
      }
      video.pause();video.remove();toolbar.remove();frame.classList.remove("has-result-video");
      var media=frame.querySelector("[data-panel-media]");if(media)media.classList.remove("has-result-video");
      window.AIVOAdFilmGeneratedVideo="";
    }catch(error){console.error("[ADFILM] remove generated video",error);toast(t("removeFailed"),"error")}
  }

  function enhance(video){
    if(!video||video.dataset.resultControlsReady==="1")return;
    video.dataset.resultControlsReady="1";
    video.controls=true;video.playsInline=true;video.preload="metadata";video.removeAttribute("autoplay");
    var frame=video.closest("[data-panel-frame]")||video.parentElement;if(!frame)return;
    frame.classList.add("has-result-video");
    var old=frame.querySelector("[data-adfilm-result-toolbar]");if(old)old.remove();
    var toolbar=document.createElement("div");toolbar.className="adfilm-result-toolbar";toolbar.setAttribute("data-adfilm-result-toolbar","");
    toolbar.appendChild(button("play",t("play"),"play"));
    toolbar.appendChild(button("download",t("download"),"download"));
    toolbar.appendChild(button("mute",video.muted?t("unmute"):t("mute"),video.muted?"muted":"volume"));
    toolbar.appendChild(button("fullscreen",t("fullscreen"),"fullscreen"));
    toolbar.appendChild(button("remove",t("remove"),"trash",true));
    frame.appendChild(toolbar);

    function syncPlay(){var b=toolbar.querySelector('[data-result-action="play"]');if(!b)return;var paused=video.paused;b.title=paused?t("play"):t("pause");b.setAttribute("aria-label",b.title);b.innerHTML=icon(paused?"play":"pause")+"<span>"+b.title+"</span>"}
    function syncMute(){var b=toolbar.querySelector('[data-result-action="mute"]');if(!b)return;b.title=video.muted?t("unmute"):t("mute");b.setAttribute("aria-label",b.title);b.innerHTML=icon(video.muted?"muted":"volume")+"<span>"+b.title+"</span>"}
    video.addEventListener("play",syncPlay);video.addEventListener("pause",syncPlay);video.addEventListener("volumechange",syncMute);syncPlay();syncMute();

    toolbar.addEventListener("click",function(event){
      var b=event.target.closest("[data-result-action]");if(!b)return;
      var action=b.dataset.resultAction;
      if(action==="play"){if(video.paused){video.play().catch(function(){})}else video.pause()}
      else if(action==="download")downloadVideo(video);
      else if(action==="mute")video.muted=!video.muted;
      else if(action==="fullscreen"){
        var target=frame;if(target.requestFullscreen)target.requestFullscreen();else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();
      }else if(action==="remove")removeVideo(frame,video,toolbar);
    });
  }

  function scan(root){(root||document).querySelectorAll('video[data-adfilm-result-video]').forEach(enhance)}
  var observer=new MutationObserver(function(records){records.forEach(function(record){record.addedNodes.forEach(function(node){if(node.nodeType!==1)return;if(node.matches&&node.matches('video[data-adfilm-result-video]'))enhance(node);else scan(node)})})});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){scan(document)},{once:true});else scan(document);
})();
