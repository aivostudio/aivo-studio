/* AIVO AI Reklam Filmi — avatar direction fields */
(function AIVO_AD_FILM_AVATAR_DIRECTION(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_DIRECTION_V4__)return;
  window.__AIVO_AD_FILM_AVATAR_DIRECTION_V4__=true;

  var MAX=1000,TOTAL_MAX=2000,NEAR_LIMIT=900,saveTimer=null,saveSequence=0;
  var draft={directorNote:"",sceneDescription:""};
  var dirty={directorNote:false,sceneDescription:false};

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function escapeHtml(value){return String(value||"").replace(/[&<>'"]/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]})}
  function isDirectionName(name){return name==="directorNote"||name==="sceneDescription"}

  function seedDraft(state,force){
    state=state||{};
    ["directorNote","sceneDescription"].forEach(function(name){
      if(force||!dirty[name])draft[name]=clean(state[name]).slice(0,MAX);
    });
  }

  function markup(state){
    seedDraft(state,false);
    var director=draft.directorNote;
    var scene=draft.sceneDescription;
    var total=director.length+scene.length;
    return ''+
      '<section class="adfilm-avatar-direction" data-avatar-direction>'+
        '<div class="adfilm-avatar-direction__head">'+
          '<div><span>'+text('İSTEĞE BAĞLI','OPTIONAL')+'</span><h3>'+text('Avatar Yönetimi','Avatar Direction')+'</h3><p>'+text('Avatarın oyunculuğunu, kamera hareketini ve sahnesini tarif et. Boş bırakırsan AIVO yönetir.','Describe the performance, camera and scene. Leave blank for AIVO to direct automatically.')+'</p></div>'+
          '<div class="adfilm-avatar-direction__budget" data-avatar-direction-budget><b>'+text('Her alan en fazla 1000 karakter','Maximum 1000 characters per field')+'</b><small>'+text('Toplam','Total')+' <span data-avatar-direction-total>'+total+'</span> / '+TOTAL_MAX+'</small></div>'+
        '</div>'+
        '<div class="adfilm-avatar-direction__grid">'+
          '<label class="adfilm-avatar-prompt">'+
            '<span class="adfilm-avatar-prompt__label">'+text('Yönetmen Notu','Director Note')+'</span>'+
            '<textarea data-avatar-field="directorNote" maxlength="'+MAX+'" aria-describedby="avatar-director-warning" placeholder="'+escapeHtml(text('Örnek: Kamera alçak açıdan takip etsin. Avatar iki güçlü adım atsın, ürüne dönsün ve finalde kameraya güvenle baksın.','Example: Use a low-angle tracking shot. The avatar takes two confident steps, turns toward the product and finishes looking directly at camera.'))+'">'+escapeHtml(director)+'</textarea>'+
            '<small class="adfilm-avatar-prompt__count"><span data-avatar-direction-count="directorNote">'+director.length+'</span> / '+MAX+'</small>'+
            '<em id="avatar-director-warning" class="adfilm-avatar-prompt__warning" data-avatar-direction-warning="directorNote" role="status" aria-live="polite"></em>'+
          '</label>'+
          '<label class="adfilm-avatar-prompt">'+
            '<span class="adfilm-avatar-prompt__label">'+text('Sahneni Anlat','Describe Your Scene')+'</span>'+
            '<textarea data-avatar-field="sceneDescription" maxlength="'+MAX+'" aria-describedby="avatar-scene-warning" placeholder="'+escapeHtml(text('Örnek: Gece, neon ışıklı modern bir stüdyo. Avatar ürün standının yanında yürür, kulaklığı eline alır ve premium bir reklam sunumu yapar.','Example: A modern neon-lit studio at night. The avatar walks beside the product stand, picks up the headphones and delivers a premium commercial presentation.'))+'">'+escapeHtml(scene)+'</textarea>'+
            '<small class="adfilm-avatar-prompt__count"><span data-avatar-direction-count="sceneDescription">'+scene.length+'</span> / '+MAX+'</small>'+
            '<em id="avatar-scene-warning" class="adfilm-avatar-prompt__warning" data-avatar-direction-warning="sceneDescription" role="status" aria-live="polite"></em>'+
          '</label>'+
        '</div>'+
      '</section>';
  }

  function updateFieldState(scope,area){
    if(area.value.length>MAX)area.value=area.value.slice(0,MAX);
    var length=area.value.length;
    var name=area.dataset.avatarField;
    var counter=scope.querySelector('[data-avatar-direction-count="'+name+'"]');
    var warning=scope.querySelector('[data-avatar-direction-warning="'+name+'"]');
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
    var total=0;
    scope.querySelectorAll('[data-avatar-direction] textarea[data-avatar-field]').forEach(function(area){
      updateFieldState(scope,area);
      total+=area.value.length;
    });
    var totalCounter=scope.querySelector('[data-avatar-direction-total]');
    var budget=scope.querySelector('[data-avatar-direction-budget]');
    if(totalCounter)totalCounter.textContent=String(Math.min(total,TOTAL_MAX));
    if(budget){
      budget.classList.toggle('is-near-limit',total>=1800&&total<TOTAL_MAX);
      budget.classList.toggle('is-at-limit',total>=TOTAL_MAX);
    }
  }

  function captureArea(area){
    if(!area||!isDirectionName(area.dataset.avatarField))return;
    var name=area.dataset.avatarField;
    if(area.value.length>MAX)area.value=area.value.slice(0,MAX);
    draft[name]=area.value;
    dirty[name]=true;
  }

  function applyDraftToDom(card){
    if(!card)return;
    ["directorNote","sceneDescription"].forEach(function(name){
      var area=card.querySelector('[data-avatar-direction] [data-avatar-field="'+name+'"]');
      if(!area)return;
      var next=dirty[name]?draft[name]:area.value;
      if(area.value!==next)area.value=next;
    });
    syncCounters(card);
  }

  async function saveDraft(sequence){
    var current=project();
    if(!current||!current.id)return;
    var avatar=Object.assign({},current.avatar||{}, {
      directorNote:draft.directorNote.slice(0,MAX),
      sceneDescription:draft.sceneDescription.slice(0,MAX)
    });
    var sent={directorNote:avatar.directorNote,sceneDescription:avatar.sceneDescription};
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
      ["directorNote","sceneDescription"].forEach(function(name){
        if(clean(saved[name])===clean(sent[name])&&draft[name]===sent[name])dirty[name]=false;
      });
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
    ["directorNote","sceneDescription"].forEach(function(name){
      var serverValue=clean(avatar[name]).slice(0,MAX);
      if(dirty[name]){
        if(serverValue===clean(draft[name]))dirty[name]=false;
      }else{
        draft[name]=serverValue;
      }
      var area=card.querySelector('[data-avatar-direction] [data-avatar-field="'+name+'"]');
      if(!area)return;
      var next=dirty[name]?draft[name]:serverValue;
      if(area.value!==next)area.value=next;
    });
    syncCounters(card);
  }

  document.addEventListener('beforeinput',function(event){
    var area=event.target&&event.target.closest&&event.target.closest('[data-avatar-direction] textarea[data-avatar-field]');
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
    var area=event.target&&event.target.closest&&event.target.closest('[data-avatar-direction] textarea[data-avatar-field]');
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
    var area=event.target&&event.target.closest&&event.target.closest('[data-avatar-direction] textarea[data-avatar-field]');
    if(!area)return;
    var card=area.closest('[data-adfilm-avatar-card]');
    captureArea(area);
    syncCounters(card);
    requestSave(false);
  },true);

  document.addEventListener('blur',function(event){
    var area=event.target&&event.target.closest&&event.target.closest('[data-avatar-direction] textarea[data-avatar-field]');
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
