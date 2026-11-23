/*
 * Migrado de ui/common/Documentos.kt (la parte de contenido). El dibujo en la hoja y el archivo PDF están en
 * DocumentosPdf.ts.
 */
import type { RegistroSalud } from "../../data/repositorio/saludRepo";
import { posologia, type Prescripcion } from "../../model/clinica";
import { Fechas } from "../../util/fechas";
import type { LocalDate } from "../../util/tiempo";

/*
 * Documentos en PDF que arma el veterinario con su matrícula: la receta de una consulta y los certificados de
 * vacunación y de salud.
 *
 * Primero se arma el contenido ([Plano]) y después se dibuja en la hoja: así lo que se imprime se puede probar
 * sin generar el archivo.
 */

/** Quién firma: sale del perfil del veterinario. */
export interface Profesional {
  nombre: string;
  matricula: string;
  clinica: string;
  direccion: string;
  telefono: string;
}

/** El animal y su propietario tal como se imprimen. */
export interface DatosPaciente {
  nombre: string;
  especie: string;
  raza: string;
  sexo: string;
  edad: string;
  peso: string;
  microchip: string;
  propietario: string;
}

/** Crea un [Profesional] con los valores por defecto del Kotlin (clínica, dirección y teléfono vacíos). */
export function crearProfesional(
  p: Pick<Profesional, "nombre" | "matricula"> & Partial<Profesional>,
): Profesional {
  return { clinica: "", direccion: "", telefono: "", ...p };
}

/** Crea un [DatosPaciente] con los valores por defecto del Kotlin (todo vacío salvo nombre y especie). */
export function crearDatosPaciente(
  d: Pick<DatosPaciente, "nombre" | "especie"> & Partial<DatosPaciente>,
): DatosPaciente {
  return { raza: "", sexo: "", edad: "", peso: "", microchip: "", propietario: "", ...d };
}

// ---------- Contenido ----------

/** Un elemento del documento, en el orden en que se imprime. */
export type Bloque =
  | { tipo: "encabezado"; profesional: Profesional }
  | { tipo: "titulo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "texto"; texto: string; negrita: boolean; gris: boolean; sangria: number }
  | { tipo: "paciente"; datos: DatosPaciente; fecha: LocalDate }
  | { tipo: "espacio"; puntos: number }
  | { tipo: "firma"; profesional: Profesional };

export class Plano {
  constructor(
    readonly tipo: string,
    readonly paciente: DatosPaciente,
    readonly fecha: LocalDate,
    readonly bloques: Bloque[],
  ) {}

  /** Todo lo que lleva escrito el documento, una línea por elemento. */
  texto(): string {
    return this.bloques
      .flatMap((b): string[] => {
        switch (b.tipo) {
          case "encabezado":
            return [
              b.profesional.clinica.trim() === "" ? "PetCare" : b.profesional.clinica,
              `${b.profesional.nombre} · Matrícula ${b.profesional.matricula}`,
            ];
          case "titulo":
          case "subtitulo":
          case "texto":
            return [b.texto];
          case "paciente":
            return [
              `Fecha: ${Fechas.larga(b.fecha)}`,
              b.datos.nombre,
              [b.datos.especie, b.datos.raza, b.datos.sexo, b.datos.edad, b.datos.peso]
                .filter((s) => s.trim() !== "")
                .join(" · "),
              `Propietario: ${b.datos.propietario}`,
            ];
          case "firma":
            return [b.profesional.nombre, `Matrícula ${b.profesional.matricula}`];
          case "espacio":
            return [];
        }
      })
      .join("\n");
  }
}

class Constructor {
  readonly bloques: Bloque[] = [];
  encabezado(p: Profesional): void {
    this.bloques.push({ tipo: "encabezado", profesional: p });
  }
  titulo(t: string): void {
    this.bloques.push({ tipo: "titulo", texto: t });
  }
  subtitulo(t: string): void {
    this.bloques.push({ tipo: "subtitulo", texto: t });
  }
  texto(t: string, opciones: { negrita?: boolean; gris?: boolean; sangria?: number } = {}): void {
    this.bloques.push({
      tipo: "texto", texto: t, negrita: opciones.negrita ?? false, gris: opciones.gris ?? false,
      sangria: opciones.sangria ?? 0,
    });
  }
  paciente(d: DatosPaciente, f: LocalDate): void {
    this.bloques.push({ tipo: "paciente", datos: d, fecha: f });
  }
  espacio(p: number): void {
    this.bloques.push({ tipo: "espacio", puntos: p });
  }
  firma(p: Profesional): void {
    this.bloques.push({ tipo: "firma", profesional: p });
  }
}

function plano(tipo: string, paciente: DatosPaciente, fecha: LocalDate, armar: (c: Constructor) => void): Plano {
  const c = new Constructor();
  armar(c);
  return new Plano(tipo, paciente, fecha, c.bloques);
}

export function planoDeReceta(
  profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate, medicamentos: Prescripcion[],
  indicaciones = "",
): Plano {
  return plano("receta", paciente, fecha, (d) => {
    d.encabezado(profesional);
    d.titulo("RECETA VETERINARIA");
    d.paciente(paciente, fecha);
    d.subtitulo("Indicaciones");
    if (medicamentos.length === 0) d.texto("Sin medicamentos indicados.");
    medicamentos.forEach((m, i) => {
      d.texto(`${i + 1}. ${m.medicamento}`, { negrita: true });
      const pos = posologia(m);
      if (pos.trim() !== "") d.texto(pos, { sangria: 18 });
      if (m.indicaciones.trim() !== "") d.texto(m.indicaciones, { sangria: 18, gris: true });
      d.espacio(6);
    });
    if (indicaciones.trim() !== "") {
      d.espacio(4);
      d.subtitulo("Recomendaciones");
      d.texto(indicaciones);
    }
    d.firma(profesional);
  });
}

export function planoDeCertificadoVacunacion(
  profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate, vacunas: RegistroSalud[],
): Plano {
  return plano("certificado-vacunacion", paciente, fecha, (d) => {
    d.encabezado(profesional);
    d.titulo("CERTIFICADO DE VACUNACIÓN");
    d.paciente(paciente, fecha);
    d.texto(
      `Quien suscribe, ${profesional.nombre}, Médico/a Veterinario/a, matrícula ${profesional.matricula}, ` +
        "certifica que el animal arriba identificado tiene registradas las siguientes vacunas:",
    );
    d.espacio(8);
    if (vacunas.length === 0) d.texto("No hay vacunas registradas.", { gris: true });
    // Orden por el texto de la fecha, como el sortedBy del Kotlin (estable)
    const ordenadas = [...vacunas].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    for (const v of ordenadas) {
      d.texto(`${v.titulo} — ${v.fecha}`, { negrita: true });
      const detalle = [
        v.marca != null ? `Producto: ${v.marca}` : null,
        v.lote != null ? `Lote: ${v.lote}` : null,
        v.loteVencimiento != null ? `Vencimiento del lote: ${Fechas.corta(v.loteVencimiento)}` : null,
        v.proximaDosis != null ? `Próxima dosis: ${Fechas.corta(v.proximaDosis)}` : null,
      ]
        .filter((x): x is string => x !== null)
        .join("  ·  ");
      if (detalle.trim() !== "") d.texto(detalle, { sangria: 18, gris: true });
      d.espacio(6);
    }
    d.espacio(4);
    d.texto(
      "Para traslados oficiales, verificá los requisitos vigentes del SENASA y de la empresa de transporte.",
      { gris: true },
    );
    d.firma(profesional);
  });
}

export function planoDeCertificadoSalud(
  profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate, observaciones = "",
): Plano {
  return plano("certificado-salud", paciente, fecha, (d) => {
    d.encabezado(profesional);
    d.titulo("CERTIFICADO DE SALUD");
    d.paciente(paciente, fecha);
    d.texto(
      `Quien suscribe, ${profesional.nombre}, Médico/a Veterinario/a, matrícula ${profesional.matricula}, ` +
        "certifica que el animal arriba identificado fue examinado clínicamente en la fecha " +
        `${Fechas.larga(fecha)} y se encuentra en buen estado de salud aparente, sin signos clínicos de ` +
        "enfermedades infectocontagiosas, apto para ser trasladado.",
    );
    d.espacio(8);
    if (observaciones.trim() !== "") {
      d.subtitulo("Observaciones");
      d.texto(observaciones);
      d.espacio(8);
    }
    d.texto("Este certificado tiene una validez de 10 días desde su emisión.", { gris: true });
    d.firma(profesional);
  });
}

/** Nombre del archivo: tipo, paciente y fecha, por ejemplo `receta-rex-2026-10-12.pdf`. */
export function nombreDeArchivo(p: Plano): string {
  const paciente =
    p.paciente.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "mascota";
  return `${p.tipo}-${paciente}-${p.fecha.toString()}.pdf`;
}

/** Agrupa las funciones con la misma forma de uso que el `object Documentos` del Kotlin. */
export const Documentos = {
  planoDeReceta,
  planoDeCertificadoVacunacion,
  planoDeCertificadoSalud,
  nombreDeArchivo,
};
