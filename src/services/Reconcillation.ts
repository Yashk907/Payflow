import { fetchPaymentStatus } from "./bankService.js";
import { canTransition, transitionPayment } from "./stateMachine.js";
import type { PaymentStatus } from "../types/payment.js";
import db from "../db/config/knex.js";
import type { Knex } from "knex";

export const reconcilePayment = async (reference: string, order_id: string,trx? : Knex.Transaction) => {
  let PaymentStatus = await fetchPaymentStatus(reference);
  let status: PaymentStatus;
  if (!PaymentStatus) status = "unknown";
  else status = PaymentStatus.status == "approved" ? "captured" : "failed";
  let transitionAllowed = await transitionPayment(reference, status, trx);

  // refetch and retry
  let count = 0;
  while (!transitionAllowed && count < 2) {
    count++;
    PaymentStatus = await fetchPaymentStatus(reference);
    if (!PaymentStatus) status = "unknown";
    else status = PaymentStatus.status == "approved" ? "captured" : "failed";
    transitionAllowed = await transitionPayment(reference, status, trx);
  }

  if (!transitionAllowed) {
    console.error(`Error in transition of payment with reference ${reference}`);
    return;
  }

  // savepoint if called inside a transaction
  const updated = await (trx ?? db).transaction(async (tx) => {
    // read version for the guard
    const current = await tx("payments")
      .where("id", reference)
      .first("status", "version");
    if (!current || !canTransition(current.status, status)) return false;

    const paymentUpdated = await tx("payments")
      .where({ id: reference, version: current.version })
      .update({ status, version: tx.raw("version + 1") });
    // changed by another service
    if (paymentUpdated === 0) return false;

    await tx("orders").update("status", status).where("id", order_id);
    return true;
  });

  if (!updated) {
    console.error(`Payment ${reference} changed during reconcile, not updated`);
    return;
  }
  console.log("Reconcillation is done");
};
