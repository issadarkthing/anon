
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: string;
      TOKEN: string;
      MAIL_SERVICE: string;
      MAIL_USER: string;
      MAIL_PASS: string;
      TARGET_MAIL: string;
      MASTER_SALT: string;
      ENV: DEV
    }
  }
}

export {}
