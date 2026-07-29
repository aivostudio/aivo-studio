/* AIVO AI Reklam Filmi — stable cross-project ready video history */
(function AIVO_AD_FILM_PROJECT_HISTORY_STABLE(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROJECT_HISTORY_STABLE_V2__)return;
  window.__AIVO_AD_FILM_PROJECT_HISTORY_STABLE_V2__=true;

  var PROJECT_KEY="aivo_adfilm_active_project_id_v2";
  var REOPEN_KEY="aivo_adfilm_reopen_module_v1";
  var items=[];
  var busy=false;
  var lastRenderSignature="";
  var lastActiveSignature="";

  function clean(v){return String(v||"").trim()}
  function lang(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0?"en":"tr"}
  function text(tr,en){return lang()==="en"?en:tr}
  function panel(){return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]')}
  function toast(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn(message);if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function storeProjectId(id){try{if(id)localStorage.setItem(PROJECT_KEY,String(id));else localStorage.removeItem(PROJECT_KEY)}catch(_){} }
  function markForReopen(){try{sessionStorage.setItem(REOPEN_KEY,"1")}catch(_){} }

  function activeSignature(source){
    source=source||{};
    var outputs=Array.isArray(source.outputs)?source.outputs:[];
    var rows=outputs.filter(function(x){return x&&clean(x.videoUrl)}).map(function(x){return[clean(x.id),clean(x.videoUrl),String(x.version||1),clean(x.completedAt||x.createdAt)].join("|")});
    if(!rows.length&&source.generation&&clean(source.generation.videoUrl))rows.push([clean(source.generation.outputId||source.generation.requestId),clean(source.generation.videoUrl),String(source.generation.version||1),clean(source.generation.completedAt||source.updatedAt)].join("|"));
    return clean(source.id)+"::"+rows.join(";;");
  }

  function projectOutputs(project,summary){
    if(!project)return[];
    var list=Array.isArray(project.outputs)?project.outputs.filter(function(x){return x&&clean(x.videoUrl)}):[];
    if(!list.length&&project.generation&&clean(project.generation.videoUrl)){
      list=[{id:project.generation.outputId||project.generation.requestId||"legacy-output",version:project.generation.version||1,videoUrl:project.generation.videoUrl,duration:project.generation.input&&project.generation.input.duration||project.output&&project.output.duration||"15",aspectRatio:project.generation.input&&project.generation.input.aspectRatio||project.output&&project.output.aspectRatio||"9:16",resolution:project.generation.input&&project.generation.input.resolution||project.output&&project.output.quality||"1080p",createdAt:project.generation.completedAt||project.updatedAt}];
    }
    return list.map(function(x){return Object.assign({},x,{projectId:project.id,projectTitle:clean(project.brief&&project.brief.productName||summary&&summary.title||text("Reklam Projesi","Ad Project"))})});
  }

  function itemSignature(list){return list.map(function(x){return[clean(x.projectId),clean(x.id),clean(x.videoUrl),String(x.version||1),clean(x.createdAt||x.completedAt),clean(x.projectTitle)].join("|")}).join(";;")}

  function ensureHost(){
    var wrap=panel();if(!wrap)return null;
    var live=wrap.querySelector(".adfilm-live-card");if(!live)return null;
    var host=wrap.querySelector("[data-adfilm-project-history]");
    if(!host){host=document.createElement("section");host.className="adfilm-output-gallery";host.setAttribute("data-adfilm-project-history","");var workflow=wrap.querySelector("[data-adfilm-output-workflow]");(workflow||live).insertAdjacentElement("afterend",host)}
    return host;
  }

  function icon(path){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg>'}
  var PLAY='<path d="m9 6 9 6-9 6V6Z" fill="currentColor"/>';
  var DOWN='<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  var FULL='<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  var TRASH='<path d="M5 7h14M9 7V4h6v3M8 10v8m4-8v8m4-8v8M7 7l1 14h8l1-14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';

  function tool(action,title,svg,danger){var b=document.createElement("button");b.type="button";b.dataset.historyAction=action;b.title=title;b.setAttribute("aria-label",title);if(danger)b.className="is-danger";b.innerHTML=icon(svg);return b}

  function render(force){
    var host=ensureHost();if(!host)return;
    var signature=itemSignature(items);
    if(!force&&signature===lastRenderSignature)return;
    lastRenderSignature=signature;
    var oldRail=host.querySelector(".adfilm-output-gallery__rail");
    var oldScroll=oldRail?oldRail.scrollLeft:0;
    if(!items.length){host.hidden=true;host.innerHTML="";return}
    host.hidden=false;host.innerHTML="";
    var head=document.createElement("div");head.className="adfilm-output-gallery__head";head.innerHTML='<h3>'+text("Hazır Videolar","Ready Videos")+'</h3><span>'+items.length+' '+text("video","videos")+'</span>';
    var rail=document.createElement("div");rail.className="adfilm-output-gallery__rail";
    items.forEach(function(item){
      var card=document.createElement("article");card.className="adfilm-output-card";card.dataset.historyProjectId=item.projectId;card.dataset.historyOutputId=item.id;card.title=text("Projeyi ve belgelerini açmak için karta tıkla","Click to open the project and its files");
      var media=document.createElement("div");media.className="adfilm-output-card__media";
      var video=document.createElement("video");video.src=item.videoUrl;video.preload="metadata";video.muted=true;video.playsInline=true;video.setAttribute("playsinline","");media.appendChild(video);
      var badge=document.createElement("span");badge.textContent="V"+(item.version||1);media.appendChild(badge);
      var play=document.createElement("button");play.type="button";play.className="adfilm-output-card__play";play.dataset.historyAction="play";play.title=text("Oynat","Play");play.innerHTML=icon(PLAY);media.appendChild(play);
      var tools=document.createElement("div");tools.className="adfilm-output-card__tools";tools.appendChild(tool("download",text("İndir","Download"),DOWN));tools.appendChild(tool("fullscreen",text("Tam ekran","Fullscreen"),FULL));tools.appendChild(tool("delete",text("Sil","Delete"),TRASH,true));media.appendChild(tools);
      var meta=document.createElement("div");meta.className="adfilm-output-card__meta";meta.innerHTML='<b>'+item.projectTitle+'</b><small>'+["V"+(item.version||1),item.duration?item.duration+" sn":"",item.aspectRatio||"",item.resolution||""].filter(Boolean).join(" · ")+'</small>';
      card.appendChild(media);card.appendChild(meta);rail.appendChild(card);
    });
    host.appendChild(head);host.appendChild(rail);
    requestAnimationFrame(function(){rail.scrollLeft=oldScroll});
  }

  async function load(force){
    if(busy)return;busy=true;
    try{
      var r=await fetch("/api/ad-film/projects",{credentials:"include",cache:"no-store"});var data=await r.json().catch(function(){return{}});if(!r.ok||!Array.isArray(data.projects))return;
      var settled=await Promise.allSettled(data.projects.slice(0,12).map(async function(summary){var pr=await fetch("/api/ad-film/project?id="+encodeURIComponent(summary.id),{credentials:"include",cache:"no-store"});var pd=await pr.json().catch(function(){return{}});return pr.ok&&pd.project?projectOutputs(pd.project,summary):[]}));
      var next=[];settled.forEach(function(x){if(x.status==="fulfilled")next=next.concat(x.value)});next.sort(function(a,b){return String(b.createdAt||b.completedAt||"").localeCompare(String(a.createdAt||a.completedAt||""))});items=next;render(!!force);
    }catch(error){console.warn("[ADFILM] stable project history",error)}finally{busy=false}
  }

  function findItem(card){var pid=card&&card.dataset.historyProjectId,oid=card&&card.dataset.historyOutputId;return items.find(function(x){return clean(x.projectId)===clean(pid)&&clean(x.id)===clean(oid)})||null}

  async function openProject(item){
    if(!item||!window.confirm(text("Bu hazır videonun projesi açılsın mı? Şu anki taslağın bulutta korunacak.","Open this ready video's project? Your current draft will remain saved in the cloud.")))return;
    try{var response=await fetch("/api/ad-film/seedance/result",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:item.projectId,outputId:item.id})});var data=await response.json().catch(function(){return{}});if(!response.ok||!data.project)throw new Error(data.error||"project_open_failed");storeProjectId(item.projectId);markForReopen();location.hash="#adfilm";location.reload()}catch(error){console.error("[ADFILM] open history project",error);toast(text("Proje açılamadı.","The project could not be opened."),"error")}
  }

  async function deleteItem(item){
    if(!item||!window.confirm(text("Bu hazır videoyu silmek istiyor musun? Bu işlem geri alınamaz.","Delete this ready video? This cannot be undone.")))return;
    try{var response=await fetch("/api/ad-film/seedance/result?projectId="+encodeURIComponent(item.projectId)+"&outputId="+encodeURIComponent(item.id),{method:"DELETE",credentials:"include",cache:"no-store"});if(!response.ok)throw new Error("delete_failed");items=items.filter(function(x){return !(clean(x.projectId)===clean(item.projectId)&&clean(x.id)===clean(item.id))});lastRenderSignature="";render(true);toast(text("Hazır video silindi.","Ready video deleted."),"success")}catch(error){console.error("[ADFILM] delete history video",error);toast(text("Video silinemedi.","The video could not be deleted."),"error")}
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-project-history] [data-history-action]");if(!button)return;
    var card=button.closest("[data-history-project-id]"),item=findItem(card);if(!item)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    var action=button.dataset.historyAction;
    if(action==="play"){var video=card.querySelector("video");if(video){card.closest("[data-adfilm-project-history]").querySelectorAll("video").forEach(function(other){if(other!==video)try{other.pause()}catch(_){}});if(video.paused)video.play().catch(function(){});else video.pause()}}
    else if(action==="download"&&window.AIVOAdFilmResultControls)window.AIVOAdFilmResultControls.downloadOutput(item.id,item.version||1,item.projectId);
    else if(action==="fullscreen"&&window.AIVOAdFilmResultControls)window.AIVOAdFilmResultControls.fullscreen(card.querySelector("video"));
    else if(action==="delete")deleteItem(item);
  },true);

  document.addEventListener("click",function(event){var card=event.target&&event.target.closest&&event.target.closest("[data-adfilm-project-history] [data-history-project-id]");if(!card||event.target.closest("[data-history-action]"))return;var item=findItem(card);if(item){event.preventDefault();event.stopImmediatePropagation();openProject(item)}},true);

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){load(true)},260)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){var signature=activeSignature(event&&event.detail&&event.detail.project);if(signature&&signature!==lastActiveSignature){var previous=lastActiveSignature;lastActiveSignature=signature;if(previous)setTimeout(function(){load(false)},180)}});
  document.addEventListener("aivo:adfilm-history-refresh",function(){lastRenderSignature="";setTimeout(function(){load(true)},80)});
  window.addEventListener("pageshow",function(){setTimeout(function(){load(false)},260)});

  window.AIVOAdFilmProjectHistoryStable={
    render:function(force){render(!!force)},
    load:function(force){return load(!!force)},
    items:function(){return items.slice()}
  };
})();