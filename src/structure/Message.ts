import { z } from "zod";

const MAX_STRING = 1024;

export const messageSchema = z.object({
  time: z.string().max(MAX_STRING).datetime(),
  message: z.string().max(MAX_STRING),
});

export type Message = z.infer<typeof messageSchema>;
