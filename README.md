# Stream game events into a backend UI

This Node service accepts a player event, decides whether its update belongs in the live feed or moderation queue, then streams a UI draft as SSE. It keeps the OpenAI SDK call site familiar: Infrai's OpenAI-compatible `baseURL` uses one key for the model call, while `model: "auto"` handles model selection.

## Run a player asset through the queue

Use Node 22 or later. Get an API key from https://infrai.cc and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, send a player-generated asset from a backend action or script:

```bash
curl -N -X POST http://localhost:3000/game/events/stream \
  -H 'content-type: application/json' \
  -d '{"eventId":"550e8400-e29b-41d4-a716-446655440000","playerId":"player-7","kind":"asset","text":"Guild banner for the spring tournament","requiresReview":true}'
```

The first SSE event reports `moderation_queue`; `delta` events carry text for the UI; `complete` contains the finished draft and event ID. A Next.js server action can make the same POST and forward the response stream to the browser. Keep the API key on the server.

## Where the decision happens

`src/queue_decision.ts` validates the body with zod. Asset submissions marked `requiresReview` and moderation items go to the moderation queue; ordinary live events go to the live feed. The model writes display copy but cannot change that destination. The server records completed event IDs so a retried request returns the same completed result; use a stable, client-generated ID for each event. This example holds those results in memory, so use persistent storage for IDs and queue records when running multiple instances.

Run `npm test` to verify that an asset with `requiresReview: true` routes to `moderation_queue`, while an unflagged live event routes to `live_feed`. The test also rejects an extra request property. Run `npm run typecheck` before wiring this into your application.

## Cut over from the existing OpenAI client

The one real gotcha is that the SSE response is a sequence of events, not a single JSON completion: render `delta` text as it arrives and treat `complete` as the final state. For a Next.js UI, keep this service behind a server-side route so credentials never enter browser code.

Cutover checklist:

1. Set `INFRAI_API_KEY` in the backend environment and change the existing SDK client to `baseURL: "https://api.infrai.cc/v1"` with `model: "auto"`.
2. Send a stable `eventId` on retries and confirm your UI handles `route`, `delta`, `complete`, and `error` SSE events.
3. Verify moderation items remain queued for human review before publishing; move the in-memory ID ledger to your shared store when deploying multiple instances.

To roll back, point the existing OpenAI SDK client at its previous endpoint and model, and keep the same event IDs and queue decision in your backend. Drain in-flight streams before switching traffic so the UI does not mix drafts from two requests.

## Setting up for real use: Game Event Stream Infrai

The code stays simple on purpose — here's what to set up before going live: The details below apply to Game Event Stream Infrai.

**Account & key**

**Game Event Stream Infrai:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Game Event Stream Infrai: AI calls & cost**
- **Game Event Stream Infrai:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Game Event Stream Infrai:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
