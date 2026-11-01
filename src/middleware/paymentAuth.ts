import { NextFunction, Request, Response } from "express";
import { hashesMatch, hashKey, parseKey } from "../utils/ApiKey.js";
import { AppError } from "../utils/appError.js";
import db from "../db/config/knex.js";
import { paymentReqSchema } from "../db/schemas/payments.js";


export const loadOrder = async (req: Request, _res: Response, next: NextFunction) => {
  const reqBody = paymentReqSchema.parse(req.body);

  const order = await db("orders")
    .where({ id: reqBody.orderId, merchant_id: req.merchant!.id })
    .first("id", "amount", "currency", "status");

  if (!order) throw new AppError(404, "not_found", "Order not found");

  next();
};