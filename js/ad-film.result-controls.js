/* AIVO AI Reklam Filmi — single stable live-player controller */
(function AIVO_AD_FILM_RESULT_CONTROLS(){
  "use strict";
  if(window.__AIVO_AD_FILM_RESULT_CONTROLS_V7__)return;
  window.__AIVO_AD_FILM_RESULT_CONTROLS_V7__=true;

  var COPY={
    tr:{play:"Oynat",pause:"Duraklat",download:"İndir",downloadStarted:"İndirme başlatıldı.",fullscreen:"Tam ekran",mute:"Sesi kapat",unmute:"Sesi aç",remove:"Sil",removeConfirm:"Bu reklam sürümünü silmek istiyor musun?",removeFailed:"Reklam sürümü silinemedi.",downloadFailed:"Video indirilemedi."},
    en:{play:"Play",pause:"Pause",download:"Download",downloadStarted:"Download started.",fullscreen:"Fullscreen",mute:"Mute",unmute:"Unmute",remove:"Delete",removeConfirm:"Delete this advertising version?",removeFailed:"The advertising version could not be deleted.",downloadFailed:"The video could not be downloaded."}
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
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function isPreparing(source){source=source||project();return!!(source&&source.preparingNewVersion)}
  function outputsOf(source){
    source=source||project()||{};
    var outputs=Array.isArray(source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[];
    if(!outputs.length&&source.generation&&clean(source.generation.videoUrl)){
      outputs=[{
        id:source.generation.outputId||source.generation.requestId||"legacy-output",
        version:source.generation.version||1,
        videoUrl:source.generation.videoUrl,
        logoUrl:source.generation.logoUrl||source.media&&source.media.logo&&source.media.logo.url||""
      }];
    }
    return outputs;
  }
  function activeOutput(source){
    source=source||project()||{};
    var outputs=outputsOf(source);
    var id=clean(window.AIVOAdFilmActiveOutputId||source.activeOutputId||source.generation&&source.generation.outputId);
    return outputs.find(function(item){return clean(item.id)===id})||outputs[0]||null;
  }
  function projectId(){
    var root=document.querySelector('[data-module-root][data-module="adfilm"]');
    return clean(root&&root.dataset.adfilmProjectId||project()&&project().id||window.AIVOAdFilmActiveOutputProjectId);
  }
  function outputId(){var item=activeOutput();return clean(item&&item.id||window.AIVOAdFilmActiveOutputId)}
  function currentVideoUrl(){
    var source=project();
    if(isPreparing(source))return"";
    var item=activeOutput(source);
    return clean(item&&item.videoUrl||source&&source.generation&&source.generation.videoUrl||lastVideoUrl);
  }
  function currentLogoUrl(){
    var source=project();
    if(isPreparing(source))return"";
    var item=activeOutput(source);
    return clean(item&&item.logoUrl||source&&source.media&&source.media.logo&&source.media.logo.url||source&&source.generation&&source.generation.logoUrl||lastLogoUrl);
  }
  function remember(url,logo,id){
    if(clean(url)){lastVideoUrl=clean(url);window.AIVOAdFilmGeneratedVideo=lastVideoUrl}
    if(clean(logo)){lastLogoUrl=clean(logo);window.AIVOAdFilmGeneratedLogo=lastLogoUrl}
    if(clean(id))window.AIVOAdFilmActiveOutputId=clean(id);
  }
  function toast(message,type){
    try{
      if(window.toast&&typeof window.toast[type||"info"]==="function")return window.toast[type||"info"](message);
      if(typeof window.showToast==="function")return window.showToast(message,type||"info");
    }catch(_){}
  }
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
    if(forget!==false){
      lastVideoUrl="";lastLogoUrl="";
      window.AIVOAdFilmGeneratedVideo="";
      window.AIVOAdFilmGeneratedLogo="";
      window.AIVOAdFilmActiveOutputId="";
    }
  }

  function downloadOutput(id,version){
    if(downloadBusy)return;
    var pid=projectId();
    if(!pid){toast(t("downloadFailed"),"error");return}
    downloadBusy=true;
    try{
      var url="/api/ad-film/seedance/download?projectId="+encodeURIComponent(pid);
      if(clean(id))url+="&outputId="+encodeURIComponent(clean(id));
      var anchor=document.createElement("a");
      anchor.href=url;
      anchor.download="aivo-reklam-v"+(Number(version)||1)+".mp4";
      anchor.rel="noopener";
      anchor.style.display="none";
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(function(){anchor.remove();downloadBusy=false},1200);
      toast(t("downloadStarted"),"success");
    }catch(error){
      downloadBusy=false;
      console.error("[ADFILM] download failed",error);
      toast(t("downloadFailed"),"error");
    }
  }
  function downloadVideo(){var item=activeOutput();downloadOutput(item&&item.id,item&&item.version)}

  async function removeVideo(){
    if(!window.confirm(t("removeConfirm")))return;
    var source=project(),item=activeOutput(source),pid=projectId(),oid=clean(item&&item.id||outputId());
    try{
      if(!pid)throw new Error("missing_project_id");
      var url="/api/ad-film/seedance/result?projectId="+encodeURIComponent(pid);if(oid)url+="&outputId="+encodeURIComponent(oid);
      var response=await fetch(url,{method:"DELETE",credentials:"include",cache:"no-store"});
      var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||"remove_failed");
      var next=data.project||source||{};
      window.AIVOAdFilmActiveProject=next;
      var nextItem=activeOutput(next);
      if(nextItem){
        remember(nextItem.videoUrl,nextItem.logoUrl||next.media&&next.media.logo&&next.media.logo.url||"",nextItem.id);
        mount(nextItem.videoUrl,nextItem.logoUrl||"",{});
      }else clearPlayer(true);
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:next,projectId:next.id||"",media:next.media||{}}}));
      if(window.AIVOAdFilmOutputGallery&&typeof window.AIVOAdFilmOutputGallery.render==="function")window.AIVOAdFilmOutputGallery.render(next);
    }catch(error){console.error("[ADFILM] remove generated video",error);toast(t("removeFailed"),"error")}
  }

  function syncPlay(video,toolbar){
    var node=toolbar&&toolbar.querySelector('[data-result-action="play"]');if(!node)return;
    var paused=video.paused;
    node.title=paused?t("play"):t("pause");
    node.setAttribute("aria-label",node.title);
    node.innerHTML=icon(paused?"play":"pause")+"<span>"+node.title+"</span>";
  }
  function syncMute(video,toolbar){
    var node=toolbar&&toolbar.querySelector('[data-result-action="mute"]');if(!node)return;
    node.title=video.muted?t("unmute"):t("mute");
    node.setAttribute("aria-label",node.title);
    node.innerHTML=icon(video.muted?"muted":"volume")+"<span>"+node.title+"</span>";
  }
  function enterFullscreen(video){
    if(!video)return;
    try{
      if(document.fullscreenElement&&document.exitFullscreen){document.exitFullscreen();return}
      if(video.requestFullscreen){var promise=video.requestFullscreen();if(promise&&promise.catch)promise.catch(function(){})}
      else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();
      else if(video.webkitRequestFullscreen)video.webkitRequestFullscreen();
    }catch(_){}
  }
  function videoForControl(node){var target=node&&node.closest("[data-panel-frame]");return target&&target.querySelector("video[data-adfilm-result-video]")}
  function handleToolbarAction(event){
    var node=event.target&&event.target.closest&&event.target.closest("[data-result-action]");
    if(!node)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    var video=videoForControl(node);if(!video)return;
    var action=node.dataset.resultAction;
    if(action==="play"){if(video.paused)video.play().catch(function(){});else video.pause()}
    else if(action==="download")downloadVideo();
    else if(action==="mute")video.muted=!video.muted;
    else if(action==="fullscreen")enterFullscreen(video);
    else if(action==="remove")removeVideo();
  }

  function enhance(video){
    if(!video)return;
    video.controls=false;
    video.playsInline=true;
    video.setAttribute("playsinline","");
    video.setAttribute("webkit-playsinline","");
    video.preload="metadata";
    video.removeAttribute("autoplay");
    var target=video.closest("[data-panel-frame]")||video.parentElement;if(!target)return;
    target.classList.add("has-result-video");
    ensureLogo(target,currentLogoUrl());
    target.querySelectorAll("[data-adfilm-result-actions-row]").forEach(function(node){node.remove()});
    var toolbar=target.querySelector("[data-adfilm-result-toolbar]");
    if(!toolbar){
      toolbar=document.createElement("div");
      toolbar.className="adfilm-result-toolbar";
      toolbar.setAttribute("data-adfilm-result-toolbar","");
      toolbar.appendChild(button("play",t("play"),"play"));
      toolbar.appendChild(button("download",t("download"),"download"));
      toolbar.appendChild(button("mute",video.muted?t("unmute"):t("mute"),video.muted?"muted":"volume"));
      toolbar.appendChild(button("fullscreen",t("fullscreen"),"fullscreen"));
      toolbar.appendChild(button("remove",t("remove"),"trash",true));
      toolbar.addEventListener("click",handleToolbarAction,false);
      target.appendChild(toolbar);
    }
    if(video.dataset.resultEventsReady!=="1"){
      video.dataset.resultEventsReady="1";
      video.addEventListener("play",function(){syncPlay(video,toolbar)});
      video.addEventListener("pause",function(){syncPlay(video,toolbar)});
      video.addEventListener("ended",function(){syncPlay(video,toolbar)});
      video.addEventListener("volumechange",function(){syncMute(video,toolbar)});
      video.addEventListener("click",function(event){
        event.preventDefault();event.stopPropagation();
        if(video.paused)video.play().catch(function(){});else video.pause();
      });
    }
    syncPlay(video,toolbar);syncMute(video,toolbar);
  }

  function mount(url,logo,options){
    if(isPreparing()){clearPlayer(false);return null}
    url=clean(url||currentVideoUrl());logo=clean(logo||currentLogoUrl());
    if(!url){clearPlayer(false);return null}
    var item=activeOutput();
    remember(url,logo,item&&item.id);
    var target=frame();if(!target)return null;
    var media=target.querySelector("[data-panel-media]");if(!media)return null;
    var video=media.querySelector("video[data-adfilm-result-video]");
    if(!video){
      video=document.createElement("video");
      video.setAttribute("data-adfilm-result-video","");
      media.appendChild(video);
    }
    if(!sameUrl(video.currentSrc||video.src,url)){
      try{video.pause()}catch(_){}
      video.src=url;
      try{video.load()}catch(_){}
    }
    media.classList.add("has-media","has-result-video");
    target.classList.add("has-result-video");
    ensureLogo(target,logo);
    enhance(video);
    if(options&&options.play)video.play().catch(function(){});
    return video;
  }

  function syncFromProject(source){
    source=source||project();
    if(source)window.AIVOAdFilmActiveProject=source;
    if(!source||isPreparing(source)){clearPlayer(false);return}
    var item=activeOutput(source);
    if(!item){clearPlayer(false);return}
    var logo=clean(item.logoUrl||source.media&&source.media.logo&&source.media.logo.url||source.generation&&source.generation.logoUrl||"");
    remember(item.videoUrl,logo,item.id);
    mount(item.videoUrl,logo,{});
  }
  function restore(delay){
    clearTimeout(restoreTimer);
    restoreTimer=setTimeout(function(){
      var panel=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');
      if(!panel||!panel.isConnected)return;
      syncFromProject(project());
    },delay==null?80:delay);
  }

  document.addEventListener("click",function(event){
    var play=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] .adfilm-preview-play');
    if(!play||!currentVideoUrl())return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    mount(currentVideoUrl(),currentLogoUrl(),{play:true});
  },true);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")restore(240)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){syncFromProject(event&&event.detail&&event.detail.project||project())});
  window.addEventListener("pageshow",function(){restore(80)});

  window.AIVOAdFilmResultControls={
    mount:mount,
    restore:restore,
    clear:clearPlayer,
    download:downloadVideo,
    downloadOutput:downloadOutput,
    fullscreen:enterFullscreen,
    videoUrl:currentVideoUrl,
    logoUrl:currentLogoUrl,
    activeOutput:activeOutput
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){restore(120)},{once:true});else restore(120);
})();
