/* Migrado de app/src/test/.../RecordatoriosTest.kt. */
import "./soporte/pruebaBase";
import { Recordatorios } from "../src/data/avisos/recordatorios";
import type { EstadoEvento, EventoVet } from "../src/data/repositorio/agendaRepo";
import { EventoMascota, type EstadoTurno } from "../src/model/modelos";
import { LocalDate, LocalDateTime } from "../src/util/tiempo";

const ahora = LocalDateTime.of(2026, 10, 12, 9, 0);

function turno(id: string, fecha: LocalDate, hora: string, estado: EstadoTurno = "PENDIENTE"): EventoMascota {
  return new EventoMascota("Control", "Rex", "Dr. Vera", hora, "", fecha, { id, mascotaId: "m1", estado });
}

function eventoVet(id: string, pacienteId: string, fecha: LocalDate, hora: string, estado: EstadoEvento): EventoVet {
  return {
    id, pacienteId, tipo: "Control", motivo: "Control", fecha, hora, estado, notas: "", veterinario: "Dr. Vera",
    veterinarioId: null, duracionMin: 30, sedeId: null,
  };
}

const iguales = (a: LocalDateTime, b: LocalDateTime) => expect(a.equals(b)).toBe(true);

test("vacunas_avisanUnaSemanaAntesYElDiaDeLaDosis", () => {
  const vacuna = new Recordatorios.VacunaProxima("r1", "Rex", "Antirrábica", LocalDate.of(2026, 10, 30));

  const avisos = Recordatorios.paraVacunas([vacuna], ahora);

  expect(avisos).toHaveLength(2);
  iguales(avisos[0].momento, LocalDateTime.of(2026, 10, 23, 10, 0));
  iguales(avisos[1].momento, LocalDateTime.of(2026, 10, 30, 10, 0));
  expect(avisos[0].mensaje.includes("Rex") && avisos[0].mensaje.includes("Antirrábica")).toBe(true);
});

test("vacunas_unaVencidaAvisaUnaSolaVezALasDiez", () => {
  const vacuna = new Recordatorios.VacunaProxima("r1", "Rex", "Antirrábica", LocalDate.of(2026, 10, 1));

  const avisos = Recordatorios.paraVacunas([vacuna], ahora);
  expect(avisos).toHaveLength(1);
  iguales(avisos[0].momento, LocalDateTime.of(2026, 10, 12, 10, 0));
  expect(avisos[0].titulo.toLowerCase()).toContain("vencida");

  // Ya salió: no se vuelve a programar
  expect(Recordatorios.paraVacunas([vacuna], ahora, new Set([avisos[0].id]))).toHaveLength(0);
});

test("vacunas_lasMuyVencidasNoAvisan", () => {
  const vacuna = new Recordatorios.VacunaProxima("r1", "Rex", "Antirrábica", LocalDate.of(2026, 5, 1));

  expect(Recordatorios.paraVacunas([vacuna], ahora)).toHaveLength(0);
});

test("medicacion_avisaCadaTomaDeLosProximosDosDias", () => {
  const inicio = ahora.minusHours(1);
  const m = new Recordatorios.Medicacion("p1", "Rex", "Amoxicilina", "250 mg", 8, inicio, 3);

  const avisos = Recordatorios.paraMedicacion([m], ahora);

  expect(avisos).toHaveLength(6);
  iguales(avisos[0].momento, LocalDateTime.of(2026, 10, 12, 16, 0));
  iguales(avisos[1].momento, LocalDateTime.of(2026, 10, 13, 0, 0));
  expect(avisos[0].mensaje.includes("Amoxicilina") && avisos[0].mensaje.includes("250 mg")).toBe(true);
});

test("medicacion_noPasaDeLosDiasIndicados", () => {
  const m = new Recordatorios.Medicacion("p1", "Rex", "Amoxicilina", "", 8, ahora.minusHours(1), 1);

  const avisos = Recordatorios.paraMedicacion([m], ahora);

  // El tratamiento termina mañana a las 8: quedan las tomas de las 16 y las 00
  expect(avisos).toHaveLength(2);
});

test("dueno_avisaUnDiaYDosHorasAntes", () => {
  const avisos = Recordatorios.paraDueno([turno("t1", LocalDate.of(2026, 10, 14), "16:00")], ahora);

  expect(avisos).toHaveLength(2);
  iguales(avisos[0].momento, LocalDateTime.of(2026, 10, 13, 16, 0));
  iguales(avisos[1].momento, LocalDateTime.of(2026, 10, 14, 14, 0));
  expect(avisos[0].mensaje).toContain("Rex");
  expect(avisos[1].titulo).toContain("2 horas");
});

test("dueno_noAvisaDeLoQueYaPasoNiDeLosCompletadosOCancelados", () => {
  const avisos = Recordatorios.paraDueno(
    [
      turno("pasado", LocalDate.of(2026, 10, 11), "10:00"),
      turno("hecho", LocalDate.of(2026, 10, 15), "10:00", "COMPLETADO"),
      turno("cancelado", LocalDate.of(2026, 10, 15), "11:00", "CANCELADO"),
    ],
    ahora,
  );

  expect(avisos).toHaveLength(0);
});

test("dueno_unTurnoDeHoyMasTardeSoloAvisaLasDosHorasAntes", () => {
  const avisos = Recordatorios.paraDueno([turno("t1", LocalDate.of(2026, 10, 12), "16:00")], ahora);

  expect(avisos).toHaveLength(1);
  iguales(avisos[0].momento, LocalDateTime.of(2026, 10, 12, 14, 0));
});

test("veterinario_avisaUnaHoraAntesYArmaElResumenDelDia", () => {
  const dia = LocalDate.of(2026, 10, 13);
  const eventos = [
    eventoVet("a", "m1", dia, "10:00", "PENDIENTE"),
    eventoVet("b", "m2", dia, "11:30", "PENDIENTE"),
    eventoVet("c", "m1", dia, "12:00", "COMPLETADO"),
  ];

  const avisos = Recordatorios.paraVeterinario(eventos, ahora);

  expect(avisos).toHaveLength(3);
  const resumen = avisos.find((a) => a.titulo === "Tu agenda de hoy")!;
  iguales(resumen.momento, LocalDateTime.of(2026, 10, 13, 8, 0));
  expect(resumen.mensaje).toBe("Tenés 2 turnos hoy");
  const horas = avisos.filter((a) => a.titulo.startsWith("Próximo turno")).map((a) => a.momento.toString()).sort();
  expect(horas).toEqual([LocalDateTime.of(2026, 10, 13, 9, 0).toString(), LocalDateTime.of(2026, 10, 13, 10, 30).toString()]);
});
