const TIMELINE_VERSION = 1;
const EPSILON = 0.01;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value) {
  return Number(number(value, 0).toFixed(3));
}

function normalizeDuration(value) {
  return Math.max(5, Math.min(20, number(value, 15)));
}

function defaultDurations(duration) {
  if (duration >= 15) return [2, 5, 4, round(duration - 11)];
  if (duration >= 10) return [2, 4, 2, round(duration - 8)];
  return [1, 2, 1, round(duration - 4)];
}

function fallbackSegments(duration, avatarEnabled) {
  const durations = defaultDurations(duration);
  const sources = avatarEnabled
    ? ["seedance", "avatar", "seedance", "seedance"]
    : ["seedance", "seedance", "seedance", "seedance"];
  const roles = ["hook", "desire", "proof", "memory_lock"];
  let cursor = 0;
  return durations.map((segmentDuration, index) => {
    const start = round(cursor);
    cursor = round(cursor + segmentDuration);
    return {
      id: `segment_${index + 1}`,
      order: index + 1,
      role: roles[index],
      source: sources[index],
      start,
      end: cursor,
      duration: round(segmentDuration),
      sourceStart: sources[index] === "avatar" ? 0 : start,
      sourceEnd: sources[index] === "avatar" ? round(segmentDuration) : cursor,
    };
  });
}

function normalizeSegments(shots, duration, avatarEnabled) {
  if (!Array.isArray(shots) || !shots.length) return fallbackSegments(duration, avatarEnabled);
  const ordered = shots
    .map((shot, index) => ({ ...shot, _index:index }))
    .sort((a, b) => number(a.start, a._index) - number(b.start, b._index));
  const result = [];
  let cursor = 0;
  for (let index = 0; index < ordered.length; index += 1) {
    const shot = ordered[index] || {};
    const start = round(number(shot.start, cursor));
    const declaredEnd = number(shot.end, NaN);
    const declaredDuration = number(shot.duration, NaN);
    const end = round(Number.isFinite(declaredEnd)
      ? declaredEnd
      : start + (Number.isFinite(declaredDuration) ? declaredDuration : 0));
    const source = shot.source === "avatar" && avatarEnabled ? "avatar" : "seedance";
    if (Math.abs(start - cursor) > EPSILON || end <= start || end > duration + EPSILON) {
      return fallbackSegments(duration, avatarEnabled);
    }
    const segmentDuration = round(end - start);
    result.push({
      id: String(shot.id || `segment_${index + 1}`),
      order: index + 1,
      role: String(shot.role || `beat_${index + 1}`),
      source,
      start,
      end,
      duration:segmentDuration,
      sourceStart:source === "avatar" ? 0 : start,
      sourceEnd:source === "avatar" ? segmentDuration : end,
    });
    cursor = end;
  }
  if (Math.abs(cursor - duration) > EPSILON || (avatarEnabled && !result.some((item) => item.source === "avatar"))) {
    return fallbackSegments(duration, avatarEnabled);
  }
  return result;
}

function validateAdFilmTimeline(timeline) {
  const duration = normalizeDuration(timeline?.duration);
  const segments = Array.isArray(timeline?.segments) ? timeline.segments : [];
  if (!segments.length) return { ok:false, error:"timeline_empty" };
  let cursor = 0;
  for (const segment of segments) {
    const start = number(segment?.start, -1);
    const end = number(segment?.end, -1);
    if (Math.abs(start - cursor) > EPSILON) return { ok:false, error:"timeline_gap_or_overlap" };
    if (end <= start) return { ok:false, error:"timeline_invalid_segment" };
    cursor = end;
  }
  if (Math.abs(cursor - duration) > EPSILON) return { ok:false, error:"timeline_duration_mismatch" };
  return { ok:true, duration, segments };
}

function buildAdFilmTimeline(input = {}) {
  const duration = normalizeDuration(input.duration);
  const avatarEnabled = input.avatarEnabled === true;
  const segments = normalizeSegments(input.shots, duration, avatarEnabled);
  const avatarSegment = segments.find((segment) => segment.source === "avatar") || null;
  const speechInset = avatarSegment ? Math.min(0.2, avatarSegment.duration * 0.04) : 0;
  const speech = avatarSegment ? {
    start:round(avatarSegment.start + speechInset),
    end:round(avatarSegment.end - speechInset),
    duration:round(Math.max(0.5, avatarSegment.duration - speechInset * 2)),
    clipStart:round(speechInset),
    clipEnd:round(Math.max(speechInset + 0.5, avatarSegment.duration - speechInset)),
  } : null;
  const timeline = {
    version:TIMELINE_VERSION,
    duration,
    avatarEnabled,
    segments,
    avatar:avatarSegment ? {
      start:avatarSegment.start,
      end:avatarSegment.end,
      duration:avatarSegment.duration,
      sourceStart:0,
      sourceEnd:avatarSegment.duration,
    } : null,
    speech,
    seedanceSegments:segments.filter((segment) => segment.source === "seedance"),
    finalCut:segments.map((segment) => ({
      id:segment.id,
      source:segment.source,
      start:segment.start,
      end:segment.end,
      duration:segment.duration,
      sourceStart:segment.sourceStart,
      sourceEnd:segment.sourceEnd,
    })),
  };
  const validation = validateAdFilmTimeline(timeline);
  if (!validation.ok) throw new Error(validation.error);
  return timeline;
}

function timelineFromProject(project = {}) {
  const plan = project.productionPlan || {};
  if (plan.timeline && validateAdFilmTimeline(plan.timeline).ok) return plan.timeline;
  return buildAdFilmTimeline({
    duration:plan.duration || project?.generation?.input?.duration || project?.output?.duration || 15,
    avatarEnabled:project?.avatar?.enabled === true,
    shots:plan.shots,
  });
}

export {
  TIMELINE_VERSION,
  buildAdFilmTimeline,
  timelineFromProject,
  validateAdFilmTimeline,
};
