import { verifyAuthToken } from "../utils/auth.js";

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = verifyAuthToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
