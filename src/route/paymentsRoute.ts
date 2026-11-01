import express from "express";
import { paymentReqSchema } from "../db/schemas/payments.js";
import { createPayment } from "../controller/paymentController.js";
import { success } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { loadOrder } from "../middleware/paymentAuth.js";

const paymentRouter = express.Router();

paymentRouter.use(requireAuth);
paymentRouter.use(loadOrder)
paymentRouter.post('/create',async (req,res,next)=>{
    try {
        const input = paymentReqSchema.parse(req.body)

        const { httpStatus, payment } = await createPayment(req.merchant!.id, input)

        return res.status(httpStatus).send({
            success : true,
            payment : payment
        })
    } catch (err) {
        next(err)
    }
})

export default paymentRouter;