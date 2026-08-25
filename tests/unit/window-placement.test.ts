import { describe, expect, it } from "vitest";
import { recoverWindowPosition } from "../../src/main/window-placement";

describe("recoverWindowPosition", () => {
  it("preserves a window position that is still on a connected display", () => {
    expect(
      recoverWindowPosition({ x: 2376, y: 604, width: 1440, height: 900 }, [
        { x: 0, y: 0, width: 1920, height: 1040 },
        { x: 1920, y: 0, width: 1920, height: 1040 },
      ]),
    ).toEqual({ x: 2376, y: 604 });
  });

  it("centers a window whose saved position is on a disconnected display", () => {
    expect(
      recoverWindowPosition({ x: 2376, y: 604, width: 1440, height: 900 }, [
        { x: 0, y: 0, width: 1920, height: 1040 },
      ]),
    ).toEqual({ x: 240, y: 70 });
  });

  it("anchors an oversized window to the primary work area", () => {
    expect(
      recoverWindowPosition({ x: 2400, y: 100, width: 1440, height: 900 }, [
        { x: 0, y: 0, width: 1280, height: 720 },
      ]),
    ).toEqual({ x: 0, y: 0 });
  });
});
