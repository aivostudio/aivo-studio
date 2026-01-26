import handler from "./auth/me.js";

export default async function me(req, res) {
  return handler(req, res);
}
