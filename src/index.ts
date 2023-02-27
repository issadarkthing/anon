import express, { NextFunction, Request, Response } from "express";
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

function protectedRoute(req: Request, res: Response, next: NextFunction) {
  const token = req.get("token");

  if (token === process.env.TOKEN) {
    next();
  } else {
    res.status(401).send("unauthorized");
    console.error(`unauthorized: ${req.ip} trying to access protected route`);
  }
}

app.set("trust proxy", 1);

app.get("/ip", (req, res) => res.send(`${req.ip} ${req.get("X-Real-IP")}`));

app.get("/message", protectedRoute, (req, res) => {
  const result = db.prepare("SELECT * FROM messages").all();
  res.send(JSON.stringify(result));
})

app.post("/message", limiter, (req, res) => {
  const body = messageSchema.safeParse(req.body);

  if (body.success) {
    const data = body.data;

    db
      .prepare("INSERT INTO messages (ip, user_agent, time, message) VALUES (?, ?, ?, ?)")
      .run([req.get("X-Real-IP"), req.get("User-Agent"), (new Date()).toISOString(), data.message]);

    res.send(JSON.stringify(body.data));
  } else {
    res.status(400).send("invalid body");
    console.error(`invalid body: ${body.error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Listening to port ${port}`);
});
