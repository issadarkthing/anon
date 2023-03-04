import { NextFunction, Request, Response } from "express";
import { config } from "dotenv";
import rateLimit from "express-rate-limit";
import { Message, messageSchema, replySchema } from "./structure/Message";
import crypto from "crypto";
import { hashPassword, createToken } from "./utils";
import { User, userSchema } from "./structure/User";
import { Client } from "./structure/Client";

config();

export const client = new Client();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});



function protectedRoute(req: Request, res: Response, next: NextFunction) {
  const token = req.get("token");

  if (!token) {
    res.status(400).send("no token");
    return;
  }

  const userId = req.params["userId"];

  if (!userId) {
    res.status(400).send("no user id");
    return;
  }

  const user = client.dbGet<User>(
    `SELECT * FROM users WHERE id = ?`,
    userId,
  );

  if (!user) {
    res.status(404).send("user not found");
    return;
  }
  
  const generatedToken = createToken(user.username, user.password);

  if (generatedToken !== token) {
    res.status(403).send("invalid token");
    return;
  }

  next();
};

client.app.set("trust proxy", "loopback");

client.app.post("/authenticate", limiter, (req, res) => {
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

client.app.post("/unlike/:id", likeLimiter, (req, res) => {
  client.dbRun(
    "UPDATE replies SET likes = likes - 1 WHERE id = ?",
    req.params.id,
  );

  res.sendStatus(200);
});

client.app.post("/like/:id", likeLimiter, (req, res) => {
  client.dbRun(
    "UPDATE replies SET likes = likes + 1 WHERE id = ?",
    req.params.id,
  );

  res.sendStatus(200);
});

client.app.post("/login", limiter, (req, res) => {
  const body = userSchema.safeParse(req.body);
   
  if (body.success) {
    const data = body.data;
    const result = client.dbGet<User>(
      "SELECT * FROM users WHERE username = ?",
      data.username,
    );

    if (!result) {
      res.status(403).send("user not found");
      return;
    }

    const hashedPassword = hashPassword(data.password);

    if (hashedPassword !== result.password) {
      res.status(401).send("unauthorized");
      return;
    }

    const token = createToken(data.username, hashedPassword);
    res.send({ token });

  } else {
    res.status(400).send("invalid body");
    console.error(`invalid body: ${body.error.message}`);
  }
});

client.app.post("/signup", limiter, (req, res) => {
  const body = userSchema.safeParse(req.body);

  if (body.success) {
    const data = body.data;
    const result = client.dbGet<User>(
      "SELECT * FROM users WHERE username = ?",
      data.username,
    );

    if (result) {
      res.status(400).send("username already taken");
      return;
    }

    const ip = req.get("X-Real-IP") || req.ip;
    const userAgent = req.get("User-Agent");
    const now = (new Date());
    const date = now.toISOString();
    const hash = crypto.createHash("sha256");
    const hashedPassword = hash.update(data.password).digest("hex");

    client.dbRun(
      "INSERT INTO users (ip, user_agent, username, password, time) VALUES (?, ?, ?, ?, ?)",
      ip, userAgent, data.username, hashedPassword, date,
    );


    res.sendStatus(200);
  } else {
    res.status(400).send("invalid body");
    console.error(`invalid body: ${body.error.message}`);
  }
});

client.app.get("/replies", (req, res) => {
    const result = client.dbAll(
      `SELECT 
        replies.id, 
        replies.time,
        replies.message_id,
        replies.reply,
        replies.likes,
        messages.message
      FROM replies 
      INNER JOIN messages ON replies.message_id = messages.id
      `
    ) || [];


  result.reverse();
  res.send(JSON.stringify(result));
})

client.app.post("/reply/:userId/:messageId", limiter, protectedRoute, (req, res) => {
  const body = replySchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).send("invalid body");
    return;
  }

  const data = body.data;
  const messageId = req.params["messageId"];
  const userId = req.params["userId"];

  const message = client.dbGet<Message>(
    "SELECT * FROM messages WHERE id = ? AND user_id = ?",
    messageId,
    userId,
  );

  if (!message) {
    res.status(404).send("cannot find message");
    return;
  }

  const reply = client.dbGet(
    `SELECT * FROM replies WHERE message_id = ?`,
    messageId,
  );

  if (reply) {
    res.status(400).send("you already responded to this message");
    return;
  }

  client.dbRun(
    "INSERT INTO replies (time, message_id, reply) VALUES (?, ?, ?)",
    (new Date()).toISOString(), 
    messageId, 
    data.reply,
  );

  res.sendStatus(200);
});

client.app.get("/messages/:userId", protectedRoute, (req, res) => {
  const userId = req.params["userId"];

  const user = client.dbGet<User>(
    "SELECT * FROM users WHERE id = ?",
    userId,
  );

  if (!user) {
    res.status(403).send("user not found");
    return;
  }

  const result = client.dbAll(
    ` SELECT 
        messages.id,
        messages.message,
        messages.ip,
        messages.user_agent,
        replies.reply,
        replies.likes,
        replies.time AS reply_time,
        messages.time AS message_time
      FROM messages 
      FULL OUTER JOIN replies ON messages.id = replies.message_id
      WHERE messages.user_id = ?
    `,
    userId,
  ) || [];

  result.reverse();
  res.send(JSON.stringify(result));
})

client.app.post("/message/:id", limiter, (req, res) => {
  const userId = req.params["id"];

  if (!userId) {
    res.status(400).send("missing user id");
    return;
  }

  const user = client.dbGet<User>(
    "SELECT * FROM users WHERE id = ?",
    userId,
  );

  if (!user) {
    res.status(403).send("user not found");
    return;
  }

  const body = messageSchema.safeParse(req.body);

  if (body.success) {
    const data = body.data;
    const ip = req.get("X-Real-IP");
    const userAgent = req.get("User-Agent");
    const now = (new Date());
    const date = now.toISOString();

    client.db
    client.dbRun(
      "INSERT INTO messages (user_id, ip, user_agent, time, message) VALUES (?, ?, ?, ?, ?)",
      userId, ip, userAgent, date, data.message,
    );

    res.send(JSON.stringify(body.data));

    if (process.env.ENV !== "DEV") {
      client.mail.sendMail({
        subject: "Someone sent you a message on anon.issadarkthing.com",
        text: `Message:\n${body.data.message}`,
        html: `ip: ${ip}<br>user agent: ${userAgent}<br>message: ${body.data.message}<br>datetime: ${now}`,
      });
    }


  } else {
    res.status(400).send("invalid body");
    console.error(`invalid body: ${body.error.message}`);
  }
});


client.start();
