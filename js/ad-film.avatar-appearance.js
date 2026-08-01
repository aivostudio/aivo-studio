/* AIVO AI Reklam Filmi — gender-aware appearance, outfit color and face accessory controls */
(function AIVO_AD_FILM_AVATAR_APPEARANCE(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_APPEARANCE_V1__)return;
  window.__AIVO_AD_FILM_AVATAR_APPEARANCE_V1__=true;

  var observer=null;

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function clean(value){return String(value==null?"":value).trim()}
  function escapeHtml(value){return String(value||"").replace(/[&<>'"]/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]})}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function card(){var scope=root();return scope&&scope.querySelector('[data-adfilm-avatar-card]')}
  function option(value,tr,en,current){return '<option value="'+value+'"'+(value===current?' selected':'')+'>'+escapeHtml(text(tr,en))+'</option>'}

  function state(){
    var avatar=project()&&project().avatar||{};
    return{
      maleAppearance:clean(avatar.maleAppearance)||"charismatic",
      femaleAppearance:clean(avatar.femaleAppearance)||"beautiful",
      outfitColor:clean(avatar.outfitColor)||"scene_harmony",
      faceAccessory:clean(avatar.faceAccessory)||"none"
    };
  }

  function controlMarkup(current){
    return ''+
      '<label class="adfilm-control adfilm-avatar-control--appearance" data-avatar-gender-control="male">'+
        '<span>'+text("Erkek görünümü","Male appearance")+'</span>'+
        '<select data-avatar-field="maleAppearance">'+
          option("handsome","Çok yakışıklı","Very handsome",current.maleAppearance)+
          option("charismatic","Karizmatik","Charismatic",current.maleAppearance)+
          option("attractive","Çekici","Attractive",current.maleAppearance)+
          option("natural","Doğal / sade","Natural / understated",current.maleAppearance)+
        '</select>'+
      '</label>'+
      '<label class="adfilm-control adfilm-avatar-control--appearance" data-avatar-gender-control="female">'+
        '<span>'+text("Kadın görünümü","Female appearance")+'</span>'+
        '<select data-avatar-field="femaleAppearance">'+
          option("beautiful","Çok güzel","Very beautiful",current.femaleAppearance)+
          option("fashion_model","Fotomodel","Fashion model",current.femaleAppearance)+
          option("attractive","Çekici","Attractive",current.femaleAppearance)+
          option("elegant_natural","Zarif / doğal","Elegant / natural",current.femaleAppearance)+
        '</select>'+
      '</label>'+
      '<label class="adfilm-control adfilm-avatar-control--color">'+
        '<span>'+text("Kıyafet rengi","Outfit color")+'</span>'+
        '<select data-avatar-field="outfitColor">'+
          option("scene_harmony","Ortamla uyumlu","Match environment",current.outfitColor)+
          option("product_tone","Ürünle aynı ton","Match product tone",current.outfitColor)+
          option("contrast","Kontrast renk","Contrast color",current.outfitColor)+
          option("mixed","Karma","Mixed palette",current.outfitColor)+
          option("black","Siyah","Black",current.outfitColor)+
          option("white","Beyaz","White",current.outfitColor)+
          option("red","Kırmızı","Red",current.outfitColor)+
          option("blue","Mavi","Blue",current.outfitColor)+
          option("navy","Lacivert","Navy",current.outfitColor)+
          option("gray","Gri","Gray",current.outfitColor)+
          option("beige","Bej","Beige",current.outfitColor)+
          option("brown","Kahverengi","Brown",current.outfitColor)+
          option("pink","Pembe","Pink",current.outfitColor)+
          option("green","Yeşil","Green",current.outfitColor)+
          option("black_white","Siyah-Beyaz","Black-White",current.outfitColor)+
          option("black_red","Siyah-Kırmızı","Black-Red",current.outfitColor)+
          option("black_gold","Siyah-Altın","Black-Gold",current.outfitColor)+
          option("white_gold","Beyaz-Altın","White-Gold",current.outfitColor)+
          option("navy_white","Lacivert-Beyaz","Navy-White",current.outfitColor)+
        '</select>'+
      '</label>'+
      '<label class="adfilm-control adfilm-avatar-control--accessory">'+
        '<span>'+text("Yüz aksesuarı","Face accessory")+'</span>'+
        '<select data-avatar-field="faceAccessory">'+
          option("none","Yok","None",current.faceAccessory)+
          option("round_glasses","Yuvarlak gözlük","Round glasses",current.faceAccessory)+
          option("square_glasses","Köşeli gözlük","Square glasses",current.faceAccessory)+
          option("aviator_glasses","Pilot gözlük","Aviator glasses",current.faceAccessory)+
          option("sunglasses","Güneş gözlüğü","Sunglasses",current.faceAccessory)+
        '</select>'+
      '</label>';
  }

  function syncGender(target){
    if(!target)return;
    var genderSelect=target.querySelector('[data-avatar-field="gender"]');
    var gender=clean(genderSelect&&genderSelect.value)||"female";
    var busy=target.classList.contains('is-avatar-busy');
    target.querySelectorAll('[data-avatar-gender-control]').forEach(function(label){
      var active=label.getAttribute('data-avatar-gender-control')===gender;
      label.classList.toggle('is-inactive',!active);
      label.setAttribute('aria-disabled',active?'false':'true');
      var select=label.querySelector('select');
      if(select)select.disabled=busy||!active;
    });
  }

  function applyState(target,next){
    if(!target)return;
    Object.keys(next).forEach(function(key){
      var select=target.querySelector('[data-avatar-field="'+key+'"]');
      if(select&&next[key])select.value=next[key];
    });
    syncGender(target);
  }

  function install(){
    var target=card();if(!target)return false;
    var fields=target.querySelector('.adfilm-avatar-fields');if(!fields)return false;
    if(!fields.querySelector('[data-avatar-field="maleAppearance"]')){
      fields.insertAdjacentHTML('beforeend',controlMarkup(state()));
    }
    applyState(target,state());
    if(!target.__aivoAppearanceObserver){
      target.__aivoAppearanceObserver=true;
      var localObserver=new MutationObserver(function(records){
        if(records.some(function(record){return record.type==='attributes'&&record.attributeName==='class'}))syncGender(target);
      });
      localObserver.observe(target,{attributes:true,attributeFilter:['class']});
    }
    return true;
  }

  function schedule(){[0,80,220,520,1000].forEach(function(delay){setTimeout(install,delay)})}

  document.addEventListener('change',function(event){
    var target=event.target&&event.target.closest&&event.target.closest('[data-adfilm-avatar-card]');
    if(!target)return;
    if(event.target.matches('[data-avatar-field="gender"]'))setTimeout(function(){syncGender(target)},0);
  },true);

  document.addEventListener('aivo:adfilm-project-sync',function(){setTimeout(function(){var target=card();if(target)applyState(target,state());else schedule()},40)});
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')schedule()});

  if(document.body){
    observer=new MutationObserver(function(){if(!card()||!card().querySelector('[data-avatar-field="maleAppearance"]'))schedule()});
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
