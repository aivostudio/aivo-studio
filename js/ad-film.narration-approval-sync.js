/* AIVO AI Reklam Filmi — atomic narration approval UI sync */
(function AIVO_AD_FILM_NARRATION_APPROVAL_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_APPROVAL_SYNC_V1__)return;
  window.__AIVO_AD_FILM_NARRATION_APPROVAL_SYNC_V1__=true;

  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function projectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id)}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3400});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }

  function apply(scope,project){
    if(!scope||!project)return;
    window.AIVOAdFilmActiveProject=project;
    var audio=project.narration&&project.narration.audio||{};
    var panel=scope.querySelector('[data-adfilm-narration-engine]');
    var button=panel&&panel.querySelector('[data-narration-audio-approve]');
    var state=panel&&panel.querySelector('[data-narration-engine-state]');
    if(panel)panel.dataset.state=audio.approved?"approved":"ready";
    if(button){button.disabled=!!audio.approved;button.classList.toggle("is-approved",!!audio.approved);button.textContent=audio.approved?text("Onaylandı","Approved"):text("Sesi onayla","Approve voice")}
    if(state)state.textContent=audio.approved?text("Ses onaylandı.","Voice approved."):text("Reklam sesi hazır. Dinleyip onaylayabilirsin.","The advertising voice is ready. Preview and approve it.");
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:project,projectId:project.id||"",media:project.media||{}}}));
    [0,40,140].forEach(function(delay){setTimeout(function(){if(window.AIVOAdFilmNarrationBuildGuard&&typeof window.AIVOAdFilmNarrationBuildGuard.sync==="function")window.AIVOAdFilmNarrationBuildGuard.sync()},delay)});
  }

  document.addEventListener("click",async function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-narration-audio-approve]');
    if(!button||button.classList.contains("is-approved"))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    var id=projectId(scope);if(!id){notify(text("Bulut proje bağlantısı hazır değil.","The cloud project connection is not ready."),"warning");return}
    button.disabled=true;
    try{
      var response=await fetch('/api/ad-film/narration/approve',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:id})});
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.project)throw new Error(data.error||"approval_failed");
      apply(scope,data.project);
      notify(text("Ses onaylandı.","Voice approved."),"success");
    }catch(error){
      console.error('[ADFILM] atomic narration approval',error);
      button.disabled=false;
      notify(text("Ses onaylanamadı. Tekrar dene.","The voice could not be approved. Try again."),"error");
    }
  },true);
})();
