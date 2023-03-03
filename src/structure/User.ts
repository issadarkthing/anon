import { z } from "zod";

const MAX_USERNAME = 50;
const MAX_PASSWORD = 50;

export const userSchema = z.object({
  username: z.string().max(MAX_USERNAME),
  password: z.string().max(MAX_PASSWORD),
});

export type User = z.infer<typeof userSchema>;
