/* AIVO AI Reklam Filmi — single stable live-player controller */
(function AIVO_AD_FILM_RESULT_CONTROLS(){
  "use strict";
  if(window.__AIVO_AD_FILM_RESULT_CONTROLS_V9__)return;
  window.__AIVO_AD_FILM_RESULT_CONTROLS_V9__=true;

  var COPY={
    tr:{play:"Oynat",pause:"Duraklat",download:"İndir",downloadStarted:"İndirme başlatıldı.",fullscreen:"Tam ekran",mute:"Sesi kapat",unmute:"Sesi aç",remove:"Sil",removeConfirm:"Bu reklam sürümünü silmek istiyor musun?",removeFailed:"Reklam sürümü silinemedi.",downloadFailed:"Video indirilemedi."},
    en:{play:"Play",pause:"Pause",download:"Download",downloadStarted:"Download started.",fullscreen:"Fullscreen",mute:"Mute",unmute:"Unmute",remove:"Delete",removeConfirm:"Delete this advertising version?",removeFailed:"The advertising version could not be deleted.",downloadFailed:"The video could not be downloaded."}
  };

  var restoreTimer=null;
  var downloadBusy=false;
  var previewContext=null;

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return(COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key}
  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function outputsOf(source){
    source=source||{};
    var outputs=Array.isArray(source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[];
    if(!outputs.length&&source.generation&&clean(source.generation.videoUrl)){
      outputs=[{
        id:source.generation.outputId||source.generation.requestId||"legacy-output",
        version:source.generation.version||1,
        videoUrl:source.generation.videoUrl,
        sourceVideoUrl:source.generation.sourceVideoUrl||"",
        logoUrl:source.generation.logoUrl||source.media&&source.media.logo&&source.media.logo.url||"",
        logoApplied:!!source.generation.logoApplied
      }];
    }
    return outputs;
  }
  function activeOutput(source){
    source=source||project()||{};
    var outputs=outputsOf(source);
    var id=clean(source.activeOutputId||source.generation&&source.generation.outputId||window.AIVOAdFilmActiveOutputId);
    return outputs.find(function(item){return clean(item.id)===id})||outputs[0]||null;
  }
  function contextFromProject(source){
    source=source||project();
    if(!source||source.preparingNewVersion)return null;
    var item=activeOutput(source);if(!item)return null;
    return{
      url:clean(item.videoUrl),
      logo:clean(item.logoUrl||source.media&&source.media.logo&&source.media.logo.url||source.generation&&source.generation.logoUrl||""),
      logoApplied:!!(item.logoApplied||source.generation&&source.generation.logoApplied),
      projectId:clean(source.id),
      outputId:clean(item.id),
      version:Number(item.version)||1,
      source:"project"
    };
  }
  function normalizeContext(url,logo,options){
    options=options||{};
    var source=project()||{};
    var item=activeOutput(source);
    return{
      url:clean(url),
      logo:clean(logo),
      logoApplied:options.logoApplied===true||!!(item&&item.logoApplied)||!!(source.generation&&source.generation.logoApplied),
      projectId:clean(options.projectId||source.id||window.AIVOAdFilmActiveOutputProjectId),
      outputId:clean(options.outputId||item&&item.id||window.AIVOAdFilmActiveOutputId),
      version:Number(options.version||item&&item.version)||1,
      source:clean(options.source||"explicit")
    };
  }
  function setContext(context){
    if(!context||!clean(context.url))return null;
    previewContext={
      url:clean(context.url),
      logo:clean(context.logo),
      logoApplied:context.logoApplied===true,
      projectId:clean(context.projectId),
      outputId:clean(context.outputId),
      version:Number(context.version)||1,
      source:clean(context.source||"explicit")
    };
    window.AIVOAdFilmGeneratedVideo=previewContext.url;
    window.AIVOAdFilmGeneratedLogo=previewContext.logo;
    window.AIVOAdFilmActiveOutputProjectId=previewContext.projectId;
    window.AIVOAdFilmActiveOutputId=previewContext.outputId;
    return previewContext;
  }
  function currentContext(){return previewContext||contextFromProject(project())}
  function projectId(){
    var context=currentContext();
    var root=document.querySelector('[data-module-root][data-module="adfilm"]');
    return clean(context&&context.projectId||root&&root.dataset.adfilmProjectId||project()&&project().id||window.AIVOAdFilmActiveOutputProjectId);
  }
  function outputId(){var context=currentContext();return clean(context&&context.outputId||window.AIVOAdFilmActiveOutputId)}
  function currentVideoUrl(){var context=currentContext();return clean(context&&context.url)}
  function currentLogoUrl(){var context=currentContext();return clean(context&&context.logo)}
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

  function clearDom(){
    clearTimeout(restoreTimer);
    var target=frame();
    if(!target)return;
    target.querySelectorAll("video[data-adfilm-result-video]").forEach(function(video){try{video.pause()}catch(_){}video.remove()});
    target.querySelectorAll("[data-adfilm-result-toolbar],.adfilm-result-toolbar,[data-adfilm-result-actions-row]").forEach(function(node){node.remove()});
    var logo=target.querySelector("[data-adfilm-result-logo]");if(logo)logo.remove();
    var media=target.querySelector("[data-panel-media]");if(media)media.classList.remove("has-result-video");
    target.classList.remove("has-result-video");
  }
  function clearPlayer(forget){
    clearDom();
    if(forget!==false){
      previewContext=null;
      window.AIVOAdFilmGeneratedVideo="";
      window.AIVOAdFilmGeneratedLogo="";
      window.AIVOAdFilmActiveOutputProjectId="";
      window.AIVOAdFilmActiveOutputId="";
    }
  }

  function downloadOutput(id,version,requestedProjectId){
    if(downloadBusy)return;
    var pid=clean(requestedProjectId||projectId());
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
  function downloadVideo(){var context=currentContext();downloadOutput(context&&context.outputId,context&&context.version,context&&context.projectId)}

  async function removeVideo(){
    var context=currentContext();
    if(!context||!window.confirm(t("removeConfirm")))return;
    var pid=clean(context.projectId||projectId()),oid=clean(context.outputId||outputId());
    try{
      if(!pid)throw new Error("missing_project_id");
      var url="/api/ad-film/seedance/result?projectId="+encodeURIComponent(pid);if(oid)url+="&outputId="+encodeURIComponent(oid);
      var response=await fetch(url,{method:"DELETE",credentials:"include",cache:"no-store"});
      var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||"remove_failed");
      var activeProject=project();
      if(activeProject&&clean(activeProject.id)===pid){
        var next=data.project||activeProject;
        window.AIVOAdFilmActiveProject=next;
        previewContext=null;
        var nextContext=contextFromProject(next);
        if(nextContext){setContext(nextContext);renderContext(nextContext,false)}else clearPlayer(true);
        document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:next,projectId:next.id||"",media:next.media||{}}}));
      }else{
        clearPlayer(true);
        document.dispatchEvent(new CustomEvent("aivo:adfilm-history-refresh"));
      }
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

  function enhance(video,context){
    if(!video)return;
    video.controls=false;
    video.playsInline=true;
    video.setAttribute("playsinline","");
    video.setAttribute("webkit-playsinline","");
    video.preload="metadata";
    video.removeAttribute("autoplay");
    var target=video.closest("[data-panel-frame]")||video.parentElement;if(!target)return;
    target.classList.add("has-result-video");
    ensureLogo(target,context&&context.logoApplied?"":context&&context.logo||"");
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

  function renderContext(context,play){
    if(!context||!clean(context.url)){clearDom();return null}
    var target=frame();if(!target)return null;
    var media=target.querySelector("[data-panel-media]");if(!media)return null;
    var video=media.querySelector("video[data-adfilm-result-video]");
    if(!video){
      video=document.createElement("video");
      video.setAttribute("data-adfilm-result-video","");
      media.appendChild(video);
    }
    if(!sameUrl(video.currentSrc||video.src,context.url)){
      try{video.pause()}catch(_){}
      video.src=context.url;
      try{video.load()}catch(_){}
    }
    media.classList.add("has-media","has-result-video");
    target.classList.add("has-result-video");
    enhance(video,context);
    if(play)video.play().catch(function(){});
    return video;
  }

  function mount(url,logo,options){
    options=options||{};
    var context=null;
    if(clean(url))context=setContext(normalizeContext(url,logo,options));
    else context=currentContext();
    if(!context){clearDom();return null}
    return renderContext(context,!!options.play);
  }

  function syncFromProject(source){
    source=source||project();
    if(source)window.AIVOAdFilmActiveProject=source;
    var next=contextFromProject(source);
    if(next){
      previewContext=setContext(next);
      renderContext(previewContext,false);
      return;
    }
    if(previewContext&&clean(previewContext.url)){
      renderContext(previewContext,false);
      return;
    }
    clearDom();
  }
  function restore(delay){
    clearTimeout(restoreTimer);
    restoreTimer=setTimeout(function(){
      var panel=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');
      if(!panel||!panel.isConnected)return;
      var context=currentContext();
      if(context)renderContext(context,false);else clearDom();
    },delay==null?80:delay);
  }

  document.addEventListener("click",function(event){
    var play=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] .adfilm-preview-play');
    if(!play)return;
    var context=currentContext();if(!context)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    renderContext(context,true);
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
    activeOutput:activeOutput,
    context:currentContext
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){restore(120)},{once:true});else restore(120);
})();
