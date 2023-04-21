import sqlite from "better-sqlite3";

const db = sqlite("main.db");

const stmts = [
  `ALTER TABLE users ADD COLUMN email TEXT`,
  `ALTER TABLE users ADD COLUMN notify_email BOOL`,
];


for (const stmt of stmts) {

  try {
    const result = db
      .prepare(stmt)
      .run();

    console.log(`SUCCESS: ${stmt}: ${result.changes} row(s) were affected`);

  } catch (e) {
    const err = e as Error;
    console.error(`ERROR: ${stmt}: ${err.message}`);
  }

}
