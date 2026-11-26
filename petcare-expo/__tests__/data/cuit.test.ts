import { esCuitValido } from "../../src/ui/auth/validaciones";

test("valida el dígito verificador del CUIT, con o sin guiones", () => {
  expect(esCuitValido("20-12345678-6")).toBe(true);
  expect(esCuitValido("20123456786")).toBe(true);
  expect(esCuitValido("20-12345678-5")).toBe(false);
  expect(esCuitValido("2012345678")).toBe(false);
  expect(esCuitValido("")).toBe(false);
});
