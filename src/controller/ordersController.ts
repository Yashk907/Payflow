import db from "../db/config/knex.js";
import { AppError } from "../utils/appError.js";

const ORDER_COLUMNS = [
  "id",
  "amount",
  "currency",
  "receipt",
  "status",
  "created_at",
];
const createOrder = async (
  merchant_id: string,
  input: {
    amount: number;
    currency: string;
    receipt?: string;
  },
) => {
  try {
    const order = await db("orders")
      .insert({
        merchant_id: merchant_id,
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt ?? null,
      })
      .returning(ORDER_COLUMNS);

    return order;
  } catch (error) {
    throw error;
  }
};

const fetchOrder = async (id: string, merchant_id: string) => {
  const order = await db("orders")
    .where({ id, merchant_id: merchant_id })
    .first(ORDER_COLUMNS);

  if (!order) throw new AppError(404, "not_found", "order not exists!!");
  return order;
};

const fetchOrders = async (
  merchant_id: string,
  limit: number,
  page: number,
) => {
  const offset = limit * (page - 1);
  const orders = await db("orders")
  .select(ORDER_COLUMNS)
    .where("merchant_id", merchant_id)
    .orderBy('created_at','desc')
    .limit(limit+1)
    .offset(offset)

  return {
    orders : orders.slice(0,limit),
    hasMore : orders.length>limit?true : false
  };
};

export { createOrder, fetchOrder, fetchOrders };
