import { describe, expect, it } from "vitest";
import { AiSignal } from "./mockSignalEngine";
import { createLifecycleRecord, evaluateLifecycleUpdate } from "./signalLifecycle";

describe("Signal Lifecycle State Machine", () => {
  const sampleSignal: AiSignal = {
    id: "test-signal-1",
    decision: "TRADE_CANDIDATE",
    bias: "BULLISH",
    confidence: 80,
    quality: 75,
    underlying: "NIFTY",
    strike: 24500,
    optionType: "CE",
    entry: 100,
    stopLoss: 70,
    target1: 130,
    target2: 160,
    supportingFactors: ["Bullish momentum"],
    conflictingFactors: [],
    reasoning: "Test signal reasoning",
    timestamp: new Date().toISOString(),
    snapshotRef: "mock-snap-0001",
    disclaimer: "Mock test",
  };

  it("should initialize lifecycle record in CREATED state for trade candidates", () => {
    const record = createLifecycleRecord(sampleSignal);
    expect(record.currentState).toBe("CREATED");
    expect(record.history.length).toBe(1);
  });

  it("should transition to CONFIRMED when price is within entry zone", () => {
    const record = createLifecycleRecord(sampleSignal);
    const { record: updated, stateChanged } = evaluateLifecycleUpdate(record, 101, 24500);
    expect(stateChanged).toBe(true);
    expect(updated.currentState).toBe("CONFIRMED");
  });

  it("should transition to TARGET1_HIT when price breaches target1", () => {
    const record = createLifecycleRecord(sampleSignal);
    const { record: step1 } = evaluateLifecycleUpdate(record, 100, 24500);
    const { record: step2, stateChanged } = evaluateLifecycleUpdate(step1, 132, 24550);
    expect(stateChanged).toBe(true);
    expect(step2.currentState).toBe("TARGET1_HIT");
  });

  it("should transition to STOP_LOSS_HIT when price drops to stopLoss", () => {
    const record = createLifecycleRecord(sampleSignal);
    const { record: updated, stateChanged } = evaluateLifecycleUpdate(record, 68, 24400);
    expect(stateChanged).toBe(true);
    expect(updated.currentState).toBe("STOP_LOSS_HIT");
  });

  it("should remain unchanged in terminal state", () => {
    const record = createLifecycleRecord(sampleSignal);
    const { record: stopped } = evaluateLifecycleUpdate(record, 65, 24400);
    const { record: terminalCheck, stateChanged } = evaluateLifecycleUpdate(stopped, 120, 24500);
    expect(stateChanged).toBe(false);
    expect(terminalCheck.currentState).toBe("STOP_LOSS_HIT");
  });
});
