import type { Knex } from "knex";
import db from "../db/config/knex.js";
import { AppError } from "../utils/appError.js";
import type { PaymentRow, PaymentStatus } from "../types/payment.js";

// Legal transitions. Anything not listed here is rejected.
// `created -> captured` and `unknown -> captured` are the Phase 1 shortcut
// (approval captures directly); drop them once a separate capture step exists.
const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ["authorized", "captured", "failed", "unknown"],
  unknown: ["authorized", "captured", "failed"],
  authorized: ["captured", "failed"],
  captured: ["refunded"],
  failed: [],
  refunded: [],
};

export const canTransition = (from: PaymentStatus, to: PaymentStatus) =>
  TRANSITIONS[from]?.includes(to) ?? false;

type TransitionExtras = {
  bank_ref?: string;
  failure_reason?: string;
};

/**
 * Moves a payment to `to` if the transition is legal.
 * The UPDATE is guarded by the status we just read, so if another request
 * changed the payment in between, zero rows match and we throw instead of overwriting.
 */
export const transitionPayment = async (
  paymentId: string,
  to: PaymentStatus,
  extras: TransitionExtras = {},
  trx?: Knex.Transaction,
): Promise<PaymentRow> => {
  const conn = trx ?? db;

  const current = await conn("payments").where("id", paymentId).first("status");
  if (!current) throw new AppError(404, "not_found", "Payment not found");

  const from = current.status as PaymentStatus;
  if (!canTransition(from, to)) {
    throw new AppError(409, "invalid_transition", `Cannot move payment from ${from} to ${to}`);
  }

  const [updated]: PaymentRow[] = await conn("payments")
    .where({ id: paymentId, status: from })
    .update({ ...extras, status: to, version: conn.raw("version + 1") })
    .returning("*");

  if (!updated) {
    throw new AppError(409, "concurrent_update", "Payment was changed by another request");
  }
  return updated;
};
