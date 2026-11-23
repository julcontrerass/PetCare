/* ChipEstadoMascota, SelectorFechaNacimiento, FotoVet y BajaDeCuenta. */
import { fuente, ingresarComoDueno, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { DuenoRepo } from "../../src/data/repositorio/duenoRepo";
import { PerfilVetRepo } from "../../src/data/repositorio/perfilVetRepo";
import { Avisos } from "../../src/ui/common/Avisos";
import { BajaDeCuenta } from "../../src/ui/common/BajaDeCuenta";
import { ChipEstadoMascota, SelectorFechaNacimiento } from "../../src/ui/common/ComponentesDueno";
import { FotoVet } from "../../src/ui/common/VetUi";
import { Sesion } from "../../src/data/sesion";
import { mascotaDto } from "../soporte/fuenteEnMemoria";

beforeEach(() => {
  prepararServicios();
  Avisos.reiniciar();
});
afterEach(() => {
  Avisos.reiniciar();
  limpiarServicios();
});

/** Entra como dueño con una mascota (Toby, activa y sin turnos). */
async function ingresarConMascota(estado = "activa"): Promise<string> {
  const fuenteActual = fuente();
  fuenteActual.mascotas.push(mascotaDto({ id: "m-toby", dueno_id: fuenteActual.yo.id, nombre: "Toby", tipo: "Perro", estado, activa: true }));
  await ingresarComoDueno();
  return "Toby";
}

describe("ChipEstadoMascota", () => {
  it("muestra 'Al día' si no hay vacuna pendiente", async () => {
    const nombre = await ingresarConMascota();
    expect(DuenoRepo.tieneVacunaPendiente(nombre)).toBe(false);
    await render(<ChipEstadoMascota nombreMascota={nombre} />);
    expect(screen.getByText("Al día")).toBeTruthy();
  });

  it("una mascota inactiva muestra su estado", async () => {
    const nombre = await ingresarConMascota("fallecida");
    expect(DuenoRepo.buscarMascota(nombre)?.estado).toBe("FALLECIDA");
    await render(<ChipEstadoMascota nombreMascota={nombre} />);
    expect(screen.getByText("Fallecida")).toBeTruthy();
  });
});

describe("SelectorFechaNacimiento", () => {
  it("se abre con el título y la aclaración de fechas futuras", async () => {
    await render(<SelectorFechaNacimiento visible alElegir={() => {}} alCerrar={() => {}} />);
    expect(screen.getByText("Fecha de nacimiento")).toBeTruthy();
    expect(screen.getByText("No podés seleccionar una fecha de nacimiento futura")).toBeTruthy();
  });
});

describe("FotoVet", () => {
  it("muestra la inicial del veterinario en sesión", async () => {
    await ingresarComoVeterinario();
    await render(<FotoVet tamano={48} />);
    expect(PerfilVetRepo.nombre).not.toBe("");
    expect(screen.getByText(PerfilVetRepo.nombre.trim().charAt(0).toUpperCase())).toBeTruthy();
  });
});

describe("BajaDeCuenta", () => {
  it("pide confirmación con el texto del Kotlin y al aceptar elimina la cuenta y vuelve al ingreso", async () => {
    await ingresarComoDueno();
    const volver = jest.spyOn(Sesion, "volverAlIngreso").mockImplementation(() => {});
    BajaDeCuenta.confirmar();
    const cartel = Avisos.estado.carteles[0];
    expect(cartel.titulo).toBe("¿Eliminar tu cuenta?");
    expect(cartel.textoAceptar).toBe("Eliminar cuenta");
    expect(cartel.textoCancelar).toBe("Cancelar");
    expect(cartel.mensaje).toContain("Esta acción no se puede deshacer.");

    await act(async () => {
      Avisos.cerrarCartel(cartel.id, true);
    });
    expect(fuente().llamadas).toContain("eliminarCuenta");
    expect(Avisos.estado.banner?.mensaje).toBe("Tu cuenta fue eliminada");
    expect(volver).toHaveBeenCalled();
  });
});
