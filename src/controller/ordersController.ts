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


const fetchOrder = async(id : string,merchant_id:string)=>{
  const order = await db('orders')
  .where({id,'merchant_id' : merchant_id})
  .first(ORDER_COLUMNS)

  if(!order) throw new AppError(404,"not_found","order not exists!!");
  return order;
}

export { createOrder,fetchOrder };
