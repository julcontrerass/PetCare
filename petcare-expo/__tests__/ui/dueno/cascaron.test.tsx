/* Pruebas de humo del cascarón del dueño: barra inferior, menú "Más", panel de notificaciones y primer ingreso. */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { Escenario } from "../../soporte/fuenteEnMemoria";
import { fuente, ingresarComo, ingresarComoDueno, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { DuenoRepo } from "../../../src/data/repositorio/duenoRepo";
import { Sesion } from "../../../src/data/sesion";
import type { NotificacionDto } from "../../../src/data/remoto/dtos";
import { LocalDate } from "../../../src/util/tiempo";
import { Avisos } from "../../../src/ui/common/Avisos";
import { AvisosHost } from "../../../src/ui/common/AvisosHost";
import { BarraInferior, MenuMasOverlay } from "../../../src/ui/dueno/BarraInferior";
import LayoutTabsDueno, { PANTALLAS_OCULTAS } from "../../../src/ui/dueno/CascaronDueno";
import { EstadoDueno, PanelNotificacionesDueno } from "../../../src/ui/dueno/estadoDueno";
import { accionAtras, MenuMas, pestanaDeRuta } from "../../../src/ui/dueno/menuMas";

const noti = (id: string, leida: boolean): NotificacionDto => ({
  id, tipo: "turno", titulo: `Aviso ${id}`, mensaje: "Mensaje", leida, created_at: new Date().toISOString(),
});

beforeEach(() => {
  prepararServicios();
  fijarRuta();
  Avisos.reiniciar();
  MenuMas.cerrar();
  PanelNotificacionesDueno.ocultar();
  EstadoDueno.diaSeleccionado = LocalDate.now();
});
afterEach(() => {
  limpiarServicios();
  Avisos.reiniciar();
});

describe("funciones puras del cascarón", () => {
  it("pestanaDeRuta marca solo las tres pestañas", () => {
    expect(pestanaDeRuta("index")).toBe("inicio");
    expect(pestanaDeRuta("mascotas")).toBe("mascotas");
    expect(pestanaDeRuta("recordatorios")).toBe("recordatorios");
    expect(pestanaDeRuta("calendario")).toBeNull();
    expect(pestanaDeRuta("mascota/[id]")).toBeNull();
  });

  it("el botón atrás cierra el menú, vuelve a Inicio o deja al sistema", () => {
    expect(accionAtras(true, true, true)).toBe("cerrarMenu");
    expect(accionAtras(true, false, false)).toBe("irAInicio");
    expect(accionAtras(true, true, false)).toBe("sistema");
    expect(accionAtras(false, false, false)).toBe("sistema");
  });

  it("declara todas las rutas ocultas del grupo", () => {
    expect([...PANTALLAS_OCULTAS].sort()).toEqual(
      ["calendario", "perfil", "perfil-editar", "veterinarios", "solicitudes", "mascota-nueva", "mascota/[id]", "evento-nuevo", "evento/[id]"].sort(),
    );
  });
});

describe("BarraInferior", () => {
  it("navega con las pestañas, salvo a la que ya está a la vista", async () => {
    await ingresarComoDueno();
    await render(<BarraInferior ruta="index" />);
    await fireEvent.press(screen.getByLabelText("Home"));
    expect(enrutador.navigate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Mascotas"));
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/mascotas");
    await fireEvent.press(screen.getByLabelText("Recordatorios"));
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/recordatorios");
  });

  it("el botón central agenda un evento en el día elegido", async () => {
    await ingresarComoDueno();
    const dia = LocalDate.now().plusDays(3);
    EstadoDueno.diaSeleccionado = dia;
    await render(<BarraInferior ruta="index" />);
    await fireEvent.press(screen.getByLabelText("Agendar evento"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/dueno/evento-nuevo", params: { fecha: dia.toString() } });
  });

  it("en una ruta oculta no hay ninguna pestaña marcada", async () => {
    await ingresarComoDueno();
    await render(<BarraInferior ruta="calendario" />);
    for (const t of ["Home", "Mascotas", "Recordatorios", "Más"]) {
      expect(screen.getByLabelText(t).props.accessibilityState.selected).toBe(false);
    }
  });
});

describe("Menú Más", () => {
  const abrir = async (ruta = "index") => {
    await render(<><BarraInferior ruta={ruta} /><MenuMasOverlay /></>);
    await fireEvent.press(screen.getByLabelText("Más"));
  };

  it("muestra todas las opciones y marca Más mientras está abierto", async () => {
    await ingresarComoDueno();
    await abrir();
    for (const t of ["Mi perfil", "Veterinarios autorizados", "Solicitudes de acceso", "Vacunas y documentos", "Calendario", "Notificaciones", "Cerrar sesión"]) {
      expect(screen.getByText(t)).toBeTruthy();
    }
    expect(screen.getByLabelText("Más").props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText("Home").props.accessibilityState.selected).toBe(false);
  });

  it("cada opción cierra el menú y navega a su ruta", async () => {
    await ingresarComoDueno();
    const casos: [string, string][] = [
      ["Mi perfil", "/dueno/perfil"], ["Veterinarios autorizados", "/dueno/veterinarios"],
      ["Solicitudes de acceso", "/dueno/solicitudes"], ["Calendario", "/dueno/calendario"],
    ];
    await abrir();
    for (const [texto, ruta] of casos) {
      if (!MenuMas.abierto) await fireEvent.press(screen.getByLabelText("Más"));
      await fireEvent.press(screen.getByText(texto));
      expect(enrutador.navigate).toHaveBeenCalledWith(ruta);
      expect(MenuMas.abierto).toBe(false);
    }
    await fireEvent.press(screen.getByLabelText("Más"));
    await fireEvent.press(screen.getByText("Vacunas y documentos"));
    expect(enrutador.push).toHaveBeenCalledWith("/dueno/carnet");
  });

  it("el punto rojo aparece solo con notificaciones sin leer", async () => {
    fuente().notificacionesGuardadas = [noti("n1", false)];
    await ingresarComoDueno();
    await abrir();
    expect(screen.getByLabelText("Hay notificaciones sin leer")).toBeTruthy();
  });

  it("sin notificaciones sin leer no hay punto", async () => {
    fuente().notificacionesGuardadas = [noti("n1", true)];
    await ingresarComoDueno();
    await abrir();
    expect(screen.queryByLabelText("Hay notificaciones sin leer")).toBeNull();
  });

  it("tocar afuera lo cierra", async () => {
    await ingresarComoDueno();
    await abrir();
    await fireEvent.press(screen.getByLabelText("Cerrar menú"));
    expect(screen.queryByText("Mi perfil")).toBeNull();
  });

  it("Cerrar sesión pide confirmación", async () => {
    await ingresarComoDueno();
    await render(<><BarraInferior ruta="index" /><MenuMasOverlay /><AvisosHost /></>);
    await fireEvent.press(screen.getByLabelText("Más"));
    await fireEvent.press(screen.getByText("Cerrar sesión"));
    expect(Avisos.estado.carteles[0].titulo).toBe("¿Cerrar sesión?");
  });
});

describe("LayoutTabsDueno", () => {
  it("abre el panel de notificaciones desde cualquier pantalla y las da por leídas", async () => {
    fuente().notificacionesGuardadas = [noti("n1", false)];
    await ingresarComoDueno();
    await render(<LayoutTabsDueno />);
    expect(screen.queryByText("Aviso n1")).toBeNull();
    await act(async () => { PanelNotificacionesDueno.mostrar(); });
    expect(screen.getByText("Aviso n1")).toBeTruthy();
    expect(DuenoRepo.notificacionesSinLeer).toBe(0);
  });

  it("sin sesión vuelve al ingreso", async () => {
    await render(<LayoutTabsDueno />);
    expect(enrutador.replace).toHaveBeenCalledWith("/auth");
  });

  it("una cuenta creada por un veterinario pide elegir contraseña y aceptar los términos", async () => {
    await ingresarComo({ ...Escenario.dueno(), debe_cambiar_password: true });
    await render(<><LayoutTabsDueno /><AvisosHost /></>);
    expect(screen.getByText("Elegí tu contraseña")).toBeTruthy();
    expect(screen.getByText(/Hola Ana, tu veterinario te creó esta cuenta/)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("Nueva contraseña"), "MiClave123");
    await fireEvent.changeText(screen.getByLabelText("Repetí la contraseña"), "MiClave123");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(Avisos.estado.banner?.mensaje).toBe("Tenés que aceptar los términos y condiciones");
    expect(fuente().llamadas).not.toContain("definirPassword");

    await fireEvent.press(screen.getByLabelText("Acepto los términos y condiciones"));
    await fireEvent.press(screen.getByText("Guardar"));
    await act(async () => {});
    expect(fuente().llamadas).toContain("definirPassword");
    expect(fuente().llamadas).toContain("primerIngreso:1.0");
    expect(DuenoRepo.perfil.debeCambiarPassword).toBe(false);
    expect(screen.queryByText("Elegí tu contraseña")).toBeNull();
  });

  it("valida el largo y que las contraseñas coincidan", async () => {
    await ingresarComo({ ...Escenario.dueno(), debe_cambiar_password: true });
    await render(<LayoutTabsDueno />);
    await fireEvent.changeText(screen.getByLabelText("Nueva contraseña"), "123");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(Avisos.estado.banner?.mensaje).toBe("La contraseña debe tener al menos 6 caracteres");
    await fireEvent.changeText(screen.getByLabelText("Nueva contraseña"), "abcdef");
    await fireEvent.changeText(screen.getByLabelText("Repetí la contraseña"), "abcdeg");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(Avisos.estado.banner?.mensaje).toBe("Las contraseñas no coinciden");
  });

  it("con cuenta propia no pide la contraseña", async () => {
    await ingresarComoDueno();
    await render(<LayoutTabsDueno />);
    expect(screen.queryByText("Elegí tu contraseña")).toBeNull();
    expect(Sesion.activa).toBe(true);
  });
});
