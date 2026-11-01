import { NextFunction, Request, Response } from "express";
import { hashesMatch, hashKey, parseKey } from "../utils/ApiKey.js";
import { AppError } from "../utils/appError.js";
import db from "../db/config/knex.js";

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
    const header = req.header("authorization") ?? "";
    const key = header.startsWith("Bearer ") ? header.slice(7) : "";

    const parsedkey = parseKey(key);
    if (!parsedkey) throw new AppError(401, "unauthorized", "Invalid creds");

    const row = await db("api_keys as k")
      .join("merchants as m", "m.id", "k.merchant_id")
      .where("k.key_prefix",parsedkey.prefix)
      .whereNull("k.revoked_at")
      .first(
        "k.id as key_id",
        "k.key_hash",
        "k.key_prefix",
        "m.id as merchant_Id",
        "m.name",
        "m.email",
        "m.status",
      );

    if (!row || !hashesMatch(hashKey(key), row.key_hash)) {
      throw new AppError(401, "unauthorized", "Invalid creds");
    }

    if (row.status != "active") {
      throw new AppError(403, "account_suspended", "Account is Suspended!!");
    }

    req.merchant = { id: row.merchant_Id, name: row.name, email: row.email };
    next();
 
};
