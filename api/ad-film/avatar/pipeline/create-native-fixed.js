// api/ad-film/avatar/pipeline/create-native-fixed.js
// Compatibility route. Avatar creation is now gated until the accepted
// Seedance source video is fully available for the same production lock.
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import gatedHandler from "./create-after-seedance.js";

export default async function handler(req, res) {
  return gatedHandler(req, res);
}
