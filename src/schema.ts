
export const schema = `
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER NOT NULL UNIQUE,
    ip         TEXT,
    user_agent TEXT,
    time       TEXT NOT NULL,
    message    TEXT NOT NULL,
    PRIMARY KEY(id AUTOINCREMENT)
  );

  CREATE TABLE IF NOT EXISTS replies (
    id         INTEGER NOT NULL UNIQUE,
    time       TEXT NOT NULL,
    message_id INTEGER NOT NULL,
    reply      TEXT NOT NULL,
    likes      INTEGER DEFAULT 0,
    PRIMARY KEY(id AUTOINCREMENT)
  );

  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER NOT NULL UNIQUE,
    ip         TEXT,
    user_agent TEXT,
    username   TEXT NOT NULL,
    password   TEXT NOT NULL,
    time       TEXT NOT NULL,
    PRIMARY KEY(id AUTOINCREMENT)
  );
`
