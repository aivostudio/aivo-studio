/* AIVO Radio Advertisement — complete dynamic TR/EN UI translation */
(function AIVO_RADIO_PRODUCTION_I18N(){
  "use strict";
  if(window.__AIVO_RADIO_PRODUCTION_I18N_V1__)return;
  window.__AIVO_RADIO_PRODUCTION_I18N_V1__=true;

  var ROOT='[data-module-root][data-module="adfilm"]';
  var PANEL='[data-adfilm-radio-panel]';
  var frame=0;
  var busy=false;

  var PAIRS=[
    ['Radyo reklamınız hazırlanıyor','Your radio advertisement is being prepared'],
    ['Üretim akışı','Production flow'],
    ['Radyo reklamınız hazır','Your radio advertisement is ready'],
    ['Tamamlandı','Completed'],
    ['Radyo reklamı tamamlanamadı','The radio advertisement could not be completed'],
    ['Hata','Error'],
    ['Radyo Reklamı Oluşturuluyor...','Creating Radio Advertisement...'],
    ['Bu üretim için yeterli krediniz bulunmuyor.','You do not have enough credits for this generation.'],
    ['Kredi kontrolü tamamlanamadı. Üretim başlatılmadı.','The credit check could not be completed. Generation was not started.'],
    ['Önce seslendirmeyi oluşturup onayla.','Create and approve the narration first.'],
    ['Reklam müziği hazırlanamadı.','The advertising music could not be prepared.'],
    ['Yüklenen müzik dosyası bulunamadı.','The uploaded music file could not be found.'],
    ['Müzik motoru anahtarı sunucuda tanımlı değil.','The music engine key is not configured on the server.'],
    ['ARŞİV','ARCHIVE'],
    ['Radyo Reklamlarım','My Radio Advertisements'],
    ['Final reklamlarını dinle, indir veya arşivden kaldır.','Listen to, download or remove your final advertisements from the archive.'],
    ['FINAL ÇIKTILAR','FINAL OUTPUTS'],
    ['Ürettiğin radyo reklamları burada saklanır.','Your generated radio advertisements are stored here.'],
    ['Henüz arşivlenmiş final yok','No archived final yet'],
    ['İlk radyo reklamını oluşturduğunda burada görünecek.','Your first radio advertisement will appear here after it is created.'],
    ['AKTİF','ACTIVE'],
    ['Oynat','Play'],
    ['İndir','Download'],
    ['Sil','Delete'],
    ['Radyo Reklamı','Radio Advertisement'],
    ['Final radyo reklamı hazır','The final radio advertisement is ready'],
    ['WAV Kayıpsız','WAV Lossless'],
    ['Yalnız seslendirme','Narration only'],
    ['Müzik + seslendirme','Music + narration'],
    ['Dosya indirilemedi.','The file could not be downloaded.'],
    ['Radyo taslağı hazır değil. Sayfayı yenile.','The radio draft is not ready. Refresh the page.'],
    ['Seslendirme doğrulanıyor','Narration is being verified'],
    ['Onaylanan seslendirme ve reklam süresi kontrol ediliyor.','The approved narration and advertisement duration are being checked.'],
    ['Müziksiz final hazırlanıyor','The final audio is being prepared without music'],
    ['Reklam müziği hazırlanıyor','Advertising music is being prepared'],
    ['Seçilen stile ve toplam reklam süresine uygun arka plan müziği hazırlanıyor.','Background music is being prepared for the selected style and total advertisement duration.'],
    ['Yüklediğin müzik final miks için hazırlanıyor.','Your uploaded music is being prepared for the final mix.'],
    ['Seslendirme doğrudan final çıkışa hazırlanıyor.','The narration is being prepared directly for the final output.'],
    ['Final ses birleştiriliyor','Final audio is being combined'],
    ['Seslendirme ve reklam müziği birleştirilerek seçilen çıktı formatı hazırlanıyor.','Narration and advertising music are being combined in the selected output format.'],
    ['Radyo reklamı hazır','Radio advertisement is ready'],
    ['Final ses dosyan hazırlandı.','Your final audio file is ready.'],
    ['TAMAMLANDI','COMPLETED'],
    ['Radyo reklamın hazır.','Your radio advertisement is ready.'],
    ['Üretim başlatılamadı','Generation could not be started'],
    ['Üretim tamamlanamadı','Generation could not be completed'],
    ['Kredi iadesi kontrol ediliyor.','The credit refund is being checked.'],
    ['Üretim tamamlanamadı. Kredi iadesi kontrol ediliyor.','Generation could not be completed. The credit refund is being checked.'],
    ['Ses oynatılamadı.','The audio could not be played.'],
    ['İndirme başlatıldı.','Download started.'],
    ['Radyo reklamı indirildi','Radio advertisement downloaded'],
    ['Radyo reklamı indirildi.','Radio advertisement downloaded.'],
    ['Bu radyo reklamını arşivden silmek istiyor musun?','Do you want to delete this radio advertisement from the archive?'],
    ['Radyo reklamı silindi.','Radio advertisement deleted.'],
    ['Radyo reklamı silinemedi.','The radio advertisement could not be deleted.'],
    ['Kayıpsız','Lossless'],
    ['Seslendirme','Narration'],
    ['Müzik','Music'],
    ['Final ses','Final audio']
  ];

  var TR=Object.create(null);
  var EN=Object.create(null);
  PAIRS.forEach(function(pair,index){TR[normalize(pair[0])]=index;EN[normalize(pair[1])]=index});

  function normalize(value){return String(value==null?'':value).replace(/\s+/g,' ').trim()}
  function language(){
    try{if(window.AIVO_STUDIO_I18N&&typeof window.AIVO_STUDIO_I18N.getLanguage==='function')return window.AIVO_STUDIO_I18N.getLanguage()==='en'?'en':'tr'}catch(_){}
    try{if(window.AIVOAdFilmI18n&&typeof window.AIVOAdFilmI18n.language==='function')return window.AIVOAdFilmI18n.language()==='en'?'en':'tr'}catch(_){}
    var stored='';
    try{stored=String(localStorage.getItem('aivo_language')||localStorage.getItem('aivo_lang')||'').toLowerCase()}catch(_){}
    return stored==='en'||String(document.documentElement.lang||'').toLowerCase().indexOf('en')===0?'en':'tr';
  }
  function exact(value){
    var source=normalize(value);
    var index=TR[source];
    if(index==null)index=EN[source];
    return index==null?value:PAIRS[index][language()==='en'?1:0];
  }
  function monthText(value,toEnglish){
    var tr=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    var en=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var output=String(value);
    for(var i=0;i<tr.length;i++)output=output.replace(new RegExp('\\b'+(toEnglish?tr[i]:en[i])+'\\b','g'),toEnglish?en[i]:tr[i]);
    return output;
  }
  function translate(value,compound){
    var source=normalize(value);
    if(!source)return value;
    var direct=exact(source);
    if(normalize(direct)!==source)return direct;
    var en=language()==='en';
    var match;

    match=source.match(/^(\d+)\s+(?:Kredi|Credits?)$/i);
    if(match)return en?match[1]+' Credits':match[1]+' Kredi';
    match=source.match(/^▶\s*(?:Radyo Reklamını Oluştur|Create Radio Advertisement)\s*\((\d+)\s*(?:Kredi|Credits?)\)$/i);
    if(match)return en?'▶ Create Radio Advertisement ('+match[1]+' Credits)':'▶ Radyo Reklamını Oluştur ('+match[1]+' Kredi)';
    match=source.match(/^(\d+)\s+(?:kredi kullanıldı\. Radyo reklamınız hazırlanıyor\.|credits? used\. Your radio advertisement is being prepared\.)$/i);
    if(match)return en?match[1]+' credits used. Your radio advertisement is being prepared.':match[1]+' kredi kullanıldı. Radyo reklamınız hazırlanıyor.';
    match=source.match(/^(?:AŞAMA|STAGE)\s+(\d+)\/(\d+)$/i);
    if(match)return en?'STAGE '+match[1]+'/'+match[2]:'AŞAMA '+match[1]+'/'+match[2];
    match=source.match(/^(?:Toplam geçen süre:|Total elapsed time:)\s*(\d+)\s*(?:dk|min)\s*(\d+)\s*(?:sn|sec)$/i);
    if(match)return en?'Total elapsed time: '+match[1]+' min '+match[2]+' sec':'Toplam geçen süre: '+match[1]+' dk '+match[2]+' sn';
    match=source.match(/^(\d+)\s*(?:kayıt|records?)$/i);
    if(match){var count=Number(match[1]);return en?count+' '+(count===1?'record':'records'):count+' kayıt'}
    match=source.match(/^(?:SÜRÜM|VERSION)\s+(\d+)$/i);
    if(match)return en?'VERSION '+match[1]:'SÜRÜM '+match[1];
    match=source.match(/^(\d+)\s*(?:sn|sec)$/i);
    if(match)return en?match[1]+' sec':match[1]+' sn';
    match=source.match(/^Kullanılan\s+(\d+)\s+kredi hesabınıza iade edildi\.$/i);
    if(match)return en?match[1]+' used credits were refunded to your account.':'Kullanılan '+match[1]+' kredi hesabınıza iade edildi.';
    match=source.match(/^Üretim tamamlanamadı\. Kullanılan\s+(\d+)\s+kredi hesabınıza iade edildi\.$/i);
    if(match)return en?'Generation could not be completed. '+match[1]+' used credits were refunded to your account.':'Üretim tamamlanamadı. Kullanılan '+match[1]+' kredi hesabınıza iade edildi.';
    match=source.match(/^Radyo reklamı oluşturulamadı:\s*(.+)$/i);
    if(match)return en?'The radio advertisement could not be created: '+match[1]:'Radyo reklamı oluşturulamadı: '+match[1];

    if(compound!==false&&source.indexOf(' · ')>=0)return source.split(' · ').map(function(part){return translate(part,false)}).join(' · ');
    return monthText(value,en);
  }

  function translatePayload(value){
    if(typeof value==='string')return translate(value);
    if(value&&typeof value==='object'&&typeof value.message==='string'){
      var copy=Object.assign({},value);
      copy.message=translate(value.message);
      return copy;
    }
    return value;
  }
  function wrapNotifications(){
    var toast=window.toast;
    if(toast&&!toast.__aivoRadioProductionI18n){
      ['success','error','warning','info'].forEach(function(name){
        var original=typeof toast[name]==='function'?toast[name].bind(toast):null;
        if(original)toast[name]=function(value,options){return original(translatePayload(value),options)};
      });
      toast.__aivoRadioProductionI18n=true;
    }
    ['toastSafe','showToast','toastMsg','legacyToast'].forEach(function(name){
      var original=window[name];
      if(typeof original!=='function'||original.__aivoRadioProductionI18n)return;
      var wrapped=function(value,type,options){return original(translatePayload(value),type,options)};
      wrapped.__aivoRadioProductionI18n=true;
      window[name]=wrapped;
    });
    if(typeof window.confirm==='function'&&!window.confirm.__aivoRadioProductionI18n){
      var nativeConfirm=window.confirm.bind(window);
      var confirmWrapped=function(message){return nativeConfirm(translate(message))};
      confirmWrapped.__aivoRadioProductionI18n=true;
      window.confirm=confirmWrapped;
    }
  }

  function apply(panel){
    if(!panel||!panel.isConnected||busy)return;
    busy=true;
    try{
      var walker=document.createTreeWalker(panel,NodeFilter.SHOW_TEXT,{acceptNode:function(node){
        var parent=node.parentElement;
        if(!parent||parent.closest('script,style,textarea,input,[contenteditable="true"]')||!normalize(node.nodeValue))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }});
      var node;
      while((node=walker.nextNode())){
        var before=node.nodeValue;
        var after=translate(before);
        if(normalize(after)!==normalize(before))node.nodeValue=(before.match(/^\s*/)||[''])[0]+after+(before.match(/\s*$/)||[''])[0];
      }
      [panel].concat(Array.from(panel.querySelectorAll('[title],[aria-label],[placeholder]'))).forEach(function(element){
        ['title','aria-label','placeholder'].forEach(function(attribute){
          var before=element.getAttribute&&element.getAttribute(attribute);
          if(!before)return;
          var after=translate(before);
          if(after!==before)element.setAttribute(attribute,after);
        });
      });
    }finally{busy=false}
  }
  function schedule(panel){
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(function(){frame=0;wrapNotifications();apply(panel||document.querySelector(ROOT+' '+PANEL))});
  }
  function bind(scope){
    var panel=scope&&scope.matches&&scope.matches(PANEL)?scope:scope&&scope.querySelector?scope.querySelector(PANEL):document.querySelector(ROOT+' '+PANEL);
    if(!panel)return;
    if(panel.dataset.radioProductionI18nBound!=='1'){
      panel.dataset.radioProductionI18nBound='1';
      var observer=new MutationObserver(function(){schedule(panel)});
      observer.observe(panel,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
    }
    schedule(panel);
  }

  wrapNotifications();
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')bind(event.detail.root)});
  ['aivo:adfilm-assets-ready','aivo:radioad-project-sync','aivo:language-change','aivo:adfilm-language-change'].forEach(function(name){document.addEventListener(name,function(){bind(document.querySelector(ROOT))})});
  window.addEventListener('pageshow',function(){bind(document.querySelector(ROOT))});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){bind(document.querySelector(ROOT))},{once:true});else bind(document.querySelector(ROOT));
  [80,220,500,1000,1800].forEach(function(delay){setTimeout(function(){bind(document.querySelector(ROOT))},delay)});
})();
