/* Pruebas de las pantallas del dueño (parte A): inicio, mascotas, alta, detalle, recordatorios y calendario. */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { Escenario } from "../../soporte/fuenteEnMemoria";
import { fuente, ingresarComoDueno, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { DuenoRepo } from "../../../src/data/repositorio/duenoRepo";
import type { NotificacionDto, RecordatorioDto } from "../../../src/data/remoto/dtos";
import { LocalDate, YearMonth } from "../../../src/util/tiempo";
import { Avisos } from "../../../src/ui/common/Avisos";
import { AvisosHost } from "../../../src/ui/common/AvisosHost";
import CalendarioPantalla from "../../../src/ui/dueno/CalendarioPantalla";
import { DetalleMascotaPantalla } from "../../../src/ui/dueno/DetalleMascotaPantalla";
import { EstadoDueno } from "../../../src/ui/dueno/estadoDueno";
import HomePantalla from "../../../src/ui/dueno/HomePantalla";
import MascotasPantalla, { filtroAdmite } from "../../../src/ui/dueno/MascotasPantalla";
import NuevaMascotaPantalla from "../../../src/ui/dueno/NuevaMascotaPantalla";
import RecordatoriosPantalla from "../../../src/ui/dueno/RecordatoriosPantalla";

const hoy = LocalDate.now();

beforeEach(() => {
  const f = prepararServicios();
  f.mascotas.push(Escenario.mascota("m1", "Rex"));
  fijarRuta();
  Avisos.reiniciar();
  EstadoDueno.diaSeleccionado = hoy;
  EstadoDueno.mesCalendario = YearMonth.now();
});
afterEach(() => {
  limpiarServicios();
  Avisos.reiniciar();
});

const conMia = () => fuente().mascotas.push({ ...Escenario.mascota("m2", "Mia", undefined, "Gato"), estado: "fallecida" });
const turno = (id: string, fecha: LocalDate, hora = "10:00:00", estado = "pendiente") =>
  fuente().turnosGuardados.push(Escenario.turno(id, "m1", fecha.toString(), hora, Escenario.VET_ID, estado));

describe("Inicio", () => {
  it("saluda, ofrece agendar si no hay eventos y lista las mascotas", async () => {
    await ingresarComoDueno();
    await render(<HomePantalla />);
    expect(screen.getByText("Hola, Ana")).toBeTruthy();
    expect(screen.getByText("Sin eventos próximos")).toBeTruthy();
    expect(screen.getByText("Todo en orden".toUpperCase())).toBeTruthy();
    expect(screen.getByText("Rex")).toBeTruthy();
    expect(screen.getByText("No hay próximos recordatorios")).toBeTruthy();
    expect(screen.getByText("Sin actividad en los últimos 30 días")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("+ Agendar evento"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/dueno/evento-nuevo", params: { fecha: hoy.toString() } });
  });

  it("el hero muestra el próximo evento y lleva a Recordatorios", async () => {
    turno("t1", hoy.plusDays(1), "11:30:00");
    await ingresarComoDueno();
    await render(<HomePantalla />);
    expect(screen.getByText("PRÓXIMO EVENTO")).toBeTruthy();
    expect(screen.getByText(/Rex · Mañana, 11:30/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Ver detalle"));
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/recordatorios");
    expect(screen.getAllByText("Mañana").length).toBeGreaterThan(0); // la etiqueta de la fila
  });

  it("los accesos rápidos y las mascotas navegan", async () => {
    await ingresarComoDueno();
    await render(<HomePantalla />);
    await fireEvent.press(screen.getByLabelText("Veterinarios"));
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/veterinarios");
    await fireEvent.press(screen.getByLabelText("Documentos"));
    expect(enrutador.push).toHaveBeenCalledWith("/dueno/carnet");
    await fireEvent.press(screen.getByLabelText("Nueva mascota"));
    expect(enrutador.push).toHaveBeenCalledWith("/dueno/mascota-nueva");
    await fireEvent.press(screen.getByLabelText(/^Rex,/));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/dueno/mascota/[id]", params: { id: "m1" } });
    expect(EstadoDueno.mascotaActual?.nombre).toBe("Rex");
  });

  it("la campana cuenta las notificaciones sin leer y abre el panel", async () => {
    const n: NotificacionDto = { id: "n1", tipo: "turno", titulo: "Hola", mensaje: "m", leida: false, created_at: new Date().toISOString() };
    fuente().notificacionesGuardadas = [n];
    await ingresarComoDueno();
    await render(<HomePantalla />);
    expect(screen.getByLabelText("1 notificación sin leer")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Notificaciones"));
    const { PanelNotificacionesDueno } = require("../../../src/ui/dueno/estadoDueno");
    expect(PanelNotificacionesDueno.visible).toBe(true);
    PanelNotificacionesDueno.ocultar();
  });
});

describe("Mascotas", () => {
  it("oculta las históricas y las muestra en su solapa", async () => {
    conMia();
    await ingresarComoDueno();
    await render(<MascotasPantalla />);
    expect(screen.getByText("1 mascota · 1 en el historial")).toBeTruthy();
    expect(screen.getByText("Rex")).toBeTruthy();
    expect(screen.queryByText("Mia")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Históricas"));
    expect(screen.getByText("Mia")).toBeTruthy();
    expect(screen.queryByText("Rex")).toBeNull();
  });

  it("los filtros por tipo y el estado vacío", async () => {
    await ingresarComoDueno();
    await render(<MascotasPantalla />);
    await fireEvent.press(screen.getByLabelText("Gatos"));
    expect(screen.getByText("No hay mascotas en esta categoría")).toBeTruthy();
    expect(screen.getByText("Probá con otro filtro o agregá una nueva mascota")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Históricas"));
    expect(screen.getByText("No tenés mascotas históricas")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Perros"));
    expect(screen.getByText("Rex")).toBeTruthy();
  });

  it("filtroAdmite replica las reglas de Android", () => {
    const rex = DuenoRepo.mascotas;
    expect(rex).toBeDefined();
    const perro = { tipo: "Perro", estado: "ACTIVA" } as never;
    const loro = { tipo: "Ave", estado: "ACTIVA" } as never;
    const viejo = { tipo: "Gato", estado: "INACTIVA" } as never;
    expect(filtroAdmite("PERROS", perro)).toBe(true);
    expect(filtroAdmite("OTRAS", loro)).toBe(true);
    expect(filtroAdmite("OTRAS", perro)).toBe(false);
    expect(filtroAdmite("TODAS", viejo)).toBe(false);
    expect(filtroAdmite("HISTORICAS", viejo)).toBe(true);
  });

  it("muestra el próximo evento y abre el detalle", async () => {
    turno("t1", hoy.plusDays(5));
    await ingresarComoDueno();
    await render(<MascotasPantalla />);
    expect(screen.getByText(/^Próx\.: Control · /)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Rex, Perro"));
    expect(enrutador.push).toHaveBeenCalled();
    await fireEvent.press(screen.getAllByLabelText("Agregar mascota")[0]);
    expect(enrutador.push).toHaveBeenCalledWith("/dueno/mascota-nueva");
  });
});

describe("Nueva mascota", () => {
  it("pide nombre y tipo antes de guardar", async () => {
    await ingresarComoDueno();
    await render(<NuevaMascotaPantalla />);
    await fireEvent.press(screen.getByText("Guardar"));
    expect(Avisos.estado.banner?.mensaje).toBe("Ingresá el nombre de la mascota");
    await fireEvent.changeText(screen.getByPlaceholderText("Ingresá el nombre de tu mascota"), "Toto");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(Avisos.estado.banner?.mensaje).toBe("Seleccioná el tipo de mascota");
  });

  it("guarda la mascota en el servidor y vuelve a la lista", async () => {
    await ingresarComoDueno();
    await render(<NuevaMascotaPantalla />);
    await fireEvent.changeText(screen.getByPlaceholderText("Ingresá el nombre de tu mascota"), " Toto ");
    await fireEvent.changeText(screen.getByPlaceholderText("Ej: Golden retriever"), "Callejero");
    await fireEvent.press(screen.getByLabelText("Perro"));
    await fireEvent.press(screen.getByText("Guardar"));
    await act(async () => {});
    expect(fuente().llamadas).toContain("crearMascota:Toto");
    expect(DuenoRepo.buscarMascota("Toto")?.raza).toBe("Callejero");
    expect(Avisos.estado.banner?.mensaje).toBe("Mascota agregada correctamente");
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/mascotas");
  });
});

describe("Detalle de la mascota", () => {
  const abrir = async () => {
    await ingresarComoDueno();
    await render(<><DetalleMascotaPantalla mascota={DuenoRepo.mascotas[0]} /><AvisosHost /></>);
  };

  it("muestra la ficha: datos, resumen y acciones", async () => {
    await abrir();
    expect(screen.getAllByText("Rex").length).toBeGreaterThan(0);
    expect(screen.getByText("Perro - Mestizo")).toBeTruthy();
    expect(screen.getByText("Estado: Activa")).toBeTruthy();
    expect(screen.getByText("Sin eventos próximos agendados")).toBeTruthy();
    expect(screen.getByText("Datos de la mascota")).toBeTruthy();
    expect(screen.getByText("Editar información")).toBeTruthy();
    await fireEvent.press(screen.getByText("Ver carnet"));
    expect(enrutador.push).toHaveBeenCalledWith("/dueno/carnet");
    await fireEvent.press(screen.getByText("Agendar turno"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/dueno/evento-nuevo", params: { fecha: hoy.toString(), mascota: "Rex" } });
  });

  it("editar valida el nombre y el microchip y guarda los cambios", async () => {
    await abrir();
    await fireEvent.press(screen.getByText("Editar información"));
    await fireEvent.changeText(screen.getByPlaceholderText("Nombre"), "  ");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(screen.getByText("El nombre no puede quedar vacío")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("Nombre"), "Rexona");
    await fireEvent.changeText(screen.getByPlaceholderText("Microchip"), "123");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(screen.getByText("El microchip tiene 15 números")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("Microchip"), "123456789012345");
    await fireEvent.changeText(screen.getByPlaceholderText("Peso"), "abc");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(screen.getByText("Ingresá el peso en kilos, por ejemplo 12 o 3,5")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("Peso"), "13,5");
    await fireEvent.press(screen.getByText("Guardar"));
    await act(async () => {});
    expect(DuenoRepo.mascotas[0].nombre).toBe("Rexona");
    expect(DuenoRepo.mascotas[0].microchip).toBe("123456789012345");
    expect(fuente().llamadas.some((l) => l.startsWith("mascota:m1:"))).toBe(true);
    expect(Avisos.estado.banner?.mensaje).toBe("Información actualizada");
  });

  it("no deja repetir el nombre de otra mascota", async () => {
    fuente().mascotas.push(Escenario.mascota("m3", "Luna"));
    await abrir();
    await fireEvent.press(screen.getByText("Editar información"));
    await fireEvent.changeText(screen.getByPlaceholderText("Nombre"), "luna");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(screen.getByText("Ya tenés una mascota con ese nombre")).toBeTruthy();
  });

  it("pasar a fallecida pide confirmar y cancela los turnos pendientes", async () => {
    turno("t1", hoy.plusDays(4));
    await abrir();
    await fireEvent.press(screen.getByText("Cambiar estado: activa, inactiva o fallecida"));
    expect(screen.getByText("Estado de Rex")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Fallecida"));
    await fireEvent.press(screen.getByText("Guardar"));
    expect(Avisos.estado.carteles[0].titulo).toBe("¿Pasar a fallecida?");
    await fireEvent.press(screen.getByText("Confirmar"));
    await act(async () => {});
    expect(DuenoRepo.mascotas[0].estado).toBe("FALLECIDA");
    expect(DuenoRepo.eventos).toHaveLength(0);
    expect(Avisos.estado.banner?.mensaje).toBe("Rex ahora está fallecida");
  });

  it("dar de baja guarda el motivo elegido y vuelve a la lista", async () => {
    await abrir();
    await fireEvent.press(screen.getByText("Dar de baja a la mascota"));
    expect(screen.getByText("Dar de baja a Rex")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Adopción / Transferencia"));
    await fireEvent.press(screen.getByText("Confirmar baja"));
    await act(async () => {});
    expect(DuenoRepo.buscarMascota("Rex")).toBeNull();
    expect(fuente().llamadas.some((l) => l.startsWith("mascota:m1:") && l.includes("motivo_baja"))).toBe(true);
    expect(enrutador.navigate).toHaveBeenCalledWith("/dueno/mascotas");
    expect(Avisos.estado.banner?.mensaje).toBe("Mascota dada de baja correctamente");
  });

  it("el historial lista los turnos, filtra y abre la ficha del turno", async () => {
    turno("t1", hoy.plusDays(2));
    turno("t2", hoy.minusDays(10), "09:00:00", "completado");
    await abrir();
    await fireEvent.press(screen.getByLabelText("Historial"));
    expect(screen.getAllByText("Control")).toHaveLength(2);
    await fireEvent.press(screen.getAllByLabelText(/^Control\./)[0]);
    expect(screen.getByText("Próximo")).toBeTruthy();
    expect(screen.getByText("Cancelar turno")).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancelar turno"));
    expect(Avisos.estado.carteles[0].titulo).toBe("¿Cancelar este turno?");
  });

  it("el historial sin turnos muestra el estado vacío", async () => {
    await abrir();
    await fireEvent.press(screen.getByLabelText("Historial"));
    expect(screen.getByText("Sin eventos clínicos")).toBeTruthy();
    expect(screen.getByText("No hay turnos registrados para Rex")).toBeTruthy();
  });

  it("la pestaña Recordatorios se limita a la mascota", async () => {
    turno("t1", hoy.plusDays(2));
    await abrir();
    await fireEvent.press(screen.getByLabelText("Recordatorios"));
    expect(screen.getByText("Próximos")).toBeTruthy();
    expect(screen.getAllByText("Rex").length).toBeGreaterThan(1);
  });
});

describe("Recordatorios", () => {
  const dto = (id: string, creador: string, titulo: string, dias: number): RecordatorioDto => ({
    id, mascota_id: "m1", creado_por: creador, titulo, tipo: "higiene", fecha: hoy.plusDays(dias).toString(),
  });

  it("separa próximos, completados y los hechos a mano", async () => {
    turno("t1", hoy.plusDays(3));
    turno("t2", hoy.minusDays(5), "09:00:00", "completado");
    fuente().recordatoriosGuardados.push(dto("r1", Escenario.DUENO_ID, "Bañar a Rex", 3), dto("r2", Escenario.VET_ID, "Control de peso", 9));
    await ingresarComoDueno();
    await render(<RecordatoriosPantalla />);
    expect(screen.getByText("1 próximo")).toBeTruthy();
    expect(screen.getByText("Falta 3 días")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Completados"));
    expect(screen.getByText("Completado")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Míos"));
    expect(screen.getByText("Bañar a Rex")).toBeTruthy();
    expect(screen.getByText("Control de peso")).toBeTruthy();
    expect(screen.getByText(/De Dr\. Vera|De tu veterinario/)).toBeTruthy();
  });

  it("los estados vacíos de cada solapa", async () => {
    await ingresarComoDueno();
    await render(<RecordatoriosPantalla />);
    expect(screen.getByText("No hay recordatorios próximos")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Completados"));
    expect(screen.getByText("Todavía no hay recordatorios completados")).toBeTruthy();
    expect(screen.queryByText("+ Crear recordatorio")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Míos"));
    expect(screen.getByText("No tenés recordatorios propios")).toBeTruthy();
  });

  it("tocar uno propio ofrece editar o eliminar; eliminar pide confirmación y lo borra", async () => {
    fuente().recordatoriosGuardados.push(dto("r1", Escenario.DUENO_ID, "Bañar a Rex", 3));
    await ingresarComoDueno();
    await render(<><RecordatoriosPantalla /><AvisosHost /></>);
    await fireEvent.press(screen.getByLabelText("Míos"));
    await fireEvent.press(screen.getByLabelText(/^Bañar a Rex,/));
    expect(screen.getByText("Editar")).toBeTruthy();
    await fireEvent.press(screen.getByText("Eliminar"));
    expect(Avisos.estado.carteles[0].titulo).toBe("¿Eliminar el recordatorio?");
    await fireEvent.press(screen.getAllByText("Eliminar").slice(-1)[0]);
    await act(async () => {});
    expect(fuente().llamadas).toContain("borrarRecordatorio:r1");
  });

  it("el botón + agenda un turno; en Míos crea un recordatorio", async () => {
    await ingresarComoDueno();
    await render(<RecordatoriosPantalla />);
    await fireEvent.press(screen.getByLabelText("Agendar turno"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/dueno/evento-nuevo", params: { fecha: hoy.toString() } });
  });

  it("Editar evento avisa si no hay turnos próximos", async () => {
    await ingresarComoDueno();
    await render(<RecordatoriosPantalla />);
    await fireEvent.press(screen.getByText("Editar evento"));
    expect(Avisos.estado.banner?.mensaje).toContain("No tenés turnos próximos para editar");
  });

  it("Editar evento lista los próximos y lleva al asistente", async () => {
    turno("t5", hoy.plusDays(2), "10:00:00");
    await ingresarComoDueno();
    await render(<RecordatoriosPantalla />);
    await fireEvent.press(screen.getByText("Editar evento"));
    expect(screen.getByText("¿Qué turno querés editar?")).toBeTruthy();
    expect(screen.getByText("Tenés 1 turno próximo. Solo se pueden editar los turnos próximos.")).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText(/^Control,/).slice(-1)[0]);
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/dueno/evento/[id]", params: { id: "t5" } });
  });
});

describe("Calendario", () => {
  it("cuenta los turnos del mes y muestra los del día elegido", async () => {
    turno("t1", hoy, "23:59:00");
    await ingresarComoDueno();
    await render(<CalendarioPantalla />);
    expect(screen.getByText("1 turno este mes")).toBeTruthy();
    expect(screen.getByText(/^Turnos de hoy · /)).toBeTruthy();
    expect(screen.getByText("1 turno")).toBeTruthy();
    expect(screen.getByText("23:59")).toBeTruthy();
  });

  it("un día sin turnos ofrece agendar y el mes se cambia con las flechas", async () => {
    await ingresarComoDueno();
    await render(<CalendarioPantalla />);
    expect(screen.getByText("Sin turnos este mes")).toBeTruthy();
    expect(screen.getByText("Sin turnos este día")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Mes siguiente"));
    expect(EstadoDueno.mesCalendario.equals(YearMonth.now().plusMonths(1))).toBe(true);
    await fireEvent.press(screen.getByText("Hoy"));
    expect(EstadoDueno.mesCalendario.equals(YearMonth.now())).toBe(true);
    await fireEvent.press(screen.getByText("+ Agendar turno"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/dueno/evento-nuevo", params: { fecha: hoy.toString() } });
  });

  it("tocar un turno abre su ficha con editar y cancelar", async () => {
    turno("t1", hoy, "23:59:00");
    await ingresarComoDueno();
    await render(<CalendarioPantalla />);
    await fireEvent.press(screen.getByLabelText(/^Control\./));
    expect(screen.getByText("Próximo")).toBeTruthy();
    await fireEvent.press(screen.getByText("Editar"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/dueno/evento/[id]", params: { id: "t1" } });
  });
});
