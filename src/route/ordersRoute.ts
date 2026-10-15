import express from "express";
import { orderAuthMiddleware } from "../middleware/ordersAuth.js";
import { createOrder, fetchOrder } from "../controller/ordersController.js";
import { orderIdSchema, orderSchema } from "../db/schemas/orders.js";
import { success } from "zod";
import { tr } from "zod/locales";
import { AppError } from "../utils/appError.js";

const orderRouter = express.Router();

orderRouter.use("/", orderAuthMiddleware);
orderRouter.post("/create", async (req, res, next) => {
  const input = orderSchema.parse(req.body);
  const merchant_Id = req.merchant?.id;
  if(!merchant_Id){
    throw Error("merchant is missing!!");
  }

  const order = await createOrder(merchant_Id, input);

  return res.status(201).json({
    success: true,
    order: order,
  });
});

orderRouter.get('/:id',async(req,res)=>{
  const merchant_id = req.merchant?.id ;
  const id = orderIdSchema.parse(req.params.id);
  if(!merchant_id) throw new AppError(401,'invalid_creds',"you are not authorized!!");
  const order = await fetchOrder(id,merchant_id);
  return res.status(200).json(
    {
      success : true,
      order : order
    }
  )

})

export default orderRouter;
