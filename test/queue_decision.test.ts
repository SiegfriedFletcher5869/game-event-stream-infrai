import assert from "node:assert/strict";
import { test } from "node:test";
import { destination, gameEvent } from "../src/queue_decision.ts";

test("player asset marked for review goes to the moderation queue", () => {
  const event = gameEvent.parse({
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    playerId: "player-7",
    kind: "asset",
    text: "Guild banner for the spring tournament",
    requiresReview: true,
  });
  assert.equal(destination(event), "moderation_queue");
  assert.equal(destination({ ...event, kind: "live_event", requiresReview: false }), "live_feed");
  assert.equal(destination({ ...event, kind: "moderation", requiresReview: false }), "moderation_queue");
});

test("unknown request fields are rejected", () => {
  assert.equal(gameEvent.safeParse({ eventId: "550e8400-e29b-41d4-a716-446655440000", playerId: "player-7", kind: "asset", text: "Banner", extra: true }).success, false);
});
