/* Las rutas de src/app/dueno que monta el grupo B: parámetros de la ruta y pantallas de humo. */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { LocalDate } from "../../../src/util/tiempo";
import { Avisos } from "../../../src/ui/common/Avisos";
import Carnet from "../../../src/app/dueno/carnet";
import EditarEvento from "../../../src/app/dueno/(tabs)/evento/[id]";
import EventoNuevo from "../../../src/app/dueno/(tabs)/evento-nuevo";
import Perfil from "../../../src/app/dueno/(tabs)/perfil";
import PerfilEditar from "../../../src/app/dueno/(tabs)/perfil-editar";
import Solicitudes from "../../../src/app/dueno/(tabs)/solicitudes";
import Veterinarios from "../../../src/app/dueno/(tabs)/veterinarios";
import { Escenario, accesoDto, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { ingresarComoDueno, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { enrutador, fijarRuta } from "../../soporte/rutas";

let fuente: FuenteEnMemoria;

beforeEach(async () => {
  fuente = prepararServicios();
  Avisos.reiniciar();
  fuente.perfiles.push(Escenario.dueno(), Escenario.veterinario());
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"));
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));
  await ingresarComoDueno();
});
afterEach(() => {
  Avisos.reiniciar();
  limpiarServicios();
});

describe("rutas del dueño (parte B)", () => {
  it("evento-nuevo toma la fecha y la mascota de los parámetros", async () => {
    fijarRuta({ fecha: LocalDate.now().plusDays(3).toString(), mascota: "Rex" });
    await render(<EventoNuevo />);
    await fireEvent.press(screen.getByRole("button", { name: "Chequeo médico integral" }));
    await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));
    // La mascota ya estaba elegida: se pasó al paso 2 sin avisar nada
    expect(screen.getByText("Paso 2 de 3 · Veterinario, fecha y hora")).toBeTruthy();
  });

  it("evento-nuevo con una fecha mal escrita arranca hoy", async () => {
    fijarRuta({ fecha: "no-es-una-fecha" });
    await render(<EventoNuevo />);
    expect(screen.getByText("Nuevo evento")).toBeTruthy();
  });

  it("evento/[id] edita el turno con ese id", async () => {
    fuente.turnosGuardados.push(Escenario.turno("t9", "m1", LocalDate.now().plusDays(5).toString(), "10:00:00"));
    await ingresarComoDueno();
    fijarRuta({ id: "t9" });
    await render(<EditarEvento />);
    expect(screen.getByText("Editar turno")).toBeTruthy();
    expect(screen.getByText(/Turno actual de Rex/)).toBeTruthy();
  });

  it("evento/[id] de un turno que no existe lo avisa y ofrece volver al calendario", async () => {
    fijarRuta({ id: "no-existe" });
    await render(<EditarEvento />);
    expect(screen.getByText("No encontramos el turno")).toBeTruthy();
    await fireEvent.press(screen.getByText("Ir al calendario"));
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/calendario");
  });

  it.each([
    ["perfil", Perfil, "Mi Perfil"],
    ["perfil-editar", PerfilEditar, "Editar perfil"],
    ["veterinarios", Veterinarios, "Veterinarios"],
    ["solicitudes", Solicitudes, "Solicitudes de acceso"],
    ["carnet", Carnet, "Salud"],
  ])("%s monta su pantalla", async (_nombre, Pantalla, titulo) => {
    fijarRuta();
    await render(<Pantalla />);
    await act(async () => {});
    expect(screen.getByText(titulo)).toBeTruthy();
  });
});
