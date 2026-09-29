import { assert, it } from "@effect/vitest";
import {
  ProviderInstanceId,
  ProviderSessionId,
  ProviderThreadId,
  ThreadId,
  type OrchestrationV2ProviderThread,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { describe } from "vite-plus/test";

import { OPENCODE_PROVIDER } from "./OpenCodeAdapterV2.ts";
import { openCode2ReplayRuntime } from "./OpenCode2AdapterV2.testkit.ts";

const SESSION = "ses_f148cdfa1ffeIFwbC0FCx0fKpk";
const threadId = ThreadId.make("thread:opencode2-snapshot");
const instanceId = ProviderInstanceId.make("opencode");

// The history the spike read back after its `simple` turn (recordings/simple.ndjson).
const history = {
  data: [
    {
      id: "msg_0eb732081001RntUJfRtTXOAjd",
      time: { created: 1790656585885 },
      text: "Think carefully step by step about whether 391 is prime, showing your reasoning, then answer in one short sentence.",
      type: "user",
    },
    {
      id: "msg_0eb7320a9001vve3OV5uNi2HRT",
      time: { created: 1790656585925, streamed: 1790656590719, completed: 1790656590736 },
      type: "assistant",
      agent: "build",
      model: { id: "space-bunny-free", providerID: "opencode", variant: "high" },
      content: [
        { type: "reasoning", text: "Check divisibility up to sqrt(391)." },
        { type: "text", text: "391 is not prime: it's the product 17 × 23." },
      ],
      finish: "stop",
      cost: 0,
      tokens: { input: 8701, output: 113, reasoning: 147, cache: { read: 489, write: 0 } },
    },
    {
      id: "msg_0eb733399001NhwTrB32UU6d6H",
      time: { created: 1790656590745 },
      type: "idle",
      outcome: "succeeded",
    },
  ],
  cursor: {},
};

describe("OpenCode2 adapter history snapshot", () => {
  it.effect("reads user and assistant text from the session's message list", () =>
    Effect.gen(function* () {
      const runtime = yield* openCode2ReplayRuntime([
        { type: "expect_outbound", frame: { type: "event.subscribe" } },
        { type: "expect_outbound", frame: { type: "model.list", input: "<any>" } },
        {
          type: "emit_inbound",
          frame: {
            type: "sdk.response",
            operation: "model.list",
            data: { location: { directory: "<work>" }, data: [] },
          },
        },
        {
          type: "expect_outbound",
          frame: {
            type: "message.list",
            input: { sessionID: SESSION, order: "asc", limit: "100" },
          },
        },
        {
          type: "emit_inbound",
          frame: { type: "sdk.response", operation: "message.list", data: history },
        },
      ]);
      const now = yield* DateTime.now;
      const providerThread: OrchestrationV2ProviderThread = {
        id: ProviderThreadId.make("provider-thread:opencode2-snapshot"),
        driver: OPENCODE_PROVIDER,
        providerInstanceId: instanceId,
        providerSessionId: ProviderSessionId.make("provider-session:opencode2-snapshot"),
        appThreadId: threadId,
        ownerNodeId: null,
        nativeThreadRef: { driver: OPENCODE_PROVIDER, nativeId: SESSION, strength: "strong" },
        nativeConversationHeadRef: null,
        status: "idle",
        firstRunOrdinal: null,
        lastRunOrdinal: null,
        handoffIds: [],
        forkedFrom: null,
        createdAt: now,
        updatedAt: now,
      };

      const snapshot = yield* runtime.readThreadSnapshot({ providerThread });

      assert.deepEqual(
        snapshot.messages.map((message) => [message.role, message.text]),
        [
          ["user", history.data[0]!.text],
          ["assistant", "391 is not prime: it's the product 17 × 23."],
        ],
      );
      assert.equal(
        snapshot.providerThread.nativeConversationHeadRef?.nativeId,
        history.data[0]!.id,
      );
    }).pipe(Effect.scoped),
  );
});
