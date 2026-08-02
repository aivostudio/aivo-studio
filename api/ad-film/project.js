// api/ad-film/project.js
import {
  createEmptyProject,
  deleteProject,
  getOwnedProject,
  mergeProject,
  newProjectId,
  resolveAdFilmUser,
  sanitizeProjectPatch,
  saveProject,
  sendJson,
} from "../_lib/ad-film-projects.js";

const NARRATION_LANGUAGES = new Set([
  "tr", "en", "de", "fr", "es", "it", "pt", "ar", "ru", "nl",
  "pl", "uk", "hi", "