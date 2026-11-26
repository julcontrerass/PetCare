import { aBase64 } from "../../src/util/base64";

test("codifica igual que Buffer, con y sin relleno", () => {
  for (const texto of ["", "a", "ab", "abc", "abcd", "Hola PetCare ñ"]) {
    const bytes = new TextEncoder().encode(texto);
    expect(aBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  }
  const azar = Uint8Array.from({ length: 300 }, (_, i) => (i * 37 + 11) % 256);
  expect(aBase64(azar)).toBe(Buffer.from(azar).toString("base64"));
});
