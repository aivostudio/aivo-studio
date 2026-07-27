/* =========================================================
   AIVO — AI REKLAM FILMI / PROJECT SYNC
   Authenticated project persistence + direct R2 uploads.
   Disabled on the public branch-only design preview.
   ========================================================= */
(function AIVO_AD_FILM_PROJECT_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROJECT_SYNC__) return;
  window.__AIVO_AD_FILM_PROJECT_SYNC__=true;

  var PROJECT_STORAGE_KEY="aivo_adfilm_active_project_id_v1";
  var controllers=new WeakMap();
  var COPY={
    tr:{
      connecting:"Proje bağlantısı kuruluyor",
      connected:"Proje buluta bağlı",
      creating:"Yeni reklam projesi oluşturuluyor...",
      created:"Reklam projesi oluşturuldu.",
      loading:"Kayıtlı reklam taslağı açılıyor...",
      loaded:"Reklam taslağın buluttan açıldı.",
      saving:"Buluta kaydediliyor",
      saved:"Proje buluta kaydedildi",
      savedToast:"Değişikliklerin buluta kaydedildi.",
      uploading:"Dosya yükleniyor",
      uploadProgress:"Dosya yükleniyor: {current}/{total}",
      uploadedOne:"Dosya başarıyla yüklendi.",
      uploadedMany:"{count} dosya başarıyla yüklendi.",
      resetting:"Yeni taslak hazırlanıyor...",
      resetDone:"Taslak sıfırlandı ve yeni proje oluşturuldu.",
      authRequired:"Devam etmek için AIVO hesabına giriş yapmalısın.",
      networkError:"İnternet bağlantısı kurulamadı. Yerel taslağın korunuyor.",
      saveFailed:"Bulut kaydı tamamlanamadı. Yerel taslağın korunuyor.",
      uploadFailed:"Dosya yüklenemedi. Tekrar deneyebilirsin.",
      policyBlocked:"Bu dosya güvenlik politikası nedeniyle yüklenemedi.",
      invalidType:"Bu dosya türü desteklenmiyor.",
      invalidSize:"Dosya izin verilen boyut sınırını aşıyor.",
      projectMissing:"Reklam projesi bulunamadı; yeni bir taslak oluşturulacak.",
      createFailed:"Reklam projesi oluşturulamadı. Biraz sonra tekrar dene.",
      loadFailed:"Kayıtlı proje açılamadı. Yerel taslakla devam edebilirsin.",
      serverError:"Sunucuda geçici bir sorun oluştu. Lütfen tekrar dene."
    },
    en:{
      connecting:"Connecting project",
      connected:"Project connected to cloud",
      creating:"Creating a new advertising project...",
      created:"Advertising project created.",
      loading:"Opening your saved advertising draft...",
      loaded:"Your advertising draft was restored from the cloud.",
      saving:"Saving to cloud",
      saved:"Project saved to cloud",
      savedToast:"Your changes were saved to the cloud.",
      uploading:"Uploading file",
      uploadProgress:"Uploading file: {current}/{total}",
      uploadedOne:"File uploaded successfully.",
      uploadedMany:"{count} files uploaded successfully.",
      resetting:"Preparing a new draft...",
      resetDone:"Draft reset and a new project was created.",
      authRequired:"Sign in to your AIVO account to continue.",
      networkError:"Could not connect to the internet. Your local draft is safe.",
      saveFailed:"Cloud save could not be completed. Your local draft is safe.",
      uploadFailed:"The file could not be uploaded. You can try again.",
      policyBlocked:"This file was blocked by the media safety policy.",
      invalidType:"This file type is not supported.",
      invalidSize:"The file exceeds the allowed size limit.",
      projectMissing:"The advertising project was not found; a new draft will be created.",
      createFailed:"The advertising project could not be created. Try again shortly.",
      loadFailed:"The saved project could not be opened. You can continue with the local draft.",
      serverError:"A temporary server problem occurred. Please try again."
    }
  };

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key,vars){
    var text=(COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key;
    Object.keys(vars||{}).forEach(function(name){text=text.replace(new RegExp("\\{"+name+"\\}","g"),String(vars[name]))});
    return text;
  }
  function isPublicPreview(){return document.body.classList.contains("adfilm-preview-unlocked")}
  function clean(value){return String(value==null?"":value).trim()}
  function selected(scope,key,fallback){
    var button=scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');
    return button?button.getAttribute("data-value"):fallback;
  }
  function field(scope,key,fallback){
    var input=scope.querySelector('[data-adfilm-input="'+key+'"]');
    if(!input)return fallback;
    return input.type==="checkbox"?!!input.checked:input.value;
  }
  function files(scope,key){
    var input=scope.querySelector('[data-adfilm-file="'+key+'"]');
    return input?Array.from(input.files||[]):[];
  }
  function fingerprint(file){return [file.name,file.size,file.type,file.lastModified||0].join("|")}

  function notify(controller,type,key,options){
    options=options||{};
    var now=Date.now(),dedupeKey=type+":"+key;
    controller.toastTimes=controller.toastTimes||{};
    if(!options.force&&now-(controller.toastTimes[dedupeKey]||0)<2200)return null;
    controller.toastTimes[dedupeKey]=now;
    var fn=window.toast&&window.toast[type];
    if(typeof fn!=="function")return null;
    try{return fn({message:t(key,options.vars),duration:options.duration==null?3200:options.duration})}catch(_){return null}
  }

  function dismissToast(handle){try{if(handle&&typeof handle.dismiss==="function")handle.dismiss()}catch(_){}}

  function errorKey(error,fallback){
    var code=clean(error&&error.data&&error.data.error||error&&error.message).toLowerCase();
    if(error&&error.status===401)return"authRequired";
    if(error&&error.status===403)return"policyBlocked";
    if(code.indexOf("invalid_content_type")>=0)return"invalidType";
    if(code.indexOf("invalid_file_size")>=0)return"invalidSize";
    if(code.indexOf("project_not_found")>=0||error&&error.status===404)return"projectMissing";
    if(code.indexOf("failed to fetch")>=0||code.indexOf("network")>=0||error&&error.status===0)return"networkError";
    if(error&&error.status>=500)return"serverError";
    return fallback;
  }

  async function request(path,options){
    var response;
    try{
      response=await fetch(path,Object.assign({
        credentials:"include",
        headers:{"Content-Type":"application/json"}
      },options||{}));
    }catch(networkError){
      networkError.status=0;
      networkError.data={ok:false,error:"network_error"};
      throw networkError;
    }
    var data=null;
    try{data=await response.json()}catch(_){data={ok:false,error:"invalid_json"}}
    if(!response.ok){
      var error=new Error(data&&data.message||data&&data.error||("HTTP "+response.status));
      error.status=response.status;error.data=data;throw error;
    }
    return data;
  }

  function api(){
    return{
      createProject:function(project){return request("/api/ad-film/project",{method:"POST",body:JSON.stringify({project:project})})},
      getProject:function(id){return request("/api/ad-film/project?id="+encodeURIComponent(id),{method:"GET"})},
      updateProject:function(id,project){return request("/api/ad-film/project?id="+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({project:project})})},
      deleteProject:function(id){return request("/api/ad-film/project?id="+encodeURIComponent(id),{method:"DELETE"})},
      listProjects:function(){return request("/api/ad-film/projects",{method:"GET"})},
      async uploadFile(projectId,file,kind){
        var signed=await request("/api/ad-film/upload-url",{
          method:"POST",
          body:JSON.stringify({
            projectId:projectId,
            filename:file.name,
            contentType:file.type,
            size:file.size,
            kind:kind
          })
        });
        var upload;
        try{
          upload=await fetch(signed.upload_url,{
            method:"PUT",
            headers:signed.required_headers||{"Content-Type":file.type},
            body:file
          });
        }catch(networkError){
          networkError.status=0;
          networkError.data={ok:false,error:"network_error"};
          throw networkError;
        }
        if(!upload.ok){
          var uploadError=new Error("r2_upload_failed_"+upload.status);
          uploadError.status=upload.status;
          throw uploadError;
        }
        return{
          key:signed.key,
          url:signed.public_url,
          name:file.name,
          contentType:file.type,
          size:file.size,
          kind:kind,
          uploadedAt:new Date().toISOString(),
          _fingerprint:fingerprint(file)
        };
      }
    };
  }
  window.AIVOAdFilmProjects=api();

  function getStoredProjectId(){try{return clean(localStorage.getItem(PROJECT_STORAGE_KEY))}catch(_){return""}}
  function storeProjectId(id){try{if(id)localStorage.setItem(PROJECT_STORAGE_KEY,id);else localStorage.removeItem(PROJECT_STORAGE_KEY)}catch(_){}}

  function setStatus(controller,mode,message){
    controller.status=mode;
    var root=controller.root;
    var host=root.querySelector("[data-adfilm-cloud-status]");
    if(!host){
      host=document.createElement("div");
      host.className="adfilm-cloud-status";
      host.setAttribute("data-adfilm-cloud-status","");
      var hero=root.querySelector(".adfilm-hero__status");
      if(hero)hero.insertAdjacentElement("afterend",host);else root.prepend(host);
    }
    host.className="adfilm-cloud-status is-"+mode;
    host.innerHTML='<span></span><b>'+clean(message||mode)+'</b>';
    root.dataset.adfilmCloudStatus=mode;
  }

  function defaultMedia(){return{productImages:[],logo:null,extraMedia:null}}
  function currentMedia(controller){
    var media=controller.project&&controller.project.media||{};
    return{
      productImages:Array.isArray(media.productImages)?media.productImages.slice(0,6):[],
      logo:media.logo||null,
      extraMedia:media.extraMedia||null
    };
  }

  function collect(controller){
    var scope=controller.root;
    return{
      mode:"basic",
      brief:{
        productName:field(scope,"productName",""),
        brandName:field(scope,"brandName",""),
        description:field(scope,"description",""),
        targetAudience:field(scope,"targetAudience",""),
        cta:field(scope,"cta","")
      },
      narration:{
        enabled:!!field(scope,"voiceEnabled",true),
        scriptMode:selected(scope,"scriptMode","ai"),
        language:field(scope,"language","tr"),
        voiceStyle:field(scope,"voiceStyle","warm"),
        text:field(scope,"narrationText","")
      },
      sceneStyle:selected(scope,"sceneStyle","premium"),
      output:{
        duration:selected(scope,"duration","15"),
        aspectRatio:selected(scope,"aspectRatio","9:16"),
        quality:selected(scope,"quality","1080p"),
        subtitles:!!field(scope,"subtitles",true),
        music:!!field(scope,"music",true),
        soundEffects:!!field(scope,"soundEffects",false)
      },
      media:currentMedia(controller)
    };
  }

  function clickChoice(scope,key,value){
    var buttons=scope.querySelectorAll('[data-adfilm-choice="'+key+'"] button[data-value]');
    buttons.forEach(function(button){if(button.getAttribute("data-value")===String(value)&&!button.classList.contains("is-selected"))button.click()});
  }
  function setField(scope,key,value){
    var input=scope.querySelector('[data-adfilm-input="'+key+'"]');if(!input)return;
    if(input.type==="checkbox")input.checked=!!value;else input.value=value==null?"":String(value);
    input.dispatchEvent(new Event(input.type==="checkbox"||input.tagName==="SELECT"?"change":"input",{bubbles:true}));
  }

  function formIsMostlyEmpty(scope){
    return !clean(field(scope,"productName",""))&&!clean(field(scope,"description",""));
  }
  function applyProject(controller,project){
    if(!project||!formIsMostlyEmpty(controller.root))return;
    controller.applying=true;
    var scope=controller.root,b=project.brief||{},n=project.narration||{},o=project.output||{};
    setField(scope,"productName",b.productName);setField(scope,"brandName",b.brandName);setField(scope,"description",b.description);setField(scope,"targetAudience",b.targetAudience);setField(scope,"cta",b.cta);
    setField(scope,"voiceEnabled",n.enabled);setField(scope,"language",n.language);setField(scope,"voiceStyle",n.voiceStyle);setField(scope,"narrationText",n.text);
    setField(scope,"subtitles",o.subtitles);setField(scope,"music",o.music);setField(scope,"soundEffects",o.soundEffects);
    clickChoice(scope,"scriptMode",n.scriptMode);clickChoice(scope,"sceneStyle",project.sceneStyle);clickChoice(scope,"duration",o.duration);clickChoice(scope,"aspectRatio",o.aspectRatio);clickChoice(scope,"quality",o.quality);
    setTimeout(function(){controller.applying=false},100);
  }

  function queueSave(controller,delay){
    if(controller.applying||controller.uploading)return;
    clearTimeout(controller.saveTimer);
    controller.saveTimer=setTimeout(function(){save(controller)},delay==null?650:delay);
  }

  function save(controller){
    if(!controller.projectId||controller.applying)return Promise.resolve(null);
    var payload=collect(controller),shouldToast=!!controller.userDirty;
    controller.saveChain=controller.saveChain.catch(function(){}).then(async function(){
      setStatus(controller,"saving",t("saving"));
      var result=await window.AIVOAdFilmProjects.updateProject(controller.projectId,payload);
      controller.project=result.project;
      controller.userDirty=false;
      setStatus(controller,"saved",t("saved"));
      if(shouldToast)notify(controller,"success","savedToast",{duration:2100});
      return result.project;
    }).catch(function(error){
      console.error("[ADFILM] project save",error);
      var key=errorKey(error,"saveFailed");
      setStatus(controller,error.status===401||error.status===0?"offline":"error",t(key));
      notify(controller,error.status===401?"warning":"error",key,{force:true,duration:4200});
      return null;
    });
    return controller.saveChain;
  }

  function findUploaded(controller,file,kind){
    var media=currentMedia(controller),items=kind==="product-image"?media.productImages:kind==="logo"?[media.logo]:[media.extraMedia];
    var fp=fingerprint(file);
    return items.filter(Boolean).find(function(item){
      return item._fingerprint===fp||(item.name===file.name&&Number(item.size)===Number(file.size)&&item.contentType===file.type);
    })||null;
  }

  async function uploadFiles(controller,key,kind){
    if(!controller.projectId)return;
    var selectedFiles=files(controller.root,key),next=[],newUploadCount=0,progressToast=null;
    controller.uploading=true;
    try{
      if(selectedFiles.length){
        progressToast=notify(controller,"info","uploadProgress",{force:true,duration:0,vars:{current:1,total:selectedFiles.length}});
      }
      for(var index=0;index<selectedFiles.length;index++){
        var file=selectedFiles[index],existing=findUploaded(controller,file,kind);
        if(existing){next.push(existing);continue}
        dismissToast(progressToast);
        setStatus(controller,"uploading",t("uploadProgress",{current:index+1,total:selectedFiles.length}));
        progressToast=notify(controller,"info","uploadProgress",{force:true,duration:0,vars:{current:index+1,total:selectedFiles.length}});
        next.push(await window.AIVOAdFilmProjects.uploadFile(controller.projectId,file,kind));
        newUploadCount++;
      }
      var media=currentMedia(controller);
      if(key==="productImages")media.productImages=next;
      if(key==="logo")media.logo=next[0]||null;
      if(key==="extraMedia")media.extraMedia=next[0]||null;
      controller.project=Object.assign({},controller.project,{media:media});
      controller.uploading=false;
      controller.userDirty=false;
      await save(controller);
      dismissToast(progressToast);
      if(newUploadCount>0){
        notify(controller,"success",newUploadCount===1?"uploadedOne":"uploadedMany",{force:true,duration:2800,vars:{count:newUploadCount}});
      }
    }catch(error){
      controller.uploading=false;
      dismissToast(progressToast);
      console.error("[ADFILM] media upload",error);
      var keyName=errorKey(error,"uploadFailed");
      setStatus(controller,error.status===401||error.status===0?"offline":"error",t(keyName));
      notify(controller,error.status===401||error.status===403||error.status===400?"warning":"error",keyName,{force:true,duration:4600});
    }
  }

  async function bootstrap(controller){
    setStatus(controller,"connecting",t("connecting"));
    var id=getStoredProjectId(),project=null;
    if(id){
      var loadingToast=notify(controller,"info","loading",{force:true,duration:0});
      try{
        project=(await window.AIVOAdFilmProjects.getProject(id)).project;
        dismissToast(loadingToast);
        notify(controller,"success","loaded",{force:true,duration:2300});
      }catch(error){
        dismissToast(loadingToast);
        if(error.status!==401&&error.status!==404)console.warn("[ADFILM] project load",error);
        if(error.status===404){storeProjectId("");notify(controller,"warning","projectMissing",{force:true,duration:3500})}
        if(error.status===401){setStatus(controller,"offline",t("authRequired"));notify(controller,"warning","authRequired",{force:true,duration:4400});return}
        if(error.status!==404){notify(controller,error.status===0?"warning":"error",errorKey(error,"loadFailed"),{force:true,duration:4200})}
      }
    }
    if(!project){
      var creatingToast=notify(controller,"info","creating",{force:true,duration:0});
      try{
        var created=await window.AIVOAdFilmProjects.createProject(collect(controller));
        project=created.project;id=project.id;storeProjectId(id);
        dismissToast(creatingToast);
        notify(controller,"success","created",{force:true,duration:2600});
      }catch(error){
        dismissToast(creatingToast);
        var createKey=errorKey(error,"createFailed");
        setStatus(controller,error.status===401||error.status===0?"offline":"error",t(createKey));
        notify(controller,error.status===401||error.status===0?"warning":"error",createKey,{force:true,duration:4600});
        return;
      }
    }
    controller.project=project;controller.projectId=project.id;applyProject(controller,project);
    setStatus(controller,"saved",t("connected"));
    if(!formIsMostlyEmpty(controller.root))queueSave(controller,100);
  }

  function bind(scope){
    if(!scope||controllers.has(scope)||isPublicPreview())return;
    var controller={root:scope,project:null,projectId:"",saveTimer:null,saveChain:Promise.resolve(),applying:false,uploading:false,status:"idle",userDirty:false,toastTimes:{}};
    controllers.set(scope,controller);
    scope.addEventListener("input",function(event){
      if(event.target.closest("[data-adfilm-input]")){controller.userDirty=true;queueSave(controller)}
    },true);
    scope.addEventListener("change",function(event){
      var media=event.target.closest("[data-adfilm-file]");
      if(media){var mediaKey=media.getAttribute("data-adfilm-file");setTimeout(function(){uploadFiles(controller,mediaKey,mediaKey==="productImages"?"product-image":mediaKey==="logo"?"logo":"extra-media")},120);return}
      if(event.target.closest("[data-adfilm-input]")){controller.userDirty=true;queueSave(controller)}
    },true);
    scope.addEventListener("click",function(event){
      if(event.target.closest("[data-adfilm-choice] button[data-value]")){controller.userDirty=true;queueSave(controller,100)}
      if(event.target.closest("[data-media-action],[data-clear-file]"))setTimeout(function(){
        var target=event.target.closest("[data-media-action]")?"productImages":event.target.closest("[data-clear-file]").getAttribute("data-clear-file");
        uploadFiles(controller,target,target==="productImages"?"product-image":target==="logo"?"logo":"extra-media");
      },180);
      if(event.target.closest("[data-adfilm-draft-reset]"))setTimeout(async function(){
        var resetToast=notify(controller,"info","resetting",{force:true,duration:0});
        if(controller.projectId){try{await window.AIVOAdFilmProjects.deleteProject(controller.projectId)}catch(_){}storeProjectId("");controller.project=null;controller.projectId=""}
        await bootstrap(controller);
        dismissToast(resetToast);
        if(controller.projectId)notify(controller,"success","resetDone",{force:true,duration:2800});
      },180);
    },true);
    bootstrap(controller);
  }

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){bind(event.detail.root)},180)});
  var observer=new MutationObserver(function(){var scope=document.querySelector('[data-module-root][data-module="adfilm"]');if(scope&&!controllers.has(scope))setTimeout(function(){bind(scope)},120)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
