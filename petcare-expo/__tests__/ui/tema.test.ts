jest.mock("@expo/vector-icons", () => require("./iconosFalsos"));
import { Platform } from "react-native";
import { sombra } from "../../src/ui/common/tema";

describe("sombra", () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it("usa boxShadow en la web (sin shadow* ni elevation)", () => {
    Platform.OS = "web";
    const s = sombra(2) as Record<string, unknown>;
    expect(typeof s.boxShadow).toBe("string");
    expect(s.shadowColor).toBeUndefined();
    expect(s.elevation).toBeUndefined();
  });

  it("usa elevation en Android y nada en el nivel 0", () => {
    Platform.OS = "android";
    expect(sombra(1)).toEqual({ elevation: 2 });
    expect(sombra(0)).toEqual({});
  });
});
