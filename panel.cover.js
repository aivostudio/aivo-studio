(function () {
  function waitForRightPanel(cb) {
    const t0 = Date.now();
    const T = setInterval(() => {
      if (
        window.RightPanel &&
        typeof window.RightPanel.register === "function" &&
        window.DBJobs &&
        typeof window.DBJobs.create === "function"
      ) {
        clearInterval(T);
        cb();
      } else if (Date.now() - t0 > 8000) {
        clearInterval(T);
        console.warn("[cover] RightPanel/DBJobs not ready after 8s");
      }
    }, 50);
  }

  waitForRightPanel(() => {
    const PANEL_KEY = "cover";
    const hiddenDeletedIds = new Set();

    function norm(s) {
      return String(s || "")
        .trim()
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\s+/g, " ");
    }

    function esc(s) {
      return String(s ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c]));
    }

    function to2(n) {
      return String(Number(n) || 0).padStart(2, "0");
    }

    function formatTR(ms) {
      const t = Number(ms);
      if (!Number.isFinite(t) || t <= 0) return "";
      const d = new Date(t);
      return `${to2(d.getDate())}.${to2(d.getMonth() + 1)}.${d.getFullYear()} ${to2(d.getHours())}:${to2(d.getMinutes())}`;
    }

    function parseTime(v) {
      if (v == null) return 0;
      if (typeof v === "number" && Number.isFinite(v)) return v;

      const s = String(v).trim();
      if (!s) return 0;

      if (/^\d{10,13}$/.test(s)) {
        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
      }

      if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s) && !s.includes("T")) {
        const iso = s.replace(" ", "T") + "Z";
        const t = Date.parse(iso);
        return Number.isFinite(t) ? t : 0;
      }

      const t = Date.parse(s);
      return Number.isFinite(t) ? t : 0;
    }

    function isCoverApp(v) {
      const a = norm(v);
      return a === "cover" || a.includes("cover");
    }

    function getJobApp(job) {
      return String(
        job?.app ||
        job?.meta?.app ||
        job?.meta?.module ||
        job?.meta?.routeKey ||
        ""
      ).trim();
    }

    function getOutApp(o) {
      return String(
        o?.meta?.app ||
        o?.meta?.module ||
        o?.meta?.routeKey ||
        ""
      ).trim();
    }

    function isJobCover(job) {
      return isCoverApp(getJobApp(job));
    }

    function qualityToLabel(q) {
      const v = String(q || "").toLowerCase();
      if (v === "ultra") return "Cinematic Ultra HD";
      return "Artist";
    }

    function inferQuality(job) {
      return (
        job?.quality ||
        job?.meta?.quality ||
        job?.outputs?.[0]?.meta?.quality ||
        "artist"
      );
    }

    function mapBadge(job) {
      const a = norm(job?.db_status);
      const b = norm(job?.status);
      const c = norm(job?.state);
      const st = (a || b || c || "").toUpperCase();

      if (st.includes("FAIL") || st.includes("ERROR")) {
        return { text: "Başarısız", kind: "bad" };
      }

      if (
        st.includes("READY") ||
        st.includes("DONE") ||
        st.includes("COMPLET") ||
        st.includes("SUCC")
      ) {
        return { text: "Hazır", kind: "ok" };
      }

      return { text: "İşleniyor", kind: "mid" };
    }

    function pickBestImageOutput(job) {
      const outs = Array.isArray(job?.outputs) ? job.outputs : [];
      if (!outs.length) return null;

      const filtered = outs.filter((o) => {
        const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind);
        if (t && t !== "image") return false;

        const oa = getOutApp(o);
        if (oa && !isCoverApp(oa)) return false;

        return true;
      });

      const pool = filtered.length ? filtered : outs;

      const best =
        pool.find((o) => {
          const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind);
          return t === "image";
        }) || pool[0];

      if (!best) return null;

      const url = String(
        best?.url ||
        best?.image_url ||
        best?.imageUrl ||
        best?.raw_url ||
        best?.rawUrl ||
        best?.meta?.url ||
        best?.meta?.image_url ||
        best?.meta?.imageUrl ||
        ""
      ).trim();

      if (!url) return null;

      return { ...best, url };
    }

    function ensureStyles() {
      if (document.getElementById("cpStyles")) return;

      const s = document.createElement("style");
      s.id = "cpStyles";
      s.textContent = `
        .cpGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        .cpEmpty{opacity:.7;font-size:13px;padding:12px}
        .cpCard{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:18px;overflow:hidden;backdrop-filter:blur(10px);}
        .cpThumb{position:relative;aspect-ratio:1/1;background-size:cover;background-position:center;background-color:rgba(255,255,255,.04);}
        .cpThumb.is-loading{background:rgba(255,255,255,.04)}
        .cpBadge{position:absolute;top:10px;left:10px;font-size:12px;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.10);z-index:3;}
        .cpBadge.ok{border-color:rgba(120,255,190,.22)}
        .cpBadge.mid{border-color:rgba(255,255,255,.10)}
        .cpBadge.bad{border-color:rgba(255,120,120,.25)}
        .cpSkel{position:absolute;inset:0;overflow:hidden}
        .cpShimmer{position:absolute;inset:-40%;transform:rotate(12deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);animation:cpShim 1.2s infinite;}
        @keyframes cpShim{0%{transform:translateX(-40%) rotate(12deg)}100%{transform:translateX(40%) rotate(12deg)}}
        .cpOverlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);opacity:0;transition:opacity .18s ease;z-index:2;}
        .cpCard:hover .cpOverlay{opacity:1}
        @media (hover:none){.cpOverlay{opacity:1;background:rgba(0,0,0,.18);}}
        .cpOverlayBtns{display:flex;gap:12px;padding:10px 12px;border-radius:18px;background:rgba(20,20,28,.35);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(10px);}
        .cpBtn{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);display:grid;place-items:center;cursor:pointer;transition:transform .12s ease,background .12s ease,border-color .12s ease;}
        .cpBtn svg{width:22px;height:22px;opacity:.95}
        .cpBtn:hover{transform:translateY(-1px);background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.22);}
        .cpBtn:active{transform:translateY(0px) scale(.98)}
        .cpBtn:disabled{opacity:.45;cursor:not-allowed}
        .cpBtn.danger{border-color:rgba(255,90,90,.28)}
        .cpBtn.danger:hover{background:rgba(255,90,90,.10);border-color:rgba(255,90,90,.35)}
        .cpBottom{padding:12px 12px 14px;display:flex;align-items:center;gap:10px;}
        .cpName{font-size:12px;opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      `;
      document.head.appendChild(s);
    }

    function findGrid(host) {
      return host.querySelector("[data-cover-grid]");
    }

    function iconEye() {
      return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.8"/><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" stroke-width="1.8"/></svg>`;
    }

    function iconDown() {
      return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7.5 10.8 12 15.3l4.5-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    }

    function iconShare() {
      return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 4l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M20 14v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    }

    function iconTrash() {
      return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 11v7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 11v7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 7l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    }

function download(url) {
  const proxied = `/api/media/proxy?url=${encodeURIComponent(url)}&filename=cover.jpg`;

  const a = document.createElement("a");
  a.href = proxied;
  a.download = "cover.jpg";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
    function share(url) {
      if (navigator.share) navigator.share({ url }).catch(() => {});
      else navigator.clipboard?.writeText(url).catch(() => {});
    }

    function render(host, items) {
      const grid = findGrid(host);
      if (!grid) return;

      const list = Array.isArray(items) ? items : [];

      if (!list.length) {
        grid.innerHTML = `<div class="cpEmpty">Henüz kapak yok.</div>`;
        return;
      }

      grid.innerHTML = list.map((job) => {
        const badge = mapBadge(job);
        const out = pickBestImageOutput(job);
        const url = out?.url || "";
        const ready = badge.kind === "ok" && !!url;

        const quality = inferQuality(job);
        const label = qualityToLabel(quality);

        const when =
          formatTR(
            parseTime(job?.created_at) ||
            parseTime(job?.updated_at) ||
            parseTime(job?.createdAt)
          ) || "";

        const name = when ? `${label} • ${when}` : label;
        const thumbStyle = ready ? `style="background-image:url('${esc(url)}')"` : "";

        const promptText = String(
          job?.prompt ||
          job?.meta?.prompt ||
          ""
        ).trim();

        return `
          <div class="cpCard" data-id="${esc(String(job?.job_id || job?.id || ""))}" tabindex="0">
            <div class="cpThumb ${ready ? "" : "is-loading"}" ${thumbStyle}>
              <div class="cpBadge ${esc(badge.kind)}">${esc(badge.text)}</div>
              ${ready ? "" : `<div class="cpSkel"><div class="cpShimmer"></div></div>`}
              <div class="cpOverlay" aria-hidden="${ready ? "false" : "true"}">
                <div class="cpOverlayBtns">
                  <button class="cpBtn" data-act="open" title="Görüntüle" ${ready ? "" : "disabled"}>${iconEye()}</button>
                  <button class="cpBtn" data-act="download" title="İndir" ${ready ? "" : "disabled"}>${iconDown()}</button>
                  <button class="cpBtn" data-act="share" title="Paylaş" ${ready ? "" : "disabled"}>${iconShare()}</button>
                  <button class="cpBtn danger" data-act="delete" title="Sil">${iconTrash()}</button>
                </div>
              </div>
            </div>
            <div class="cpBottom">
              <div class="cpName" title="${esc(promptText || name)}">${esc(name)}</div>
            </div>
          </div>
        `;
      }).join("");
    }

    window.RightPanel.register(PANEL_KEY, {
      getHeader() {
        return {
          title: "Kapaklarım",
          meta: "",
          searchPlaceholder: "Kapaklarda ara..."
        };
      },

      mount(host) {
        ensureStyles();

        host.innerHTML = `
          <div class="coverSide">
            <div class="coverSideCard">
              <div class="cpGrid" data-cover-grid></div>
            </div>
          </div>
        `;

        const controller = window.DBJobs.create({
          app: "cover",
          debug: false,
          pollIntervalMs: 4000,
          hydrateEveryMs: 15000,

          acceptJob(job) {
            if (!job) return false;
            const ja = getJobApp(job);
            if (ja && !isCoverApp(ja)) return false;
            return true;
          },

          acceptOutput(o) {
            if (!o) return false;
            const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind);
            if (t && t !== "image") return false;

            const oa = getOutApp(o);
            if (oa && !isCoverApp(oa)) return false;

            return true;
          },

          onChange(items) {
            const safeItems = (items || [])
  .filter(isJobCover)
  .filter((x) => !hiddenDeletedIds.has(String(x?.job_id || x?.id || "")))
  .sort((a, b) => {
                const ta =
                  parseTime(a?.updated_at) ||
                  parseTime(a?.created_at) ||
                  parseTime(a?.createdAt) ||
                  0;

                const tb =
                  parseTime(b?.updated_at) ||
                  parseTime(b?.created_at) ||
                  parseTime(b?.createdAt) ||
                  0;

                if (tb !== ta) return tb - ta;

                const ia = String(a?.job_id || a?.id || "");
                const ib = String(b?.job_id || b?.id || "");
                return ib.localeCompare(ia);
              });

            render(host, safeItems);
          },
        });

        try {
          controller?.hydrate?.();
        } catch (e) {
          console.warn("[cover] initial hydrate failed", e);
        }

        const onCoverJobCreated = (e) => {
          const d = e?.detail || {};
          if (!isCoverApp(d.app || d.meta?.app || "cover")) return;

          try {
            controller?.hydrate?.();
          } catch (err) {
            console.warn("[cover] hydrate after job_created failed", err);
          }
        };

        const onClick = (e) => {
          const card = e.target.closest(".cpCard");
          if (!card) return;

          const id = String(card.getAttribute("data-id") || "");
          if (!id) return;

          const items = Array.isArray(controller?.state?.items) ? controller.state.items : [];
          const job = items.find((x) => String(x?.job_id || x?.id || "") === id);
          if (!job) return;

          const btn = e.target.closest("[data-act]");
          if (!btn) return;

          const act = btn.getAttribute("data-act");
          const out = pickBestImageOutput(job);
          const url = out?.url || "";

     if (act === "delete") {
  fetch("/api/jobs/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ job_id: id }),
  })
    .then((r) => r.json())
    .then((j) => {
      if (!j?.ok) throw new Error(j?.error || "delete_failed");

      hiddenDeletedIds.add(String(id));

      const currentItems = Array.isArray(controller?.state?.items) ? controller.state.items : [];
      const visibleItems = currentItems.filter(
        (x) => !hiddenDeletedIds.has(String(x?.job_id || x?.id || ""))
      );

      render(host, visibleItems);
      controller?.hydrate?.();
    })
    .catch((err) => {
      console.error("[cover] delete failed", err);
    });

  return;
}

          if (!url) return;

          if (act === "open") window.open(url, "_blank", "noopener");
          if (act === "download") download(url);
          if (act === "share") share(url);
        };

        host.addEventListener("click", onClick, true);
        window.addEventListener("aivo:cover:job_created", onCoverJobCreated, true);

        return () => {
          try { host.removeEventListener("click", onClick, true); } catch {}
          try { window.removeEventListener("aivo:cover:job_created", onCoverJobCreated, true); } catch {}
          try { controller?.destroy?.(); } catch {}
        };
      },
    });
  });
})();
