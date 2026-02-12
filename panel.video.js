  function attachPPE(host) {
    if (!window.PPE) return () => {};

    const prev = PPE.onOutput;
    let active = true;

    const handler = (job, out) => {
      try { prev && prev(job, out); } catch {}
      if (!active) return;

      if (!out || out.type !== "video" || !out.url) return;

      const job_id =
        job?.job_id ||
        job?.id ||
        out?.meta?.job_id ||
        out?.meta?.id ||
        null;

      const jid = job_id != null ? String(job_id) : null;

      const existing = jid
        ? state.items.find(x => x.job_id === jid || x.id === jid)
        : null;

      const fallbackProcessing = !existing
        ? state.items.find(x => !x.url && (x.status === "İşleniyor" || x.status === "processing"))
        : null;

      const target = existing || fallbackProcessing;

      if (target) {
        target.url = out.url;
        target.status = "Hazır";
        target.title = out?.meta?.title || out?.meta?.prompt || target.title || "Video";
        if (!target.job_id && jid) target.job_id = jid;
        if (target.id == null && jid) target.id = jid;
      } else {
        state.items.unshift({
          id: uid(),
          job_id: jid,
          url: out.url,
          status: "Hazır",
          title: out?.meta?.title || out?.meta?.prompt || "Video"
        });
      }

      saveItems();
      render(host);
    };

    // ✅ kritik satır: handler DIŞINDA atanır
    PPE.onOutput = handler;

    return () => {
      active = false;
      if (PPE.onOutput === handler) PPE.onOutput = prev || null;
    };
  }
