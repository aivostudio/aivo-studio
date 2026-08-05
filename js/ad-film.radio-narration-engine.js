/* AIVO Radio Ad — narration create, polling, mastering, approval and premium preview */
(function AIVO_RADIO_NARRATION_ENGINE(){
  "use strict";
  if(window.__AIVO_RADIO_NARRATION_ENGINE_V2__)return;
  window.__AIVO_RADIO_NARRATION_ENGINE_V2__=true;
  window.__AIVO_RADIO_NARRATION_ENGINE_V1__=true;

  var ROOT='[data-module-root][data-module="adfilm"]';
  var PANEL='[data-adfilm-radio-panel]';
  var PROJECT_KEY='aivo_radioad_active_project_id_v1';
  var running=false,pollTimer=null,audio=null,audioUrl='';

  function q(root,selector){return root&&root.querySelector(selector)}
  function qa(root,selector){return root?Array.from(root.querySelectorAll(selector)):[]}
  function clean(value){return String(value==null?'':value).trim()}
  function notify(message,type){try{var fn=window.toastSafe||window.showToast||window.toastMsg;if(typeof fn==='function')fn(message,type||'info')}catch(_){} }
  function projectId(root){return clean(root&&root.dataset.radioAdProjectId||window.AIVORadioAdActiveProject&&window.AIVORadioAdActiveProject.id||localStorage.getItem(PROJECT_KEY))}
  function selected(panel,name,fallback){var b=q(panel,'[data-radio-choice="'+name+'"] .is-active[data-value]');return b?b.dataset.value:fallback}
  function selectValue(panel,selector,fallback){var n=q(panel,selector);return n?clean(n.value)||fallback:fallback}
  function state(panel,text){var n=q(panel,'[data-radio-preview-state]');if(n)n.textContent=text}
  function setBusy(panel,busy){var b=q(panel,'[data-radio-voice-create]');if(!b)return;b.disabled=!!busy;b.textContent=busy?'Ses hazırlanıyor...':'Sesi oluştur'}
  function request(url,options){return fetch(url,Object.assign({credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'}},options||{})).then(async function(response){var data=await response.json().catch(function(){return{}});if(!response.ok){var e=new Error(data.message||data.error||('HTTP '+response.status));e.status=response.status;e.data=data;throw e}return data})}
  function payload(panel,id){return{projectId:id,text:clean(q(panel,'[data-radio-copy]')&&q(panel,'[data-radio-copy]').value),language:selectValue(panel,'[data-radio-language]','tr'),voice:selectValue(panel,'[data-radio-voice]','warm_female'),voiceStyle:selectValue(panel,'[data-radio-voice-style]','warm'),speed:selected(panel,'speed','fast'),flow:selected(panel,'flow','natural'),duration:Number(selected(panel,'duration','10'))}}
  function errorMessage(error){var code=clean(error&&error.data&&error.data.error||error&&error.message);if(code==='narration_too_long')return 'Metin seçilen süre için uzun. Kelime sayısını azalt.';if(code==='missing_fal_key')return 'Ses motoru anahtarı sunucuda tanımlı değil.';if(code==='unauthorized')return 'Oturum doğrulanamadı. Yeniden giriş yap.';if(code==='project_not_found')return 'Radyo taslağı bulunamadı. Sayfayı yenile.';if(code==='narration_text_changed')return 'Metin değişti. Güncel metin için sesi yeniden üret.';return 'Ses işlemi tamamlanamadı: '+code}
  function icon(name){if(name==='play')return '▶';if(name==='pause')return '❚❚';return ''}

  function playerNodes(panel){var box=q(panel,'.radio-preview__player'),tools=box&&qa(box,'.radio-icon-btn');return{box:box,play:box&&q(box,'.radio-play'),track:box&&q(box,'.radio-track'),time:box&&q(box,'.radio-track small'),volume:tools&&tools[0],download:tools&&tools[1],remove:tools&&tools[2],approve:q(panel,'[data-radio-voice-approve]')}}
  function format(sec){sec=Number.isFinite(sec)?sec:0;return Math.floor(sec/60)+':'+String(Math.floor(sec%60)).padStart(2,'0')}
  function syncPlayer(panel){var n=playerNodes(panel);if(!audio)return;var d=Number.isFinite(audio.duration)?audio.duration:0,c=Number.isFinite(audio.currentTime)?audio.currentTime:0;if(n.time)n.time.textContent=format(c)+' / '+format(d);var line=n.track&&q(n.track,'i');if(line)line.style.background='linear-gradient(90deg,#b457ee '+(d?c/d*100:0)+'%,rgba(104,105,143,.28) 0)';if(n.play)n.play.textContent=icon(audio.paused?'play':'pause')}
  function resetPlayer(panel){var n=playerNodes(panel);if(audio){audio.pause();audio.src=''}audio=null;audioUrl='';[n.play,n.volume,n.download,n.remove].forEach(function(button){if(button)button.disabled=true});if(n.approve){n.approve.disabled=true;n.approve.classList.remove('is-approved');n.approve.textContent='Sesi onayla'}if(n.time)n.time.textContent='0:00 / 0:00';var line=n.track&&q(n.track,'i');if(line)line.style.background='rgba(104,105,143,.28)';state(panel,'Henüz ses oluşturulmadı.')}

  function mountAudio(panel,url,project){
    audioUrl=clean(url);if(!audioUrl)return;
    if(audio){audio.pause();audio.src=''}
    audio=new Audio(audioUrl);audio.preload='metadata';
    ['loadedmetadata','durationchange','timeupdate','play','pause','ended','volumechange'].forEach(function(name){audio.addEventListener(name,function(){syncPlayer(panel)})});
    var n=playerNodes(panel);
    if(n.play){n.play.disabled=false;n.play.onclick=function(){audio.paused?audio.play().catch(function(){}):audio.pause()}}
    if(n.volume){n.volume.disabled=false;n.volume.onclick=function(){audio.muted=!audio.muted;n.volume.style.opacity=audio.muted?'.45':'1';syncPlayer(panel)}}
    if(n.download){n.download.disabled=false;n.download.onclick=function(){var root=panel.closest(ROOT),id=projectId(root);if(!id)return;var link=document.createElement('a');link.href='/api/radio-ad/narration/download?projectId='+encodeURIComponent(id);link.style.display='none';document.body.appendChild(link);link.click();setTimeout(function(){link.remove()},0)}}
    if(n.remove){n.remove.disabled=false;n.remove.onclick=async function(){var root=panel.closest(ROOT),id=projectId(root);if(!id)return;n.remove.disabled=true;try{var data=await request('/api/radio-ad/narration/delete',{method:'POST',body:JSON.stringify({projectId:id})});window.AIVORadioAdActiveProject=data.project||window.AIVORadioAdActiveProject;document.dispatchEvent(new CustomEvent('aivo:radioad-project-sync',{detail:{project:data.project,projectId:id}}));resetPlayer(panel);notify('Ses kaydı silindi.','success')}catch(error){n.remove.disabled=false;notify(errorMessage(error),'error')}}}
    var approved=project&&project.narration&&project.narration.audio&&project.narration.audio.approved===true;
    if(n.approve){n.approve.disabled=approved;n.approve.classList.toggle('is-approved',approved);n.approve.textContent=approved?'Onaylandı':'Sesi onayla'}
    state(panel,approved?'Ses onaylandı.':'Ses ön izlemesi hazır.');
    syncPlayer(panel);
  }

  async function approve(panel,root){var id=projectId(root),n=playerNodes(panel);if(!id||!n.approve||n.approve.disabled)return;n.approve.disabled=true;n.approve.textContent='Onaylanıyor...';state(panel,'Ses onaylanıyor...');try{var data=await request('/api/radio-ad/narration/approve',{method:'POST',body:JSON.stringify({projectId:id})});window.AIVORadioAdActiveProject=data.project;document.dispatchEvent(new CustomEvent('aivo:radioad-project-sync',{detail:{project:data.project,projectId:id}}));n.approve.classList.add('is-approved');n.approve.textContent='Onaylandı';state(panel,'Ses onaylandı.');notify('Ses onaylandı.','success')}catch(error){n.approve.disabled=false;n.approve.textContent='Sesi onayla';state(panel,'Ses ön izlemesi hazır.');notify(errorMessage(error),'error')}}
  async function master(panel,id){state(panel,'Ses kalitesi hazırlanıyor...');var data=await request('/api/radio-ad/narration/master',{method:'POST',body:JSON.stringify({projectId:id})});var url=data&&data.audio&&(data.audio.previewUrl||data.audio.url);if(!url)throw new Error('mastered_audio_missing');window.AIVORadioAdActiveProject=data.project||window.AIVORadioAdActiveProject;document.dispatchEvent(new CustomEvent('aivo:radioad-project-sync',{detail:{project:data.project,projectId:id}}));mountAudio(panel,url,data.project);notify('Ses ön izlemesi hazır.','success')}
  async function poll(panel,id){clearTimeout(pollTimer);try{var data=await request('/api/radio-ad/narration/status?projectId='+encodeURIComponent(id),{method:'GET'});var status=clean(data.status).toUpperCase();if(status==='COMPLETED'){await master(panel,id);running=false;setBusy(panel,false);return}if(status==='FAILED'){throw new Error(data.error||'narration_generation_failed')}state(panel,status==='IN_QUEUE'?'Ses üretim kuyruğunda...':'Ses oluşturuluyor...');pollTimer=setTimeout(function(){poll(panel,id)},1800)}catch(error){running=false;setBusy(panel,false);state(panel,'Ses oluşturulamadı.');notify(errorMessage(error),'error');console.error('[RADIOAD] narration poll',error)}}
  async function create(panel,root){if(running)return;var id=projectId(root);if(!id){notify('Radyo taslağı henüz hazır değil. Birkaç saniye sonra tekrar dene.','warning');return}var body=payload(panel,id);if(body.text.length<10){notify('Önce reklam seslendirme metnini yaz.','warning');return}running=true;setBusy(panel,true);state(panel,'Ses motoruna bağlanıyor...');try{await request('/api/radio-ad/narration/create',{method:'POST',body:JSON.stringify(body)});state(panel,'Ses üretim kuyruğunda...');poll(panel,id)}catch(error){running=false;setBusy(panel,false);state(panel,'Ses oluşturulamadı.');notify(errorMessage(error),'error');console.error('[RADIOAD] narration create',error)}}

  document.addEventListener('click',function(event){var createButton=event.target&&event.target.closest&&event.target.closest(PANEL+' [data-radio-voice-create]');if(createButton){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();var panel=createButton.closest(PANEL),root=createButton.closest(ROOT);create(panel,root);return}var approveButton=event.target&&event.target.closest&&event.target.closest(PANEL+' [data-radio-voice-approve]');if(approveButton){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();var approvePanel=approveButton.closest(PANEL),approveRoot=approveButton.closest(ROOT);approve(approvePanel,approveRoot)}},true);
  document.addEventListener('input',function(event){if(!event.target.matches(PANEL+' [data-radio-copy]'))return;var panel=event.target.closest(PANEL),project=window.AIVORadioAdActiveProject||{},generated=clean(project.narrationGeneration&&project.narrationGeneration.input&&project.narrationGeneration.input.text),current=clean(event.target.value),n=playerNodes(panel);if(generated&&generated!==current&&n.approve){n.approve.disabled=true;n.approve.classList.remove('is-approved');n.approve.textContent='Sesi yeniden üret';state(panel,'Metin değişti. Güncel metin için sesi yeniden üret.')}},true);
  document.addEventListener('aivo:radioad-project-sync',function(event){var project=event&&event.detail&&event.detail.project,panel=document.querySelector(ROOT+' '+PANEL);var saved=project&&project.narration&&project.narration.audio;if(panel&&saved&&saved.mastered&&(saved.previewUrl||saved.url))mountAudio(panel,saved.previewUrl||saved.url,project);else if(panel&&!saved)resetPlayer(panel)});
})();
