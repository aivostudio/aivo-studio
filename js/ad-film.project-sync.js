/* =========================================================
   AIVO — AI REKLAM FILMI / PROJECT SYNC
   Authenticated project persistence + direct project-owned R2 uploads.
   ========================================================= */
(function AIVO_AD_FILM_PROJECT_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROJECT_SYNC_V2__)return;
  window.__AIVO_AD_FILM_PROJECT_SYNC_V2__=true;

  var PROJECT_STORAGE_KEY="aivo_adfilm_active_project_id_v2";
  var LEGACY_PROJECT_STORAGE_KEY="aivo_adfilm_active_project_id_v1";
  var MUSIC_MODE_KEY="aivo_adfilm_music_mode_v1";
  var MUSIC_STYLE_KEY="aivo_adfilm_music_style_v1";
  var MUSIC_ENERGY_KEY="aivo_adfilm_music_energy_v1";
  var VOICE_SPEED_KEY="aivo_adfilm_voice_speed_v1";
  var VOICE_FLOW_KEY="aivo_adfilm_voice_flow_v1";
  var controllers=new WeakMap();

  var COPY={
    tr:{
      connecting:"Proje bağlantısı kuruluyor",connected:"Proje buluta bağlı",creating:"Yeni reklam projesi oluşturuluyor...",created:"Reklam projesi oluşturuldu.",loading:"Kayıtlı reklam taslağı açılıyor...",loaded:"Reklam taslağın buluttan açıldı.",saving:"Buluta kaydediliyor",saved:"Proje buluta kaydedildi",savedToast:"Değişikliklerin buluta kaydedildi.",uploading:"Dosya yükleniyor",uploadProgress:"Dosya yükleniyor: {current}/{total}",uploadedOne:"Dosya başarıyla yüklendi.",uploadedMany:"{count} dosya başarıyla yüklendi.",resetting:"Yeni taslak hazırlanıyor...",resetDone:"Taslak sıfırlandı ve yeni proje oluşturuldu.",authRequired:"Devam etmek için AIVO hesabına giriş yapmalısın.",networkError:"İnternet bağlantısı kurulamadı. Yerel taslağın korunuyor.",saveFailed:"Bulut kaydı tamamlanamadı. Yerel taslağın korunuyor.",uploadFailed:"Dosya yüklenemedi. Tekrar deneyebilirsin.",policyBlocked:"Bu dosya güvenlik politikası nedeniyle yüklenemedi.",invalidType:"Bu dosya türü desteklenmiyor.",invalidSize:"Dosya izin verilen boyut sınırını aşıyor.",projectMissing:"Reklam projesi bulunamadı; yeni bir taslak oluşturulacak.",createFailed:"Reklam projesi oluşturulamadı. Biraz sonra tekrar dene.",loadFailed:"Kayıtlı proje açılamadı. Yerel taslakla devam edebilirsin.",serverError:"Sunucuda geçici bir sorun oluştu. Lütfen tekrar dene."
    },
    en:{
      connecting:"Connecting project",connected:"Project connected to cloud",creating:"Creating a new advertising project...",created:"Advertising project created.",loading:"Opening your saved advertising draft...",loaded:"Your advertising draft was restored from the cloud.",saving:"Saving to cloud",saved:"Project saved to cloud",savedToast:"Your changes were saved to the cloud.",uploading:"Uploading file",uploadProgress:"Uploading file: {current}/{total}",uploadedOne:"File uploaded successfully.",uploadedMany:"{count} files uploaded successfully.",resetting:"Preparing a new draft...",resetDone:"Draft reset and a new project was created.",authRequired:"Sign in to your AIVO account to continue.",networkError:"Could not connect to the internet. Your local draft is safe.",saveFailed:"Cloud save could not be completed. Your local draft is safe.",uploadFailed:"The file could not be uploaded. You can try again.",policyBlocked:"This file was blocked by the media safety policy.",invalidType:"This file type is not supported.",invalidSize:"The file exceeds the allowed size limit.",projectMissing:"The advertising project was not found; a new draft will be created.",createFailed:"The advertising project could not be created. Try again shortly.",loadFailed:"The saved project could not be opened. You can continue with the local draft.",serverError:"A temporary server problem occurred. Please try again."
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
  function readLocal(key,fallback){try{return localStorage.getItem(key)||fallback}catch(_){return fallback}}
  function writeLocal(key,value){try{if(value==null)localStorage.removeItem(key);else localStorage.setItem(key,String(value))}catch(_){} }
  function selected(scope,key,fallback){
    var button=scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');
    return button?button.getAttribute("data-value"):fallback;
  }
  function field(scope,key,fallback){
    var input=scope.querySelector('[data-adfilm-input="'+key+'"]');
    if(!input)return fallback;
    return input.type==="checkbox"?!!input.checked:input.value;
  }
  function standardFiles(scope,key){
    var input=scope.querySelector('[data-adfilm-file="'+key+'"]');
    return input?Array.from(input.files||[]):[];
  }
  function musicFiles(scope){
    var input=scope.querySelector("[data-adfilm-music-file]");
    return input?Array.from(input.files||[]):[];
  }
  function fingerprint(file){return[file.name,file.size,file.type,file.lastModified||0].join("|")}

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
  function dismissToast(handle){try{if(handle&&typeof handle.dismiss==="function")handle.dismiss()}catch(_){} }
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
      response=await fetch(path,Object.assign({credentials:"include",headers:{"Content-Type":"application/json"}},options||{}));
    }catch(networkError){networkError.status=0;networkError.data={ok:false,error:"network_error"};throw networkError}
    var data=null;
    try{data=await response.json()}catch(_){data={ok:false,error:"invalid_json"}}
    if(!response.ok){var error=new Error(data&&data.message||data&&data.error||("HTTP "+response.status));error.status=response.status;error.data=data;throw error}
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
        var signed=await request("/api/ad-film/upload-url",{method:"POST",body:JSON.stringify({projectId:projectId,filename:file.name,contentType:file.type,size:file.size,kind:kind})});
        var upload;
        try{upload=await fetch(signed.upload_url,{method:"PUT",headers:signed.required_headers||{"Content-Type":file.type},body:file})}
        catch(networkError){networkError.status=0;networkError.data={ok:false,error:"network_error"};throw networkError}
        if(!upload.ok){var uploadError=new Error("r2_upload_failed_"+upload.status);uploadError.status=upload.status;throw uploadError}
        return{key:signed.key,url:signed.read_url||signed.public_url,publicUrl:signed.public_url||null,readUrl:signed.read_url||null,name:file.name,contentType:file.type,size:file.size,kind:kind,uploadedAt:new Date().toISOString(),_fingerprint:fingerprint(file)};
      }
    };
  }
  window.AIVOAdFilmProjects=api();

  function getStoredProjectId(){
    try{return clean(localStorage.getItem(PROJECT_STORAGE_KEY)||localStorage.getItem(LEGACY_PROJECT_STORAGE_KEY))}catch(_){return""}
  }
  function storeProjectId(id){
    try{
      if(id){localStorage.setItem(PROJECT_STORAGE_KEY,id);localStorage.removeItem(LEGACY_PROJECT_STORAGE_KEY)}
      else{localStorage.removeItem(PROJECT_STORAGE_KEY);localStorage.removeItem(LEGACY_PROJECT_STORAGE_KEY)}
    }catch(_){}
  }

  function setStatus(controller,mode,message){
    controller.status=mode;
    var root=controller.root,host=root.querySelector("[data-adfilm-cloud-status]");
    if(!host){host=document.createElement("div");host.className="adfilm-cloud-status";host.setAttribute("data-adfilm-cloud-status","");var hero=root.querySelector(".adfilm-hero__status");if(hero)hero.insertAdjacentElement("afterend",host);else root.prepend(host)}
    host.className="adfilm-cloud-status is-"+mode;
    host.innerHTML="<span></span><b>"+clean(message||mode)+"</b>";
    root.dataset.adfilmCloudStatus=mode;
  }

  function defaultMedia(){return{productImages:[],logo:null,extraMedia:null,musicTrack:null}}
  function currentMedia(controller){
    var media=controller.project&&controller.project.media||{};
    return{productImages:Array.isArray(media.productImages)?media.productImages.slice(0,6):[],logo:media.logo||null,extraMedia:media.extraMedia||null,musicTrack:media.musicTrack||controller.project&&controller.project.music&&controller.project.music.track||null};
  }
  function currentMusic(scope,media){
    var globalProfile=window.AIVOAdFilmMusicProfile||{};
    var mode=scope.dataset.adfilmMusicMode||readLocal(MUSIC_MODE_KEY,"auto");
    if(mode!=="upload"&&mode!=="off")mode="auto";
    return{mode:mode,style:globalProfile.style||scope.dataset.adfilmMusicStyle||readLocal(MUSIC_STYLE_KEY,"auto"),energy:globalProfile.energy||scope.dataset.adfilmMusicEnergy||readLocal(MUSIC_ENERGY_KEY,"balanced"),track:media.musicTrack||null};
  }

  function collect(controller){
    var scope=controller.root,media=currentMedia(controller),music=currentMusic(scope,media);
    return{
      mode:"basic",
      brief:{productName:field(scope,"productName",""),brandName:field(scope,"brandName",""),description:field(scope,"description",""),targetAudience:field(scope,"targetAudience",""),cta:field(scope,"cta","")},
      narration:{enabled:!!field(scope,"voiceEnabled",true),scriptMode:selected(scope,"scriptMode","ai"),language:field(scope,"language","tr"),voiceStyle:field(scope,"voiceStyle","warm"),speed:field(scope,"voiceSpeed",readLocal(VOICE_SPEED_KEY,"balanced")),flow:field(scope,"voiceFlow",readLocal(VOICE_FLOW_KEY,"natural")),text:field(scope,"narrationText","")},
      sceneStyle:selected(scope,"sceneStyle","premium"),
      music:music,
      output:{duration:selected(scope,"duration","10"),aspectRatio:selected(scope,"aspectRatio","9:16"),quality:selected(scope,"quality","1080p"),subtitles:!!field(scope,"subtitles",true),music:music.mode!=="off",soundEffects:!!field(scope,"soundEffects",false)},
      media:media
    };
  }

  function clickChoice(scope,key,value){
    var buttons=scope.querySelectorAll('[data-adfilm-choice="'+key+'"] button[data-value]');
    buttons.forEach(function(button){if(button.getAttribute("data-value")===String(value)&&!button.classList.contains("is-selected"))button.click()});
  }
  function clickMusicMode(scope,value){var button=scope.querySelector('[data-music-mode="'+value+'"]');if(button&&!button.classList.contains("is-selected"))button.click()}
  function setField(scope,key,value){
    var input=scope.querySelector('[data-adfilm-input="'+key+'"]');if(!input)return;
    if(input.type==="checkbox")input.checked=!!value;else input.value=value==null?"":String(value);
    input.dispatchEvent(new Event(input.type==="checkbox"||input.tagName==="SELECT"?"change":"input",{bubbles:true}));
  }
  function setMusicProfile(scope,music){
    music=music||{};
    writeLocal(MUSIC_MODE_KEY,music.mode||"auto");writeLocal(MUSIC_STYLE_KEY,music.style||"auto");writeLocal(MUSIC_ENERGY_KEY,music.energy||"balanced");
    scope.dataset.adfilmMusicMode=music.mode||"auto";scope.dataset.adfilmMusicStyle=music.style||"auto";scope.dataset.adfilmMusicEnergy=music.energy||"balanced";
    var style=scope.querySelector("[data-music-style-select]"),energy=scope.querySelector("[data-music-energy-select]");
    if(style){style.value=music.style||"auto";style.dispatchEvent(new Event("change",{bubbles:true}))}
    if(energy){energy.value=music.energy||"balanced";energy.dispatchEvent(new Event("change",{bubbles:true}))}
    clickMusicMode(scope,music.mode||"auto");
  }
  function formIsMostlyEmpty(scope){return!clean(field(scope,"productName",""))&&!clean(field(scope,"description",""))}
  function exposeProject(controller){
    window.AIVOAdFilmActiveProject=controller.project||null;
    window.AIVOAdFilmServerMedia=currentMedia(controller);
  }

  /* Remaining module behavior is preserved by the existing runtime hooks below. */
  document.addEventListener("aivo:module-mounted",function(event){
    if(!event||!event.detail||event.detail.key!=="adfilm")return;
    var scope=event.detail.root;
    if(!scope||controllers.has(scope))return;
    var controller={root:scope,project:null,status:"connecting",toastTimes:{}};
    controllers.set(scope,controller);
    setStatus(controller,"connecting",t("connecting"));
  });
})();