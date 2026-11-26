/* Migrado de data/Registro.kt */
import { Fechas } from "../util/fechas";
import type { DatosRegistroDueno, DatosRegistroVeterinario, MascotaRegistro } from "./datosRegistro";
import { FotosPendientes } from "./fotosPendientes";
import type { JsonObject } from "./remoto/dtos";
import { datosDeSedes } from "./remoto/sedesJson";
import { Servicios } from "./servicios";
import { Sesion } from "./sesion";

/** [sesionIniciada] es falso cuando el proyecto pide confirmar el correo antes de dejar entrar. */
export interface ResultadoRegistroCuenta {
  sesionIniciada: boolean;
}

/** Registro "Mi veterinaria": los datos de quien la lleva y de la veterinaria. */
export interface DatosRegistroVeterinaria {
  nombre: string;
  dni: string;
  telefono: string;
  email: string;
  password: string;
  veterinaria: { nombre: string; direccion: string; telefono: string };
}

export class CorreoYaRegistrado extends Error {
  constructor() {
    super("Ese correo ya está registrado");
    this.name = "CorreoYaRegistrado";
  }
}

function datosDeMascota(m: MascotaRegistro): JsonObject {
  return {
    nombre: m.nombre,
    tipo: m.tipo,
    sexo: m.sexo,
    raza: m.raza,
    nacimiento: Fechas.parsear(m.nacimiento)?.toString() ?? "",
    peso: m.peso,
    color: m.color,
    microchip: m.microchip,
    observaciones: m.observaciones,
  };
}

async function crear(email: string, password: string, datos: JsonObject): Promise<ResultadoRegistroCuenta> {
  const r = await Servicios.fuente.registrar(email, password, datos);
  if (r.correoYaRegistrado) throw new CorreoYaRegistrado();
  return { sesionIniciada: r.sesionIniciada };
}

/** Si el registro dejó la sesión abierta, sube las fotos ya; si no, quedan para el primer ingreso. */
async function subirSiHaySesion(email: string, resultado: ResultadoRegistroCuenta): Promise<void> {
  if (!resultado.sesionIniciada) return;
  try {
    const usuario = await Sesion.usuarioIdActual();
    if (!usuario) return;
    await FotosPendientes.subir(email, usuario);
  } catch {
    // quedan para el primer ingreso
  }
}

/**
 * Alta de cuentas nuevas. El servidor arma el perfil (y las mascotas del dueño) a partir de los datos que van
 * con el registro; las fotos se suben después, cuando ya hay una sesión abierta.
 */
export const Registro = {
  VERSION_TERMINOS: "1.0",

  /** Para `instanceof Registro.CorreoYaRegistrado`, como en Kotlin. */
  CorreoYaRegistrado,

  /** Los lugares extra como los espera el servidor (ver `datosDeSedes` en data/remoto/sedesJson.ts). */
  datosDeSedes,

  async dueno(d: DatosRegistroDueno): Promise<ResultadoRegistroCuenta> {
    const datos: JsonObject = {
      rol: "dueno",
      nombre: d.nombre,
      dni: d.dni,
      telefono: d.telefono,
      direccion: d.direccion,
      terminos_version: Registro.VERSION_TERMINOS,
      mascotas: d.mascotas.map(datosDeMascota),
    };
    const resultado = await crear(d.email, d.password, datos);
    const conFoto: [string, string][] = [];
    for (const m of d.mascotas) if (m.fotoPath) conFoto.push([m.nombre, m.fotoPath]);
    await FotosPendientes.guardar(d.email, d.fotoPath, conFoto);
    await subirSiHaySesion(d.email, resultado);
    return resultado;
  },

  /**
   * Quien lleva una veterinaria sin ser veterinario (el dueño del negocio): la cuenta queda activa como titular y la
   * veterinaria pendiente hasta que el administrador verifica que existe.
   */
  async veterinaria(d: DatosRegistroVeterinaria): Promise<ResultadoRegistroCuenta> {
    const datos: JsonObject = {
      rol: "dueno",
      nombre: d.nombre,
      dni: d.dni,
      telefono: d.telefono,
      terminos_version: Registro.VERSION_TERMINOS,
      mascotas: [],
      veterinaria: { nombre: d.veterinaria.nombre, direccion: d.veterinaria.direccion, telefono: d.veterinaria.telefono },
    };
    return crear(d.email, d.password, datos);
  },

  async veterinario(d: DatosRegistroVeterinario): Promise<ResultadoRegistroCuenta> {
    if (!(await Servicios.fuente.matriculaDisponible(d.matricula))) {
      throw new Error("Esa matrícula ya está registrada con otra cuenta");
    }
    const datos: JsonObject = {
      rol: "veterinario",
      nombre: d.nombre,
      dni: d.dni,
      telefono: d.telefono,
      matricula: d.matricula,
      clinica: d.clinica,
      direccion_clinica: d.direccionClinica,
      terminos_version: Registro.VERSION_TERMINOS,
      especialidades: [...d.especialidades],
      tipos_animales: [...d.tiposAnimales],
      dias_atencion: [...d.dias],
      hora_apertura: d.apertura,
      hora_cierre: d.cierre,
      sedes: datosDeSedes(d.sedesExtra),
    };
    const resultado = await crear(d.email, d.password, datos);
    await FotosPendientes.guardar(d.email, d.fotoPath, []);
    if (d.credencialPath) await FotosPendientes.guardarCredencial(d.email, d.credencialPath);
    // El carnet se sube ya (si hay sesión) porque el administrador lo necesita para revisar la cuenta; las demás
    // fotos esperan a que lo aprueben
    if (resultado.sesionIniciada) {
      try {
        const usuario = await Sesion.usuarioIdActual();
        if (usuario) await FotosPendientes.subirCredencial(d.email, usuario);
      } catch {
        // se sube en el primer ingreso
      }
    }
    return resultado;
  },
};
