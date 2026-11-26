/*
 * Veterinarias de la cuenta en sesión: en cuáles está (con qué roles), las invitaciones que todavía no respondió y
 * de qué veterinarios maneja la agenda (titular, administración o recepción). Se cargan al entrar en cualquier modo
 * y se vuelven a pedir con cada cambio del servidor, así una invitación nueva aparece sola en el Inicio.
 */
import type {
  AgendaManejadaDto, ClinicaDto, CuentaMiembroCreadaDto, MiembroClinicaDto, NuevaCuentaMiembroDto, RolClinica,
} from "../remoto/dtos";
import { Servicios } from "../servicios";

/** Cómo se llama cada rol en pantalla. */
export const NOMBRE_ROL: Record<RolClinica, string> = {
  titular: "Titular",
  administrador: "Administración",
  veterinario: "Veterinario/a",
  recepcion: "Recepción",
};

class ClinicasRepoImpl {
  private _clinicas: ClinicaDto[] = [];
  private _agendas: AgendaManejadaDto[] = [];

  /** Veterinarias de las que la cuenta es parte. */
  get activas(): ClinicaDto[] { return this._clinicas.filter((c) => c.estado === "activo"); }

  /** Invitaciones a una veterinaria que la cuenta todavía no respondió (se muestran en el Inicio). */
  get invitaciones(): ClinicaDto[] { return this._clinicas.filter((c) => c.estado === "pendiente"); }

  /** Veterinarios cuya agenda maneja la cuenta, con la veterinaria por la que la maneja. */
  get agendas(): readonly AgendaManejadaDto[] { return this._agendas; }

  /** Ids de los veterinarios cuya agenda maneja (sin repetir aunque estén en dos veterinarias suyas). */
  get veterinariosConAgenda(): string[] { return [...new Set(this._agendas.map((a) => a.veterinario_id))]; }

  /**
   * La cuenta usa el modo recepción (el de la veterinaria): maneja la agenda de algún veterinario, o lleva una
   * veterinaria donde no atiende (el dueño del negocio, aunque todavía no tenga veterinarios o esté en revisión).
   */
  get usaModoVeterinaria(): boolean {
    return this._agendas.length > 0 || this.activas.some(
      (c) => c.roles.some((r) => r === "titular" || r === "administrador") && !c.roles.includes("veterinario"),
    );
  }

  clinica(id: string | null | undefined): ClinicaDto | null {
    return this._clinicas.find((c) => c.id === id) ?? null;
  }

  /** La veterinaria espera que el administrador de la plataforma la verifique (o la rechazó). */
  enRevision(clinicaId: string): boolean {
    const r = this.clinica(clinicaId)?.revision;
    return r === "pendiente" || r === "rechazada";
  }

  /** La cuenta es titular o administra la veterinaria (ya aprobada): maneja el equipo. */
  administra(clinicaId: string): boolean {
    const c = this.clinica(clinicaId);
    return c?.estado === "activo" && !this.enRevision(clinicaId) && c.roles.some((r) => r === "titular" || r === "administrador");
  }

  esTitular(clinicaId: string): boolean {
    const c = this.clinica(clinicaId);
    return c?.estado === "activo" && c.roles.includes("titular");
  }

  /** Si falla el pedido se queda lo que había. */
  async cargar(): Promise<void> {
    try {
      const [clinicas, agendas] = await Promise.all([Servicios.fuente.misClinicas(), Servicios.fuente.agendasQueManejo()]);
      this._clinicas = clinicas;
      this._agendas = agendas;
    } catch {
      // se queda lo que había
    }
  }

  /** Equipo de una veterinaria; se pide cada vez (cambia desde otros dispositivos). */
  equipo(clinicaId: string): Promise<MiembroClinicaDto[]> {
    return Servicios.fuente.equipoClinica(clinicaId);
  }

  async crearClinica(nombre: string, direccion: string, telefono: string): Promise<string> {
    const id = await Servicios.fuente.crearClinica(nombre.trim(), direccion.trim() || null, telefono.trim() || null);
    await this.recargar();
    return id;
  }

  /** Invita por DNI o correo; devuelve el nombre de la persona. */
  async invitar(clinicaId: string, dniOCorreo: string, roles: RolClinica[]): Promise<string> {
    const nombre = await Servicios.fuente.invitarAClinica(clinicaId, dniOCorreo.trim(), roles);
    await this.recargar();
    return nombre;
  }

  async responder(c: ClinicaDto, aceptar: boolean): Promise<void> {
    await Servicios.fuente.responderInvitacionClinica(c.miembro_id, aceptar);
    await this.recargar();
  }

  /** Saca a alguien del equipo, o la cuenta se va de la veterinaria si es su propia fila. */
  async quitar(miembroId: string): Promise<void> {
    await Servicios.fuente.quitarDeClinica(miembroId);
    await this.recargar();
  }

  async cambiarRoles(miembroId: string, roles: RolClinica[]): Promise<void> {
    await Servicios.fuente.cambiarRolesClinica(miembroId, roles);
    await this.recargar();
  }

  /** Crea la cuenta de una persona del equipo; devuelve el correo y la contraseña temporal. */
  async crearCuenta(datos: NuevaCuentaMiembroDto): Promise<CuentaMiembroCreadaDto> {
    const creada = await Servicios.fuente.crearCuentaMiembro({
      ...datos, nombre: datos.nombre.trim(), dni: datos.dni.trim(), telefono: datos.telefono.trim(),
      email: datos.email.trim().toLowerCase(), ...(datos.matricula != null ? { matricula: datos.matricula.trim() } : {}),
    });
    await this.recargar();
    return creada;
  }

  limpiar(): void {
    this._clinicas = [];
    this._agendas = [];
  }

  /**
   * Se llama después de cada cambio hecho desde la app. Lo registra la agenda de la recepción para volver a pedirse
   * en el momento (aceptar una invitación muestra los turnos de esa veterinaria sin esperar).
   */
  alCambiar: (() => Promise<void>) | null = null;

  private async recargar(): Promise<void> {
    await this.cargar();
    try {
      await this.alCambiar?.();
    } catch {
      // la agenda se vuelve a pedir en la próxima recarga
    }
    Servicios.avisarCambio();
  }
}

export const ClinicasRepo = new ClinicasRepoImpl();
