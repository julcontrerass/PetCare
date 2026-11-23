import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { fuente, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { PerfilVetRepo } from "../../../src/data/repositorio/perfilVetRepo";
import { PacientesRepo } from "../../../src/data/repositorio/pacientesRepo";
import { Avisos } from "../../../src/ui/common/Avisos";
import { EstadoVet } from "../../../src/ui/veterinario/estadoVet";
import NuevoDuenoPantalla from "../../../src/ui/veterinario/NuevoDuenoPantalla";
import { entrarComoVeterinario, fijarHoy, liberarHoy } from "./escenarioDetalleVet";

let recibidos: string[];
beforeEach(async () => {
  fijarHoy();
  const servidor = prepararServicios();
  fijarRuta();
  Avisos.reiniciar();
  recibidos = [];
  EstadoVet.alTerminarAltaDeDueno = (id) => recibidos.push(id);
  await entrarComoVeterinario(servidor);
});
afterEach(() => {
  EstadoVet.alTerminarAltaDeDueno = null;
  liberarHoy();
  limpiarServicios();
  Avisos.reiniciar();
});

const escribir = (etiqueta: string, texto: string) => fireEvent.changeText(screen.getByLabelText(etiqueta), texto);

async function cargarDuenoNuevo() {
  await escribir("Nombre y apellido", "Carlos Gómez");
  await escribir("DNI", "30111999");
  await escribir("Teléfono (WhatsApp)", "11 4444 3333");
  await escribir("Correo", "carlos@prueba.test");
  await escribir("Nombre de la mascota", "Toby");
}

describe("NuevoDuenoPantalla", () => {
  it("crea la cuenta y muestra los datos de acceso una sola vez; Listo devuelve la mascota", async () => {
    await render(<NuevoDuenoPantalla />);
    expect(screen.getByText("Nuevo dueño y mascota")).toBeTruthy();
    expect(screen.getByText("Crear cuenta y mascota")).toBeTruthy();
    await cargarDuenoNuevo();
    await fireEvent.press(screen.getByText("Crear cuenta y mascota"));

    await waitFor(() => expect(screen.getByText("Cuenta creada")).toBeTruthy());
    expect(fuente().ultimaCuentaPedida?.email).toBe("carlos@prueba.test");
    expect(fuente().ultimaCuentaPedida?.mascotas_nuevas[0].nombre).toBe("Toby");
    expect(screen.getByText("carlos@prueba.test")).toBeTruthy();
    expect(screen.getByText("Temp1234ab")).toBeTruthy();
    expect(screen.getByText("Esta contraseña se muestra una sola vez. El dueño tiene que cambiarla la primera vez que ingresa.")).toBeTruthy();
    expect(screen.getByText("Enviar por WhatsApp")).toBeTruthy();
    expect(enrutador.back).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Listo"));
    expect(recibidos).toEqual(["nueva-0"]);
    expect(enrutador.back).toHaveBeenCalled();
  });

  it("sin cuenta solo guarda el paciente y no crea la cuenta", async () => {
    await render(<NuevoDuenoPantalla />);
    await escribir("Nombre y apellido", "Carlos Gómez");
    await escribir("Nombre de la mascota", "Toby");
    await fireEvent(screen.getByLabelText("Crear cuenta para el dueño"), "valueChange", false);
    expect(screen.getByText("Guardar paciente")).toBeTruthy();
    await fireEvent.press(screen.getByText("Guardar paciente"));
    await act(async () => {});

    expect(fuente().llamadas.some((l) => l.startsWith("crearCuentaDueno"))).toBe(false);
    expect(fuente().llamadas).toContain("crearMascota:Toby");
    expect(recibidos).toHaveLength(1);
    expect(enrutador.back).toHaveBeenCalled();
    expect(Avisos.estado.banner?.mensaje).toBe("Paciente guardado");
  });

  it("con cuenta pide DNI, correo y teléfono", async () => {
    await render(<NuevoDuenoPantalla />);
    await escribir("Nombre y apellido", "Carlos Gómez");
    await escribir("Nombre de la mascota", "Toby");
    await fireEvent.press(screen.getByText("Crear cuenta y mascota"));

    expect(screen.getByText("El DNI debe tener 7 u 8 números")).toBeTruthy();
    expect(screen.getByText("Ingresá un correo válido")).toBeTruthy();
    expect(screen.getByText("Ingresá un teléfono válido")).toBeTruthy();
    expect(fuente().llamadas.some((l) => l.startsWith("crearCuentaDueno"))).toBe(false);
  });

  it("crear la cuenta de un paciente ya cargado no pide los datos de la mascota", async () => {
    const toby = PacientesRepo.agregarManual("Toby", "Perro", "", "Macho", "Carlos Gómez", "1144443333", "", "30111999");
    fijarRuta({ pacientes: toby.id });
    await render(<NuevoDuenoPantalla />);

    expect(screen.getByText("Para que vea la ficha desde su casa")).toBeTruthy();
    expect(screen.queryByText("Mascota")).toBeNull();
    expect(screen.getByDisplayValue("Carlos Gómez")).toBeTruthy();
    expect(screen.getByDisplayValue("30111999")).toBeTruthy();
    expect(screen.getByText("Va a ver la ficha de Toby, con todo lo que ya cargaste.")).toBeTruthy();

    await escribir("Correo", "carlos@prueba.test");
    await fireEvent.press(screen.getByRole("button", { name: "Crear cuenta del dueño" }));
    await waitFor(() => expect(screen.getByText("Cuenta creada")).toBeTruthy());
    expect(fuente().ultimaCuentaPedida?.mascotas_existentes).toEqual([toby.id]);
  });

  it("un animal que el veterinario no atiende avisa y no crea nada", async () => {
    PerfilVetRepo.tiposAnimales.delete("Ave");
    await render(<NuevoDuenoPantalla />);
    await cargarDuenoNuevo();
    await fireEvent.press(screen.getByLabelText("Tipo de animal: Perro"));
    await fireEvent.press(screen.getByLabelText("Ave"));
    await fireEvent.press(screen.getByText("Crear cuenta y mascota"));
    expect(Avisos.estado.carteles[0].titulo).toBe("No atendés aves");
    expect(fuente().llamadas.some((l) => l.startsWith("crearCuentaDueno"))).toBe(false);
  });
});
