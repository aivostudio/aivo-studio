/* =========================================================
   AIVO — AI REKLAM FILMI / SEEDANCE ENGINE
   Seedance-only production owner with a stable four-stage customer flow.
   ========================================================= */
(function AIVO_AD_FILM_SEEDANCE_ENGINE(){
  "use strict";
  if(window.__AIVO_AD_FILM_SEEDANCE_ENGINE_V3__)return;
  window.__AIVO_AD_FILM_SEEDANCE_ENGINE_V3__=true;

  var POLL_MS=3000;
  var POLL_MAX=600;
  var uploadCache=new Map();
  var active=false;
  var pollTimer=null;
  var progressTimer=null;
  var generationStartedAt=0;
  var currentStage=0;
  var currentStageNote="";

  var COPY={
    tr:{
      confirm:"Bu test gerçek Fal.ai üretimi başlatır ve Fal.ai bakiyesinden ücret düşebilir. Devam edilsin mi?",
      projectWait:"Bulut projesi henüz hazır değil. Birkaç saniye sonra tekrar dene.",
      completed:"Reklam filmi hazır",
      failed:"Video üretimi tamamlanamadı",
      finalFailed:"Final ses ve müzik işlemi tamamlanamadı. Sayfayı yenileyerek tekrar deneyebilirsin.",
      timeout:"Üretim hâlâ devam ediyor. Daha sonra bu projeye döndüğünde durum yeniden kontrol edilecek.",
      missingHero:"Önce Ana Ürün / Ana Karakter görselini yükle.",
      missingBrief:"Ürün adı ve kısa açıklamayı tamamla.",
      missingNarration:"Seslendirme açıksa metni tamamla ve AIVO önerisiyse onayla.",
      uploadError:"Referans dosyalarından biri yüklenemedi.",
      unsupportedAudio:"Yüklediğin müzik Seedance için MP3 veya WAV olmalı; bu üretimde eklenmedi.",
      download:"Videoyu indir",
      generating:"Reklam Filmi Oluşturuluyor...",
      create:"Reklam Filmini Oluştur",
      falError:"Üretim isteği başarısız oldu.",
      crop45:"Final kompozisyonu merkezde güvenli 4:5 kırpma alanı bırakacak şekilde hazırla. Kenarlardaki kritik ürün detaylarını kırpma alanından uzak tut.",
      minute:"dk",
      second:"sn",
      reference:"referans",
      progressHeading:"Reklam filminiz hazırlanıyor",
      stageLabel:"Aşama {current}/4",
      stage1Title:"Referanslar yükleniyor",
      stage1Description:"Ürün, sahne, logo ve müzik dosyaları güvenli şekilde hazırlanıyor.",
      stage1Progress:"Dosya yükleniyor: {current}/{total}",
      stage2Title:"Sahneler birleştiriliyor",
      stage2Description:"Referans sırası, reklam planı ve görsel akış Seedance için oluşturuluyor.",
      stage3Title:"Video oluşturuluyor",
      stage3Queued:"Üretim isteği Seedance kuyruğuna alındı.",
      stage3Running:"Sahneler, geçişler ve kamera hareketleri oluşturuluyor.",
      stage4Title:"Ses, müzik ve logo ekleniyor",
      stage4Description:"Seslendirme, fon müziği, logo ve final video birleştiriliyor.",
      elapsed:"Toplam geçen süre: {time}",
      completedDetail:"Üretim ve final işlemleri tamamlandı."
    },
    en:{
      confirm:"This test starts a real Fal.ai generation and may use your Fal.ai balance. Continue?",
      projectWait:"The cloud project is not ready yet. Try again in a few seconds.",
      completed:"Your advertising film is ready",
      failed:"Video generation could not be completed",
      finalFailed:"Final narration and music processing failed. Reload the page to retry.",
      timeout:"Generation is still running. Its status will be checked again when you return to this project.",
      missingHero:"Upload a Hero Product / Main Character image first.",
      missingBrief:"Complete the product name and short description.",
      missingNarration:"When narration is enabled, complete the script and approve an AIVO suggestion.",
      uploadError:"One of the reference files could not be uploaded.",
      unsupportedAudio:"Your music must be MP3 or WAV for Seedance; it was omitted from this generation.",
      download:"Download video",
      generating:"Creating Advertising Film...",
      create:"Create Advertising Film",
      falError:"The generation request failed.",
      crop45:"Compose the final frame with a safe centered 4:5 crop area. Keep critical product details away from the outer crop edges.",
      minute:"min",
      second:"sec",
      reference:"references",
      progressHeading:"Your advertising film is being prepared",
      stageLabel:"Stage {current}/4",
      stage1Title:"Uploading references",
      stage1Description:"Product, scene, logo and music files are being prepared securely.",
      stage1Progress:"Uploading file: {current}/{total}",
      stage2Title:"Combining scenes",
      stage2Description:"Reference order, advertising plan and visual flow are being prepared for Seedance.",
      stage3Title:"Creating video",
      stage3Queued:"The production request has entered the Seedance queue.",
      stage3Running:"Scenes, transitions and camera movement are being generated.",
      stage4Title:"Adding sound, music and logo",
      stage4Description:"Narration, background music, logo and final video are being combined.",
      elapsed:"Total elapsed: {time}",
      completedDetail:"Production and final processing are complete."
    }
  };

  function language(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key,vars){
    var text=(COPY[language()]&&COPY[language()][key])||COPY.tr[key]||key;
    Object.keys(vars||{}).forEach(function(name){text=text.replace(new RegExp("\\{"+name+"\\}","g"),String(vars[name]))});
    return text;
  }
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function clean(value){return String(value==null?"":value).trim()}
  function setText(node,value){value=String(value==null?"":value);if(node&&node.textContent!==value)node.textContent=value}
  function field(scope,key){return scope&&scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function value(scope,key,fallback){var input=field(scope,key);if(!input)return fallback;return input.type==="checkbox"?!!input.checked:input.value}
  function selected(scope,key,fallback){var button=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return button?button.getAttribute("data-value"):fallback}
  function files(input){return input?Array.from(input.files||[]):[]}
  function roleFiles(scope,key){return files(scope&&scope.querySelector('[data-adfilm-role-file="'+key+'"]'))}
  function logoFiles(scope){return files(scope&&scope.querySelector('[data-adfilm-file="logo"]'))}
  function musicFiles(scope){return files(scope&&scope.querySelector("[data-adfilm-music-file]"))}
  function fileKey(file,kind){return[kind,file.name,file.size,file.type,file.lastModified||0].join("|")}
  function notify(message,type){
    try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function"){fn({message:message,duration:3600});return}if(typeof window.showToast==="function")window.showToast(message,type||"info")}catch(_){}
  }
  function projectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id)}

  function formatElapsed(value){
    var started=typeof value==="number"?value:Date.parse(value||"");
    if(!Number.isFinite(started)||started<=0)return"0 "+t("minute")+" 00 "+t("second");
    var total=Math.max(0,Math.floor((Date.now()-started)/1000));
    return Math.floor(total/60)+" "+t("minute")+" "+String(total%60).padStart(2,"0")+" "+t("second");
  }

  function setSummaryTitle(scope,title){
    var node=scope&&scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');
    if(node&&title)setText(node,title);
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
    var wrap=small.querySelector("[data-adfilm-stage-wrap]");
    if(!wrap){
      small.innerHTML='<span class="adfilm-stage-wrap" data-adfilm-stage-wrap><span class="adfilm-stage-count" data-adfilm-stage-count></span><strong class="adfilm-stage-title" data-adfilm-stage-title></strong><span class="adfilm-stage-description" data-adfilm-stage-description></span><span class="adfilm-stage-time" data-adfilm-stage-time></span></span>';
      wrap=small.querySelector("[data-adfilm-stage-wrap]");
    }
    return{
      count:wrap.querySelector("[data-adfilm-stage-count]"),
      title:wrap.querySelector("[data-adfilm-stage-title]"),
      description:wrap.querySelector("[data-adfilm-stage-description]"),
      time:wrap.querySelector("[data-adfilm-stage-time]")
    };
  }

  function stageDefinition(stage,note){
    if(stage===1)return{title:t("stage1Title"),description:note||t("stage1Description")};
    if(stage===2)return{title:t("stage2Title"),description:note||t("stage2Description")};
    if(stage===3)return{title:t("stage3Title"),description:note||t("stage3Running")};
    return{title:t("stage4Title"),description:note||t("stage4Description")};
  }

  function updateElapsed(scope){
    if(!active)return;
    var status=ensureStatus(scope),layout=ensureStageLayout(status);if(!layout)return;
    setText(layout.time,t("elapsed",{time:formatElapsed(generationStartedAt)}));
  }
  function startProgressClock(scope){
    clearInterval(progressTimer);
    updateElapsed(scope);
    progressTimer=setInterval(function(){updateElapsed(scope)},1000);
  }
  function stopProgressClock(){clearInterval(progressTimer);progressTimer=null}

  function setStage(scope,stage,note){
    var status=ensureStatus(scope);if(!status)return;
    currentStage=Math.max(1,Math.min(4,Number(stage)||1));
    currentStageNote=clean(note);
    var definition=stageDefinition(currentStage,currentStageNote),layout=ensureStageLayout(status);
    status.removeAttribute("data-adfilm-idle-hidden");
    status.className="adfilm-engine-status is-visible is-busy";
    status.setAttribute("data-stage",String(currentStage));
    setText(status.querySelector("b"),t("progressHeading"));
    if(layout){
      setText(layout.count,t("stageLabel",{current:currentStage}));
      setText(layout.title,definition.title);
      setText(layout.description,definition.description);
      setText(layout.time,t("elapsed",{time:formatElapsed(generationStartedAt)}));
    }
    setSummaryTitle(scope,definition.title);
  }

  function setTerminalStatus(scope,mode,title,detail){
    var status=ensureStatus(scope);if(!status)return;
    status.removeAttribute("data-stage");
    status.className="adfilm-engine-status is-visible is-"+mode;
    setText(status.querySelector("b"),title||"");
    var small=status.querySelector("small");if(small)setText(small,detail||"");
    setSummaryTitle(scope,title);
  }

  function setBusy(scope,on){
    active=!!on;
    var action=scope&&scope.querySelector(".adfilm-actionbar");if(action)action.classList.toggle("is-engine-active",active);
    var button=scope&&scope.querySelector("[data-adfilm-build]");
    if(button){
      button.classList.toggle("is-generating",active);
      button.disabled=active||button.dataset.narrationGuard==="blocked";
      if(active)button.setAttribute("aria-busy","true");else button.removeAttribute("aria-busy");
      var label=button.querySelector('span[data-adfilm-i18n="createButton"]')||button.querySelector("span:not(.adfilm-create__icon)");
      if(label)setText(label,active?t("generating"):t("create"));
    }
    if(active)startProgressClock(scope);else stopProgressClock();
  }

  function collectReferences(scope){
    var hero=roleFiles(scope,"hero"),angles=roleFiles(scope,"angles"),scenes=roleFiles(scope,"scenes");
    var ordered=hero.concat(angles,scenes);
    var map={hero:null,angles:[],scenes:[]};
    if(hero.length)map.hero=1;
    angles.forEach(function(_,index){map.angles.push(2+index)});
    scenes.forEach(function(_,index){map.scenes.push(2+angles.length+index)});
    return{hero:hero,angles:angles,scenes:scenes,ordered:ordered.slice(0,9),map:map};
  }

  function buildPrompt(scope,references){
    var product=clean(value(scope,"productName",""));
    var brand=clean(value(scope,"brandName",""));
    var description=clean(value(scope,"description",""));
    var direction=clean(value(scope,"creativeDirection",""));
    var concept=clean(value(scope,"planConcept","auto"));
    var planMode=clean(value(scope,"planMode","auto"));
    var scenes=[1,2,3,4,5].map(function(index){return clean(value(scope,"scene"+index,""))}).filter(Boolean);
    var narration=clean(value(scope,"narrationText",""));
    var voiceEnabled=!!value(scope,"voiceEnabled",true);
    var languageValue=clean(value(scope,"language","tr"));
    var voiceStyle=clean(value(scope,"voiceStyle","warm"));
    var speed=clean(value(scope,"voiceSpeed","balanced"));
    var flow=clean(value(scope,"voiceFlow","natural"));
    var duration=selected(scope,"duration","10");
    var ratio=selected(scope,"aspectRatio","9:16");
    var cta=clean(value(scope,"cta",""));
    var lines=[];

    lines.push("Create a polished "+duration+"-second commercial advertising film.");
    lines.push("@Image1 is the hero product or main character. Preserve its exact identity, silhouette, colors, proportions, materials and distinctive design details consistently throughout every shot. Do not replace it with a similar product and do not create duplicate hero products unless the scene explicitly requires it.");
    if(references.map.angles.length)lines.push(references.map.angles.map(function(index){return"@Image"+index}).join(", ")+" are additional views of the same hero product. Use them only to understand shape, details and accurate appearance; they are not separate products.");
    references.map.scenes.forEach(function(imageIndex,sceneIndex){lines.push("@Image"+imageIndex+" is scene/environment reference "+(sceneIndex+1)+". Use its location, composition, lighting or atmosphere while keeping @Image1 as the hero subject.")});
    lines.push("Product: "+product+"."+(brand?" Brand: "+brand+".":""));
    lines.push("Verified product brief: "+description+".");
    lines.push("Advertising approach: "+concept+". Planning mode: "+planMode+".");
    if(direction)lines.push("Director instruction: "+direction+".");
    if(scenes.length)lines.push("Scene flow in order: "+scenes.map(function(text,index){return"Scene "+(index+1)+": "+text}).join(" | ")+".");
    else lines.push("Build a clear commercial arc: immediate visual hook, product reveal, product-in-use or benefit moment, premium detail shot, and a strong clean final hero frame.");
    lines.push("Use premium commercial lighting, smooth purposeful camera movement, coherent continuity, natural object motion and high-end advertising composition. Avoid random cuts, identity drift, warped geometry, extra products, illegible text, fake logos and watermarks.");
    lines.push("Do not render the uploaded brand logo inside the generated scene. Leave a clean lower corner and a clean final frame so AIVO can add the original logo as a precise overlay after generation.");
    if(cta)lines.push("Reserve visual space for this later overlay call-to-action: "+cta+". Do not attempt to draw the text yourself.");
    if(ratio==="4:5")lines.push(t("crop45"));
    if(voiceEnabled&&narration)lines.push("Generate synchronized native audio. Include exactly this spoken voice-over in "+languageValue+": \""+narration.replace(/\"/g,"'")+"\". Do not add any other spoken words. Voice character: "+voiceStyle+", speed: "+speed+", delivery: "+flow+". Keep speech naturally inside "+duration+" seconds.");
    else if(voiceEnabled)lines.push("Generate synchronized commercial ambience and sound effects, but no spoken dialogue.");
    else lines.push("Generate synchronized ambience and sound effects without speech.");
    return lines.join(" ");
  }

  function normalizeAspect(value){return value==="4:5"?"3:4":value}
  function normalizeResolution(value){value=clean(value).toLowerCase();return["480p","720p","1080p","4k"].indexOf(value)>=0?value:"1080p"}

  async function uploadFile(project,file,kind){
    var key=fileKey(file,kind);if(uploadCache.has(key))return uploadCache.get(key);
    if(window.AIVOAdFilmProjects&&typeof window.AIVOAdFilmProjects.uploadFile==="function"){
      var item=await window.AIVOAdFilmProjects.uploadFile(project,file,kind);uploadCache.set(key,item);return item;
    }
    var response=await fetch("/api/ad-film/upload-url",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:project,filename:file.name,contentType:file.type,size:file.size,kind:kind})});
    var signed=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(signed.error||"upload_url_failed");
    var put=await fetch(signed.upload_url,{method:"PUT",headers:signed.required_headers||{"Content-Type":file.type},body:file});if(!put.ok)throw new Error("r2_upload_failed_"+put.status);
    var item={key:signed.key,url:signed.read_url||signed.public_url,name:file.name,contentType:file.type,size:file.size,kind:kind,uploadedAt:new Date().toISOString()};uploadCache.set(key,item);return item;
  }

  async function uploadInputs(scope,project,references){
    var jobs=references.ordered.map(function(file){return{file:file,kind:"product-image"}});
    var logo=logoFiles(scope)[0];if(logo)jobs.push({file:logo,kind:"logo",logo:true});
    var music=musicFiles(scope)[0];
    if(music&&/^(audio\/mpeg|audio\/wav|audio\/x-wav)$/i.test(music.type||""))jobs.push({file:music,kind:"music-track",audio:true});
    else if(music)notify(t("unsupportedAudio"),"warning");
    var result={image_urls:[],audio_urls:[],logo_url:""};
    setStage(scope,1,t("stage1Description"));
    for(var index=0;index<jobs.length;index++){
      setStage(scope,1,t("stage1Progress",{current:index+1,total:jobs.length}));
      var uploaded=await uploadFile(project,jobs[index].file,jobs[index].kind);
      if(jobs[index].logo)result.logo_url=uploaded.url;
      else if(jobs[index].audio)result.audio_urls.push(uploaded.url);
      else result.image_urls.push(uploaded.url);
    }
    return result;
  }

  async function jsonRequest(url,options){
    var response=await fetch(url,Object.assign({credentials:"include",headers:{"Content-Type":"application/json"}},options||{}));
    var data=await response.json().catch(function(){return{}});
    if(!response.ok){var error=new Error(data.message||data.error||"request_failed");error.status=response.status;error.data=data;throw error}
    return data;
  }

  function showResult(scope,url){
    if(!url)return;
    var panel=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');if(!panel)return;
    var media=panel.querySelector("[data-panel-media]");if(!media)return;
    var old=media.querySelector("video[data-adfilm-result-video]");if(old)old.remove();
    var video=document.createElement("video");video.setAttribute("data-adfilm-result-video","");video.src=url;video.controls=true;video.playsInline=true;video.preload="metadata";video.autoplay=true;video.muted=false;
    media.appendChild(video);media.classList.add("has-media","has-result-video");
    var live=panel.querySelector(".adfilm-live-card");
    if(live){var actions=live.querySelector(".adfilm-result-actions");if(actions)actions.remove();actions=document.createElement("div");actions.className="adfilm-result-actions";var link=document.createElement("a");link.href=url;link.target="_blank";link.rel="noopener";link.textContent=t("download");actions.appendChild(link);live.appendChild(actions)}
  }

  function outputIdFrom(data){return clean(data&&data.activeOutputId||data&&data.generation&&data.generation.outputId||data&&data.generation&&data.generation.requestId)}
  function finalReady(generation){return Number(generation&&generation.mixVersion||0)>=4&&generation&&generation.videoUrl}

  async function finalizeResult(scope,project,data){
    if(window.AIVOAdFilmSeedanceFinalizing)return;
    window.AIVOAdFilmSeedanceFinalizing=true;
    window.AIVOAdFilmFinalizationPending={projectId:project,outputId:outputIdFrom(data),videoUrl:data&&data.video_url||""};
    document.dispatchEvent(new CustomEvent("aivo:adfilm-finalization-pending",{detail:window.AIVOAdFilmFinalizationPending}));
    setStage(scope,4,t("stage4Description"));
    try{
      var finalized=await jsonRequest("/api/ad-film/seedance/finalize",{method:"POST",body:JSON.stringify({projectId:project,outputId:outputIdFrom(data)})});
      if(!finalized||!finalized.video_url||!finalized.project)throw new Error("final_video_missing");
      window.AIVOAdFilmActiveProject=finalized.project;
      window.AIVOAdFilmGeneratedVideo=finalized.video_url;
      window.AIVOAdFilmFinalizationPending=null;
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:finalized.project,projectId:finalized.project.id||project,media:finalized.project.media||{}}}));
      setBusy(scope,false);
      setTerminalStatus(scope,"success",t("completed"),t("completedDetail"));
      showResult(scope,finalized.video_url);
    }catch(error){
      console.error("[ADFILM] final output",error);
      setBusy(scope,false);
      setTerminalStatus(scope,"error",t("finalFailed"),clean(error&&error.message));
      notify(t("finalFailed"),"warning");
    }finally{
      window.AIVOAdFilmSeedanceFinalizing=false;
    }
  }

  async function poll(scope,project,count){
    if(!active)return;
    if(count>=POLL_MAX){setBusy(scope,false);setTerminalStatus(scope,"error",t("timeout"),"");return}
    try{
      var data=await jsonRequest("/api/ad-film/seedance/status?projectId="+encodeURIComponent(project),{method:"GET"});
      if(data.generation&&data.generation.startedAt)generationStartedAt=Date.parse(data.generation.startedAt)||generationStartedAt;
      if(data.status==="COMPLETED"&&data.video_url){await finalizeResult(scope,project,data);return}
      if(data.status==="FAILED"){setBusy(scope,false);setTerminalStatus(scope,"error",t("failed"),clean(data.generation&&data.generation.error));return}
      setStage(scope,3,data.status==="IN_QUEUE"?t("stage3Queued"):t("stage3Running"));
      pollTimer=setTimeout(function(){poll(scope,project,count+1)},POLL_MS);
    }catch(error){
      if(count<5){pollTimer=setTimeout(function(){poll(scope,project,count+1)},POLL_MS);return}
      setBusy(scope,false);setTerminalStatus(scope,"error",t("failed"),clean(error&&error.message));
    }
  }

  function validate(scope,references){
    if(!references.hero.length){notify(t("missingHero"),"warning");return false}
    if(!clean(value(scope,"productName",""))||clean(value(scope,"description","")).length<10){notify(t("missingBrief"),"warning");return false}
    if(value(scope,"voiceEnabled",true)){
      var narration=clean(value(scope,"narrationText",""));
      var guide=window.AIVOAdFilmNarrationGuideState;
      if(narration.length<10||guide&&guide.mode==="ai"&&!guide.approved){notify(t("missingNarration"),"warning");return false}
    }
    return true;
  }

  async function generate(scope){
    if(active)return;
    var references=collectReferences(scope);if(!validate(scope,references))return;
    var project=projectId(scope);if(!project){notify(t("projectWait"),"warning");return}
    if(!window.confirm(t("confirm")))return;
    generationStartedAt=Date.now();
    currentStage=1;currentStageNote="";
    setBusy(scope,true);clearTimeout(pollTimer);setStage(scope,1,t("stage1Description"));
    try{
      var uploaded=await uploadInputs(scope,project,references);
      setStage(scope,2,t("stage2Description"));
      var ratio=selected(scope,"aspectRatio","9:16");
      var payload={
        projectId:project,
        prompt:buildPrompt(scope,references),
        image_urls:uploaded.image_urls,
        audio_urls:uploaded.audio_urls,
        logo_url:uploaded.logo_url,
        resolution:normalizeResolution(selected(scope,"quality","1080p")),
        duration:selected(scope,"duration","10"),
        aspect_ratio:normalizeAspect(ratio),
        generate_audio:false,
        bitrate_mode:selected(scope,"quality","1080p")==="4k"?"high":"standard",
        reference_map:references.map
      };
      window.AIVOAdFilmSeedancePayload=payload;
      var created=await jsonRequest("/api/ad-film/seedance/create",{method:"POST",body:JSON.stringify(payload)});
      if(created.generation&&created.generation.startedAt)generationStartedAt=Date.parse(created.generation.startedAt)||generationStartedAt;
      setStage(scope,3,t("stage3Queued"));
      poll(scope,project,0);
    }catch(error){
      console.error("[ADFILM] Seedance generation",error);
      setBusy(scope,false);
      setTerminalStatus(scope,"error",t("falError"),clean(error&&error.data&&error.data.fal_response&&JSON.stringify(error.data.fal_response)||error&&error.message));
      notify(error&&error.message==="upload_url_failed"?t("uploadError"):t("falError"),"error");
    }
  }

  function resume(scope,project){
    var generation=project&&project.generation;if(!generation)return;
    if(generation.startedAt)generationStartedAt=Date.parse(generation.startedAt)||generationStartedAt||Date.now();
    if(finalReady(generation)){
      window.AIVOAdFilmGeneratedVideo=generation.videoUrl;
      showResult(scope,generation.videoUrl);
      setTerminalStatus(scope,"success",t("completed"),t("completedDetail"));
      return;
    }
    if(generation.videoUrl&&String(generation.status)==="completed"&&!window.AIVOAdFilmSeedanceFinalizing){
      setBusy(scope,true);setStage(scope,4,t("stage4Description"));
      finalizeResult(scope,project.id,{video_url:generation.videoUrl,generation:generation,activeOutputId:project.activeOutputId});
      return;
    }
    if(["queued","processing"].indexOf(String(generation.status))>=0&&!active){
      setBusy(scope,true);
      setStage(scope,3,String(generation.status)==="queued"?t("stage3Queued"):t("stage3Running"));
      poll(scope,project.id,0);
    }
  }

  function bind(scope){if(!scope||scope.__seedanceEngineBound)return;scope.__seedanceEngineBound=true;ensureStatus(scope)}

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.disabled&&!active)return;
    generate(button.closest('[data-module-root][data-module="adfilm"]')||root());
  },true);

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm"){bind(event.detail.root);setTimeout(function(){resume(event.detail.root,window.AIVOAdFilmActiveProject)},900)}});
  document.addEventListener("aivo:adfilm-project-sync",function(event){var scope=root();if(scope){bind(scope);resume(scope,event&&event.detail&&event.detail.project)}});
  window.addEventListener("pagehide",function(){clearTimeout(pollTimer);stopProgressClock()});

  window.AIVOAdFilmSeedanceEngine={
    generate:function(){var scope=root();if(scope)generate(scope)},
    buildPrompt:function(){var scope=root(),refs=scope&&collectReferences(scope);return scope&&refs?buildPrompt(scope,refs):""},
    references:function(){var scope=root();return scope?collectReferences(scope):null},
    stage:function(){return{current:currentStage,note:currentStageNote,startedAt:generationStartedAt}}
  };

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){bind(root())},{once:true});else bind(root());
})();
