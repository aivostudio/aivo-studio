/* AIVO AI Reklam Filmi — approve only an already mastered narration */
(function AIVO_AD_FILM_NARRATION_APPROVAL_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_APPROVAL_SYNC_V9__)return;
  window.__AIVO_AD_FILM_NARRATION_APPROVAL_SYNC_V9__=true;

  var task=null;

  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function projectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id)}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3600});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function paint(){return new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve)})})}

  function setPending(scope,button){
    if(button){
      button.disabled=true;
      button.classList.remove("is-approved");
      button.classList.add("is-approving");
      button.setAttribute("aria-busy","true");
      button.innerHTML='<span class="adfilm-approve-spinner" aria-hidden="true"></span><span>'+text("Onaylanıyor…","Approving…")+'</span>';
    }
    var panel=scope&&scope.querySelector('[data-adfilm-narration-engine]');
    var state=panel&&panel.querySelector('[data-narration-engine-state]');
    if(panel)panel.dataset.state="running";
    if(state)state.textContent=text("Ses onaylanıyor…","Approving voice…");
  }

  function setApproved(scope,button,project){
    window.AIVOAdFilmActiveProject=project;
    if(button){
      button.disabled=true;
      button.classList.remove("is-approving","is-processing");
      button.classList.add("is-approved");
      button.setAttribute("aria-busy","false");
      button.textContent=text("Onaylandı","Approved");
    }
    var panel=scope&&scope.querySelector('[data-adfilm-narration-engine]');
    var state=panel&&panel.querySelector('[data-narration-engine-state]');
    if(panel)panel.dataset.state="approved";
    if(state)state.textContent=text("Ses onaylandı.","Voice approved.");
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:project,projectId:project.id||"",media:project.media||{}}}));
    if(window.AIVOAdFilmNarrationBuildGuard&&typeof window.AIVOAdFilmNarrationBuildGuard.sync==="function")window.AIVOAdFilmNarrationBuildGuard.sync();
  }

  function setReady(scope,button,project){
    if(project)window.AIVOAdFilmActiveProject=project;
    if(button){
      button.disabled=false;
      button.classList.remove("is-approving","is-processing","is-approved");
      button.setAttribute("aria-busy","false");
      button.textContent=text("Sesi onayla","Approve voice");
    }
    var panel=scope&&scope.querySelector('[data-adfilm-narration-engine]');
    var state=panel&&panel.querySelector('[data-narration-engine-state]');
    if(panel)panel.dataset.state="ready";
    if(state)state.textContent=text("Reklam sesi hazır. Dinleyip onaylayabilirsin.","The advertising voice is ready. Preview and approve it.");
  }

  async function approve(scope,button,id){
    var current=window.AIVOAdFilmActiveProject||{};
    var audio=current.narration&&current.narration.audio||{};
    if(!(audio.url&&audio.mastered===true&&Number(audio.masteringVersion)>=2)){
      setReady(scope,button,current);
      notify(text("Ses henüz hazır değil. Yeniden üret işleminin tamamlanmasını bekle.","The voice is not ready yet. Wait for generation to finish."),"warning");
      task=null;
      return;
    }

    setPending(scope,button);
    await paint();
    try{
      var response=await fetch('/api/ad-film/narration/approve',{
        method:'POST',credentials:'include',cache:'no-store',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:id})
      });
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.project)throw new Error(data.message||data.error||"approval_failed");
      setApproved(scope,button,data.project);
      notify(text("Ses onaylandı.","Voice approved."),"success");
    }catch(error){
      console.warn('[ADFILM] narration approval',error);
      setReady(scope,button,window.AIVOAdFilmActiveProject||null);
      notify(text("Ses onaylanamadı. Tekrar deneyebilirsin.","The voice could not be approved. Try again."),"warning");
    }finally{task=null}
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-narration-audio-approve]');
    if(!button||button.classList.contains("is-approved"))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(task)return;
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    var id=projectId(scope);
    if(!id){notify(text("Bulut proje bağlantısı hazır değil.","The cloud project connection is not ready."),"warning");return}
    task=approve(scope,button,id);
  },true);

  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var scope=root(),project=event&&event.detail&&event.detail.project;if(!scope||!project)return;
    window.AIVOAdFilmActiveProject=project;
    if(task)return;
    var audio=project.narration&&project.narration.audio||{};
    var button=scope.querySelector('[data-narration-audio-approve]');
    if(audio.approved===true)setApproved(scope,button,project);
    else if(audio.url&&audio.mastered===true)setReady(scope,button,project);
  });
})();
