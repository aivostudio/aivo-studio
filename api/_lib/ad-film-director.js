const DIRECTOR_VERSION = 4;

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
  if (avatarEnabled && [5, 10, 15].includes(duration)) return duration;
  if (!avatarEnabled && [5, 10, 15, 20].includes(duration)) return duration;
  return avatarEnabled ? 10 : 15;
}

function keywordMatch(source, words) {
  return words.some((word) => source.includes(word));
}

function makeProfile(input) {
  return {
    category: input.category,
    label: input.label,
    scaleClass: input.scaleClass,
    scaleInstruction: input.scaleInstruction,
    desireTrigger: input.desireTrigger,
    signatureMotif: input.signatureMotif,
    allowedInteractions: input.allowedInteractions || "show, rotate, place, approach and use only in a physically plausible way",
    forbiddenTransformations: input.forbiddenTransformations || "Never transform the product into another category, split it into unrelated objects, reveal a different product inside it or invent hidden contents.",
    integrityInstruction: input.integrityInstruction || "Preserve the exact hero-reference silhouette, parts, material, colors, proportions and construction throughout every frame.",
  };
}

function inferProductProfile(input = {}) {
  const source = [input.productName, input.brandName, input.description]
    .map((value) => clean(value, 500).toLocaleLowerCase("tr-TR"))
    .join(" ");

  if (keywordMatch(source, ["kulaklık", "earbud", "earphone", "airpods", "şarj kutusu"])) {
    return makeProfile({
      category: "earbuds",
      label: "wireless earbuds with their charging case",
      scaleClass: "small_handheld",
      scaleInstruction: "Keep the charging case palm-sized and each earbud fingertip-sized. The complete product must fit naturally in one adult hand.",
      desireTrigger: "precision, freedom and premium everyday sound",
      signatureMotif: "a controlled pulse of light travelling around the charging case",
      allowedInteractions: "The presenter may open or close the charging-case lid, remove or reseat one earbud, hold the case in one hand or place an earbud naturally in the ear.",
      forbiddenTransformations: "Never create over-ear headphones, a perfume bottle, jewelry, another electronic device or any object not present in the product references. The charging case may contain only the matching earbuds.",
      integrityInstruction: "Preserve the exact charging-case lid, body, hinge, earbud stem or shell shape, colors and material from the references.",
    });
  }
  if (keywordMatch(source, ["telefon", "smartphone", "iphone", "android phone", "cep telefonu"])) {
    return makeProfile({
      category: "smartphone",
      label: "smartphone",
      scaleClass: "handheld",
      scaleInstruction: "Keep the phone at normal adult-hand scale, approximately palm-to-hand length. Never make it tablet-sized, furniture-sized or larger than the presenter's hand.",
      desireTrigger: "speed, elegance and tactile confidence",
      signatureMotif: "a clean edge-light sweep revealing the screen and camera detail",
      allowedInteractions: "The presenter may hold, rotate, unlock, tap, swipe or place the phone on a realistic surface.",
      forbiddenTransformations: "Never unfold, split or open the phone unless the exact reference is a foldable device. Never reveal unrelated objects inside the phone.",
    });
  }
  if (keywordMatch(source, ["parfüm", "parfum", "perfume", "kolonya", "fragrance"])) {
    return makeProfile({
      category: "fragrance",
      label: "glass fragrance bottle containing liquid perfume",
      scaleClass: "small_handheld",
      scaleInstruction: "Keep the bottle naturally palm-sized, suitable for a vanity or one-handed presentation. Never enlarge it beyond the presenter's hand.",
      desireTrigger: "identity, intimacy, luxury and mystery",
      signatureMotif: "a memorable ribbon of light or fine fragrance mist wrapping once around the bottle",
      allowedInteractions: "The presenter may hold or rotate the bottle, remove and reseat only the external cap, press the atomizer, spray a fine mist or place the bottle on a pedestal or vanity.",
      forbiddenTransformations: "Never open, split, unfold or disassemble the glass bottle body. Never reveal earbuds, electronics, jewelry, flowers, another bottle or any solid object inside it. The bottle contains only fragrance liquid; the only detachable part is the external cap when visible in the reference.",
      integrityInstruction: "Preserve the exact bottle silhouette, glass thickness, cap, atomizer, label position, liquid color and decorative details from the hero reference.",
    });
  }
  if (keywordMatch(source, ["ayakkabı", "sneaker", "shoe", "bot", "terlik"])) {
    return makeProfile({
      category: "footwear",
      label: "wearable footwear",
      scaleClass: "body_worn",
      scaleInstruction: "Keep the product at realistic adult foot scale. It must look wearable, never miniature and never larger than a human lower leg.",
      desireTrigger: "motion, comfort, identity and confidence",
      signatureMotif: "a precise floor-level light trail following the sole",
      allowedInteractions: "The product may be worn, laced, stepped into, lifted by hand, placed on the floor or shown in motion.",
      forbiddenTransformations: "Never open the footwear to reveal unrelated objects or transform it into clothing, electronics, furniture or another product category.",
    });
  }
  if (keywordMatch(source, ["saat", "watch", "bileklik", "bracelet", "yüzük", "ring", "mücevher", "jewelry"])) {
    return makeProfile({
      category: "wearable_luxury",
      label: "wearable luxury product",
      scaleClass: "body_worn_small",
      scaleInstruction: "Keep the product at realistic wrist, finger or jewelry scale. It must fit the human body naturally and must never become a large prop.",
      desireTrigger: "status, craftsmanship and personal identity",
      signatureMotif: "one controlled specular highlight travelling across the signature detail",
      allowedInteractions: "The presenter may wear, fasten, adjust, rotate or carefully present the item close to the camera.",
      forbiddenTransformations: "Never unfold the item into another object or reveal electronics, cosmetics or unrelated products inside it unless visibly part of the exact reference.",
    });
  }
  if (keywordMatch(source, ["kahve makinesi", "coffee machine", "blender", "mikser", "toaster", "kettle", "su ısıtıcı", "airfryer", "air fryer"])) {
    return makeProfile({
      category: "countertop_appliance",
      label: "countertop appliance",
      scaleClass: "countertop",
      scaleInstruction: "Keep the appliance at realistic countertop scale, roughly forearm-to-torso sized depending on the product. It must sit naturally on a counter and never become room-sized.",
      desireTrigger: "effortless ritual, convenience and sensory reward",
      signatureMotif: "a clean activation light followed by a satisfying product action",
      allowedInteractions: "The presenter may press controls, open only real doors or lids, insert normal ingredients or containers and perform the appliance's documented function.",
      forbiddenTransformations: "Never reveal unrelated products inside the appliance, change its appliance category or invent doors, chambers or accessories absent from the references.",
    });
  }
  if (keywordMatch(source, ["buzdolabı", "refrigerator", "çamaşır makinesi", "washing machine", "bulaşık makinesi", "dishwasher", "fırın", "oven"])) {
    return makeProfile({
      category: "large_appliance",
      label: "large home appliance",
      scaleClass: "floor_standing",
      scaleInstruction: "Keep the appliance at realistic floor-standing household scale relative to an adult and the room. It must be human-height or cabinet-scale as appropriate, never handheld and never monumental.",
      desireTrigger: "order, reliability and a better daily routine",
      signatureMotif: "a calm interior light reveal followed by one clear functional transformation",
      allowedInteractions: "The presenter may open real doors or drawers, use real controls and place normal household items in the correct compartment.",
      forbiddenTransformations: "Never shrink the appliance to handheld scale, transform it into furniture or reveal an unrelated product category inside it.",
    });
  }
  if (keywordMatch(source, ["koltuk", "sofa", "sandalye", "chair", "masa", "table", "yatak", "bed", "mobilya", "furniture"])) {
    return makeProfile({
      category: "furniture",
      label: "human-scale furniture",
      scaleClass: "human_environment",
      scaleInstruction: "Keep the furniture at realistic human-use scale. A person must be able to sit, stand beside or use it naturally; never shrink it to a tabletop object and never enlarge it beyond the room.",
      desireTrigger: "comfort, belonging and aspirational living",
      signatureMotif: "a soft lighting transition that makes the material and silhouette instantly recognizable",
      allowedInteractions: "The presenter may sit, lean, touch the material, move around the item or use its genuine adjustable feature.",
      forbiddenTransformations: "Never open the furniture to reveal electronics, cosmetics or unrelated products unless the exact reference clearly contains a real storage compartment.",
    });
  }
  if (keywordMatch(source, ["otomobil", "araba", "vehicle", "car ", "suv", "motosiklet", "motorcycle", "bisiklet", "bicycle"])) {
    return makeProfile({
      category: "vehicle",
      label: "full-size vehicle",
      scaleClass: "full_size_vehicle",
      scaleInstruction: "Keep the vehicle full-size and physically drivable relative to adults, road lanes, doors and architecture. Never make it toy-sized, room-sized or larger than realistic infrastructure.",
      desireTrigger: "power, control, freedom and status",
      signatureMotif: "a single moving reflection line travelling across the bodywork before the hero reveal",
      allowedInteractions: "The presenter may approach, enter, exit, touch, drive or stand beside the vehicle using real doors and controls.",
      forbiddenTransformations: "Never transform the vehicle into another vehicle type, toy, robot, room or unrelated product. Do not invent body panels or doors absent from the references.",
    });
  }
  if (keywordMatch(source, ["laptop", "notebook", "tablet", "ipad", "bilgisayar", "computer"])) {
    return makeProfile({
      category: "personal_computing",
      label: "personal computing device",
      scaleClass: "desk_portable",
      scaleInstruction: "Keep the device at realistic desk and lap scale. It must be portable by one adult and proportionate to hands, keyboard, desk and chair.",
      desireTrigger: "capability, speed and creative control",
      signatureMotif: "a controlled screen-light transition that reveals the industrial design",
      allowedInteractions: "The presenter may open a real laptop hinge, type, tap, swipe, rotate or place the device on a desk.",
      forbiddenTransformations: "Never reveal unrelated objects inside the device or transform it into a phone, appliance, furniture or another computer form absent from the reference.",
    });
  }
  if (keywordMatch(source, ["şişe", "bottle", "içecek", "drink", "kahve", "coffee", "çikolata", "chocolate", "yemek", "food", "atıştırmalık", "snack"])) {
    return makeProfile({
      category: "food_beverage",
      label: "food or beverage product",
      scaleClass: "serving_size",
      scaleInstruction: "Keep the product at realistic retail package or serving scale relative to a human hand, plate, glass or table. Never make it oversized decoration.",
      desireTrigger: "craving, freshness and immediate sensory satisfaction",
      signatureMotif: "one appetizing texture, pour, break, steam or condensation moment used as the memory hook",
      allowedInteractions: "The product may be poured, served, opened through its real packaging, broken, tasted or placed on a normal plate, glass or table.",
      forbiddenTransformations: "Never reveal electronics, cosmetics, jewelry or unrelated products inside the food or package. Preserve the actual edible or drinkable contents.",
    });
  }

  return makeProfile({
    category: "general_product",
    label: "featured physical product",
    scaleClass: "semantic_real_world",
    scaleInstruction: "First identify the object category from the hero reference and its intended use. Infer its normal real-world dimensions, then keep its ratio to adult hands, bodies, furniture, architecture and the floor physically believable. Never make it monumental, toy-sized or decorative unless that is the product's true scale.",
    desireTrigger: "clarity, desirability, confidence and memorable form",
    signatureMotif: "one repeatable light, motion or material detail taken from the product's most distinctive feature",
  });
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
    `Pattern-interrupt macro hook with continuous motion: reveal the exact ${productName} through its distinctive silhouette and material. Use a deliberate macro dolly, moving highlights and ${profile.signatureMotif}. Never hold a frozen frame.`,
    avatarEnabled
      ? `Native presenter desire beat: the presenter and exact product exist in one physical set. Use a motivated camera move, confident eye line and only these plausible interactions: ${profile.allowedInteractions}`
      : `Desire and use beat with continuous subject and camera motion: show the exact product solving a real need or creating an aspirational feeling. Use only these plausible interactions: ${profile.allowedInteractions}`,
    `Proof montage: create two or three clearly different moving detail shots showing the exact design, material, interface or functional proof. Use focus pulls, light sweeps or tactile micro-actions; no static photograph and no identity change.`,
    `Memory-lock hero ending: build a short premium reveal, then settle decisively on the exact product with ${profile.signatureMotif}. Keep subtle living motion in reflections, mist, particles or light until the final frame and leave a clean lower corner for the original logo overlay.`,
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
      transition: ["cut", "clean_cut", "smooth_push", "dissolve"][index],
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
  const timing = shots.map((shot) => `${shot.start}-${shot.end}s ${shot.role}: ${shot.prompt}`).join(" ");

  const seedanceDirection = clean([
    `Act as the advertising director for a ${duration}-second premium, conversion-focused commercial for ${productName}.`,
    "Every second must contain visible camera, subject, material, light, atmosphere or focus motion. Never output a still photograph, frozen first frame, slideshow or unmoving hold longer than 0.4 seconds.",
    `Follow this exact time-coded shot plan: ${timing}`,
    avatarEnabled
      ? "Create a complete product-only visual master with no presenter. The final editor will replace the desire beat with a separately generated native presenter performance."
      : "Keep the product as the visual hero throughout the complete commercial.",
    `PRODUCT IDENTITY LOCK: ${profile.integrityInstruction} ${profile.forbiddenTransformations}`,
    `REAL-WORLD SCALE LOCK: ${profile.scaleInstruction}`,
    `Build desire around ${profile.desireTrigger}. Use ${profile.signatureMotif} as the recurring mnemonic.`,
    "Render the physical product itself inside the scene. Never show the uploaded product picture as a flat rectangle, screen, billboard, poster, picture-in-picture panel or video wall.",
    "Use purposeful camera motion, motivated premium lighting, tactile close-ups, focus pulls, controlled bloom, specular glints and a decisive final camera settle. Effects must enhance the real product and must not hide, melt or replace it.",
    userDirection ? `User direction: ${userDirection}` : "",
  ].filter(Boolean).join(" "), 1500);

  const avatarDirection = clean([
    `Direct one native, photorealistic presenter performance for the ${duration}-second commercial for ${productName}.`,
    "The presenter and product must exist as real physical subjects in one coherent three-dimensional set, never as separate layers.",
    `Identify @Element2 as ${profile.label}. ${profile.scaleInstruction}`,
    `PRODUCT IDENTITY LOCK: ${profile.integrityInstruction} ${profile.forbiddenTransformations}`,
    `Only these product interactions are allowed: ${profile.allowedInteractions}`,
    `The emotional sales trigger is ${profile.desireTrigger}. The presenter's look, gesture and timing must make the product feel desirable without exaggerated acting.`,
    "Use continuous natural body and camera motion. Do not freeze the presenter or product. Begin with a controlled visual setup, move into a confident interaction and finish with a composed product-facing hero pose.",
    `Use ${profile.signatureMotif} subtly as the memory cue, but never replace or distort the real product.`,
    "Never place the product reference image on a screen, display panel, poster, billboard, floating rectangle or video wall. Render the actual physical product in the set.",
    userDirection ? `User direction: ${userDirection}` : "",
  ].filter(Boolean).join(" "), 1500);

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
      noCategoryTransformation: true,
      continuousMotion: true,
    },
    seedanceDirection,
    avatarDirection,
    scenes: shots.map((shot) => shot.prompt),
    shots,
  };
}

function composeSeedancePrompt(basePrompt, plan, maxChars = 2480) {
  const suffix = "Create the visual commercial only. Keep the video completely silent. Do not generate speech, dialogue, narration, music, ambience or sound effects. AIVO will add the approved narration, selected music and original logo during protected final post-production.";
  const director = clean(plan?.seedanceDirection, 1700);
  const base = clean(basePrompt, 12000);
  const labels = "AIVO DIRECTOR:  REFERENCE CONTRACT:  ";
  const bodyBudget = Math.max(220, maxChars - director.length - suffix.length - labels.length - 3);
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
  const profile = plan?.productProfile || {};
  const prefix = `Create one photorealistic premium commercial performance lasting ${plan?.duration || 10} seconds. @Element1 is the exact ${countryLabel} adult presenter and @Element2 is the exact ${productName}. Preserve both identities, face, clothing, product silhouette, proportions, materials, colors and distinctive design details. The presenter is ${expression}.`;
  const integration = "The presenter, product, floor and set exist inside one coherent three-dimensional world. Match real-world scale, perspective, floor contact, cast shadows, reflections, color temperature, depth of field, occlusion and camera parallax. Camera and subject movement must share the same world coordinates. Keep feet grounded and body weight physically believable.";
  const identity = clean([profile.integrityInstruction, profile.forbiddenTransformations, profile.allowedInteractions ? `Allowed interactions only: ${profile.allowedInteractions}` : ""].filter(Boolean).join(" "), 950);
  const safety = "Use controlled professional gestures, natural continuous body motion and clear face visibility for later lip sync. Never freeze the face during speech. Never create an oversized duplicate, alternate product, extra person, text, subtitle, generated logo or watermark. No generated speech or audio.";
  const director = clean(plan?.avatarDirection, 1500);
  const fixedLength = prefix.length + integration.length + identity.length + safety.length + director.length + 110;
  const userBudget = Math.max(0, maxChars - fixedLength);
  const clippedUserDirection = trimAtBoundary(userDirection, userBudget);
  return [
    prefix,
    director ? `AIVO director plan: ${director}` : "",
    identity ? `Product contract: ${identity}` : "",
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
