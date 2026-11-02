import type { Knex } from "knex";
import db from "../db/config/knex.js";
import { AppError } from "../utils/appError.js";
import type { PaymentStatus } from "../types/payment.js";

// Legal transitions; anything else is rejected.
// created/unknown -> captured is a Phase 1 shortcut.
const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ["authorized", "captured", "failed", "unknown"],
  unknown: ["authorized", "captured", "failed"],
  authorized: ["captured", "failed"],
  captured: ["refunded"],
  failed: [],
  refunded: [],
};

export const canTransition = (from: PaymentStatus, to: PaymentStatus): boolean =>
  TRANSITIONS[from]?.includes(to) ?? false;

// Checks if the move is allowed; does not write.
export const transitionPayment = async (
  paymentId: string,
  to: PaymentStatus,
  trx?: Knex.Transaction,
): Promise<boolean> => {
  const conn = trx ?? db;

  const current = await conn("payments").where("id", paymentId).first("status");
  if (!current) throw new AppError(404, "not_found", "Payment not found");

  return canTransition(current.status as PaymentStatus, to);
};
