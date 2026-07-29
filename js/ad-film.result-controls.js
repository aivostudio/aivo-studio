/* AIVO AI Reklam Filmi — single stable live-player controller */
(function AIVO_AD_FILM_RESULT_CONTROLS(){
  "use strict";
  if(window.__AIVO_AD_FILM_RESULT_CONTROLS_V6__)return;
  window.__AIVO_AD_FILM_RESULT_CONTROLS_V6__=true;

  var COPY={
    tr:{play:"Oynat",pause:"Duraklat",download:"İndir",fullscreen:"Tam ekran",mute:"Sesi kapat",unmute:"Sesi aç",remove:"Sil",removeConfirm:"Oluşturulan videoyu bu projeden kaldırmak istiyor musun?",removeFailed:"Video kaldırılamadı.",downloadFailed:"Video indirilemedi.",downloaded:"Video indirildi."},
    en:{play:"Play",pause:"Pause",download:"Download",fullscreen:"Fullscreen",mute:"Mute",unmute:"Unmute",remove:"Delete",removeConfirm:"Remove the generated video from this project?",removeFailed:"The video could not be removed.",downloadFailed:"The video could not be downloaded.",downloaded:"Video downloaded."}
  };

  var restoreTimer=null,lastVideoUrl="",lastLogoUrl="",downloadBusy=false;

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return(COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key}
  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(){
    var root=document.querySelector('[data-module-root][data-module="adfilm"]');
    return clean(root&&root.dataset.adfilmProjectId||project()&&project().id||window.AIVOAdFilmActiveOutputProjectId);
  }
  function outputId(){
    var p=project();
    return clean(window.AIVOAdFilmActiveOutputId||p&&p.activeOutputId||p&&p.generation&&p.generation.outputId);
  }
  function isPreparing(){var p=project();return!!(p&&p.preparingNewVersion)}
  function currentVideoUrl(){var p=project();if(p&&p.preparingNewVersion)return"";return clean(window.AIVOAdFilmGeneratedVideo||p&&p.generation&&p.generation.videoUrl||lastVideoUrl)}
  function currentLogoUrl(){var p=project();if(p&&p.preparingNewVersion)return"";return clean(window.AIVOAdFilmGeneratedLogo||p&&p.media&&p.media.logo&&p.media.logo.url||p&&p.generation&&p.generation.logoUrl||lastLogoUrl)}
  function remember(url,logo){if(isPreparing())return;if(clean(url)){lastVideoUrl=clean(url);window.AIVOAdFilmGeneratedVideo=lastVideoUrl}if(clean(logo)){lastLogoUrl=clean(logo);window.AIVOAdFilmGeneratedLogo=lastLogoUrl}}
  function toast(message,type){try{if(window.toast&&typeof window.toast[type||"info"]==="function")return window.toast[type||"info"](message);if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){}}
  function frame(){return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"] [data-panel-frame]')}
  function sameUrl(a,b){try{return new URL(a,location.href).href===new URL(b,location.href).href}catch(_){return clean(a)===clean(b)}}

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

  function ensureLogo(target,url){
    var old=target.querySelector("[data-adfilm-result-logo]");
    if(!url){if(old)old.remove();return}
    if(!old){old=document.createElement("div");old.className="adfilm-result-logo";old.setAttribute("data-adfilm-result-logo","");target.appendChild(old)}
    old.style.backgroundImage='url("'+String(url).replace(/"/g,"%22")+'")';
  }

  function clearPlayer(forget){
    clearTimeout(restoreTimer);
    var target=frame();
    if(target){
      target.querySelectorAll("video[data-adfilm-result-video]").forEach(function(video){try{video.pause()}catch(_){}video.remove()});
      target.querySelectorAll("[data-adfilm-result-toolbar],.adfilm-result-toolbar,[data-adfilm-result-actions-row]").forEach(function(node){node.remove()});
      var logo=target.querySelector("[data-adfilm-result-logo]");if(logo)logo.remove();
      var media=target.querySelector("[data-panel-media]");if(media)media.classList.remove("has-result-video");
      target.classList.remove("has-result-video");
    }
    if(forget!==false){lastVideoUrl="";lastLogoUrl="";window.AIVOAdFilmGeneratedVideo="";window.AIVOAdFilmGeneratedLogo=""}
  }

  function triggerBlobDownload(blob,name){
    var objectUrl=URL.createObjectURL(blob),anchor=document.createElement("a");
    anchor.href=objectUrl;anchor.download=name||"aivo-reklam-filmi.mp4";anchor.rel="noopener";anchor.style.display="none";
    document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(function(){URL.revokeObjectURL(objectUrl)},1500);
  }

  async function downloadVideo(video){
    if(downloadBusy)return;
    downloadBusy=true;
    try{
      var pid=projectId(),oid=outputId(),downloadUrl="";
      if(pid){downloadUrl="/api/ad-film/seedance/download?projectId="+encodeURIComponent(pid);if(oid)downloadUrl+="&outputId="+encodeURIComponent(oid)}
      var response=null;
      if(downloadUrl)response=await fetch(downloadUrl,{method:"GET",credentials:"include",cache:"no-store"});
      if(!response||!response.ok){
        var direct=clean(video&&video.currentSrc||video&&video.src||currentVideoUrl());
        if(!direct)throw new Error("missing_video_url");
        response=await fetch(direct,{method:"GET",cache:"no-store",mode:"cors"});
      }
      if(!response.ok)throw new Error("download_failed_"+response.status);
      var blob=await response.blob();if(!blob||!blob.size)throw new Error("empty_download");
      triggerBlobDownload(blob,"aivo-reklam-filmi.mp4");toast(t("downloaded"),"success");
    }catch(error){console.error("[ADFILM] download failed",error);toast(t("downloadFailed"),"error")}
    finally{downloadBusy=false}
  }

  async function removeVideo(){
    if(!window.confirm(t("removeConfirm")))return;
    var pid=projectId(),oid=outputId();
    try{
      if(pid){
        var url="/api/ad-film/seedance/result?projectId="+encodeURIComponent(pid);if(oid)url+="&outputId="+encodeURIComponent(oid);
        var response=await fetch(url,{method:"DELETE",credentials:"include",cache:"no-store"});
        var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||"remove_failed");
        if(data.project){window.AIVOAdFilmActiveProject=data.project;document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project}}))}
      }
      clearPlayer(true);
    }catch(error){console.error("[ADFILM] remove generated video",error);toast(t("removeFailed"),"error")}
  }

  function syncPlay(video,toolbar){var node=toolbar&&toolbar.querySelector('[data-result-action="play"]');if(!node)return;var paused=video.paused;node.title=paused?t("play"):t("pause");node.setAttribute("aria-label",node.title);node.innerHTML=icon(paused?"play":"pause")+"<span>"+node.title+"</span>"}
  function syncMute(video,toolbar){var node=toolbar&&toolbar.querySelector('[data-result-action="mute"]');if(!node)return;node.title=video.muted?t("unmute"):t("mute");node.setAttribute("aria-label",node.title);node.innerHTML=icon(video.muted?"muted":"volume")+"<span>"+node.title+"</span>"}

  function enhance(video){
    if(!video)return;
    video.controls=true;video.playsInline=true;video.preload="metadata";video.removeAttribute("autoplay");
    var target=video.closest("[data-panel-frame]")||video.parentElement;if(!target)return;
    target.classList.add("has-result-video");ensureLogo(target,currentLogoUrl());
    target.querySelectorAll("[data-adfilm-result-actions-row]").forEach(function(node){node.remove()});
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

  function videoForControl(node){var target=node&&node.closest("[data-panel-frame]");return target&&target.querySelector("video[data-adfilm-result-video]")}
  function enterFullscreen(video){
    if(!video)return;
    try{if(video.requestFullscreen){var result=video.requestFullscreen({navigationUI:"hide"});if(result&&result.catch)result.catch(function(){})}else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();else if(video.webkitRequestFullscreen)video.webkitRequestFullscreen()}catch(_){}
  }
  function toggleMuteWithoutRestart(video){
    if(!video)return;var time=Number(video.currentTime)||0,wasPlaying=!video.paused&&!video.ended;video.muted=!video.muted;
    requestAnimationFrame(function(){if(Math.abs((Number(video.currentTime)||0)-time)>.35){try{video.currentTime=time}catch(_){}}if(wasPlaying&&video.paused)video.play().catch(function(){})});
  }

  function handleToolbarAction(event){
    var node=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-result-toolbar] [data-result-action]');
    if(!node)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    var video=videoForControl(node);if(!video)return;var action=node.dataset.resultAction;
    if(action==="play"){if(video.paused)video.play().catch(function(){});else video.pause()}
    else if(action==="download")downloadVideo(video);
    else if(action==="mute")toggleMuteWithoutRestart(video);
    else if(action==="fullscreen")enterFullscreen(video);
    else if(action==="remove")removeVideo();
  }

  function mount(url,logo,options){
    if(isPreparing()){clearPlayer(false);return null}
    url=clean(url||currentVideoUrl());logo=clean(logo||currentLogoUrl());if(!url){clearPlayer(false);return null}
    remember(url,logo);var target=frame();if(!target)return null;var media=target.querySelector("[data-panel-media]");if(!media)return null;
    var video=media.querySelector("video[data-adfilm-result-video]");if(!video){video=document.createElement("video");video.setAttribute("data-adfilm-result-video","");media.appendChild(video)}
    if(!sameUrl(video.currentSrc||video.src,url)){try{video.pause()}catch(_){}video.src=url;try{video.load()}catch(_){}}
    media.classList.add("has-media","has-result-video");target.classList.add("has-result-video");ensureLogo(target,logo);enhance(video);
    if(options&&options.play){video.muted=false;video.play().catch(function(){})}
    return video;
  }

  function restore(){
    clearTimeout(restoreTimer);restoreTimer=setTimeout(function(){if(document.fullscreenElement)return;var panel=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');if(!panel||!panel.isConnected)return;var url=currentVideoUrl();if(!url){clearPlayer(false);return}mount(url,currentLogoUrl())},120);
  }

  document.addEventListener("click",handleToolbarAction,true);
  document.addEventListener("click",function(event){var play=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] .adfilm-preview-play');if(!play||!currentVideoUrl())return;event.preventDefault();event.stopImmediatePropagation();mount(currentVideoUrl(),currentLogoUrl(),{play:true})},true);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(restore,300)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){var next=event&&event.detail&&event.detail.project;if(next&&next.preparingNewVersion){clearPlayer(false);return}if(next&&next.generation)remember(next.generation.videoUrl,next.media&&next.media.logo&&next.media.logo.url||next.generation.logoUrl);setTimeout(restore,150)});
  window.addEventListener("pageshow",restore);
  var observer=new MutationObserver(function(records){var shouldRestore=false;records.forEach(function(record){record.addedNodes.forEach(function(node){if(node.nodeType!==1)return;if(node.matches&&node.matches('.adfilm-live-card,.adfilm-side-preview')||node.querySelector&&node.querySelector('.adfilm-live-card,.adfilm-side-preview'))shouldRestore=true})});if(shouldRestore)restore()});
  observer.observe(document.documentElement,{subtree:true,childList:true});

  window.AIVOAdFilmResultControls={mount:mount,restore:restore,clear:clearPlayer,download:downloadVideo,videoUrl:currentVideoUrl,logoUrl:currentLogoUrl};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",restore,{once:true});else restore();
})();
