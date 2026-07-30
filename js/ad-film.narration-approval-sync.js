/* AIVO AI Reklam Filmi — atomic narration approval UI sync */
(function AIVO_AD_FILM_NARRATION_APPROVAL_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_APPROVAL_SYNC_V3__)return;
  window.__AIVO_AD_FILM_NARRATION_APPROVAL_SYNC_V3__=true;

  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function projectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id)}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3400});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }

  function normalLabel(){return text("Sesi onayla","Approve voice")}
  function pendingLabel(){return text("Onaylanıyor…","Approving…")}
  function approvedLabel(){return text("Onaylandı","Approved")}

  function setButton(button,mode){
    if(!button)return;
    button.classList.toggle("is-approving",mode==="approving");
    button.classList.toggle("is-approved",mode==="approved");
    button.disabled=mode==="approving"||mode==="approved";
    button.setAttribute("aria-busy",mode==="approving"?"true":"false");
    if(mode==="approving")button.innerHTML='<span class="adfilm-approve-spinner" aria-hidden="true"></span><span>'+pendingLabel()+'</span>';
    else button.textContent=mode==="approved"?approvedLabel():normalLabel();
  }

  function apply(scope,project){
    if(!scope||!project)return;
    window.AIVOAdFilmActiveProject=project;
    var audio=project.narration&&project.narration.audio||{};
    var panel=scope.querySelector('[data-adfilm-narration-engine]');
    var button=panel&&panel.querySelector('[data-narration-audio-approve]');
    var state=panel&&panel.querySelector('[data-narration-engine-state]');
    if(panel)panel.dataset.state=audio.approved?"approved":"ready";
    setButton(button,audio.approved?"approved":"ready");
    if(state)state.textContent=audio.approved?text("Ses onaylandı.","Voice approved."):text("Reklam sesi hazır. Dinleyip onaylayabilirsin.","The advertising voice is ready. Preview and approve it.");
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:project,projectId:project.id||"",media:project.media||{}}}));
    [0,40,140].forEach(function(delay){setTimeout(function(){if(window.AIVOAdFilmNarrationBuildGuard&&typeof window.AIVOAdFilmNarrationBuildGuard.sync==="function")window.AIVOAdFilmNarrationBuildGuard.sync()},delay)});
  }

  async function ensureMastered(button){
    var current=window.AIVOAdFilmActiveProject||{};
    var audio=current.narration&&current.narration.audio||{};
    if(audio.mastered===true&&Number(audio.masteringVersion)>=2)return current;
    var master=window.AIVOAdFilmNarrationMaster;
    if(!master||typeof master.run!=="function")throw new Error("narration_master_not_ready");
    setButton(button,"approving");
    var mastered=await master.run({silent:true,force:true});
    if(!mastered||!mastered.narration||!mastered.narration.audio||mastered.narration.audio.mastered!==true)throw new Error("narration_master_failed");
    window.AIVOAdFilmActiveProject=mastered;
    setButton(button,"approving");
    return mastered;
  }

  document.addEventListener("click",async function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-narration-audio-approve]');
    if(!button||button.classList.contains("is-approved")||button.classList.contains("is-approving"))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    var id=projectId(scope);if(!id){notify(text("Bulut proje bağlantısı hazır değil.","The cloud project connection is not ready."),"warning");return}

    setButton(button,"approving");
    var controller=new AbortController();
    var timeout=setTimeout(function(){controller.abort()},90000);
    try{
      await ensureMastered(button);
      var response=await fetch('/api/ad-film/narration/approve',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:id}),signal:controller.signal});
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.project)throw new Error(data.message||data.error||"approval_failed");
      apply(scope,data.project);
      notify(text("Ses onaylandı.","Voice approved."),"success");
    }catch(error){
      console.error('[ADFILM] atomic narration approval',error);
      setButton(button,"ready");
      var code=clean(error&&error.message);
      var message=error&&error.name==="AbortError"
        ?text("Ses hazırlanması beklenenden uzun sürdü. Tekrar dene.","Voice preparation took too long. Try again.")
        :code.indexOf("master")>=0
          ?text("Ses işleme tamamlanamadı. Tekrar dene.","Voice mastering could not be completed. Try again.")
          :text("Ses onaylanamadı. Tekrar dene.","The voice could not be approved. Try again.");
      notify(message,"error");
    }finally{clearTimeout(timeout)}
  },true);
})();
