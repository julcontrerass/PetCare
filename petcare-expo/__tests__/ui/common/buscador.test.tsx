import { fireEvent, render, screen } from "@testing-library/react-native";
import { coincide, sinAcentos } from "../../../src/ui/common/Buscador";
import { CampoSeleccion } from "../../../src/ui/veterinario/ElementosVet";

test("busca sin importar acentos ni mayúsculas", () => {
  expect(sinAcentos("Cardiología")).toBe("cardiologia");
  expect(coincide("Cirugía 24hs", "CIRUGIA")).toBe(true);
  expect(coincide("Cardiología", "cardio")).toBe(true);
  expect(coincide("Dermatología", "cardio")).toBe(false);
  expect(coincide("Lo que sea", "  ")).toBe(true);
});

test("el selector con buscador filtra las opciones y elige la correcta", async () => {
  const opciones = ["Consulta", "Cardiología", "Cirugía 24hs", "Vacuna"];
  const alElegir = jest.fn();
  await render(<CampoSeleccion titulo="Tipo de evento" opciones={opciones} indice={0} alElegir={alElegir} buscador="Buscar tipo de evento" />);
  await fireEvent.press(screen.getByLabelText("Tipo de evento: Consulta"));
  await fireEvent.changeText(screen.getByLabelText("Buscar tipo de evento"), "cirugia");
  expect(screen.queryByText("Vacuna")).toBeNull();
  expect(screen.queryByText("Cardiología")).toBeNull();
  await fireEvent.press(screen.getByText("Cirugía 24hs"));
  // Devuelve el índice en la lista completa, no en la filtrada
  expect(alElegir).toHaveBeenCalledWith(2);
});

test("sin resultados lo dice", async () => {
  await render(<CampoSeleccion titulo="Servicio" opciones={["Consulta"]} indice={0} alElegir={() => {}} buscador="Buscar servicio" />);
  await fireEvent.press(screen.getByLabelText("Servicio: Consulta"));
  await fireEvent.changeText(screen.getByLabelText("Buscar servicio"), "xyz");
  expect(screen.getByText("No encontramos nada con ese nombre.")).toBeTruthy();
});
