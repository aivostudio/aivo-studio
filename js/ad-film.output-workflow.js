/* AIVO AI Reklam Filmi — completed output workflow */
(function AIVO_AD_FILM_OUTPUT_WORKFLOW(){
  "use strict";
  if(window.__AIVO_AD_FILM_OUTPUT_WORKFLOW_V2__)return;
  window.__AIVO_AD_FILM_OUTPUT_WORKFLOW_V2__=true;

  var STORAGE_KEY="aivo_adfilm_active_project_id_v2";
  var LEGACY_STORAGE_KEY="aivo_adfilm_active_project_id_v1";
  var REOPEN_KEY="aivo_adfilm_reopen_module_v1";
  var INTENTIONAL_PROJECT_KEY="aivo_adfilm_intentional_new_project_id_v1";
  var RECOVERY_TRIED_KEY="aivo_adfilm_recovery_tried_v1";
  var RECOVERED_NOTICE_KEY="aivo_adfilm_recovered_notice_v1";
  var recoveryBusy=false;

  var COPY={
    tr:{
      title:"Reklamın hazır",
      description:"Videonu inceleyebilir veya aynı ürün bilgileriyle yeni bir sürüm hazırlayabilirsin.",
      newVersion:"Yeni Sürüm Oluştur",
      newProject:"Yeni Proje Oluştur",
      versionConfirm:"Yeni sürüm alanı açılsın mı? Hazır videon silinmeyecek; aşağıdaki Hazır Videolar bölümünde korunacak.",
      preparingTitle:"Yeni sürüm hazırlanabilir",
      preparingText:"Ürün bilgilerin, görsellerin, logo ve reklam planın korunuyor. Ayarlarını değiştirip yeniden üret.",
      preparingBadge:"Hazır videolar aşağıda korunuyor",
      prepareFailed:"Yeni sürüm alanı hazırlanamadı.",
      projectConfirm:"Yeni ve boş bir reklam projesi oluşturulsun mu? Mevcut proje ve hazır videoların geçmişte korunacak.",
      projectCreating:"Yeni proje hazırlanıyor...",
      projectFailed:"Yeni proje oluşturulamadı.",
      viewReady:"Hazır videoyu aç",
      recovered:"Önceki reklam projen ve hazır videon geri getirildi."
    },
    en:{
      title:"Your advertising film is ready",
      description:"Review your video or prepare another version using the same product information.",
      newVersion:"Create New Version",
      newProject:"Create New Project",
      versionConfirm:"Prepare a new version workspace? Your ready video will not be deleted; it will remain in Ready Videos below.",
      preparingTitle:"Ready for a new version",
      preparingText:"Your product information, references, logo and advertising plan are preserved. Change any settings and generate again.",
      preparingBadge:"Ready videos are preserved below",
      prepareFailed:"The new version workspace could not be prepared.",
      projectConfirm:"Create a new blank advertising project? The current project and its ready videos will remain in history.",
      projectCreating:"Creating a new project...",
      projectFailed:"The new project could not be created.",
      viewReady:"Open ready video",
      recovered:"Your previous advertising project and ready video were restored."
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
  function storeProjectId(id){
    try{
      if(id)localStorage.setItem(STORAGE_KEY,String(id));else localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }catch(_){}
  }
  function sessionGet(key){try{return sessionStorage.getItem(key)||""}catch(_){return""}}
  function sessionSet(key,value){try{if(value==null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,String(value))}catch(_){} }
  function localGet(key){try{return localStorage.getItem(key)||""}catch(_){return""}}
  function localSet(key,value){try{if(value==null)localStorage.removeItem(key);else localStorage.setItem(key,String(value))}catch(_){} }

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

  function actionButton(action,label,iconName,handler,primary){
    var button=document.createElement("button");
    button.type="button";
    button.dataset.adfilmWorkflowAction=action;
    if(primary)button.className="is-primary";
    button.innerHTML=icon(iconName)+"<span>"+label+"</span>";
    button.addEventListener("click",function(event){
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    });
    return button;
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
      actions.appendChild(actionButton("view",t("viewReady"),"play",openReadyVideo,false));
    }else{
      actions.appendChild(actionButton("version",t("newVersion"),"version",prepareNewVersion,true));
      actions.appendChild(actionButton("project",t("newProject"),"project",createNewProject,false));
    }
    host.appendChild(copy);host.appendChild(actions);
  }

  async function prepareNewVersion(){
    var source=project();if(!source||!source.id)return;
    if(!window.confirm(t("versionConfirm")))return;
    try{
      var response=await fetch("/api/ad-film/seedance/result",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:source.id,action:"prepare-new-version"})});
      var data=await response.json().catch(function(){return{}});if(!response.ok||!data.project)throw new Error(data.error||"prepare_failed");
      storeProjectId(source.id);
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
      storeProjectId(data.project.id);
      localSet(INTENTIONAL_PROJECT_KEY,data.project.id);
      sessionSet(REOPEN_KEY,"1");
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
    var escaped=window.CSS&&typeof CSS.escape==="function"?CSS.escape(String(item.id||"")):String(item.id||"").replace(/"/g,"\\\"");
    var card=panel()&&panel().querySelector('[data-adfilm-output-gallery] [data-output-id="'+escaped+'"] [data-output-action="open"]');
    if(card){card.click();return}
    fetch("/api/ad-film/seedance/result",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:source.id,outputId:item.id})}).then(function(response){return response.json()}).then(function(data){
      if(data.project)dispatch(data.project);
      window.AIVOAdFilmGeneratedVideo=item.videoUrl;window.AIVOAdFilmGeneratedLogo=item.logoUrl||"";
      if(window.AIVOAdFilmResultControls)window.AIVOAdFilmResultControls.mount(item.videoUrl,item.logoUrl||"",{play:true});
    }).catch(function(){});
  }

  function hasReadyOutput(source){return outputs(source).length>0}
  function recentlyCreated(source){
    var value=Date.parse(source&&source.createdAt||"");
    return Number.isFinite(value)&&Date.now()-value<48*60*60*1000;
  }
  async function fetchProject(id){
    var response=await fetch("/api/ad-film/project?id="+encodeURIComponent(id),{method:"GET",credentials:"include"});
    var data=await response.json().catch(function(){return{}});
    if(!response.ok||!data.project)throw new Error(data.error||"project_load_failed");
    return data.project;
  }

  async function recoverAccidentalEmptyProject(source){
    if(recoveryBusy||!source||!source.id||hasReadyOutput(source)||source.preparingNewVersion)return;
    if(localGet(INTENTIONAL_PROJECT_KEY)===source.id)return;
    if(!recentlyCreated(source))return;
    if(sessionGet(RECOVERY_TRIED_KEY)===source.id)return;
    sessionSet(RECOVERY_TRIED_KEY,source.id);
    recoveryBusy=true;
    try{
      var response=await fetch("/api/ad-film/projects",{method:"GET",credentials:"include"});
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!Array.isArray(data.projects))return;
      var candidates=data.projects.filter(function(item){return item&&item.id&&item.id!==source.id}).slice(0,8);
      for(var index=0;index<candidates.length;index++){
        try{
          var candidate=await fetchProject(candidates[index].id);
          if(!hasReadyOutput(candidate))continue;
          storeProjectId(candidate.id);
          sessionSet(REOPEN_KEY,"1");
          sessionSet(RECOVERED_NOTICE_KEY,"1");
          location.reload();
          return;
        }catch(_){}
      }
    }catch(error){console.warn("[ADFILM] project recovery",error)}
    finally{recoveryBusy=false}
  }

  function showRecoveredNotice(){
    if(sessionGet(RECOVERED_NOTICE_KEY)!=="1")return;
    sessionSet(RECOVERED_NOTICE_KEY,null);
    setTimeout(function(){toast(t("recovered"),"success")},500);
  }

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){
      var source=project();
      render(source);
      showRecoveredNotice();
      recoverAccidentalEmptyProject(source);
    },420);
  });
  document.addEventListener("aivo:adfilm-project-sync",function(event){
    setTimeout(function(){
      var source=event&&event.detail&&event.detail.project||project();
      render(source);
      recoverAccidentalEmptyProject(source);
    },100);
  });
  window.addEventListener("pageshow",function(){render(project())});
  var observer=new MutationObserver(function(){if(panel()&&!panel().querySelector("[data-adfilm-output-workflow]"))setTimeout(function(){render(project())},80)});
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.AIVOAdFilmOutputWorkflow={render:render,prepareNewVersion:prepareNewVersion,createNewProject:createNewProject,recover:recoverAccidentalEmptyProject};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){render(project())},{once:true});else render(project());
})();