import express, { NextFunction, Request, Response } from "express";
import { config } from "dotenv";
import bodyParser from "body-parser";
import sqlite from "better-sqlite3";
import rateLimit from "express-rate-limit";
import { messageSchema, replySchema } from "./structure/Message";
import { schema } from "./schema";
import cors from "cors";

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

app.use(cors({
  origin: "*",
}))
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

app.set("trust proxy", "loopback");

app.get("/replies", limiter, (req, res) => {
  const result = db 
    .prepare(`SELECT 
        replies.id, 
        replies.time,
        replies.message_id,
        replies.reply,
        messages.message
      FROM replies 
      INNER JOIN messages ON replies.message_id = messages.id`) .all();
  res.send(JSON.stringify(result));
})

app.post("/reply/:id", limiter, protectedRoute, (req, res) => {
  const body = replySchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).send("invalid body");
    console.error(`invalid body: ${body.error.message}`);
    return;
  }

  const data = body.data;
  const messageId = req.params["id"];

  const message = db
    .prepare("SELECT * FROM messages WHERE id = ?")
    .get(messageId);

  if (!message) {
    res.status(404).send(`cannot find message "${messageId}"`);
    console.error(`no data: cannot find message "${messageId}"`);
    return;
  }

  db
    .prepare("INSERT INTO replies (time, message_id, reply) VALUES (?, ?, ?)")
    .run([(new Date()).toISOString(), messageId, data.reply]);

  res.sendStatus(200);
});

app.get("/messages", protectedRoute, (req, res) => {
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
