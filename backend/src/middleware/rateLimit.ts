import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(options: {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 120;
  const keyPrefix = options.keyPrefix ?? "rl";

  return (req: Request, _res: Response, next: NextFunction): void => {
    const userKey = req.user?.id ?? req.ip ?? "anon";
    const key = `${keyPrefix}:${userKey}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      next(
        new AppError(429, "Too many requests. Please slow down.", "RATE_LIMITED")
      );
      return;
    }

    next();
  };
}
