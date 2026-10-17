import express from "express";
import {
  merchantSignUp,
  merchantSignIn,
} from "../controller/AuthController.js";
import merchantSchema from "../db/schemas/merchant.js";
import Jwt from "jsonwebtoken";
import { merchantAuthMiddleware } from "../middleware/merchantAuth.js";
import { disableMerchantStatus, enableMerchantStatus } from "../controller/merchantController.js";

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

  const secret = process.env.PASSWORD_HASH;
  if (typeof secret === "string") {
    const token = Jwt.sign({ _id: merchantId }, secret, {
      expiresIn: "1d",
    });
    res.cookie("token", token);
  } else {
    console.error("env import fail for token generation");
    throw Error("env key is missing");
  }

  return res.status(200).json({
    success: true,
    message: "merchant successfully signed in",
  });
});

merchantRouter.get("/getInfo", merchantAuthMiddleware, async (req, res) => {
  return res.status(200).json({
    message: req.merchant,
  });
});

merchantRouter.post(
  "/disableMerchant",
  merchantAuthMiddleware,
  async (req, res) => {
    if (!req.merchant?.id) {
      throw Error("merchnat is missing!");
    }
    const merchant = await disableMerchantStatus(req.merchant?.id);

    return res.status(200).json({
      success: true,
      data: merchant,
    });
  },
);

merchantRouter.post(
  "/enableMerchant",
  merchantAuthMiddleware,
  async (req, res) => {
    if (!req.merchant?.id) {
      throw Error("merchnat is missing!");
    }
    const merchant = await enableMerchantStatus(req.merchant?.id);

    return res.status(200).json({
      success: true,
      data: merchant,
    });
  },
);
export default merchantRouter;
