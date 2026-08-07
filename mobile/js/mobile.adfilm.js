(function(){
  const root = document.getElementById("mobileAdFilmSection");
  if (!root || root.__mobileAdFilmBound) return;
  root.__mobileAdFilmBound = true;

  const modeButtons = Array.from(root.querySelectorAll("[data-mobile-adfilm-mode]"));
  const views = Array.from(root.querySelectorAll("[data-mobile-adfilm-view]"));
  const description = root.querySelector("#mobileAdFilmDescription");
  const descriptionCount = root.querySelector("#mobileAdFilmDescriptionCount");
  const creativeBrief = root.querySelector("#mobileAdFilmCreativeBrief");
  const creativeBriefCount = root.querySelector("#mobileAdFilmCreativeBriefCount");

  const referenceTotal = root.querySelector("#mobileAdFilmReferenceTotal");
  const primaryInput = root.querySelector("#mobileAdFilmPrimaryImage");
  const angleInput = root.querySelector("#mobileAdFilmAngleImages");
  const sceneInput = root.querySelector("#mobileAdFilmSceneImages");
  const logoInput = root.querySelector("#mobileAdFilmLogoImage");

  const uploadState = {
    primary: [],
    angles: [],
    scene: [],
    logo: []
  };

  function setMode(mode){
    modeButtons.forEach(function(button){
      const active = button.getAttribute("data-mobile-adfilm-mode") === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    views.forEach(function(view){
      const active = view.getAttribute("data-mobile-adfilm-view") === mode;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
  }

  modeButtons.forEach(function(button){
    button.addEventListener("click", function(){
      setMode(button.getAttribute("data-mobile-adfilm-mode"));
    });
  });

  function syncDescriptionCount(){
    if (!description || !descriptionCount) return;
    descriptionCount.textContent = String(description.value.length);
  }

  function syncCreativeBriefCount(){
    if (!creativeBrief || !creativeBriefCount) return;
    creativeBriefCount.textContent = String(creativeBrief.value.length);
  }

  function revokeGroup(group){
    uploadState[group].forEach(function(item){
      if (item.url) URL.revokeObjectURL(item.url);
    });
    uploadState[group] = [];
  }

  function setFiles(group, fileList, limit){
    revokeGroup(group);
    uploadState[group] = Array.from(fileList || []).slice(0, limit).map(function(file){
      return {
        file: file,
        url: URL.createObjectURL(file)
      };
    });
    renderUploadGroup(group);
    syncReferenceTotal();
  }

  function renderUploadGroup(group){
    const map = {
      primary: {
        preview: root.querySelector("#mobileAdFilmPrimaryPreview"),
        count: root.querySelector("#mobileAdFilmPrimaryCount"),
        limit: 1
      },
      angles: {
        preview: root.querySelector("#mobileAdFilmAnglePreview"),
        count: root.querySelector("#mobileAdFilmAngleCount"),
        limit: 3
      },
      scene: {
        preview: root.querySelector("#mobileAdFilmScenePreview"),
        count: root.querySelector("#mobileAdFilmSceneCount"),
        limit: 5
      },
      logo: {
        preview: root.querySelector("#mobileAdFilmLogoPreview"),
        count: root.querySelector("#mobileAdFilmLogoCount"),
        limit: 1
      }
    };

    const target = map[group];
    if (!target) return;

    if (target.count){
      target.count.textContent = uploadState[group].length + " / " + target.limit;
    }

    if (!target.preview) return;
    target.preview.innerHTML = "";

    uploadState[group].forEach(function(item, index){
      const chip = document.createElement("div");
      chip.className = "mobile-adfilm-preview-chip";

      const image = document.createElement("img");
      image.src = item.url;
      image.alt = "Seçilen referans " + (index + 1);
      chip.appendChild(image);

      const badge = document.createElement("span");
      badge.textContent = group === "logo" ? "Logo" : String(index + 1);
      chip.appendChild(badge);

      target.preview.appendChild(chip);
    });
  }

  function syncReferenceTotal(){
    if (!referenceTotal) return;
    const total = uploadState.primary.length + uploadState.angles.length + uploadState.scene.length;
    referenceTotal.textContent = String(total);
  }

  if (description){
    description.addEventListener("input", syncDescriptionCount);
    syncDescriptionCount();
  }

  if (creativeBrief){
    creativeBrief.addEventListener("input", syncCreativeBriefCount);
    syncCreativeBriefCount();
  }

  if (primaryInput){
    primaryInput.addEventListener("change", function(){
      setFiles("primary", primaryInput.files, 1);
    });
  }

  if (angleInput){
    angleInput.addEventListener("change", function(){
      setFiles("angles", angleInput.files, 3);
    });
  }

  if (sceneInput){
    sceneInput.addEventListener("change", function(){
      setFiles("scene", sceneInput.files, 5);
    });
  }

  if (logoInput){
    logoInput.addEventListener("change", function(){
      setFiles("logo", logoInput.files, 1);
    });
  }

  window.addEventListener("beforeunload", function(){
    Object.keys(uploadState).forEach(revokeGroup);
  }, { once: true });

  setMode("video");
})();
