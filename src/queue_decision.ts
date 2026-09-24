import { z } from "zod";

export const gameEvent = z.object({
  eventId: z.string().uuid(),
  playerId: z.string().min(1).max(80),
  kind: z.enum(["asset", "live_event", "moderation"]),
  text: z.string().min(1).max(2000),
  requiresReview: z.boolean().default(false),
}).strict();

export type GameEvent = z.infer<typeof gameEvent>;

export function destination(event: GameEvent): "moderation_queue" | "live_feed" {
  return event.kind === "moderation" || event.requiresReview
    ? "moderation_queue"
    : "live_feed";
}
