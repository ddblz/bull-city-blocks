import { describe, expect, it } from "vitest";
import { SIM_VERSIONS } from "./index";

describe("sim placeholder", () => {
  it("resolves engine and bots through the workspace", () => {
    expect(SIM_VERSIONS).toEqual({ engine: "0.0.0", bots: "0.0.0" });
  });
});
