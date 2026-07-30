/* AIVO AI Reklam Filmi — avatar source, safety and project persistence */
(function AIVO_AD_FILM_AVATAR(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_V1__)return;
  window.__AIVO_AD_FILM_AVATAR_V1__=true;

  var busy=false,saveTimer=null;
  var COUNTRIES=[
    ["tr","Türkiye","Turkey"],["us","Amerika","United States"],["de","Almanya","Germany"],
    ["fr","Fransa","France"],["es","İspanya","Spain"],["it","İtalya","Italy"],
    ["br","Brezilya","Brazil"],["arab","Arap ülkeleri","Arab countries"],["ru","Rusya","Russia"],
    ["nl","Hollanda","Netherlands"],["pl","Polonya","Poland"],["ua","Ukrayna","Ukraine"],
    ["in","Hindistan","India"],["id","Endonezya","Indonesia"],["my","Malezya","Malaysia"],
    ["jp","Japonya","Japan"],["kr","Güney Kore","South Korea"],["cn","Çin","China"],
    ["vn","Vietnam","Vietnam"],["th","Tayland","Thailand"]
  ];

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3900});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function escapeHtml(value){return String(value||"").replace(/[&<>'"]/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]})}
  function svgUser(){return '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'}
  function svgUpload(){return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'}

  function countryOptions(selected){return COUNTRIES.map(function(item){return '<option value="'+item[0]+'"'+(item[0]===selected?' selected':'')+'>'+escapeHtml(english()?item[2]:item[1])+'</option>'}).join("")}
  function option(value,tr,en,current){return '<option value="'+value+'"'+(value===current?' selected':'')+'>'+escapeHtml(text(tr,en))+'</option>'}

  function defaults(){return{enabled:false,mode:"upload",country:"tr",gender:"female",age:"26-35",hairColor:"brown",hairStyle:"medium",framing:"chest",expression:"friendly",outfit:"business",image:null}}
  function avatarState(){return Object.assign(defaults(),project()&&project().avatar||{})}

  function markup(state){
    var image=state.image&&state.image.url?state.image:null;
    return ''+
      '<article class="adfilm-card adfilm-card--avatar" data-adfilm-avatar-card>'+
        '<div class="adfilm-card__head">'+
          '<span class="adfilm-card__icon" aria-hidden="true">'+svgUser()+'</span>'+
          '<div class="adfilm-card__heading"><span class="adfilm-card__eyebrow" data-avatar-step>05</span><h2>'+text("Avatar","Avatar")+'</h2><p>'+text("Konuşan karakter kaynağını belirle.","Choose the talking character source.")+'</p></div>'+
          '<label class="adfilm-switch"><input type="checkbox" data-avatar-enabled '+(state.enabled?'checked':'')+'><span></span><b>'+text("Açık","On")+'</b></label>'+
        '</div>'+
        '<div class="adfilm-avatar-body" data-avatar-body>'+
          '<div class="adfilm-segmented adfilm-avatar-modes">'+
            '<button type="button" data-avatar-mode="upload" class="'+(state.mode==="upload"?'is-selected':'')+'">'+text("Kendi avatarımı yükle","Upload my avatar")+'</button>'+
            '<button type="button" data-avatar-mode="suggest" class="'+(state.mode==="suggest"?'is-selected':'')+'">'+text("AIVO avatar önerisi","AIVO avatar suggestion")+'</button>'+
          '</div>'+
          '<label class="adfilm-control adfilm-avatar-country"><span>'+text("Avatarın ülkesi","Avatar country")+'</span><select data-avatar-field="country">'+countryOptions(state.country)+'</select></label>'+
          '<section class="adfilm-avatar-pane" data-avatar-pane="upload" '+(state.mode!=="upload"?'hidden':'')+'>'+
            '<label class="adfilm-avatar-drop">'+
              '<input type="file" accept="image/jpeg,image/png,image/webp" data-avatar-file>'+
              '<span class="adfilm-avatar-drop__icon">'+svgUpload()+'</span><b>'+text("Avatar fotoğrafını yükle","Upload avatar photo")+'</b>'+
              '<small>'+text("Tek kişi, yüz ve ağız net görünmeli. JPG, PNG veya WEBP.","One person only; face and mouth must be clearly visible. JPG, PNG or WEBP.")+'</small>'+
            '</label>'+
            '<div class="adfilm-avatar-rules"><span>✦</span><p>'+text("Görsel AWS yüz ve korunan kişi kontrolünden geçtikten sonra yüklenir.","The image is uploaded only after AWS face and protected-person screening.")+'</p></div>'+
          '</section>'+
          '<section class="adfilm-avatar-pane" data-avatar-pane="suggest" '+(state.mode!=="suggest"?'hidden':'')+'>'+
            '<div class="adfilm-avatar-fields">'+
              '<label class="adfilm-control"><span>'+text("Cinsiyet","Gender")+'</span><select data-avatar-field="gender">'+option("female","Kadın","Female",state.gender)+option("male","Erkek","Male",state.gender)+'</select></label>'+
              '<label class="adfilm-control"><span>'+text("Yaş aralığı","Age range")+'</span><select data-avatar-field="age">'+option("18-25","18–25","18–25",state.age)+option("26-35","26–35","26–35",state.age)+option("36-50","36–50","36–50",state.age)+option("50+","50+","50+",state.age)+'</select></label>'+
              '<label class="adfilm-control"><span>'+text("Saç rengi","Hair color")+'</span><select data-avatar-field="hairColor">'+option("black","Siyah","Black",state.hairColor)+option("brown","Kahverengi","Brown",state.hairColor)+option("blonde","Sarı","Blonde",state.hairColor)+option("red","Kızıl","Red",state.hairColor)+option("gray","Gri","Gray",state.hairColor)+'</select></label>'+
              '<label class="adfilm-control"><span>'+text("Saç tipi","Hair style")+'</span><select data-avatar-field="hairStyle">'+option("short","Kısa","Short",state.hairStyle)+option("medium","Orta","Medium",state.hairStyle)+option("long","Uzun","Long",state.hairStyle)+option("straight","Düz","Straight",state.hairStyle)+option("wavy","Dalgalı","Wavy",state.hairStyle)+option("curly","Kıvırcık","Curly",state.hairStyle)+'</select></label>'+
              '<label class="adfilm-control"><span>'+text("Kadraj","Framing")+'</span><select data-avatar-field="framing">'+option("shoulders","Omuz üstü","Shoulders",state.framing)+option("chest","Göğüs hizası","Chest-up",state.framing)+option("waist","Bel hizası","Waist-up",state.framing)+option("full","Tam boy","Full body",state.framing)+'</select></label>'+
              '<label class="adfilm-control"><span>'+text("İfade","Expression")+'</span><select data-avatar-field="expression">'+option("friendly","Güleryüzlü","Friendly",state.expression)+option("confident","Güven veren","Confident",state.expression)+option("calm","Sakin","Calm",state.expression)+option("energetic","Enerjik","Energetic",state.expression)+'</select></label>'+
              '<label class="adfilm-control"><span>'+text("Kıyafet","Outfit")+'</span><select data-avatar-field="outfit">'+option("casual","Günlük","Casual",state.outfit)+option("business","Kurumsal","Business",state.outfit)+option("premium","Premium","Premium",state.outfit)+option("sport","Spor","Sport",state.outfit)+option("elegant","Şık","Elegant",state.outfit)+'</select></label>'+
            '</div>'+
            '<button type="button" class="adfilm-avatar-generate" data-avatar-generate><span>✦</span><b>'+text("Avatar önerisi oluştur","Generate avatar suggestion")+'</b></button>'+
            '<p class="adfilm-avatar-tip">'+text("En iyi dudak senkronu için göğüs hizası kadraj önerilir.","Chest-up framing is recommended for the best lip sync.")+'</p>'+
          '</section>'+
          '<div class="adfilm-avatar-preview" data-avatar-preview '+(!image?'hidden':'')+'>'+
            '<img data-avatar-image src="'+(image?escapeHtml(image.url):'')+'" alt="Avatar">'+
            '<div><b>'+text("Seçili avatar","Selected avatar")+'</b><small data-avatar-source>'+(image?(image.source==="generated"?text("AIVO tarafından oluşturuldu","Generated by AIVO"):text("Güvenlik kontrolünden geçti","Passed safety screening")):'')+'</small></div>'+
            '<button type="button" data-avatar-remove aria-label="'+text("Avatarı kaldır","Remove avatar")+'">×</button>'+
          '</div>'+
        '</div>'+
      '</article>';
  }

  function renumber(card){
    var settings=card&&card.nextElementSibling;
    var step=card&&card.querySelector('[data-avatar-step]');
    var current=settings&&settings.querySelector('.adfilm-card__eyebrow');
    var number=current&&/^\d+$/.test(clean(current.textContent))?parseInt(current.textContent,10):5;
    if(step)step.textContent=String(number).padStart(2,"0");
    var sibling=settings;
    while(sibling){
      if(sibling.matches&&sibling.matches('.adfilm-card')){
        var eyebrow=sibling.querySelector('.adfilm-card__eyebrow');
        if(eyebrow&&/^\d+$/.test(clean(eyebrow.textContent))&&!eyebrow.dataset.avatarRenumbered){
          eyebrow.dataset.avatarRenumbered="1";
          eyebrow.textContent=String(parseInt(eyebrow.textContent,10)+1).padStart(2,"0");
        }
      }
      sibling=sibling.nextElementSibling;
    }
  }

  function mount(){
    var scope=root();if(!scope)return null;
    var existing=scope.querySelector('[data-adfilm-avatar-card]');if(existing)return existing;
    var voice=scope.querySelector('.adfilm-card--voice');
    var settings=scope.querySelector('.adfilm-card--settings');
    if(!voice&&!settings)return null;
    var holder=document.createElement('div');holder.innerHTML=markup(avatarState());
    var card=holder.firstElementChild;
    if(settings)settings.insertAdjacentElement('beforebegin',card);else voice.insertAdjacentElement('afterend',card);
    renumber(card);syncEnabled(card);return card;
  }

  function syncEnabled(card){
    if(!card)return;
    var enabled=!!(card.querySelector('[data-avatar-enabled]')||{}).checked;
    card.classList.toggle('is-avatar-disabled',!enabled);
    var body=card.querySelector('[data-avatar-body]');if(body)body.setAttribute('aria-disabled',enabled?'false':'true');
  }
  function fields(card){
    var result={};
    card.querySelectorAll('[data-avatar-field]').forEach(function(input){result[input.dataset.avatarField]=input.value});
    return result;
  }
  function currentAvatar(card){
    var state=avatarState(),selected=card.querySelector('[data-avatar-mode].is-selected');
    return Object.assign({},state,fields(card),{
      enabled:!!card.querySelector('[data-avatar-enabled]').checked,
      mode:selected?selected.dataset.avatarMode:'upload'
    });
  }

  async function patchAvatar(card,avatar){
    var current=project();if(!current||!current.id)throw new Error('project_not_ready');
    var response=await fetch('/api/ad-film/project?id='+encodeURIComponent(current.id),{method:'PATCH',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:{avatar:avatar}})});
    var data=await response.json().catch(function(){return{}});if(!response.ok||!data.project)throw new Error(data.message||data.error||'avatar_save_failed');
    window.AIVOAdFilmActiveProject=data.project;
    document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:data.project,projectId:data.project.id||'',media:data.project.media||{}}}));
    return data.project;
  }
  function queueSave(card){clearTimeout(saveTimer);saveTimer=setTimeout(function(){patchAvatar(card,currentAvatar(card)).catch(function(error){console.warn('[ADFILM] avatar save',error)})},500)}

  function fileBase64(file){return new Promise(function(resolve,reject){var reader=new FileReader();reader.onerror=function(){reject(new Error('file_read_failed'))};reader.onload=function(){resolve(String(reader.result||'').split(',').pop()||'')};reader.readAsDataURL(file)})}
  async function screenImage(file){
    var imageBase64=await fileBase64(file);
    var response=await fetch('/api/media-policy/vision-aws.js',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:'ad-film-avatar',fileName:file.name,mimeType:file.type,imageBase64:imageBase64})});
    var data=await response.json().catch(function(){return{}});if(!response.ok||!data.ok)throw new Error(data.detail||data.error||'vision_check_failed');
    if(!data.hasFace)throw new Error('avatar_face_missing');
    if(Number(data.faceCount)!==1)throw new Error('avatar_single_face_required');
    if(Number(data.celebrityRisk||0)>0||Number(data.publicFigureRisk||0)>0)throw new Error('avatar_protected_person');
    return data;
  }
  async function uploadAvatar(card,file){
    var current=project();if(!current||!current.id)throw new Error('project_not_ready');
    var signedResponse=await fetch('/api/ad-film/upload-url',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:current.id,filename:file.name,contentType:file.type,size:file.size,kind:'avatar-image'})});
    var signed=await signedResponse.json().catch(function(){return{}});if(!signedResponse.ok)throw new Error(signed.error||'avatar_sign_failed');
    var upload=await fetch(signed.upload_url,{method:'PUT',headers:signed.required_headers||{'Content-Type':file.type},body:file});if(!upload.ok)throw new Error('avatar_upload_failed');
    var image={key:signed.key,url:signed.public_url||signed.read_url,name:file.name,contentType:file.type,size:file.size,kind:'avatar-image',source:'upload',uploadedAt:new Date().toISOString()};
    var avatar=Object.assign(currentAvatar(card),{enabled:true,mode:'upload',image:image});
    return patchAvatar(card,avatar);
  }

  function setBusy(card,active,label){
    busy=active;card.classList.toggle('is-avatar-busy',active);
    var button=card.querySelector('[data-avatar-generate]');if(button){button.disabled=active;button.querySelector('b').textContent=active?label:text('Avatar önerisi oluştur','Generate avatar suggestion')}
    var input=card.querySelector('[data-avatar-file]');if(input)input.disabled=active;
  }
  function refreshPreview(card,state){
    var preview=card.querySelector('[data-avatar-preview]'),image=state&&state.image;
    if(!preview)return;
    preview.hidden=!(image&&image.url);
    var img=preview.querySelector('[data-avatar-image]');if(img&&image)img.src=image.url;
    var source=preview.querySelector('[data-avatar-source]');if(source&&image)source.textContent=image.source==='generated'?text('AIVO tarafından oluşturuldu','Generated by AIVO'):text('Güvenlik kontrolünden geçti','Passed safety screening');
  }
  function errorText(error){
    var code=clean(error&&error.message);
    if(code==='avatar_face_missing')return text('Fotoğrafta net bir yüz bulunamadı.','No clear face was detected in the photo.');
    if(code==='avatar_single_face_required')return text('Avatar fotoğrafında yalnızca bir kişi olmalı.','The avatar photo must contain only one person.');
    if(code==='avatar_protected_person')return text('Ünlü veya korunan kamu figürü görselleri avatar olarak kullanılamaz.','Celebrity or protected public-figure images cannot be used as avatars.');
    return text('Avatar işlemi tamamlanamadı. Tekrar deneyebilirsin.','The avatar operation could not be completed. Try again.');
  }

  document.addEventListener('change',function(event){
    var card=event.target&&event.target.closest&&event.target.closest('[data-adfilm-avatar-card]');if(!card)return;
    if(event.target.matches('[data-avatar-enabled]')){syncEnabled(card);queueSave(card);return}
    if(event.target.matches('[data-avatar-field]')){queueSave(card);return}
    if(event.target.matches('[data-avatar-file]')){
      var file=event.target.files&&event.target.files[0];if(!file||busy)return;
      (async function(){
        try{setBusy(card,true,text('Görsel kontrol ediliyor…','Screening image…'));await screenImage(file);setBusy(card,true,text('Avatar yükleniyor…','Uploading avatar…'));var saved=await uploadAvatar(card,file);refreshPreview(card,saved.avatar);card.querySelector('[data-avatar-enabled]').checked=true;syncEnabled(card);notify(text('Avatar güvenle yüklendi.','Avatar uploaded safely.'),'success')}
        catch(error){console.warn('[ADFILM] avatar upload',error);notify(errorText(error),'warning');event.target.value=''}
        finally{setBusy(card,false,'')}
      })();
    }
  },true);

  document.addEventListener('click',function(event){
    var mode=event.target&&event.target.closest&&event.target.closest('[data-adfilm-avatar-card] [data-avatar-mode]');
    if(mode){
      event.preventDefault();var card=mode.closest('[data-adfilm-avatar-card]');card.querySelectorAll('[data-avatar-mode]').forEach(function(button){button.classList.toggle('is-selected',button===mode)});card.querySelectorAll('[data-avatar-pane]').forEach(function(pane){pane.hidden=pane.dataset.avatarPane!==mode.dataset.avatarMode});queueSave(card);return;
    }
    var generate=event.target&&event.target.closest&&event.target.closest('[data-adfilm-avatar-card] [data-avatar-generate]');
    if(generate&&!busy){
      event.preventDefault();var card=generate.closest('[data-adfilm-avatar-card]'),current=project();if(!current||!current.id){notify(text('Önce proje bağlantısının tamamlanmasını bekle.','Wait for the project connection to finish.'),'warning');return}
      (async function(){try{setBusy(card,true,text('Avatar hazırlanıyor…','Generating avatar…'));var payload=Object.assign({projectId:current.id},fields(card));var response=await fetch('/api/ad-film/avatar/create',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});var data=await response.json().catch(function(){return{}});if(!response.ok||!data.project)throw new Error(data.message||data.error||'avatar_generation_failed');window.AIVOAdFilmActiveProject=data.project;card.querySelector('[data-avatar-enabled]').checked=true;refreshPreview(card,data.avatar);syncEnabled(card);document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:data.project,projectId:data.project.id||'',media:data.project.media||{}}}));notify(text('Avatar önerin hazır.','Your avatar suggestion is ready.'),'success')}catch(error){console.warn('[ADFILM] avatar generation',error);notify(errorText(error),'warning')}finally{setBusy(card,false,'')}})();return;
    }
    var remove=event.target&&event.target.closest&&event.target.closest('[data-adfilm-avatar-card] [data-avatar-remove]');
    if(remove&&!busy){event.preventDefault();var card=remove.closest('[data-adfilm-avatar-card]'),avatar=Object.assign(currentAvatar(card),{image:null});patchAvatar(card,avatar).then(function(saved){refreshPreview(card,saved.avatar);notify(text('Avatar kaldırıldı.','Avatar removed.'),'success')}).catch(function(error){console.warn('[ADFILM] avatar remove',error);notify(errorText(error),'warning')})}
  },true);

  document.addEventListener('aivo:adfilm-project-sync',function(event){
    var card=mount(),next=event&&event.detail&&event.detail.project;if(!card||!next||busy)return;
    var state=Object.assign(defaults(),next.avatar||{});
    card.querySelector('[data-avatar-enabled]').checked=!!state.enabled;
    card.querySelectorAll('[data-avatar-mode]').forEach(function(button){button.classList.toggle('is-selected',button.dataset.avatarMode===state.mode)});
    card.querySelectorAll('[data-avatar-pane]').forEach(function(pane){pane.hidden=pane.dataset.avatarPane!==state.mode});
    card.querySelectorAll('[data-avatar-field]').forEach(function(input){if(state[input.dataset.avatarField]!=null)input.value=state[input.dataset.avatarField]});
    refreshPreview(card,state);syncEnabled(card);
  });
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(mount,260)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(mount,300)},{once:true});else setTimeout(mount,300);
})();
