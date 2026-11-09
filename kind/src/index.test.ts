import { describe, expect, test } from "vitest";
import { kind } from "./index";

const parse = (params: unknown) => kind.parseInitializationParams(params);

describe("templates written by earlier versions of the kind", () => {
  test("a defaultBlockLabel key is ignored, not rejected", () => {
    const parsed = parse({
      inflation: 1.5,
      defaultBlockLabel: "Beta CDR3 aa + V gene, inflation:1.5",
      customBlockLabel: "My clustering",
    });
    expect(parsed).toEqual({ inflation: 1.5, customBlockLabel: "My clustering" });
    expect(parsed).not.toHaveProperty("defaultBlockLabel");
  });
});
