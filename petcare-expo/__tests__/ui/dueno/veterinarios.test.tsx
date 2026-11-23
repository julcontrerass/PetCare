/*
 * Pruebas de VeterinariosPantalla y SolicitudesPantalla (dueno_veterinariosMuestraHastaCuandoValeElPermiso de
 * NuevasPantallasTest.kt y permisos_* de NuevasFuncionesTest.kt, vistos desde la pantalla).
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { LocalDate } from "../../../src/util/tiempo";
import { Fechas } from "../../../src/util/fechas";
import { Avisos } from "../../../src/ui/common/Avisos";
import { AvisosHost } from "../../../src/ui/common/AvisosHost";
import SolicitudesPantalla from "../../../src/ui/dueno/SolicitudesPantalla";
import VeterinariosPantalla from "../../../src/ui/dueno/VeterinariosPantalla";
import { Escenario, accesoDto, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { ingresarComoDueno, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { enrutador, fijarRuta } from "../../soporte/rutas";

let fuente: FuenteEnMemoria;
const hoy = LocalDate.now();

function escenario() {
  fuente.perfiles.push(Escenario.dueno(), Escenario.veterinario());
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"), Escenario.mascota("m2", "Mia", Escenario.DUENO_ID, "Gato"));
}

const mostrar = async (pantalla: React.ReactElement) => {
  fijarRuta();
  await render(
    <>
      {pantalla}
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
});

describe("VeterinariosPantalla", () => {
  it("lista los veterinarios con acceso, sus mascotas y el contador", async () => {
    fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"), accesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"));
    await ingresarComoDueno();
    await mostrar(<VeterinariosPantalla />);

    expect(screen.getByText("Veterinarios")).toBeTruthy();
    expect(screen.getByText("1 con acceso a tus mascotas")).toBeTruthy();
    expect(screen.getByText("Dr. Vera")).toBeTruthy();
    expect(screen.getAllByText("Con acceso")).toHaveLength(2); // el chip del filtro y el estado
    expect(screen.getByText("Puede ver la ficha de")).toBeTruthy();
    expect(screen.getByText("Los veterinarios con un turno tuyo ven la ficha de tu mascota automáticamente. No hace falta autorizarlos.")).toBeTruthy();
    expect(screen.getByText("Revocar acceso")).toBeTruthy();
    expect(screen.getByText("Sin turnos próximos")).toBeTruthy();
  });

  it("muestra hasta cuándo vale el permiso y deja cambiar el vencimiento", async () => {
    const hasta = hoy.plusMonths(2);
    fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno", hasta.toString()));
    await ingresarComoDueno();
    await mostrar(<VeterinariosPantalla />);

    expect(screen.getByText(`Con acceso hasta ${Fechas.corta(hasta)}`)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Cambiar vencimiento" }));
    expect(screen.getByText("Vencimiento del permiso")).toBeTruthy();
    expect(screen.getByText("Elegir una fecha…")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Sin vencimiento" }));

    await waitFor(() => expect(fuente.llamadas.some((l) => l.startsWith("vence:") && l.endsWith("=null"))).toBe(true));
    expect(screen.getByText("El permiso ya no vence")).toBeTruthy();
    expect(screen.queryByText(/Con acceso hasta/)).toBeNull();
  });

  it("revocar pide confirmación y deja al veterinario sin acceso; restablecer pregunta por cuánto tiempo", async () => {
    fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));
    await ingresarComoDueno();
    await mostrar(<VeterinariosPantalla />);

    await fireEvent.press(screen.getByRole("button", { name: "Revocar acceso" }));
    expect(screen.getByText("Dr. Vera dejará de ver las fichas de tus mascotas hasta que agendes un nuevo turno.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Revocar"));
    expect(screen.getByText("Se revocó la autorización de Dr. Vera")).toBeTruthy();
    await waitFor(() => expect(fuente.llamadas.some((l) => l.startsWith("accesosDe:") || l.startsWith("acceso:"))).toBe(true));
    expect(screen.getAllByText("Sin acceso")).toHaveLength(2);

    await fireEvent.press(screen.getByRole("button", { name: "Restablecer acceso" }));
    expect(screen.getByText("¿Por cuánto tiempo?")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Sin vencimiento" }));
    expect(screen.getByText("Veterinario Dr. Vera autorizado correctamente")).toBeTruthy();
    expect(screen.getAllByText("Con acceso")).toHaveLength(2);
  });

  it("el filtro y el buscador achican la lista", async () => {
    fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));
    await ingresarComoDueno();
    await mostrar(<VeterinariosPantalla />);

    await fireEvent.press(screen.getByRole("button", { name: "Sin acceso" }));
    expect(screen.getByText("No se encontraron veterinarios")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Todos" }));
    await fireEvent.changeText(screen.getByPlaceholderText("Buscar por nombre, usuario, mail o matrícula…"), "zzz");
    expect(screen.getByText("No se encontraron veterinarios")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Buscar por nombre, usuario, mail o matrícula…"), "MP-100");
    expect(screen.getByText("Dr. Vera")).toBeTruthy();
  });

  it("autoriza a un veterinario nuevo del catálogo con vencimiento", async () => {
    await ingresarComoDueno();
    await mostrar(<VeterinariosPantalla />);

    await fireEvent.press(screen.getByRole("button", { name: "Autorizar nuevo veterinario" }));
    expect(screen.getByText("Buscá por usuario, mail o matrícula para autorizar a un veterinario:")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Autorizar" }));
    await fireEvent.press(screen.getByRole("button", { name: /^1 mes/ }));

    await waitFor(() => expect(fuente.llamadas.some((l) => l.startsWith(`compartir:2:${Escenario.VET_ID}:`))).toBe(true));
    expect(screen.getByText("Veterinario Dr. Vera autorizado correctamente")).toBeTruthy();
  });

  it("el historial de permisos avisa si todavía no hay movimientos", async () => {
    await ingresarComoDueno();
    await mostrar(<VeterinariosPantalla />);

    await fireEvent.press(screen.getByRole("button", { name: "Historial de permisos" }));
    await waitFor(() => expect(screen.getByText("Todavía no hay movimientos")).toBeTruthy());
  });

  it("Volver lleva al inicio", async () => {
    await ingresarComoDueno();
    await mostrar(<VeterinariosPantalla />);
    await fireEvent.press(screen.getByRole("button", { name: "Volver atrás" }));
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno");
  });
});

describe("SolicitudesPantalla", () => {
  it("sin solicitudes muestra el estado vacío", async () => {
    await ingresarComoDueno();
    await mostrar(<SolicitudesPantalla />);

    expect(screen.getByText("Solicitudes de acceso")).toBeTruthy();
    expect(screen.getByText("Sin solicitudes pendientes")).toBeTruthy();
    expect(screen.getByText("No hay solicitudes")).toBeTruthy();
    expect(screen.getByText("Los veterinarios con turno tuyo ya ven la ficha de tu mascota sin pedir permiso")).toBeTruthy();
  });

  it("acepta y rechaza las solicitudes de los veterinarios", async () => {
    fuente.accesosGuardados.push(
      accesoDto("s1", "m1", Escenario.VET_ID, "pendiente", "veterinario"),
      accesoDto("s2", "m2", Escenario.VET_ID, "pendiente", "veterinario"),
    );
    await ingresarComoDueno();
    await mostrar(<SolicitudesPantalla />);

    expect(screen.getByText("2 pendientes")).toBeTruthy();
    expect(screen.getByText("Solicita acceso a Rex")).toBeTruthy();
    await fireEvent.press(screen.getAllByRole("button", { name: "Aceptar" })[0]);
    expect(screen.getByText("Dr. Vera fue autorizado/a")).toBeTruthy();
    await waitFor(() => expect(fuente.llamadas).toContain("acceso:s1=activo"));
    await waitFor(() => expect(screen.getByText("1 pendiente")).toBeTruthy());

    await fireEvent.press(screen.getByRole("button", { name: "Rechazar" }));
    expect(screen.getByText("Solicitud rechazada")).toBeTruthy();
    await waitFor(() => expect(fuente.llamadas).toContain("acceso:s2=rechazado"));
    await waitFor(() => expect(screen.getByText("Sin solicitudes pendientes")).toBeTruthy());
  });
});
