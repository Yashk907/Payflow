import express, { Request, Response, NextFunction } from "express";
import "dotenv/config";
import db from "./db/config/knex.js";
import PG from "pg";

import merchantRouter from "./route/merchantRoute.js";
import { AppError } from "./utils/appError.js";
import { ZodError } from "zod";
import { error } from "node:console";

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

app.use("/v1/api/merchant", merchantRouter);

//Error handling
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "validation_error",
        message: err.message,
      },
    });
  }

  console.log(err)

  return res.status(500).json({
    error: {
      code: "internal_error",
      message: "something went wrong!!",
    },
  });
});

async function Server() {
  try {
    const dbcheck = await db.raw("SELECT NOW()").then((resp) => {
      console.log(`db connection successful `, resp.rows[0]);
      //adding converting logic as pg return bigInt values as string
      PG.types.setTypeParser(20, (val) => parseInt(val, 10));
    });

    app.listen(PORT, () => {
      console.log("Server running on port 3000");
    });
  } catch (error) {
    console.log(`error in connecting to DB ${error}`);
  }
}

Server();
