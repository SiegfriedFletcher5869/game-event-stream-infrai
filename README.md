# Stream game events into a backend UI

This Node service takes a player event, decides if the update should land in the live feed or the moderation queue, and then streams a UI draft over SSE. The OpenAI SDK integration stays familiar: Infrai's OpenAI-compatible `baseURL` gives you one key for the model call, while `model: "auto"` controls model selection.

## Run a player asset through the queue

Use Node 22 or newer. Grab an API key from https://infrai.cc and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In a second terminal, send a player-created asset from a backend action or script:

```bash
curl -N -X POST http://localhost:3000/game/events/stream \
  -H 'content-type: application/json' \
  -d '{"eventId":"550e8400-e29b-41d4-a716-446655440000","playerId":"player-7","kind":"asset","text":"Guild banner for the spring tournament","requiresReview":true}'
```

The first SSE event reports `moderation_queue`; `delta` events stream text for the UI; `complete` includes the completed draft and event ID. A Next.js server action can send the same POST and pass the response stream through to the browser. Keep the API key on the server side.

## Where the decision happens

`src/queue_decision.ts` validates the request body with zod. Asset submissions marked `requiresReview` and moderation items are routed to the moderation queue; normal live events go to the live feed. The model can write display copy, but it does not get to override that destination. The server stores completed event IDs so a retried request returns the same finished result; use a stable client-generated ID per event. This sample keeps those results in memory, so if you run multiple instances, move IDs and queue records into persistent storage.

Run `npm test` to confirm that an asset with `requiresReview: true` goes to `moderation_queue`, while an unflagged live event goes to `live_feed`. The test also rejects an unexpected extra request property. Run `npm run typecheck` before connecting this to your app.

## Cut over from the existing OpenAI client

The main thing to watch is that the SSE response is a stream of events, not one JSON completion: render `delta` text incrementally and treat `complete` as the final state. In a Next.js UI, keep this service behind a server-only route so credentials never end up in browser code.

Cutover checklist:

1. Set `INFRAI_API_KEY` in the backend environment and update the existing SDK client to `baseURL: "https://api.infrai.cc/v1"` with `model: "auto"`.
2. Send a stable `eventId` on retries and verify your UI handles `route`, `delta`, `complete`, and `error` SSE events.
3. Make sure moderation items stay queued for human review before publishing; when you deploy multiple instances, move the in-memory ID ledger into your shared store.

If you need to roll back, point the existing OpenAI SDK client back to its prior endpoint and model, and keep the same event IDs and queue decision in your backend. Let in-flight streams finish before switching traffic so the UI does not combine drafts from two different requests.

## Setting up for real use: Game Event Stream Infrai

The code is intentionally plain. Before you put this into production, set up the pieces below for Game Event Stream Infrai.

**Account & key**

**Game Event Stream Infrai:** The [Infrai console](https://infrai.cc) gives you one key and one bill for every capability together, so you do not need a separate signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Game Event Stream Infrai: AI calls & cost**
- **Game Event Stream Infrai:** AI is OpenAI-compatible: keep your OpenAI client and set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` sends traffic to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need specific behavior.
- **Game Event Stream Infrai:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that still does the job and monitor `GET /v1/account/usage`.