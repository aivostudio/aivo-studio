/* AIVO AI Reklam Filmi — hazır videoları projeler arasında görünür tutar */
(function(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROJECT_HISTORY_V3__)return;
  window.__AIVO_AD_FILM_PROJECT_HISTORY_V3__=true;

  var items=[];
  var busy=false;

  function clean(v){return String(v||"").trim()}
  function lang(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0?"en":"tr"}
  function text(tr,en){return lang()==="en"?en:tr}
  function panel(){return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]')}

  function projectOutputs(project,summary){
    if(!project)return[];
    var list=Array.isArray(project.outputs)?project.outputs.filter(function(x){return x&&clean(x.videoUrl)}):[];
    if(!list.length&&project.generation&&clean(project.generation.videoUrl)){
      list=[{
        id:project.generation.outputId||project.generation.requestId||"legacy-output",
        version:project.generation.version||1,
        videoUrl:project.generation.videoUrl,
        logoUrl:project.generation.logoUrl||project.media&&project.media.logo&&project.media.logo.url||"",
        duration:project.generation.input&&project.generation.input.duration||project.output&&project.output.duration||"15",
        aspectRatio:project.generation.input&&project.generation.input.aspectRatio||project.output&&project.output.aspectRatio||"9:16",
        resolution:project.generation.input&&project.generation.input.resolution||project.output&&project.output.quality||"1080p",
        createdAt:project.generation.completedAt||project.updatedAt
      }];
    }
    return list.map(function(x){
      return Object.assign({},x,{
        projectId:project.id,
        projectTitle:clean(project.brief&&project.brief.productName||summary&&summary.title||text("Reklam Projesi","Ad Project"))
      });
    });
  }

  function ensureHost(){
    var wrap=panel();if(!wrap)return null;
    var live=wrap.querySelector(".adfilm-live-card");if(!live)return null;
    var host=wrap.querySelector("[data-adfilm-project-history]");
    if(!host){
      host=document.createElement("section");
      host.className="adfilm-output-gallery";
      host.setAttribute("data-adfilm-project-history","");
      var workflow=wrap.querySelector("[data-adfilm-output-workflow]");
      (workflow||live).insertAdjacentElement("afterend",host);
    }
    return host;
  }

  function icon(path){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg>'}
  var PLAY='<path d="m9 6 9 6-9 6V6Z" fill="currentColor"/>';
  var PAUSE='<path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor"/>';
  var DOWN='<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  var FULL='<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';

  function syncCardPlay(card,video){
    var button=card&&card.querySelector('[data-history-action="play"]');if(!button||!video)return;
    button.innerHTML=icon(video.paused?PLAY:PAUSE);
    button.title=video.paused?text("Oynat","Play"):text("Duraklat","Pause");
    button.setAttribute("aria-label",button.title);
  }

  function render(){
    var host=ensureHost();if(!host)return;
    if(!items.length){host.hidden=true;host.innerHTML="";return}
    host.hidden=false;host.innerHTML="";
    var head=document.createElement("div");head.className="adfilm-output-gallery__head";
    head.innerHTML='<h3>'+text("Hazır Videolar","Ready Videos")+'</h3><span>'+items.length+' '+text("video","videos")+'</span>';
    var rail=document.createElement("div");rail.className="adfilm-output-gallery__rail";
    items.forEach(function(item){
      var card=document.createElement("article");
      card.className="adfilm-output-card";
      card.dataset.historyProjectId=item.projectId;
      card.dataset.historyOutputId=item.id;
      var media=document.createElement("div");media.className="adfilm-output-card__media";
      var video=document.createElement("video");
      video.src=item.videoUrl;
      video.preload="metadata";
      video.muted=true;
      video.playsInline=true;
      video.setAttribute("playsinline","");
      video.setAttribute("webkit-playsinline","");
      video.addEventListener("play",function(){syncCardPlay(card,video)});
      video.addEventListener("pause",function(){syncCardPlay(card,video)});
      video.addEventListener("ended",function(){syncCardPlay(card,video)});
      media.appendChild(video);
      var badge=document.createElement("span");badge.textContent="V"+(item.version||1);media.appendChild(badge);
      var play=document.createElement("button");
      play.type="button";play.className="adfilm-output-card__play";play.dataset.historyAction="play";play.title=text("Oynat","Play");play.setAttribute("aria-label",play.title);play.innerHTML=icon(PLAY);media.appendChild(play);
      var tools=document.createElement("div");tools.className="adfilm-output-card__tools";
      var dl=document.createElement("button");dl.type="button";dl.dataset.historyAction="download";dl.title=text("İndir","Download");dl.innerHTML=icon(DOWN);
      var fs=document.createElement("button");fs.type="button";fs.dataset.historyAction="fullscreen";fs.title=text("Tam ekran","Fullscreen");fs.innerHTML=icon(FULL);
      tools.appendChild(dl);tools.appendChild(fs);media.appendChild(tools);
      var meta=document.createElement("div");meta.className="adfilm-output-card__meta";
      meta.innerHTML='<b>'+item.projectTitle+'</b><small>'+["V"+(item.version||1),item.duration?item.duration+" sn":"",item.aspectRatio||"",item.resolution||""].filter(Boolean).join(" · ")+'</small>';
      card.appendChild(media);card.appendChild(meta);rail.appendChild(card);
    });
    host.appendChild(head);host.appendChild(rail);
  }

  async function load(){
    if(busy)return;busy=true;
    try{
      var r=await fetch("/api/ad-film/projects",{credentials:"include",cache:"no-store"});
      var data=await r.json().catch(function(){return{}});
      if(!r.ok||!Array.isArray(data.projects))return;
      var settled=await Promise.allSettled(data.projects.slice(0,12).map(async function(summary){
        var pr=await fetch("/api/ad-film/project?id="+encodeURIComponent(summary.id),{credentials:"include",cache:"no-store"});
        var pd=await pr.json().catch(function(){return{}});
        return pr.ok&&pd.project?projectOutputs(pd.project,summary):[];
      }));
      items=[];
      settled.forEach(function(x){if(x.status==="fulfilled")items=items.concat(x.value)});
      items.sort(function(a,b){return String(b.createdAt||"").localeCompare(String(a.createdAt||""))});
      render();
    }catch(e){console.warn("[ADFILM] project history",e)}finally{busy=false}
  }

  function findItem(card){
    var pid=card&&card.dataset.historyProjectId,oid=card&&card.dataset.historyOutputId;
    return items.find(function(x){return x.projectId===pid&&String(x.id)===String(oid)})||null;
  }

  function openInMain(item,play){
    if(!item||!window.AIVOAdFilmResultControls)return;
    window.AIVOAdFilmResultControls.mount(item.videoUrl,item.logoUrl||"",{
      play:!!play,
      projectId:item.projectId,
      outputId:item.id,
      version:item.version||1,
      source:"history"
    });
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-project-history] [data-history-action]");
    if(!button)return;
    var card=button.closest("[data-history-project-id]"),item=findItem(card);if(!item)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    var action=button.dataset.historyAction;
    if(action==="play"){
      var video=card.querySelector("video");if(!video)return;
      if(video.paused){
        card.closest("[data-adfilm-project-history]").querySelectorAll("video").forEach(function(other){if(other!==video)try{other.pause()}catch(_){}});
        video.play().catch(function(){});
      }else video.pause();
    }else if(action==="download"){
      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.downloadOutput==="function"){
        window.AIVOAdFilmResultControls.downloadOutput(item.id,item.version||1,item.projectId);
      }
    }else if(action==="fullscreen"){
      var v=card.querySelector("video");
      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.fullscreen==="function")window.AIVOAdFilmResultControls.fullscreen(v);
    }
  },true);

  document.addEventListener("click",function(event){
    var card=event.target&&event.target.closest&&event.target.closest("[data-adfilm-project-history] [data-history-project-id]");
    if(!card||event.target.closest("[data-history-action]"))return;
    var item=findItem(card);if(!item)return;
    event.preventDefault();event.stopPropagation();
    openInMain(item,false);
  },true);

  document.addEventListener("aivo:module-mounted",function(e){if(e&&e.detail&&e.detail.key==="adfilm")setTimeout(load,500)});
  document.addEventListener("aivo:adfilm-project-sync",function(){setTimeout(load,220)});
  document.addEventListener("aivo:adfilm-history-refresh",function(){setTimeout(load,80)});
  window.addEventListener("pageshow",function(){setTimeout(load,320)});
})();
