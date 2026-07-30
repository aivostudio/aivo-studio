/* AIVO AI Reklam Filmi — atomic narration approval UI sync */
(function AIVO_AD_FILM_NARRATION_APPROVAL_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_APPROVAL_SYNC_V7__)return;
  window.__AIVO_AD_FILM_NARRATION_APPROVAL_SYNC_V7__=true;

  var approvalTask=null,busyMode="",busyTimer=null;

  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function projectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id)}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3800});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function paint(){return new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve)})})}
  function isBusy(){return window.__AIVO_AD_FILM_NARRATION_APPROVAL_BUSY__===true}

  function normalLabel(){return text("Sesi onayla","Approve voice")}
  function processingLabel(){return text("Ses işleniyor…","Processing voice…")}
  function pendingLabel(){return text("Onaylanıyor…","Approving…")}
  function approvedLabel(){return text("Onaylandı","Approved")}
  function processingMessage(){return text("Ses profesyonel olarak işleniyor. Hazır olduğunda otomatik onaylanacak.","The voice is being professionally processed. It will be approved automatically when ready.")}
  function approvingMessage(){return text("Ses onaylanıyor. Kısa süre bekle.","The voice is being approved. Please wait briefly.")}

  function setButton(button,mode){
    if(!button)return;
    button.classList.toggle("is-processing",mode==="processing");
    button.classList.toggle("is-approving",mode==="approving");
    button.classList.toggle("is-approved",mode==="approved");
    button.disabled=mode==="processing"||mode==="approving"||mode==="approved";
    button.setAttribute("aria-busy",mode==="processing"||mode==="approving"?"true":"false");
    button.setAttribute("aria-disabled",button.disabled?"true":"false");
    if(button.dataset.approvalMode===mode)return;
    button.dataset.approvalMode=mode;
    if(mode==="processing")button.innerHTML='<span class="adfilm-approve-spinner" aria-hidden="true"></span><span>'+processingLabel()+'</span>';
    else if(mode==="approving")button.innerHTML='<span class="adfilm-approve-spinner" aria-hidden="true"></span><span>'+pendingLabel()+'</span>';
    else button.textContent=mode==="approved"?approvedLabel():normalLabel();
  }

  function setPendingUi(scope,button,mode){
    setButton(button,mode);
    var panel=scope&&scope.querySelector('[data-adfilm-narration-engine]');
    var state=panel&&panel.querySelector('[data-narration-engine-state]');
    if(panel)panel.dataset.state="running";
    var message=mode==="processing"
      ?text("Ses profesyonel olarak işleniyor. Kısa süre bekle.","The voice is being professionally processed. Please wait briefly.")
      :approvingMessage();
    if(state&&state.textContent!==message)state.textContent=message;
  }

  function enforceBusyUi(){
    if(!isBusy())return;
    var scope=root();if(!scope)return;
    var panel=scope.querySelector('[data-adfilm-narration-engine]');
    var button=panel&&panel.querySelector('[data-narration-audio-approve]');
    setPendingUi(scope,button,busyMode||"approving");
  }

  function startBusy(scope,button,mode){
    busyMode=mode||"approving";
    window.__AIVO_AD_FILM_NARRATION_APPROVAL_BUSY__=true;
    setPendingUi(scope,button,busyMode);
    clearInterval(busyTimer);
    busyTimer=setInterval(enforceBusyUi,180);
  }

  function changeBusy(scope,button,mode){
    busyMode=mode||busyMode||"approving";
    if(isBusy())setPendingUi(scope,button,busyMode);
  }

  function stopBusy(){
    clearInterval(busyTimer);busyTimer=null;busyMode="";
    window.__AIVO_AD_FILM_NARRATION_APPROVAL_BUSY__=false;
  }

  function audioMode(project){
    var audio=project&&project.narration&&project.narration.audio||{};
    if(audio.approved===true)return"approved";
    if(audio.url&&!(audio.mastered===true&&Number(audio.masteringVersion)>=2))return"processing";
    return"ready";
  }

  function apply(scope,project){
    if(!scope||!project)return;
    window.AIVOAdFilmActiveProject=project;
    var audio=project.narration&&project.narration.audio||{};
    if(audio.approved===true)stopBusy();
    var panel=scope.querySelector('[data-adfilm-narration-engine]');
    var button=panel&&panel.querySelector('[data-narration-audio-approve]');
    var state=panel&&panel.querySelector('[data-narration-engine-state]');
    var mode=audioMode(project);
    if(panel)panel.dataset.state=mode==="processing"?"running":mode;
    setButton(button,mode);
    if(state){
      state.textContent=mode==="approved"
        ?text("Ses onaylandı.","Voice approved.")
        :mode==="processing"
          ?text("Ses profesyonel olarak işleniyor. Kısa süre bekle.","The voice is being professionally processed. Please wait briefly.")
          :text("Reklam sesi hazır. Dinleyip onaylayabilirsin.","The advertising voice is ready. Preview and approve it.");
    }
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:project,projectId:project.id||"",media:project.media||{}}}));
    [0,40,140].forEach(function(delay){setTimeout(function(){if(window.AIVOAdFilmNarrationBuildGuard&&typeof window.AIVOAdFilmNarrationBuildGuard.sync==="function")window.AIVOAdFilmNarrationBuildGuard.sync()},delay)});
  }

  async function waitForMastered(scope,button){
    for(var attempt=0;attempt<3;attempt++){
      var current=window.AIVOAdFilmActiveProject||{};
      var audio=current.narration&&current.narration.audio||{};
      if(audio.mastered===true&&Number(audio.masteringVersion)>=2)return current;

      var master=window.AIVOAdFilmNarrationMaster;
      if(!master||typeof master.run!=="function")throw new Error("narration_master_not_ready");
      changeBusy(scope,button,"processing");

      var result=null;
      if(typeof master.isBusy==="function"&&master.isBusy()&&typeof master.promise==="function"&&master.promise())result=await master.promise();
      else result=await master.run({silent:true,force:attempt>0});

      var next=result||window.AIVOAdFilmActiveProject||{};
      var masteredAudio=next.narration&&next.narration.audio||{};
      if(masteredAudio.mastered===true&&Number(masteredAudio.masteringVersion)>=2){
        window.AIVOAdFilmActiveProject=next;
        return next;
      }
      if(attempt<2)await sleep(1500);
    }
    throw new Error("narration_master_pending");
  }

  async function approveWhenReady(scope,button,id){
    try{
      await waitForMastered(scope,button);
      changeBusy(scope,button,"approving");
      await paint();
      var controller=new AbortController();
      var timeout=setTimeout(function(){controller.abort()},90000);
      try{
        var response=await fetch('/api/ad-film/narration/approve',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:id}),signal:controller.signal});
        var data=await response.json().catch(function(){return{}});
        if(!response.ok||!data.project)throw new Error(data.message||data.error||"approval_failed");
        stopBusy();
        apply(scope,data.project);
        notify(text("Ses onaylandı.","Voice approved."),"success");
      }finally{clearTimeout(timeout)}
    }catch(error){
      stopBusy();
      console.warn('[ADFILM] narration approval waiting',error);
      var latest=window.AIVOAdFilmActiveProject||{};
      var code=clean(error&&error.message);
      if(latest&&latest.id)apply(scope,latest);else setButton(button,"ready");
      if(error&&error.name==="AbortError")notify(text("Ses onayı beklenenden uzun sürdü. Biraz sonra tekrar dene.","Voice approval took longer than expected. Try again shortly."),"warning");
      else if(code.indexOf("master")>=0)notify(text("Ses işleme henüz tamamlanmadı. Birkaç saniye sonra tekrar deneyebilirsin.","Voice processing has not finished yet. You can try again in a few seconds."),"info");
      else notify(text("Ses onaylanamadı. Tekrar dene.","The voice could not be approved. Try again."),"warning");
    }finally{approvalTask=null}
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-narration-audio-approve]');
    if(!button||button.classList.contains("is-approved"))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(approvalTask||isBusy()){notify(processingMessage(),"info");return}

    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    var id=projectId(scope);if(!id){notify(text("Bulut proje bağlantısı hazır değil.","The cloud project connection is not ready."),"warning");return}
    var current=window.AIVOAdFilmActiveProject||{};
    var audio=current.narration&&current.narration.audio||{};
    var needsMastering=!(audio.mastered===true&&Number(audio.masteringVersion)>=2);
    var mode=needsMastering?"processing":"approving";

    startBusy(scope,button,mode);
    notify(needsMastering?processingMessage():approvingMessage(),"info");
    approvalTask=(async function(){
      await paint();
      await sleep(0);
      return approveWhenReady(scope,button,id);
    })();
  },true);

  document.addEventListener("aivo:adfilm-narration-mastering",function(event){
    var scope=root();if(!scope)return;
    var panel=scope.querySelector('[data-adfilm-narration-engine]');
    var button=panel&&panel.querySelector('[data-narration-audio-approve]');
    var status=event&&event.detail&&event.detail.status;
    if(status==="processing"||status==="retrying"){
      if(isBusy())changeBusy(scope,button,"processing");
    }else if(status==="completed"&&event.detail.project){
      window.AIVOAdFilmActiveProject=event.detail.project;
      if(isBusy())changeBusy(scope,button,"approving");else apply(scope,event.detail.project);
    }
  });

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){var scope=event.detail.root||root(),project=window.AIVOAdFilmActiveProject;if(scope&&project){if(isBusy())enforceBusyUi();else apply(scope,project)}},120)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var scope=root(),project=event&&event.detail&&event.detail.project;if(!scope||!project)return;
    window.AIVOAdFilmActiveProject=project;
    var approved=project.narration&&project.narration.audio&&project.narration.audio.approved===true;
    if(approved){apply(scope,project);return}
    if(isBusy()){
      setPendingUi(scope,scope.querySelector('[data-narration-audio-approve]'),busyMode||"approving");
      setTimeout(enforceBusyUi,0);
    }else apply(scope,project);
  });
})();
