console.log("[photofx.effects] loaded ✅", new Date().toISOString());

(function () {
  if (window.__AIVO_PHOTOFX_EFFECTS__) return;
  window.__AIVO_PHOTOFX_EFFECTS__ = true;

  const PRESET_EFFECTS = {
    "neon-pulse": {
      key: "neon-pulse",
      title: "Neon Pulse",
      description: "Neon çizgiler, ışık akışı ve hafif parlama ile ritmik enerji verir.",
      usage: "Gece, stil, havalı portre.",
      category: "neon",
      coreEffects: ["glow", "light-flicker", "micro-zoom"],
      overlayGroups: ["light-leaks", "optical-flares"],
      lutGroup: "neon",
      defaults: {
        motionLevel: "balanced",
        effectStrength: "medium",
        colorMood: "neon",
        transitionSpeed: "normal"
      }
    },

    "shake-edit": {
      key: "shake-edit",
      title: "Shake Edit",
      description: "Beat hissi veren mikro sarsıntı ve hızlı vurgu hareketleri üretir.",
      usage: "Rap, trap, sert edit videolar.",
      category: "impact",
      coreEffects: ["micro-shake", "punch-zoom", "flash-hit"],
      overlayGroups: [],
      lutGroup: "contrast",
      defaults: {
        motionLevel: "strong",
        effectStrength: "high",
        colorMood: "dark",
        transitionSpeed: "fast"
      }
    },

    "glitch-scan": {
      key: "glitch-scan",
      title: "Glitch Scan",
      description: "Dijital bozulma, RGB kayma ve kısa ekran kırılması hissi verir.",
      usage: "Karanlık, teknoloji, agresif hava.",
      category: "glitch",
      coreEffects: ["rgb-shift", "scan-jitter", "glitch-cut"],
      overlayGroups: ["vhs-glitch", "grain-particles"],
      lutGroup: "cyber",
      defaults: {
        motionLevel: "balanced",
        effectStrength: "high",
        colorMood: "dark",
        transitionSpeed: "fast"
      }
    },

    "split-flash": {
      key: "split-flash",
      title: "Split Flash",
      description: "Görseli bölüp kısa flash geçişleriyle güçlü dikkat etkisi kurar.",
      usage: "Dikkat çekici reels girişleri.",
      category: "flash",
      coreEffects: ["split", "flash", "strobe-cut"],
      overlayGroups: ["film-burns"],
      lutGroup: "clean-pop",
      defaults: {
        motionLevel: "balanced",
        effectStrength: "medium",
        colorMood: "original",
        transitionSpeed: "fast"
      }
    },

    "cinematic-zoom": {
      key: "cinematic-zoom",
      title: "Cinematic Zoom",
      description: "Yavaş yakınlaşma, sinematik pan ve hafif derinlik hissi oluşturur.",
      usage: "Duygusal, kaliteli, ağır akan videolar.",
      category: "cinematic",
      coreEffects: ["slow-zoom", "soft-pan", "depth-blur"],
      overlayGroups: ["grain-particles"],
      lutGroup: "cinematic",
      defaults: {
        motionLevel: "soft",
        effectStrength: "light",
        colorMood: "cinematic",
        transitionSpeed: "slow"
      }
    },

    "aura-glow": {
      key: "aura-glow",
      title: "Aura Glow",
      description: "Kişinin etrafında enerji halkası ve yumuşak aura ışığı oluşturur.",
      usage: "Dreamy, estetik, manevi editler.",
      category: "aura",
      coreEffects: ["glow", "soft-bloom", "halo-pulse"],
      overlayGroups: ["optical-flares", "light-leaks"],
      lutGroup: "dreamy",
      defaults: {
        motionLevel: "soft",
        effectStrength: "medium",
        colorMood: "neon",
        transitionSpeed: "normal"
      }
    },

    "fire-edge": {
      key: "fire-edge",
      title: "Fire Edge",
      description: "Kenarlar boyunca ateş ve sıcak ışık akışıyla güçlü etki verir.",
      usage: "Güçlü, öfkeli, epik görünüm.",
      category: "fire",
      coreEffects: ["edge-heat", "hot-glow", "impact-flash"],
      overlayGroups: ["sparks-fire", "smoke-fog"],
      lutGroup: "warm-burn",
      defaults: {
        motionLevel: "strong",
        effectStrength: "high",
        colorMood: "warm",
        transitionSpeed: "fast"
      }
    },

    "dark-trap-motion": {
      key: "dark-trap-motion",
      title: "Dark Trap Motion",
      description: "Karanlık kontrast, sert zoom ve düşük ışık edit dili uygular.",
      usage: "Trap müzik, sert profil videoları.",
      category: "dark",
      coreEffects: ["hard-zoom", "micro-shake", "shadow-pulse"],
      overlayGroups: ["smoke-fog", "grain-particles"],
      lutGroup: "dark-trap",
      defaults: {
        motionLevel: "strong",
        effectStrength: "high",
        colorMood: "dark",
        transitionSpeed: "fast"
      }
    }
  };

  const OVERLAY_LIBRARY = {
    "light-leaks": [],
    "optical-flares": [],
    "film-burns": [],
    "grain-particles": [],
    "vhs-glitch": [],
    "smoke-fog": [],
    "sparks-fire": [],
    "scribble-lines": [],
    "hud-graphics": []
  };

  const LUT_LIBRARY = {
    neon: [],
    contrast: [],
    cyber: [],
    "clean-pop": [],
    cinematic: [],
    dreamy: [],
    "warm-burn": [],
    "dark-trap": []
  };

  function getPreset(key) {
    return PRESET_EFFECTS[String(key || "").trim()] || null;
  }

  function getAllPresets() {
    return Object.values(PRESET_EFFECTS);
  }

  function getPresetKeys() {
    return Object.keys(PRESET_EFFECTS);
  }

  function buildEffectConfig(options = {}) {
    const presetKey = String(options.preset || "").trim();
    const preset = getPreset(presetKey);

    if (!preset) {
      return {
        preset: "",
        title: "",
        coreEffects: [],
        overlayGroups: [],
        lutGroup: "",
        defaults: {},
        runtime: {
          motionLevel: options.motionLevel || "balanced",
          effectStrength: options.effectStrength || "medium",
          colorMood: options.colorMood || "original",
          transitionSpeed: options.transitionSpeed || "normal"
        }
      };
    }

    return {
      preset: preset.key,
      title: preset.title,
      category: preset.category,
      description: preset.description,
      usage: preset.usage,
      coreEffects: [...preset.coreEffects],
      overlayGroups: [...preset.overlayGroups],
      lutGroup: preset.lutGroup,
      defaults: { ...preset.defaults },
      runtime: {
        motionLevel: options.motionLevel || preset.defaults.motionLevel,
        effectStrength: options.effectStrength || preset.defaults.effectStrength,
        colorMood: options.colorMood || preset.defaults.colorMood,
        transitionSpeed: options.transitionSpeed || preset.defaults.transitionSpeed
      }
    };
  }

  function buildEffectsPayload(form = {}) {
    const preset = String(form.style || form.preset || "").trim();

    return {
      preset,
      styles: Array.isArray(form.styles) ? [...form.styles] : [],
      effectConfig: buildEffectConfig({
        preset,
        motionLevel: form.motionLevel,
        effectStrength: form.effectStrength,
        colorMood: form.colorMood,
        transitionSpeed: form.transitionSpeed
      })
    };
  }

  window.AIVOPhotoFxEffects = {
    getPreset,
    getAllPresets,
    getPresetKeys,
    buildEffectConfig,
    buildEffectsPayload,
    OVERLAY_LIBRARY,
    LUT_LIBRARY,
    PRESET_EFFECTS
  };
})();
