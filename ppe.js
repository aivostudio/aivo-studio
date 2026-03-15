// /ppe.js
(function () {
  const PPE = {
    // Optional: UI tarafı buraya subscribe olabilir
    onOutput: null,

    // Bulamazsa oluşturur
    ensureTargets() {
      // ❌ mainVideo tamamen kaldırıldı
      let audio = document.getElementById("mainAudio");
      let image = document.getElementById("mainImage");

      if (!audio || !image) {
        const host =
          document.getElementById("rightPanelHost") ||
          document.body;

        let box = document.getElementById("ppeHost");
        if (!box) {
          box = document.createElement("div");
          box.id = "ppeHost";
          box.style.padding = "12px";
          box.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px">
             <audio id="mainAudio" style="width:100%;display:none"></audio>
              <img id="mainImage" alt="" style="width:100%;border-radius:12px;display:none" />
            </div>
          `;
          host.appendChild(box);
        }

        audio = document.getElementById("mainAudio");
        image = document.getElementById("mainImage");
      }

      return { audio, image };
    },

    // Output seçimi: ilk geçerli url + type
    pickOutput(outputs) {
      if (!Array.isArray(outputs)) return null;
      for (const o of outputs) {
        if (!o) continue;
        const url = o.url;
        const type = o.type;
        if (typeof url === "string" && url.startsWith("http") && type) {
          return { type, url, mime: o.mime || "" };
        }
      }
      return null;
    },

    // Görünürlük yönetimi
    showOnly(targets, which) {
      targets.audio.style.display = which === "audio" ? "" : "none";
      targets.image.style.display = which === "image" ? "" : "none";
    },

    // Ana fonksiyon: job COMPLETED ise output’u UI’a bas
    apply(job) {
      if (!job || job.state !== "COMPLETED") return { ok: false, reason: "not_completed" };
      const app = String(
  job.app ||
  job.meta?.app ||
  job.payload?.app ||
  job.request?.app ||
  job.input?.app ||
  ""
).trim().toLowerCase();

const mode = String(
  job.mode ||
  job.meta?.mode ||
  job.payload?.mode ||
  job.request?.mode ||
  job.input?.mode ||
  ""
).trim().toLowerCase();
if (app === "cartoon" && mode === "character") {
  const targets = this.ensureTargets();
  targets.image.removeAttribute("src");
  targets.image.style.display = "none";
  return { ok: false, reason: "skip_cartoon_character_output" };
}

      const out = this.pickOutput(job.outputs);
      if (!out) return { ok: false, reason: "no_output" };

      // ❌ video target yok artık
      const targets = this.ensureTargets();

      if (out.type === "audio") {
        this.showOnly(targets, "audio");
        targets.audio.src = out.url;
        targets.audio.load?.();
      } else if (out.type === "image") {
        this.showOnly(targets, "image");
        targets.image.src = out.url;
      } else {
        // ❌ video artık PPE tarafından basılmıyor
        return { ok: false, reason: "unsupported_type", type: out.type };
      }

      try {
        this.onOutput && this.onOutput(job, out);
      } catch (_) {}

      return { ok: true, output: out };
    },
  };

  window.PPE = PPE;
})();
