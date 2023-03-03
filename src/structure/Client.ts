import { Mail } from "./Mail";
import sqlite, { Database, Statement } from "better-sqlite3";
import { schema } from "../schema";
import express, { Express } from "express";
import cors from "cors";
import bodyParser from "body-parser";


export class Client {
  mail: Mail;
  db: Database;
  app: Express;

  constructor() {
    this.mail = new Mail();
    this.db = sqlite("main.db");
    this.db.pragma("journal_mode = WAL");
    this.db.exec(schema);
    this.app = express();
    this.app.use(cors({
      origin: "*",
    }))
    this.app.use(bodyParser.json());
  }

  start() {
    const port = process.env.PORT;
    this.app.listen(port, () => {
      console.log(`Listening to port ${port}`);
    });
  }

  dbGet<T>(query: string, ...values: any[]): T | undefined {
    return this.db.prepare(query).get(values);
  }

  dbAll<T>(query: string, ...values: any[]): T[] | undefined {
    return this.db.prepare(query).all(values);
  }

  dbRun(query: string, ...values: any[]): void {
    this.db.prepare(query).run(values);
  }
}
