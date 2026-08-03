/* AIVO AI Reklam Filmi — clean single-owner production controller V2 */
(function AIVO_AD_FILM_PRODUCTION_CONTROLLER_V2(){
  "use strict";
  if(window.__AIVO_AD_FILM_PRODUCTION_CONTROLLER_V2__)return;
  window.__AIVO_AD_FILM_PRODUCTION_CONTROLLER_V2__=true;

  var busy=false;
  var run=null;
  var elapsedTimer=null;
  var pollTimer=null;
  var uploadCache=new Map();
  var POLL_MS=3000;
  var TOTAL_TIMEOUT_MS=20*60*1000;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function activeProject(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function field(scope,key){return scope&&scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function value(scope,key,fallback){var node=field(scope,key);if(!node)return fallback;return node.type==="checkbox"?!!node.checked:node.value}
  function selected(scope,key,fallback){var node=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return clean(node&&node.getAttribute("data-value"))||fallback}
  function files(node){return node?Array.from(node.files||[]):[]}
  function roleFiles(scope,key){return files(scope&&scope.querySelector('[data-adfilm-role-file="'+key+'"]'))}
  function logoFiles(scope){return files(scope&&scope.querySelector('[data-adfilm-file="logo"]'))}
  function musicFiles(scope){return files(scope&&scope.querySelector('[data-adfilm-music-file]'))}
  function projectId(scope){var source=activeProject();return clean(scope&&scope.dataset.adfilmProjectId||source&&source.id)}
  function generation(source){return source&&source.generation||{}}
  function nowIso(){return new Date().toISOString()}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function debug(label,data){try{console.info("[ADFILM V2] "+label,data||"")}catch(_){} }
  function notify(message,type,duration){
    try{
      var fn=window.toast&&window.toast[type||"info"];
      if(typeof fn==="function")return fn({message:message,duration:duration||4200});
      if(typeof window.showToast==="function")return window.showToast(message,type||"info");
    }catch(_){}
  }

  async function request(url,options,retries){
    retries=Number(retries||0);
    try{
      var response=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));
      var data=await response.json().catch(function(){return{}});
      if(!response.ok){var error=new Error(data.message||data.error||("HTTP "+response.status));error.status=response.status;error.data=data;throw error}
      return data;
    }catch(error){
      if(retries>0&&[502,503,504].indexOf(Number(error&&error.status))>=0){await sleep(1800);return request(url,options,retries-1)}
      throw error;
    }
  }

  function ensureStatus(scope){
    var action=scope&&scope.querySelector(".adfilm-actionbar");if(!action)return null;
    var button=action.querySelector("[data-adfilm-build]");
    var status=action.querySelector("[data-adfilm-engine-status]");
    if(!status){
      status=document.createElement("div");
      status.className="adfilm-engine-status";
      status.setAttribute("data-adfilm-engine-status","");
      status.setAttribute("role","status");
      status.setAttribute("aria-live","polite");
      status.innerHTML="<span></span><div><b></b><small></small></div>";
    }
    if(button&&status.nextElementSibling!==button)action.insertBefore(status,button);
    return status;
  }
  function ensureStageLayout(status){
    var small=status&&status.querySelector("small");if(!small)return null;
    if(!small.querySelector("[data-adfilm-stage-wrap]"))small.innerHTML='<span class="adfilm-stage-wrap" data-adfilm-stage-wrap><span class="adfilm-stage-count" data-adfilm-stage-count></span><strong class="adfilm-stage-title" data-adfilm-stage-title></strong><span class="adfilm-stage-description" data-adfilm-stage-description></span><span class="adfilm-stage-time" data-adfilm-stage-time></span></span>';
    return{count:small.querySelector("[data-adfilm-stage-count]"),title:small.querySelector("[data-adfilm-stage-title]"),description:small.querySelector("[data-adfilm-stage-description]"),time:small.querySelector("[data-adfilm-stage-time]")};
  }
  function setSummary(scope,message){var node=scope&&scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');if(node)node.textContent=message}
  function setButton(scope,on){
    var button=scope&&scope.querySelector("[data-adfilm-build]");if(!button)return;
    button.disabled=!!on;
    button.classList.toggle("is-generating",!!on);
    button.classList.remove("is-loading","is-music-preparing");
    if(on)button.setAttribute("aria-busy","true");else button.removeAttribute("aria-busy");
    var label=button.querySelector('span[data-adfilm-i18n="createButton"]')||button.querySelector("span:not(.adfilm-create__icon)");
    if(label)label.textContent=on?text("Reklam Filmi Oluşturuluyor...","Creating Advertising Film..."):text("Reklam Filmini Oluştur","Create Advertising Film");
  }
  function elapsedSeconds(){
    var started=Number(run&&run.startedAt||Date.now());
    return Math.max(0,Math.floor((Date.now()-started)/1000));
  }
  function elapsedText(){var total=elapsedSeconds();return Math.floor(total/60)+" "+text("dk","min")+" "+String(total%60).padStart(2,"0")+" "+text("sn","sec")}
  function stageCopy(stage){
    if(stage===1)return{title:text("Hazırlık yapılıyor","Preparing production"),description:text("Reklam müziği, referanslar ve üretim ayarları kontrol ediliyor.","Advertising music, references and production settings are being checked.")};
    if(stage===2)return{title:text("Referanslar hazırlanıyor","Preparing references"),description:text("Ürün görselleri ve reklam talimatı üretim motoru için hazırlanıyor.","Product visuals and advertising direction are being prepared for the generation engine.")};
    if(stage===3)return{title:text("Sahneler hazırlanıyor","Preparing scenes"),description:text("Sahneler ve görsel akış oluşturuluyor.","Scenes and the visual flow are being created.")};
    return{title:text("Ses, müzik ve logo ekleniyor","Adding sound, music and logo"),description:text("Final video profesyonel olarak birleştirilip dışa aktarılıyor.","The final video is being professionally combined and exported.")};
  }
  function renderStage(scope,stage,note){
    var status=ensureStatus(scope);if(!status)return;
    var copy=stageCopy(stage),layout=ensureStageLayout(status);
    status.className="adfilm-engine-status is-visible is-busy";
    status.setAttribute("data-stage",String(stage));
    status.removeAttribute("data-adfilm-idle-hidden");
    status.style.setProperty("display","block","important");
    status.style.setProperty("visibility","visible","important");
    status.style.setProperty("opacity","1","important");
    var heading=status.querySelector("b");if(heading)heading.textContent=text("Reklam filminiz hazırlanıyor","Your advertising film is being prepared");
    if(layout){layout.count.textContent=text("Aşama ","Stage ")+stage+"/4";layout.title.textContent=copy.title;layout.description.textContent=note||copy.description;layout.time.textContent=text("Toplam geçen süre: ","Total elapsed: ")+elapsedText()}
    var action=scope.querySelector(".adfilm-actionbar");if(action){action.classList.add("is-engine-active");action.setAttribute("data-adfilm-progress-lock","1")}
    setSummary(scope,text("Reklam filmi hazırlanıyor","Advertising film is being prepared"));
    setButton(scope,true);
  }
  function renderTerminal(scope,type,title,detail){
    var status=ensureStatus(scope);if(!status)return;
    status.style.removeProperty("display");status.style.removeProperty("visibility");status.style.removeProperty("opacity");
    status.removeAttribute("data-stage");status.removeAttribute("data-adfilm-idle-hidden");
    status.className="adfilm-engine-status is-visible is-"+type;
    var heading=status.querySelector("b"),small=status.querySelector("small");if(heading)heading.textContent=title||"";if(small)small.textContent=detail||"";
    var action=scope.querySelector(".adfilm-actionbar");if(action){action.classList.remove("is-engine-active");action.removeAttribute("data-adfilm-progress-lock")}
    setButton(scope,false);
  }
  function resetIdle(scope){
    if(busy)return;
    var status=ensureStatus(scope);if(status){status.className="adfilm-engine-status";status.setAttribute("data-adfilm-idle-hidden","1");status.removeAttribute("data-stage");status.style.removeProperty("display");status.style.removeProperty("visibility");status.style.removeProperty("opacity");var heading=status.querySelector("b"),small=status.querySelector("small");if(heading)heading.textContent="";if(small)small.textContent=""}
    var action=scope&&scope.querySelector(".adfilm-actionbar");if(action){action.classList.remove("is-engine-active");action.removeAttribute("data-adfilm-progress-lock")}
    setSummary(scope,text("Reklam projesi hazırlanacak","Advertising project will be prepared"));setButton(scope,false);
  }
  function stopTimers(){if(elapsedTimer){clearInterval(elapsedTimer);elapsedTimer=null}if(pollTimer){clearTimeout(pollTimer);pollTimer=null}}
  function startElapsed(scope){
    if(elapsedTimer)clearInterval(elapsedTimer);
    elapsedTimer=setInterval(function(){
      if(!busy||!run)return;
      if(Date.now()-Number(run.startedAt||0)>=TOTAL_TIMEOUT_MS){timeoutRun(scope);return}
      renderStage(scope,run.stage||1,run.note||"");
    },1000);
  }

  function narrationCheck(scope){
    var api=window.AIVOAdFilmNarrationState;
    return api&&typeof api.state==="function"?api.state():{ready:true,reason:""};
  }
  function collectReferences(scope){
    var hero=roleFiles(scope,"hero"),angles=roleFiles(scope,"angles"),scenes=roleFiles(scope,"scenes"),ordered=hero.concat(angles,scenes).slice(0,9),map={hero:null,angles:[],scenes:[]};
    if(hero.length)map.hero=1;
    angles.forEach(function(_,index){if(index+1<10)map.angles.push(2+index)});
    scenes.forEach(function(_,index){var imageIndex=2+angles.length+index;if(imageIndex<10)map.scenes.push(imageIndex)});
    return{hero:hero,angles:angles,scenes:scenes,ordered:ordered,map:map};
  }
  function validate(scope,references){
    var narration=narrationCheck(scope);
    if(!narration.ready){notify(narration.reason,"warning",5200);return false}
    if(!references.hero.length){notify(text("Önce ana ürün görselini yükle.","Upload the main product image first."),"warning");return false}
    if(!clean(value(scope,"productName",""))||clean(value(scope,"description","")).length<10){notify(text("Ürün adı ve kısa açıklamayı tamamla.","Complete the product name and short description."),"warning");return false}
    return true;
  }
  function normalizeAspect(value){return value==="4:5"?"3:4":value}
  function normalizeResolution(value){return lower(value)==="4k"?"4k":"1080p"}
  function productionId(){return"adfilm-"+Date.now()+"-"+Math.random().toString(36).slice(2,10)}

  function buildPrompt(scope,references){
    var product=clean(value(scope,"productName","")),brand=clean(value(scope,"brandName","")),description=clean(value(scope,"description","")),direction=clean(value(scope,"creativeDirection","")),narration=clean(value(scope,"narrationText","")),voiceEnabled=!!value(scope,"voiceEnabled",true),duration=selected(scope,"duration","15"),ratio=selected(scope,"aspectRatio","16:9"),lines=[];
    lines.push("Create a polished "+duration+"-second professional commercial advertising film.");
    lines.push("@Image1 is the exact hero product. Preserve its identity, silhouette, colors, proportions, materials, label and distinctive design consistently in every shot. Never replace it with a similar product and never create duplicate hero products.");
    if(references.map.angles.length)lines.push(references.map.angles.map(function(index){return"@Image"+index}).join(", ")+" are additional views of the same hero product and must only preserve its exact appearance.");
    references.map.scenes.forEach(function(imageIndex,sceneIndex){lines.push("@Image"+imageIndex+" is environment reference "+(sceneIndex+1)+". Use its lighting, atmosphere and composition while keeping @Image1 as the hero subject.")});
    lines.push("Product: "+product+"."+(brand?" Brand: "+brand+".":""));lines.push("Verified product brief: "+description+".");if(direction)lines.push("Director instruction: "+direction+".");
    lines.push("Create a clear commercial arc with an immediate visual hook, product reveal, premium detail shots, purposeful movement, coherent continuity and a strong clean final hero frame. Avoid static slideshow shots, random cuts, identity drift, warped geometry, extra products, illegible text, fake logos and watermarks. Do not draw the uploaded logo inside the generated scene. Leave a clean lower corner and final frame for the original logo overlay.");
    if(ratio==="4:5")lines.push("Keep all critical product details inside a centered safe 4:5 crop area.");
    if(voiceEnabled&&narration)lines.push("The final film will use this voice-over: \""+narration.replace(/\"/g,"'")+"\". Pace the visual story to match it. Do not render subtitles unless explicitly requested.");
    return lines.join(" ");
  }

  function fileKey(file,kind){return[kind,file.name,file.size,file.type,file.lastModified||0].join("|")}
  async function uploadFile(project,file,kind){
    var key=fileKey(file,kind);if(uploadCache.has(key))return uploadCache.get(key);
    var uploaded;
    if(window.AIVOAdFilmProjects&&typeof window.AIVOAdFilmProjects.uploadFile==="function")uploaded=await window.AIVOAdFilmProjects.uploadFile(project,file,kind);
    else{
      var signed=await request("/api/ad-film/upload-url",{method:"POST",body:JSON.stringify({projectId:project,filename:file.name,contentType:file.type,size:file.size,kind:kind})},2);
      var put=await fetch(signed.upload_url,{method:"PUT",headers:signed.required_headers||{"Content-Type":file.type},body:file});if(!put.ok)throw new Error("r2_upload_failed_"+put.status);
      uploaded={key:signed.key,url:signed.read_url||signed.public_url,name:file.name,contentType:file.type,size:file.size,kind:kind,uploadedAt:nowIso()};
    }
    uploadCache.set(key,uploaded);return uploaded;
  }
  async function uploadInputs(scope,project,references){
    var jobs=references.ordered.map(function(file){return{file:file,kind:"product-image"}}),logo=logoFiles(scope)[0],music=musicFiles(scope)[0],result={image_urls:[],audio_urls:[],logo_url:""};
    if(logo)jobs.push({file:logo,kind:"logo",logo:true});
    if(music&&/^(audio\/mpeg|audio\/wav|audio\/x-wav)$/i.test(music.type||""))jobs.push({file:music,kind:"music-track",audio:true});
    for(var index=0;index<jobs.length;index++){
      run.note=text("Dosyalar yükleniyor: ","Uploading files: ")+(index+1)+"/"+jobs.length;renderStage(scope,1,run.note);
      var uploaded=await uploadFile(project,jobs[index].file,jobs[index].kind);
      if(jobs[index].logo)result.logo_url=uploaded.url;else if(jobs[index].audio)result.audio_urls.push(uploaded.url);else result.image_urls.push(uploaded.url);
    }
    return result;
  }

  function musicMode(source){var mode=lower(source&&source.music&&source.music.mode||"auto");return mode==="off"||mode==="upload"?mode:"auto"}
  async function ensureMusic(scope,project){
    var source=activeProject()||{},mode=musicMode(source);if(mode!=="auto")return source;
    var profile=window.AIVOAdFilmMusicProfile||{},body={projectId:project,musicStyle:clean(profile.style||scope.dataset.adfilmMusicStyle||source.music&&source.music.style||"auto")||"auto",musicEnergy:clean(profile.energy||scope.dataset.adfilmMusicEnergy||source.music&&source.music.energy||"balanced")||"balanced",duration:Number(selected(scope,"duration","15"))||15};
    var created=await request("/api/ad-film/music/create",{method:"POST",body:JSON.stringify(body)},2);if(created.project)source=created.project;
    if(created.status!=="DISABLED")for(var index=0;index<120;index++){
      if(created.status==="COMPLETED"&&source&&source.music&&source.music.audio&&source.music.audio.url)break;
      await sleep(1800);var state=await request("/api/ad-film/music/status?projectId="+encodeURIComponent(project),{method:"GET"},2);if(state.project)source=state.project;if(state.status==="FAILED")throw new Error(clean(state.error||source.musicGeneration&&source.musicGeneration.error)||"music_generation_failed");if(state.status==="COMPLETED"&&source&&source.music&&source.music.audio&&source.music.audio.url)break;
    }
    var current=activeProject()||{};window.AIVOAdFilmActiveProject=Object.assign({},current,{music:source.music||current.music||{},media:Object.assign({},current.media||{},source.media||{}),musicGeneration:source.musicGeneration||current.musicGeneration||null});return window.AIVOAdFilmActiveProject;
  }

  function updateActive(data){if(data&&data.project)window.AIVOAdFilmActiveProject=Object.assign({},activeProject()||{},data.project);else if(data&&data.generation){var current=activeProject()||{};window.AIVOAdFilmActiveProject=Object.assign({},current,{generation:data.generation})}}
  function generationAge(gen){var started=Date.parse(gen&&gen.startedAt||"");return Number.isFinite(started)?Date.now()-started:0}
  async function cancelProject(project,reason){return request("/api/ad-film/seedance/cancel",{method:"POST",body:JSON.stringify({projectId:project,mode:"failed",reason:reason||"provider_unavailable_timeout"})},1)}

  async function createWithRecovery(payload,allowRetry){
    try{return await request("/api/ad-film/seedance/create",{method:"POST",body:JSON.stringify(payload)},2)}
    catch(error){
      if(Number(error&&error.status)!==409||!error.data||error.data.error!=="generation_in_progress")throw error;
      var existing=error.data.generation||{},age=generationAge(existing);
      if(age>0&&age<TOTAL_TIMEOUT_MS){
        debug("resume-existing",{requestId:existing.requestId,ageMs:age});
        return{ok:true,status:"IN_PROGRESS",request_id:existing.requestId,output_id:existing.outputId||existing.requestId,generation:existing,resumed:true};
      }
      if(!allowRetry)throw error;
      debug("cancel-stale",{requestId:existing.requestId,ageMs:age});
      await cancelProject(payload.projectId,"provider_unavailable_timeout");
      return request("/api/ad-film/seedance/create",{method:"POST",body:JSON.stringify(payload)},2);
    }
  }

  async function finalize(scope,project,data){
    run.stage=4;run.note="";renderStage(scope,4);
    var outputId=clean(data&&data.activeOutputId||data&&data.generation&&data.generation.outputId||data&&data.generation&&data.generation.requestId||run&&run.requestId);
    var finalized=await request("/api/ad-film/seedance/finalize",{method:"POST",body:JSON.stringify({projectId:project,outputId:outputId})},3);
    if(!finalized||!finalized.project||!finalized.video_url)throw new Error("final_video_missing");
    window.AIVOAdFilmActiveProject=finalized.project;window.AIVOAdFilmGeneratedVideo=finalized.video_url;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:finalized.project,projectId:project,media:finalized.project.media||{},currentRun:true}}));
    busy=false;stopTimers();setSummary(scope,text("Reklam filmi hazır","Advertising film ready"));renderTerminal(scope,"success",text("Reklam filmi hazır","Advertising film ready"),text("Üretim ve final işlemleri tamamlandı.","Production and final processing are complete."));notify(text("Reklam filminiz hazır.","Your advertising film is ready."),"success");run=null;
  }
  async function poll(scope,project){
    if(!busy||!run)return;
    if(Date.now()-Number(run.startedAt||0)>=TOTAL_TIMEOUT_MS){await timeoutRun(scope);return}
    try{
      var data=await request("/api/ad-film/seedance/status?projectId="+encodeURIComponent(project),{method:"GET"},3);updateActive(data);
      if(data.status==="COMPLETED"&&data.video_url){await finalize(scope,project,data);return}
      if(data.status==="FAILED")throw new Error(clean(data.error||data.generation&&data.generation.error)||"generation_failed");
      run.stage=3;run.note=data.status==="IN_QUEUE"?text("Üretim kuyruğunda bekleniyor.","Waiting in the generation queue."):text("Sahneler ve görsel akış oluşturuluyor.","Scenes and the visual flow are being created.");renderStage(scope,3,run.note);
      pollTimer=setTimeout(function(){poll(scope,project)},POLL_MS);
    }catch(error){fail(scope,error)}
  }
  async function timeoutRun(scope){
    if(!busy||!run||run.closing)return;
    run.closing=true;run.note=text("20 dakikalık toplam süre sınırı aşıldı. Fal isteği iptal ediliyor.","The 20-minute total limit was exceeded. The Fal request is being cancelled.");renderStage(scope,3,run.note);
    try{await cancelProject(run.projectId,"provider_unavailable_timeout")}catch(error){console.error("[ADFILM V2] cancel timeout",error)}
    fail(scope,new Error("provider_unavailable_timeout"));
  }
  function fail(scope,error){
    if(!busy)return;
    busy=false;stopTimers();console.error("[ADFILM V2] production",error,error&&error.data||"");
    var code=clean(error&&error.message),detail=code==="provider_unavailable_timeout"?text("Üretim 20 dakika içinde tamamlanmadı ve güvenli şekilde durduruldu. Yeni üretim otomatik başlatılmadı.","The production did not complete within 20 minutes and was stopped safely. No new production was started automatically."):code==="generation_in_progress"?text("Bu projede başka bir üretim hâlâ devam ediyor.","Another production is still running for this project."):code;
    renderTerminal(scope,"error",text("Üretim tamamlanamadı","Production could not be completed"),detail||text("Tekrar deneyebilirsin.","You can try again."));notify(detail||text("Reklam üretimi tamamlanamadı.","Advertising production could not be completed."),"error",6200);run=null;
  }

  async function start(scope){
    if(busy)return;
    var references=collectReferences(scope);if(!validate(scope,references))return;
    var project=projectId(scope);if(!project){notify(text("Bulut projesi henüz hazır değil.","The cloud project is not ready yet."),"warning");return}
    run={projectId:project,productionId:productionId(),startedAt:Date.now(),stage:1,note:"",requestId:"",closing:false};window.__AIVO_AD_FILM_CURRENT_RUN__=run;
    busy=true;renderStage(scope,1);startElapsed(scope);debug("start",run);
    try{
      await ensureMusic(scope,project);
      var uploaded=await uploadInputs(scope,project,references);run.stage=2;run.note="";renderStage(scope,2);
      var quality=normalizeResolution(selected(scope,"quality","1080p"));
      var payload={projectId:project,production_id:run.productionId,prompt:buildPrompt(scope,references),image_urls:uploaded.image_urls,audio_urls:uploaded.audio_urls,logo_url:uploaded.logo_url,resolution:quality,duration:selected(scope,"duration","15"),aspect_ratio:normalizeAspect(selected(scope,"aspectRatio","16:9")),generate_audio:false,bitrate_mode:quality==="4k"?"high":"standard",reference_map:references.map};
      debug("create",{projectId:project,productionId:run.productionId,resolution:quality,imageCount:payload.image_urls.length});
      var created=await createWithRecovery(payload,true);updateActive(created);
      var existingStarted=Date.parse(created&&created.generation&&created.generation.startedAt||"");if(created.resumed&&Number.isFinite(existingStarted))run.startedAt=existingStarted;
      run.requestId=clean(created.request_id||created.generation&&created.generation.requestId);run.stage=3;run.note=created.resumed?text("Mevcut üretim izlenmeye devam ediyor.","Continuing to monitor the existing production."):text("Üretim kuyruğuna gönderildi.","Submitted to the generation queue.");renderStage(scope,3,run.note);
      poll(scope,project);
    }catch(error){fail(scope,error)}
  }

  window.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();start(button.closest('[data-module-root][data-module="adfilm"]')||root());
  },true);

  function init(){var scope=root();if(scope)setTimeout(function(){resetIdle(scope)},100)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){resetIdle(event.detail.root||root())},140)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(init,80)});
  window.addEventListener("pagehide",stopTimers);
  window.AIVOAdFilmProductionController={start:function(){var scope=root();if(scope)start(scope)},active:function(){return busy},state:function(){return run},reset:init};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
