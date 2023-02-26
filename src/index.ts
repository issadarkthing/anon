import express from "express";
import { config } from "dotenv";
import bodyParser from "body-parser";
import sqlite from "better-sqlite3";
import rateLimit from "express-rate-limit";
import { messageSchema } from "./structure/Message";
import { schema } from "./schema";

config();

const db = sqlite("main.db");
db.pragma("journal_mode = WAL");

db.exec(schema);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

app.get("/message", (req, res) => {
  const result = db.prepare("SELECT * FROM messages").all();
  res.send(JSON.stringify(result));
})

app.post("/message", limiter, (req, res) => {
  const body = messageSchema.safeParse(req.body);

  if (body.success) {
    const data = body.data;

    db
      .prepare("INSERT INTO messages (ip, user_agent, time, message) VALUES (?, ?, ?, ?)")
      .run([req.ip, req.get("User-Agent"), (new Date()).toISOString(), data.message]);

    res.send(JSON.stringify(body.data));
  } else {
    res.send("invalid body");
    console.error(`invalid body: ${body.error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Listening to port ${port}`);
});
