console.log("[photofx.effects] loaded ✅", new Date().toISOString());

(function () {
  if (window.__AIVO_PHOTOFX_EFFECTS__) return;
  window.__AIVO_PHOTOFX_EFFECTS__ = true;

  const ASSET_BASE = "assets/photofx";
  const OVERLAY_BASE = `${ASSET_BASE}/overlays`;
  const LUT_BASE = `${ASSET_BASE}/luts`;

  const OVERLAY_LIBRARY = {
    "light-leaks": [
      `${OVERLAY_BASE}/light-leaks/`
    ],

    "prism-lens": [
      `${OVERLAY_BASE}/prism-lens/`
    ],

    "film-burns-flash": [
      `${OVERLAY_BASE}/film-burns-flash/`
    ],

    "dust-particles": [
      `${OVERLAY_BASE}/dust-particles/`
    ],

    "vhs-glitch": [
      `${OVERLAY_BASE}/vhs-glitch/`
    ],

    "glitch-noise": [
      `${OVERLAY_BASE}/glitch-noise/`
    ],

    "smoke-fog": [
      `${OVERLAY_BASE}/smoke-fog/`
    ],

    "sparks-fire": [
      `${OVERLAY_BASE}/sparks-fire/`
    ],

    "scribble": [
      `${OVERLAY_BASE}/scribble/`
    ],

    "hud-graphic-overlay": [
      `${OVERLAY_BASE}/hud-graphic-overlay/`
    ]
  };

  const LUT_LIBRARY = {
    neon: [
      `${LUT_BASE}/cinema-style/`
    ],
    contrast: [
      `${LUT_BASE}/cinema-style/`
    ],
    cyber: [
      `${LUT_BASE}/cinema-style/`
    ],
    "clean-pop": [
      `${LUT_BASE}/cinema-style/`
    ],
    cinematic: [
      `${LUT_BASE}/cinema-style/`
    ],
    dreamy: [
      `${LUT_BASE}/cinema-style/`
    ],
    "warm-burn": [
      `${LUT_BASE}/cinema-style/`
    ],
    "dark-trap": [
      `${LUT_BASE}/cinema-style/`
    ]
  };

  const PRESET_EFFECTS = {
    "neon-pulse": {
      key: "neon-pulse",
      title: "Neon Pulse",
      description: "Neon çizgiler, ışık akışı ve hafif parlama ile ritmik enerji verir.",
      usage: "Gece, stil, havalı portre.",
      category: "neon",
      coreEffects: ["glow", "light-flicker", "micro-zoom"],
      overlayGroups: ["light-leaks", "prism-lens"],
      lutGroup: "neon",
      defaults: {
        motionLevel: "balanced",
        effectStrength: "medium",
        colorMood: "neon",
        transitionSpeed: "normal"
      },
      doseProfile: {
        maxOverlayCount: 2,
        overlayOpacity: 0.22,
        secondaryOpacity: 0.12,
        lutIntensity: 0.42,
        zoomAmount: 0.07,
        shakeAmount: 0.04,
        blurAmount: 0.06,
        glowAmount: 0.30,
        introBurstMs: 420,
        sustainLevel: 0.76,
        outroFlashMs: 160,
        overlayStartOffsetMs: 80,
        overlayTrimStrategy: "center-weighted",
        randomization: 0.18,
        blendMode: "screen",
        placement: "subject-around",
        maskBias: "face-safe"
      }
    },

    "shake-edit": {
      key: "shake-edit",
      title: "Shake Edit",
      description: "Beat hissi veren mikro sarsıntı ve hızlı vurgu hareketleri üretir.",
      usage: "Rap, trap, sert edit videolar.",
      category: "impact",
      coreEffects: ["micro-shake", "punch-zoom", "flash-hit"],
      overlayGroups: ["film-burns-flash"],
      lutGroup: "contrast",
      defaults: {
        motionLevel: "strong",
        effectStrength: "high",
        colorMood: "dark",
        transitionSpeed: "fast"
      },
      doseProfile: {
        maxOverlayCount: 1,
        overlayOpacity: 0.20,
        secondaryOpacity: 0.00,
        lutIntensity: 0.26,
        zoomAmount: 0.10,
        shakeAmount: 0.18,
        blurAmount: 0.05,
        glowAmount: 0.08,
        introBurstMs: 240,
        sustainLevel: 0.84,
        outroFlashMs: 220,
        overlayStartOffsetMs: 20,
        overlayTrimStrategy: "front-loaded",
        randomization: 0.14,
        blendMode: "add",
        placement: "full-frame",
        maskBias: "center-safe"
      }
    },

    "glitch-scan": {
      key: "glitch-scan",
      title: "Glitch Scan",
      description: "Dijital bozulma, RGB kayma ve kısa ekran kırılması hissi verir.",
      usage: "Karanlık, teknoloji, agresif hava.",
      category: "glitch",
      coreEffects: ["rgb-shift", "scan-jitter", "glitch-cut"],
      overlayGroups: ["vhs-glitch", "glitch-noise", "hud-graphic-overlay"],
      lutGroup: "cyber",
      defaults: {
        motionLevel: "balanced",
        effectStrength: "high",
        colorMood: "dark",
        transitionSpeed: "fast"
      },
      doseProfile: {
        maxOverlayCount: 2,
        overlayOpacity: 0.26,
        secondaryOpacity: 0.14,
        lutIntensity: 0.36,
        zoomAmount: 0.06,
        shakeAmount: 0.10,
        blurAmount: 0.04,
        glowAmount: 0.12,
        introBurstMs: 300,
        sustainLevel: 0.82,
        outroFlashMs: 140,
        overlayStartOffsetMs: 0,
        overlayTrimStrategy: "staggered",
        randomization: 0.24,
        blendMode: "screen",
        placement: "full-frame",
        maskBias: "center-safe"
      }
    },

    "split-flash": {
      key: "split-flash",
      title: "Split Flash",
      description: "Görseli bölüp kısa flash geçişleriyle güçlü dikkat etkisi kurar.",
      usage: "Dikkat çekici reels girişleri.",
      category: "flash",
      coreEffects: ["split", "flash", "strobe-cut"],
      overlayGroups: ["film-burns-flash", "light-leaks"],
      lutGroup: "clean-pop",
      defaults: {
        motionLevel: "balanced",
        effectStrength: "medium",
        colorMood: "original",
        transitionSpeed: "fast"
      },
      doseProfile: {
        maxOverlayCount: 2,
        overlayOpacity: 0.24,
        secondaryOpacity: 0.10,
        lutIntensity: 0.24,
        zoomAmount: 0.05,
        shakeAmount: 0.08,
        blurAmount: 0.03,
        glowAmount: 0.10,
        introBurstMs: 220,
        sustainLevel: 0.66,
        outroFlashMs: 260,
        overlayStartOffsetMs: 0,
        overlayTrimStrategy: "burst-cuts",
        randomization: 0.16,
        blendMode: "screen",
        placement: "full-frame",
        maskBias: "center-safe"
      }
    },

    "cinematic-zoom": {
      key: "cinematic-zoom",
      title: "Cinematic Zoom",
      description: "Yavaş yakınlaşma, sinematik pan ve hafif derinlik hissi oluşturur.",
      usage: "Duygusal, kaliteli, ağır akan videolar.",
      category: "cinematic",
      coreEffects: ["slow-zoom", "soft-pan", "depth-blur"],
      overlayGroups: ["dust-particles", "light-leaks"],
      lutGroup: "cinematic",
      defaults: {
        motionLevel: "soft",
        effectStrength: "light",
        colorMood: "cinematic",
        transitionSpeed: "slow"
      },
      doseProfile: {
        maxOverlayCount: 2,
        overlayOpacity: 0.12,
        secondaryOpacity: 0.07,
        lutIntensity: 0.48,
        zoomAmount: 0.09,
        shakeAmount: 0.01,
        blurAmount: 0.08,
        glowAmount: 0.06,
        introBurstMs: 120,
        sustainLevel: 0.58,
        outroFlashMs: 90,
        overlayStartOffsetMs: 140,
        overlayTrimStrategy: "long-tail",
        randomization: 0.08,
        blendMode: "soft-light",
        placement: "edges",
        maskBias: "face-safe"
      }
    },

    "aura-glow": {
      key: "aura-glow",
      title: "Aura Glow",
      description: "Kişinin etrafında enerji halkası ve yumuşak aura ışığı oluşturur.",
      usage: "Dreamy, estetik, manevi editler.",
      category: "aura",
      coreEffects: ["glow", "soft-bloom", "halo-pulse"],
      overlayGroups: ["prism-lens", "light-leaks", "dust-particles"],
      lutGroup: "dreamy",
      defaults: {
        motionLevel: "soft",
        effectStrength: "medium",
        colorMood: "neon",
        transitionSpeed: "normal"
      },
      doseProfile: {
        maxOverlayCount: 2,
        overlayOpacity: 0.18,
        secondaryOpacity: 0.10,
        lutIntensity: 0.38,
        zoomAmount: 0.04,
        shakeAmount: 0.02,
        blurAmount: 0.07,
        glowAmount: 0.34,
        introBurstMs: 260,
        sustainLevel: 0.72,
        outroFlashMs: 130,
        overlayStartOffsetMs: 60,
        overlayTrimStrategy: "halo-biased",
        randomization: 0.12,
        blendMode: "screen",
        placement: "subject-around",
        maskBias: "face-safe"
      }
    },

    "fire-edge": {
      key: "fire-edge",
      title: "Fire Edge",
      description: "Kenarlar boyunca ateş ve sıcak ışık akışıyla güçlü etki verir.",
      usage: "Güçlü, öfkeli, epik görünüm.",
      category: "fire",
      coreEffects: ["edge-heat", "hot-glow", "impact-flash"],
      overlayGroups: ["sparks-fire", "smoke-fog", "film-burns-flash"],
      lutGroup: "warm-burn",
      defaults: {
        motionLevel: "strong",
        effectStrength: "high",
        colorMood: "warm",
        transitionSpeed: "fast"
      },
      doseProfile: {
        maxOverlayCount: 2,
        overlayOpacity: 0.24,
        secondaryOpacity: 0.13,
        lutIntensity: 0.34,
        zoomAmount: 0.08,
        shakeAmount: 0.09,
        blurAmount: 0.04,
        glowAmount: 0.20,
        introBurstMs: 280,
        sustainLevel: 0.80,
        outroFlashMs: 170,
        overlayStartOffsetMs: 0,
        overlayTrimStrategy: "edge-heavy",
        randomization: 0.15,
        blendMode: "add",
        placement: "edges",
        maskBias: "center-safe"
      }
    },

    "dark-trap-motion": {
      key: "dark-trap-motion",
      title: "Dark Trap Motion",
      description: "Karanlık kontrast, sert zoom ve düşük ışık edit dili uygular.",
      usage: "Trap müzik, sert profil videoları.",
      category: "dark",
      coreEffects: ["hard-zoom", "micro-shake", "shadow-pulse"],
      overlayGroups: ["smoke-fog", "dust-particles", "glitch-noise"],
      lutGroup: "dark-trap",
      defaults: {
        motionLevel: "strong",
        effectStrength: "high",
        colorMood: "dark",
        transitionSpeed: "fast"
      },
      doseProfile: {
        maxOverlayCount: 2,
        overlayOpacity: 0.19,
        secondaryOpacity: 0.11,
        lutIntensity: 0.40,
        zoomAmount: 0.09,
        shakeAmount: 0.12,
        blurAmount: 0.05,
        glowAmount: 0.05,
        introBurstMs: 260,
        sustainLevel: 0.86,
        outroFlashMs: 120,
        overlayStartOffsetMs: 40,
        overlayTrimStrategy: "low-end-ramp",
        randomization: 0.20,
        blendMode: "overlay",
        placement: "full-frame",
        maskBias: "center-safe"
      }
    }
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

  function getOverlayPaths(groups = []) {
    return (Array.isArray(groups) ? groups : [])
      .flatMap((group) => OVERLAY_LIBRARY[group] || [])
      .filter(Boolean);
  }

  function getLutPaths(group = "") {
    return LUT_LIBRARY[String(group || "").trim()] || [];
  }

  function normalizeRange(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  function resolveRuntime(options = {}, preset = null) {
    return {
      motionLevel: options.motionLevel || preset?.defaults?.motionLevel || "balanced",
      effectStrength: options.effectStrength || preset?.defaults?.effectStrength || "medium",
      colorMood: options.colorMood || preset?.defaults?.colorMood || "original",
      transitionSpeed: options.transitionSpeed || preset?.defaults?.transitionSpeed || "normal"
    };
  }

  function applyRuntimeToDoseProfile(baseDoseProfile = {}, runtime = {}) {
    const profile = { ...baseDoseProfile };

    const strengthMap = {
      light: 0.85,
      medium: 1.0,
      high: 1.18
    };

    const motionMap = {
      soft: 0.9,
      balanced: 1.0,
      strong: 1.12
    };

    const speedMap = {
      slow: 0.9,
      normal: 1.0,
      fast: 1.1
    };

    const strengthFactor = strengthMap[runtime.effectStrength] || 1.0;
    const motionFactor = motionMap[runtime.motionLevel] || 1.0;
    const speedFactor = speedMap[runtime.transitionSpeed] || 1.0;

    profile.overlayOpacity = normalizeRange(
      profile.overlayOpacity * strengthFactor,
      0.05,
      0.40,
      profile.overlayOpacity
    );

    profile.secondaryOpacity = normalizeRange(
      profile.secondaryOpacity * strengthFactor,
      0.00,
      0.25,
      profile.secondaryOpacity
    );

    profile.lutIntensity = normalizeRange(
      profile.lutIntensity * (runtime.colorMood === "original" ? 0.92 : 1.0),
      0.10,
      0.70,
      profile.lutIntensity
    );

    profile.zoomAmount = normalizeRange(
      profile.zoomAmount * motionFactor,
      0.00,
      0.20,
      profile.zoomAmount
    );

    profile.shakeAmount = normalizeRange(
      profile.shakeAmount * motionFactor,
      0.00,
      0.25,
      profile.shakeAmount
    );

    profile.blurAmount = normalizeRange(
      profile.blurAmount * speedFactor,
      0.00,
      0.18,
      profile.blurAmount
    );

    profile.glowAmount = normalizeRange(
      profile.glowAmount * (runtime.colorMood === "dark" ? 0.92 : 1.0),
      0.00,
      0.45,
      profile.glowAmount
    );

    profile.introBurstMs = Math.round(
      normalizeRange(profile.introBurstMs / speedFactor, 80, 1200, profile.introBurstMs)
    );

    profile.outroFlashMs = Math.round(
      normalizeRange(profile.outroFlashMs / speedFactor, 60, 600, profile.outroFlashMs)
    );

    profile.overlayStartOffsetMs = Math.round(
      normalizeRange(profile.overlayStartOffsetMs / speedFactor, 0, 1000, profile.overlayStartOffsetMs)
    );

    profile.sustainLevel = normalizeRange(
      profile.sustainLevel * strengthFactor,
      0.40,
      1.00,
      profile.sustainLevel
    );

    profile.randomization = normalizeRange(
      profile.randomization * speedFactor,
      0.00,
      0.40,
      profile.randomization
    );

    return profile;
  }

  function buildEffectConfig(options = {}) {
    const presetKey = String(options.preset || "").trim();
    const preset = getPreset(presetKey);
    const runtime = resolveRuntime(options, preset);

    if (!preset) {
      return {
        preset: "",
        title: "",
        category: "",
        description: "",
        usage: "",
        coreEffects: [],
        overlayGroups: [],
        overlayPaths: [],
        lutGroup: "",
        lutPaths: [],
        defaults: {},
        doseProfile: {
          maxOverlayCount: 1,
          overlayOpacity: 0.18,
          secondaryOpacity: 0.08,
          lutIntensity: 0.30,
          zoomAmount: 0.05,
          shakeAmount: 0.04,
          blurAmount: 0.04,
          glowAmount: 0.08,
          introBurstMs: 240,
          sustainLevel: 0.70,
          outroFlashMs: 120,
          overlayStartOffsetMs: 40,
          overlayTrimStrategy: "balanced",
          randomization: 0.10,
          blendMode: "screen",
          placement: "full-frame",
          maskBias: "center-safe"
        },
        runtime
      };
    }

    const doseProfile = applyRuntimeToDoseProfile(preset.doseProfile || {}, runtime);

    return {
      preset: preset.key,
      title: preset.title,
      category: preset.category,
      description: preset.description,
      usage: preset.usage,
      coreEffects: [...preset.coreEffects],
      overlayGroups: [...preset.overlayGroups],
      overlayPaths: getOverlayPaths(preset.overlayGroups),
      lutGroup: preset.lutGroup,
      lutPaths: getLutPaths(preset.lutGroup),
      defaults: { ...preset.defaults },
      doseProfile,
      runtime
    };
  }

  function buildEffectsPayload(form = {}) {
    const preset = String(form.style || form.preset || "").trim();
    const effectConfig = buildEffectConfig({
      preset,
      motionLevel: form.motionLevel,
      effectStrength: form.effectStrength,
      colorMood: form.colorMood,
      transitionSpeed: form.transitionSpeed
    });

    return {
      preset,
      styles: Array.isArray(form.styles) ? [...form.styles] : [],
      effectConfig
    };
  }

  window.AIVOPhotoFxEffects = {
    getPreset,
    getAllPresets,
    getPresetKeys,
    getOverlayPaths,
    getLutPaths,
    buildEffectConfig,
    buildEffectsPayload,
    OVERLAY_LIBRARY,
    LUT_LIBRARY,
    PRESET_EFFECTS
  };
})();
