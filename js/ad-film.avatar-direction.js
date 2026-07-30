/* AIVO AI Reklam Filmi — avatar direction fields */
(function AIVO_AD_FILM_AVATAR_DIRECTION(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_DIRECTION_V2__)return;
  window.__AIVO_AD_FILM_AVATAR_DIRECTION_V2__=true;

  var MAX=700,saveTimer=null;
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function escapeHtml(value){return String(value||"").replace(/[&<>'"]/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]})}

  function markup(state){
    var director=clean(state&&state.directorNote).slice(0,MAX);
    var scene=clean(state&&state.sceneDescription).slice(0,MAX);
    return ''+
      '<section class="adfilm-avatar-direction" data-avatar-direction>'+
        '<div class="adfilm-avatar-direction__head">'+
          '<div><span>'+text('İSTEĞE BAĞLI','OPTIONAL')+'</span><h3>'+text('Avatar Yönetimi','Avatar Direction')+'</h3><p>'+text('Avatarın oyunculuğunu, kamera hareketini ve sahnesini tarif et. Boş bırakırsan AIVO yönetir.','Describe the performance, camera and scene. Leave blank for AIVO to direct automatically.')+'</p></div>'+
        '</div>'+
        '<div class="adfilm-avatar-direction__grid">'+
          '<label class="adfilm-avatar-prompt">'+
            '<span class="adfilm-avatar-prompt__label">'+text('Yönetmen Notu','Director Note')+'</span>'+
            '<textarea data-avatar-field="directorNote" maxlength="'+MAX+'" placeholder="'+escapeHtml(text('Örnek: Kamera alçak açıdan takip etsin. Avatar iki güçlü adım atsın, ürüne dönsün ve finalde kameraya güvenle baksın.','Example: Use a low-angle tracking shot. The avatar takes two confident steps, turns toward the product and finishes looking directly at camera.'))+'">'+escapeHtml(director)+'</textarea>'+
            '<small><span data-avatar-direction-count="directorNote">'+director.length+'</span> / '+MAX+'</small>'+
          '</label>'+
          '<label class="adfilm-avatar-prompt">'+
            '<span class="adfilm-avatar-prompt__label">'+text('Sahneni Anlat','Describe Your Scene')+'</span>'+
            '<textarea data-avatar-field="sceneDescription" maxlength="'+MAX+'" placeholder="'+escapeHtml(text('Örnek: Gece, neon ışıklı modern bir stüdyo. Avatar ürün standının yanında yürür, kulaklığı eline alır ve premium bir reklam sunumu yapar.','Example: A modern neon-lit studio at night. The avatar walks beside the product stand, picks up the headphones and delivers a premium commercial presentation.'))+'">'+escapeHtml(scene)+'</textarea>'+
            '<small><span data-avatar-direction-count="sceneDescription">'+scene.length+'</span> / '+MAX+'</small>'+
          '</label>'+
        '</div>'+
      '</section>';
  }

  function syncCounters(scope){
    (scope||document).querySelectorAll('[data-avatar-direction] textarea[data-avatar-field]').forEach(function(area){
      var counter=(scope||document).querySelector('[data-avatar-direction-count="'+area.dataset.avatarField+'"]');
      if(counter)counter.textContent=String(area.value.length);
    });
  }

  function requestSave(area){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(function(){
      if(!area||!area.isConnected)return;
      area.dispatchEvent(new Event('change',{bubbles:true}));
    },650);
  }

  function mount(){
    var card=document.querySelector('[data-module-root][data-module="adfilm"] [data-adfilm-avatar-card]');
    if(!card||card.querySelector('[data-avatar-direction]'))return;
    var state=project()&&project().avatar||{};
    var holder=document.createElement('div');holder.innerHTML=markup(state);
    var section=holder.firstElementChild;
    var preview=card.querySelector('[data-avatar-preview]');
    if(preview)preview.insertAdjacentElement('beforebegin',section);
    else card.querySelector('[data-avatar-body]')?.appendChild(section);
    syncCounters(card);
  }

  function refresh(projectValue){
    var card=document.querySelector('[data-module-root][data-module="adfilm"] [data-adfilm-avatar-card]');
    if(!card)return;
    mount();
    var avatar=projectValue&&projectValue.avatar||{};
    ['directorNote','sceneDescription'].forEach(function(name){
      var area=card.querySelector('[data-avatar-field="'+name+'"]');
      if(!area||document.activeElement===area)return;
      var next=clean(avatar[name]).slice(0,MAX);
      if(area.value!==next)area.value=next;
    });
    syncCounters(card);
  }

  document.addEventListener('input',function(event){
    var area=event.target&&event.target.closest&&event.target.closest('[data-avatar-direction] textarea[data-avatar-field]');
    if(!area)return;
    var card=area.closest('[data-adfilm-avatar-card]');
    syncCounters(card);
    requestSave(area);
  },true);

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(mount,140);
  });
  document.addEventListener('aivo:adfilm-project-sync',function(event){
    setTimeout(function(){refresh(event&&event.detail&&event.detail.project||project())},60);
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(mount,240)},{once:true});
  else setTimeout(mount,240);
})();
