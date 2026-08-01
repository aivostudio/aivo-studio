// api/ad-film/avatar/pipeline/create-native-fixed.js
// Compatibility route. All duration, director and lipsync timing logic now lives
// in create-native.js so audio cannot be trimmed or delayed twice.
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import nativeHandler from "./create-native.js";

export default async function handler(req, res) {
  return nativeHandler(req, res);
}
