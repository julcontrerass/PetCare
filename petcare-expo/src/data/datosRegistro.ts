/*
 * Migrado de data/DatosRegistro.kt. En Android viajaban entre pantallas como Serializable; acá son objetos
 * comunes que las pantallas del registro se pasan por un módulo de estado.
 */
import type { CertificadoElegido } from "./repositorio/especialidadesRepo";
import type { SedeVet } from "../model/modelos";

/** Mascota cargada durante el registro del dueño. */
export interface MascotaRegistro {
  nombre: string;
  tipo: string;
  sexo: string;
  raza: string;
  nacimiento: string;
  fotoPath: string | null;
  peso: string;
  color: string;
  microchip: string;
  observaciones: string;
}

export function crearMascotaRegistro(
  m: Partial<MascotaRegistro> & { nombre: string; tipo: string; sexo: string },
): MascotaRegistro {
  return {
    nombre: m.nombre,
    tipo: m.tipo,
    sexo: m.sexo,
    raza: m.raza ?? "",
    nacimiento: m.nacimiento ?? "",
    fotoPath: m.fotoPath ?? null,
    peso: m.peso ?? "",
    color: m.color ?? "",
    microchip: m.microchip ?? "",
    observaciones: m.observaciones ?? "",
  };
}

/** Todo lo que se pide al dueño al crear su cuenta. */
export interface DatosRegistroDueno {
  nombre: string;
  dni: string;
  telefono: string;
  direccion: string;
  email: string;
  password: string;
  fotoPath: string | null;
  mascotas: MascotaRegistro[];
}

export function crearDatosRegistroDueno(
  d: Partial<DatosRegistroDueno> & {
    nombre: string; dni: string; telefono: string; direccion: string; email: string; password: string;
  },
): DatosRegistroDueno {
  return { ...d, fotoPath: d.fotoPath ?? null, mascotas: d.mascotas ?? [] };
}

/** Todo lo que se pide al veterinario al crear su cuenta. */
export interface DatosRegistroVeterinario {
  nombre: string;
  dni: string;
  telefono: string;
  email: string;
  password: string;
  matricula: string;
  clinica: string;
  direccionClinica: string;
  especialidades: string[];
  /** Tipos de animal que atiende, con los nombres de TiposMascota. */
  tiposAnimales: string[];
  /** Días de atención como en la base: 1 = lunes ... 7 = domingo. */
  dias: number[];
  apertura: string;
  cierre: string;
  fotoPath: string | null;
  /** Foto del carnet o matrícula, en el teléfono: el administrador la ve para dar el alta. */
  credencialPath: string | null;
  /** Otros lugares donde atiende, además del primero (que es la clínica, la dirección, los días y el horario de arriba). */
  sedesExtra: SedeVet[];
  /** Títulos de especialidades que adjuntó al registrarse (opcional: también los puede subir después). */
  certificados: CertificadoElegido[];
}

export function crearDatosRegistroVeterinario(
  d: Partial<DatosRegistroVeterinario> & {
    nombre: string; dni: string; telefono: string; email: string; password: string; matricula: string;
    clinica: string; direccionClinica: string; especialidades: string[]; dias: number[];
    apertura: string; cierre: string;
  },
): DatosRegistroVeterinario {
  return {
    ...d,
    tiposAnimales: d.tiposAnimales ?? [],
    fotoPath: d.fotoPath ?? null,
    credencialPath: d.credencialPath ?? null,
    sedesExtra: d.sedesExtra ?? [],
    certificados: d.certificados ?? [],
  };
}
