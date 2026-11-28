/* Bloqueos de agenda: la pausa de cada lugar, los bloqueos puntuales y qué pasa con los turnos ya dados. */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { fijarRuta } from "../../soporte/rutas";
import { fuente, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { Escenario } from "../../soporte/fuenteEnMemoria";
import { AgendaRepo } from "../../../src/data/repositorio/agendaRepo";
import { BloqueosRepo } from "../../../src/data/repositorio/bloqueosRepo";
import { DisponibilidadVet } from "../../../src/data/repositorio/disponibilidadVet";
import { PerfilVetRepo } from "../../../src/data/repositorio/perfilVetRepo";
import { bloqueoQuePisa, pisaPausa, textoBloqueo, turnosQuePisan, type Bloqueo } from "../../../src/model/bloqueos";
import { crearSede } from "../../../src/model/modelos";
import { LocalDate, LocalDateTime } from "../../../src/util/tiempo";
import { Avisos } from "../../../src/ui/common/Avisos";
import { AgendaVet } from "../../../src/ui/veterinario/AgendaVet";
import { entrarComoVeterinario, fijarHoy, liberarHoy } from "./escenarioDetalleVet";

/** Lunes 23/11/2026: el veterinario atiende de 9 a 12; Rex tiene turno a las 10 (t1). */
const HOY = LocalDate.of(2026, 11, 23);

const bloqueo = (desde: LocalDateTime, hasta: LocalDateTime, motivo = "Cirugía"): Bloqueo => ({
  id: "b", veterinarioId: Escenario.VET_ID, desde, hasta, motivo,
});

describe("reglas de los bloqueos", () => {
  it("un bloqueo pisa los turnos que se cruzan con él, no los que terminan justo antes", () => {
    const b = bloqueo(LocalDateTime.of(2026, 11, 23, 10, 0), LocalDateTime.of(2026, 11, 23, 11, 0));
    expect(bloqueoQuePisa([b], HOY, "10:30", 30)).toBe(b);
    expect(bloqueoQuePisa([b], HOY, "09:30", 60)).toBe(b);
    expect(bloqueoQuePisa([b], HOY, "09:30", 30)).toBeNull();
    expect(bloqueoQuePisa([b], HOY, "11:00", 30)).toBeNull();
    expect(bloqueoQuePisa([b], HOY.plusDays(1), "10:30", 30)).toBeNull();
  });

  it("la pausa del lugar", () => {
    const sede = crearSede({ id: "s", nombre: "Centro", apertura: "09:00", cierre: "18:00", pausaDesde: "13:00", pausaHasta: "14:00" });
    expect(pisaPausa(sede, "13:30", 30)).toBe(true);
    expect(pisaPausa(sede, "12:30", 60)).toBe(true);
    expect(pisaPausa(sede, "12:30", 30)).toBe(false);
    expect(pisaPausa(sede, "14:00", 30)).toBe(false);
    expect(pisaPausa(crearSede({ id: "s", nombre: "Sin pausa" }), "13:30", 30)).toBe(false);
  });

  it("cómo se lee un bloqueo", () => {
    expect(textoBloqueo(bloqueo(LocalDateTime.of(2026, 11, 30, 0, 0), LocalDateTime.of(2026, 12, 1, 0, 0)))).toBe("Lunes 30/11, todo el día");
    expect(textoBloqueo(bloqueo(LocalDateTime.of(2026, 11, 30, 13, 0), LocalDateTime.of(2026, 11, 30, 17, 0)))).toBe("Lunes 30/11 de 13:00 a 17:00");
    expect(textoBloqueo(bloqueo(LocalDateTime.of(2026, 11, 30, 0, 0), LocalDateTime.of(2026, 12, 5, 0, 0)))).toBe("Del 30/11 al 4/12");
  });

  it("cuenta los turnos pendientes y futuros que caen adentro", () => {
    const ahora = LocalDateTime.of(2026, 11, 23, 8, 0);
    const turnos = [
      { fecha: HOY, hora: "10:00", duracionMin: 30, estado: "PENDIENTE" },
      { fecha: HOY, hora: "11:00", duracionMin: 30, estado: "CANCELADO" },
      { fecha: HOY.plusDays(1), hora: "10:00", duracionMin: 30, estado: "PENDIENTE" },
    ];
    expect(turnosQuePisan(turnos, LocalDateTime.ofDate(HOY), LocalDateTime.ofDate(HOY.plusDays(1)), ahora)).toBe(1);
  });
});

describe("agenda del veterinario con bloqueos", () => {
  beforeEach(async () => {
    fijarHoy();
    prepararServicios();
    fijarRuta();
    Avisos.reiniciar();
    await entrarComoVeterinario(fuente());
  });
  afterEach(() => {
    liberarHoy();
    limpiarServicios();
    Avisos.reiniciar();
  });

  it("la pausa y los bloqueos no se ofrecen y explican por qué", async () => {
    PerfilVetRepo.sedes[0] = { ...PerfilVetRepo.sedes[0], pausaDesde: "11:00", pausaHasta: "11:30" };
    fuente().bloqueosGuardados.push({
      id: "b1", veterinario_id: Escenario.VET_ID, desde: "2026-11-23T09:00:00", hasta: "2026-11-23T09:30:00", motivo: "Trámite personal",
    });
    await BloqueosRepo.cargar([Escenario.VET_ID]);

    const libres = DisponibilidadVet.horarios(HOY, 30).filter((h) => h.libre).map((h) => h.hora);
    expect(libres).toEqual(["09:30", "10:30", "11:30"]);
    expect(DisponibilidadVet.validar(HOY, "11:00", 30)).toBe("Ese horario es tu pausa (11:00 a 11:30 hs)");
    expect(DisponibilidadVet.validar(HOY, "09:00", 30)).toBe("Bloqueaste la agenda en ese horario (Trámite personal)");
  });

  it("bloquear el día con un turno dado: se cancela, se avisa y se ofrece escribirle al dueño", async () => {
    await render(<AgendaVet />);
    await fireEvent.press(screen.getByLabelText("Bloquear horario"));
    expect(screen.getByText("Bloqueos de agenda")).toBeTruthy();
    expect(screen.getByText("No tenés horarios bloqueados.")).toBeTruthy();

    await fireEvent.press(screen.getAllByRole("button", { name: "Bloquear horario" }).at(-1)!);
    // Por defecto: hoy, todo el día, por una cirugía. Rex tiene turno a las 10
    expect(screen.getByText("Hay 1 turno dado en ese horario")).toBeTruthy();
    await fireEvent.press(screen.getByText("Bloquear y cancelar el turno"));
    await act(async () => {});

    expect(fuente().llamadas).toContain("crearBloqueo:vet-1:2026-11-23T00:00:00:2026-11-24T00:00:00:Cirugía:true");
    expect(fuente().turnosGuardados.find((t) => t.id === "t1")?.estado).toBe("cancelado");
    expect(screen.getByText("Horario bloqueado")).toBeTruthy();
    expect(screen.getByText(/^Rex · /)).toBeTruthy();
    expect(screen.getByText("Escribir por WhatsApp")).toBeTruthy();

    await fireEvent.press(screen.getByText("Listo"));
    await act(async () => {});
    expect(screen.getByText("Bloqueado: Cirugía")).toBeTruthy();
    expect(screen.getAllByText("Lunes 23/11, todo el día")).toHaveLength(2);
    expect(screen.getByLabelText("Agenda bloqueada: Cirugía, Lunes 23/11, todo el día")).toBeTruthy();
    expect(AgendaRepo.porId("t1")?.estado).toBe("CANCELADO");
  });

  it("se puede bloquear dejando los turnos, y quitar el bloqueo", async () => {
    await render(<AgendaVet />);
    await fireEvent.press(screen.getByLabelText("Bloquear horario"));
    await fireEvent.press(screen.getAllByRole("button", { name: "Bloquear horario" }).at(-1)!);
    await fireEvent.press(screen.getByText("Feriado"));
    await fireEvent.press(screen.getByText("Bloquear y dejar los turnos"));
    await act(async () => {});
    expect(fuente().turnosGuardados.find((t) => t.id === "t1")?.estado).toBe("pendiente");
    expect(screen.getByText("Estos turnos quedaron en pie. Avisales a los dueños para pasarlos a otro día.")).toBeTruthy();

    await fireEvent.press(screen.getByText("Listo"));
    await fireEvent.press(screen.getByRole("button", { name: "Quitar" }));
    await act(async () => {
      Avisos.cerrarCartel(Avisos.estado.carteles[0].id, true);
    });
    await act(async () => {});
    expect(fuente().llamadas).toContain("eliminarBloqueo:bloq-1");
    expect(BloqueosRepo.de(Escenario.VET_ID)).toHaveLength(0);
  });
});
