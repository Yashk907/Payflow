import z from "zod";

const orderSchema = z.object({
    amount : z.number().int().positive().max(1_000_000_000),
    currency : z.literal('INR').default('INR'),
    receipt : z.string().trim().min(1).max(40).optional()
});


const orderIdSchema = z.uuid()

export {orderSchema,orderIdSchema};
