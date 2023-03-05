import { z } from "zod";

const MAX_USERNAME = 50;
const MAX_PASSWORD = 50;

export const userBodySchema = z.object({
  username: z.string().max(MAX_USERNAME),
  password: z.string().max(MAX_PASSWORD),
});

export type UserBody = z.infer<typeof userBodySchema>;

export interface User {
  id: number;
  ip: string;
  user_agent: string;
  username: string;
  password: string;
  time: string;
}
