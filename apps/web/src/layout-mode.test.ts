import { describe, expect, it } from "vitest";
import { isPhone, PHONE_QUERY } from "./layout-mode";

describe("phone layout rule (#79)", () => {
  it("portrait phones, common and small", () => {
    expect(isPhone(390, 844)).toBe(true);
    expect(isPhone(360, 740)).toBe(true);
  });

  it("landscape phones, which used to get the desktop layout", () => {
    expect(isPhone(844, 390)).toBe(true);
    expect(isPhone(740, 360)).toBe(true);
    expect(isPhone(932, 430)).toBe(true);
  });

  it("tablets and desktops are not phones, even in a short window", () => {
    expect(isPhone(820, 1180)).toBe(false);
    expect(isPhone(1180, 820)).toBe(false);
    expect(isPhone(1280, 800)).toBe(false);
    expect(isPhone(1280, 480)).toBe(false);
  });

  it("the boundaries: 639 wide is a phone, 640 is not (unless short and landscape)", () => {
    expect(isPhone(639, 1000)).toBe(true);
    expect(isPhone(640, 1000)).toBe(false);
    expect(isPhone(900, 500)).toBe(true);
    expect(isPhone(900, 501)).toBe(false);
  });

  it("the CSS query names the same conditions as the function", () => {
    expect(PHONE_QUERY).toContain("max-width: 639px");
    expect(PHONE_QUERY).toContain("max-height: 500px");
    expect(PHONE_QUERY).toContain("max-width: 950px");
  });
});
