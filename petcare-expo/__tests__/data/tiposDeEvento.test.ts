import { CatalogoMedico } from "../../src/data/catalogoMedico";

test("un tipo general cubierto por un servicio no se repite", () => {
  const tipos = CatalogoMedico.tiposDeEvento(["Chequeo médico integral", "Cirugía 24hs", "Cardiología"]);
  expect(tipos).toContain("Cirugía 24hs");
  expect(tipos).not.toContain("Cirugía");
  expect(tipos).toEqual(expect.arrayContaining(["Consulta", "Control", "Vacuna", "Otro"]));
});

test("sin el servicio, el tipo general sigue disponible", () => {
  expect(CatalogoMedico.tiposDeEvento(["Chequeo médico integral"])).toContain("Cirugía");
});

test("el tipo de un turno que se edita está siempre, aunque esté cubierto", () => {
  expect(CatalogoMedico.tiposDeEvento(["Cirugía 24hs"], "Cirugía")).toContain("Cirugía");
});
