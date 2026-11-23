/*
 * Pruebas de PerfilPantalla y EditarPerfilPantalla (dueno_elPerfilMuestraSusDatosYCierraSesion,
 * dueno_eliminarCuentaPideConfirmacion, dueno_sinRolDeVeterinarioPuedePedirElAlta,
 * dueno_conAltaEnRevisionVeAlgunEstadoYNoPuedePasarDeModo, dueno_conRolDeVeterinarioAprobadoPasaDeModoDesdeElPerfil,
 * dueno_elPerfilListaMascotasYVeterinariosEnHojas y dueno_elPerfilSinVeterinariosMuestraUnCartel).
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Sesion } from "../../../src/data/sesion";
import { Avisos } from "../../../src/ui/common/Avisos";
import { AvisosHost } from "../../../src/ui/common/AvisosHost";
import EditarPerfilPantalla from "../../../src/ui/dueno/EditarPerfilPantalla";
import PerfilPantalla from "../../../src/ui/dueno/PerfilPantalla";
import { Escenario, accesoDto, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { ingresarComo, ingresarComoDueno, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { enrutador, fijarRuta } from "../../soporte/rutas";

let fuente: FuenteEnMemoria;

function escenario() {
  fuente.perfiles.push(Escenario.dueno(), Escenario.veterinario());
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"), Escenario.mascota("m2", "Mia", Escenario.DUENO_ID, "Gato"));
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"), accesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"));
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

describe("PerfilPantalla", () => {
  it("muestra los datos de la cuenta y cierra la sesión con confirmación", async () => {
    await ingresarComoDueno();
    await mostrar(<PerfilPantalla />);

    expect(screen.getByText("Mi Perfil")).toBeTruthy();
    expect(screen.getByText("Ana Prueba")).toBeTruthy();
    expect(screen.getByText("Propietario")).toBeTruthy();
    expect(screen.getByText(`${Escenario.DUENO_ID}@prueba.test`)).toBeTruthy();
    expect(screen.getByText("1155550000")).toBeTruthy();
    expect(screen.getByText("Calle 123")).toBeTruthy();
    expect(screen.getByRole("button", { name: "2 Mascotas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1 Veterinarios" })).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(screen.getByText("¿Cerrar sesión?")).toBeTruthy();
    await fireEvent.press(screen.getAllByText("Cerrar sesión").slice(-1)[0]);
    await waitFor(() => expect(Sesion.activa).toBe(false));
  });

  it("eliminar la cuenta pide confirmación", async () => {
    await ingresarComoDueno();
    await mostrar(<PerfilPantalla />);

    await fireEvent.press(screen.getByRole("button", { name: "Eliminar mi cuenta" }));
    expect(screen.getByText("¿Eliminar tu cuenta?")).toBeTruthy();
    await fireEvent.press(screen.getByText("Eliminar cuenta"));
    await waitFor(() => expect(fuente.llamadas).toContain("eliminarCuenta"));
    expect(Sesion.activa).toBe(false);
  });

  it("las tarjetas listan mascotas y veterinarios en hojas", async () => {
    await ingresarComoDueno();
    await mostrar(<PerfilPantalla />);

    await fireEvent.press(screen.getByRole("button", { name: "2 Mascotas" }));
    expect(screen.getByText("Mis mascotas")).toBeTruthy();
    expect(screen.getByText("Tenés 2 mascotas registradas.")).toBeTruthy();
    expect(screen.getByText("Rex")).toBeTruthy();
    expect(screen.getByText("Mia")).toBeTruthy();
    expect(screen.getAllByText(/Perro - Mestizo/).length).toBeGreaterThan(0);
  });

  it("la tarjeta de veterinarios lista a quienes tienen acceso", async () => {
    await ingresarComoDueno();
    await mostrar(<PerfilPantalla />);

    await fireEvent.press(screen.getByRole("button", { name: "1 Veterinarios" }));
    expect(screen.getByText("1 veterinario puede ver la ficha de tus mascotas.")).toBeTruthy();
    expect(screen.getByText(/Acceso a:/)).toBeTruthy();
    expect(screen.getByText("Ir a Veterinarios")).toBeTruthy();
  });

  it("sin veterinarios con acceso muestra un cartel", async () => {
    fuente.accesosGuardados.length = 0;
    await ingresarComoDueno();
    await mostrar(<PerfilPantalla />);

    await fireEvent.press(screen.getByRole("button", { name: "0 Veterinarios" }));
    expect(screen.getByText("Sin veterinarios con acceso")).toBeTruthy();
    await fireEvent.press(screen.getByText("Ir a Veterinarios"));
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/veterinarios");
  });

  it("sin mascotas ofrece ir a Mascotas", async () => {
    fuente.mascotas.length = 0;
    fuente.accesosGuardados.length = 0;
    await ingresarComoDueno();
    await mostrar(<PerfilPantalla />);

    await fireEvent.press(screen.getByRole("button", { name: "0 Mascotas" }));
    expect(screen.getByText("Todavía no tenés mascotas")).toBeTruthy();
    await fireEvent.press(screen.getByText("Ir a Mascotas"));
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/mascotas");
  });

  it("Editar datos personales lleva a la edición y cambiar contraseña valida los campos", async () => {
    await ingresarComoDueno();
    await mostrar(<PerfilPantalla />);

    await fireEvent.press(screen.getByRole("button", { name: "Editar datos personales" }));
    expect(enrutador.push).toHaveBeenCalledWith("/dueno/perfil-editar");

    await fireEvent.press(screen.getByRole("button", { name: "Cambiar contraseña" }));
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Ingresá tu contraseña actual")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Contraseña actual"), "123456");
    await fireEvent.changeText(screen.getByPlaceholderText("Nueva contraseña"), "123");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("La nueva contraseña debe tener al menos 6 caracteres")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Nueva contraseña"), "abcdef");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirmar nueva contraseña"), "abcdeg");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Las contraseñas no coinciden")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Nueva contraseña"), "123456");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirmar nueva contraseña"), "123456");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("La nueva contraseña debe ser distinta a la actual")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Nueva contraseña"), "abcdef");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirmar nueva contraseña"), "abcdef");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(fuente.llamadas).toContain(`password:${Escenario.DUENO_ID}@prueba.test`));
    expect(screen.getByText("Contraseña actualizada")).toBeTruthy();
  });

  it("tocar la foto sin foto pide elegir una primero", async () => {
    await ingresarComoDueno();
    await mostrar(<PerfilPantalla />);
    await fireEvent.press(screen.getByRole("button", { name: "Ajustar posición de la foto" }));
    expect(screen.getByText("Primero elegí una foto tocando el ícono del lápiz")).toBeTruthy();
  });

  describe("modo veterinario", () => {
    it("sin rol de veterinario puede pedir el alta", async () => {
      await ingresarComoDueno();
      await mostrar(<PerfilPantalla />);

      await fireEvent.press(screen.getByRole("button", { name: "Soy veterinario/a: pedir el alta" }));
      expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/auth/registro-veterinario", params: { cuentaExistente: "1" } });
    });

    it("con el alta en revisión ve el estado y no puede pasar de modo", async () => {
      await ingresarComo(Escenario.duenoYVeterinario("pendiente_revision"));
      await mostrar(<PerfilPantalla />);

      expect(screen.queryByText("Pasar al modo veterinario")).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: "Alta como veterinario/a en revisión" }));
      expect(screen.getByText("Alta en revisión")).toBeTruthy();
    });

    it("con el alta rechazada ofrece volver a presentarla con el motivo", async () => {
      await ingresarComo(Escenario.duenoYVeterinario("rechazado"));
      await mostrar(<PerfilPantalla />);

      await fireEvent.press(screen.getByRole("button", { name: "Alta rechazada: volver a presentarla" }));
      expect(screen.getByText("Alta rechazada")).toBeTruthy();
      await fireEvent.press(screen.getByText("Volver a presentarla"));
      expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/auth/registro-veterinario", params: { cuentaExistente: "1" } });
    });

    it("con el rol aprobado pasa al modo veterinario", async () => {
      await ingresarComo(Escenario.duenoYVeterinario());
      await Sesion.entrarComo("DUENO");
      await mostrar(<PerfilPantalla />);

      expect(screen.getByText("Pasar al modo veterinario")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Pasar al modo veterinario" }));
      await waitFor(() => expect(Sesion.rol).toBe("VETERINARIO"));
      expect(enrutador.replace).toHaveBeenCalledWith("/vet");
    });
  });
});

describe("EditarPerfilPantalla", () => {
  it("muestra los datos, deja el correo sin editar y guarda los cambios", async () => {
    await ingresarComoDueno();
    await mostrar(<EditarPerfilPantalla />);

    expect(screen.getByText("Editar perfil")).toBeTruthy();
    expect(screen.getByText("Actualizá tus datos de contacto")).toBeTruthy();
    expect(screen.getByDisplayValue("Ana Prueba")).toBeTruthy();
    expect(screen.getByDisplayValue(`${Escenario.DUENO_ID}@prueba.test`).props.editable).toBe(false);

    await fireEvent.changeText(screen.getByLabelText("Nombre completo"), "  Ana María Prueba ");
    await fireEvent.changeText(screen.getByLabelText("Teléfono"), "11 2222-3333");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(fuente.llamadas.some((l) => l.startsWith("perfil:") && l.includes("nombre"))).toBe(true));
    expect(screen.getByText("Perfil actualizado correctamente")).toBeTruthy();
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/perfil");
  });

  it("sin nombre no guarda", async () => {
    await ingresarComoDueno();
    await mostrar(<EditarPerfilPantalla />);

    await fireEvent.changeText(screen.getByLabelText("Nombre completo"), "   ");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByText("Completá tu nombre")).toBeTruthy();
    expect(fuente.llamadas.some((l) => l.startsWith("perfil:"))).toBe(false);
  });
});
