/* Pantallas de co-dueños: invitación en el Inicio, hoja de dueños y lo que no ve un co-dueño en la ficha. */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Escenario, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { fijarRuta } from "../../soporte/rutas";
import { ingresarComo, ingresarComoDueno, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { DuenoRepo } from "../../../src/data/repositorio/duenoRepo";
import { Sesion } from "../../../src/data/sesion";
import { Avisos } from "../../../src/ui/common/Avisos";
import { DetalleMascotaPantalla } from "../../../src/ui/dueno/DetalleMascotaPantalla";
import { DuenosMascotaHoja } from "../../../src/ui/dueno/DuenosMascotaHoja";
import { InvitacionesCodueno } from "../../../src/ui/dueno/InvitacionesCodueno";

const PAREJA = Escenario.perfil("dueno-2", "dueno", "Bruno Pareja", { dni: "31222333" });
let fuente: FuenteEnMemoria;

beforeEach(() => {
  fuente = prepararServicios();
  fijarRuta();
  Avisos.reiniciar();
  fuente.perfiles.push(PAREJA, Escenario.dueno());
  fuente.mascotas.push(Escenario.mascota("m-luna", "Luna"));
});
afterEach(() => limpiarServicios());

async function parejaConInvitacion() {
  fuente.coduenos.push({ id: "cod-1", mascota_id: "m-luna", usuario_id: PAREJA.id, invitado_por: Escenario.DUENO_ID, estado: "pendiente" });
  Sesion.olvidar();
  await ingresarComo(PAREJA);
}

describe("InvitacionesCodueno", () => {
  it("no muestra nada sin invitaciones", async () => {
    await ingresarComoDueno();
    await render(<InvitacionesCodueno />);
    expect(screen.queryByText(/te invitó/)).toBeNull();
  });

  it("muestra quién invita y al aceptar suma la mascota", async () => {
    await parejaConInvitacion();
    await render(<InvitacionesCodueno />);
    expect(screen.getByText("Ana Prueba te invitó a ser dueño/a de Luna")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Aceptar" }));
    await waitFor(() => expect(DuenoRepo.mascotas.map((m) => m.nombre)).toEqual(["Luna"]));
    expect(fuente.llamadas).toContain("responderInvitacion:cod-1=true");
  });
});

describe("DuenosMascotaHoja", () => {
  it("lista al dueño original e invita por DNI o correo", async () => {
    await ingresarComoDueno();
    const luna = DuenoRepo.mascotas[0];
    await render(<DuenosMascotaHoja mascota={luna} alCerrar={() => {}} alSalir={() => {}} />);
    await waitFor(() => expect(screen.getByText("Ana Prueba (vos)")).toBeTruthy());
    expect(screen.getByText("Dueño original")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Enviar invitación" }));
    expect(screen.getByText("Ingresá el DNI o el correo de la otra persona")).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("DNI o correo de la persona a invitar"), "31222333");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar invitación" }));
    await waitFor(() => expect(screen.getByText("Bruno Pareja")).toBeTruthy());
    expect(screen.getByText("Invitación pendiente")).toBeTruthy();
    expect(fuente.llamadas).toContain("invitarCodueno:m-luna:31222333");
  });

  it("muestra el error del servidor debajo del campo", async () => {
    await ingresarComoDueno();
    await render(<DuenosMascotaHoja mascota={DuenoRepo.mascotas[0]} alCerrar={() => {}} alSalir={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText("DNI o correo de la persona a invitar"), "nadie@prueba.test");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar invitación" }));
    await waitFor(() => expect(screen.getByText(/No encontramos una cuenta/)).toBeTruthy());
  });
});

describe("Ficha de una mascota compartida", () => {
  it("el co-dueño no ve las opciones de eliminarla", async () => {
    await parejaConInvitacion();
    await act(async () => DuenoRepo.responderInvitacion(DuenoRepo.invitaciones[0], true));
    const luna = DuenoRepo.mascotas[0];
    expect(luna.compartida).toBe(true);
    await render(<DetalleMascotaPantalla mascota={luna} />);
    expect(screen.queryByText("Dar de baja a la mascota")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Más opciones"));
    expect(screen.getByText("Dueños de la mascota")).toBeTruthy();
    expect(screen.queryByText("Eliminar mascota")).toBeNull();
  });

  it("el dueño original sí las ve", async () => {
    await ingresarComoDueno();
    await render(<DetalleMascotaPantalla mascota={DuenoRepo.mascotas[0]} />);
    expect(screen.getByText("Dar de baja a la mascota")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Más opciones"));
    expect(screen.getByText("Eliminar mascota")).toBeTruthy();
  });
});
