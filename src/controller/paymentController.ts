import db from "../db/config/knex.js";
import { createPaymentAtBank } from "../services/bankService.js";
import { AppError } from "../utils/appError.js";
import type { CreatePaymentResult, Payment, PaymentRequest } from "../types/payment.js";
import { reconcilePayment } from "../services/Reconcillation.js";


const PAYMENT_COLUMNS = ["id", "status", "amount"];

// created payments older than this are treated as abandoned
const STALE_CREATED_MS = 60_000;

const createPayment = async (
  merchantId: string,
  input: PaymentRequest,
): Promise<CreatePaymentResult> => {

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
    const existingRow: (Payment & { created_at: Date }) | undefined = await trx("payments")
      .where("order_id", input.orderId)
      .whereNot("status", "failed")
      .first([...PAYMENT_COLUMNS, "created_at"]);
    // created_at is not returned to the API
    const { created_at, ...existing } = existingRow ?? ({} as Partial<Payment & { created_at: Date }>);

    if (existingRow) {
      if (existing.status === "captured" || existing.status === "refunded") {
        await trx("orders").update("status", "captured").where("id", input.orderId);
        throw new AppError(409, "payment_status", "order is already paid");
      }
      // reconcile after commit, outside the lock
      const stale =
        existing.status === "created" &&
        Date.now() - new Date(created_at!).getTime() > STALE_CREATED_MS;
      return { existing: existing as Payment, stale };
    }

    const [created]: Payment[] = await trx("payments")
      .insert({ order_id: input.orderId, amount: order.amount })
      .returning(PAYMENT_COLUMNS);

    return { created: created! };
  });

  if (step.existing) {
    let current: Payment = step.existing;
    // reconcile unknown or stale created payments
    if (current.status === "unknown" || step.stale) {
      try {
        await reconcilePayment(current.id, input.orderId);
      } catch (err) {
        console.error(`Reconcile failed for payment ${current.id}`, err);
      }
      current = (await db("payments").where("id", current.id).first(PAYMENT_COLUMNS)) ?? current;
      // failed: retry with a new payment
      if (current.status === "failed") return createPayment(merchantId, input);
    }
    return { httpStatus: current.status === "captured" ? 201 : 202, payment: current };
  }

  const payment = step.created!;

  // Step 2: call the bank outside the transaction; payment id is the bank reference
  const bankResult = await createPaymentAtBank(payment.id, payment.amount);

  // Step 3: record the outcome, guarded by the expected status
  if (bankResult === null) {
    const current = await db.transaction(async (trx) => {
      const [row]: Payment[] = await trx("payments")
        .update({ status: "unknown", bank_ref: payment.id, version: trx.raw("version + 1") })
        .where({ id: payment.id, status: "created" })
        .returning(PAYMENT_COLUMNS);
      // already moved by reconcile
      if (!row) return (await trx("payments").where("id", payment.id).first(PAYMENT_COLUMNS)) ?? payment;
      await trx("orders").update("status", "unknown").where("id", input.orderId);
      return row;
    });
    return { httpStatus: current.status === "captured" ? 201 : 202, payment: current };
  }

  if (bankResult.status === "declined") {
    const [failed]: Payment[] = await db("payments")
      .update({
        status: "failed",
        bank_ref: bankResult.ref,
        failure_reason: bankResult.reason ?? "declined",
        version: db.raw("version + 1"),
      })
      .where({ id: payment.id, status: "created" })
      .returning(PAYMENT_COLUMNS);
    if (!failed) {
      // settled by reconcile
      const current = await db("payments").where("id", payment.id).first(PAYMENT_COLUMNS);
      if (current && current.status !== "failed") {
        return { httpStatus: current.status === "captured" ? 201 : 202, payment: current };
      }
    }
    // order stays `created` so the customer can retry
    throw new AppError(402, "payment_declined", bankResult.reason ?? "Payment was declined");
  }

  const captured = await db.transaction(async (trx) => {
    const [row]: Payment[] = await trx("payments")
      .update({ status: "captured", bank_ref: bankResult.ref, version: trx.raw("version + 1") })
      .where({ id: payment.id, status: "created" })
      .returning(PAYMENT_COLUMNS);
    // already moved by reconcile
    if (!row) return (await trx("payments").where("id", payment.id).first(PAYMENT_COLUMNS)) ?? payment;
    await trx("orders").update("status", "captured").where("id", input.orderId);
    return row;
  });

  return { httpStatus: captured.status === "captured" ? 201 : 202, payment: captured };
};

export { createPayment };
