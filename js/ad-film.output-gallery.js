/* AIVO AI Reklam Filmi — versioned output gallery */
(function AIVO_AD_FILM_OUTPUT_GALLERY(){
  "use strict";
  if(window.__AIVO_AD_FILM_OUTPUT_GALLERY__)return;
  window.__AIVO_AD_FILM_OUTPUT_GALLERY__=true;

  var COPY={
    tr:{title:"Diğer Sürümler",video:"video",version:"Sürüm",play:"Büyük oynatıcıda aç",download:"İndir",fullscreen:"Tam ekran",remove:"Sil",removeConfirm:"Bu reklam sürümünü silmek istiyor musun?",removeFailed:"Reklam sürümü silinemedi.",selectFailed:"Video seçilemedi."},
    en:{title:"Other Versions",video:"videos",version:"Version",play:"Open in main player",download:"Download",fullscreen:"Fullscreen",remove:"Delete",removeConfirm:"Delete this advertising version?",removeFailed:"The advertising version could not be deleted.",selectFailed:"The video could not be selected."}
  };

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return(COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key}
  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function panel(){return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]')}
  function toast(message,type){try{if(window.toast&&typeof window.toast[type||"info"]==="function")return window.toast[type||"info"](message);if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }

  function outputsFromProject(source){
    source=source||project()||{};
    var outputs=Array.isArray(source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[];
    if(!outputs.length&&source.generation&&clean(source.generation.videoUrl)){
      outputs=[{
        id:source.generation.outputId||source.generation.requestId||"legacy-output",
        requestId:source.generation.requestId||null,
        version:source.generation.version||1,
        videoUrl:source.generation.videoUrl,
        logoUrl:source.generation.logoUrl||source.media&&source.media.logo&&source.media.logo.url||null,
        createdAt:source.generation.completedAt||source.generation.startedAt||source.updatedAt,
        completedAt:source.generation.completedAt||source.updatedAt,
        duration:source.generation.input&&source.generation.input.duration||source.output&&source.output.duration||"15",
        aspectRatio:source.generation.input&&source.generation.input.aspectRatio||source.output&&source.output.aspectRatio||"9:16",
        resolution:source.generation.input&&source.generation.input.resolution||source.output&&source.output.quality||"1080p",
        generateAudio:source.generation.input&&source.generation.input.generateAudio!==false
      }];
    }
    return outputs.slice().sort(function(a,b){return String(b.completedAt||b.createdAt||"").localeCompare(String(a.completedAt||a.createdAt||""))});
  }

  function activeId(source,outputs){return clean(source&&source.activeOutputId)||clean(outputs[0]&&outputs[0].id)}
  function formatDate(value){
    if(!value)return"";
    try{return new Intl.DateTimeFormat(lang()==="en"?"en-US":"tr-TR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value))}catch(_){return""}
  }
  function icon(name){
    var paths={
      play:'<path d="m9 6 9 6-9 6V6Z" fill="currentColor"/>',
      download:'<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      fullscreen:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      trash:'<path d="M5 7h14M9 7V4h6v3M8 10v8m4-8v8m4-8v8M7 7l1 14h8l1-14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';
  }

  function action(name,label){
    var button=document.createElement("button");button.type="button";button.dataset.outputAction=name;button.title=label;button.setAttribute("aria-label",label);button.innerHTML=icon(name==="open"?"play":name);return button;
  }

  function card(item,isActive){
    var article=document.createElement("article");
    article.className="adfilm-output-card"+(isActive?" is-active":"");
    article.dataset.outputId=clean(item.id);

    var media=document.createElement("div");media.className="adfilm-output-card__media";
    var video=document.createElement("video");video.src=item.videoUrl;video.preload="metadata";video.muted=true;video.playsInline=true;video.setAttribute("aria-label",t("version")+" "+(item.version||""));
    media.appendChild(video);
    var badge=document.createElement("span");badge.textContent="V"+(item.version||1);media.appendChild(badge);
    var center=action("open",t("play"));center.className="adfilm-output-card__play";media.appendChild(center);
    var tools=document.createElement("div");tools.className="adfilm-output-card__tools";tools.appendChild(action("download",t("download")));tools.appendChild(action("fullscreen",t("fullscreen")));tools.appendChild(action("trash",t("remove")));media.appendChild(tools);

    var meta=document.createElement("div");meta.className="adfilm-output-card__meta";
    var title=document.createElement("b");title.textContent=t("version")+" "+(item.version||1);
    var specs=document.createElement("small");specs.textContent=[item.duration?item.duration+" sn":"",item.aspectRatio||"",item.resolution||""].filter(Boolean).join(" · ");
    var date=document.createElement("em");date.textContent=formatDate(item.completedAt||item.createdAt);
    meta.appendChild(title);meta.appendChild(specs);meta.appendChild(date);
    article.appendChild(media);article.appendChild(meta);
    return article;
  }

  function ensureHost(){
    var wrap=panel();if(!wrap)return null;
    var live=wrap.querySelector(".adfilm-live-card");if(!live)return null;
    var host=wrap.querySelector("[data-adfilm-output-gallery]");
    if(!host){host=document.createElement("section");host.className="adfilm-output-gallery";host.setAttribute("data-adfilm-output-gallery","");live.insertAdjacentElement("afterend",host)}
    return host;
  }

  function render(source){
    source=source||project();
    var host=ensureHost();if(!host)return;
    var outputs=outputsFromProject(source);
    if(outputs.length<2){host.hidden=true;host.innerHTML="";return}
    host.hidden=false;
    var selected=activeId(source,outputs);
    host.innerHTML="";
    var head=document.createElement("div");head.className="adfilm-output-gallery__head";
    var heading=document.createElement("h3");heading.textContent=t("title");
    var count=document.createElement("span");count.textContent=outputs.length+" "+t("video");
    head.appendChild(heading);head.appendChild(count);
    var rail=document.createElement("div");rail.className="adfilm-output-gallery__rail";
    outputs.forEach(function(item){rail.appendChild(card(item,item.id===selected))});
    host.appendChild(head);host.appendChild(rail);
  }

  async function selectOutput(item,play){
    var source=project();if(!source||!item)return;
    try{
      var response=await fetch("/api/ad-film/seedance/result",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:source.id,outputId:item.id})});
      var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||"select_failed");
      if(data.project)window.AIVOAdFilmActiveProject=data.project;
      window.AIVOAdFilmGeneratedVideo=item.videoUrl;window.AIVOAdFilmGeneratedLogo=item.logoUrl||"";window.AIVOAdFilmActiveOutputId=item.id;
      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function")window.AIVOAdFilmResultControls.mount(item.videoUrl,item.logoUrl||"",{play:!!play});
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project||source}}));
      render(data.project||source);
    }catch(error){console.error("[ADFILM] select output",error);toast(t("selectFailed"),"error")}
  }

  async function removeOutput(item){
    var source=project();if(!source||!item||!window.confirm(t("removeConfirm")))return;
    try{
      var response=await fetch("/api/ad-film/seedance/result?projectId="+encodeURIComponent(source.id)+"&outputId="+encodeURIComponent(item.id),{method:"DELETE",credentials:"include"});
      var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||"remove_failed");
      if(data.project)window.AIVOAdFilmActiveProject=data.project;
      var remaining=outputsFromProject(data.project||{}),active=remaining.find(function(output){return output.id===(data.activeOutputId||data.project&&data.project.activeOutputId)})||remaining[0];
      window.AIVOAdFilmGeneratedVideo=active&&active.videoUrl||"";window.AIVOAdFilmGeneratedLogo=active&&active.logoUrl||"";window.AIVOAdFilmActiveOutputId=active&&active.id||"";
      if(active&&window.AIVOAdFilmResultControls)window.AIVOAdFilmResultControls.mount(active.videoUrl,active.logoUrl||"");
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project}}));render(data.project);
    }catch(error){console.error("[ADFILM] remove output",error);toast(t("removeFailed"),"error")}
  }

  function itemById(id){return outputsFromProject(project()).find(function(item){return item.id===id})}

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-output-gallery] [data-output-action]");if(!button)return;
    var cardNode=button.closest("[data-output-id]"),item=itemById(cardNode&&cardNode.dataset.outputId);if(!item)return;
    event.preventDefault();event.stopPropagation();
    var actionName=button.dataset.outputAction;
    if(actionName==="open")selectOutput(item,true);
    else if(actionName==="download"){
      var anchor=document.createElement("a");anchor.href=item.videoUrl;anchor.target="_blank";anchor.rel="noopener";anchor.download="aivo-reklam-v"+(item.version||1)+".mp4";document.body.appendChild(anchor);anchor.click();anchor.remove();
    }else if(actionName==="fullscreen"){
      var video=cardNode.querySelector("video");if(video&&video.requestFullscreen)video.requestFullscreen();else if(video&&video.webkitEnterFullscreen)video.webkitEnterFullscreen();
    }else if(actionName==="trash")removeOutput(item);
  },true);

  document.addEventListener("click",function(event){
    var cardNode=event.target&&event.target.closest&&event.target.closest("[data-adfilm-output-gallery] [data-output-id]");if(!cardNode||event.target.closest("[data-output-action]"))return;
    var item=itemById(cardNode.dataset.outputId);if(item)selectOutput(item,false);
  },true);

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){render(project())},450)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){setTimeout(function(){render(event&&event.detail&&event.detail.project||project())},120)});
  window.addEventListener("pageshow",function(){render(project())});

  var observer=new MutationObserver(function(){if(panel()&&!panel().querySelector("[data-adfilm-output-gallery]"))setTimeout(function(){render(project())},80)});
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.AIVOAdFilmOutputGallery={render:render,outputs:outputsFromProject};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){render(project())},{once:true});else render(project());
})();