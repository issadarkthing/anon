import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

export function hashPassword(password: string) {
  const hash = crypto.createHash("sha256");
  return hash.update(password).digest("hex");
}

export function createToken(username: string, password: string) {
  const tokenData = `${process.env.MASTER_SALT}:${username}:${password}`;
  return hashPassword(tokenData);
}


export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    return fn(req, res, next).catch(next);
  }
}
