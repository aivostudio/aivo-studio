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

  async function request(path,options){
    var response=await fetch(path,Object.assign({
      credentials:"include",
      headers:{"Content-Type":"application/json"}
    },options||{}));
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
        var upload=await fetch(signed.upload_url,{
          method:"PUT",
          headers:signed.required_headers||{"Content-Type":file.type},
          body:file
        });
        if(!upload.ok)throw new Error("r2_upload_failed_"+upload.status);
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
    var payload=collect(controller);
    controller.saveChain=controller.saveChain.catch(function(){}).then(async function(){
      setStatus(controller,"saving","Buluta kaydediliyor");
      var result=await window.AIVOAdFilmProjects.updateProject(controller.projectId,payload);
      controller.project=result.project;
      setStatus(controller,"saved","Proje buluta kaydedildi");
      return result.project;
    }).catch(function(error){
      console.error("[ADFILM] project save",error);
      setStatus(controller,error.status===401?"offline":"error",error.status===401?"Oturum gerekli":"Bulut kaydı başarısız");
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
    var selectedFiles=files(controller.root,key),next=[];
    controller.uploading=true;
    try{
      for(var index=0;index<selectedFiles.length;index++){
        var file=selectedFiles[index],existing=findUploaded(controller,file,kind);
        if(existing){next.push(existing);continue}
        setStatus(controller,"uploading","Dosya yükleniyor "+(index+1)+" / "+selectedFiles.length);
        next.push(await window.AIVOAdFilmProjects.uploadFile(controller.projectId,file,kind));
      }
      var media=currentMedia(controller);
      if(key==="productImages")media.productImages=next;
      if(key==="logo")media.logo=next[0]||null;
      if(key==="extraMedia")media.extraMedia=next[0]||null;
      controller.project=Object.assign({},controller.project,{media:media});
      controller.uploading=false;
      await save(controller);
    }catch(error){
      controller.uploading=false;
      console.error("[ADFILM] media upload",error);
      setStatus(controller,error.status===401?"offline":"error",error.status===401?"Oturum gerekli":"Dosya yüklenemedi");
    }
  }

  async function bootstrap(controller){
    setStatus(controller,"connecting","Proje bağlantısı kuruluyor");
    var id=getStoredProjectId(),project=null;
    if(id){
      try{project=(await window.AIVOAdFilmProjects.getProject(id)).project}catch(error){if(error.status!==401&&error.status!==404)console.warn("[ADFILM] project load",error);if(error.status===404)storeProjectId("");if(error.status===401){setStatus(controller,"offline","Oturum gerekli");return}}
    }
    if(!project){
      try{
        var created=await window.AIVOAdFilmProjects.createProject(collect(controller));
        project=created.project;id=project.id;storeProjectId(id);
      }catch(error){setStatus(controller,error.status===401?"offline":"error",error.status===401?"Oturum gerekli":"Proje oluşturulamadı");return}
    }
    controller.project=project;controller.projectId=project.id;applyProject(controller,project);
    setStatus(controller,"saved","Proje buluta bağlı");
    if(!formIsMostlyEmpty(controller.root))queueSave(controller,100);
  }

  function bind(scope){
    if(!scope||controllers.has(scope)||isPublicPreview())return;
    var controller={root:scope,project:null,projectId:"",saveTimer:null,saveChain:Promise.resolve(),applying:false,uploading:false,status:"idle"};
    controllers.set(scope,controller);
    scope.addEventListener("input",function(event){if(event.target.closest("[data-adfilm-input]"))queueSave(controller)},true);
    scope.addEventListener("change",function(event){
      var media=event.target.closest("[data-adfilm-file]");
      if(media){var key=media.getAttribute("data-adfilm-file");setTimeout(function(){uploadFiles(controller,key,key==="productImages"?"product-image":key==="logo"?"logo":"extra-media")},120);return}
      if(event.target.closest("[data-adfilm-input]"))queueSave(controller);
    },true);
    scope.addEventListener("click",function(event){
      if(event.target.closest("[data-adfilm-choice] button[data-value]"))queueSave(controller,100);
      if(event.target.closest("[data-media-action],[data-clear-file]"))setTimeout(function(){
        var target=event.target.closest("[data-media-action]")?"productImages":event.target.closest("[data-clear-file]").getAttribute("data-clear-file");
        uploadFiles(controller,target,target==="productImages"?"product-image":target==="logo"?"logo":"extra-media");
      },180);
      if(event.target.closest("[data-adfilm-draft-reset]"))setTimeout(async function(){
        if(controller.projectId){try{await window.AIVOAdFilmProjects.deleteProject(controller.projectId)}catch(_){}storeProjectId("");controller.project=null;controller.projectId="";bootstrap(controller)}
      },180);
    },true);
    bootstrap(controller);
  }

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){bind(event.detail.root)},180)});
  var observer=new MutationObserver(function(){var scope=document.querySelector('[data-module-root][data-module="adfilm"]');if(scope&&!controllers.has(scope))setTimeout(function(){bind(scope)},120)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
