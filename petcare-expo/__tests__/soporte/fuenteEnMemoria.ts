/* Migrado de app/src/test/.../FuenteEnMemoria.kt. */
import type {
  AccesoDto, AccesoHistorialDto, ActividadDto, ArchivoDto, CuentaDuenoCreadaDto, DuenoBuscadoDto, DuenoMascotaDto,
  EstudioTurnoDto, HoraOcupadaDto, InformeDto, InvitacionCoduenoDto, Json, JsonObject, MascotaCreadaDto, MascotaDto, NotificacionDto, NuevaCuentaDuenoDto,
  NuevaMascotaDto, NuevaPrescripcionDto, NuevaSedeDto, NuevoArchivoDto, NuevoEstudioTurnoDto, NuevoInformeDto,
  NuevoRecordatorioDto, NuevoRegistroSaludDto, NuevoTurnoDto, PerfilDto, PrescripcionDto, RecordatorioDto,
  RegistroSaludDto, RutaDto, SedeDto, SolicitudAccesoDto, SolicitudAltaVeterinarioDto, TomaDto, TurnoDto, VeterinarioDto,
  AgendaManejadaDto, ClinicaDto, ClinicaParaRevisarDto, CuentaMiembroCreadaDto, RevisionClinica, MiembroClinicaDto, NuevaCuentaMiembroDto, RolClinica,
} from "../../src/data/remoto/dtos";
import { lugaresDe, normalizarPerfil, normalizarVeterinario } from "../../src/data/remoto/dtos";
import { FuenteBase, type ResultadoRegistro } from "../../src/data/remoto/fuenteDatos";

/** Lo que Kotlin leía con `(valor as? JsonPrimitive)?.content`: null si no es un valor simple; JsonNull da "null". */
function primitivo(valor: Json | undefined): string | null {
  if (valor === undefined) return null;
  if (valor === null) return "null";
  if (typeof valor === "object") return null;
  return String(valor);
}

/** Como [primitivo] pero un "null" de JSON cuenta como ausente. */
function texto(cambios: JsonObject, clave: string): string | null {
  const c = primitivo(cambios[clave]);
  return c === "null" ? null : c;
}

const ordenadas = (cambios: JsonObject) => Object.keys(cambios).sort();

/**
 * Servidor de mentira para las pruebas: guarda todo en listas y anota cada escritura en [llamadas] para poder
 * comprobar qué se le mandó a Supabase sin necesitar red.
 */
export class FuenteEnMemoria extends FuenteBase {
  perfiles: PerfilDto[] = [];
  mascotas: MascotaDto[] = [];
  turnosGuardados: TurnoDto[] = [];
  accesosGuardados: AccesoDto[] = [];
  notificacionesGuardadas: NotificacionDto[] = [];
  registros: RegistroSaludDto[] = [];
  informes: InformeDto[] = [];
  archivos: ArchivoDto[] = [];
  actividad: ActividadDto[] = [];
  duenosBuscables: DuenoBuscadoDto[] = [];
  ocupados: HoraOcupadaDto[] = [];
  resumen: JsonObject = {};
  haySesionGuardada = false;
  sesionCerrada = false;

  /** Una línea por escritura, por ejemplo `crearMascota:Rex` o `estadoCuenta:<id>=activo`. */
  llamadas: string[] = [];
  subidas: string[] = [];
  borradas: string[] = [];

  constructor(public yo: PerfilDto) {
    super();
  }

  // En Kotlin las listas `turnos`, `accesos` y `notificaciones` compartían nombre con los métodos de la fuente;
  // en TypeScript no se puede: acá son `turnosGuardados`, `accesosGuardados` y `notificacionesGuardadas`.

  private oyentes = new Set<() => void>();

  /** Las pruebas emiten acá para simular que el servidor avisó de un cambio (`avisosDelServidor.tryEmit()`). */
  readonly avisosDelServidor = {
    tryEmit: (): boolean => {
      for (const oyente of [...this.oyentes]) oyente();
      return true;
    },
  };

  override cambios(alCambiar: () => void): () => void {
    this.oyentes.add(alCambiar);
    return () => {
      this.oyentes.delete(alCambiar);
    };
  }

  // ---------- Sesión ----------

  override async restaurarSesion(): Promise<string | null> {
    return this.haySesionGuardada ? this.yo.id : null;
  }

  override async ingresar(_email: string, _password: string): Promise<string> {
    this.haySesionGuardada = true;
    this.sesionCerrada = false;
    return this.yo.id;
  }

  matriculasEnUso = new Set<string>();

  override async matriculaDisponible(matricula: string): Promise<boolean> {
    return !this.matriculasEnUso.has(matricula.toLowerCase());
  }

  /** Los datos con los que se creó la última cuenta (lo que el servidor guarda de la persona y del veterinario). */
  ultimosDatosDeRegistro: JsonObject | null = null;

  override async registrar(email: string, _password: string, datos: JsonObject): Promise<ResultadoRegistro> {
    this.llamadas.push(`registrar:${email}`);
    this.ultimosDatosDeRegistro = datos;
    return { sesionIniciada: true, usuarioId: this.yo.id, correoYaRegistrado: false };
  }

  override async cambiarPassword(email: string, _actual: string, _nueva: string): Promise<void> {
    this.llamadas.push(`password:${email}`);
  }

  override async definirPassword(_nueva: string): Promise<void> {
    this.llamadas.push("definirPassword");
  }

  /** Si tiene valor, abrir el enlace de recuperación falla con ese mensaje (enlace vencido, por ejemplo). */
  errorAlAbrirEnlace: string | null = null;

  override async abrirEnlaceDeRecuperacion(enlace: string): Promise<void> {
    this.llamadas.push(`enlace:${enlace}`);
    if (this.errorAlAbrirEnlace != null) throw new Error(this.errorAlAbrirEnlace);
    // Abrir el enlace deja una sesión abierta, como en el servidor real
    this.haySesionGuardada = true;
  }

  override async completarPrimerIngreso(terminosVersion: string): Promise<void> {
    this.llamadas.push(`primerIngreso:${terminosVersion}`);
  }

  /** Lo último que se le pidió al servidor al crear la cuenta de un dueño. */
  ultimaCuentaPedida: NuevaCuentaDuenoDto | null = null;
  /** Si tiene valor, crear la cuenta falla con ese mensaje (DNI repetido, correo repetido...). */
  errorAlCrearCuenta: string | null = null;

  /** Como el servidor: crea las mascotas nuevas, las deja a nombre del dueño y el veterinario conserva el acceso. */
  override async crearCuentaDueno(datos: NuevaCuentaDuenoDto): Promise<CuentaDuenoCreadaDto> {
    this.llamadas.push(`crearCuentaDueno:${datos.email}`);
    this.ultimaCuentaPedida = datos;
    if (this.errorAlCrearCuenta != null) throw new Error(this.errorAlCrearCuenta);
    const duenoId = "dueno-nuevo";
    const creadas: MascotaCreadaDto[] = datos.mascotas_nuevas.map((m, i) => {
      const id = `nueva-${i}`;
      this.mascotas.push(mascotaDto({ id, dueno_id: duenoId, nombre: m.nombre, tipo: m.tipo, raza: m.raza }));
      this.accesosGuardados.push(accesoDto("acc-" + id, id, Escenario.VET_ID, "activo", "veterinario"));
      return { id, nombre: m.nombre };
    });
    const vinculadas: MascotaCreadaDto[] = datos.mascotas_existentes.map((id) => {
      const i = this.mascotas.findIndex((m) => m.id === id);
      this.mascotas[i] = { ...this.mascotas[i], dueno_id: duenoId };
      if (!this.accesosGuardados.some((a) => a.mascota_id === id)) {
        this.accesosGuardados.push(accesoDto("acc-" + id, id, Escenario.VET_ID, "activo", "veterinario"));
      }
      return { id, nombre: this.mascotas[i].nombre };
    });
    return { usuario_id: duenoId, email: datos.email, password_temporal: "Temp1234ab", mascotas: [...creadas, ...vinculadas] };
  }

  override async cerrarSesion(): Promise<void> {
    this.haySesionGuardada = false;
    this.sesionCerrada = true;
  }

  // ---------- Perfil ----------

  override async miPerfil(): Promise<PerfilDto> {
    return this.yo;
  }

  override async actualizarPerfil(cambios: JsonObject): Promise<void> {
    this.llamadas.push("perfil:" + ordenadas(cambios).join(","));
  }

  override async actualizarVeterinario(cambios: JsonObject): Promise<void> {
    this.llamadas.push("veterinario:" + ordenadas(cambios).join(","));
  }

  // ---------- Lugares de atención ----------

  private cambiarSedes(veterinarioId: string, nuevas: (actuales: SedeDto[]) => SedeDto[]): void {
    const conSedes = (p: PerfilDto): PerfilDto =>
      p.veterinarios ? { ...p, veterinarios: { ...p.veterinarios, sedes: nuevas(lugaresDe(p.veterinarios)) } } : p;
    if (this.yo.id === veterinarioId) this.yo = conSedes(this.yo);
    const i = this.perfiles.findIndex((p) => p.id === veterinarioId);
    if (i >= 0) this.perfiles[i] = conSedes(this.perfiles[i]);
  }

  override async crearSede(sede: NuevaSedeDto): Promise<void> {
    this.llamadas.push(`crearSede:${sede.nombre}`);
    this.cambiarSedes(sede.veterinario_id, (actuales) => {
      // Una sede "de siempre" (sin id) pasa a ser real al agregar la segunda
      const reales = actuales.map((s, i) => (s.id.trim() === "" ? { ...s, id: `sede-base-${i}` } : s));
      return [
        ...reales,
        {
          id: sede.id ?? `sede-${reales.length + 1}`,
          veterinario_id: sede.veterinario_id,
          nombre: sede.nombre,
          direccion: sede.direccion ?? null,
          dias_atencion: sede.dias_atencion,
          hora_apertura: sede.hora_apertura,
          hora_cierre: sede.hora_cierre,
          activa: true,
          created_at: `2026-01-${String(reales.length + 1).padStart(2, "0")}`,
        },
      ];
    });
  }

  override async actualizarSede(id: string, cambios: JsonObject): Promise<void> {
    this.llamadas.push(`actualizarSede:${id}:` + ordenadas(cambios).join(","));
    const duenos = [...new Set([...this.perfiles, this.yo].map((p) => p.id))];
    for (const vet of duenos) {
      this.cambiarSedes(vet, (actuales) =>
        actuales.map((s) => {
          if (s.id !== id) return s;
          const dias = cambios["dias_atencion"];
          return {
            ...s,
            nombre: texto(cambios, "nombre") ?? s.nombre,
            direccion: "direccion" in cambios ? texto(cambios, "direccion") : s.direccion,
            hora_apertura: texto(cambios, "hora_apertura") ?? s.hora_apertura,
            hora_cierre: texto(cambios, "hora_cierre") ?? s.hora_cierre,
            dias_atencion: Array.isArray(dias) ? dias.map((d) => Number(d)) : s.dias_atencion,
          };
        }),
      );
    }
  }

  override async eliminarSede(id: string): Promise<void> {
    this.llamadas.push(`eliminarSede:${id}`);
    const duenos = [...new Set([...this.perfiles, this.yo].map((p) => p.id))];
    for (const vet of duenos) this.cambiarSedes(vet, (actuales) => actuales.filter((s) => s.id !== id));
  }

  // ---------- Mascotas ----------

  override async misMascotas(): Promise<MascotaDto[]> {
    return this.mascotas.filter((m) => this.esDuena(m.id, this.yo.id) && m.activa);
  }

  // ---------- Co-dueños ----------

  coduenos: { id: string; mascota_id: string; usuario_id: string; invitado_por: string; estado: "pendiente" | "activo" }[] = [];

  private esDuena(mascotaId: string, cuenta: string): boolean {
    return this.mascotas.some((m) => m.id === mascotaId && m.dueno_id === cuenta) ||
      this.coduenos.some((c) => c.mascota_id === mascotaId && c.usuario_id === cuenta && c.estado === "activo");
  }

  override async invitarCodueno(mascotaId: string, dniOCorreo: string): Promise<string> {
    this.llamadas.push(`invitarCodueno:${mascotaId}:${dniOCorreo}`);
    if (!this.esDuena(mascotaId, this.yo.id)) throw new Error("Solo un dueño de la mascota puede invitar a otra persona");
    const dato = dniOCorreo.trim().toLowerCase();
    const invitado = this.perfiles.find((p) => p.email.toLowerCase() === dato || p.perfiles_privados?.dni === dato);
    if (!invitado) throw new Error("No encontramos una cuenta con ese DNI o correo. La otra persona tiene que registrarse primero en PetCare.");
    if (invitado.id === this.yo.id) throw new Error("No podés invitarte a vos mismo");
    if (this.esDuena(mascotaId, invitado.id)) throw new Error(`${invitado.nombre} ya es dueño/a`);
    if (!this.coduenos.some((c) => c.mascota_id === mascotaId && c.usuario_id === invitado.id)) {
      this.coduenos.push({ id: `cod-${this.coduenos.length + 1}`, mascota_id: mascotaId, usuario_id: invitado.id, invitado_por: this.yo.id, estado: "pendiente" });
    }
    return invitado.nombre;
  }

  override async misInvitacionesCodueno(): Promise<InvitacionCoduenoDto[]> {
    return this.coduenos
      .filter((c) => c.usuario_id === this.yo.id && c.estado === "pendiente")
      .map((c) => {
        const m = this.mascotas.find((x) => x.id === c.mascota_id)!;
        const quien = [...this.perfiles, this.yo].find((p) => p.id === c.invitado_por);
        return {
          id: c.id, mascota_id: m.id, mascota_nombre: m.nombre, mascota_tipo: m.tipo, mascota_foto_path: m.foto_path ?? null,
          invitado_por_nombre: quien?.nombre ?? null, created_at: "2026-11-23T12:00:00Z",
        };
      });
  }

  override async responderInvitacionCodueno(invitacionId: string, aceptar: boolean): Promise<void> {
    this.llamadas.push(`responderInvitacion:${invitacionId}=${aceptar}`);
    const c = this.coduenos.find((x) => x.id === invitacionId && x.usuario_id === this.yo.id && x.estado === "pendiente");
    if (!c) throw new Error("La invitación ya no está disponible");
    if (aceptar) c.estado = "activo";
    else this.coduenos = this.coduenos.filter((x) => x !== c);
  }

  override async duenosDeMascota(mascotaId: string): Promise<DuenoMascotaDto[]> {
    if (!this.esDuena(mascotaId, this.yo.id)) return [];
    const todos = [...this.perfiles, this.yo];
    const perfil = (id: string) => todos.find((p) => p.id === id);
    const m = this.mascotas.find((x) => x.id === mascotaId)!;
    const original = perfil(m.dueno_id!);
    return [
      ...(original ? [{ codueno_id: null, usuario_id: original.id, nombre: original.nombre, email: original.email, foto_path: null, estado: "activo", es_original: true }] : []),
      ...this.coduenos.filter((c) => c.mascota_id === mascotaId).map((c) => {
        const p = perfil(c.usuario_id)!;
        return { codueno_id: c.id, usuario_id: p.id, nombre: p.nombre, email: p.email, foto_path: null, estado: c.estado as string, es_original: false };
      }),
    ];
  }

  override async quitarCodueno(coduenoId: string): Promise<void> {
    this.llamadas.push(`quitarCodueno:${coduenoId}`);
    this.coduenos = this.coduenos.filter((c) => c.id !== coduenoId);
  }

  // ---------- Veterinarias (como la migración veterinarias.sql) ----------

  clinicas: {
    id: string; nombre: string; direccion: string | null; telefono: string | null; creada_por: string | null;
    revision: RevisionClinica; motivo_revision: string | null;
  }[] = [];
  miembros: {
    id: string; clinica_id: string; cuenta_id: string; roles: RolClinica[]; estado: "pendiente" | "activo"; invitado_por: string | null;
  }[] = [];

  /** Como private.es_vet_activo: rol de veterinario aprobado y cuenta activa. */
  private esVetActivo(p: PerfilDto): boolean {
    const revision = p.veterinarios?.estado_revision ?? (p.rol === "veterinario" ? p.estado : null);
    return revision === "activo" && (p.estado ?? "activo") === "activo";
  }

  private cuentaPorDato(dato: string): PerfilDto | undefined {
    const d = dato.trim().toLowerCase();
    return [...this.perfiles, this.yo].find((p) => p.email.toLowerCase() === d || p.perfiles_privados?.dni === d);
  }

  private miFila(clinicaId: string) {
    return this.miembros.find((m) => m.clinica_id === clinicaId && m.cuenta_id === this.yo.id && m.estado === "activo");
  }

  private aprobada(clinicaId: string): boolean {
    return this.clinicas.find((c) => c.id === clinicaId)?.revision === "aprobada";
  }

  /** Como permiso_en(…, 'equipo'): titular o administración de una veterinaria aprobada. */
  private administro(clinicaId: string): boolean {
    return this.aprobada(clinicaId) && (this.miFila(clinicaId)?.roles.some((r) => r === "titular" || r === "administrador") ?? false);
  }

  /** Arma una veterinaria con sus miembros (para preparar escenarios). */
  agregarClinica(id: string, nombre: string, miembros: [cuenta: string, roles: RolClinica[], estado?: "pendiente" | "activo"][]): void {
    this.clinicas.push({ id, nombre, direccion: null, telefono: null, creada_por: miembros[0]?.[0] ?? null, revision: "aprobada", motivo_revision: null });
    for (const [cuenta, roles, estado] of miembros) {
      this.miembros.push({ id: `mie-${this.miembros.length + 1}`, clinica_id: id, cuenta_id: cuenta, roles, estado: estado ?? "activo", invitado_por: null });
    }
  }

  private validarRoles(clinicaId: string, roles: RolClinica[], cuenta: PerfilDto): void {
    if (roles.length === 0) throw new Error("Elegí al menos un rol");
    if (roles.includes("titular") && !this.miFila(clinicaId)?.roles.includes("titular")) throw new Error("Solo un titular puede sumar otro titular");
    if ((roles.includes("veterinario") || roles.includes("titular")) && !this.esVetActivo(cuenta)) {
      throw new Error("Solo un veterinario con la cuenta aprobada puede atender o ser titular");
    }
  }

  private titulares(clinicaId: string) {
    return this.miembros.filter((x) => x.clinica_id === clinicaId && x.estado === "activo" && x.roles.includes("titular"));
  }

  override async misClinicas(): Promise<ClinicaDto[]> {
    const todos = [...this.perfiles, this.yo];
    return this.miembros.filter((m) => m.cuenta_id === this.yo.id).map((m) => {
      const c = this.clinicas.find((x) => x.id === m.clinica_id)!;
      return {
        id: c.id, nombre: c.nombre, direccion: c.direccion, telefono: c.telefono, miembro_id: m.id, roles: m.roles, estado: m.estado,
        invitado_por_nombre: todos.find((p) => p.id === m.invitado_por)?.nombre ?? null,
        veterinarios: this.miembros.filter((x) => x.clinica_id === c.id && x.estado === "activo" && x.roles.includes("veterinario")).length,
        created_at: "2026-11-25T12:00:00Z", revision: c.revision, motivo_revision: c.motivo_revision,
      };
    });
  }

  override async equipoClinica(clinicaId: string): Promise<MiembroClinicaDto[]> {
    if (!this.miFila(clinicaId)) throw new Error("No sos parte de esta veterinaria");
    const todos = [...this.perfiles, this.yo];
    return this.miembros.filter((m) => m.clinica_id === clinicaId).map((m) => {
      const p = todos.find((x) => x.id === m.cuenta_id)!;
      return {
        miembro_id: m.id, cuenta_id: p.id, nombre: p.nombre, email: p.email, telefono: p.telefono ?? null, foto_path: null,
        roles: m.roles, estado: m.estado, es_yo: p.id === this.yo.id,
      };
    });
  }

  /** Como agendas_que_manejo: titular, administración o recepción activos ven la agenda de los veterinarios activos. */
  override async agendasQueManejo(): Promise<AgendaManejadaDto[]> {
    const r: AgendaManejadaDto[] = [];
    for (const yo of this.miembros.filter((m) => m.cuenta_id === this.yo.id && m.estado === "activo")) {
      if (!yo.roles.some((x) => x === "titular" || x === "administrador" || x === "recepcion") || !this.aprobada(yo.clinica_id)) continue;
      const c = this.clinicas.find((x) => x.id === yo.clinica_id)!;
      for (const v of this.miembros.filter((m) => m.clinica_id === c.id && m.estado === "activo" && m.roles.includes("veterinario"))) {
        // Un veterinario en revisión todavía no tiene agenda
        const perfil = [...this.perfiles, this.yo].find((p) => p.id === v.cuenta_id);
        if (v.cuenta_id !== this.yo.id && perfil && this.esVetActivo(perfil)) {
          r.push({ clinica_id: c.id, clinica_nombre: c.nombre, veterinario_id: v.cuenta_id });
        }
      }
    }
    return r;
  }

  /** Como nueva_clinica: un veterinario aprobado la tiene aprobada (y atiende ahí); cualquier otra cuenta, pendiente. */
  override async crearClinica(nombre: string, direccion: string | null, telefono: string | null): Promise<string> {
    this.llamadas.push(`crearClinica:${nombre}`);
    if (nombre.trim().length < 2) throw new Error("Ingresá el nombre de la veterinaria");
    const vet = this.esVetActivo(this.yo);
    const id = `cli-${this.clinicas.length + 1}`;
    this.clinicas.push({ id, nombre, direccion, telefono, creada_por: this.yo.id, revision: vet ? "aprobada" : "pendiente", motivo_revision: null });
    this.miembros.push({
      id: `mie-${this.miembros.length + 1}`, clinica_id: id, cuenta_id: this.yo.id,
      roles: vet ? ["titular", "veterinario"] : ["titular"], estado: "activo", invitado_por: null,
    });
    return id;
  }

  override async clinicasParaRevisar(): Promise<ClinicaParaRevisarDto[]> {
    if (this.yo.rol !== "admin") return [];
    const todos = [...this.perfiles, this.yo];
    return this.clinicas.filter((c) => c.revision === "pendiente").map((c) => {
      const t = todos.find((p) => p.id === c.creada_por);
      return {
        id: c.id, nombre: c.nombre, direccion: c.direccion, telefono: c.telefono, created_at: "2026-11-26T12:00:00Z",
        titular_id: t?.id ?? null, titular_nombre: t?.nombre ?? null, titular_email: t?.email ?? null,
      };
    });
  }

  override async revisarClinica(clinicaId: string, aprobar: boolean, motivo: string | null): Promise<void> {
    this.llamadas.push(`revisarClinica:${clinicaId}=${aprobar}`);
    if (this.yo.rol !== "admin") throw new Error("Solo un administrador puede revisar veterinarias");
    const c = this.clinicas.find((x) => x.id === clinicaId);
    if (!c) throw new Error("La veterinaria ya no existe");
    if (!aprobar && !motivo?.trim()) throw new Error("Escribí el motivo del rechazo");
    c.revision = aprobar ? "aprobada" : "rechazada";
    c.motivo_revision = aprobar ? null : motivo;
  }

  override async invitarAClinica(clinicaId: string, dniOCorreo: string, roles: RolClinica[]): Promise<string> {
    this.llamadas.push(`invitarAClinica:${clinicaId}:${dniOCorreo}:${roles.join(",")}`);
    if (!this.administro(clinicaId)) throw new Error("Solo la titularidad o la administración pueden sumar personas");
    const cuenta = this.cuentaPorDato(dniOCorreo);
    if (!cuenta) throw new Error("No encontramos una cuenta con ese DNI o correo. La otra persona tiene que registrarse primero en PetCare.");
    if (this.miembros.some((m) => m.clinica_id === clinicaId && m.cuenta_id === cuenta.id)) throw new Error("Esa persona ya está en el equipo o tiene una invitación");
    this.validarRoles(clinicaId, roles, cuenta);
    this.miembros.push({ id: `mie-${this.miembros.length + 1}`, clinica_id: clinicaId, cuenta_id: cuenta.id, roles, estado: "pendiente", invitado_por: this.yo.id });
    return cuenta.nombre;
  }

  override async responderInvitacionClinica(miembroId: string, aceptar: boolean): Promise<void> {
    this.llamadas.push(`responderInvitacionClinica:${miembroId}=${aceptar}`);
    const m = this.miembros.find((x) => x.id === miembroId && x.cuenta_id === this.yo.id && x.estado === "pendiente");
    if (!m) throw new Error("La invitación ya no está disponible");
    if (aceptar) m.estado = "activo";
    else this.miembros = this.miembros.filter((x) => x !== m);
  }

  override async quitarDeClinica(miembroId: string): Promise<void> {
    this.llamadas.push(`quitarDeClinica:${miembroId}`);
    const m = this.miembros.find((x) => x.id === miembroId);
    if (!m) throw new Error("Esa persona ya no está en el equipo");
    const propio = m.cuenta_id === this.yo.id;
    if (!propio && !this.administro(m.clinica_id)) throw new Error("Solo la titularidad o la administración pueden sacar personas");
    if (!propio && m.roles.includes("titular") && !this.miFila(m.clinica_id)?.roles.includes("titular")) throw new Error("Solo un titular puede sacar a otro titular");
    if (m.roles.includes("titular") && m.estado === "activo" && this.titulares(m.clinica_id).length === 1) {
      throw new Error("La veterinaria tiene que quedar con al menos un titular");
    }
    this.miembros = this.miembros.filter((x) => x !== m);
  }

  override async cambiarRolesClinica(miembroId: string, roles: RolClinica[]): Promise<void> {
    this.llamadas.push(`cambiarRolesClinica:${miembroId}:${roles.join(",")}`);
    const m = this.miembros.find((x) => x.id === miembroId);
    if (!m || !this.administro(m.clinica_id)) throw new Error("Solo la titularidad o la administración pueden cambiar roles");
    const cuenta = [...this.perfiles, this.yo].find((p) => p.id === m.cuenta_id)!;
    this.validarRoles(m.clinica_id, roles, cuenta);
    if (m.roles.includes("titular") && !roles.includes("titular") && this.titulares(m.clinica_id).length === 1) {
      throw new Error("La veterinaria tiene que quedar con al menos un titular");
    }
    m.roles = roles;
  }

  /** Como crear-cuenta-miembro: la cuenta nueva queda activa en la veterinaria al instante. */
  override async crearCuentaMiembro(datos: NuevaCuentaMiembroDto): Promise<CuentaMiembroCreadaDto> {
    this.llamadas.push(`crearCuentaMiembro:${datos.email}`);
    if (!this.administro(datos.clinica_id)) throw new Error("Solo la titularidad o la administración pueden crear cuentas del equipo.");
    if (datos.roles.some((r) => r === "titular")) throw new Error("Desde acá no se crean titulares.");
    if (this.errorAlCrearCuenta != null) throw new Error(this.errorAlCrearCuenta);
    const esVet = datos.roles.includes("veterinario");
    if (esVet && (!datos.matricula?.trim() || !datos.credencial)) throw new Error("Falta la matrícula o la foto del carnet");
    const id = `miembro-${this.perfiles.length + 1}`;
    this.perfiles.push(esVet
      ? Escenario.veterinario(id, datos.nombre, "pendiente_revision")
      : Escenario.perfil(id, "dueno", datos.nombre, { dni: datos.dni }));
    this.miembros.push({ id: `mie-${this.miembros.length + 1}`, clinica_id: datos.clinica_id, cuenta_id: id, roles: datos.roles, estado: "activo", invitado_por: this.yo.id });
    return { usuario_id: id, email: datos.email, password_temporal: "Temp#1234", en_revision: esVet };
  }

  /** Como la consulta real (MASCOTA_CON_DUENO): cada mascota trae el contacto de su dueño si tiene cuenta. */
  override async mascotasDelVeterinario(): Promise<MascotaDto[]> {
    const todos = [...this.perfiles, this.yo];
    return this.mascotas.filter((m) => m.activa).map((m) => {
      const d = m.dueno_id ? todos.find((p) => p.id === m.dueno_id) : undefined;
      return d && m.dueno == null ? { ...m, dueno: { nombre: d.nombre, email: d.email, telefono: d.telefono ?? null } } : m;
    });
  }

  override async mascotasAdmin(): Promise<MascotaDto[]> {
    return this.mascotas.filter((m) => m.activa);
  }

  override async crearMascota(mascota: NuevaMascotaDto): Promise<void> {
    this.llamadas.push(`crearMascota:${mascota.nombre}`);
    this.mascotas.push(
      mascotaDto({
        id: mascota.id, dueno_id: mascota.dueno_id, nombre: mascota.nombre, tipo: mascota.tipo, raza: mascota.raza,
        nacimiento: mascota.nacimiento, sexo: mascota.sexo, peso_kg: mascota.peso_kg,
        propietario_nombre: mascota.propietario_nombre, propietario_dni: mascota.propietario_dni,
      }),
    );
  }

  override async actualizarMascota(id: string, cambios: JsonObject): Promise<void> {
    this.llamadas.push(`mascota:${id}:` + ordenadas(cambios).join(","));
    const i = this.mascotas.findIndex((m) => m.id === id);
    if (primitivo(cambios["activa"]) === "false" && i >= 0) this.mascotas[i] = { ...this.mascotas[i], activa: false };
    const motivo = primitivo(cambios["motivo_baja"]);
    if (motivo != null && i >= 0) this.mascotas[i] = { ...this.mascotas[i], motivo_baja: motivo };
    const nuevo = primitivo(cambios["estado"]);
    if (nuevo != null && i >= 0) this.mascotas[i] = { ...this.mascotas[i], estado: nuevo };
  }

  // ---------- Turnos ----------

  override async turnos(): Promise<TurnoDto[]> {
    return [...this.turnosGuardados];
  }

  override async crearTurno(turno: NuevoTurnoDto): Promise<void> {
    this.llamadas.push(`crearTurno:${turno.fecha} ${turno.hora}`);
    this.turnosGuardados.push({
      id: turno.id, mascota_id: turno.mascota_id, veterinario_id: turno.veterinario_id ?? null, categoria: turno.categoria,
      motivo: turno.motivo ?? null, fecha: turno.fecha, hora: turno.hora, estado: turno.estado ?? "pendiente",
      notas: turno.notas ?? null, duracion_min: 30, sede_id: turno.sede_id ?? null,
    });
    // El servidor le da acceso al veterinario apenas se agenda el turno
    const vet = turno.veterinario_id;
    if (vet != null && !this.accesosGuardados.some((a) => a.mascota_id === turno.mascota_id && a.veterinario_id === vet)) {
      this.accesosGuardados.push(accesoDto(`acc-${this.accesosGuardados.length}`, turno.mascota_id, vet, "activo", "dueno"));
    }
  }

  override async actualizarTurno(id: string, cambios: JsonObject): Promise<void> {
    this.llamadas.push(
      `turno:${id}:` +
        Object.keys(cambios).sort().map((k) => `${k}=${primitivo(cambios[k])}`).join(","),
    );
    const i = this.turnosGuardados.findIndex((t) => t.id === id);
    if (i < 0) return;
    let t = this.turnosGuardados[i];
    const estado = texto(cambios, "estado");
    if (estado != null) t = { ...t, estado };
    const fecha = texto(cambios, "fecha");
    if (fecha != null) t = { ...t, fecha };
    const hora = texto(cambios, "hora");
    if (hora != null) t = { ...t, hora };
    if ("veterinario_id" in cambios) t = { ...t, veterinario_id: texto(cambios, "veterinario_id") };
    if ("sede_id" in cambios) t = { ...t, sede_id: texto(cambios, "sede_id") };
    if ("notas" in cambios) t = { ...t, notas: texto(cambios, "notas") };
    if ("llegada" in cambios) t = { ...t, llegada: texto(cambios, "llegada") as TurnoDto["llegada"] };
    this.turnosGuardados[i] = t;
  }

  // ---------- Veterinarios y accesos ----------

  override async catalogoVeterinarios(): Promise<PerfilDto[]> {
    return this.perfiles.filter((p) => p.rol === "veterinario");
  }

  override async accesos(): Promise<AccesoDto[]> {
    return [...this.accesosGuardados];
  }

  override async misSolicitudes(): Promise<SolicitudAccesoDto[]> {
    return this.accesosGuardados
      .filter((a) => a.veterinario_id === this.yo.id && (a.iniciado_por === "veterinario" || a.estado === "pendiente"))
      .map((a) => {
        const m = this.mascotas.find((x) => x.id === a.mascota_id);
        return {
          id: a.id,
          mascota_nombre: m?.nombre ?? "Mascota",
          mascota_tipo: m?.tipo ?? null,
          dueno_nombre: m?.dueno?.nombre ?? m?.propietario_nombre ?? null,
          estado: a.estado,
          iniciado_por: a.iniciado_por,
          created_at: a.created_at ?? null,
        };
      });
  }

  override async compartirMascotas(mascotaIds: string[], veterinarioId: string, venceEl?: string | null): Promise<void> {
    this.llamadas.push(`compartir:${mascotaIds.length}:${veterinarioId}` + (venceEl != null ? `:${venceEl}` : ""));
    for (const id of mascotaIds) {
      const i = this.accesosGuardados.findIndex((a) => a.mascota_id === id && a.veterinario_id === veterinarioId);
      if (i >= 0) this.accesosGuardados[i] = { ...this.accesosGuardados[i], estado: "activo", vence_el: venceEl ?? null };
      else this.accesosGuardados.push(accesoDto(`acc-${this.accesosGuardados.length}`, id, veterinarioId, "activo", "dueno", venceEl ?? null));
    }
  }

  override async fijarVencimientoDeAccesos(veterinarioId: string, venceEl: string | null): Promise<void> {
    this.llamadas.push(`vence:${veterinarioId}=${venceEl}`);
    for (let i = 0; i < this.accesosGuardados.length; i++) {
      if (this.accesosGuardados[i].veterinario_id === veterinarioId && this.accesosGuardados[i].estado === "activo") {
        this.accesosGuardados[i] = { ...this.accesosGuardados[i], vence_el: venceEl };
      }
    }
  }

  historialAccesos: AccesoHistorialDto[] = [];

  override async historialDeAccesos(): Promise<AccesoHistorialDto[]> {
    return [...this.historialAccesos];
  }

  override async actualizarAcceso(id: string, estado: string): Promise<void> {
    this.llamadas.push(`acceso:${id}=${estado}`);
    const i = this.accesosGuardados.findIndex((a) => a.id === id);
    if (i >= 0) this.accesosGuardados[i] = { ...this.accesosGuardados[i], estado };
  }

  override async actualizarAccesosDeVeterinario(veterinarioId: string, estado: string): Promise<void> {
    this.llamadas.push(`accesosDe:${veterinarioId}=${estado}`);
    for (let i = 0; i < this.accesosGuardados.length; i++) {
      if (this.accesosGuardados[i].veterinario_id === veterinarioId) this.accesosGuardados[i] = { ...this.accesosGuardados[i], estado };
    }
  }

  ultimoTurnoPropuesto: JsonObject | null = null;

  override async solicitarAcceso(mascotaId: string, turno?: JsonObject | null): Promise<string> {
    this.llamadas.push(`solicitarAcceso:${mascotaId}`);
    this.ultimoTurnoPropuesto = turno ?? null;
    this.accesosGuardados.push(accesoDto(`acc-${this.accesosGuardados.length}`, mascotaId, this.yo.id, "pendiente", "veterinario"));
    return "pendiente";
  }

  override async buscarDueno(_dato: string): Promise<DuenoBuscadoDto[]> {
    return [...this.duenosBuscables];
  }

  override async horariosOcupados(_veterinarioId: string, _fecha: string): Promise<HoraOcupadaDto[]> {
    return this.ocupados;
  }

  // ---------- Estudios previos de un turno ----------

  estudios: EstudioTurnoDto[] = [];

  override async estudiosDeTurno(turnoId: string): Promise<EstudioTurnoDto[]> {
    return this.estudios.filter((e) => e.turno_id === turnoId);
  }

  override async adjuntarEstudios(estudios: NuevoEstudioTurnoDto[]): Promise<void> {
    this.llamadas.push(`adjuntarEstudios:${estudios.length}`);
    for (const e of estudios) {
      this.estudios.push({
        id: `est-${this.estudios.length}`, turno_id: e.turno_id, storage_path: e.storage_path, nombre: e.nombre,
        extension: e.extension, tipo: e.tipo,
      });
    }
  }

  // ---------- Historia clínica ----------

  override async registrosSalud(): Promise<RegistroSaludDto[]> {
    return [...this.registros];
  }

  ultimoRegistroCreado: NuevoRegistroSaludDto | null = null;

  override async crearRegistroSalud(registro: NuevoRegistroSaludDto): Promise<void> {
    this.llamadas.push(`crearRegistro:${registro.tipo}:${registro.titulo}`);
    this.ultimoRegistroCreado = registro;
  }

  recordatoriosGuardados: RecordatorioDto[] = [];

  override async recordatorios(): Promise<RecordatorioDto[]> {
    return [...this.recordatoriosGuardados];
  }

  override async crearRecordatorio(r: NuevoRecordatorioDto): Promise<void> {
    this.llamadas.push(`crearRecordatorio:${r.titulo}`);
    this.recordatoriosGuardados.push({
      id: r.id, mascota_id: r.mascota_id, creado_por: r.creado_por, titulo: r.titulo, tipo: r.tipo, fecha: r.fecha,
      hora: r.hora ?? null, nota: r.nota ?? null,
    });
  }

  override async actualizarRecordatorio(id: string, cambios: JsonObject): Promise<void> {
    this.llamadas.push(`actualizarRecordatorio:${id}`);
    const i = this.recordatoriosGuardados.findIndex((r) => r.id === id);
    if (i < 0) return;
    const r = this.recordatoriosGuardados[i];
    this.recordatoriosGuardados[i] = {
      ...r,
      titulo: primitivo(cambios["titulo"]) ?? r.titulo,
      fecha: primitivo(cambios["fecha"]) ?? r.fecha,
    };
  }

  override async borrarRecordatorio(id: string): Promise<void> {
    this.llamadas.push(`borrarRecordatorio:${id}`);
    this.recordatoriosGuardados = this.recordatoriosGuardados.filter((r) => r.id !== id);
  }

  override async eliminarRegistroSalud(id: string): Promise<void> {
    this.llamadas.push(`eliminarRegistro:${id}`);
  }

  override async informesDe(mascotaId: string): Promise<InformeDto[]> {
    return this.informes.filter((i) => i.mascota_id === mascotaId);
  }

  override async crearInforme(informe: NuevoInformeDto): Promise<void> {
    this.llamadas.push(`crearInforme:${informe.mascota_id}`);
    this.ultimoInformeCreado = informe;
  }

  override async actualizarInforme(id: string, cambios: JsonObject): Promise<void> {
    this.llamadas.push(`actualizarInforme:${id}`);
    this.ultimosCambiosDeInforme = cambios;
  }

  recetas: PrescripcionDto[] = [];
  ultimosCambiosDeInforme: JsonObject | null = null;
  ultimoInformeCreado: NuevoInformeDto | null = null;

  override async prescripciones(mascotaId?: string | null): Promise<PrescripcionDto[]> {
    return this.recetas.filter((r) => mascotaId == null || r.mascota_id === mascotaId);
  }

  override async crearPrescripcion(p: NuevaPrescripcionDto): Promise<void> {
    this.llamadas.push(`crearPrescripcion:${p.medicamento}`);
    this.recetas.push({
      id: p.id, mascota_id: p.mascota_id, turno_id: p.turno_id ?? null, veterinario_id: p.veterinario_id,
      medicamento: p.medicamento, dosis: p.dosis ?? null, frecuencia_horas: p.frecuencia_horas ?? null,
      duracion_dias: p.duracion_dias ?? null, indicaciones: p.indicaciones ?? null, inicio: p.inicio,
    });
  }

  override async eliminarPrescripcion(id: string): Promise<void> {
    this.llamadas.push(`eliminarPrescripcion:${id}`);
    this.recetas = this.recetas.filter((r) => r.id !== id);
  }

  tomasGuardadas: TomaDto[] = [];

  override async tomas(mascotaId?: string | null): Promise<TomaDto[]> {
    return this.tomasGuardadas.filter((t) => mascotaId == null || t.mascota_id === mascotaId);
  }

  override async registrarToma(prescripcionId: string, programada: string): Promise<void> {
    this.llamadas.push(`registrarToma:${prescripcionId}:${programada}`);
    const receta = this.recetas.find((r) => r.id === prescripcionId);
    if (!receta) throw new Error("La receta no existe");
    if (this.tomasGuardadas.some((t) => t.prescripcion_id === prescripcionId && t.programada === programada)) return;
    this.tomasGuardadas.push({
      id: `toma-${this.tomasGuardadas.length + 1}`, prescripcion_id: prescripcionId, mascota_id: receta.mascota_id, programada,
      dada_at: "2026-11-24T08:05:00+00:00", registrada_por: this.yo.id,
    });
  }

  override async quitarToma(prescripcionId: string, programada: string): Promise<void> {
    this.llamadas.push(`quitarToma:${prescripcionId}:${programada}`);
    this.tomasGuardadas = this.tomasGuardadas.filter((t) => !(t.prescripcion_id === prescripcionId && t.programada === programada));
  }

  override async guardarAlertas(mascotaId: string, alertas: string): Promise<void> {
    this.llamadas.push(`alertas:${mascotaId}:${alertas}`);
  }

  override async archivosDe(mascotaId: string): Promise<ArchivoDto[]> {
    return this.archivos.filter((a) => a.mascota_id === mascotaId);
  }

  override async crearArchivo(a: NuevoArchivoDto): Promise<void> {
    this.llamadas.push(`crearArchivo:${a.nombre}`);
    this.archivos.push({
      id: a.id, mascota_id: a.mascota_id, nombre: a.nombre, extension: a.extension, storage_path: a.storage_path,
      tamano_bytes: a.tamano_bytes ?? null, subido_por: a.subido_por, turno_id: a.turno_id ?? null,
    });
  }

  override async renombrarArchivo(_id: string, nombre: string): Promise<void> {
    this.llamadas.push(`renombrarArchivo:${nombre}`);
  }

  override async eliminarArchivo(id: string): Promise<void> {
    this.llamadas.push(`eliminarArchivo:${id}`);
  }

  // ---------- Storage ----------

  override async subir(bucket: string, ruta: string, _bytes: Uint8Array, _tipoMime: string): Promise<void> {
    this.subidas.push(`${bucket}/${ruta}`);
  }

  override async borrar(bucket: string, rutas: string[]): Promise<void> {
    this.llamadas.push(`borrar:${bucket}:${rutas.length}`);
    for (const r of rutas) this.borradas.push(`${bucket}/${r}`);
  }

  // ---------- Notificaciones ----------

  override async notificaciones(): Promise<NotificacionDto[]> {
    return [...this.notificacionesGuardadas];
  }

  override async marcarNotificacionesLeidas(): Promise<void> {
    this.llamadas.push("notificacionesLeidas");
  }

  override async borrarNotificaciones(): Promise<void> {
    this.llamadas.push("notificacionesBorradas");
    this.notificacionesGuardadas = [];
  }

  override async borrarNotificacion(id: string): Promise<void> {
    this.llamadas.push(`notificacionBorrada:${id}`);
    this.notificacionesGuardadas = this.notificacionesGuardadas.filter((n) => n.id !== id);
  }

  // ---------- Administrador ----------

  fallaAlCargarAdmin = false;

  override async perfilesAdmin(): Promise<PerfilDto[]> {
    if (this.fallaAlCargarAdmin) throw new Error("sin conexión");
    return this.perfiles.filter((p) => p.rol !== "admin");
  }

  override async actividadAdmin(): Promise<ActividadDto[]> {
    return [...this.actividad];
  }

  override async resumenAdmin(): Promise<JsonObject> {
    return this.resumen;
  }

  override async cambiarEstadoCuenta(id: string, estado: string, motivo: string | null): Promise<void> {
    this.llamadas.push(`estadoCuenta:${id}=${estado}` + (motivo != null ? `:${motivo}` : ""));
    const i = this.perfiles.findIndex((p) => p.id === id);
    if (i < 0) return;
    const p = this.perfiles[i];
    // Como el servidor: en un veterinario el estado de la cuenta y el de la revisión van juntos
    this.perfiles[i] = {
      ...p,
      estado,
      motivo_estado: motivo,
      veterinarios:
        p.veterinarios && p.rol === "veterinario"
          ? { ...p.veterinarios, estado_revision: estado, motivo_revision: motivo }
          : p.veterinarios,
    };
  }

  override async revisarVeterinario(id: string, estado: string, motivo: string | null): Promise<void> {
    this.llamadas.push(`revisionVet:${id}=${estado}` + (motivo != null ? `:${motivo}` : ""));
    const i = this.perfiles.findIndex((p) => p.id === id);
    if (i < 0) return;
    const p = this.perfiles[i];
    this.perfiles[i] = {
      ...p,
      // Si es su rol principal la cuenta sigue la revisión; si es dueño, la cuenta no se toca
      estado: p.rol === "veterinario" ? estado : p.estado,
      motivo_estado: p.rol === "veterinario" ? motivo : p.motivo_estado,
      veterinarios: p.veterinarios ? { ...p.veterinarios, estado_revision: estado, motivo_revision: motivo } : p.veterinarios,
    };
  }

  // ---------- Alta como veterinario sobre una cuenta de dueño ----------

  ultimaSolicitudDeAlta: SolicitudAltaVeterinarioDto | null = null;
  ultimaCredencial: string | null = null;
  get rutasSubidas(): string[] {
    return [...this.subidas];
  }

  override async solicitarAltaVeterinario(datos: SolicitudAltaVeterinarioDto): Promise<void> {
    this.llamadas.push(`altaVeterinario:${datos.matricula}`);
    this.ultimaSolicitudDeAlta = datos;
    const yoId = this.yo.id;
    // Como el servidor: el primer lugar sale de lo "de siempre" y los demás son los extra
    const sedes: SedeDto[] =
      datos.sedesExtra.length === 0
        ? []
        : [
            {
              id: "sede-1", veterinario_id: yoId, nombre: datos.clinica, direccion: datos.direccionClinica,
              dias_atencion: datos.dias, hora_apertura: datos.apertura + ":00", hora_cierre: datos.cierre + ":00",
              activa: true, created_at: "2026-01-01",
            },
            ...datos.sedesExtra.map((e, i) => ({
              id: `sede-${i + 2}`, veterinario_id: yoId, nombre: e.nombre, direccion: e.direccion,
              dias_atencion: [...e.dias].sort((a, b) => a - b), hora_apertura: e.apertura + ":00",
              hora_cierre: e.cierre + ":00", activa: true, created_at: `2026-01-0${i + 2}`,
            })),
          ];
    // Como el servidor: el dueño queda con un rol de veterinario pendiente de revisión
    this.yo = {
      ...this.yo,
      veterinarios: normalizarVeterinario({
        profile_id: yoId, matricula: datos.matricula, clinica: datos.clinica, direccion_clinica: datos.direccionClinica,
        credencial_path: datos.credencialPath, estado_revision: "pendiente_revision", sedes,
      }),
    };
    const i = this.perfiles.findIndex((p) => p.id === yoId);
    if (i >= 0) this.perfiles[i] = this.yo;
  }

  override async guardarCredencial(ruta: string): Promise<void> {
    this.llamadas.push(`credencial:${ruta}`);
    this.ultimaCredencial = ruta;
  }

  // ---------- Baja ----------

  override async rutasArchivosCuenta(): Promise<RutaDto[]> {
    return [
      { bucket: "fotos", ruta: `${this.yo.id}/a.jpg` },
      { bucket: "archivos", ruta: "m/x.pdf" },
    ];
  }

  override async eliminarCuenta(): Promise<void> {
    this.llamadas.push("eliminarCuenta");
  }
}

// ---------- Constructores de DTO con los valores por defecto de Kotlin ----------

/** Una mascota con los valores por defecto del DTO de Kotlin (activa, estado "activa"). */
export function mascotaDto(m: Partial<MascotaDto> & { id: string; nombre: string; tipo: string }): MascotaDto {
  return { activa: true, estado: "activa", ...m };
}

export function turnoDto(t: Partial<TurnoDto> & { id: string; mascota_id: string; categoria: string; fecha: string; hora: string }): TurnoDto {
  return { estado: "pendiente", duracion_min: 30, ...t };
}

export function accesoDto(
  id: string, mascotaId: string, veterinarioId: string, estado: string, iniciadoPor: string, venceEl: string | null = null,
): AccesoDto {
  return { id, mascota_id: mascotaId, veterinario_id: veterinarioId, estado, iniciado_por: iniciadoPor, vence_el: venceEl };
}

/** Datos de ejemplo que arman cada prueba (viven solo en los tests, no en la app). */
const DUENO_ID = "dueno-1";
const VET_ID = "vet-1";
const ADMIN_ID = "admin-1";

export const Escenario = {
  DUENO_ID,
  VET_ID,
  ADMIN_ID,

  perfil(
    id: string, rol: string, nombre: string,
    opciones: { estado?: string; motivo?: string | null; veterinario?: Partial<VeterinarioDto> | null; dni?: string | null } = {},
  ): PerfilDto {
    return normalizarPerfil({
      id, rol, estado: opciones.estado ?? "activo", motivo_estado: opciones.motivo ?? null, nombre, email: `${id}@prueba.test`,
      telefono: "1155550000", direccion: "Calle 123", created_at: "2026-01-10T12:00:00+00:00",
      debe_cambiar_password: false,
      veterinarios: (opciones.veterinario ?? null) as VeterinarioDto | null,
      perfiles_privados: opciones.dni != null ? { dni: opciones.dni } : null,
    });
  },

  dueno(): PerfilDto {
    return Escenario.perfil(Escenario.DUENO_ID, "dueno", "Ana Prueba", { dni: "30111222" });
  },

  veterinario(id: string = VET_ID, nombre: string = "Dr. Vera", estado: string = "activo"): PerfilDto {
    return Escenario.perfil(id, "veterinario", nombre, {
      estado,
      dni: "28999888",
      veterinario: {
        profile_id: id, matricula: "MP-100", clinica: "Clínica Sur", direccion_clinica: "Av. Siempreviva 742",
        dias_atencion: [1, 2, 3, 4, 5], hora_apertura: "09:00:00", hora_cierre: "12:00:00",
        especialidades: ["Chequeo médico integral", "Cardiología"],
        // En el servidor la revisión del rol acompaña al estado de la cuenta
        estado_revision: estado,
      },
    });
  },

  /** El mismo veterinario atendiendo en dos lugares: de lunes a viernes por la mañana y los sábados en otro. */
  veterinarioEnDosLugares(id: string = VET_ID, nombre: string = "Dr. Vera"): PerfilDto {
    const base = Escenario.veterinario(id, nombre);
    return {
      ...base,
      veterinarios: {
        ...(base.veterinarios as VeterinarioDto),
        sedes: [
          {
            id: "sede-a", veterinario_id: id, nombre: "Clínica Sur", direccion: "Av. Siempreviva 742",
            dias_atencion: [1, 2, 3, 4, 5], hora_apertura: "09:00:00", hora_cierre: "12:00:00", activa: true,
            created_at: "2026-01-01",
          },
          {
            id: "sede-b", veterinario_id: id, nombre: "Consultorio Centro", direccion: "San Martín 100",
            dias_atencion: [6], hora_apertura: "10:00:00", hora_cierre: "14:00:00", activa: true,
            created_at: "2026-01-02",
          },
        ],
      },
    };
  },

  /** Un dueño que además es veterinario: la cuenta es de dueño y el rol de veterinario tiene su propia revisión. */
  duenoYVeterinario(revision: string = "activo"): PerfilDto {
    return Escenario.perfil(Escenario.DUENO_ID, "dueno", "Ana Prueba", {
      dni: "30111222",
      veterinario: {
        profile_id: Escenario.DUENO_ID, matricula: "MP-777", clinica: "Clínica Norte", direccion_clinica: "Calle 5",
        dias_atencion: [1, 2, 3, 4, 5], hora_apertura: "09:00:00", hora_cierre: "18:00:00",
        credencial_path: `${Escenario.DUENO_ID}/carnet.jpg`, estado_revision: revision,
      },
    });
  },

  admin(): PerfilDto {
    return Escenario.perfil(Escenario.ADMIN_ID, "admin", "Administración");
  },

  mascota(id: string, nombre: string, dueno: string | null = DUENO_ID, tipo: string = "Perro"): MascotaDto {
    return mascotaDto({
      id, dueno_id: dueno, nombre, tipo, raza: "Mestizo", nacimiento: "2020-03-15", sexo: "macho", peso_kg: 12.0,
    });
  },

  turno(
    id: string, mascotaId: string, fecha: string, hora: string, vet: string | null = VET_ID, estado: string = "pendiente",
  ): TurnoDto {
    return turnoDto({ id, mascota_id: mascotaId, veterinario_id: vet, categoria: "Control", fecha, hora, estado });
  },

  resumen(pares: Record<string, number>): JsonObject {
    return { ...pares };
  },

  entero(json: JsonObject, clave: string): number | null {
    const v = json[clave];
    return typeof v === "number" && Number.isInteger(v) ? v : null;
  },
};
