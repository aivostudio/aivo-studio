/* AIVO AI Reklam Filmi — simplified single director-instruction workflow */
(function AIVO_AD_FILM_SIMPLE_DIRECTOR_PLAN(){
  "use strict";
  if(window.__AIVO_AD_FILM_SIMPLE_DIRECTOR_PLAN__)return;
  window.__AIVO_AD_FILM_SIMPLE_DIRECTOR_PLAN__=true;

  var STORAGE_KEY="aivo_adfilm_creative_plan_v1";

  var COPY={
    tr:{
      title:"Reklamını Tasarla",
      sub:"Reklam filminin nasıl görünmesini istediğini anlat; AIVO sahneleri ve akışı hazırlasın.",
      direction:"Reklam filmi yönetmen talimatı",
      optional:"İsteğe bağlı",
      placeholder:"Örn: Ürün gece atmosferli, lüks bir mekânda gösterilsin. Açılışta etkileyici yakın planlar, devamında doğal kullanım anları, yumuşak kamera hareketleri ve güçlü bir final ürün çekimi olsun.",
      hint:"Mekânı, atmosferi, kamera hareketlerini, ürünün nasıl kullanılacağını ve görmek istediğin önemli anları anlat. Boş bırakırsan AIVO ürüne göre tasarlar."
    },
    en:{
      title:"Design Your Advertising Film",
      sub:"Describe how the advertising film should look; AIVO will prepare the scenes and flow.",
      direction:"Advertising film director instructions",
      optional:"Optional",
      placeholder:"Example: Present the product in a luxurious night setting. Begin with striking close-ups, continue with natural product-use moments, use smooth camera movement and finish with a strong final product shot.",
      hint:"Describe the location, atmosphere, camera movement, how the product should be used and the key moments you want. Leave it empty for AIVO to design from the product brief."
    }
  };

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function t(key){var copy=english()?COPY.en:COPY.tr;return copy[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function field(scope,key){return scope&&scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function writeStoredDirection(direction){
    try{
      var saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")||{};
      saved.mode="auto";
      saved.concept="auto";
      saved.direction=String(direction||"");
      saved.scenes=[];
      localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));
    }catch(_){}
  }
  function setText(node,value){if(node){node.removeAttribute("data-plan-copy");node.textContent=value}}
  function simplify(scope){
    scope=scope||root();if(!scope||!scope.isConnected)return false;
    var card=scope.querySelector(".adfilm-card--creative-plan");if(!card)return false;
    card.classList.add("is-simple-director-plan");

    setText(card.querySelector(".adfilm-card__heading h2"),t("title"));
    setText(card.querySelector(".adfilm-card__heading p"),t("sub"));

    var mode=field(scope,"planMode"),concept=field(scope,"planConcept");
    if(mode)mode.value="auto";
    if(concept)concept.value="auto";

    card.querySelectorAll(".adfilm-plan-mode,.adfilm-plan-concept,.adfilm-manual-scenes").forEach(function(node){node.remove()});
    [1,2,3,4,5].forEach(function(index){var scene=field(scope,"scene"+index);if(scene)scene.remove()});

    var direction=card.querySelector(".adfilm-plan-direction");
    if(direction){
      setText(direction.querySelector(":scope>span>b"),t("direction"));
      setText(direction.querySelector(":scope>span>em"),t("optional"));
      var textarea=field(scope,"creativeDirection");
      if(textarea){
        textarea.setAttribute("placeholder",t("placeholder"));
        textarea.removeAttribute("data-plan-placeholder");
        if(!textarea.__simpleDirectorBound){
          textarea.__simpleDirectorBound=true;
          textarea.addEventListener("input",function(){writeStoredDirection(textarea.value)});
        }
      }
      setText(direction.querySelector(":scope>small>span"),t("hint"));
    }

    var required=card.querySelector(".adfilm-card__required");if(required)required.remove();
    writeStoredDirection((field(scope,"creativeDirection")||{}).value||"");
    return true;
  }
  function schedule(scope){[0,60,180,420,800].forEach(function(delay){setTimeout(function(){simplify(scope||root())},delay)})}

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){schedule(root())});
  document.addEventListener("aivo:adfilm-project-sync",function(){schedule(root())});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))schedule(root())});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();
