import { createJob } from "../studio.jobs.js";

export function generateSocialPack(opts){
  return createJob("socialpack", opts);
}
