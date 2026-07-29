/* AIVO AI Reklam Filmi — stable native player + safe result actions */
(function AIVO_AD_FILM_RESULT_CONTROLS(){
  "use strict";
  if(window.__AIVO_AD_FILM_RESULT_CONTROLS_V5__)return;
  window.__AIVO_AD_FILM_RESULT_CONTROLS_V5__=true;

  var COPY={
    tr:{download:"Videoyu indir",remove:"Videoyu sil",removeConfirm:"Oluşturulan videoyu bu projeden kaldırmak istiyor musun?",removeFailed:"Video kaldırılamadı.",downloadFailed:"Video indirilemedi.",downloaded:"Video indirildi."},
    en:{download:"Download video",remove:"Delete video",removeConfirm:"Remove the generated video from this project?",removeFailed:"The video could not be removed.",downloadFailed:"The video could not be downloaded.",downloaded:"Video downloaded."}
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
  function activeProjectId(){
    var root=document.querySelector('[data-module-root][data-module="adfilm"]');
    return clean(root&&root.dataset.adfilmProjectId||activeProject()&&activeProject().id||window.AIVOAdFilmActiveOutputProjectId);
  }
  function activeOutputId(){
    var project=activeProject();
    return clean(window.AIVOAdFilmActiveOutputId||project&&project.activeOutputId||project&&project.generation&&project.generation.outputId);
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
    return clean(window.AIVOAdFilmGeneratedLogo||project&&project.media&&project.media.logo&&project.media.logo.url||project&&project.generation&&project.generation.logoUrl||lastLogoUrl);
  }
  function remember(url,logo){
    if(isPreparing())return;
    if(clean(url)){lastVideoUrl=clean(url);window.AIVOAdFilmGeneratedVideo=lastVideoUrl}
    if(clean(logo)){lastLogoUrl=clean(logo);window.AIVOAdFilmGeneratedLogo=lastLogoUrl}
  }
  function toast(message,type){
    try{
      if(window.toast&&typeof window.toast[type||"info"]==="function")return window.toast[type||"info"](message);
      if(typeof window.showToast==="function")return window.showToast(message,type||"info");
    }catch(_){}
  }
  function icon(name){
    var paths={
      download:'<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      trash:'<path d="M5 7h14M9 7V4h6v3M8 10v8m4-8v8m4-8v8M7 7l1 14h8l1-14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.download)+'</svg>';
  }
  function frame(){return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"] [data-panel-frame]')}
  function sameUrl(a,b){
    try{return new URL(a,location.href).href===new URL(b,location.href).href}catch(_){return clean(a)===clean(b)}
  }
  function safeName(value){
    return clean(value||"aivo-reklam-filmi").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"aivo-reklam-filmi";
  }

  function ensureLogo(target,url){
    var old=target.querySelector("[data-adfilm-result-logo]");
    if(!url){if(old)old.remove();return}
    if(!old){old=document.createElement("div");old.className="adfilm-result-logo";old.setAttribute("data-adfilm-result-logo","");target.appendChild(old)}
    old.style.backgroundImage='url("'+String(url).replace(/"/g,"%22")+'")';
  }

  function removeLegacyToolbar(target){
    if(!target)return;
    target.querySelectorAll("[data-adfilm-result-toolbar],.adfilm-result-toolbar").forEach(function(node){node.remove()});
  }

  function ensureActionRow(target){
    var card=target&&target.closest(".adfilm-live-card");
    if(!card)return null;
    var row=card.querySelector("[data-adfilm-result-actions-row]");
    if(!row){
      row=document.createElement("div");
      row.className="adfilm-result-actions-row";
      row.setAttribute("data-adfilm-result-actions-row","");
      row.innerHTML=
        '<button type="button" class="adfilm-result-action" data-adfilm-live-action="download">'+icon("download")+'<span>'+t("download")+'</span></button>'+ 
        '<button type="button" class="adfilm-result-action is-danger" data-adfilm-live-action="remove">'+icon("trash")+'<span>'+t("remove")+'</span></button>';
      target.insertAdjacentElement("afterend",row);
    }else{
      var downloadLabel=row.querySelector('[data-adfilm-live-action="download"] span');
      var removeLabel=row.querySelector('[data-adfilm-live-action="remove"] span');
      if(downloadLabel)downloadLabel.textContent=t("download");
      if(removeLabel)removeLabel.textContent=t("remove");
    }
    return row;
  }

  function clearPlayer(forget){
    clearTimeout(restoreTimer);
    var target=frame();
    if(target){
      target.querySelectorAll("video[data-adfilm-result-video]").forEach(function(video){try{video.pause()}catch(_){}video.remove()});
      removeLegacyToolbar(target);
      var logo=target.querySelector("[data-adfilm-result-logo]");if(logo)logo.remove();
      var media=target.querySelector("[data-panel-media]");if(media)media.classList.remove("has-result-video");
      target.classList.remove("has-result-video");
      var card=target.closest(".adfilm-live-card");
      var row=card&&card.querySelector("[data-adfilm-result-actions-row]");if(row)row.remove();
    }
    if(forget!==false){
      lastVideoUrl="";lastLogoUrl="";
      window.AIVOAdFilmGeneratedVideo="";window.AIVOAdFilmGeneratedLogo="";
    }
  }

  async function downloadResult(projectId,outputId,filename){
    projectId=clean(projectId||activeProjectId());
    outputId=clean(outputId||activeOutputId());
    if(!projectId||downloadBusy)return false;
    downloadBusy=true;
    try{
      var url="/api/ad-film/seedance/download?projectId="+encodeURIComponent(projectId);
      if(outputId)url+="&outputId="+encodeURIComponent(outputId);
      var response=await fetch(url,{method:"GET",credentials:"include",cache:"no-store",headers:{Accept:"video/mp4,video/*;q=0.9,*/*;q=0.1"}});
      if(!response.ok)throw new Error("download_failed_"+response.status);
      var blob=await response.blob();
      if(!blob||!blob.size)throw new Error("empty_download");
      var objectUrl=URL.createObjectURL(blob);
      var anchor=document.createElement("a");
      anchor.href=objectUrl;
      anchor.download=safeName(filename||"aivo-reklam-filmi")+".mp4";
      anchor.rel="noopener";
      anchor.style.display="none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(function(){URL.revokeObjectURL(objectUrl)},1500);
      toast(t("downloaded"),"success");
      return true;
    }catch(error){
      console.error("[ADFILM] download failed",error);
      toast(t("downloadFailed"),"error");
      return false;
    }finally{
      downloadBusy=false;
    }
  }

  async function removeResult(projectId,outputId){
    if(!window.confirm(t("removeConfirm")))return false;
    projectId=clean(projectId||activeProjectId());
    outputId=clean(outputId||activeOutputId());
    try{
      if(projectId){
        var url="/api/ad-film/seedance/result?projectId="+encodeURIComponent(projectId);
        if(outputId)url+="&outputId="+encodeURIComponent(outputId);
        var response=await fetch(url,{method:"DELETE",credentials:"include",cache:"no-store"});
        var data=await response.json().catch(function(){return{}});
        if(!response.ok)throw new Error(data.error||"remove_failed");
        if(data.project){
          window.AIVOAdFilmActiveProject=data.project;
          document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project}}));
        }
      }
      clearPlayer(true);
      return true;
    }catch(error){
      console.error("[ADFILM] remove generated video",error);
      toast(t("removeFailed"),"error");
      return false;
    }
  }

  function fullscreenVideo(video){
    if(!video)return false;
    try{
      video.controls=true;
      if(document.fullscreenElement&&document.exitFullscreen){document.exitFullscreen();return true}
      if(video.requestFullscreen){var result=video.requestFullscreen();if(result&&result.catch)result.catch(function(){});return true}
      if(video.webkitEnterFullscreen){video.webkitEnterFullscreen();return true}
      if(video.webkitRequestFullscreen){video.webkitRequestFullscreen();return true}
    }catch(error){console.warn("[ADFILM] fullscreen failed",error)}
    return false;
  }

  function enhance(video){
    if(!video)return;
    video.controls=true;
    video.playsInline=true;
    video.preload="metadata";
    video.removeAttribute("autoplay");
    video.setAttribute("controlsList","nodownload");
    var target=video.closest("[data-panel-frame]")||video.parentElement;
    if(!target)return;
    removeLegacyToolbar(target);
    target.classList.add("has-result-video");
    ensureLogo(target,currentLogoUrl());
    ensureActionRow(target);
  }

  function mount(url,logo,options){
    if(isPreparing()){clearPlayer(false);return null}
    url=clean(url||currentVideoUrl());
    logo=clean(logo||currentLogoUrl());
    if(!url){clearPlayer(false);return null}
    remember(url,logo);
    var target=frame();if(!target)return null;
    var media=target.querySelector("[data-panel-media]");if(!media)return null;
    removeLegacyToolbar(target);
    var video=media.querySelector("video[data-adfilm-result-video]");
    if(!video){
      video=document.createElement("video");
      video.setAttribute("data-adfilm-result-video","");
      media.appendChild(video);
    }
    var changed=!sameUrl(video.currentSrc||video.src,url);
    if(changed){
      try{video.pause()}catch(_){}
      video.src=url;
      try{video.load()}catch(_){}
    }
    media.classList.add("has-media","has-result-video");
    target.classList.add("has-result-video");
    ensureLogo(target,logo);
    enhance(video);
    if(options&&options.play){
      video.muted=false;
      video.play().catch(function(){});
    }
    return video;
  }

  function restore(){
    clearTimeout(restoreTimer);
    restoreTimer=setTimeout(function(){
      if(document.fullscreenElement)return;
      var panel=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');
      if(!panel||!panel.isConnected)return;
      var url=currentVideoUrl();
      if(!url){clearPlayer(false);return}
      mount(url,currentLogoUrl());
    },120);
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-adfilm-result-actions-row] [data-adfilm-live-action]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    var action=button.dataset.adfilmLiveAction;
    if(action==="download")downloadResult(activeProjectId(),activeOutputId());
    else if(action==="remove")removeResult(activeProjectId(),activeOutputId());
  },true);

  document.addEventListener("click",function(event){
    var play=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] .adfilm-preview-play');
    if(!play||!currentVideoUrl())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    mount(currentVideoUrl(),currentLogoUrl(),{play:true});
  },true);

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(restore,280);
  });
  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var nextProject=event&&event.detail&&event.detail.project;
    if(nextProject&&nextProject.preparingNewVersion){clearPlayer(false);return}
    if(nextProject&&nextProject.generation){
      remember(nextProject.generation.videoUrl,nextProject.media&&nextProject.media.logo&&nextProject.media.logo.url||nextProject.generation.logoUrl);
    }
    setTimeout(restore,160);
  });

  var observer=new MutationObserver(function(records){
    var shouldRestore=false;
    records.forEach(function(record){record.addedNodes.forEach(function(node){
      if(node.nodeType!==1)return;
      if(node.matches&&node.matches(".adfilm-side-preview,.adfilm-live-card"))shouldRestore=true;
      else if(node.querySelector&&node.querySelector(".adfilm-side-preview,.adfilm-live-card"))shouldRestore=true;
    })});
    if(shouldRestore)restore();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});

  window.AIVOAdFilmResultControls={
    mount:mount,
    restore:restore,
    clear:clearPlayer,
    download:downloadResult,
    remove:removeResult,
    fullscreen:fullscreenVideo,
    videoUrl:currentVideoUrl,
    logoUrl:currentLogoUrl
  };

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",restore,{once:true});
  else restore();
})();
