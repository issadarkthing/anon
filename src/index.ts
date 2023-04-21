import { NextFunction, Request, Response } from "express";
import { config } from "dotenv";
import rateLimit from "express-rate-limit";
import { 
  MessageBody, 
  messageBodySchema, 
  replyBodySchema,
} from "./structure/Message";
import crypto from "crypto";
import { hashPassword, createToken, isValidUsername } from "./utils";
import { 
  User, 
  UserBody, 
  userBodySchema, 
  userUpdateBodySchema,
} from "./structure/User";
import { Client } from "./structure/Client";
import fs from "fs";

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

  const username = req.params["username"];

  if (!username) {
    res.status(400).send("no user id");
    return;
  }

  const user = client.dbGet<User>(
    `SELECT * FROM users WHERE username = ?`,
    username,
  );

  if (!user) {
    res.status(404).send("user not found");
    return;
  }
  
  const generatedToken = createToken(user.id);

  if (generatedToken !== token) {
    res.status(403).send("invalid token");
    return;
  }

  next();
};

client.app.set("trust proxy", "loopback");

const likeLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

client.app.get("/authenticate/:username", protectedRoute, (req, res) => {
  res.sendStatus(200);
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
  const body = userBodySchema.safeParse(req.body);
   
  if (!body.success) {
    res.status(400).send("invalid body");
    return;
  }

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

  const token = createToken(result.id);
  res.send({ token });
});

const signUpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

client.app.post("/signup", signUpLimiter, (req, res) => {
  const body = userBodySchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).send("invalid body");
    return;
  }

  const data = body.data;

  if (!isValidUsername(data.username)) {
    res.status(400).send("invalid username");
    return;
  }

  const result = client.dbGet<UserBody>(
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
});


client.app.patch("/user/:username", limiter, protectedRoute, (req, res) => {
  const username = req.params["username"];
  let user = client.dbGet<User>(`
    SELECT username, time, description, email, notify_email
    FROM users 
    WHERE username = ?`, 
    username,
  );
 
  if (!user) {
    res.status(404).send("user not found");
    return;
  }

  const body = userUpdateBodySchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).send("invalid body");
    return;
  }

  const data = body.data;

  const update = <T>(field: string, value: T) => {
    client.dbRun(
      `
      UPDATE users
      SET ${field} = ?
      WHERE username = ?
      `,
      value,
      username,
    );
  }

  if ("username" in data) {

    if (!isValidUsername(data.username!)) {
      res.status(400).send("invalid username");
      return;
    }

    update("username", data.username);
  }

  if ("description" in data) {
    update("description", data.description);
  }

  if ("email" in data) {
    update("email", data.email);
  }

  if ("notify_email" in data) {
    update("notify_email", data.notify_email ? 1 : 0);
  }
  
  user = client.dbGet<User>(`
    SELECT username, time, description, email, notify_email
    FROM users 
    WHERE username = ?`, 
    username,
  );

  res.send(user);
});

client.app.get("/user/:username", limiter, (req, res) => {
  const username = req.params["username"];
  const token = req.get("token");

  if (!username) {
    res.status(400).send("no user id");
    return;
  }

  const fields = [ "id", "username", "time", "description"];

  if (token) {
    fields.push("email", "notify_email");
  }

  const user = client.dbGet<User>(`
    SELECT ${fields.join(", ")}
    FROM users 
    WHERE username = ?`, 
    username,
  );
 
  if (!user) {
    res.status(404).send("user not found");
    return;
  }

  if (token) {
    const generatedToken = createToken(user.id);

    if (generatedToken !== token) {
      res.status(403).send("invalid token");
      return;
    }
  }

  //@ts-ignore
  delete user.id;
  res.send(user);
});

client.app.get("/:username/replies", (req, res) => {
  const username = req.params["username"];
  const user = client.dbGet<User>("SELECT * FROM users WHERE username = ?", username);

  if (!user) {
    res.status(404).send("user not found");
    return;
  }

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
      WHERE messages.user_id = ?
      `,
    user.id,
  );


  result.reverse();
  res.send(JSON.stringify(result));
})

client.app.post("/:username/reply/:messageId", limiter, protectedRoute, (req, res) => {
  const body = replyBodySchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).send("invalid body");
    return;
  }

  const data = body.data;
  const messageId = req.params["messageId"];
  const username = req.params["username"];

  const message = client.dbGet<MessageBody>(
    `SELECT * FROM messages 
     INNER JOIN users ON messages.user_id = users.id
     WHERE messages.id = ? AND users.username = ?`,
    messageId,
    username,
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

client.app.get("/:username/messages", protectedRoute, (req, res) => {
  const username = req.params["username"];

  const user = client.dbGet<User>(
    "SELECT * FROM users WHERE username = ?",
    username,
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
      INNER JOIN users ON messages.user_id = users.id
      WHERE users.username = ?
    `,
    username,
  );

  result.reverse();
  res.send(JSON.stringify(result));
})

const sendMessageLimiter = rateLimit({
  windowMs: 45 * 60 * 1000, // 45 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
})

client.app.post("/:username/message", sendMessageLimiter, (req, res) => {
  const username = req.params["username"];

  if (!username) {
    res.status(400).send("missing user id");
    return;
  }

  const user = client.dbGet<User>(
    "SELECT * FROM users WHERE username = ?",
    username,
  );

  if (!user) {
    res.status(403).send("user not found");
    return;
  }

  const body = messageBodySchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).send("invalid body");
    return;
  }

  const data = body.data;
  const ip = req.get("X-Real-IP");
  const userAgent = req.get("User-Agent");
  const now = (new Date());
  const date = now.toISOString();

  client.dbRun(
    "INSERT INTO messages (user_id, ip, user_agent, time, message) VALUES (?, ?, ?, ?, ?)",
    user.id, ip, userAgent, date, data.message,
  );

  res.send(JSON.stringify(body.data));

  if (user.email && user.notify_email) {

    fs.readFile("email.html", { encoding: "utf-8" }, (err, content) => {
      if (err) {
        console.error(`error occured when reading file: ${err.message}`);
        return;
      }


      const html = content.replace(/\$\{username\}/g, user.username);

      client.mail.sendMail({
        to: user.email,
        subject: "A message received on anonmi",
        text: `Message:\n${body.data.message}`,
        html
      });
    });

  }

});


client.start();
