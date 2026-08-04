/* AIVO AI Reklam Filmi — single owner production controller */
(function AIVO_AD_FILM_PRODUCTION_CONTROLLER(){
  "use strict";
  if(window.__AIVO_AD_FILM_PRODUCTION_CONTROLLER_V2__)return;
  window.__AIVO_AD_FILM_PRODUCTION_CONTROLLER_V2__=true;
  window.__AIVO_AD_FILM_PRODUCTION_CONTROLLER_V1__=true;

  var busy=false;
  var run=null;
  var elapsedTimer=null;
  var uploadCache=new Map();
  var POLL_MS=3000;
  var POLL_MAX=400;
  var CREDIT_APP="adfilm";
  var CREDIT_ACTION="studio_adfilm_generate";

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
  function notify(message,type,duration){
    try{
      var fn=window.toast&&window.toast[type||"info"];
      if(typeof fn==="function")return fn({message:message,duration:duration||4200});
      if(typeof window.showToast==="function")return window.showToast(message,type||"info");
    }catch(_){}
  }
  function debug(label,data){try{console.info("[ADFILM FLOW] "+label,data||"")}catch(_){} }

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
    if(!small.querySelector("[data-adfilm-stage-wrap]")){
      small.innerHTML='<span class="adfilm-stage-wrap" data-adfilm-stage-wrap><span class="adfilm-stage-count" data-adfilm-stage-count></span><strong class="adfilm-stage-title" data-adfilm-stage-title></strong><span class="adfilm-stage-description" data-adfilm-stage-description></span><span class="adfilm-stage-time" data-adfilm-stage-time></span></span>';
    }
    return{
      count:small.querySelector("[data-adfilm-stage-count]"),
      title:small.querySelector("[data-adfilm-stage-title]"),
      description:small.querySelector("[data-adfilm-stage-description]"),
      time:small.querySelector("[data-adfilm-stage-time]")
    };
  }
  function setSummary(scope,message){var node=scope&&scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');if(node)node.textContent=message}
  function setButton(scope,on){
    var button=scope&&scope.querySelector("[data-adfilm-build]");if(!button)return;
    button.disabled=!!on||button.dataset.narrationGuard==="blocked";
    button.classList.toggle("is-generating",!!on);
    button.classList.remove("is-loading","is-music-preparing");
    if(on)button.setAttribute("aria-busy","true");else button.removeAttribute("aria-busy");
    var label=button.querySelector('span[data-adfilm-i18n="createButton"]')||button.querySelector("span:not(.adfilm-create__icon)");
    if(label)label.textContent=on?text("Reklam Filmi Oluşturuluyor...","Creating Advertising Film..."):text("Reklam Filmini Oluştur","Create Advertising Film");
  }
  function syncCreditPricing(){try{window.AIVOAdFilmCreditPricing&&window.AIVOAdFilmCreditPricing.sync&&window.AIVOAdFilmCreditPricing.sync()}catch(_){} }
  function elapsed(){
    var started=run&&run.startedAt||Date.now();
    var total=Math.max(0,Math.floor((Date.now()-started)/1000));
    return Math.floor(total/60)+" "+text("dk","min")+" "+String(total%60).padStart(2,"0")+" "+text("sn","sec");
  }
  function stageCopy(stage){
    if(stage===1)return{title:text("Hazırlık yapılıyor","Preparing production"),description:text("Reklam müziği, referanslar ve üretim ayarları kontrol ediliyor.","Advertising music, references and production settings are being checked.")};
    if(stage===2)return{title:text("Referanslar hazırlanıyor","Preparing references"),description:text("Ürün görselleri ve reklam talimatı üretim motoru için hazırlanıyor.","Product visuals and advertising direction are being prepared for the generation engine.")};
    if(stage===3)return{title:text("Sahneler hazırlanıyor","Preparing scenes"),description:text("Geçişler, efektler ve görsel akış oluşturuluyor.","Transitions, effects and the visual flow are being created.")};
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
    if(layout){
      layout.count.textContent=text("Aşama ","Stage ")+stage+"/4";
      layout.title.textContent=copy.title;
      layout.description.textContent=note||copy.description;
      layout.time.textContent=text("Toplam geçen süre: ","Total elapsed: ")+elapsed();
    }
    var action=scope.querySelector(".adfilm-actionbar");if(action){action.classList.add("is-engine-active");action.setAttribute("data-adfilm-progress-lock","1")}
    setSummary(scope,text("Reklam filmi hazırlanıyor","Advertising film is being prepared"));
    setButton(scope,true);
  }
  function renderTerminal(scope,type,title,detail){
    var status=ensureStatus(scope);if(!status)return;
    status.style.removeProperty("display");status.style.removeProperty("visibility");status.style.removeProperty("opacity");
    status.removeAttribute("data-stage");status.removeAttribute("data-adfilm-idle-hidden");
    status.className="adfilm-engine-status is-visible is-"+type;
    var heading=status.querySelector("b"),small=status.querySelector("small");
    if(heading)heading.textContent=title||"";
    if(small)small.textContent=detail||"";
    var action=scope.querySelector(".adfilm-actionbar");if(action){action.classList.remove("is-engine-active");action.removeAttribute("data-adfilm-progress-lock")}
    setButton(scope,false);
    setTimeout(syncCreditPricing,0);
  }
  function resetIdle(scope){
    if(busy)return;
    var status=ensureStatus(scope);if(status){
      status.className="adfilm-engine-status";
      status.setAttribute("data-adfilm-idle-hidden","1");
      status.removeAttribute("data-stage");
      status.style.removeProperty("display");status.style.removeProperty("visibility");status.style.removeProperty("opacity");
      var heading=status.querySelector("b"),small=status.querySelector("small");if(heading)heading.textContent="";if(small)small.textContent="";
    }
    var action=scope&&scope.querySelector(".adfilm-actionbar");if(action){action.classList.remove("is-engine-active");action.removeAttribute("data-adfilm-progress-lock")}
    setSummary(scope,text("Reklam projesi hazırlanacak","Advertising project will be prepared"));
    setButton(scope,false);
    setTimeout(syncCreditPricing,0);
  }
  function startElapsedClock(scope){clearInterval(elapsedTimer);elapsedTimer=setInterval(function(){if(busy)renderStage(scope,run&&run.stage||1,run&&run.note||"")},1000)}
  function stopElapsedClock(){clearInterval(elapsedTimer);elapsedTimer=null}

  function collectReferences(scope){
    var hero=roleFiles(scope,"hero"),angles=roleFiles(scope,"angles"),scenes=roleFiles(scope,"scenes");
    var ordered=hero.concat(angles,scenes).slice(0,9);
    var map={hero:null,angles:[],scenes:[]};
    if(hero.length)map.hero=1;
    angles.forEach(function(_,index){if(index+1<10)map.angles.push(2+index)});
    scenes.forEach(function(_,index){var imageIndex=2+angles.length+index;if(imageIndex<10)map.scenes.push(imageIndex)});
    return{hero:hero,angles:angles,scenes:scenes,ordered:ordered,map:map};
  }
  function validate(scope,references){
    if(!references.hero.length){notify(text("Önce ana ürün görselini yükle.","Upload the main product image first."),"warning");return false}
    if(!clean(value(scope,"productName",""))||clean(value(scope,"description","")).length<10){notify(text("Ürün adı ve kısa açıklamayı tamamla.","Complete the product name and short description."),"warning");return false}
    if(value(scope,"voiceEnabled",true)&&clean(value(scope,"narrationText","")).length<10){notify(text("Seslendirme metnini tamamla.","Complete the narration script."),"warning");return false}
    return true;
  }
  function normalizeAspect(value){return value==="4:5"?"3:4":value}
  function normalizeResolution(value){value=lower(value);return value==="720p"?"720p":value==="4k"?"4k":"1080p"}

  function buildPrompt(scope,references){
    var product=clean(value(scope,"productName",""));
    var brand=clean(value(scope,"brandName",""));
    var description=clean(value(scope,"description",""));
    var direction=clean(value(scope,"creativeDirection",""));
    var narration=clean(value(scope,"narrationText",""));
    var voiceEnabled=!!value(scope,"voiceEnabled",true);
    var languageValue=clean(value(scope,"language","tr"));
    var voiceStyle=clean(value(scope,"voiceStyle","warm"));
    var duration=selected(scope,"duration","15");
    var ratio=selected(scope,"aspectRatio","16:9");
    var lines=[];
    lines.push("Create a polished "+duration+"-second professional commercial advertising film.");
    lines.push("@Image1 is the exact hero product. Preserve its identity, silhouette, colors, proportions, materials, label and distinctive design consistently in every shot. Never replace it with a similar product and never create duplicate hero products.");
    if(references.map.angles.length)lines.push(references.map.angles.map(function(index){return"@Image"+index}).join(", ")+" are additional views of the same hero product and must only be used to preserve its exact appearance.");
    references.map.scenes.forEach(function(imageIndex,sceneIndex){lines.push("@Image"+imageIndex+" is environment reference "+(sceneIndex+1)+". Use its lighting, atmosphere and composition while keeping @Image1 as the hero subject.")});
    lines.push("Product: "+product+"."+(brand?" Brand: "+brand+".":""));
    lines.push("Verified product brief: "+description+".");
    if(direction)lines.push("Director instruction: "+direction+".");
    lines.push("Create a clear commercial arc with an immediate visual hook, product reveal, premium detail shots, purposeful movement, coherent continuity and a strong clean final hero frame. Avoid static slideshow shots, random cuts, identity drift, warped geometry, extra products, illegible text, fake logos and watermarks.");
    lines.push("Do not draw the uploaded logo inside the generated scene. Leave a clean lower corner and a clean final frame so the original logo can be added as a precise overlay.");
    if(ratio==="4:5")lines.push("Keep all critical product details inside a centered safe 4:5 crop area.");
    if(voiceEnabled&&narration)lines.push("The final film will use this "+languageValue+" voice-over: \""+narration.replace(/\"/g,"'")+"\". Pace the visual story to match it. Voice character: "+voiceStyle+". Do not render subtitles unless explicitly requested.");
    return lines.join(" ");
  }

  function fileKey(file,kind){return[kind,file.name,file.size,file.type,file.lastModified||0].join("|")}
  async function uploadFile(project,file,kind){
    var key=fileKey(file,kind);if(uploadCache.has(key))return uploadCache.get(key);
    if(window.AIVOAdFilmProjects&&typeof window.AIVOAdFilmProjects.uploadFile==="function"){
      var uploaded=await window.AIVOAdFilmProjects.uploadFile(project,file,kind);uploadCache.set(key,uploaded);return uploaded;
    }
    var signedResponse=await fetch("/api/ad-film/upload-url",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:project,filename:file.name,contentType:file.type,size:file.size,kind:kind})});
    var signed=await signedResponse.json().catch(function(){return{}});if(!signedResponse.ok)throw new Error(signed.error||"upload_url_failed");
    var put=await fetch(signed.upload_url,{method:"PUT",headers:signed.required_headers||{"Content-Type":file.type},body:file});if(!put.ok)throw new Error("r2_upload_failed_"+put.status);
    var item={key:signed.key,url:signed.read_url||signed.public_url,name:file.name,contentType:file.type,size:file.size,kind:kind,uploadedAt:new Date().toISOString()};uploadCache.set(key,item);return item;
  }
  async function uploadInputs(scope,project,references){
    var jobs=references.ordered.map(function(file){return{file:file,kind:"product-image"}});
    var logo=logoFiles(scope)[0];if(logo)jobs.push({file:logo,kind:"logo",logo:true});
    var music=musicFiles(scope)[0];if(music&&/^(audio\/mpeg|audio\/wav|audio\/x-wav)$/i.test(music.type||""))jobs.push({file:music,kind:"music-track",audio:true});
    var result={image_urls:[],audio_urls:[],logo_url:""};
    for(var index=0;index<jobs.length;index++){
      run.note=text("Dosyalar yükleniyor: ","Uploading files: ")+(index+1)+"/"+jobs.length;
      renderStage(scope,1,run.note);
      var uploaded=await uploadFile(project,jobs[index].file,jobs[index].kind);
      if(jobs[index].logo)result.logo_url=uploaded.url;
      else if(jobs[index].audio)result.audio_urls.push(uploaded.url);
      else result.image_urls.push(uploaded.url);
    }
    return result;
  }

  async function request(url,options,retries){
    retries=Number(retries||0);
    try{
      var response=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));
      var data=await response.json().catch(function(){return{}});
      if(!response.ok){var error=new Error(data.message||data.error||("HTTP "+response.status));error.status=response.status;error.data=data;throw error}
      return data;
    }catch(error){
      if(retries>0&&[502,503,504].indexOf(Number(error&&error.status))>=0){await new Promise(function(resolve){setTimeout(resolve,1800)});return request(url,options,retries-1)}
      throw error;
    }
  }

  function creditQuote(scope){
    var quote=null;
    try{quote=window.AIVOAdFilmCreditPricing&&window.AIVOAdFilmCreditPricing.current&&window.AIVOAdFilmCreditPricing.current()}catch(_){}
    var quality=normalizeResolution(quote&&quote.quality||selected(scope,"quality","1080p"));
    var duration=Number(quote&&quote.duration||selected(scope,"duration","15"))||15;
    var amount=Number(quote&&quote.credits||0);
    if(!amount&&window.AIVOAdFilmCreditPricing&&typeof window.AIVOAdFilmCreditPricing.calculate==="function")amount=Number(window.AIVOAdFilmCreditPricing.calculate(quality,duration)||0);
    if(!amount){var button=scope&&scope.querySelector("[data-adfilm-build]");amount=Number(button&&button.getAttribute("data-credit-cost")||0)}
    return{quality:quality,duration:duration,amount:Math.max(0,Math.trunc(amount))};
  }
  function applyCredits(value){
    if(typeof value!=="number"||!Number.isFinite(value))return;
    var node=document.getElementById("topCreditCount");if(node)node.textContent=String(value);
    try{if(window.AIVO_STORE_V1&&typeof window.AIVO_STORE_V1.setCredits==="function")window.AIVO_STORE_V1.setCredits(value)}catch(_){}
  }
  async function refreshCredits(fallback){
    if(typeof fallback==="number"&&Number.isFinite(fallback))applyCredits(fallback);
    try{
      var response=await fetch("/api/credits/get",{credentials:"include",cache:"no-store",headers:{"accept":"application/json"}});
      var data=await response.json().catch(function(){return null});
      if(data&&data.ok&&typeof data.credits==="number")applyCredits(data.credits);
    }catch(_){}
    try{window.syncCreditsUI&&window.syncCreditsUI({force:true})}catch(_){}
  }
  async function consumeCredit(scope,project){
    var quote=creditQuote(scope);
    if(!quote.amount)throw new Error("invalid_credit_amount");
    var requestId="adfilm:"+project+":"+Date.now()+":"+Math.random().toString(36).slice(2,8);
    debug("credit-consume:start",{projectId:project,requestId:requestId,amount:quote.amount,quality:quote.quality,duration:quote.duration});
    var response=await fetch("/api/credits/consume-ledger",{method:"POST",credentials:"include",cache:"no-store",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({app:CREDIT_APP,action:CREDIT_ACTION,cost:quote.amount,request_id:requestId,job_id:project,reason:CREDIT_ACTION})});
    var data=await response.json().catch(function(){return{ok:false,error:"non_json_response"}});
    if(!response.ok||!data||!data.ok){
      var error=new Error(clean(data&&data.error)||"credit_consume_failed");
      error.status=response.status;error.data=data||{};error.creditConsumeFailed=true;error.creditAmount=quote.amount;throw error;
    }
    var transactionId=clean(data.transaction_id||data.transaction&&data.transaction.id);
    if(!transactionId){var missing=new Error("credit_transaction_missing");missing.creditConsumeFailed=true;missing.creditAmount=quote.amount;throw missing}
    run.creditConsumed=true;
    run.creditAmount=quote.amount;
    run.creditAction=CREDIT_ACTION;
    run.creditRequestId=requestId;
    run.creditTransactionId=transactionId;
    run.creditStatus="consumed";
    run.creditQuality=quote.quality;
    run.creditDuration=quote.duration;
    window.__AIVO_AD_FILM_LAST_CONSUME_REQUEST_ID__=requestId;
    window.__AIVO_AD_FILM_LAST_TRANSACTION_ID__=transactionId;
    window.__AIVO_AD_FILM_LAST_CREDIT_COST__=quote.amount;
    window.__AIVO_AD_FILM_LAST_CREDIT_REASON__=CREDIT_ACTION;
    await refreshCredits(typeof data.credits==="number"?data.credits:null);
    notify(text(quote.amount+" kredi kullanıldı. Reklam filminiz hazırlanıyor.",quote.amount+" credits were used. Your advertising film is being prepared."),"success",5600);
    debug("credit-consume:success",{requestId:requestId,transactionId:transactionId,amount:quote.amount,credits:data.credits});
    return quote;
  }
  async function refundCredit(currentRun,error){
    if(!currentRun||!currentRun.creditConsumed||currentRun.creditRefunded||!clean(currentRun.creditTransactionId)||!Number(currentRun.creditAmount))return{ok:false,skipped:true};
    currentRun.creditRefundPending=true;
    var reason=clean(error&&error.message)||"adfilm_production_failed";
    debug("credit-refund:start",{requestId:currentRun.creditRequestId,transactionId:currentRun.creditTransactionId,amount:currentRun.creditAmount,reason:reason});
    try{
      var response=await fetch("/api/credits/refund",{method:"POST",credentials:"include",cache:"no-store",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({app:CREDIT_APP,action:currentRun.creditAction||CREDIT_ACTION,amount:Number(currentRun.creditAmount),request_id:currentRun.creditRequestId,job_id:currentRun.projectId,provider_job_id:currentRun.requestId||null,related_transaction_id:currentRun.creditTransactionId,reason:"adfilm_production_failed",meta:{source:"adfilm.production-controller",project_id:currentRun.projectId,quality:currentRun.creditQuality||"",duration:currentRun.creditDuration||"",aspect_ratio:currentRun.aspectRatio||"",provider_request_id:currentRun.requestId||"",error:reason}})});
      var data=await response.json().catch(function(){return null});
      if(response.ok&&data&&data.ok&&(data.refunded||data.deduped||data.skipped)){
        currentRun.creditRefunded=true;currentRun.creditRefundPending=false;currentRun.creditStatus="refunded";
        await refreshCredits(typeof data.credits==="number"?data.credits:null);
        debug("credit-refund:success",{transactionId:currentRun.creditTransactionId,amount:currentRun.creditAmount,data:data});
        return{ok:true,data:data};
      }
      currentRun.creditRefundPending=true;currentRun.creditStatus="refund_pending";
      debug("credit-refund:pending",{status:response.status,data:data});
      return{ok:false,data:data};
    }catch(refundError){
      currentRun.creditRefundPending=true;currentRun.creditStatus="refund_pending";
      console.error("[ADFILM] credit refund",refundError);
      return{ok:false,error:refundError};
    }
  }

  function musicMode(source){var mode=lower(source&&source.music&&source.music.mode||"auto");return mode==="off"||mode==="upload"?mode:"auto"}
  async function ensureMusic(scope,project){
    var source=activeProject()||{},mode=musicMode(source);if(mode!=="auto")return source;
    var profile=window.AIVOAdFilmMusicProfile||{};
    var body={projectId:project,musicStyle:clean(profile.style||scope.dataset.adfilmMusicStyle||source.music&&source.music.style||"auto")||"auto",musicEnergy:clean(profile.energy||scope.dataset.adfilmMusicEnergy||source.music&&source.music.energy||"balanced")||"balanced",duration:Number(selected(scope,"duration","15"))||15};
    debug("music-create",body);
    var created=await request("/api/ad-film/music/create",{method:"POST",body:JSON.stringify(body)},2);
    if(created.project)source=created.project;
    if(created.status!=="DISABLED"){
      for(var index=0;index<120;index++){
        var audio=source&&source.music&&source.music.audio&&source.music.audio.url;
        if(created.status==="COMPLETED"&&audio)break;
        await new Promise(function(resolve){setTimeout(resolve,1800)});
        var state=await request("/api/ad-film/music/status?projectId="+encodeURIComponent(project),{method:"GET"},2);
        if(state.project)source=state.project;
        if(state.status==="FAILED")throw new Error(clean(state.error||source.musicGeneration&&source.musicGeneration.error)||"music_generation_failed");
        if(state.status==="COMPLETED"&&source&&source.music&&source.music.audio&&source.music.audio.url)break;
      }
    }
    var current=activeProject()||{};
    window.AIVOAdFilmActiveProject=Object.assign({},current,{music:source.music||current.music||{},media:Object.assign({},current.media||{},source.media||{}),musicGeneration:source.musicGeneration||current.musicGeneration||null});
    debug("music-ready",{projectId:project});
    return window.AIVOAdFilmActiveProject;
  }

  function updateActiveFromResponse(data){
    if(!data||!data.project)return;
    var current=activeProject()||{};
    window.AIVOAdFilmActiveProject=Object.assign({},current,data.project,{__aivoCurrentProduction:true});
  }
  async function finalize(scope,project,data){
    run.stage=4;run.note="";renderStage(scope,4);
    var outputId=clean(data&&data.activeOutputId||data&&data.generation&&data.generation.outputId||data&&data.generation&&data.generation.requestId);
    var finalized=await request("/api/ad-film/seedance/finalize",{method:"POST",body:JSON.stringify({projectId:project,outputId:outputId})},3);
    if(!finalized||!finalized.project||!finalized.video_url)throw new Error("final_video_missing");
    window.AIVOAdFilmActiveProject=finalized.project;
    window.AIVOAdFilmGeneratedVideo=finalized.video_url;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:finalized.project,projectId:project,media:finalized.project.media||{},currentRun:true}}));
    if(run)run.creditStatus="completed";
    busy=false;stopElapsedClock();setSummary(scope,text("Reklam filmi hazır","Advertising film ready"));
    renderTerminal(scope,"success",text("Reklam filmi hazır","Advertising film ready"),text("Üretim ve final işlemleri tamamlandı.","Production and final processing are complete."));
    notify(text("Reklam filminiz hazır.","Your advertising film is ready."),"success");
    debug("completed",{projectId:project,videoUrl:finalized.video_url,creditTransactionId:run&&run.creditTransactionId||""});
    run=null;
  }
  async function poll(scope,project,count){
    if(!busy||!run)return;
    if(count>=POLL_MAX)throw new Error("generation_timeout");
    try{
      var data=await request("/api/ad-film/seedance/status?projectId="+encodeURIComponent(project),{method:"GET"},3);
      updateActiveFromResponse(data);
      if(data.status==="COMPLETED"&&data.video_url){await finalize(scope,project,data);return}
      if(data.status==="FAILED")throw new Error(clean(data.generation&&data.generation.error)||"generation_failed");
      run.stage=3;run.note=data.status==="IN_QUEUE"?text("Üretim kuyruğunda bekleniyor.","Waiting in the generation queue."):text("Sahneler ve görsel akış oluşturuluyor.","Scenes and the visual flow are being created.");
      renderStage(scope,3,run.note);
      setTimeout(function(){poll(scope,project,count+1).catch(function(error){fail(scope,error)})},POLL_MS);
    }catch(error){
      if(count<8){setTimeout(function(){poll(scope,project,count+1).catch(function(next){fail(scope,next)})},POLL_MS);return}
      throw error;
    }
  }
  async function fail(scope,error){
    if(!busy)return;
    var currentRun=run;
    busy=false;stopElapsedClock();
    console.error("[ADFILM] production controller",error,error&&error.data||"");

    if(!currentRun||!currentRun.creditConsumed){
      var creditFailure=!!(error&&error.creditConsumeFailed);
      var title=creditFailure?text("Kredi işlemi tamamlanamadı","Credit transaction could not be completed"):text("Üretim tamamlanamadı","Production could not be completed");
      var detail=creditFailure?text("Kredi düşmediği için üretim başlatılmadı.","Production was not started because the credits were not deducted."):clean(error&&error.message)||text("Tekrar deneyebilirsin.","You can try again.");
      renderTerminal(scope,"error",title,detail);
      if(creditFailure){
        var code=clean(error&&error.data&&error.data.error||error&&error.message);
        if(code.indexOf("insufficient")>=0)notify(text("Bu üretim için yeterli krediniz bulunmuyor.","You do not have enough credits for this production."),"warning",6200);
        else notify(text("Kredi kontrolü yapılamadı. Üretim başlatılmadı.","The credit check could not be completed. Production was not started."),"error",6200);
      }else notify(text("Reklam üretimi başlatılamadı. Tekrar dene.","Advertising production could not be started. Try again."),"error",6200);
      run=null;setTimeout(syncCreditPricing,0);return;
    }

    var refund=await refundCredit(currentRun,error);
    if(refund.ok){
      renderTerminal(scope,"error",text("Üretim tamamlanamadı","Production could not be completed"),text("Kullanılan "+currentRun.creditAmount+" kredi hesabınıza iade edildi.","The "+currentRun.creditAmount+" credits used were returned to your account."));
      notify(text("Üretim tamamlanamadı. Kullanılan "+currentRun.creditAmount+" kredi hesabınıza iade edildi.","Production could not be completed. The "+currentRun.creditAmount+" credits used were returned to your account."),"error",7200);
    }else{
      renderTerminal(scope,"error",text("Üretim tamamlanamadı","Production could not be completed"),text("Kredi iadesi kontrol ediliyor.","The credit refund is being checked."));
      notify(text("Üretim tamamlanamadı. Kredi iadesi kontrol ediliyor.","Production could not be completed. The credit refund is being checked."),"error",7200);
    }
    run=null;setTimeout(syncCreditPricing,0);
  }

  async function start(scope){
    if(busy)return;
    var references=collectReferences(scope);if(!validate(scope,references))return;
    var project=projectId(scope);if(!project){notify(text("Bulut projesi henüz hazır değil.","The cloud project is not ready yet."),"warning");return}
    var oldGeneration=generation(activeProject());
    run={projectId:project,startedAt:Date.now(),stage:1,note:"",previousRequestId:clean(oldGeneration.requestId),previousOutputId:clean(oldGeneration.outputId),creditConsumed:false,creditRefunded:false,creditRefundPending:false,creditStatus:"pending"};
    window.__AIVO_AD_FILM_CURRENT_RUN__=run;
    busy=true;setButton(scope,true);setSummary(scope,text("Kredi kontrol ediliyor","Checking credits"));debug("start",run);
    try{
      var quote=await consumeCredit(scope,project);
      run.aspectRatio=normalizeAspect(selected(scope,"aspectRatio","16:9"));
      renderStage(scope,1);startElapsedClock(scope);
      await ensureMusic(scope,project);
      var uploaded=await uploadInputs(scope,project,references);
      run.stage=2;run.note="";renderStage(scope,2);
      var quality=normalizeResolution(quote.quality||selected(scope,"quality","1080p"));
      var payload={projectId:project,prompt:buildPrompt(scope,references),image_urls:uploaded.image_urls,audio_urls:uploaded.audio_urls,logo_url:uploaded.logo_url,resolution:quality,duration:String(quote.duration||selected(scope,"duration","15")),aspect_ratio:run.aspectRatio,generate_audio:false,bitrate_mode:quality==="4k"?"high":"standard",reference_map:references.map};
      window.AIVOAdFilmSeedancePayload=payload;
      debug("seedance-create",{projectId:project,resolution:quality,duration:payload.duration,aspect_ratio:payload.aspect_ratio,imageCount:payload.image_urls.length,creditTransactionId:run.creditTransactionId});
      var created=await request("/api/ad-film/seedance/create",{method:"POST",body:JSON.stringify(payload)},3);
      updateActiveFromResponse(created);
      run.requestId=clean(created.request_id||created.generation&&created.generation.requestId);
      run.stage=3;run.note=text("Üretim kuyruğuna gönderildi.","Submitted to the generation queue.");renderStage(scope,3,run.note);
      poll(scope,project,0).catch(function(error){fail(scope,error)});
    }catch(error){fail(scope,error)}
  }

  window.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button)return;
    var guard=window.AIVOAdFilmNarrationBuildGuard&&typeof window.AIVOAdFilmNarrationBuildGuard.state==="function"?window.AIVOAdFilmNarrationBuildGuard.state():null;
    if(guard&&guard.ready===false)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    start(button.closest('[data-module-root][data-module="adfilm"]')||root());
  },true);

  function init(){var scope=root();if(scope)setTimeout(function(){resetIdle(scope)},80)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){resetIdle(event.detail.root||root())},120)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(init,80)});
  window.addEventListener("pagehide",function(){stopElapsedClock()});
  window.AIVOAdFilmProductionController={start:function(){var scope=root();if(scope)start(scope)},active:function(){return busy},state:function(){return run},reset:init};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();