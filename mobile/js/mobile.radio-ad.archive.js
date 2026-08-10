(function AIVO_MOBILE_RADIO_AD_ARCHIVE(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_ARCHIVE_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_ARCHIVE_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  const view = root && root.querySelector('[data-mobile-adfilm-view="radio"]');
  const finalCard = view && view.querySelector('[data-mobile-radio-card="final"]');
  const finalEmpty = finalCard && finalCard.querySelector('[data-mobile-radio-final-empty]');
  if (!root || !view || !finalCard) return;

  let audio = null;
  let playingKey = "";
  let refreshTimer = null;
  let refreshSeq = 0;

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function t(key, params, fallback){
    try{
      if (typeof window.t === "function"){
        const value = window.t(key, params);
        if (value && value !== key) return String(value);
      }
    }catch(_){ }
    return fallback == null ? key : String(fallback);
  }

  function locale(){
    try{
      if (window.AIVOMobileAdFilmI18n && typeof window.AIVOMobileAdFilmI18n.locale === "function") {
        return window.AIVOMobileAdFilmI18n.locale();
      }
    }catch(_){ }
    return String(window.AIVO_LANG || document.documentElement.lang || "tr").toLowerCase().indexOf("en") === 0 ? "en-US" : "tr-TR";
  }

  function notify(message, type){
    try{
      const fn = window.toastSafe || window.showToast || window.toastMsg;
      if (typeof fn === "function") fn(message, type || "info");
    }catch(_){ }
  }

  async function request(url, options){
    const response = await fetch(url, Object.assign({
      credentials:"include",
      cache:"no-store",
      headers:{Accept:"application/json"}
    }, options || {}));
    const data = await response.json().catch(function(){ return {}; });
    if (!response.ok){
      const error = new Error(data.message || data.error || ("HTTP " + response.status));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function formatDate(value){
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale(),{
      day:"2-digit",
      month:"2-digit",
      hour:"2-digit",
      minute:"2-digit"
    }).format(date);
  }

  function downloadIcon(){
    return '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>';
  }

  function deleteIcon(){
    return '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14M10 11v6m4-6v6"/></svg>';
  }

  function stopAudio(){
    if (audio){
      audio.pause();
      try{ audio.currentTime = 0; }catch(_){ }
    }
    audio = null;
    playingKey = "";
    finalCard.querySelectorAll('[data-mobile-radio-final-play]').forEach(function(button){
      button.classList.remove("is-playing");
    });
  }

  function projectItems(project){
    if (!project || !project.id) return [];
    const history = Array.isArray(project.finalHistory) ? project.finalHistory.slice() : [];
    if (project.final && project.final.url){
      const currentId = clean(project.final.id);
      const exists = history.some(function(item){
        return currentId
          ? clean(item && item.id) === currentId
          : clean(item && item.url) === clean(project.final.url);
      });
      if (!exists) history.unshift(project.final);
    }

    return history
      .filter(function(item){ return item && item.url; })
      .map(function(item){
        return Object.assign({}, item, {
          _projectId: clean(project.id),
          _projectTitle: clean(project.title || t("radioad.final.itemTitle", null, "Radyo Reklamı")) || t("radioad.final.itemTitle", null, "Radyo Reklamı"),
          _projectUpdatedAt: project.updatedAt || null
        });
      });
  }

  function flattenProjects(projects){
    const all = [];
    (Array.isArray(projects) ? projects : []).forEach(function(project){
      projectItems(project).forEach(function(item){ all.push(item); });
    });

    const seen = new Set();
    return all
      .filter(function(item){
        const key = clean(item._projectId) + "::" + clean(item.id || item.url);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(function(a,b){
        const at = Date.parse(a.createdAt || a._projectUpdatedAt || "") || 0;
        const bt = Date.parse(b.createdAt || b._projectUpdatedAt || "") || 0;
        return bt - at;
      })
      .slice(0,100);
  }

  async function downloadFinal(projectId, finalId, finalFormat){
    const response = await fetch(
      "/api/radio-ad/final/download?projectId=" + encodeURIComponent(projectId) + "&finalId=" + encodeURIComponent(finalId),
      {credentials:"include",cache:"no-store"}
    );
    if (!response.ok) throw new Error("final_download_failed");

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "AIVO-Radio-Ad." + (clean(finalFormat).toLowerCase() === "wav" ? "wav" : "mp3");
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(function(){
      URL.revokeObjectURL(objectUrl);
      link.remove();
    },1200);
  }

  function render(items){
    const status = finalEmpty && finalEmpty.querySelector('.mobile-adfilm-voice-preview-status');
    if (status) status.textContent = t("radioad.final.count", { count:items.length }, items.length + " kayıt");

    let list = finalCard.querySelector('[data-mobile-radio-final-list]');
    if (!list){
      list = document.createElement("div");
      list.className = "mobile-radio-final-list";
      list.setAttribute("data-mobile-radio-final-list","");
      if (finalEmpty) finalEmpty.insertAdjacentElement("afterend",list);
      else finalCard.appendChild(list);
    }

    if (finalEmpty){
      const emptyTip = finalEmpty.querySelector('.mobile-adfilm-tip');
      if (emptyTip) emptyTip.hidden = items.length > 0;
    }

    stopAudio();

    if (!items.length){
      list.innerHTML = "";
      return;
    }

    list.innerHTML = items.map(function(item,index){
      const id = clean(item.id || ("final-" + index));
      const projectId = clean(item._projectId);
      const fmt = clean(item.format || "mp3").toUpperCase();
      const sec = Number(item.duration || 0);
      const title = clean(item.title || item._projectTitle || t("radioad.final.itemTitle", null, "Radyo Reklamı")) || t("radioad.final.itemTitle", null, "Radyo Reklamı");
      const meta = t("radioad.final.meta", { seconds:sec, format:fmt, date:formatDate(item.createdAt || item._projectUpdatedAt) }, sec + " sn · " + fmt + " · " + formatDate(item.createdAt || item._projectUpdatedAt));
      return '<article class="mobile-radio-final-item" data-mobile-radio-final-id="' + id.replace(/"/g,'&quot;') + '" data-mobile-radio-project-id="' + projectId.replace(/"/g,'&quot;') + '">' +
        '<div class="mobile-radio-final-meta"><b>' + t("radioad.final.version", { version:items.length - index }, "Sürüm " + (items.length - index)) + '</b><em>' + fmt + '</em></div>' +
        '<button class="mobile-radio-final-play" type="button" data-mobile-radio-final-play aria-label="' + t("radioad.final.playAria", null, "Radyo reklamını oynat") + '"></button>' +
        '<h5>' + title.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</h5>' +
        '<small>' + meta + '</small>' +
        '<div class="mobile-radio-final-actions">' +
          '<button type="button" data-mobile-radio-final-download aria-label="' + t("radioad.final.downloadAria", null, "İndir") + '">' + downloadIcon() + '</button>' +
          '<button type="button" data-mobile-radio-final-delete aria-label="' + t("radioad.final.deleteAria", null, "Sil") + '">' + deleteIcon() + '</button>' +
        '</div></article>';
    }).join("");

    list.querySelectorAll('[data-mobile-radio-final-play]').forEach(function(button){
      button.addEventListener("click",function(){
        const card = button.closest('[data-mobile-radio-final-id]');
        const id = card && clean(card.getAttribute("data-mobile-radio-final-id"));
        const projectId = card && clean(card.getAttribute("data-mobile-radio-project-id"));
        const item = items.find(function(entry){
          return clean(entry.id) === id && clean(entry._projectId) === projectId;
        });
        if (!item || !item.url) return;

        const key = projectId + "::" + id;
        if (playingKey === key && audio && !audio.paused){
          stopAudio();
          return;
        }

        stopAudio();
        audio = new Audio(item.url);
        playingKey = key;
        button.classList.add("is-playing");
        audio.addEventListener("ended",stopAudio,{once:true});
        audio.play().catch(function(){
          stopAudio();
          notify(t("radioad.final.playFailed", null, "Radyo reklamı oynatılamadı."),"error");
        });
      });
    });

    list.querySelectorAll('[data-mobile-radio-final-download]').forEach(function(button){
      button.addEventListener("click",async function(){
        const card = button.closest('[data-mobile-radio-final-id]');
        const id = card && clean(card.getAttribute("data-mobile-radio-final-id"));
        const projectId = card && clean(card.getAttribute("data-mobile-radio-project-id"));
        const item = items.find(function(entry){
          return clean(entry.id) === id && clean(entry._projectId) === projectId;
        });
        if (!item || !projectId || !id) return;
        try{
          await downloadFinal(projectId,id,item.format);
        }catch(_){
          notify(t("radioad.final.downloadFailed", null, "Dosya indirilemedi."),"error");
        }
      });
    });

    list.querySelectorAll('[data-mobile-radio-final-delete]').forEach(function(button){
      button.addEventListener("click",async function(){
        const card = button.closest('[data-mobile-radio-final-id]');
        const id = card && clean(card.getAttribute("data-mobile-radio-final-id"));
        const projectId = card && clean(card.getAttribute("data-mobile-radio-project-id"));
        if (!id || !projectId) return;

        try{
          const data = await request("/api/radio-ad/final/delete", {
            method:"POST",
            headers:{
              "Content-Type":"application/json",
              Accept:"application/json"
            },
            body:JSON.stringify({ projectId:projectId, finalId:id })
          });

          const sync = window.AIVOMobileRadioAdProjectSync;
          const activeProjectId = clean(sync && typeof sync.getProjectId === "function" ? sync.getProjectId() : root.dataset.radioAdProjectId);
          if (data.project && activeProjectId === projectId && sync && typeof sync.applyProject === "function"){
            sync.applyProject(data.project);
          }

          stopAudio();
          await refreshArchive();
          notify(t("radioad.final.deleted", null, "Radyo reklamı silindi."),"success");
        }catch(_){
          notify(t("radioad.final.deleteFailed", null, "Radyo reklamı silinemedi."),"error");
        }
      });
    });
  }

  async function refreshArchive(){
    const seq = ++refreshSeq;
    try{
      const data = await request("/api/radio-ad/projects",{method:"GET"});
      if (seq !== refreshSeq) return;
      render(flattenProjects(data.projects));
    }catch(error){
      if (error && error.status === 401) return;
      console.error("[MOBILE RADIO AD] account archive",error);
    }
  }

  function queueRefresh(){
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshArchive,80);
  }

  document.addEventListener("aivo:mobile-radioad-project-sync",queueRefresh);
  document.addEventListener("aivo:language-change",queueRefresh);
  document.addEventListener("visibilitychange",function(){
    if (!document.hidden) queueRefresh();
  });

  window.addEventListener("pagehide",function(){
    clearTimeout(refreshTimer);
    stopAudio();
    document.removeEventListener("aivo:mobile-radioad-project-sync",queueRefresh);
    document.removeEventListener("aivo:language-change",queueRefresh);
  },{once:true});

  window.AIVOMobileRadioAdArchive = {
    refresh:refreshArchive
  };

  refreshArchive();
})();