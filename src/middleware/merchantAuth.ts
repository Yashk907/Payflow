import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError.js";
import db from "../db/config/knex.js";
import Jwt from "jsonwebtoken";

export const merchantAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token } = req.cookies;
    if (!token) throw new AppError(401, "invalid_token", "token is invalid");
    const secret = process.env.PASSWORD_HASH;
    let decoded;
    if (typeof secret === "string") {
      decoded = Jwt.verify(token, secret);
    } else {
      console.error("issue while importing secret");
      throw Error;
    }

    if (
      typeof decoded === "object" &&
      decoded != null &&
      typeof decoded._id === "string"
    ) {
      const merchant: Array<{
        id: string;
        name: string;
        email: string;
      }> = await db("merchants")
        .select("id", "name", "email")
        .where("id", decoded._id);

      if (merchant.length == 0)
        throw new AppError(401, "invalid_token", "token is invalid");
      req.merchant = merchant[0];
    } else {
      throw new AppError(401, "invalid_token", "token is invalid");
    }
    next();
  } catch (error) {
    if (error instanceof Jwt.JsonWebTokenError) {
      throw new AppError(401, "invalid_token", "token is invalid");
    }
    throw error;
  }
};
