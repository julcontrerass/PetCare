/*
 * Historia clínica completa de una mascota, para exportarla en PDF y compartirla (con otro veterinario, una guardería,
 * un viaje...). La arman el veterinario (con los informes de cada consulta) o el dueño (con su carnet de salud, las
 * recetas y los turnos completados); después [planoDeHistoriaClinica] la pasa a una hoja.
 */
import { posologia, TEXTO_COMIDA, type Prescripcion } from "../model/clinica";
import type { EventoMascota } from "../model/modelos";
import { Fechas } from "../util/fechas";
import type { LocalDate } from "../util/tiempo";
import type { InformeData } from "./repositorio/informesRepo";
import type { RegistroSalud } from "./repositorio/saludRepo";

/** Una línea de la historia: cuándo, qué y los detalles. */
export interface EntradaHistoria {
  fecha: string;
  titulo: string;
  lineas: string[];
}

export interface HistoriaClinica {
  vacunas: EntradaHistoria[];
  desparasitaciones: EntradaHistoria[];
  /** Cirugías y tratamientos cargados en el carnet. */
  procedimientos: EntradaHistoria[];
  medicamentos: EntradaHistoria[];
  consultas: EntradaHistoria[];
  /** Documentos y estudios adjuntos (solo el nombre: los archivos no van en el PDF). */
  documentos: EntradaHistoria[];
}

const conTexto = (s: string | null | undefined): s is string => !!s && s.trim() !== "" && s.trim() !== "Sin datos";

function deRegistro(r: RegistroSalud): EntradaHistoria {
  const lineas: string[] = [];
  if (conTexto(r.detalle) && r.detalle !== "Sin indicaciones" && r.detalle !== "Sin detalles") lineas.push(r.detalle);
  const producto = [r.marca, r.lote ? `lote ${r.lote}` : null].filter(conTexto).join(" · ");
  if (producto) lineas.push(producto);
  if (r.proximaDosis) lineas.push(`Próxima dosis: ${Fechas.corta(r.proximaDosis)}`);
  return { fecha: r.fecha, titulo: r.titulo, lineas };
}

function deReceta(p: Prescripcion): EntradaHistoria {
  const lineas = [posologia(p)];
  if (p.conComida) lineas.push(TEXTO_COMIDA[p.conComida]);
  if (conTexto(p.indicaciones)) lineas.push(p.indicaciones);
  if (p.suspendida) lineas.push(`Suspendido${p.motivoSuspension ? `: ${p.motivoSuspension}` : ""}`);
  return { fecha: Fechas.corta(p.inicio), titulo: p.dosis.trim() ? `${p.medicamento} ${p.dosis}` : p.medicamento, lineas: lineas.filter(conTexto) };
}

/** Lo que el carnet y las recetas tienen en común para el veterinario y el dueño. */
function base(registros: readonly RegistroSalud[], recetas: readonly Prescripcion[]): Omit<HistoriaClinica, "consultas"> {
  const porFecha = (a: { fechaAplicada: LocalDate | null }, b: { fechaAplicada: LocalDate | null }) =>
    (b.fechaAplicada?.toEpochDay() ?? 0) - (a.fechaAplicada?.toEpochDay() ?? 0);
  const de = (tipo: RegistroSalud["tipo"]) => registros.filter((r) => r.tipo === tipo).sort(porFecha).map(deRegistro);
  return {
    vacunas: de("VACUNA"),
    desparasitaciones: de("DESPARASITACION"),
    procedimientos: [...de("CIRUGIA"), ...de("TRATAMIENTO")],
    medicamentos: [...recetas].sort((a, b) => b.inicio.toEpochDay() - a.inicio.toEpochDay()).map(deReceta),
    documentos: registros.filter((r) => r.tipo === "DOCUMENTO").sort(porFecha).map((r) => ({ fecha: r.fecha, titulo: r.titulo, lineas: [] })),
  };
}

/** Para el veterinario: cada consulta completada con lo que escribió en el informe. */
export function historiaDelVeterinario(
  registros: readonly RegistroSalud[], recetas: readonly Prescripcion[],
  consultas: readonly { fecha: LocalDate; tipo: string; motivo: string; veterinario: string; informe: InformeData | null }[],
): HistoriaClinica {
  return {
    ...base(registros, recetas),
    consultas: [...consultas]
      .sort((a, b) => b.fecha.toEpochDay() - a.fecha.toEpochDay())
      .map((c) => {
        const i = c.informe;
        const lineas = [
          c.motivo !== c.tipo ? `Motivo: ${c.motivo}` : "",
          i && conTexto(i.diagnostico) ? `Diagnóstico: ${i.diagnostico}` : "",
          i && conTexto(i.tratamiento) ? `Tratamiento: ${i.tratamiento}` : "",
          conTexto(c.veterinario) ? `Atendió: ${c.veterinario}` : "",
        ];
        return { fecha: Fechas.corta(c.fecha), titulo: c.tipo, lineas: lineas.filter(conTexto) };
      }),
  };
}

/** Para el dueño: los turnos completados con quién lo atendió y lo que anotó. */
export function historiaDelDueno(registros: readonly RegistroSalud[], recetas: readonly Prescripcion[], turnos: readonly EventoMascota[]): HistoriaClinica {
  return {
    ...base(registros, recetas),
    consultas: turnos
      .filter((e) => e.estado === "COMPLETADO")
      .sort((a, b) => b.fecha.toEpochDay() - a.fecha.toEpochDay())
      .map((e) => ({
        fecha: Fechas.corta(e.fecha),
        titulo: e.categoria,
        lineas: [conTexto(e.veterinario) ? `Atendió: ${e.veterinario}` : "", conTexto(e.observaciones) ? e.observaciones : ""].filter(conTexto),
      })),
  };
}

/** True si no hay nada para exportar. */
export function historiaVacia(h: HistoriaClinica): boolean {
  return Object.values(h).every((lista: EntradaHistoria[]) => lista.length === 0);
}
