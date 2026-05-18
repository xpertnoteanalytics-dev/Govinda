import { Types } from "mongoose";
import { AppError } from "./AppError";

/**
 * Normalizes a Mongoose ObjectId, populated document, or string into a 24-char hex id.
 */
export function resolveObjectIdString(value: unknown, field = "id"): string {
  if (value == null) {
    throw new AppError(400, `Invalid ${field}`, "INVALID_ID");
  }

  if (typeof value === "string") {
    if (Types.ObjectId.isValid(value) && String(new Types.ObjectId(value)) === value) {
      return value;
    }
    throw new AppError(400, `Invalid ${field}`, "INVALID_ID");
  }

  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === "object") {
    const doc = value as { _id?: unknown };
    if (doc._id != null) {
      return resolveObjectIdString(doc._id, field);
    }
  }

  throw new AppError(400, `Invalid ${field}`, "INVALID_ID");
}

export function isValidObjectIdString(value: string): boolean {
  return Types.ObjectId.isValid(value) && String(new Types.ObjectId(value)) === value;
}
