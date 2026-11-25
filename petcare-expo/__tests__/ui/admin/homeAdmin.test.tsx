jest.mock("@expo/vector-icons", () => require("../iconosFalsos"));
import { Dimensions } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Escenario, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { ingresarComo, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { HomeAdmin } from "../../../src/ui/admin/HomeAdmin";
import { Avisos } from "../../../src/ui/common/Avisos";
import { AvisosHost } from "../../../src/ui/common/AvisosHost";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { Sesion } from "../../../src/data/sesion";

let fuente: FuenteEnMemoria;

const VET_PENDIENTE = "vet-pend";
const VET_ACTIVO = "vet-act";

/** Un administrador con una solicitud pendiente, un veterinario activo y un dueño con una mascota. */
async function prepararPanel(opciones: { conPendiente?: boolean } = {}) {
  const conPendiente = opciones.conPendiente ?? true;
  if (conPendiente) fuente.perfiles.push(Escenario.veterinario(VET_PENDIENTE, "Dr. Pendiente", "pendiente_revision"));
  fuente.perfiles.push(Escenario.veterinario(VET_ACTIVO, "Dra. Activa", "activo"));
  fuente.perfiles.push(Escenario.dueno());
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"));
  fuente.resumen = { mascotas: 1, turnos_hoy: 2 };
  await ingresarComo(Escenario.admin());
}

async function mostrarPanel() {
  fijarRuta();
  await render(
    <>
      <HomeAdmin />
      <AvisosHost />
    </>,
  );
}

const irA = async (pestana: string) => fireEvent.press(screen.getByRole("tab", { name: pestana }));

beforeEach(() => {
  fuente = prepararServicios();
  Avisos.reiniciar();
});

afterEach(() => {
  Avisos.reiniciar();
  limpiarServicios();
});

describe("HomeAdmin: inicio", () => {
  it("muestra el resumen con los contadores y la solicitud pendiente", async () => {
    await prepararPanel();
    await mostrarPanel();

    expect(screen.getByText("Panel de control")).toBeTruthy();
    expect(screen.getByText("Revisión pendiente")).toBeTruthy();
    expect(screen.getByText("1 veterinario espera tu aprobación")).toBeTruthy();
    expect(screen.getByText("Para revisar")).toBeTruthy();
    expect(screen.getByText("Dr. Pendiente")).toBeTruthy();
    expect(screen.getByText(/Pidió el alta · /)).toBeTruthy();
    expect(screen.getByLabelText("Veterinarios activos: 1")).toBeTruthy();
    expect(screen.getByLabelText("Mascotas: 1")).toBeTruthy();
    expect(screen.getByLabelText("Turnos de hoy: 2")).toBeTruthy();
  });

  it("sin altas pendientes muestra el estado vacío y 'Todo al día'", async () => {
    await prepararPanel({ conPendiente: false });
    await mostrarPanel();

    expect(screen.getByText("Todo al día")).toBeTruthy();
    expect(screen.getByText("No hay altas pendientes")).toBeTruthy();
    expect(screen.getByText("Sin solicitudes pendientes")).toBeTruthy();
    expect(screen.getByText("Ya revisaste todas las altas")).toBeTruthy();
    expect(screen.queryByText("Ver todas")).toBeNull();
  });

  it("tocar el contador de turnos avisa cuántos hay hoy", async () => {
    await prepararPanel();
    await mostrarPanel();

    await fireEvent.press(screen.getByLabelText("Turnos de hoy: 2"));
    expect(Avisos.estado.banner?.mensaje).toBe("Hay 2 turnos pendientes para hoy");
  });

  it("'Revisar solicitudes' abre los veterinarios filtrados por en revisión", async () => {
    await prepararPanel();
    await mostrarPanel();

    await fireEvent.press(screen.getByText("Revisar solicitudes"));
    expect(screen.getByText("En revisión (1)")).toBeTruthy();
    expect(screen.getByText("1 activos · 1 en revisión")).toBeTruthy();
    expect(screen.getByText("Dar de alta")).toBeTruthy();
  });
});

describe("HomeAdmin: veterinarios", () => {
  it("aprobar a un pendiente manda la revisión al servidor y avisa", async () => {
    await prepararPanel();
    await mostrarPanel();
    await irA("Veterinarios");

    await fireEvent.press(screen.getByText("Dar de alta"));

    expect(Avisos.estado.banner?.mensaje).toBe("Dr. Pendiente ya está dado de alta");
    await waitFor(() => expect(fuente.llamadas).toContain(`revisionVet:${VET_PENDIENTE}=activo`));
  });

  it("rechazar pide el motivo y no manda nada hasta confirmarlo", async () => {
    await prepararPanel();
    await mostrarPanel();
    await irA("Veterinarios");

    await fireEvent.press(screen.getByText("Rechazar"));
    expect(screen.getByText("Rechazar a Dr. Pendiente")).toBeTruthy();
    expect(screen.getByText("El veterinario va a ver este motivo cuando intente ingresar.")).toBeTruthy();

    // Sin motivo no deja confirmar
    await fireEvent.press(screen.getAllByText("Rechazar").at(-1)!);
    expect(screen.getByText("Escribí el motivo")).toBeTruthy();
    expect(fuente.llamadas.some((l) => l.startsWith("revisionVet:"))).toBe(false);

    // Una sugerencia completa el motivo
    await fireEvent.press(screen.getByText("Documentación inválida"));
    await fireEvent.press(screen.getAllByText("Rechazar").at(-1)!);

    expect(Avisos.estado.banner?.mensaje).toBe("Solicitud de Dr. Pendiente rechazada");
    await waitFor(() => expect(fuente.llamadas).toContain(`revisionVet:${VET_PENDIENTE}=rechazado:Documentación inválida`));
  });

  it("el motivo de menos de 5 caracteres se rechaza", async () => {
    await prepararPanel();
    await mostrarPanel();
    await irA("Veterinarios");

    await fireEvent.press(screen.getByText("Rechazar"));
    await fireEvent.changeText(screen.getByPlaceholderText("Motivo (se lo mostramos al usuario)"), "no");
    await fireEvent.press(screen.getAllByText("Rechazar").at(-1)!);

    expect(screen.getByText("Escribí el motivo")).toBeTruthy();
    expect(fuente.llamadas.some((l) => l.startsWith("revisionVet:"))).toBe(false);
  });

  it("los filtros muestran las cantidades y cambian la lista", async () => {
    await prepararPanel();
    await mostrarPanel();
    await irA("Veterinarios");

    expect(screen.getByText("En revisión (1)")).toBeTruthy();
    expect(screen.getByText("Activos (1)")).toBeTruthy();
    expect(screen.getByText("Rechazados (0)")).toBeTruthy();
    expect(screen.getByText("Suspendidos (0)")).toBeTruthy();
    expect(screen.getByText("Todos (2)")).toBeTruthy();
    // Empieza en "En revisión": el activo no se ve
    expect(screen.getByText("Dr. Pendiente")).toBeTruthy();
    expect(screen.queryByText("Dra. Activa")).toBeNull();

    await fireEvent.press(screen.getByText("Activos (1)"));
    expect(screen.getByText("Dra. Activa")).toBeTruthy();
    expect(screen.queryByText("Dr. Pendiente")).toBeNull();

    await fireEvent.press(screen.getByText("Todos (2)"));
    expect(screen.getByText("Dra. Activa")).toBeTruthy();
    expect(screen.getByText("Dr. Pendiente")).toBeTruthy();
  });

  it("estado vacío con filtro y con búsqueda sin resultados", async () => {
    await prepararPanel();
    await mostrarPanel();
    await irA("Veterinarios");

    await fireEvent.press(screen.getByText("Rechazados (0)"));
    expect(screen.getByText("Sin veterinarios acá")).toBeTruthy();
    expect(screen.getByText("No hay veterinarios con este estado")).toBeTruthy();

    await fireEvent.press(screen.getByText("Todos (2)"));
    await fireEvent.changeText(screen.getByPlaceholderText("Buscar por nombre, matrícula o clínica..."), "zzz");
    expect(screen.getByText("No encontramos veterinarios")).toBeTruthy();
    expect(screen.getByText("Probá con otro nombre, matrícula o clínica")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("Buscar por nombre, matrícula o clínica..."), "activa");
    expect(screen.getByText("Dra. Activa")).toBeTruthy();
    expect(screen.queryByText("Dr. Pendiente")).toBeNull();
  });

  it("la hoja de detalle muestra los datos y las acciones según el estado", async () => {
    await prepararPanel();
    await mostrarPanel();
    await irA("Veterinarios");
    await fireEvent.press(screen.getByText("Activos (1)"));

    await fireEvent.press(screen.getByLabelText("Veterinario Dra. Activa"));
    expect(screen.getByText("Matrícula")).toBeTruthy();
    expect(screen.getByText("Días y horarios")).toBeTruthy();
    expect(screen.getByText("Lun a Vie · 09:00 a 12:00 hs")).toBeTruthy();
    expect(screen.getByText("Suspender cuenta")).toBeTruthy();

    await fireEvent.press(screen.getByText("Suspender cuenta"));
    expect(screen.getByText("Suspender a Dra. Activa")).toBeTruthy();
    await fireEvent.press(screen.getByText("Matrícula vencida"));
    await fireEvent.press(screen.getAllByText("Suspender").at(-1)!);

    expect(Avisos.estado.banner?.mensaje).toBe("Dra. Activa quedó suspendido");
    await waitFor(() => expect(fuente.llamadas).toContain(`revisionVet:${VET_ACTIVO}=suspendido:Matrícula vencida`));
  });

  it("sin foto del carnet el botón está deshabilitado; con foto la baja del bucket privado", async () => {
    await prepararPanel();
    await mostrarPanel();
    await irA("Veterinarios");

    // El veterinario de prueba no tiene credencial cargada
    await fireEvent.press(screen.getByLabelText("Veterinario Dr. Pendiente"));
    expect(screen.getByRole("button", { name: "No cargó la foto del carnet" })).toBeDisabled();
  });

  it("ver la credencial baja el archivo de 'credenciales' y lo muestra", async () => {
    fuente.perfiles.push(
      Escenario.perfil(VET_PENDIENTE, "veterinario", "Dr. Pendiente", {
        estado: "pendiente_revision",
        veterinario: { profile_id: VET_PENDIENTE, matricula: "MP-9", clinica: "Clínica Sur", dias_atencion: [1], estado_revision: "pendiente_revision", credencial_path: `${VET_PENDIENTE}/carnet.jpg` },
      }),
    );
    await ingresarComo(Escenario.admin());
    const descargar = jest.fn(async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    fuente.descargar = descargar;
    await mostrarPanel();
    await irA("Veterinarios");

    await fireEvent.press(screen.getByLabelText("Veterinario Dr. Pendiente"));
    await fireEvent.press(screen.getByRole("button", { name: "Ver foto del carnet o matrícula" }));

    await waitFor(() => expect(screen.getByText("Carnet de Dr. Pendiente")).toBeTruthy());
    expect(descargar).toHaveBeenCalledWith("credenciales", `${VET_PENDIENTE}/carnet.jpg`);
    expect(screen.getByText("Matrícula declarada: MP-9")).toBeTruthy();
  });

  it("si la foto del carnet no se puede bajar muestra el error", async () => {
    fuente.perfiles.push(
      Escenario.perfil(VET_PENDIENTE, "veterinario", "Dr. Pendiente", {
        estado: "pendiente_revision",
        veterinario: { profile_id: VET_PENDIENTE, matricula: "MP-9", clinica: "Clínica Sur", dias_atencion: [1], estado_revision: "pendiente_revision", credencial_path: `${VET_PENDIENTE}/carnet.jpg` },
      }),
    );
    await ingresarComo(Escenario.admin());
    await mostrarPanel();
    await irA("Veterinarios");

    await fireEvent.press(screen.getByLabelText("Veterinario Dr. Pendiente"));
    await fireEvent.press(screen.getByRole("button", { name: "Ver foto del carnet o matrícula" }));

    await waitFor(() => expect(Avisos.estado.carteles.length).toBe(1));
    expect(Avisos.estado.carteles[0].mensaje).toBe("La foto no se pudo abrir");
  });
});

describe("HomeAdmin: dueños", () => {
  it("lista los dueños con sus mascotas y filtra por estado", async () => {
    await prepararPanel();
    await mostrarPanel();
    await irA("Dueños");

    expect(screen.getByText("1 dueños · 1 mascotas")).toBeTruthy();
    expect(screen.getByText("Ana Prueba")).toBeTruthy();
    expect(screen.getByText("1 mascota")).toBeTruthy();
    expect(screen.getByText("Todos (1)")).toBeTruthy();
    expect(screen.getByText("Suspendidos (0)")).toBeTruthy();

    await fireEvent.press(screen.getByText("Suspendidos (0)"));
    expect(screen.getByText("Sin dueños acá")).toBeTruthy();
    expect(screen.getByText("No hay dueños con este estado")).toBeTruthy();
  });

  it("suspender a un dueño pide el motivo y manda el cambio de estado", async () => {
    await prepararPanel();
    await mostrarPanel();
    await irA("Dueños");

    await fireEvent.press(screen.getByLabelText("Dueño Ana Prueba"));
    expect(screen.getByText("• Rex (Mestizo)")).toBeTruthy();
    await fireEvent.press(screen.getByText("Suspender cuenta"));
    expect(screen.getByText("Suspender a Ana Prueba")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("Motivo (se lo mostramos al usuario)"), "Uso indebido de la plataforma");
    await fireEvent.press(screen.getAllByText("Suspender").at(-1)!);

    expect(Avisos.estado.banner?.mensaje).toBe("La cuenta de Ana Prueba quedó suspendida");
    await waitFor(() => expect(fuente.llamadas).toContain("estadoCuenta:dueno-1=suspendido:Uso indebido de la plataforma"));
    // El dueño ahora figura como suspendido
    expect(screen.getByText("Suspendidos (1)")).toBeTruthy();
  });

  it("reactivar a un dueño suspendido", async () => {
    fuente.perfiles.push(Escenario.perfil(Escenario.DUENO_ID, "dueno", "Ana Prueba", { estado: "suspendido", motivo: "Datos falsos", dni: "30111222" }));
    await ingresarComo(Escenario.admin());
    await mostrarPanel();
    await irA("Dueños");

    await fireEvent.press(screen.getByLabelText("Dueño Ana Prueba"));
    expect(screen.getByText("Motivo de la suspensión: Datos falsos")).toBeTruthy();
    await fireEvent.press(screen.getByText("Reactivar cuenta"));

    expect(Avisos.estado.banner?.mensaje).toBe("La cuenta de Ana Prueba fue reactivada");
    await waitFor(() => expect(fuente.llamadas).toContain("estadoCuenta:dueno-1=activo"));
  });
});

describe("HomeAdmin: actividad y cuenta", () => {
  it("sin movimientos muestra el estado vacío", async () => {
    await prepararPanel();
    await mostrarPanel();
    await irA("Actividad");

    expect(screen.getByText("Últimos movimientos de la plataforma")).toBeTruthy();
    expect(screen.getByText("Sin actividad")).toBeTruthy();
    expect(screen.getByText("Los registros y cambios de cuentas aparecen acá")).toBeTruthy();
  });

  it("lista los movimientos de la plataforma", async () => {
    fuente.actividad.push({ id: "a1", tipo: "aprobacion", texto: "Aprobaste a Dra. Activa", created_at: new Date().toISOString() });
    await prepararPanel();
    await mostrarPanel();
    expect(screen.getByText("Aprobaste a Dra. Activa")).toBeTruthy();

    await irA("Actividad");
    expect(screen.getByText("Aprobaste a Dra. Activa")).toBeTruthy();
    expect(screen.queryByText("Sin actividad")).toBeNull();
  });

  it("la cuenta muestra el resumen y cerrar sesión pide confirmación", async () => {
    await prepararPanel();
    await mostrarPanel();

    await fireEvent.press(screen.getByLabelText("Cuenta de administrador"));
    expect(screen.getByText("Administrador")).toBeTruthy();
    expect(screen.getByText("Acceso total")).toBeTruthy();
    expect(screen.getByText("1 activos de 2")).toBeTruthy();
    expect(screen.getByText("1 dueños · 1 mascotas")).toBeTruthy();
    expect(screen.getByText("1 pendiente")).toBeTruthy();

    await fireEvent.press(screen.getByText("Cerrar sesión"));
    expect(Avisos.estado.carteles[0].titulo).toBe("¿Cerrar sesión?");
    expect(Avisos.estado.carteles[0].mensaje).toBe("Vas a tener que ingresar de nuevo con tu correo y tu contraseña.");
    expect(Sesion.activa).toBe(true);

    await act(async () => {
      Avisos.cerrarCartel(Avisos.estado.carteles[0].id, true);
    });
    await waitFor(() => expect(Sesion.activa).toBe(false));
  });
});

describe("HomeAdmin: sin sesión", () => {
  it("vuelve al ingreso", async () => {
    fijarRuta();
    await render(<HomeAdmin />);
    expect(enrutador.replace).toHaveBeenCalledWith("/auth");
  });
});

describe("HomeAdmin: pantalla ancha", () => {
  const ventana = Dimensions.get("window");
  afterEach(async () => {
    await act(async () => Dimensions.set({ window: ventana }));
  });

  it("a 1280 px muestra las mismas listas y funciones (en dos columnas)", async () => {
    Dimensions.set({ window: { ...ventana, width: 1280, height: 800 } });
    await prepararPanel();
    await mostrarPanel();

    expect(screen.getByText("Panel de control")).toBeTruthy();
    expect(screen.getByText("Para revisar")).toBeTruthy();
    expect(screen.getByText("Actividad reciente")).toBeTruthy();

    // En escritorio las secciones están en el menú lateral, no en la barra inferior
    expect(screen.queryByRole("tab", { name: "Veterinarios" })).toBeNull();
    expect(screen.getByTestId("menu-lateral")).toBeTruthy();
    await fireEvent.press(screen.getByRole("link", { name: "Veterinarios" }));
    await fireEvent.press(screen.getByText("Todos (2)"));
    expect(screen.getByText("Dr. Pendiente")).toBeTruthy();
    expect(screen.getByText("Dra. Activa")).toBeTruthy();
    await fireEvent.press(screen.getByText("Dar de alta"));
    await waitFor(() => expect(fuente.llamadas).toContain(`revisionVet:${VET_PENDIENTE}=activo`));
  });
});
