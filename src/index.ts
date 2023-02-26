import express from "express";
import { config } from "dotenv";
import bodyParser from "body-parser";

config();

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

app.post("/", (req, res) => {
  res.send(`message: ${JSON.stringify(req.body)}`);
});

app.listen(port, () => {
  console.log(`Listening to port ${port}`);
});
