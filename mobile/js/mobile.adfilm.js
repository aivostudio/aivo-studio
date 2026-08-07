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
  const referenceGallery = root.querySelector("#mobileAdFilmReferenceGallery");
  const primaryInput = root.querySelector("#mobileAdFilmPrimaryImage");
  const angleInput = root.querySelector("#mobileAdFilmAngleImages");
  const sceneInput = root.querySelector("#mobileAdFilmSceneImages");
  const logoInput = root.querySelector("#mobileAdFilmLogoImage");

  const voiceEnabled = root.querySelector("#mobileAdFilmVoiceEnabled");
  const voiceState = root.querySelector("#mobileAdFilmVoiceState");
  const voiceBody = root.querySelector("#mobileAdFilmVoiceBody");
  const narrationText = root.querySelector("#mobileAdFilmNarrationText");
  const narrationCount = root.querySelector("#mobileAdFilmNarrationCount");

  const uploadState = {
    primary: [],
    angles: [],
    scene: [],
    logo: []
  };

  const uploadConfig = {
    primary: {
      count: root.querySelector("#mobileAdFilmPrimaryCount"),
      input: primaryInput,
      limit: 1,
      label: function(){ return "@Image1"; }
    },
    angles: {
      count: root.querySelector("#mobileAdFilmAngleCount"),
      input: angleInput,
      limit: 3,
      label: function(index){ return "@Image" + (index + 2); }
    },
    scene: {
      count: root.querySelector("#mobileAdFilmSceneCount"),
      input: sceneInput,
      limit: 5,
      label: function(index){ return "@Image" + (index + 5); }
    },
    logo: {
      count: root.querySelector("#mobileAdFilmLogoCount"),
      input: logoInput,
      limit: 1,
      label: function(){ return "Overlay"; }
    }
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

  function fileKey(file){
    return [file.name, file.size, file.lastModified, file.type].join("|");
  }

  function setFiles(group, fileList, limit, append){
    const files = Array.from(fileList || []);

    if (!append){
      revokeGroup(group);
    }

    const existingKeys = new Set(uploadState[group].map(function(item){
      return fileKey(item.file);
    }));

    files.forEach(function(file){
      if (uploadState[group].length >= limit) return;
      const key = fileKey(file);
      if (existingKeys.has(key)) return;

      uploadState[group].push({
        file: file,
        url: URL.createObjectURL(file)
      });
      existingKeys.add(key);
    });

    const config = uploadConfig[group];
    if (config && config.input){
      config.input.value = "";
    }

    renderReferences();
  }

  function removeReference(group, index){
    const item = uploadState[group][index];
    if (!item) return;

    if (item.url) URL.revokeObjectURL(item.url);
    uploadState[group].splice(index, 1);

    const config = uploadConfig[group];
    if (config && config.input && uploadState[group].length === 0){
      config.input.value = "";
    }

    renderReferences();
  }

  function renderReferences(){
    Object.keys(uploadConfig).forEach(function(group){
      const config = uploadConfig[group];
      const amount = uploadState[group].length;

      if (config.count){
        config.count.textContent = amount + " / " + config.limit;
      }

      const uploadItem = root.querySelector('[data-adfilm-upload-item="' + group + '"]');
      if (uploadItem){
        uploadItem.classList.toggle("is-filled", amount > 0);
      }
    });

    syncReferenceTotal();

    if (!referenceGallery) return;
    referenceGallery.innerHTML = "";

    ["primary", "angles", "scene", "logo"].forEach(function(group){
      const config = uploadConfig[group];

      uploadState[group].forEach(function(item, index){
        const thumb = document.createElement("div");
        thumb.className = "mobile-adfilm-reference-thumb";
        thumb.setAttribute("data-reference-group", group);
        thumb.setAttribute("data-reference-index", String(index));

        const image = document.createElement("img");
        image.src = item.url;
        image.alt = config.label(index) + " referansı";
        thumb.appendChild(image);

        const label = document.createElement("span");
        label.className = "mobile-adfilm-reference-thumb-label";
        label.textContent = config.label(index);
        thumb.appendChild(label);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "mobile-adfilm-reference-delete";
        removeButton.setAttribute("aria-label", config.label(index) + " görselini sil");
        removeButton.addEventListener("click", function(event){
          event.preventDefault();
          event.stopPropagation();
          removeReference(group, index);
        });
        thumb.appendChild(removeButton);

        referenceGallery.appendChild(thumb);
      });
    });
  }

  function syncReferenceTotal(){
    if (!referenceTotal) return;
    const total = uploadState.primary.length + uploadState.angles.length + uploadState.scene.length;
    referenceTotal.textContent = String(total);
  }

  function syncVoiceEnabled(){
    if (!voiceEnabled) return;
    const enabled = !!voiceEnabled.checked;
    if (voiceState) voiceState.textContent = enabled ? "Açık" : "Kapalı";
    if (voiceBody) voiceBody.classList.toggle("is-disabled", !enabled);
  }

  function syncNarrationCount(){
    if (!narrationText || !narrationCount) return;
    narrationCount.textContent = String(narrationText.value.length);
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
      setFiles("primary", primaryInput.files, 1, false);
    });
  }

  if (angleInput){
    angleInput.addEventListener("change", function(){
      setFiles("angles", angleInput.files, 3, true);
    });
  }

  if (sceneInput){
    sceneInput.addEventListener("change", function(){
      setFiles("scene", sceneInput.files, 5, true);
    });
  }

  if (logoInput){
    logoInput.addEventListener("change", function(){
      setFiles("logo", logoInput.files, 1, false);
    });
  }

  if (voiceEnabled){
    voiceEnabled.addEventListener("change", syncVoiceEnabled);
    syncVoiceEnabled();
  }

  if (narrationText){
    narrationText.addEventListener("input", syncNarrationCount);
    syncNarrationCount();
  }

  window.addEventListener("beforeunload", function(){
    Object.keys(uploadState).forEach(revokeGroup);
  }, { once: true });

  renderReferences();
  setMode("video");
})();
