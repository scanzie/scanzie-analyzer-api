// Arcjet middleware for rate limiting and bot detection
import express from "express";
import { aj } from "../config/arcjet";

export const arcjetMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const decision = await aj.protect(req, { requested: 5 });

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }
    if (decision.reason.isBot()) {
      return res.status(403).json({ error: "Bot activity detected" });
    }
    return res.status(403).json({ error: "Request denied" });
  }

  next();
};
