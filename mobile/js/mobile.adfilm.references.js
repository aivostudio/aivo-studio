(function AIVO_MOBILE_ADFILM_REFERENCES(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_REFERENCES_V1__) return;
  window.__AIVO_MOBILE_ADFILM_REFERENCES_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  if (!root) return;

  const gallery = root.querySelector("#mobileAdFilmReferenceGallery");
  const totalNode = root.querySelector("#mobileAdFilmReferenceTotal");
  const statusNode = root.querySelector(".mobile-adfilm-action-status");
  const inputs = {
    primary: root.querySelector("#mobileAdFilmPrimaryImage"),
    angles: root.querySelector("#mobileAdFilmAngleImages"),
    scene: root.querySelector("#mobileAdFilmSceneImages"),
    logo: root.querySelector("#mobileAdFilmLogoImage")
  };
  const config = {
    primary: { limit: 1, kind: "product-image", maxBytes: 12 * 1024 * 1024, label: function(){ return "@Image1"; } },
    angles: { limit: 3, kind: "product-image", maxBytes: 12 * 1024 * 1024, label: function(index){ return "@Image" + (index + 2); } },
    scene: { limit: 5, kind: "product-image", maxBytes: 12 * 1024 * 1024, label: function(index){ return "@Image" + (index + 5); } },
    logo: { limit: 1, kind: "logo", maxBytes: 5 * 1024 * 1024, label: function(){ return "Overlay"; } }
  };
  const counters = {
    primary: root.querySelector("#mobileAdFilmPrimaryCount"),
    angles: root.querySelector("#mobileAdFilmAngleCount"),
    scene: root.querySelector("#mobileAdFilmSceneCount"),
    logo: root.querySelector("#mobileAdFilmLogoCount")
  };
  const groupByInput = new Map();
  Object.keys(inputs).forEach(function(group){ if (inputs[group]) groupByInput.set(inputs[group], group); });

  const state = { primary: [], angles: [], scene: [], logo: [] };
  const MANIFEST_PREFIX = "aivo_mobile_adfilm_reference_manifest_v1:";
  let activeProjectId = "";
  let sequence = 0;
  let uploadChain = Promise.resolve();
  let restoring = false;

  function clean(value){ return String(value == null ? "" : value).trim(); }
  function fingerprint(file){ return [file.name || "", Number(file.size || 0), file.type || "", Number(file.lastModified || 0)].join("|"); }
  function entryId(){ sequence += 1; return "ref-" + Date.now().toString(36) + "-" + sequence.toString(36); }

  function toast(type, message, duration){
    try {
      if (window.toast && typeof window.toast[type] === "function") {
        return window.toast[type]({ message: message, duration: duration == null ? 3200 : duration });
      }
      if (typeof window.showToast === "function") return window.showToast(message, type);
    } catch (_) {}
    return null;
  }

  function setStatus(mode, message){
    root.dataset.adfilmReferenceStatus = mode;
    if (!statusNode) return;
    statusNode.dataset.state = mode;
    statusNode.textContent = message;
  }

  function syncApi(){ return window.AIVOMobileAdFilmProjectSync || null; }
  function projectApi(){ return window.AIVOMobileAdFilmProjects || window.AIVOAdFilmProjects || null; }
  function projectId(){
    const sync = syncApi();
    return clean(root.dataset.adfilmProjectId || (sync && typeof sync.projectId === "function" && sync.projectId()) || (window.AIVOAdFilmActiveProject && window.AIVOAdFilmActiveProject.id));
  }

  function manifestKey(id){ return MANIFEST_PREFIX + clean(id); }
  function readManifest(id){
    if (!id) return null;
    try {
      const parsed = JSON.parse(localStorage.getItem(manifestKey(id)) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) { return null; }
  }
  function writeManifest(){
    const id = projectId();
    if (!id) return;
    const payload = { version: 1, projectId: id, updatedAt: new Date().toISOString(), groups: {} };
    Object.keys(state).forEach(function(group){
      payload.groups[group] = state[group].filter(function(entry){ return !!entry.remote; }).map(function(entry){
        return {
          fingerprint: entry.fingerprint || "",
          key: entry.remote.key,
          url: entry.remote.publicUrl || entry.remote.url || "",
          publicUrl: entry.remote.publicUrl || null,
          readUrl: entry.remote.readUrl || null,
          name: entry.remote.name || "media",
          contentType: entry.remote.contentType || "application/octet-stream",
          size: Number(entry.remote.size || 0),
          kind: entry.remote.kind || config[group].kind,
          uploadedAt: entry.remote.uploadedAt || new Date().toISOString()
        };
      });
    });
    try { localStorage.setItem(manifestKey(id), JSON.stringify(payload)); } catch (_) {}
  }

  function remoteFromAsset(asset, group, fp){
    if (!asset || !asset.key) return null;
    return {
      fingerprint: fp || "",
      key: clean(asset.key),
      url: clean(asset.publicUrl || asset.url || asset.readUrl),
      publicUrl: clean(asset.publicUrl) || null,
      readUrl: clean(asset.readUrl) || null,
      name: clean(asset.name) || "media",
      contentType: clean(asset.contentType) || "application/octet-stream",
      size: Number(asset.size || 0),
      kind: clean(asset.kind) || config[group].kind,
      uploadedAt: clean(asset.uploadedAt) || new Date().toISOString()
    };
  }

  function entryFromRemote(asset, group, fp){
    const remote = remoteFromAsset(asset, group, fp);
    if (!remote) return null;
    return {
      id: entryId(),
      fingerprint: fp || remote.fingerprint || remote.key,
      file: null,
      previewUrl: remote.publicUrl || remote.url,
      objectUrl: false,
      remote: remote,
      uploading: false,
      failed: false
    };
  }

  function revoke(entry){
    if (!entry || !entry.objectUrl || !entry.previewUrl) return;
    try { URL.revokeObjectURL(entry.previewUrl); } catch (_) {}
    entry.previewUrl = "";
    entry.objectUrl = false;
  }

  function clearState(){
    Object.keys(state).forEach(function(group){
      state[group].forEach(revoke);
      state[group] = [];
    });
  }

  function label(group, index){ return config[group].label(index); }
  function referenceCount(){ return state.primary.length + state.angles.length + state.scene.length; }

  function render(){
    Object.keys(config).forEach(function(group){
      const amount = state[group].length;
      if (counters[group]) counters[group].textContent = amount + " / " + config[group].limit;
      const card = root.querySelector('[data-adfilm-upload-item="' + group + '"]');
      if (card) card.classList.toggle("is-filled", amount > 0);
    });
    if (totalNode) totalNode.textContent = String(referenceCount());
    root.dataset.adfilmRemoteReferenceCount = String(orderedEntries().filter(function(entry){ return !!entry.remote; }).length);

    if (!gallery) return;
    gallery.innerHTML = "";
    ["primary", "angles", "scene", "logo"].forEach(function(group){
      state[group].forEach(function(entry, index){
        const thumb = document.createElement("div");
        thumb.className = "mobile-adfilm-reference-thumb";
        if (entry.uploading) thumb.classList.add("is-uploading");
        if (entry.failed) thumb.classList.add("is-upload-failed");
        thumb.setAttribute("data-reference-group", group);
        thumb.setAttribute("data-reference-index", String(index));
        thumb.setAttribute("data-reference-entry-id", entry.id);

        const image = document.createElement("img");
        image.src = entry.previewUrl || (entry.remote && (entry.remote.publicUrl || entry.remote.url)) || "";
        image.alt = label(group, index) + " referansı";
        thumb.appendChild(image);

        const badge = document.createElement("span");
        badge.className = "mobile-adfilm-reference-thumb-label";
        badge.textContent = entry.uploading ? "Yükleniyor" : label(group, index);
        thumb.appendChild(badge);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "mobile-adfilm-reference-delete";
        remove.setAttribute("aria-label", label(group, index) + " görselini sil");
        thumb.appendChild(remove);
        gallery.appendChild(thumb);
      });
    });
  }

  function validFile(group, file){
    if (!file) return false;
    const type = clean(file.type).toLowerCase();
    const imageOk = /^(image\/jpeg|image\/png|image\/webp)$/.test(type);
    const logoOk = imageOk || type === "image/svg+xml";
    if (group === "logo" ? !logoOk : !imageOk) {
      toast("warning", group === "logo" ? "Logo için JPG, PNG, WEBP veya SVG kullan." : "Referans için yalnızca JPG, PNG veya WEBP kullan.", 3800);
      return false;
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > config[group].maxBytes) {
      toast("warning", group === "logo" ? "Logo en fazla 5 MB olabilir." : "Her referans görseli en fazla 12 MB olabilir.", 3800);
      return false;
    }
    return true;
  }

  function makeLocalEntry(file){
    return {
      id: entryId(),
      fingerprint: fingerprint(file),
      file: file,
      previewUrl: URL.createObjectURL(file),
      objectUrl: true,
      remote: null,
      uploading: false,
      failed: false
    };
  }

  function addFiles(group, fileList){
    const incoming = Array.from(fileList || []).filter(function(file){ return validFile(group, file); });
    if (!incoming.length) return;

    if (group === "primary" || group === "logo") {
      state[group].forEach(revoke);
      state[group] = [];
    }

    const seen = new Set(state[group].map(function(entry){ return entry.fingerprint; }));
    incoming.forEach(function(file){
      if (state[group].length >= config[group].limit) return;
      const fp = fingerprint(file);
      if (seen.has(fp)) return;
      state[group].push(makeLocalEntry(file));
      seen.add(fp);
    });
    render();
    queueUpload();
  }

  function orderedEntries(){ return state.primary.concat(state.angles, state.scene); }
  function remoteAsset(entry){
    if (!entry || !entry.remote) return null;
    const remote = entry.remote;
    return {
      key: remote.key,
      url: remote.publicUrl || remote.url,
      name: remote.name,
      contentType: remote.contentType,
      size: remote.size,
      kind: remote.kind,
      uploadedAt: remote.uploadedAt
    };
  }

  function currentLogoAsset(){ return state.logo.length ? remoteAsset(state.logo[0]) : null; }

  async function persistProjectMedia(){
    const sync = syncApi();
    if (!sync || typeof sync.project !== "function" || typeof sync.save !== "function") return null;
    const source = sync.project();
    if (!source) return null;
    const media = Object.assign({}, source.media || {});
    media.productImages = orderedEntries().filter(function(entry){ return !!entry.remote; }).slice(0, 6).map(remoteAsset).filter(Boolean);
    media.logo = currentLogoAsset();
    source.media = media;
    window.AIVOAdFilmServerMedia = media;
    root.dataset.adfilmRemoteProductCount = String(media.productImages.length);
    writeManifest();
    const saved = await sync.save();
    return saved || source;
  }

  function findEntry(id){
    for (const group of Object.keys(state)) {
      const found = state[group].find(function(entry){ return entry.id === id; });
      if (found) return { group: group, entry: found };
    }
    return null;
  }

  async function uploadPending(){
    const id = projectId();
    const api = projectApi();
    if (!id || !api || typeof api.uploadFile !== "function") {
      setStatus("waiting", "Referans yükleme için bulut projesi bekleniyor...");
      return;
    }

    const jobs = [];
    Object.keys(state).forEach(function(group){
      state[group].forEach(function(entry){
        if (entry.file && !entry.remote && !entry.uploading) jobs.push({ group: group, entryId: entry.id });
      });
    });
    if (!jobs.length) {
      await persistProjectMedia();
      return;
    }

    let uploadedCount = 0;
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      const found = findEntry(job.entryId);
      if (!found || !found.entry.file || found.entry.remote) continue;
      const entry = found.entry;
      entry.uploading = true;
      entry.failed = false;
      setStatus("uploading", "Referanslar yükleniyor: " + (index + 1) + "/" + jobs.length);
      render();
      try {
        const uploaded = await api.uploadFile(id, entry.file, config[job.group].kind);
        const current = findEntry(job.entryId);
        if (!current) continue;
        const remote = remoteFromAsset(uploaded, job.group, entry.fingerprint);
        remote.fingerprint = entry.fingerprint;
        current.entry.remote = remote;
        current.entry.uploading = false;
        current.entry.failed = false;
        if (current.entry.objectUrl) revoke(current.entry);
        current.entry.previewUrl = remote.publicUrl || remote.url;
        uploadedCount += 1;
        writeManifest();
        render();
      } catch (error) {
        console.error("[MOBILE ADFILM] reference upload", error);
        const current = findEntry(job.entryId);
        if (current) {
          current.entry.uploading = false;
          current.entry.failed = true;
        }
        render();
        const code = clean(error && error.data && error.data.error || error && error.message).toLowerCase();
        if (error && error.status === 401) toast("warning", "Referans yüklemek için AIVO hesabına giriş yapmalısın.", 4200);
        else if (code.indexOf("invalid_content_type") >= 0) toast("warning", "Bu görsel türü desteklenmiyor.", 4200);
        else if (code.indexOf("invalid_file_size") >= 0) toast("warning", "Görsel izin verilen boyut sınırını aşıyor.", 4200);
        else toast("error", "Referans görseli buluta yüklenemedi. Tekrar deneyebilirsin.", 4400);
      }
    }

    try {
      await persistProjectMedia();
      setStatus("saved", "Referanslar buluta kaydedildi.");
      if (uploadedCount === 1) toast("success", "Referans görseli buluta yüklendi.", 2500);
      else if (uploadedCount > 1) toast("success", uploadedCount + " referans görseli buluta yüklendi.", 2800);
    } catch (error) {
      console.error("[MOBILE ADFILM] reference media save", error);
      setStatus("error", "Referansların proje kaydı tamamlanamadı.");
      toast("error", "Referanslar R2'ye yüklendi ancak proje kaydı tamamlanamadı.", 4400);
    }
  }

  function queueUpload(){
    uploadChain = uploadChain.catch(function(){}).then(uploadPending);
    return uploadChain;
  }

  function removeEntry(group, index){
    if (!state[group] || !state[group][index]) return;
    const entry = state[group][index];
    revoke(entry);
    state[group].splice(index, 1);
    render();
    writeManifest();
    uploadChain = uploadChain.catch(function(){}).then(async function(){
      try {
        await persistProjectMedia();
        setStatus("saved", "Referanslar buluta kaydedildi.");
      } catch (error) {
        console.error("[MOBILE ADFILM] reference remove save", error);
        setStatus("error", "Referans değişikliği kaydedilemedi.");
        toast("error", "Referans değişikliği buluta kaydedilemedi.", 4200);
      }
    });
  }

  function restoreFromManifestOrProject(id, project){
    if (!id || restoring) return;
    if (activeProjectId === id && referenceCount() + state.logo.length > 0) return;
    restoring = true;
    clearState();
    activeProjectId = id;

    const manifest = readManifest(id);
    if (manifest && manifest.groups) {
      Object.keys(state).forEach(function(group){
        const list = Array.isArray(manifest.groups[group]) ? manifest.groups[group].slice(0, config[group].limit) : [];
        state[group] = list.map(function(asset){ return entryFromRemote(asset, group, asset.fingerprint); }).filter(Boolean);
      });
    } else {
      const media = project && project.media || {};
      const products = Array.isArray(media.productImages) ? media.productImages.slice(0, 6) : [];
      if (products[0]) state.primary = [entryFromRemote(products[0], "primary", products[0].key)].filter(Boolean);
      products.slice(1, 4).forEach(function(asset){ const entry = entryFromRemote(asset, "angles", asset.key); if (entry) state.angles.push(entry); });
      products.slice(4, 6).forEach(function(asset){ const entry = entryFromRemote(asset, "scene", asset.key); if (entry) state.scene.push(entry); });
      if (media.logo) state.logo = [entryFromRemote(media.logo, "logo", media.logo.key)].filter(Boolean);
      writeManifest();
    }

    restoring = false;
    render();
  }

  function handleProject(project){
    const id = clean(project && project.id || projectId());
    if (!id) return;
    restoreFromManifestOrProject(id, project || window.AIVOAdFilmActiveProject || {});
    if (Object.keys(state).some(function(group){ return state[group].some(function(entry){ return entry.file && !entry.remote; }); })) queueUpload();
  }

  document.addEventListener("change", function(event){
    const group = groupByInput.get(event.target);
    if (!group) return;
    const files = Array.from(event.target.files || []);
    event.stopPropagation();
    event.stopImmediatePropagation();
    addFiles(group, files);
    event.target.value = "";
  }, true);

  document.addEventListener("click", function(event){
    const button = event.target && event.target.closest && event.target.closest("#mobileAdFilmSection .mobile-adfilm-reference-delete");
    if (!button) return;
    const thumb = button.closest("[data-reference-group][data-reference-index]");
    if (!thumb) return;
    const group = clean(thumb.getAttribute("data-reference-group"));
    const index = Number(thumb.getAttribute("data-reference-index"));
    if (!state[group] || !Number.isInteger(index)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    removeEntry(group, index);
  }, true);

  document.addEventListener("aivo:adfilm-project-sync", function(event){
    const project = event && event.detail && event.detail.project;
    handleProject(project || window.AIVOAdFilmActiveProject || null);
  });

  window.addEventListener("pagehide", function(){
    Object.keys(state).forEach(function(group){ state[group].forEach(revoke); });
  });

  window.AIVOMobileAdFilmReferences = {
    current: function(){
      return {
        projectId: projectId(),
        primary: state.primary.slice(),
        angles: state.angles.slice(),
        scene: state.scene.slice(),
        logo: state.logo.slice(),
        ordered: orderedEntries().slice(),
        imageUrls: orderedEntries().filter(function(entry){ return !!entry.remote; }).map(function(entry){ return entry.remote.publicUrl || entry.remote.url; }),
        logoUrl: state.logo[0] && state.logo[0].remote ? (state.logo[0].remote.publicUrl || state.logo[0].remote.url) : "",
        referenceMap: {
          hero: state.primary.length ? 1 : null,
          angles: state.angles.map(function(_, index){ return 2 + index; }),
          scenes: state.scene.map(function(_, index){ return 2 + state.angles.length + index; })
        }
      };
    },
    sync: function(){ handleProject(window.AIVOAdFilmActiveProject || null); return queueUpload(); },
    render: render
  };

  handleProject(window.AIVOAdFilmActiveProject || null);
  render();
})();