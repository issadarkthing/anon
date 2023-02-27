import { z } from "zod";

const MAX_STRING = 1024;

export const messageSchema = z.object({
  message: z.string().max(MAX_STRING),
});

export const replySchema = z.object({
  reply: z.string().max(10 * MAX_STRING),
});

export type Message = z.infer<typeof messageSchema>;
export type Reply = z.infer<typeof replySchema>;
