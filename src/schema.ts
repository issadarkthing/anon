
export const schema = `
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER NOT NULL UNIQUE,
    ip         TEXT,
    user_agent TEXT,
    time       TEXT NOT NULL,
    message    TEXT NOT NULL,
    PRIMARY KEY(id AUTOINCREMENT)
  )
`
