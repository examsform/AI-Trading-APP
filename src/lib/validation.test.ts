import { describe, expect, it } from "vitest";
import { parsePositiveInt, parseTimeframe, parseUnderlying, ValidationError } from "./validation";

describe("input validation", () => {
  it("accepts valid underlyings", () => {
    expect(parseUnderlying("NIFTY")).toBe("NIFTY");
    expect(parseUnderlying("BANKNIFTY")).toBe("BANKNIFTY");
  });

  it("rejects an invalid underlying instead of silently defaulting", () => {
    expect(() => parseUnderlying("SENSEX")).toThrow(ValidationError);
    expect(() => parseUnderlying(null)).toThrow(ValidationError);
  });

  it("defaults timeframe to 5m when absent but rejects garbage values", () => {
    expect(parseTimeframe(null)).toBe("5m");
    expect(() => parseTimeframe("3w")).toThrow(ValidationError);
  });

  it("clamps count to the configured max and rejects non-numeric input", () => {
    expect(parsePositiveInt("9999", 60, 500)).toBe(500);
    expect(parsePositiveInt(null, 60, 500)).toBe(60);
    expect(() => parsePositiveInt("abc", 60, 500)).toThrow(ValidationError);
    expect(() => parsePositiveInt("-5", 60, 500)).toThrow(ValidationError);
  });
});
