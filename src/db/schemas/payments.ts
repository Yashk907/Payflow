import z from "zod";


const paymentReqSchema =  z.object({
    orderId : z.uuid(),
    cardToken : z.number().int().positive(),
    paymentMethod : z.string().optional()
});



export {paymentReqSchema};
