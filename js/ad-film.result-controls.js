/* AIVO AI Reklam Filmi — persistent generated video player controls */
(function AIVO_AD_FILM_RESULT_CONTROLS(){
  "use strict";
  if(window.__AIVO_AD_FILM_RESULT_CONTROLS_V4__)return;
  window.__AIVO_AD_FILM_RESULT_CONTROLS_V4__=true;

  var COPY={
    tr:{play:"Oynat",pause:"Duraklat",download:"İndir",fullscreen:"Tam ekran",mute:"Sesi kapat",unmute:"Sesi aç",remove:"Sil",removeConfirm:"Oluşturulan videoyu bu projeden kaldırmak istiyor musun?",removeFailed:"Video kaldırılamadı.",downloadFailed:"Doğrudan indirme açılamadı; video yeni sekmede açıldı."},
    en:{play:"Play",pause:"Pause",download:"Download",fullscreen:"Fullscreen",mute:"Mute",unmute:"Unmute",remove:"Delete",removeConfirm:"Remove the generated video from this project?",removeFailed:"The video could not be removed.",downloadFailed:"Direct download was unavailable; the video opened in a new tab."}
  };

  var restoreTimer=null;
  var lastVideoUrl="";
  var lastLogoUrl="";
  var downloadBusy=false;

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return(COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key}
  function clean(value){return String(value||"").trim()}
  function activeProject(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(){
    var root=document.querySelector('[data-module-root][data-module="adfilm"]');
    return clean(root&&root.dataset.adfilmProjectId||activeProject()&&activeProject().id);
  }
  function isPreparing(){var project=activeProject();return!!(project&&project.preparingNewVersion)}
  function currentVideoUrl(){
    var project=activeProject();
    if(project&&project.preparingNewVersion)return"";
    return clean(window.AIVOAdFilmGeneratedVideo||project&&project.generation&&project.generation.videoUrl||lastVideoUrl);
  }
  function currentLogoUrl(){
    var project=activeProject();
    if(project&&project.preparingNewVersion)return"";
    return clean(
      window.AIVOAdFilmGeneratedLogo||
      project&&project.media&&project.media.logo&&project.media.logo.url||
      project&&project.generation&&project.generation.logoUrl||
      lastLogoUrl
    );
  }
  function remember(url,logo){
    if(isPreparing())return;
    if(clean(url)){lastVideoUrl=clean(url);window.AIVOAdFilmGeneratedVideo=lastVideoUrl}
    if(clean(logo)){lastLogoUrl=clean(logo);window.AIVOAdFilmGeneratedLogo=lastLogoUrl}
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
    var node=document.createElement("button");
    node.type="button";
    node.className="adfilm-result-control"+(danger?" is-danger":"");
    node.dataset.resultAction=action;
    node.title=label;
    node.setAttribute("aria-label",label);
    node.innerHTML=icon(iconName)+"<span>"+label+"</span>";
    return node;
  }
  function frame(){return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"] [data-panel-frame]')}
  function sameUrl(a,b){
    try{return new URL(a,location.href).href===new URL(b,location.href).href}catch(_){return clean(a)===clean(b)}
  }

  function ensureLogo(target,url){
    var old=target.querySelector("[data-adfilm-result-logo]");
    if(!url){if(old)old.remove();return}
    if(!old){old=document.createElement("div");old.className="adfilm-result-logo";old.setAttribute("data-adfilm-result-logo","");target.appendChild(old)}
    old.style.backgroundImage='url("'+String(url).replace(/"/g,"%22")+'")';
  }

  function clearPlayer(){
    clearTimeout(restoreTimer);
    var target=frame();
    if(target){
      var videos=target.querySelectorAll("video[data-adfilm-result-video]");
      videos.forEach(function(video){try{video.pause()}catch(_){}video.remove()});
      var toolbar=target.querySelector("[data-adfilm-result-toolbar]");if(toolbar)toolbar.remove();
      var logo=target.querySelector("[data-adfilm-result-logo]");if(logo)logo.remove();
      var media=target.querySelector("[data-panel-media]");if(media)media.classList.remove("has-result-video");
      target.classList.remove("has-result-video");
    }
    lastVideoUrl="";lastLogoUrl="";
    window.AIVOAdFilmGeneratedVideo="";window.AIVOAdFilmGeneratedLogo="";
  }

  async function downloadVideo(video){
    if(downloadBusy)return;
    var url=clean(video.currentSrc||video.src);if(!url)return;
    downloadBusy=true;
    try{
      var response=await fetch(url,{mode:"cors",cache:"no-store"});
      if(!response.ok)throw new Error("download_failed_"+response.status);
      var blob=await response.blob();
      var objectUrl=URL.createObjectURL(blob),anchor=document.createElement("a");
      anchor.href=objectUrl;anchor.download="aivo-reklam-filmi.mp4";anchor.style.display="none";
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(function(){URL.revokeObjectURL(objectUrl)},5000);
    }catch(_){
      window.open(url,"_blank","noopener");
      toast(t("downloadFailed"),"warning");
    }finally{
      downloadBusy=false;
    }
  }

  async function removeVideo(){
    if(!window.confirm(t("removeConfirm")))return;
    var id=projectId();
    try{
      if(id){
        var response=await fetch("/api/ad-film/seedance/result?projectId="+encodeURIComponent(id),{method:"DELETE",credentials:"include"});
        var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||"remove_failed");
        if(data.project){window.AIVOAdFilmActiveProject=data.project;document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project}}))}
      }
      clearPlayer();
    }catch(error){console.error("[ADFILM] remove generated video",error);toast(t("removeFailed"),"error")}
  }

  function syncPlay(video,toolbar){
    var node=toolbar&&toolbar.querySelector('[data-result-action="play"]');if(!node)return;
    var paused=video.paused;node.title=paused?t("play"):t("pause");node.setAttribute("aria-label",node.title);node.innerHTML=icon(paused?"play":"pause")+"<span>"+node.title+"</span>";
  }
  function syncMute(video,toolbar){
    var node=toolbar&&toolbar.querySelector('[data-result-action="mute"]');if(!node)return;
    node.title=video.muted?t("unmute"):t("mute");node.setAttribute("aria-label",node.title);node.innerHTML=icon(video.muted?"muted":"volume")+"<span>"+node.title+"</span>";
  }

  function enhance(video){
    if(!video)return;
    video.controls=true;video.playsInline=true;video.preload="metadata";video.removeAttribute("autoplay");
    var target=video.closest("[data-panel-frame]")||video.parentElement;if(!target)return;
    target.classList.add("has-result-video");
    ensureLogo(target,currentLogoUrl());

    var toolbar=target.querySelector("[data-adfilm-result-toolbar]");
    if(!toolbar){
      toolbar=document.createElement("div");toolbar.className="adfilm-result-toolbar";toolbar.setAttribute("data-adfilm-result-toolbar","");
      toolbar.appendChild(button("play",t("play"),"play"));
      toolbar.appendChild(button("download",t("download"),"download"));
      toolbar.appendChild(button("mute",video.muted?t("unmute"):t("mute"),video.muted?"muted":"volume"));
      toolbar.appendChild(button("fullscreen",t("fullscreen"),"fullscreen"));
      toolbar.appendChild(button("remove",t("remove"),"trash",true));
      target.appendChild(toolbar);
    }

    if(video.dataset.resultEventsReady!=="1"){
      video.dataset.resultEventsReady="1";
      video.addEventListener("play",function(){syncPlay(video,toolbar)});
      video.addEventListener("pause",function(){syncPlay(video,toolbar)});
      video.addEventListener("ended",function(){syncPlay(video,toolbar)});
      video.addEventListener("volumechange",function(){syncMute(video,toolbar)});
    }
    syncPlay(video,toolbar);syncMute(video,toolbar);
  }

  function videoForControl(node){
    var target=node&&node.closest("[data-panel-frame]");
    return target&&target.querySelector("video[data-adfilm-result-video]");
  }
  function enterFullscreen(video){
    if(!video)return;
    try{
      if(video.requestFullscreen){var result=video.requestFullscreen();if(result&&result.catch)result.catch(function(){})}
      else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();
      else if(video.webkitRequestFullscreen)video.webkitRequestFullscreen();
    }catch(_){}
  }
  function toggleMuteWithoutRestart(video){
    if(!video)return;
    var time=Number(video.currentTime)||0;
    var wasPlaying=!video.paused&&!video.ended;
    video.muted=!video.muted;
    requestAnimationFrame(function(){
      if(Math.abs((Number(video.currentTime)||0)-time)>.35){try{video.currentTime=time}catch(_){}}
      if(wasPlaying&&video.paused)video.play().catch(function(){});
    });
  }

  function handleToolbarAction(event){
    var node=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-result-toolbar] [data-result-action]');
    if(!node)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var video=videoForControl(node);if(!video)return;
    var action=node.dataset.resultAction;
    if(action==="play"){if(video.paused){video.play().catch(function(){})}else video.pause()}
    else if(action==="download")downloadVideo(video);
    else if(action==="mute")toggleMuteWithoutRestart(video);
    else if(action==="fullscreen")enterFullscreen(video);
    else if(action==="remove")removeVideo();
  }

  function mount(url,logo,options){
    if(isPreparing()){clearPlayer();return null}
    url=clean(url||currentVideoUrl());logo=clean(logo||currentLogoUrl());
    if(!url){clearPlayer();return null}
    remember(url,logo);
    var target=frame();if(!target)return null;
    var media=target.querySelector("[data-panel-media]");if(!media)return null;
    var video=media.querySelector("video[data-adfilm-result-video]");
    if(!video){
      video=document.createElement("video");video.setAttribute("data-adfilm-result-video","");media.appendChild(video);
    }
    if(!sameUrl(video.src,url))video.src=url;
    media.classList.add("has-media","has-result-video");target.classList.add("has-result-video");
    ensureLogo(target,logo);enhance(video);
    if(options&&options.play){video.muted=false;video.play().catch(function(){})}
    return video;
  }

  function restore(){
    clearTimeout(restoreTimer);
    restoreTimer=setTimeout(function(){
      var url=currentVideoUrl();
      if(!url){clearPlayer();return}
      mount(url,currentLogoUrl());
    },40);
  }
  function scan(root){
    (root||document).querySelectorAll('video[data-adfilm-result-video]').forEach(function(video){remember(video.currentSrc||video.src,currentLogoUrl());enhance(video)});
    restore();
  }

  document.addEventListener("click",handleToolbarAction,true);
  document.addEventListener("click",function(event){
    var play=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] .adfilm-preview-play');
    if(!play||!currentVideoUrl())return;
    event.preventDefault();event.stopImmediatePropagation();
    mount(currentVideoUrl(),currentLogoUrl(),{play:true});
  },true);

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(restore,300)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var nextProject=event&&event.detail&&event.detail.project;
    if(nextProject&&nextProject.preparingNewVersion){clearPlayer();return}
    if(nextProject&&nextProject.generation){remember(nextProject.generation.videoUrl,nextProject.media&&nextProject.media.logo&&nextProject.media.logo.url||nextProject.generation.logoUrl)}
    setTimeout(restore,120);
  });
  window.addEventListener("focus",restore);
  window.addEventListener("pageshow",restore);
  document.addEventListener("visibilitychange",function(){if(!document.hidden)restore()});

  var observer=new MutationObserver(function(records){
    var shouldRestore=false;
    records.forEach(function(record){record.addedNodes.forEach(function(node){
      if(node.nodeType!==1)return;
      if(node.matches&&node.matches('video[data-adfilm-result-video]'))enhance(node);
      else if(node.querySelector&&node.querySelector('video[data-adfilm-result-video]'))scan(node);
      if(node.matches&&node.matches('[data-panel-frame],.rpPanelWrap[data-panel-key="adfilm"]')||node.querySelector&&node.querySelector('[data-panel-frame]'))shouldRestore=true;
    })});
    if(shouldRestore)restore();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});

  window.AIVOAdFilmResultControls={mount:mount,restore:restore,clear:clearPlayer,videoUrl:currentVideoUrl,logoUrl:currentLogoUrl};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){scan(document)},{once:true});else scan(document);
})();