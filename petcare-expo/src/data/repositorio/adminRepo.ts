import { Fechas } from "../../util/fechas";
import { LocalDate, LocalDateTime } from "../../util/tiempo";
import type { ActividadDto, JsonObject, MascotaDto, PerfilDto } from "../remoto/dtos";
import { lugaresDe, normalizarVeterinario } from "../remoto/dtos";
import { Servicios } from "../servicios";

export interface VetAdminItem {
  readonly id: string;
  nombre: string;
  email: string;
  matricula: string;
  clinica: string;
  direccion: string;
  telefono: string;
  especialidades: string;
  diasYHorarios: string;
  /** AdminRepo.PENDIENTE, ACTIVO, RECHAZADO o SUSPENDIDO. */
  estado: string;
  dni: string;
  fotoPath: string | null;
  fechaRegistro: LocalDate;
  /** Motivo del rechazo o de la suspensión, para que el veterinario sepa qué pasó. */
  motivo: string;
  /** Ruta de la foto de la credencial en el bucket privado `credenciales` (solo la ve el administrador). */
  credencialPath: string | null;
  /** Ya tenía cuenta de dueño y pidió el alta como veterinario sobre esa misma cuenta. */
  readonly tambienEsDueno: boolean;
}

export function crearVetAdminItem(
  v: Partial<VetAdminItem> &
    Pick<VetAdminItem, "id" | "nombre" | "email" | "matricula" | "clinica" | "direccion" | "telefono" | "especialidades" | "diasYHorarios" | "estado">,
): VetAdminItem {
  return {
    ...v,
    dni: v.dni ?? "",
    fotoPath: v.fotoPath ?? null,
    fechaRegistro: v.fechaRegistro ?? LocalDate.now(),
    motivo: v.motivo ?? "",
    credencialPath: v.credencialPath ?? null,
    tambienEsDueno: v.tambienEsDueno ?? false,
  };
}

export interface DuenoAdminItem {
  readonly id: string;
  readonly nombre: string;
  readonly dni: string;
  readonly email: string;
  readonly telefono: string;
  readonly direccion: string;
  readonly mascotas: string[];
  /** ACTIVO o SUSPENDIDO. */
  estado: string;
  readonly fotoPath: string | null;
  readonly fechaRegistro: LocalDate;
  motivo: string;
}

export function crearDuenoAdminItem(
  d: Partial<DuenoAdminItem> & Pick<DuenoAdminItem, "id" | "nombre" | "dni" | "email" | "telefono" | "direccion" | "mascotas">,
): DuenoAdminItem {
  return {
    ...d,
    estado: d.estado ?? AdminRepo.ACTIVO,
    fotoPath: d.fotoPath ?? null,
    fechaRegistro: d.fechaRegistro ?? LocalDate.now(),
    motivo: d.motivo ?? "",
  };
}

export type TipoActividad = "REGISTRO" | "APROBACION" | "RECHAZO" | "SUSPENSION" | "REACTIVACION" | "BAJA";

export interface ActividadAdmin {
  readonly tipo: TipoActividad;
  readonly texto: string;
  readonly cuando: LocalDateTime;
  /** A qué apunta: una cuenta (veterinario o dueño) y/o una veterinaria. */
  readonly objetivoId: string | null;
  readonly clinicaId: string | null;
}

const sinVacio = (s: string): string | null => (s.trim() ? s : null);

const ordenNumerico = (dias: number[]): number[] => [...dias].sort((a, b) => a - b);

/** Cuentas, mascotas y movimientos de toda la plataforma, solo para el administrador. */
class AdminRepoImpl {
  readonly PENDIENTE = "PENDIENTE_REVISION";
  readonly ACTIVO = "ACTIVO";
  readonly RECHAZADO = "RECHAZADO";
  readonly SUSPENDIDO = "SUSPENDIDO";

  private readonly dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Cada carga arma listas nuevas y las reemplaza de una vez: la pantalla nunca recorre una lista a medio llenar
  private _listaVeterinarios: VetAdminItem[] = [];
  private _listaDuenos: DuenoAdminItem[] = [];
  private _actividad: ActividadAdmin[] = [];
  private resumen: JsonObject = {};

  get listaVeterinarios(): VetAdminItem[] {
    return this._listaVeterinarios;
  }

  get listaDuenos(): DuenoAdminItem[] {
    return this._listaDuenos;
  }

  get actividad(): ActividadAdmin[] {
    return this._actividad;
  }

  limpiar(): void {
    this.ultimaCarga = 0;
    this._listaVeterinarios = [];
    this._listaDuenos = [];
    this._actividad = [];
    this.resumen = {};
  }

  /** Cuándo terminó la última carga completa; evita volver a pedir todo apenas se abre el panel. */
  private ultimaCarga = 0;

  cargadoHaceMs(): number {
    return Date.now() - this.ultimaCarga;
  }

  async cargar(): Promise<void> {
    const f = Servicios.fuente;
    // Los cuatro pedidos no dependen entre sí: se hacen a la vez en vez de uno detrás del otro
    const [perfiles, mascotas, movimientos, datosResumen] = await Promise.all([
      f.perfilesAdmin(),
      f.mascotasAdmin(),
      f.actividadAdmin(),
      f.resumenAdmin(),
    ]);

    const mascotasPorDueno = new Map<string, MascotaDto[]>();
    for (const m of mascotas) {
      if (m.dueno_id == null) continue;
      const grupo = mascotasPorDueno.get(m.dueno_id);
      if (grupo) grupo.push(m);
      else mascotasPorDueno.set(m.dueno_id, [m]);
    }
    const vets = perfiles.filter((p) => p.veterinarios != null).map((p) => this.aVeterinario(p));
    const duenos = perfiles.filter((p) => p.rol === "dueno").map((p) => this.aDueno(p, mascotasPorDueno.get(p.id) ?? []));
    const movs = movimientos.map((a) => this.aActividad(a));

    this._listaVeterinarios = vets;
    this._listaDuenos = duenos;
    this._actividad = movs;
    this.resumen = datosResumen;
    this.ultimaCarga = Date.now();
  }

  /** Vuelve a pedir lo que cambia cuando el administrador actúa (cuentas, actividad y contadores). */
  private async recargar(): Promise<void> {
    await this.cargar();
    Servicios.avisarCambio();
  }

  private aVeterinario(p: PerfilDto): VetAdminItem {
    const v = normalizarVeterinario(p.veterinarios);
    const lugares = v ? lugaresDe(v) : [];
    const principal = lugares[0];
    const clinicas = lugares.map((l) => l.nombre).join(" · ");
    const direcciones = lugares
      .map((l) => l.direccion)
      .filter((d): d is string => !!d && d.trim() !== "")
      .join("\n");
    return {
      id: p.id,
      nombre: p.nombre,
      email: p.email,
      matricula: v?.matricula ?? "",
      clinica: clinicas.trim() ? clinicas : (v?.clinica ?? ""),
      direccion: direcciones.trim() ? direcciones : (v?.direccion_clinica ?? ""),
      telefono: p.telefono ?? "",
      especialidades: (v?.especialidades ?? []).join(", "),
      diasYHorarios:
        lugares.length > 1
          ? lugares
              .map((l) => l.nombre + ": " + this.textoHorarios(ordenNumerico(l.dias_atencion), l.hora_apertura, l.hora_cierre))
              .join("\n")
          : this.textoHorarios(
              ordenNumerico(principal?.dias_atencion ?? v?.dias_atencion ?? []),
              principal?.hora_apertura ?? v?.hora_apertura,
              principal?.hora_cierre ?? v?.hora_cierre,
            ),
      // El estado del rol de veterinario es el que se revisa; el de la cuenta puede ser otro (dueño activo)
      estado: (v?.estado_revision ?? p.estado).toUpperCase(),
      dni: p.perfiles_privados?.dni ?? "",
      fotoPath: p.foto_path ?? null,
      fechaRegistro: Fechas.instante(p.created_at).toLocalDate(),
      motivo: (v?.motivo_revision ?? p.motivo_estado) ?? "",
      credencialPath: v?.credencial_path ?? null,
      tambienEsDueno: p.rol === "dueno",
    };
  }

  private aDueno(p: PerfilDto, mascotas: MascotaDto[]): DuenoAdminItem {
    return {
      id: p.id,
      nombre: p.nombre,
      dni: p.perfiles_privados?.dni ?? "",
      email: p.email,
      telefono: p.telefono ?? "",
      direccion: p.direccion ?? "",
      mascotas: mascotas.map((m) => (m.raza && m.raza.trim() ? `${m.nombre} (${m.raza})` : `${m.nombre} (${m.tipo})`)),
      estado: p.estado.toUpperCase(),
      fotoPath: p.foto_path ?? null,
      fechaRegistro: Fechas.instante(p.created_at).toLocalDate(),
      motivo: p.motivo_estado ?? "",
    };
  }

  private aActividad(a: ActividadDto): ActividadAdmin {
    let tipo: TipoActividad;
    switch (a.tipo) {
      case "aprobacion": tipo = "APROBACION"; break;
      case "rechazo": tipo = "RECHAZO"; break;
      case "suspension": tipo = "SUSPENSION"; break;
      case "reactivacion": tipo = "REACTIVACION"; break;
      case "baja": tipo = "BAJA"; break;
      default: tipo = "REGISTRO";
    }
    return { tipo, texto: a.texto, cuando: Fechas.instante(a.created_at), objetivoId: a.objetivo_id ?? null, clinicaId: a.clinica_id ?? null };
  }

  /** "Lun a Vie · 09:00 a 18:00 hs", o los días separados por comas si no son consecutivos. */
  private textoHorarios(diasAtencion: number[], apertura: string | null | undefined, cierre: string | null | undefined): string {
    if (diasAtencion.length === 0) return "Sin días de atención configurados";
    const consecutivos = diasAtencion.every((d, i) => i === 0 || d === diasAtencion[i - 1] + 1);
    const textoDias =
      consecutivos && diasAtencion.length > 2
        ? `${this.dias[diasAtencion[0] - 1]} a ${this.dias[diasAtencion[diasAtencion.length - 1] - 1]}`
        : diasAtencion.map((d) => this.dias[d - 1]).join(", ");
    return `${textoDias} · ${(apertura ?? "09:00").slice(0, 5)} a ${(cierre ?? "18:00").slice(0, 5)} hs`;
  }

  // ---------- Consultas ----------

  /** Como intOrNull de Kotlin: un entero (o su texto); cualquier otra cosa cuenta 0. */
  private contador(clave: string): number {
    const valor = this.resumen[clave];
    if (typeof valor === "number") return Number.isInteger(valor) ? valor : 0;
    if (typeof valor === "string" && /^[+-]?\d+$/.test(valor)) return Number(valor);
    return 0;
  }

  porEstado(estado: string): VetAdminItem[] {
    return this._listaVeterinarios.filter((v) => v.estado === estado);
  }

  pendientesRevisionCount(): number {
    return this._listaVeterinarios.filter((v) => v.estado === this.PENDIENTE).length;
  }

  vetsActivos(): number {
    return this._listaVeterinarios.filter((v) => v.estado === this.ACTIVO).length;
  }

  duenosActivos(): number {
    return this._listaDuenos.filter((d) => d.estado === this.ACTIVO).length;
  }

  totalMascotas(): number {
    return this.contador("mascotas");
  }

  turnosHoy(): number {
    return this.contador("turnos_hoy");
  }

  vetPorId(id: string): VetAdminItem | null {
    return this._listaVeterinarios.find((v) => v.id === id) ?? null;
  }

  duenoPorId(id: string): DuenoAdminItem | null {
    return this._listaDuenos.find((d) => d.id === id) ?? null;
  }

  // ---------- Acciones sobre veterinarios ----------

  private cambiarEstado(id: string, estado: string, motivo: string | null): void {
    void Servicios.escribir({ alFallar: () => this.recargar(), alTerminar: () => this.recargar() }, async () => {
      await Servicios.fuente.cambiarEstadoCuenta(id, estado.toLowerCase(), motivo === null ? null : sinVacio(motivo));
    });
  }

  /** Revisión del rol de veterinario: no toca la cuenta de dueño de quien también tiene mascotas. */
  private revisarRol(id: string, estado: string, motivo: string | null, avisar = false): void {
    void Servicios.escribir({ alFallar: () => this.recargar(), alTerminar: () => this.recargar() }, async () => {
      await Servicios.fuente.revisarVeterinario(id, estado.toLowerCase(), motivo === null ? null : sinVacio(motivo));
      if (avisar) await Servicios.fuente.avisarRevisionPorCorreo(id);
    });
  }

  aprobarVet(id: string): void {
    const vet = this.vetPorId(id);
    if (!vet) return;
    vet.estado = this.ACTIVO;
    vet.motivo = "";
    this.revisarRol(id, this.ACTIVO, null, true);
  }

  rechazarVet(id: string, motivo = ""): void {
    const vet = this.vetPorId(id);
    if (!vet) return;
    vet.estado = this.RECHAZADO;
    vet.motivo = motivo;
    this.revisarRol(id, this.RECHAZADO, motivo, true);
  }

  suspenderVet(id: string, motivo = ""): void {
    const vet = this.vetPorId(id);
    if (!vet) return;
    vet.estado = this.SUSPENDIDO;
    vet.motivo = motivo;
    this.revisarRol(id, this.SUSPENDIDO, motivo);
  }

  reactivarVet(id: string): void {
    const vet = this.vetPorId(id);
    if (!vet) return;
    vet.estado = this.ACTIVO;
    vet.motivo = "";
    this.revisarRol(id, this.ACTIVO, null);
  }

  // ---------- Acciones sobre dueños ----------

  suspenderDueno(id: string, motivo = ""): void {
    const dueno = this.duenoPorId(id);
    if (!dueno) return;
    dueno.estado = this.SUSPENDIDO;
    dueno.motivo = motivo;
    this.cambiarEstado(id, this.SUSPENDIDO, motivo);
  }

  reactivarDueno(id: string): void {
    const dueno = this.duenoPorId(id);
    if (!dueno) return;
    dueno.estado = this.ACTIVO;
    dueno.motivo = "";
    this.cambiarEstado(id, this.ACTIVO, null);
  }

  // ---------- Utilidades de presentación ----------

  /** Iniciales para el avatar, sin el "Dr." o "Dra." del principio. */
  iniciales(nombre: string): string {
    const partes = nombre
      .replace(/^(Dr\.|Dra\.)\s*/, "")
      .trim()
      .split(/\s+/)
      .filter((p) => p.length > 0);
    if (partes.length === 0) return "?";
    if (partes.length === 1) return partes[0].slice(0, 1).toUpperCase();
    return (partes[0].slice(0, 1) + partes[1].slice(0, 1)).toUpperCase();
  }
}

export const AdminRepo = new AdminRepoImpl();
