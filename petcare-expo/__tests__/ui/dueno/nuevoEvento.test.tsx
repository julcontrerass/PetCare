/*
 * Pruebas de NuevoEventoPantalla (dueno_editarUnTurnoUsaElAsistenteConLosHorariosDelVeterinario y
 * dueno_sacarUnTurnoMuestraLaDuracionDelServicio de PantallasTest.kt) más el flujo de tres pasos.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { DuenoRepo } from "../../../src/data/repositorio/duenoRepo";
import { LocalDate } from "../../../src/util/tiempo";
import { Avisos } from "../../../src/ui/common/Avisos";
import { AvisosHost } from "../../../src/ui/common/AvisosHost";
import NuevoEventoPantalla from "../../../src/ui/dueno/NuevoEventoPantalla";
import { Escenario, accesoDto, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { ingresarComoDueno, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { enrutador, fijarRuta } from "../../soporte/rutas";

let fuente: FuenteEnMemoria;

/** El próximo lunes (el veterinario del escenario atiende de lunes a viernes de 09:00 a 12:00). */
function proximoLunes(): LocalDate {
  let d = LocalDate.now().plusDays(1);
  while (d.dayOfWeek !== 1) d = d.plusDays(1);
  return d;
}

async function cargarEscenario() {
  fuente.perfiles.push(Escenario.dueno(), Escenario.veterinario());
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"), Escenario.mascota("m2", "Mia", Escenario.DUENO_ID, "Gato"));
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"), accesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"));
  await ingresarComoDueno();
}

const mostrar = async (props: React.ComponentProps<typeof NuevoEventoPantalla> = {}) => {
  fijarRuta();
  await render(
    <>
      <NuevoEventoPantalla {...props} />
      <AvisosHost />
    </>,
  );
};

beforeEach(() => {
  fuente = prepararServicios();
  Avisos.reiniciar();
});
afterEach(() => {
  Avisos.reiniciar();
  limpiarServicios();
});

describe("NuevoEventoPantalla", () => {
  it("arranca en el paso 1 con los servicios, las especialidades y las mascotas", async () => {
    await cargarEscenario();
    await mostrar();

    expect(screen.getByText("Nuevo evento")).toBeTruthy();
    expect(screen.getByText("Paso 1 de 3 · Tipo de evento y mascota")).toBeTruthy();
    expect(screen.getByText("¿Qué servicio o especialidad necesitás?")).toBeTruthy();
    expect(screen.getByText("Servicios")).toBeTruthy();
    expect(screen.getByText("Especialidades médicas")).toBeTruthy();
    expect(screen.getByText("Chequeo médico integral")).toBeTruthy();
    expect(screen.getByText("Rex")).toBeTruthy();
    expect(screen.getByText("Mia")).toBeTruthy();
    expect(screen.getByText("Cancelar")).toBeTruthy();
  });

  it("el buscador filtra sin importar los acentos y avisa si no hay resultados", async () => {
    await cargarEscenario();
    await mostrar();

    await fireEvent.changeText(screen.getByPlaceholderText("Buscar servicio o especialidad"), "cardiologia");
    expect(screen.getByText("Cardiología")).toBeTruthy();
    expect(screen.queryByText("Chequeo médico integral")).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText("Buscar servicio o especialidad"), "zzz");
    expect(screen.getByText("No encontramos ningún servicio con ese nombre.")).toBeTruthy();
  });

  it("sin categoría y mascota no avanza", async () => {
    await cargarEscenario();
    await mostrar();

    await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Seleccioná una categoría y una mascota")).toBeTruthy();
    expect(screen.getByText("Paso 1 de 3 · Tipo de evento y mascota")).toBeTruthy();
  });

  it("la mascota que llega por parámetro queda elegida y el paso 2 todavía no muestra la duración del turno", async () => {
    await cargarEscenario();
    await mostrar({ fecha: proximoLunes(), mascota: "Rex" });

    await fireEvent.press(screen.getByRole("button", { name: "Chequeo médico integral" }));
    await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("Paso 2 de 3 · Veterinario, fecha y hora")).toBeTruthy();
    expect(screen.getByText("Dr. Vera")).toBeTruthy();
    expect(screen.queryByText(/Este turno dura/)).toBeNull();
    expect(screen.getByText("Elegí un veterinario para ver sus horarios")).toBeTruthy();
  });

  it("agenda un turno de tres pasos y lo manda al servidor", async () => {
    await cargarEscenario();
    const lunes = proximoLunes();
    await mostrar({ fecha: lunes, mascota: "Rex" });

    await fireEvent.press(screen.getByRole("button", { name: "Chequeo médico integral" }));
    await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));

    // Sin elegir veterinario ni horario avisa
    await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Seleccioná un veterinario")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Dr. Vera" }));
    await waitFor(() => expect(screen.getByText(/Este turno dura/)).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Elegí un horario disponible")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Elegir el horario" }));
    await fireEvent.press(screen.getByRole("button", { name: "10:00" }));
    await fireEvent.changeText(screen.getByPlaceholderText("Ej: llevar el carnet de vacunación"), "  Llevar el carnet  ");
    await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("Paso 3 de 3 · Revisá y confirmá")).toBeTruthy();
    expect(screen.getByText("Llevar el carnet")).toBeTruthy();
    expect(screen.getByText(/Dr. Vera va a poder ver la ficha de Rex apenas confirmes el turno/)).toBeTruthy();
    expect(screen.getByText("Si para este turno hace falta un estudio anterior, adjuntalo y el veterinario lo va a ver.")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Guardar Evento" }));
    await waitFor(() => expect(fuente.llamadas).toContain(`crearTurno:${lunes} 10:00:00`));
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/calendario");
    expect(screen.getByText("Evento guardado")).toBeTruthy();
  });

  it("un horario ya reservado por otra persona sale tachado y no se puede elegir", async () => {
    await cargarEscenario();
    const lunes = proximoLunes();
    fuente.ocupados.push({ hora: "10:00", duracion_min: 30 });
    await mostrar({ fecha: lunes, mascota: "Rex" });
    await fireEvent.press(screen.getByRole("button", { name: "Chequeo médico integral" }));
    await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));
    await fireEvent.press(screen.getByRole("button", { name: "Dr. Vera" }));
    await act(async () => {});

    await fireEvent.press(screen.getByRole("button", { name: "Elegir el horario" }));
    await fireEvent.press(screen.getByRole("button", { name: "10:00, no disponible" }));
    expect(screen.getByText("Ese horario no está disponible")).toBeTruthy();
  });

  describe("edición", () => {
    async function editar() {
      const lunes = proximoLunes();
      fuente.turnosGuardados.push(Escenario.turno("t5", "m1", lunes.toString(), "10:00:00"));
      await cargarEscenario();
      const evento = DuenoRepo.eventos.find((e) => e.id === "t5");
      expect(evento).toBeTruthy();
      await mostrar({ edicion: evento });
      return lunes;
    }

    it("usa el asistente en el paso 2 con el turno actual y los horarios del veterinario", async () => {
      await editar();

      expect(screen.getByText("Editar turno")).toBeTruthy();
      expect(screen.getByText("Elegí otro veterinario, día u horario")).toBeTruthy();
      expect(screen.queryByText("Tipo")).toBeNull();
      expect(screen.getByText(/Turno actual de Rex/)).toBeTruthy();
      expect(screen.getByText(/de 10:00 a 10:30 hs con Dr. Vera/)).toBeTruthy();
      expect(screen.getByText("Guardar cambios")).toBeTruthy();

      // Las horas que se ofrecen son las del veterinario (09:00 a 12:00 cada 30 minutos)
      await fireEvent.press(screen.getByRole("button", { name: "Elegir el horario" }));
      for (const h of ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]) expect(screen.getByRole("button", { name: h })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "12:00" })).toBeNull();
    });

    it("sin cambios no guarda nada y con un cambio sí", async () => {
      await editar();

      await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));
      expect(screen.getByText("No hiciste ningún cambio")).toBeTruthy();
      expect(fuente.llamadas.some((l) => l.startsWith("turno:t5"))).toBe(false);

      await fireEvent.changeText(screen.getByPlaceholderText("Ej: llevar el carnet de vacunación"), "Llegamos 10 minutos antes");
      await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));

      await waitFor(() => expect(fuente.llamadas.some((l) => l.startsWith("turno:t5:") && l.includes("notas=Llegamos 10 minutos antes"))).toBe(true));
      expect(screen.getByText("Turno actualizado")).toBeTruthy();
      expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/calendario");
    });

    it("Cancelar vuelve al calendario", async () => {
      await editar();
      await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));
      expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/calendario");
    });
  });
});
