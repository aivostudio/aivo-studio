/* AIVO AI Reklam Filmi — recover a stuck queued avatar generation without locking the page */
(function AIVO_AD_FILM_AVATAR_STUCK_RECOVERY(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_STUCK_RECOVERY_V1__)return;
  window.__AIVO_AD_FILM_AVATAR_STUCK_RECOVERY_V1__=true;

  var resetting=false;

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function clean(value){return String(value==null?"":value).trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function card(){var scope=root();return scope&&scope.querySelector('[data-adfilm-avatar-card]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function notify(message,type){try{if(typeof window.showToast==='function')return window.showToast(message,type||'info');var fn=window.toast&&window.toast[type||'info'];if(typeof fn==='function')return fn(message,{duration:4200})}catch(_){} }
  function busy(target){return !!(target&&(target.classList.contains('is-avatar-busy')||target.getAttribute('aria-busy')==='true'))}

  function fields(target){
    var result={};
    if(!target)return result;
    target.querySelectorAll('[data-avatar-field]').forEach(function(input){result[input.dataset.avatarField]=input.value});
    return result;
  }

  function makeRecoverable(){
    var target=card();
    if(!target||!busy(target)||resetting)return;
    var button=target.querySelector('[data-avatar-generate]');
    if(!button)return;
    button.disabled=false;
    button.dataset.avatarRecovery='1';
    button.title=text('Takılan üretimi temizlemek için tıkla','Click to clear the stuck generation');
    var label=button.querySelector('b');
    if(label&&!/Sıfırla|Reset/i.test(label.textContent||'')){
      var current=clean(label.textContent).replace(/\s*·\s*(İptal et|Cancel|Sıfırla|Reset).*$/i,'');
      label.textContent=(current||text('Avatar üretimi sürüyor…','Avatar generation is running…'))+text(' · Sıfırla',' · Reset');
    }
  }

  async function resetGeneration(target){
    if(resetting)return;
    var current=project();
    if(!current||!current.id){notify(text('Proje bağlantısı hazır değil.','The project connection is not ready.'),'warning');return}
    resetting=true;
    var button=target.querySelector('[data-avatar-generate]');
    var label=button&&button.querySelector('b');
    if(button)button.disabled=true;
    if(label)label.textContent=text('Takılan üretim temizleniyor…','Clearing stuck generation…');
    try{
      var selected=target.querySelector('[data-avatar-mode].is-selected');
      var nextAvatar=Object.assign({},current.avatar||{},fields(target),{
        enabled:!!(target.querySelector('[data-avatar-enabled]')||{}).checked,
        mode:selected?selected.dataset.avatarMode:'suggest',
        imageGeneration:null,
        pipeline:null,
        videoUrl:null
      });
      var response=await fetch('/api/ad-film/project?id='+encodeURIComponent(current.id),{
        method:'PATCH',credentials:'include',cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({project:{avatar:nextAvatar}})
      });
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.project)throw new Error(data.message||data.error||'avatar_reset_failed');
      window.AIVOAdFilmActiveProject=data.project;
      notify(text('Takılan avatar üretimi temizlendi. Sayfa yenileniyor…','The stuck avatar generation was cleared. Reloading…'),'success');
      setTimeout(function(){window.location.reload()},350);
    }catch(error){
      console.warn('[ADFILM] avatar stuck recovery',error);
      resetting=false;
      if(button)button.disabled=false;
      if(label)label.textContent=text('Üretim temizlenemedi · Tekrar dene','Could not clear generation · Try again');
      notify(text('Takılan avatar üretimi temizlenemedi. Tekrar dene.','The stuck avatar generation could not be cleared. Try again.'),'warning');
    }
  }

  window.addEventListener('click',function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-adfilm-avatar-card] [data-avatar-generate]');
    if(!button)return;
    var target=button.closest('[data-adfilm-avatar-card]');
    if(!busy(target)&&button.dataset.avatarRecovery!=='1')return;
    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
    resetGeneration(target);
  },true);

  document.addEventListener('aivo:adfilm-project-sync',function(){setTimeout(makeRecoverable,20)});
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(makeRecoverable,180)});

  var observer=new MutationObserver(function(){makeRecoverable()});
  if(document.body)observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-busy','disabled']});

  [0,120,350,900].forEach(function(delay){setTimeout(makeRecoverable,delay)});
})();
