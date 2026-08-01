const DIRECTOR_VERSION = 2;

function clean(value, max = 1200) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function trimAtBoundary(value, max) {
  const source = clean(value, Math.max(max, 1));
  if (source.length <= max) return source;
  let clipped = source.slice(0, max).trim();
  const boundary = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? "),
    clipped.lastIndexOf("; "),
    clipped.lastIndexOf(", "),
  );
  if (boundary >= Math.floor(max * 0.68)) clipped = clipped.slice(0, boundary + 1).trim();
  return clipped;
}

function normalizeDuration(value, avatarEnabled) {
  const duration = Number.parseInt(value, 10);
  if (avatarEnabled) return duration === 15 ? 15 : 10;
  if ([5, 10, 15, 20].includes(duration)) return duration;
  return 15;
}

function keywordMatch(source, words) {
  return words.some((word) => source.includes(word));
}

function inferProductProfile(input = {}) {
  const source = [input.productName, input.brandName, input.description]
    .map((value) => clean(value, 500).toLocaleLowerCase("tr-TR"))
    .join(" ");

  if (keywordMatch(source, ["kulaklık", "earbud", "earphone", "airpods", "şarj kutusu"])) {
    return {
      category: "earbuds",
      label: "wireless earbuds",
      scaleClass: "small_handheld",
      scaleInstruction: "Keep the charging case palm-sized and each earbud fingertip-sized. The complete product must fit naturally in one adult hand.",
      desireTrigger: "precision, freedom and premium everyday sound",
      signatureMotif: "a controlled pulse of light travelling around the charging case",
    };
  }
  if (keywordMatch(source, ["telefon", "smartphone", "iphone", "android phone", "cep telefonu"])) {
    return {
      category: "smartphone",
      label: "smartphone",
      scaleClass: "handheld",
      scaleInstruction: "Keep the phone at normal adult-hand scale, approximately palm-to-hand length. Never make it tablet-sized, furniture-sized or larger than the presenter's hand.",
      desireTrigger: "speed, elegance and tactile confidence",
      signatureMotif: "a clean edge-light sweep revealing the screen and camera detail",
    };
  }
  if (keywordMatch(source, ["parfüm", "parfum", "perfume", "kolonya", "fragrance"])) {
    return {
      category: "fragrance",
      label: "fragrance bottle",
      scaleClass: "small_handheld",
      scaleInstruction: "Keep the bottle naturally palm-sized, suitable for a vanity or one-handed presentation. Never enlarge it beyond the presenter's hand.",
      desireTrigger: "identity, intimacy, luxury and mystery",
      signatureMotif: "a memorable ribbon of light or vapor wrapping once around the bottle",
    };
  }
  if (keywordMatch(source, ["ayakkabı", "sneaker", "shoe", "bot", "terlik"])) {
    return {
      category: "footwear",
      label: "footwear",
      scaleClass: "body_worn",
      scaleInstruction: "Keep the product at realistic adult foot scale. It must look wearable, never miniature and never larger than a human lower leg.",
      desireTrigger: "motion, comfort, identity and confidence",
      signatureMotif: "a precise floor-level light trail following the sole",
    };
  }
  if (keywordMatch(source, ["saat", "watch", "bileklik", "bracelet", "yüzük", "ring", "mücevher", "jewelry"])) {
    return {
      category: "wearable_luxury",
      label: "wearable luxury product",
      scaleClass: "body_worn_small",
      scaleInstruction: "Keep the product at realistic wrist, finger or jewelry scale. It must fit the human body naturally and must never become a large prop.",
      desireTrigger: "status, craftsmanship and personal identity",
      signatureMotif: "one controlled specular highlight travelling across the signature detail",
    };
  }
  if (keywordMatch(source, ["kahve makinesi", "coffee machine", "blender", "mikser", "toaster", "kettle", "su ısıtıcı", "airfryer", "air fryer"])) {
    return {
      category: "countertop_appliance",
      label: "countertop appliance",
      scaleClass: "countertop",
      scaleInstruction: "Keep the appliance at realistic countertop scale, roughly forearm-to-torso sized depending on the product. It must sit naturally on a counter and never become room-sized.",
      desireTrigger: "effortless ritual, convenience and sensory reward",
      signatureMotif: "a clean activation light followed by a satisfying product action",
    };
  }
  if (keywordMatch(source, ["buzdolabı", "refrigerator", "çamaşır makinesi", "washing machine", "bulaşık makinesi", "dishwasher", "fırın", "oven"])) {
    return {
      category: "large_appliance",
      label: "large home appliance",
      scaleClass: "floor_standing",
      scaleInstruction: "Keep the appliance at realistic floor-standing household scale relative to an adult and the room. It must be human-height or cabinet-scale as appropriate, never handheld and never monumental.",
      desireTrigger: "order, reliability and a better daily routine",
      signatureMotif: "a calm interior light reveal followed by one clear functional transformation",
    };
  }
  if (keywordMatch(source, ["koltuk", "sofa", "sandalye", "chair", "masa", "table", "yatak", "bed", "mobilya", "furniture"])) {
    return {
      category: "furniture",
      label: "furniture",
      scaleClass: "human_environment",
      scaleInstruction: "Keep the furniture at realistic human-use scale. A person must be able to sit, stand beside or use it naturally; never shrink it to a tabletop object and never enlarge it beyond the room.",
      desireTrigger: "comfort, belonging and aspirational living",
      signatureMotif: "a soft lighting transition that makes the material and silhouette instantly recognizable",
    };
  }
  if (keywordMatch(source, ["otomobil", "araba", "vehicle", "car ", "suv", "motosiklet", "motorcycle", "bisiklet", "bicycle"])) {
    return {
      category: "vehicle",
      label: "vehicle",
      scaleClass: "full_size_vehicle",
      scaleInstruction: "Keep the vehicle full-size and physically drivable relative to adults, road lanes, doors and architecture. Never make it toy-sized, room-sized or larger than realistic infrastructure.",
      desireTrigger: "power, control, freedom and status",
      signatureMotif: "a single moving reflection line travelling across the bodywork before the hero reveal",
    };
  }
  if (keywordMatch(source, ["laptop", "notebook", "tablet", "ipad", "bilgisayar", "computer"])) {
    return {
      category: "personal_computing",
      label: "personal computing device",
      scaleClass: "desk_portable",
      scaleInstruction: "Keep the device at realistic desk and lap scale. It must be portable by one adult and proportionate to hands, keyboard, desk and chair.",
      desireTrigger: "capability, speed and creative control",
      signatureMotif: "a controlled screen-light transition that reveals the industrial design",
    };
  }
  if (keywordMatch(source, ["şişe", "bottle", "içecek", "drink", "kahve", "coffee", "çikolata", "chocolate", "yemek", "food", "atıştırmalık", "snack"])) {
    return {
      category: "food_beverage",
      label: "food or beverage product",
      scaleClass: "serving_size",
      scaleInstruction: "Keep the product at realistic retail package or serving scale relative to a human hand, plate, glass or table. Never make it oversized decoration.",
      desireTrigger: "craving, freshness and immediate sensory satisfaction",
      signatureMotif: "one appetizing texture, pour, break, steam or condensation moment used as the memory hook",
    };
  }

  return {
    category: "general_product",
    label: "featured product",
    scaleClass: "semantic_real_world",
    scaleInstruction: "First identify the object category from the hero reference and its intended use. Infer its normal real-world dimensions, then keep its ratio to adult hands, bodies, furniture, architecture and the floor physically believable. Never make it monumental, toy-sized or decorative unless that is the product's true scale.",
    desireTrigger: "clarity, desirability, confidence and memorable form",
    signatureMotif: "one repeatable light, motion or material detail taken from the product's most distinctive feature",
  };
}

function shotDurations(duration) {
  if (duration >= 15) return [2, 5, 4, 4];
  if (duration >= 10) return [2, 4, 2, 2];
  return [1, 2, 1, 1];
}

function timelineShots({ duration, avatarEnabled, productName, profile, manualScenes }) {
  const durations = shotDurations(duration);
  const sources = avatarEnabled
    ? ["seedance", "avatar", "seedance", "seedance"]
    : ["seedance", "seedance", "seedance", "seedance"];
  const supplied = Array.isArray(manualScenes)
    ? manualScenes.map((item) => clean(item, 220)).filter(Boolean)
    : [];
  const defaults = [
    `Pattern-interrupt macro hook: reveal the exact ${productName} through its most distinctive silhouette, material and ${profile.signatureMotif}. No presenter. Make the first frame impossible to ignore.`,
    avatarEnabled
      ? `Native presenter interaction: the presenter and the exact product exist in one physical set. The presenter approaches, indicates or naturally handles the real product while preserving realistic scale, floor contact, shadows, perspective and eye line.`
      : `Desire and use moment: show the exact product solving a real need or creating an aspirational feeling. Make the benefit visually understandable without unsupported text claims.`,
    `Proof and tactile detail montage: use two or three controlled micro-cuts showing the exact design, material, interface or functional detail that makes the product desirable. Preserve identity and scale in every cut.`,
    `Memory-lock hero ending: finish on a clean premium hero frame with the exact product, a decisive camera settle and ${profile.signatureMotif}. Leave a clean lower corner for the original logo overlay.`,
  ];

  let cursor = 0;
  return durations.map((shotDuration, index) => {
    const start = cursor;
    cursor += shotDuration;
    return {
      id: `shot_${index + 1}`,
      order: index + 1,
      start,
      end: cursor,
      duration: shotDuration,
      source: sources[index],
      role: ["hook", "desire", "proof", "memory_lock"][index],
      prompt: supplied[index] || defaults[index],
    };
  });
}

function buildDirectorPlan(project = {}, options = {}) {
  const brief = project.brief || {};
  const avatarEnabled = options.avatarEnabled ?? project?.avatar?.enabled === true;
  const duration = normalizeDuration(
    options.duration || project?.output?.duration || project?.generation?.input?.duration,
    avatarEnabled,
  );
  const productName = clean(options.productName || brief.productName, 120) || "featured product";
  const brandName = clean(options.brandName || brief.brandName, 100);
  const description = clean(options.description || brief.description, 500);
  const profile = inferProductProfile({ productName, brandName, description });
  const manualScenes = Array.isArray(options.scenes) ? options.scenes : [];
  const userDirection = clean(options.creativeDirection, 700);
  const shots = timelineShots({ duration, avatarEnabled, productName, profile, manualScenes });
  const timing = shots.map((shot) => `${shot.start}-${shot.end}s ${shot.role}`).join("; ");

  const seedanceDirection = clean([
    `Act as the advertising director for a ${duration}-second premium, conversion-focused commercial for ${productName}.`,
    `The goal is immediate desire and strong visual memory, not a slideshow, generic product rotation or reference-image display.`,
    `Use this four-beat rhythm: ${timing}.`,
    avatarEnabled
      ? "Create a complete product-only visual master with no presenter. The final editor will replace the desire beat with a separately generated native presenter performance."
      : "Keep the product as the visual hero throughout the complete commercial.",
    `Preserve exact product identity and realistic physical scale. ${profile.scaleInstruction}`,
    `Build desire around ${profile.desireTrigger}. Use ${profile.signatureMotif} as the recurring mnemonic.`,
    "Render the physical product itself inside the scene. Never show the uploaded product picture as a flat rectangle, screen, billboard, poster, picture-in-picture panel or video wall.",
    "Use purposeful camera motion, motivated premium lighting, tactile close-ups, clean continuity and a decisive final camera settle.",
    userDirection ? `User direction: ${userDirection}` : "",
  ].filter(Boolean).join(" "), 1050);

  const avatarDirection = clean([
    `Direct one native, photorealistic presenter performance for the ${duration}-second commercial for ${productName}.`,
    "The presenter and product must exist as real physical subjects in one coherent three-dimensional set, never as separate layers.",
    `Identify @Element2 as ${profile.label}. ${profile.scaleInstruction}`,
    `The emotional sales trigger is ${profile.desireTrigger}. The presenter's look, gesture and timing must make the product feel desirable without exaggerated acting.`,
    "Begin with a short controlled visual setup, move into a confident product interaction, show one clear tactile proof moment, then finish with a composed product-facing hero pose.",
    `Use ${profile.signatureMotif} subtly as the memory cue, but never replace or distort the real product.`,
    "Never place the product reference image on a screen, display panel, poster, billboard, floating rectangle or video wall. Render the actual physical product in the set.",
    userDirection ? `User direction: ${userDirection}` : "",
  ].filter(Boolean).join(" "), 1150);

  return {
    version: DIRECTOR_VERSION,
    status: "ready",
    preparedAt: new Date().toISOString(),
    duration,
    aspectRatio: clean(
      options.aspectRatio || project?.output?.aspectRatio || project?.generation?.input?.aspectRatio,
      20,
    ) || "16:9",
    quality: clean(
      options.quality || project?.output?.quality || project?.generation?.input?.resolution,
      20,
    ).toLowerCase() || "1080p",
    objective: "Create desire in the first seconds, prove value visually, and finish with a repeatable brand memory.",
    product: { name: productName, brandName: brandName || null, description: description || null },
    productProfile: profile,
    continuity: {
      identity: "exact_product_locked",
      scale: "real_world_locked",
      lighting: "single_visual_world",
      noScreenPresentation: true,
      noGeneratedLogo: true,
    },
    seedanceDirection,
    avatarDirection,
    scenes: shots.map((shot) => shot.prompt),
    shots,
  };
}

function composeSeedancePrompt(basePrompt, plan, maxChars = 2480) {
  const suffix = "Create the visual commercial only. Keep the video completely silent. Do not generate speech, dialogue, narration, music, ambience or sound effects. AIVO will add the approved narration, selected music and original logo during protected final post-production.";
  const director = clean(plan?.seedanceDirection, 1200);
  const base = clean(basePrompt, 12000);
  const labels = "AIVO DIRECTOR:  REFERENCE CONTRACT:  ";
  const bodyBudget = Math.max(240, maxChars - director.length - suffix.length - labels.length - 3);
  const referenceContract = trimAtBoundary(base, bodyBudget);
  return [
    director ? `AIVO DIRECTOR: ${director}` : "",
    referenceContract ? `REFERENCE CONTRACT: ${referenceContract}` : "",
    suffix,
  ].filter(Boolean).join(" ").slice(0, maxChars);
}

function composeAvatarPrompt({ project = {}, plan, countryLabel = "international", expression = "confident and trustworthy", maxChars = 2480 }) {
  const avatar = project.avatar || {};
  const productName = clean(plan?.product?.name || project?.brief?.productName, 120) || "featured product";
  const userDirection = clean(avatar.directorNote, 1000);
  const prefix = `Create one photorealistic premium commercial performance lasting ${plan?.duration || 10} seconds. @Element1 is the exact ${countryLabel} adult presenter and @Element2 is the exact ${productName}. Preserve both identities, face, clothing, product silhouette, proportions, materials, colors and distinctive design details. The presenter is ${expression}.`;
  const integration = "The presenter, product, floor and set exist inside one coherent three-dimensional world. Match real-world scale, perspective, floor contact, cast shadows, reflections, color temperature, depth of field, occlusion and camera parallax. Camera and subject movement must share the same world coordinates. Keep feet grounded and body weight physically believable.";
  const safety = "Use controlled professional gestures, natural body motion and clear face visibility for later lip sync. Allow touching or holding only when physically plausible for the identified product category. Never create an oversized duplicate, alternate product, extra person, text, subtitle, generated logo or watermark. No generated speech or audio.";
  const director = clean(plan?.avatarDirection, 1200);
  const fixedLength = prefix.length + integration.length + safety.length + director.length + 80;
  const userBudget = Math.max(0, maxChars - fixedLength);
  const clippedUserDirection = trimAtBoundary(userDirection, userBudget);
  return [
    prefix,
    director ? `AIVO director plan: ${director}` : "",
    integration,
    clippedUserDirection ? `User presenter direction: ${clippedUserDirection}.` : "",
    safety,
  ].filter(Boolean).join(" ").slice(0, maxChars);
}

export {
  DIRECTOR_VERSION,
  buildDirectorPlan,
  composeAvatarPrompt,
  composeSeedancePrompt,
  inferProductProfile,
  normalizeDuration,
};
