import { tr } from "zod/locales";
import db from "../db/config/knex.js";
import { createPaymentAtBank } from "../services/bankService.js";
import { AppError } from "../utils/appError.js";
import type { CreatePaymentResult, Payment, PaymentRequest } from "../types/payment.js";


const PAYMENT_COLUMNS = ["id", "status", "amount"];

const createPayment = async (
  merchantId: string,
  input: PaymentRequest,
): Promise<CreatePaymentResult> => {
  // Step 1: under a row lock on the order, decide what to do and insert the payment.
  // The lock makes concurrent requests for the same order run this one at a time,
  // so only one of them can create a payment.
  const step = await db.transaction(async (trx) => {
    const order = await trx("orders")
      .select("id", "status", "amount")
      .where({ id: input.orderId, merchant_id: merchantId })
      .forUpdate()
      .first();

    if (!order) throw new AppError(404, "not_found", "Order not found");
    if (order.status === "captured" || order.status === "refunded") {
      throw new AppError(409, "payment_status", "order is already paid");
    }

    // a failed payment doesn't block a retry; anything else does
    //call reconcillation here 
    
    const existing: Payment | undefined = await trx("payments")
      .where("order_id", input.orderId)
      .whereNot("status", "failed")
      .first(PAYMENT_COLUMNS);

    if (existing) {
      if (existing.status === "captured" || existing.status === "refunded") {
        await trx("orders").update("status", "captured").where("id", input.orderId);
        throw new AppError(409, "payment_status", "order is already paid");
      }

      return { existing };
    }

    const [created]: Payment[] = await trx("payments")
      .insert({ order_id: input.orderId, amount: order.amount })
      .returning(PAYMENT_COLUMNS);

    return { created: created! };
  });

  if (step.existing) {
    return { httpStatus: 202, payment: step.existing };
  }

  const payment = step.created!;

  // Step 2: call the bank outside any transaction. The payment id is the bank reference,
  // so a retry to the bank can't charge twice.
  const bankResult = await createPaymentAtBank(payment.id, payment.amount);

  // Step 3: record the outcome. Each update is guarded by the expected status.
  if (bankResult === null) {
    await db.transaction(async (trx) => {
      await trx("payments")
        .update({ status: "unknown", bank_ref: payment.id })
        .where({ id: payment.id, status: "created" });
      await trx("orders").update("status", "unknown").where("id", input.orderId);
    });
    return { httpStatus: 202, payment: { ...payment, status: "unknown" } };
  }

  if (bankResult.status === "declined") {
    await db("payments")
      .update({
        status: "failed",
        bank_ref: bankResult.ref,
        failure_reason: bankResult.reason ?? "declined",
      })
      .where({ id: payment.id, status: "created" });
    // order stays `created` so the customer can retry
    throw new AppError(402, "payment_declined", bankResult.reason ?? "Payment was declined");
  }

  const captured = await db.transaction(async (trx) => {
    const [row]: Payment[] = await trx("payments")
      .update({ status: "captured", bank_ref: bankResult.ref })
      .where({ id: payment.id, status: "created" })
      .returning(PAYMENT_COLUMNS);
    await trx("orders").update("status", "captured").where("id", input.orderId);
    return row ?? payment;
  });

  return { httpStatus: 201, payment: captured };
};

export { createPayment };
