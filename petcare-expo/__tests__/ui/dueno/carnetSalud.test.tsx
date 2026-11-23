/* Pruebas de CarnetSaludPantalla (vet_carnetListaLasVacunas y dueno_cambiarLaFotoDelCarnetNoBorraLaImagenNueva). */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Imagenes } from "../../../src/data/imagenes";
import { LocalDate } from "../../../src/util/tiempo";
import { Avisos } from "../../../src/ui/common/Avisos";
import { AvisosHost } from "../../../src/ui/common/AvisosHost";
import CarnetSaludPantalla, { tipoDeImagen } from "../../../src/ui/dueno/CarnetSaludPantalla";
import { Escenario, accesoDto, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { ingresarComoDueno, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { enrutador, fijarRuta } from "../../soporte/rutas";

jest.mock("../../../src/ui/common/Selectores", () => ({
  elegirImagen: jest.fn(async () => "file:///carnet0.png"),
  elegirArchivo: jest.fn(async () => null),
}));

let fuente: FuenteEnMemoria;
const hoy = LocalDate.now();

function escenario() {
  fuente.perfiles.push(Escenario.dueno(), Escenario.veterinario());
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"), Escenario.mascota("m2", "Mia", Escenario.DUENO_ID, "Gato"));
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));
}

const mostrar = async () => {
  fijarRuta();
  await render(
    <>
      <CarnetSaludPantalla />
      <AvisosHost />
    </>,
  );
  await act(async () => {});
};

beforeEach(() => {
  fuente = prepararServicios();
  Avisos.reiniciar();
  escenario();
});
afterEach(() => {
  Avisos.reiniciar();
  limpiarServicios();
  jest.restoreAllMocks();
});

describe("CarnetSaludPantalla", () => {
  it("lista las vacunas del veterinario con su estado y cuenta las que están al día", async () => {
    fuente.registros.push({ id: "r1", mascota_id: "m1", tipo: "vacuna", titulo: "Rabia", detalle: null, fecha: hoy.toString(), proxima_dosis: hoy.plusDays(100).toString() });
    await ingresarComoVeterinario();
    await mostrar();

    expect(screen.getByText("Salud")).toBeTruthy();
    expect(screen.getByText("Rabia")).toBeTruthy();
    expect(screen.getByText("Al día")).toBeTruthy();
    expect(screen.getByText("Vacunas al día")).toBeTruthy();
  });

  it("el dueño ve sus vacunas, pestañas, filtro por mascota y estado vacío", async () => {
    fuente.registros.push(
      { id: "r1", mascota_id: "m1", tipo: "vacuna", titulo: "Rabia", fecha: hoy.minusDays(10).toString(), proxima_dosis: hoy.minusDays(1).toString() },
      { id: "r2", mascota_id: "m2", tipo: "vacuna", titulo: "Triple felina", fecha: hoy.toString(), proxima_dosis: hoy.plusDays(5).toString() },
      { id: "r3", mascota_id: "m1", tipo: "cirugia", titulo: "Castración", detalle: "Sin complicaciones", fecha: hoy.toString() },
    );
    await ingresarComoDueno();
    await mostrar();

    expect(screen.getByText("Vencida")).toBeTruthy();
    expect(screen.getByText("Próxima")).toBeTruthy();
    // Solo la mascota elegida
    await fireEvent.press(screen.getByRole("button", { name: "Mia" }));
    expect(screen.queryByText("Rabia")).toBeNull();
    expect(screen.getByText("Triple felina")).toBeTruthy();
    expect(screen.getByText("Carnet de Vacunas de Mia")).toBeTruthy();
    expect(screen.getByText("Sin foto de libreta física cargada para Mia")).toBeTruthy();
    // Otra pestaña
    await fireEvent.press(screen.getByRole("button", { name: "Todas" }));
    await fireEvent.press(screen.getByRole("tab", { name: "Cirugías" }));
    expect(screen.getByText("Castración")).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Documentos" }));
    expect(screen.getByText("No hay documentos para mostrar")).toBeTruthy();
    expect(screen.getByText("Tocá + para agregar uno")).toBeTruthy();
  });

  it("eliminar pide confirmación y borra el registro", async () => {
    fuente.registros.push({ id: "r1", mascota_id: "m1", tipo: "vacuna", titulo: "Rabia", fecha: hoy.toString(), proxima_dosis: null });
    await ingresarComoDueno();
    await mostrar();

    await fireEvent.press(screen.getByRole("button", { name: "Eliminar Rabia" }));
    expect(screen.getByText("¿Eliminar el registro?")).toBeTruthy();
    expect(screen.getByText('Se borra "Rabia" del carnet. No se puede deshacer.')).toBeTruthy();
    await fireEvent.press(screen.getByText("Eliminar"));
    await waitFor(() => expect(fuente.llamadas).toContain("eliminarRegistro:r1"));
    expect(screen.queryByText("Rabia")).toBeNull();
  });

  it("agregar una vacuna valida el título y la fecha y la manda al servidor", async () => {
    await ingresarComoDueno();
    await mostrar();

    await fireEvent.press(screen.getByRole("button", { name: "Agregar registro" }));
    expect(screen.getByText("Agregar vacuna")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Requerido")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("Vacuna (ej: Antirrábica)"), "Antirrábica");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Requerido")).toBeTruthy();

    // Elige el día de hoy en el selector
    await fireEvent.press(screen.getByRole("button", { name: "Fecha" }));
    await fireEvent.press(screen.getAllByRole("button", { name: new RegExp(`^${hoy.dayOfMonth} de `) })[0]);
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fuente.llamadas).toContain("crearRegistro:vacuna:Antirrábica"));
    expect(screen.getByText("Antirrábica")).toBeTruthy();
  });

  it("un tratamiento indicado en la consulta no se borra desde el carnet", async () => {
    fuente.informes.push({
      id: "i1", turno_id: null, mascota_id: "m1", veterinario_id: Escenario.VET_ID, diagnostico: "Otitis", tratamiento: "Gotas cada 8 hs",
      created_at: hoy.toString() + "T10:00:00+00:00",
    } as never);
    await ingresarComoDueno();
    await mostrar();

    await fireEvent.press(screen.getByRole("tab", { name: "Tratamientos" }));
    await fireEvent.press(screen.getByRole("button", { name: "Eliminar Otitis" }));
    expect(screen.getByText("Indicado en la consulta")).toBeTruthy();
    expect(fuente.llamadas.some((l) => l.startsWith("eliminarRegistro"))).toBe(false);
  });

  it("cambiar la foto del carnet no borra la imagen nueva (solo la anterior)", async () => {
    jest.spyOn(Imagenes, "bytesDe").mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]));
    await ingresarComoDueno();
    await mostrar();
    await fireEvent.press(screen.getByRole("button", { name: "Mia" }));

    for (let n = 0; n < 2; n++) {
      await fireEvent.press(screen.getByRole("button", { name: n === 0 ? "+ Cargar foto" : "Cambiar" }));
      await waitFor(() => expect(fuente.subidas.length).toBe(n + 1));
      await act(async () => {});
    }

    expect(fuente.subidas.length).toBe(2);
    expect(fuente.subidas.every((s) => s.startsWith("archivos/m2/") && s.endsWith(".png"))).toBe(true);
    expect(fuente.subidas[0]).not.toBe(fuente.subidas[1]);
    // Solo se borra el carnet anterior; el que se acaba de subir queda en el almacenamiento
    await waitFor(() => expect(fuente.borradas).toEqual([fuente.subidas[0]]));
  });

  it("sin mascota elegida pregunta de cuál es el carnet", async () => {
    await ingresarComoDueno();
    await mostrar();

    await fireEvent.press(screen.getByRole("button", { name: "+ Cargar carnet" }));
    expect(screen.getByText("¿De qué mascota es el carnet?")).toBeTruthy();
    expect(screen.getByText("Elegí la mascota y después la foto de su libreta de vacunas.")).toBeTruthy();
  });

  it("Volver vuelve a la pantalla anterior", async () => {
    await ingresarComoDueno();
    await mostrar();
    await fireEvent.press(screen.getByRole("button", { name: "Volver atrás" }));
    expect(enrutador.back).toHaveBeenCalled();
  });
});

describe("tipoDeImagen", () => {
  it("reconoce JPG, PNG y WebP por la extensión o por los primeros bytes", () => {
    expect(tipoDeImagen("file:///a.JPG", new Uint8Array(0))?.extension).toBe("jpg");
    expect(tipoDeImagen("blob:http://x/123", new Uint8Array([0x89, 0x50, 0, 0, 0]))?.mime).toBe("image/png");
    expect(tipoDeImagen("blob:http://x/123", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(tipoDeImagen("blob:http://x/1", new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))?.mime).toBe("image/webp");
    expect(tipoDeImagen("blob:http://x/1", new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});
