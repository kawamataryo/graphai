import { GraphAI } from "@/graphai";
import { sleeperAgent, sleeperAgentDebug, nestedAgent } from "@/experimental_agents";
import { fileTestRunner } from "~/utils/runner";

import test from "node:test";
import assert from "node:assert";

test("test base", async () => {
  const result = await fileTestRunner("/graphs/test_base.yml", { sleeperAgent });
  assert.deepStrictEqual(result, {
    node1: { node1: "output" },
    node2: { node2: "output" },
    node3: { node3: "output", node1: "output", node2: "output" },
    node4: { node4: "output", node3: "output", node1: "output", node2: "output" },
    node5: { node5: "output", node4: "output", node3: "output", node1: "output", node2: "output" },
  });
});

test("test retry", async () => {
  const result = await fileTestRunner("/graphs/test_retry.yml", { sleeperAgentDebug });
  assert.deepStrictEqual(result, {
    node1: { node1: "output" },
    node2: { node2: "output" },
    node3: { node3: "output", node1: "output", node2: "output" },
    node4: { node4: "output", node3: "output", node1: "output", node2: "output" },
    node5: { node5: "output", node4: "output", node3: "output", node1: "output", node2: "output" },
  });
});

test("test error", async () => {
  const result = await fileTestRunner("/graphs/test_error.yml", { sleeperAgentDebug });
  assert.deepStrictEqual(result, {
    node1: { node1: "output" },
    node2: { node2: "output" },
  });
});

test("test timeout", async () => {
  const result = await fileTestRunner("/graphs/test_timeout.yml", { sleeperAgentDebug });
  assert.deepStrictEqual(result, {
    node1: { node1: "output" },
    node2: { node2: "output" },
    node3: { node3: "output", node1: "output", node2: "output" },
  });
});

test("test source", async () => {
  const result = await fileTestRunner("/graphs/test_source.yml", { sleeperAgent }, (graph: GraphAI) => {
    graph.injectValue("node2", { node2: "injected" });
  });
  assert.deepStrictEqual(result, {
    node1: { node1: "output" },
    node2: { node2: "injected" },
    node3: { node3: "output", node1: "output", node2: "injected" },
    node4: { node4: "output", node3: "output", node1: "output", node2: "injected" },
    node5: { node5: "output", node4: "output", node3: "output", node1: "output", node2: "injected" },
  });
});

test("test source2", async () => {
  const result = await fileTestRunner("/graphs/test_source2.yml", { sleeperAgent }, (graph: GraphAI) => {
    graph.injectValue("node1", { node1: "injected" });
  });
  assert.deepStrictEqual(result, {
    node1: { node1: "injected" },
    node2: { node2: "preset" },
    node3: { node3: "output", node1: "injected", node2: "preset" },
    node4: { node4: "output", node3: "output", node1: "injected", node2: "preset" },
    node5: { node5: "output", node4: "output", node3: "output", node1: "injected", node2: "preset" },
  });
});

test("test nested", async () => {
  const result = await fileTestRunner("/graphs/test_nested.yml", { sleeper: sleeperAgent, nested: nestedAgent });
  assert.deepStrictEqual(result, {
    outer1: { outer1: "output" },
    outer2: { inner1: "output", inner2: "output", inner3: "output", outer1: "output" },
    outer3: { outer3: "output", outer1: "output", inner1: "output", inner2: "output", inner3: "output" },
    outer4: { outer4: "output", outer3: "output", outer1: "output", inner1: "output", inner2: "output", inner3: "output" },
    outer5: { outer5: "output", outer4: "output", outer3: "output", outer1: "output", inner1: "output", inner2: "output", inner3: "output" },
  });
});
