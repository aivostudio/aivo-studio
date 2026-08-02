/* AIVO AI Reklam Filmi — backend image normalization bridge */
(function AIVO_AD_FILM_MEDIA_NORMALIZATION(){
  "use strict";
  if(window.__AIVO_AD_FILM_MEDIA_NORMALIZATION_V3__)return;
  window.__AIVO_AD_FILM_MEDIA_NORMALIZATION_V3__=true;

  var projectFlights=new Map();
  var ready=false;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function normalizable(kind){return kind==="logo"||kind==="product-image"}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(){
    var scope=document.querySelector('[data-module-root][data-module="adfilm"]');
    return clean(project()&&project().id||scope&&scope.dataset.adfilmProjectId);
  }
  function productionActive(source){
    source=source||project();
    if(!source)return false;
    var generation=source.generation||{};
    var pipeline=source.avatar&&source.avatar.pipeline||{};
    var states=[source.status,generation.status,pipeline.status].map(lower);
    if(states.some(function(value){return[
      "queued","processing","running","in_queue","motion_queued","motion_processing",
      "lipsync_queued","lipsync_processing","rendering","finalizing"
    ].indexOf(value)>=0}))return true;
    return generation.avatarWaiting===true||generation.awaitingFinalComposite===true||
      generation.finalizing===true||source.preparingNewVersion===true;
  }
  function dispatch(next){
    if(!next||typeof next!=="object")return;
    window.AIVOAdFilmActiveProject=next;
    window.AIVOAdFilmServerMedia=next.media||{};
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{
      detail:{project:next,projectId:next.id||"",media:next.media||{}}
    }));
  }
  async function finalize(projectIdValue,kind,item){
    var response=await fetch("/api/ad-film/finalize-upload",{
      method:"POST",
      credentials:"include",
      cache:"no-store",
      headers:{"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({projectId:projectIdValue,kind:kind,item:item})
    });
    var data=await response.json().catch(function(){return{}});
    if(!response.ok||!data.item){
      var error=new Error(clean(data.message||data.error)||"media_normalization_failed");
      error.status=response.status;
      error.data=data;
      throw error;
    }
    return data.item;
  }
  async function normalizeProject(projectIdValue,options){
    options=options||{};
    projectIdValue=clean(projectIdValue||projectId());
    if(!projectIdValue)return null;
    if(!options.force&&productionActive(project()))return project();
    if(projectFlights.has(projectIdValue))return projectFlights.get(projectIdValue);

    var task=(async function(){
      var response=await fetch("/api/ad-film/normalize-project-media",{
        method:"POST",
        credentials:"include",
        cache:"no-store",
        headers:{"Content-Type":"application/json",Accept:"application/json"},
        body:JSON.stringify({projectId:projectIdValue})
      });
      var data=await response.json().catch(function(){return{}});
      if(data.skipped&&data.reason==="production_active")return data.project||project();
      if(!response.ok||!data.project){
        var error=new Error(clean(data.message||data.error)||"project_media_normalization_failed");
        error.status=response.status;
        error.data=data;
        throw error;
      }
      dispatch(data.project);
      return data.project;
    })().finally(function(){projectFlights.delete(projectIdValue)});

    projectFlights.set(projectIdValue,task);
    return task;
  }
  function install(){
    var api=window.AIVOAdFilmProjects;
    if(!api||typeof api.uploadFile!=="function")return false;
    if(api.uploadFile.__aivoNormalizedUpload===true)return true;
    var original=api.uploadFile.bind(api);
    var wrapped=async function(projectIdValue,file,kind){
      var uploaded=await original(projectIdValue,file,kind);
      if(!normalizable(kind))return uploaded;
      var normalized=await finalize(projectIdValue,kind,uploaded);
      normalized._fingerprint=uploaded._fingerprint||[file.name,file.size,file.type,file.lastModified||0].join("|");
      normalized.originalName=uploaded.name||file.name;
      normalized.originalContentType=uploaded.contentType||file.type;
      normalized.originalSize=uploaded.size||file.size;
      return normalized;
    };
    wrapped.__aivoNormalizedUpload=true;
    wrapped.__aivoOriginalUpload=original;
    api.uploadFile=wrapped;
    return true;
  }
  function setBuildPending(button,pending){
    if(!button)return;
    if(pending){
      button.dataset.mediaNormalizationPending="1";
      button.disabled=true;
      button.setAttribute("aria-busy","true");
      button.classList.add("is-loading");
    }else{
      delete button.dataset.mediaNormalizationPending;
      button.classList.remove("is-loading");
      if(!button.classList.contains("is-generating")&&!button.classList.contains("is-music-preparing")){
        button.disabled=false;
        button.removeAttribute("aria-busy");
      }
    }
  }

  var attempts=0;
  function retry(){
    if(install())return;
    attempts+=1;
    if(attempts<80)setTimeout(retry,100);
  }
  retry();

  document.addEventListener("aivo:adfilm-assets-ready",function(){
    ready=true;
    retry();
    if(!productionActive(project()))setTimeout(function(){normalizeProject().catch(function(error){console.warn("[ADFILM] media normalization preflight",error)})},120);
  });
  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm"&&!productionActive(project())){
      setTimeout(function(){normalizeProject().catch(function(error){console.warn("[ADFILM] media normalization mount",error)})},260);
    }
  });
  document.addEventListener("click",function(event){
    if(!ready)return;
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button||button.disabled||button.dataset.mediaNormalizationReplay==="1")return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    setBuildPending(button,true);
    normalizeProject("",{force:true}).then(function(){
      setBuildPending(button,false);
      button.dataset.mediaNormalizationReplay="1";
      setTimeout(function(){
        button.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}));
        delete button.dataset.mediaNormalizationReplay;
      },0);
    }).catch(function(error){
      console.error("[ADFILM] media normalization failed",error);
      setBuildPending(button,false);
      var message=document.documentElement.lang.toLowerCase().indexOf("en")===0
        ?"Product images or logo could not be prepared. Please upload them again."
        :"Ürün görselleri veya logo hazırlanamadı. Lütfen yeniden yükleyin.";
      if(window.toast&&typeof window.toast.error==="function")window.toast.error({message:message,duration:5000});
    });
  },true);

  window.AIVOAdFilmMediaNormalization={normalizeProject:normalizeProject,install:install,productionActive:productionActive};
})();
