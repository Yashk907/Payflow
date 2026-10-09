import express from "express";
import "dotenv/config";
import db from "./db/config/knex.js";
import PG from "pg";

console.log("ENV:", process.env.DB_HOST);
console.log("USER:", process.env.DB_USER);
console.log("PASSWORD:", process.env.DB_PASSWORD);
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

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
  } finally {
    db.destroy();
  }
}


Server();
