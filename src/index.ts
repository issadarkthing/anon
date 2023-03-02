import express, { NextFunction, Request, Response } from "express";
import { config } from "dotenv";
import bodyParser from "body-parser";
import sqlite from "better-sqlite3";
import rateLimit from "express-rate-limit";
import { messageSchema, replySchema } from "./structure/Message";
import { schema } from "./schema";
import cors from "cors";
import { Mail } from "./structure/Mail";

config();

const mail = new Mail();

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

app.post("/authenticate", limiter, (req, res) => {
  const token = req.get("token");

  if (token === process.env.TOKEN) {
    res.sendStatus(200);
  } else {
    res.status(401).send("unauthorized");
    console.error(`unauthorized: ${req.ip} trying to access protected route`);
  }
});


const likeLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/unlike/:id", likeLimiter, (req, res) => {
  db
    .prepare("UPDATE replies SET likes = likes - 1 WHERE id = ?")
    .run([req.params.id]);

  res.sendStatus(200);
});

app.post("/like/:id", likeLimiter, (req, res) => {
  db
    .prepare("UPDATE replies SET likes = likes + 1 WHERE id = ?")
    .run([req.params.id]);

  res.sendStatus(200);
});

app.get("/replies", (req, res) => {
  const result = db 
    .prepare(`SELECT 
        replies.id, 
        replies.time,
        replies.message_id,
        replies.reply,
        replies.likes,
        messages.message
      FROM replies 
      INNER JOIN messages ON replies.message_id = messages.id
      `) 
    .all();

  result.reverse();
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
  const result = db
    .prepare(`SELECT 
        messages.id,
        messages.message,
        messages.ip,
        messages.user_agent,
        replies.reply,
        replies.time AS reply_time,
        messages.time AS message_time
      FROM messages 
      FULL OUTER JOIN replies ON messages.id = replies.message_id`)
    .all();

  result.reverse();
  res.send(JSON.stringify(result));
})

app.post("/message", limiter, (req, res) => {
  const body = messageSchema.safeParse(req.body);

  if (body.success) {
    const data = body.data;
    const ip = req.get("X-Real-IP");
    const userAgent = req.get("User-Agent");
    const now = (new Date());
    const date = now.toISOString();

    db
      .prepare("INSERT INTO messages (ip, user_agent, time, message) VALUES (?, ?, ?, ?)")
      .run([ip, userAgent, date, data.message]);

    res.send(JSON.stringify(body.data));

    mail.sendMail({
      subject: "Someone sent you a message on anon.issadarkthing.com",
      text: `Message:\n${body.data.message}`,
      html: `ip: ${ip}<br>user agent: ${userAgent}<br>message: ${body.data.message}<br>datetime: ${now}`,
    });

  } else {
    res.status(400).send("invalid body");
    console.error(`invalid body: ${body.error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Listening to port ${port}`);
});
