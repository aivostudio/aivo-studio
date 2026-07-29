/* AIVO AI Reklam Filmi — completed output workflow */
(function AIVO_AD_FILM_OUTPUT_WORKFLOW(){
  "use strict";
  if(window.__AIVO_AD_FILM_OUTPUT_WORKFLOW__)return;
  window.__AIVO_AD_FILM_OUTPUT_WORKFLOW__=true;

  var STORAGE_KEY="aivo_adfilm_active_project_id_v2";
  var COPY={
    tr:{
      title:"Reklamın hazır",
      description:"Videonu inceleyebilir veya aynı ürün bilgileriyle yeni bir sürüm hazırlayabilirsin.",
      newVersion:"Yeni Sürüm Oluştur",
      newProject:"Yeni Proje Oluştur",
      preparingTitle:"Yeni sürüm hazırlanabilir",
      preparingText:"Ürün bilgilerin, görsellerin, logo ve reklam planın korunuyor. Ayarlarını değiştirip yeniden üret.",
      preparingBadge:"Hazır videolar aşağıda korunuyor",
      prepareFailed:"Yeni sürüm alanı hazırlanamadı.",
      projectConfirm:"Yeni proje oluşturulsun mu? Mevcut proje ve hazır videoların geçmişte korunacak; çalışma alanı temiz bir projeyle açılacak.",
      projectCreating:"Yeni proje hazırlanıyor...",
      projectFailed:"Yeni proje oluşturulamadı.",
      viewReady:"Hazır videoyu aç"
    },
    en:{
      title:"Your advertising film is ready",
      description:"Review your video or prepare another version using the same product information.",
      newVersion:"Create New Version",
      newProject:"Create New Project",
      preparingTitle:"Ready for a new version",
      preparingText:"Your product information, references, logo and advertising plan are preserved. Change any settings and generate again.",
      preparingBadge:"Ready videos are preserved below",
      prepareFailed:"The new version workspace could not be prepared.",
      projectConfirm:"Create a new project? The current project and its ready videos will remain in history, while a clean workspace is opened.",
      projectCreating:"Creating a new project...",
      projectFailed:"The new project could not be created.",
      viewReady:"Open ready video"
    }
  };

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return(COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key}
  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function outputs(source){
    source=source||project()||{};
    if(Array.isArray(source.outputs)&&source.outputs.length)return source.outputs.filter(function(item){return item&&clean(item.videoUrl)});
    if(source.generation&&clean(source.generation.videoUrl))return[{id:source.generation.outputId||source.generation.requestId||"legacy",videoUrl:source.generation.videoUrl,logoUrl:source.generation.logoUrl||null,version:source.generation.version||1}];
    return[];
  }
  function panel(){return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]')}
  function liveCard(){var wrap=panel();return wrap&&wrap.querySelector(".adfilm-live-card")}
  function toast(message,type){try{if(window.toast&&typeof window.toast[type||"info"]==="function")return window.toast[type||"info"](message);if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function dispatch(source){
    if(!source)return;
    window.AIVOAdFilmActiveProject=source;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:source,projectId:source.id||"",media:source.media||{}}}));
  }
  function icon(name){
    var paths={
      version:'<path d="M4 12a8 8 0 1 0 2.34-5.66L4 8.7M4 4v4.7h4.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v4l2.8 1.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      project:'<path d="M4 7h6l2 2h8v10H4V7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 12v5m-2.5-2.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      play:'<path d="m9 6 9 6-9 6V6Z" fill="currentColor"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';
  }

  function ensureHost(){
    var live=liveCard();if(!live)return null;
    var wrap=panel();var host=wrap.querySelector("[data-adfilm-output-workflow]");
    if(!host){
      host=document.createElement("section");
      host.className="adfilm-output-workflow";
      host.setAttribute("data-adfilm-output-workflow","");
      live.insertAdjacentElement("afterend",host);
    }
    return host;
  }

  function render(source){
    source=source||project();
    var host=ensureHost();if(!host)return;
    var list=outputs(source);
    if(!list.length){host.hidden=true;host.innerHTML="";return}
    var preparing=!!(source&&source.preparingNewVersion&&!source.generation);
    host.hidden=false;
    host.classList.toggle("is-preparing",preparing);
    host.innerHTML="";

    var copy=document.createElement("div");copy.className="adfilm-output-workflow__copy";
    var title=document.createElement("h3");title.textContent=preparing?t("preparingTitle"):t("title");
    var text=document.createElement("p");text.textContent=preparing?t("preparingText"):t("description");
    copy.appendChild(title);copy.appendChild(text);

    var actions=document.createElement("div");actions.className="adfilm-output-workflow__actions";
    if(preparing){
      var badge=document.createElement("span");badge.className="adfilm-output-workflow__badge";badge.textContent=t("preparingBadge");copy.appendChild(badge);
      var open=document.createElement("button");open.type="button";open.dataset.adfilmWorkflow="view";open.innerHTML=icon("play")+"<span>"+t("viewReady")+"</span>";actions.appendChild(open);
    }else{
      var version=document.createElement("button");version.type="button";version.className="is-primary";version.dataset.adfilmWorkflow="version";version.innerHTML=icon("version")+"<span>"+t("newVersion")+"</span>";
      var projectButton=document.createElement("button");projectButton.type="button";projectButton.dataset.adfilmWorkflow="project";projectButton.innerHTML=icon("project")+"<span>"+t("newProject")+"</span>";
      actions.appendChild(version);actions.appendChild(projectButton);
    }
    host.appendChild(copy);host.appendChild(actions);
  }

  async function prepareNewVersion(){
    var source=project();if(!source||!source.id)return;
    try{
      var response=await fetch("/api/ad-film/seedance/result",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:source.id,action:"prepare-new-version"})});
      var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||"prepare_failed");
      window.AIVOAdFilmGeneratedVideo="";window.AIVOAdFilmGeneratedLogo="";window.AIVOAdFilmActiveOutputId="";
      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.clear==="function")window.AIVOAdFilmResultControls.clear();
      dispatch(data.project);
      render(data.project);
      if(window.AIVOAdFilmOutputGallery&&typeof window.AIVOAdFilmOutputGallery.render==="function")window.AIVOAdFilmOutputGallery.render(data.project);
      var root=document.querySelector('[data-module-root][data-module="adfilm"]');if(root)root.scrollTo({top:0,behavior:"smooth"});
    }catch(error){console.error("[ADFILM] prepare new version",error);toast(t("prepareFailed"),"error")}
  }

  async function createNewProject(){
    if(!window.confirm(t("projectConfirm")))return;
    var handle=toast(t("projectCreating"),"info");
    try{
      var response=await fetch("/api/ad-film/project",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({project:{mode:"basic"}})});
      var data=await response.json().catch(function(){return{}});if(!response.ok||!data.project)throw new Error(data.error||"create_failed");
      try{localStorage.setItem(STORAGE_KEY,data.project.id);localStorage.removeItem("aivo_adfilm_active_project_id_v1")}catch(_){}
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      location.reload();
    }catch(error){
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      console.error("[ADFILM] create new project",error);toast(t("projectFailed"),"error");
    }
  }

  function openReadyVideo(){
    var source=project(),list=outputs(source);if(!list.length)return;
    var item=list[0];
    var card=panel()&&panel().querySelector('[data-adfilm-output-gallery] [data-output-id="'+CSS.escape(String(item.id||""))+'"] [data-output-action="open"]');
    if(card){card.click();return}
    fetch("/api/ad-film/seedance/result",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:source.id,outputId:item.id})}).then(function(response){return response.json()}).then(function(data){
      if(data.project)dispatch(data.project);
      window.AIVOAdFilmGeneratedVideo=item.videoUrl;window.AIVOAdFilmGeneratedLogo=item.logoUrl||"";
      if(window.AIVOAdFilmResultControls)window.AIVOAdFilmResultControls.mount(item.videoUrl,item.logoUrl||"",{play:true});
    }).catch(function(){});
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest("[data-adfilm-output-workflow] [data-adfilm-workflow]");if(!button)return;
    event.preventDefault();event.stopPropagation();
    var action=button.dataset.adfilmWorkflow;
    if(action==="version")prepareNewVersion();
    else if(action==="project")createNewProject();
    else if(action==="view")openReadyVideo();
  },true);

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){render(project())},420)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){setTimeout(function(){render(event&&event.detail&&event.detail.project||project())},100)});
  window.addEventListener("pageshow",function(){render(project())});
  var observer=new MutationObserver(function(){if(panel()&&!panel().querySelector("[data-adfilm-output-workflow]"))setTimeout(function(){render(project())},80)});
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.AIVOAdFilmOutputWorkflow={render:render,prepareNewVersion:prepareNewVersion,createNewProject:createNewProject};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){render(project())},{once:true});else render(project());
})();