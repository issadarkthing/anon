import { z } from "zod";

const MAX_STRING = 256;

export const messageBodySchema = z.object({
  message: z.string().max(MAX_STRING),
});

export const replyBodySchema = z.object({
  reply: z.string().max(10 * MAX_STRING),
});

export type MessageBody = z.infer<typeof messageBodySchema>;
export type ReplyBody = z.infer<typeof replyBodySchema>;
