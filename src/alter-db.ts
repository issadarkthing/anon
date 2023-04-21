import sqlite from "better-sqlite3";

const db = sqlite("main.db");

const stmt = `
  ALTER TABLE users ADD COLUMN email TEXT
`;

try {

  const result = db
    .prepare(stmt)
    .run();

  console.log(`success: ${result.changes} row(s) were affected`);

} catch (e) {
  const err = e as Error;
  console.error(`an error occured: ${err.message}`);
}
