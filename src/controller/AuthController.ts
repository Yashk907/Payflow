import bcrypt from "bcrypt";
import db from "../db/config/knex.js";
import { AppError } from "../utils/appError.js";
import { generateKey } from "../utils/ApiKey.js";

type MerchantRow = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  api_key?: string;
};

const HASH_ROUNDS = 12;

const merchantSignUp = async (input: {
  name: string;
  email: string;
  password: string;
}) => {
  try {
    const hashPassword = await bcrypt.hash(input.password, HASH_ROUNDS);
    const apiKey = generateKey();

    const merchantData: Array<MerchantRow> = await db.transaction(
      async (trx) => {
        const merchant: Array<MerchantRow> = await trx("merchants")
          .insert({
            name: input.name,
            email: input.email,
            password_hash: hashPassword,
          })
          .returning(["id", "name", "email", "created_at"]);

        await trx("api_keys").insert({
          merchant_id: merchant[0].id,
          key_prefix: apiKey.prefix_key,
          key_hash: apiKey.keyHash,
        });
        return merchant;
      },
    );

    merchantData[0].api_key = apiKey.fullKey;
    return merchantData[0];
  } catch (err: any) {
    if (err.code == "23505") {
      throw new AppError(409, "email_taken", "Email is already used!!");
    }
    throw err;
  }
};

const merchantSignIn = async (input: { email: string; password: string }) => {
  try {
    const merchant: { id: string; email: string; password_hash: string } =
      await db("merchants")
        .select("id", "email", "password_hash")
        .where("email", input.email)
        .first();

    if (!merchant) {
      throw new AppError(400, "invalid_cred", "check your email and password");
    }

    const validatePass = await bcrypt.compare(
      input.password,
      merchant.password_hash,
    );

    if (!validatePass) {
      throw new AppError(400, "invalid_cred", "check your email and password");
    }

    return merchant.id;
  } catch (error) {
    throw error;
  }
};

export { merchantSignUp, merchantSignIn };
