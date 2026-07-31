/* AIVO AI Reklam Filmi — avatar director note */
(function AIVO_AD_FILM_AVATAR_DIRECTION(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_DIRECTION_V5__)return;
  window.__AIVO_AD_FILM_AVATAR_DIRECTION_V5__=true;

  var MAX=1000,NEAR_LIMIT=900,saveTimer=null,saveSequence=0;
  var draft={directorNote:""};
  var dirty={directorNote:false};

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function escapeHtml(value){return String(value||"").replace(/[&<>'"]/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]})}

  function seedDraft(state,force){
    state=state||{};
    if(force||!dirty.directorNote)draft.directorNote=clean(state.directorNote).slice(0,MAX);
  }

  function markup(state){
    seedDraft(state,false);
    var director=draft.directorNote;
    return ''+
      '<section class="adfilm-avatar-direction is-single" data-avatar-direction>'+
        '<div class="adfilm-avatar-direction__head">'+
          '<div><span>'+text('İSTEĞE BAĞLI','OPTIONAL')+'</span><h3>'+text('Avatar Yönetimi','Avatar Direction')+'</h3><p>'+text('Avatarın oyunculuğunu, el hareketlerini, kamera takibini ve final pozunu tarif et. Boş bırakırsan AIVO yönetir.','Describe the avatar performance, gestures, camera tracking and final pose. Leave blank for AIVO to direct automatically.')+'</p></div>'+
          '<div class="adfilm-avatar-direction__budget" data-avatar-direction-budget><b>'+text('En fazla 1000 karakter','Maximum 1000 characters')+'</b></div>'+
        '</div>'+
        '<div class="adfilm-avatar-direction__grid">'+
          '<label class="adfilm-avatar-prompt">'+
            '<span class="adfilm-avatar-prompt__label">'+text('Yönetmen Notu','Director Note')+'</span>'+
            '<textarea data-avatar-field="directorNote" maxlength="'+MAX+'" aria-describedby="avatar-director-warning" placeholder="'+escapeHtml(text('Örnek: Avatar konuşma boyunca doğal el hareketleri kullansın, ürünü kapatmadan kameraya göstersin ve finalde güven veren temiz bir poz versin.','Example: Use natural gestures while speaking, present the product without covering it and finish with a clean, confident pose.'))+'">'+escapeHtml(director)+'</textarea>'+
            '<small class="adfilm-avatar-prompt__count"><span data-avatar-direction-count="directorNote">'+director.length+'</span> / '+MAX+'</small>'+
            '<em id="avatar-director-warning" class="adfilm-avatar-prompt__warning" data-avatar-direction-warning="directorNote" role="status" aria-live="polite"></em>'+
          '</label>'+
        '</div>'+
      '</section>';
  }

  function updateFieldState(scope,area){
    if(area.value.length>MAX)area.value=area.value.slice(0,MAX);
    var length=area.value.length;
    var counter=scope.querySelector('[data-avatar-direction-count="directorNote"]');
    var warning=scope.querySelector('[data-avatar-direction-warning="directorNote"]');
    var label=area.closest('.adfilm-avatar-prompt');
    if(counter)counter.textContent=String(length);
    if(label){
      label.classList.toggle('is-near-limit',length>=NEAR_LIMIT&&length<MAX);
      label.classList.toggle('is-at-limit',length>=MAX);
    }
    if(warning){
      if(length>=MAX)warning.textContent=text('1000 karakter sınırına ulaştın.','You reached the 1000 character limit.');
      else if(length>=NEAR_LIMIT)warning.textContent=text('Sınıra yaklaştın: ','Approaching the limit: ')+(MAX-length)+' '+text('karakter kaldı.','characters left.');
      else warning.textContent='';
    }
  }

  function syncCounters(scope){
    scope=scope||document;
    var area=scope.querySelector('[data-avatar-direction] textarea[data-avatar-field="directorNote"]');
    if(area)updateFieldState(scope,area);
  }

  function captureArea(area){
    if(!area||area.dataset.avatarField!=="directorNote")return;
    if(area.value.length>MAX)area.value=area.value.slice(0,MAX);
    draft.directorNote=area.value;
    dirty.directorNote=true;
  }

  async function saveDraft(sequence){
    var current=project();
    if(!current||!current.id)return;
    var avatar=Object.assign({},current.avatar||{}, {
      directorNote:draft.directorNote.slice(0,MAX)
    });
    var sent=avatar.directorNote;
    try{
      var response=await fetch('/api/ad-film/project?id='+encodeURIComponent(current.id),{
        method:'PATCH',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({project:{avatar:avatar}})
      });
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.project)throw new Error(data.message||data.error||'avatar_direction_save_failed');
      if(sequence!==saveSequence)return;
      window.AIVOAdFilmActiveProject=data.project;
      var saved=data.project.avatar||{};
      if(clean(saved.directorNote)===clean(sent)&&draft.directorNote===sent)dirty.directorNote=false;
      document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:data.project,projectId:data.project.id||'',media:data.project.media||{}}}));
    }catch(error){
      console.warn('[ADFILM] avatar direction save',error);
    }
  }

  function requestSave(immediate){
    clearTimeout(saveTimer);
    var sequence=++saveSequence;
    saveTimer=setTimeout(function(){saveDraft(sequence)},immediate?0:350);
  }

  function mount(){
    var card=document.querySelector('[data-module-root][data-module="adfilm"] [data-adfilm-avatar-card]');
    if(!card||card.querySelector('[data-avatar-direction]'))return;
    var state=project()&&project().avatar||{};
    seedDraft(state,false);
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
    var serverValue=clean(avatar.directorNote).slice(0,MAX);
    if(dirty.directorNote){
      if(serverValue===clean(draft.directorNote))dirty.directorNote=false;
    }else{
      draft.directorNote=serverValue;
    }
    var area=card.querySelector('[data-avatar-direction] [data-avatar-field="directorNote"]');
    if(area){
      var next=dirty.directorNote?draft.directorNote:serverValue;
      if(area.value!==next)area.value=next;
    }
    syncCounters(card);
  }

  document.addEventListener('beforeinput',function(event){
    var area=event.target&&event.target.closest&&event.target.closest('[data-avatar-direction] textarea[data-avatar-field="directorNote"]');
    if(!area||!event.inputType||event.inputType.indexOf('insert')!==0||event.isComposing)return;
    var start=Number.isFinite(area.selectionStart)?area.selectionStart:area.value.length;
    var end=Number.isFinite(area.selectionEnd)?area.selectionEnd:start;
    var incoming=typeof event.data==='string'?event.data.length:0;
    if(incoming&&area.value.length-(end-start)+incoming>MAX){
      event.preventDefault();
      var allowed=Math.max(0,MAX-(area.value.length-(end-start)));
      if(allowed>0)area.setRangeText(String(event.data).slice(0,allowed),start,end,'end');
      captureArea(area);
      syncCounters(area.closest('[data-adfilm-avatar-card]')||document);
      requestSave(false);
    }
  },true);

  document.addEventListener('paste',function(event){
    var area=event.target&&event.target.closest&&event.target.closest('[data-avatar-direction] textarea[data-avatar-field="directorNote"]');
    if(!area)return;
    var pasted=event.clipboardData&&event.clipboardData.getData('text');
    if(typeof pasted!=='string')return;
    var start=Number.isFinite(area.selectionStart)?area.selectionStart:area.value.length;
    var end=Number.isFinite(area.selectionEnd)?area.selectionEnd:start;
    var allowed=Math.max(0,MAX-(area.value.length-(end-start)));
    if(pasted.length<=allowed)return;
    event.preventDefault();
    area.setRangeText(pasted.slice(0,allowed),start,end,'end');
    captureArea(area);
    syncCounters(area.closest('[data-adfilm-avatar-card]')||document);
    requestSave(false);
  },true);

  document.addEventListener('input',function(event){
    var area=event.target&&event.target.closest&&event.target.closest('[data-avatar-direction] textarea[data-avatar-field="directorNote"]');
    if(!area)return;
    captureArea(area);
    syncCounters(area.closest('[data-adfilm-avatar-card]')||document);
    requestSave(false);
  },true);

  document.addEventListener('blur',function(event){
    var area=event.target&&event.target.closest&&event.target.closest('[data-avatar-direction] textarea[data-avatar-field="directorNote"]');
    if(!area)return;
    captureArea(area);
    requestSave(true);
  },true);

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(mount,140);
  });
  document.addEventListener('aivo:adfilm-project-sync',function(event){
    refresh(event&&event.detail&&event.detail.project||project());
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(mount,240)},{once:true});
  else setTimeout(mount,240);
})();
