import express from "express";
import {
  merchantSignUp,
  merchantSignIn,
} from "../controller/AuthController.js";
import merchantSchema from "../db/schemas/merchant.js";
import Jwt from "jsonwebtoken";
import { merchantAuthMiddleware } from "../middleware/merchantAuth.js";

const merchantRouter = express.Router();

merchantRouter.post("/signUp", async (req, res) => {
  const input = merchantSchema.parse(req.body);
  const merchant = await merchantSignUp(input);
  return res.status(201).json({
    success: true,
    data: merchant,
  });
});

merchantRouter.post("/signIn", async (req, res) => {
  const { email, password } = req.body;
  const merchantId = await merchantSignIn({ email, password });
  const token = Jwt.sign({_id : merchantId},"PAYFLOW_SEC_907",{
    expiresIn : "1d"
  });

  res.cookie("token",token);
  return res.status(200).json({
    success: true,
    message: "merchant successfully signed in",
  });
});


merchantRouter.get("/getInfo", merchantAuthMiddleware,async(req,res)=>{
  return res.status(200).json({
    message : "test"
  })
})

export default merchantRouter;
