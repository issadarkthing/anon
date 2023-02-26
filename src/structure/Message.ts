import { z } from "zod";

const MAX_STRING = 1024;

export const messageSchema = z.object({
  ip: z.string().max(MAX_STRING).optional(),
  userAgent: z.string().max(MAX_STRING).optional(),
  time: z.string().max(MAX_STRING).datetime(),
  message: z.string().max(MAX_STRING),
});

export type Message = z.infer<typeof messageSchema>;
