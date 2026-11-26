import { describe, expect, it } from "vitest";
import { BOTS_ENGINE_VERSION } from "./index";

describe("bots placeholder", () => {
  it("resolves the engine through the workspace", () => {
    expect(BOTS_ENGINE_VERSION).toBe("0.0.0");
  });
});
