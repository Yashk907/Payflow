import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError.js";
import db from "../db/config/knex.js";
import Jwt from "jsonwebtoken";
import { object } from "zod";

export const merchantAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token } = req.cookies;
    if (!token) throw new AppError(401, "invalid_token", "token is invalid");

    const decoded = Jwt.verify(token, "PAYFLOW_SEC_907");
    console.log(decoded);
    if (
      typeof decoded === "object" &&
      decoded != null &&
      typeof decoded._id === "string"
    ) {
      const merchant = await db("merchants").select().where("id", decoded._id);
      req.L = merchant;
    } else {
      throw new AppError(401, "invalid_token", "token is invalid");
    }
    next();
  } catch (error) {
    throw error;
  }
};
