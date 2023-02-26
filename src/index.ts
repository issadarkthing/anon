import express from "express";
import { config } from "dotenv";
import bodyParser from "body-parser";
import { messageSchema } from "./structure/Message";

config();

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

app.post("/", (req, res) => {
  const body = messageSchema.safeParse(req.body);

  if (body.success) {
    res.send(`message: ${JSON.stringify(body.data)}`);
  } else {
    res.send("invalid body");
    console.error(`invalid body: ${body.error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Listening to port ${port}`);
});
