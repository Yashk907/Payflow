import express from 'express'
import { merchantSignUp } from '../controller/AuthController.js'
import merchantSchema from '../db/schemas/merchant.js'

const merchantRouter = express.Router()

merchantRouter.post('/CreateMerchant',async (req,res)=>{
    const input = merchantSchema.parse(req.body);
    const merchant = await merchantSignUp(input);
    return res.status(201).json({
        success : true,
        data : merchant
    })
})