import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { AlmacenSeguro } from "./almacenSeguro";
import { ErrorConMensaje } from "../../util/errores";
import type {
  AccesoDto, AccesoHistorialDto, ActividadDto, ArchivoDto, CuentaDuenoCreadaDto, DuenoBuscadoDto, DuenoMascotaDto,
  EstudioTurnoDto, HoraOcupadaDto, InformeDto, InvitacionCoduenoDto, JsonObject, MascotaDto, NotificacionDto, NuevaCuentaDuenoDto, NuevaMascotaDto,
  NuevaPrescripcionDto, NuevaSedeDto, NuevoArchivoDto, NuevoEstudioTurnoDto, NuevoInformeDto, NuevoRecordatorioDto,
  NuevoRegistroSaludDto, NuevoTurnoDto, PerfilDto, PrescripcionDto, RecordatorioDto, RegistroSaludDto, RutaDto,
  SolicitudAccesoDto, SolicitudAltaVeterinarioDto, TomaDto, TurnoDto,
  AgendaManejadaDto, ClinicaDto, ClinicaParaRevisarDto, NuevaClinicaDto, TipoHabilitacion, CuentaMiembroCreadaDto, MiembroClinicaDto, NuevaCuentaMiembroDto, RolClinica,
} from "./dtos";
import { normalizarPerfil } from "./dtos";
import { datosDeSedes } from "./sedesJson";
import type { FuenteDatos, ResultadoRegistro } from "./fuenteDatos";

// Claves públicas del proyecto de Supabase: la seguridad la da RLS en la base, no el secreto de la clave
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://ffzgeywirlcihcdqbeiz.supabase.co";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "sb_publishable_J2W3mg3jhbnGsQwVMB-Zaw_ZFN9tHC9";

/** Adonde vuelve el correo de recuperación: la app (esquema `petcare`) o, en la web, la propia página. */
export function enlaceDeRecuperacion(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/auth/recuperar`;
  return "petcare://recuperar";
}

const PERFIL_COMPLETO = "*,veterinarios(*,sedes(*)),perfiles_privados(dni)";
/** Lo que muestra el panel del administrador: sin las preferencias ni el encuadre de la foto. */
const PERFIL_ADMIN =
  "id,rol,estado,motivo_estado,nombre,email,telefono,direccion,foto_path,created_at," +
  "veterinarios(*,sedes(*)),perfiles_privados(dni)";
const CATALOGO = "id,rol,estado,nombre,email,telefono,direccion,foto_path,veterinarios!inner(*,sedes(*))";
const MASCOTA_CON_DUENO = "*,dueno:profiles!mascotas_dueno_id_fkey(nombre,email,telefono,direccion,foto_path)";

const TABLAS_ESCUCHADAS = [
  "turnos", "accesos_mascota", "notificaciones", "mascotas", "informes_clinicos", "archivos_mascota",
  "registros_salud", "prescripciones", "sedes", "recordatorios", "coduenos_mascota", "tomas_medicacion",
];

/** Lanza el error de Supabase si lo hay; si no, devuelve los datos. */
function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

function vacio(r: { error: unknown }): void {
  if (r.error) throw r.error;
}

function aBytes(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

/** Implementación de FuenteDatos contra el proyecto de Supabase. */
export class SupabaseFuente implements FuenteDatos {
  readonly cliente: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage: AlmacenSeguro,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // Los enlaces del correo (recuperar contraseña) vuelven a la app con un código que se canjea por la sesión
      flowType: "pkce",
    },
  });

  private async miId(): Promise<string> {
    const { data } = await this.cliente.auth.getUser();
    const id = data.user?.id;
    if (!id) throw new ErrorConMensaje("No hay una sesión iniciada");
    return id;
  }

  // ---------- Cambios en vivo ----------

  /** Escucha los cambios de las tablas; el servidor solo manda los que el usuario puede ver (RLS). */
  cambios(alCambiar: () => void): () => void {
    const canal = this.cliente.channel(`cambios-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    for (const tabla of TABLAS_ESCUCHADAS) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, () => alCambiar());
    }
    canal.subscribe();
    return () => {
      void this.cliente.removeChannel(canal);
    };
  }

  // ---------- Sesión ----------

  async restaurarSesion(): Promise<string | null> {
    const { data } = await this.cliente.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  async ingresar(email: string, password: string): Promise<string> {
    const { data, error } = await this.cliente.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const id = data.user?.id;
    if (!id) throw new ErrorConMensaje("No se pudo iniciar la sesión");
    return id;
  }

  async registrar(email: string, password: string, datos: JsonObject): Promise<ResultadoRegistro> {
    const { data, error } = await this.cliente.auth.signUp({ email, password, options: { data: datos } });
    if (error) {
      // Si la base rechaza el alta (DNI o matrícula ya registrados) el servidor responde 500 sin explicar
      if ((error.status ?? 0) >= 500) {
        throw new ErrorConMensaje(
          "No pudimos crear la cuenta. Lo más probable es que el DNI o la matrícula ya estén registrados " +
            "con otra cuenta: revisalos e intentá de nuevo. Si ya tenés una cuenta de dueño, ingresá con " +
            "ella y pedí el alta como veterinario desde tu perfil.",
        );
      }
      throw error;
    }
    const sesion = data.session;
    const yaExistia = !sesion && !!data.user && (data.user.identities ?? []).length === 0;
    return { sesionIniciada: !!sesion, usuarioId: sesion?.user?.id ?? data.user?.id ?? null, correoYaRegistrado: yaExistia };
  }

  async solicitarAltaVeterinario(datos: SolicitudAltaVeterinarioDto): Promise<void> {
    vacio(
      await this.cliente.rpc("solicitar_alta_veterinario", {
        p_matricula: datos.matricula,
        p_clinica: datos.clinica,
        p_direccion_clinica: datos.direccionClinica,
        p_dias: datos.dias,
        p_apertura: datos.apertura,
        p_cierre: datos.cierre,
        p_especialidades: datos.especialidades,
        p_tipos_animales: datos.tiposAnimales,
        p_credencial_path: datos.credencialPath,
        p_sedes: datosDeSedes(datos.sedesExtra),
      }),
    );
  }

  async guardarCredencial(ruta: string): Promise<void> {
    vacio(await this.cliente.rpc("guardar_credencial", { p_path: ruta }));
  }

  async recuperarPassword(email: string): Promise<void> {
    // El correo vuelve a la app (o a la web) con este enlace: hay que declararlo en las URL permitidas de Supabase
    const { error } = await this.cliente.auth.resetPasswordForEmail(email, { redirectTo: enlaceDeRecuperacion() });
    if (error) throw error;
  }

  async abrirEnlaceDeRecuperacion(enlace: string): Promise<void> {
    const url = new URL(enlace);
    // Según cómo responda Supabase, los datos llegan en la consulta o en el fragmento
    const fragmento = new URLSearchParams(url.hash.replace(/^#/, ""));
    const dato = (nombre: string) => url.searchParams.get(nombre) ?? fragmento.get(nombre);

    const enlaceInvalido = 'El enlace no es válido. Pedí uno nuevo desde "Olvidé mi contraseña".';
    const motivo = dato("error_description");
    if (motivo) {
      const vencido = dato("error_code") === "otp_expired" || motivo.toLowerCase().includes("expired");
      throw new ErrorConMensaje(
        vencido ? 'El enlace venció o ya se usó. Pedí uno nuevo desde "Olvidé mi contraseña".' : enlaceInvalido,
      );
    }
    const codigo = dato("code");
    if (!codigo) throw new ErrorConMensaje(enlaceInvalido);
    const { error } = await this.cliente.auth.exchangeCodeForSession(codigo);
    if (error) {
      const texto = `${error.message}`.toLowerCase();
      if (texto.includes("network") || texto.includes("fetch")) throw error;
      throw new ErrorConMensaje("No pudimos validar el enlace. Pedí uno nuevo y abrilo en este mismo teléfono.");
    }
  }

  async cambiarPassword(email: string, actual: string, nueva: string): Promise<void> {
    // Se vuelve a validar la contraseña actual antes de cambiarla
    const ingreso = await this.cliente.auth.signInWithPassword({ email, password: actual });
    if (ingreso.error) throw ingreso.error;
    const { error } = await this.cliente.auth.updateUser({ password: nueva });
    if (error) throw error;
  }

  async definirPassword(nueva: string): Promise<void> {
    const { error } = await this.cliente.auth.updateUser({ password: nueva });
    if (error) throw error;
  }

  async completarPrimerIngreso(terminosVersion: string): Promise<void> {
    vacio(await this.cliente.rpc("completar_primer_ingreso", { p_terminos: terminosVersion }));
  }

  async crearCuentaDueno(datos: NuevaCuentaDuenoDto): Promise<CuentaDuenoCreadaDto> {
    return (await this.crearCuentaCon("crear-cuenta-dueno", datos, "No pudimos crear la cuenta del dueño.")) as unknown as CuentaDuenoCreadaDto;
  }

  async crearCuentaMiembro(datos: NuevaCuentaMiembroDto): Promise<CuentaMiembroCreadaDto> {
    return (await this.crearCuentaCon("crear-cuenta-miembro", datos, "No pudimos crear la cuenta.")) as unknown as CuentaMiembroCreadaDto;
  }

  /**
   * Llama a una de las Edge Functions que crean cuentas a pedido del veterinario. Responden { ok: false, mensaje }
   * con un texto pensado para mostrarle tal cual, también cuando rechazan el pedido.
   */
  private async crearCuentaCon(funcion: string, datos: object, falla: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.cliente.functions.invoke(funcion, { body: datos });
    let cuerpo = data as Record<string, unknown> | string | null;
    if (error) {
      let mensaje: string | undefined;
      const respuesta = (error as { context?: Response }).context;
      if (respuesta && typeof respuesta.json === "function") {
        try {
          mensaje = ((await respuesta.json()) as { mensaje?: string }).mensaje;
        } catch {
          mensaje = undefined;
        }
      }
      const estado = (error as { context?: { status?: number } }).context?.status;
      throw new ErrorConMensaje(
        mensaje ??
          (estado === 404
            ? "La creación de cuentas todavía no está habilitada en el servidor."
            : `${falla} Intentá de nuevo en un rato.`),
      );
    }
    if (typeof cuerpo === "string") cuerpo = JSON.parse(cuerpo) as Record<string, unknown>;
    if (!cuerpo || cuerpo.ok !== true) {
      throw new ErrorConMensaje((cuerpo?.mensaje as string | undefined) ?? falla);
    }
    return cuerpo;
  }

  async cerrarSesion(): Promise<void> {
    try {
      await this.cliente.auth.signOut();
    } finally {
      // Sin conexión (o si se corta la espera) no se avisa al servidor, pero la sesión guardada en el teléfono igual se descarta
      await this.cliente.auth.signOut({ scope: "local" }).catch(() => {});
    }
  }

  async matriculaDisponible(matricula: string): Promise<boolean> {
    return ok(await this.cliente.rpc("matricula_disponible", { p_matricula: matricula })) as boolean;
  }

  // ---------- Perfil ----------

  async miPerfil(): Promise<PerfilDto> {
    const fila = ok(await this.cliente.from("profiles").select(PERFIL_COMPLETO).eq("id", await this.miId()).single());
    return normalizarPerfil(fila as unknown as PerfilDto);
  }

  async actualizarPerfil(cambios: JsonObject): Promise<void> {
    vacio(await this.cliente.from("profiles").update(cambios).eq("id", await this.miId()));
  }

  async actualizarVeterinario(cambios: JsonObject): Promise<void> {
    vacio(await this.cliente.from("veterinarios").update(cambios).eq("profile_id", await this.miId()));
  }

  async crearSede(sede: NuevaSedeDto): Promise<void> {
    vacio(await this.cliente.from("sedes").insert(sede));
  }

  async actualizarSede(id: string, cambios: JsonObject): Promise<void> {
    vacio(await this.cliente.from("sedes").update(cambios).eq("id", id));
  }

  async eliminarSede(id: string): Promise<void> {
    vacio(await this.cliente.from("sedes").delete().eq("id", id));
  }

  async actualizarDni(dni: string): Promise<void> {
    vacio(await this.cliente.from("perfiles_privados").update({ dni }).eq("profile_id", await this.miId()));
  }

  // ---------- Mascotas ----------

  async misMascotas(): Promise<MascotaDto[]> {
    const yo = await this.miId();
    // Las que comparte como co-dueño (no alcanza con dueno_id: una cuenta de veterinario además ve sus pacientes)
    const compartidas = (ok(
      await this.cliente.from("coduenos_mascota").select("mascota_id").eq("usuario_id", yo).eq("estado", "activo"),
    ) as { mascota_id: string }[]).map((c) => c.mascota_id);
    const filtro = compartidas.length > 0 ? `dueno_id.eq.${yo},id.in.(${compartidas.join(",")})` : `dueno_id.eq.${yo}`;
    return ok(
      await this.cliente.from("mascotas").select("*").or(filtro).eq("activa", true).order("nombre", { ascending: true }),
    ) as MascotaDto[];
  }

  async invitarCodueno(mascotaId: string, dniOCorreo: string): Promise<string> {
    return ok(await this.cliente.rpc("invitar_codueno", { p_mascota: mascotaId, p_dato: dniOCorreo })) as string;
  }

  async misInvitacionesCodueno(): Promise<InvitacionCoduenoDto[]> {
    return ok(await this.cliente.rpc("mis_invitaciones_codueno")) as InvitacionCoduenoDto[];
  }

  async responderInvitacionCodueno(invitacionId: string, aceptar: boolean): Promise<void> {
    vacio(await this.cliente.rpc("responder_invitacion_codueno", { p_invitacion: invitacionId, p_aceptar: aceptar }));
  }

  async duenosDeMascota(mascotaId: string): Promise<DuenoMascotaDto[]> {
    return ok(await this.cliente.rpc("duenos_de_mascota", { p_mascota: mascotaId })) as DuenoMascotaDto[];
  }

  async quitarCodueno(coduenoId: string): Promise<void> {
    vacio(await this.cliente.rpc("quitar_codueno", { p_codueno: coduenoId }));
  }

  async misClinicas(): Promise<ClinicaDto[]> {
    return ok(await this.cliente.rpc("mis_clinicas")) as ClinicaDto[];
  }

  async equipoClinica(clinicaId: string): Promise<MiembroClinicaDto[]> {
    return ok(await this.cliente.rpc("equipo_clinica", { p_clinica: clinicaId })) as MiembroClinicaDto[];
  }

  async agendasQueManejo(): Promise<AgendaManejadaDto[]> {
    return ok(await this.cliente.rpc("agendas_que_manejo")) as AgendaManejadaDto[];
  }

  async crearClinica(d: NuevaClinicaDto): Promise<string> {
    return ok(await this.cliente.rpc("crear_clinica", {
      p_nombre: d.nombre, p_direccion: d.direccion, p_telefono: d.telefono, p_cuit: d.cuit,
      p_director_nombre: d.director.nombre, p_director_dni: d.director.dni, p_director_matricula: d.director.matricula,
    })) as string;
  }

  async cargarHabilitacionClinica(clinicaId: string, tipo: TipoHabilitacion, ruta: string): Promise<void> {
    vacio(await this.cliente.rpc("cargar_habilitacion_clinica", { p_clinica: clinicaId, p_tipo: tipo, p_path: ruta }));
  }

  async invitarAClinica(clinicaId: string, dniOCorreo: string, roles: RolClinica[]): Promise<string> {
    return ok(await this.cliente.rpc("invitar_a_clinica", { p_clinica: clinicaId, p_dato: dniOCorreo, p_roles: roles })) as string;
  }

  async responderInvitacionClinica(miembroId: string, aceptar: boolean): Promise<void> {
    vacio(await this.cliente.rpc("responder_invitacion_clinica", { p_miembro: miembroId, p_aceptar: aceptar }));
  }

  async quitarDeClinica(miembroId: string): Promise<void> {
    vacio(await this.cliente.rpc("quitar_de_clinica", { p_miembro: miembroId }));
  }

  async cambiarRolesClinica(miembroId: string, roles: RolClinica[]): Promise<void> {
    vacio(await this.cliente.rpc("cambiar_roles_clinica", { p_miembro: miembroId, p_roles: roles }));
  }

  async clinicasParaRevisar(): Promise<ClinicaParaRevisarDto[]> {
    return ok(await this.cliente.rpc("clinicas_para_revisar")) as ClinicaParaRevisarDto[];
  }

  async revisarClinica(clinicaId: string, aprobar: boolean, motivo: string | null): Promise<void> {
    vacio(await this.cliente.rpc("revisar_clinica", { p_clinica: clinicaId, p_aprobar: aprobar, p_motivo: motivo }));
  }

  async cambiarLogoClinica(clinicaId: string, logoPath: string | null): Promise<void> {
    vacio(await this.cliente.rpc("cambiar_logo_clinica", { p_clinica: clinicaId, p_path: logoPath }));
  }

  async mascotasDelVeterinario(): Promise<MascotaDto[]> {
    return ok(
      await this.cliente.from("mascotas").select(MASCOTA_CON_DUENO).eq("activa", true).order("nombre", { ascending: true }),
    ) as unknown as MascotaDto[];
  }

  async mascotasAdmin(): Promise<MascotaDto[]> {
    return ok(
      await this.cliente.from("mascotas").select("id,dueno_id,nombre,tipo,raza,activa").eq("activa", true),
    ) as unknown as MascotaDto[];
  }

  async crearMascota(mascota: NuevaMascotaDto): Promise<void> {
    vacio(await this.cliente.from("mascotas").insert(mascota));
  }

  async actualizarMascota(id: string, cambios: JsonObject): Promise<void> {
    vacio(await this.cliente.from("mascotas").update(cambios).eq("id", id));
  }

  // ---------- Turnos ----------

  async turnos(): Promise<TurnoDto[]> {
    return ok(
      await this.cliente.from("turnos").select("*").order("fecha", { ascending: true }).order("hora", { ascending: true }),
    ) as TurnoDto[];
  }

  async crearTurno(turno: NuevoTurnoDto): Promise<void> {
    vacio(await this.cliente.from("turnos").insert(turno));
  }

  async actualizarTurno(id: string, cambios: JsonObject): Promise<void> {
    vacio(await this.cliente.from("turnos").update(cambios).eq("id", id));
  }

  // ---------- Veterinarios y accesos ----------

  async catalogoVeterinarios(): Promise<PerfilDto[]> {
    // Todas las cuentas con rol de veterinario visibles para el usuario (también los dueños que se dieron de alta)
    const filas = ok(await this.cliente.from("profiles").select(CATALOGO).order("nombre", { ascending: true }));
    return (filas as unknown as PerfilDto[]).map(normalizarPerfil);
  }

  async accesos(): Promise<AccesoDto[]> {
    return ok(await this.cliente.from("accesos_mascota").select("*")) as AccesoDto[];
  }

  async compartirMascotas(mascotaIds: string[], veterinarioId: string, venceEl: string | null = null): Promise<void> {
    if (mascotaIds.length === 0) return;
    const existentes = ok(
      await this.cliente.from("accesos_mascota").select("*").eq("veterinario_id", veterinarioId).in("mascota_id", mascotaIds),
    ) as AccesoDto[];
    const yaTienen = new Set(existentes.map((a) => a.mascota_id));
    const nuevos = mascotaIds
      .filter((id) => !yaTienen.has(id))
      .map((id) => ({
        mascota_id: id, veterinario_id: veterinarioId, estado: "activo", iniciado_por: "dueno", vence_el: venceEl,
      }));
    if (nuevos.length > 0) vacio(await this.cliente.from("accesos_mascota").insert(nuevos));
    // Los que ya existían quedan activos y con el vencimiento elegido
    const actuales = existentes.map((a) => a.id);
    if (actuales.length > 0) {
      vacio(await this.cliente.from("accesos_mascota").update({ estado: "activo", vence_el: venceEl }).in("id", actuales));
    }
  }

  async fijarVencimientoDeAccesos(veterinarioId: string, venceEl: string | null): Promise<void> {
    vacio(
      await this.cliente.from("accesos_mascota").update({ vence_el: venceEl }).eq("veterinario_id", veterinarioId).eq("estado", "activo"),
    );
  }

  async historialDeAccesos(): Promise<AccesoHistorialDto[]> {
    return ok(
      await this.cliente.from("accesos_historial").select("*").order("created_at", { ascending: false }).limit(200),
    ) as AccesoHistorialDto[];
  }

  async actualizarAcceso(id: string, estado: string): Promise<void> {
    vacio(await this.cliente.from("accesos_mascota").update({ estado }).eq("id", id));
  }

  async actualizarAccesosDeVeterinario(veterinarioId: string, estado: string): Promise<void> {
    vacio(await this.cliente.from("accesos_mascota").update({ estado }).eq("veterinario_id", veterinarioId));
  }

  async solicitarAcceso(mascotaId: string, turno: JsonObject | null = null): Promise<string> {
    const parametros: JsonObject = { p_mascota: mascotaId };
    if (turno) parametros.p_turno = turno;
    return ok(await this.cliente.rpc("solicitar_acceso", parametros)) as string;
  }

  async misSolicitudes(): Promise<SolicitudAccesoDto[]> {
    return ok(await this.cliente.rpc("mis_solicitudes")) as SolicitudAccesoDto[];
  }

  async buscarDueno(dato: string): Promise<DuenoBuscadoDto[]> {
    return ok(await this.cliente.rpc("buscar_dueno", { p_dato: dato })) as DuenoBuscadoDto[];
  }

  async horariosOcupados(veterinarioId: string, fecha: string): Promise<HoraOcupadaDto[]> {
    const filas = ok(await this.cliente.rpc("horarios_ocupados", { p_veterinario: veterinarioId, p_fecha: fecha })) as HoraOcupadaDto[];
    return filas.map((h) => ({ ...h, hora: h.hora.slice(0, 5) }));
  }

  // ---------- Estudios previos de un turno ----------

  async estudiosDeTurno(turnoId: string): Promise<EstudioTurnoDto[]> {
    return ok(
      await this.cliente.from("turnos_estudios").select("*").eq("turno_id", turnoId).order("created_at", { ascending: true }),
    ) as EstudioTurnoDto[];
  }

  async adjuntarEstudios(estudios: NuevoEstudioTurnoDto[]): Promise<void> {
    if (estudios.length > 0) vacio(await this.cliente.from("turnos_estudios").insert(estudios));
  }

  // ---------- Historia clínica ----------

  async registrosSalud(): Promise<RegistroSaludDto[]> {
    return ok(await this.cliente.from("registros_salud").select("*").order("fecha", { ascending: false })) as RegistroSaludDto[];
  }

  async crearRegistroSalud(registro: NuevoRegistroSaludDto): Promise<void> {
    vacio(await this.cliente.from("registros_salud").insert(registro));
  }

  async eliminarRegistroSalud(id: string): Promise<void> {
    vacio(await this.cliente.from("registros_salud").delete().eq("id", id));
  }

  async recordatorios(): Promise<RecordatorioDto[]> {
    return ok(await this.cliente.from("recordatorios").select("*").order("fecha", { ascending: true })) as RecordatorioDto[];
  }

  async crearRecordatorio(recordatorio: NuevoRecordatorioDto): Promise<void> {
    vacio(await this.cliente.from("recordatorios").insert(recordatorio));
  }

  async actualizarRecordatorio(id: string, cambios: JsonObject): Promise<void> {
    vacio(await this.cliente.from("recordatorios").update(cambios).eq("id", id));
  }

  async borrarRecordatorio(id: string): Promise<void> {
    vacio(await this.cliente.from("recordatorios").delete().eq("id", id));
  }

  async informesDe(mascotaId: string): Promise<InformeDto[]> {
    return ok(
      await this.cliente.from("informes_clinicos").select("*").eq("mascota_id", mascotaId).order("created_at", { ascending: false }),
    ) as InformeDto[];
  }

  async crearInforme(informe: NuevoInformeDto): Promise<void> {
    vacio(await this.cliente.from("informes_clinicos").insert(informe));
  }

  async actualizarInforme(id: string, cambios: JsonObject): Promise<void> {
    vacio(await this.cliente.from("informes_clinicos").update(cambios).eq("id", id));
  }

  async prescripciones(mascotaId: string | null = null): Promise<PrescripcionDto[]> {
    let consulta = this.cliente.from("prescripciones").select("*");
    if (mascotaId) consulta = consulta.eq("mascota_id", mascotaId);
    return ok(await consulta.order("created_at", { ascending: false })) as PrescripcionDto[];
  }

  async crearPrescripcion(prescripcion: NuevaPrescripcionDto): Promise<void> {
    vacio(await this.cliente.from("prescripciones").insert(prescripcion));
  }

  async eliminarPrescripcion(id: string): Promise<void> {
    vacio(await this.cliente.from("prescripciones").delete().eq("id", id));
  }

  async tomas(mascotaId?: string | null): Promise<TomaDto[]> {
    const consulta = this.cliente.from("tomas_medicacion").select("*").order("programada", { ascending: true });
    return ok(await (mascotaId ? consulta.eq("mascota_id", mascotaId) : consulta)) as TomaDto[];
  }

  async registrarToma(prescripcionId: string, programada: string): Promise<void> {
    // mascota_id lo completa la base a partir de la receta; si ya estaba tildada no pasa nada
    vacio(
      await this.cliente.from("tomas_medicacion").upsert(
        { prescripcion_id: prescripcionId, programada },
        { onConflict: "prescripcion_id,programada", ignoreDuplicates: true },
      ),
    );
  }

  async quitarToma(prescripcionId: string, programada: string): Promise<void> {
    vacio(await this.cliente.from("tomas_medicacion").delete().eq("prescripcion_id", prescripcionId).eq("programada", programada));
  }

  async guardarAlertas(mascotaId: string, alertas: string): Promise<void> {
    vacio(await this.cliente.rpc("guardar_alertas", { p_mascota: mascotaId, p_alertas: alertas }));
  }

  async archivosDe(mascotaId: string): Promise<ArchivoDto[]> {
    return ok(
      await this.cliente.from("archivos_mascota").select("*").eq("mascota_id", mascotaId).order("created_at", { ascending: false }),
    ) as ArchivoDto[];
  }

  async crearArchivo(archivo: NuevoArchivoDto): Promise<void> {
    vacio(await this.cliente.from("archivos_mascota").insert(archivo));
  }

  async renombrarArchivo(id: string, nombre: string): Promise<void> {
    vacio(await this.cliente.from("archivos_mascota").update({ nombre }).eq("id", id));
  }

  async eliminarArchivo(id: string): Promise<void> {
    vacio(await this.cliente.from("archivos_mascota").delete().eq("id", id));
  }

  // ---------- Storage ----------

  async subir(bucket: string, ruta: string, bytes: Uint8Array, tipoMime: string): Promise<void> {
    const { error } = await this.cliente.storage.from(bucket).upload(ruta, bytes, { upsert: true, contentType: tipoMime });
    if (error) throw error;
  }

  async descargar(bucket: string, ruta: string): Promise<Uint8Array> {
    // En el teléfono se baja con un enlace firmado de un minuto: es más liviano que leer un Blob
    const firmado = await this.cliente.storage.from(bucket).createSignedUrl(ruta, 60);
    if (firmado.error || !firmado.data) throw firmado.error ?? new ErrorConMensaje("No se pudo bajar el archivo");
    const respuesta = await fetch(firmado.data.signedUrl);
    if (!respuesta.ok) throw new ErrorConMensaje("No se pudo bajar el archivo");
    return aBytes(await respuesta.arrayBuffer());
  }

  async borrar(bucket: string, rutas: string[]): Promise<void> {
    if (rutas.length === 0) return;
    const { error } = await this.cliente.storage.from(bucket).remove(rutas);
    if (error) throw error;
  }

  // ---------- Notificaciones ----------

  async notificaciones(): Promise<NotificacionDto[]> {
    return ok(await this.cliente.from("notificaciones").select("*").order("created_at", { ascending: false })) as NotificacionDto[];
  }

  async marcarNotificacionesLeidas(): Promise<void> {
    vacio(await this.cliente.from("notificaciones").update({ leida: true }).eq("usuario_id", await this.miId()));
  }

  async borrarNotificaciones(): Promise<void> {
    vacio(await this.cliente.from("notificaciones").delete().eq("usuario_id", await this.miId()));
  }

  async borrarNotificacion(id: string): Promise<void> {
    vacio(await this.cliente.from("notificaciones").delete().eq("id", id).eq("usuario_id", await this.miId()));
  }

  // ---------- Administrador ----------

  async perfilesAdmin(): Promise<PerfilDto[]> {
    const filas = ok(
      await this.cliente.from("profiles").select(PERFIL_ADMIN).neq("rol", "admin").order("created_at", { ascending: false }),
    );
    return (filas as unknown as PerfilDto[]).map(normalizarPerfil);
  }

  async actividadAdmin(): Promise<ActividadDto[]> {
    return ok(
      await this.cliente.from("actividad_admin").select("*").order("created_at", { ascending: false }).limit(100),
    ) as ActividadDto[];
  }

  async resumenAdmin(): Promise<JsonObject> {
    return ok(await this.cliente.rpc("admin_resumen")) as JsonObject;
  }

  async revisarVeterinario(id: string, estado: string, motivo: string | null): Promise<void> {
    const parametros: JsonObject = { p_id: id, p_estado: estado };
    if (motivo != null) parametros.p_motivo = motivo;
    vacio(await this.cliente.rpc("revisar_veterinario", parametros));
  }

  async avisarRevisionPorCorreo(veterinarioId: string): Promise<void> {
    // La revisión ya quedó guardada (y el veterinario ve el aviso en la app): si el correo no sale, no se muestra error
    try {
      await this.cliente.functions.invoke("avisar-veterinario", { body: { veterinario_id: veterinarioId } });
    } catch {
      // se ignora a propósito
    }
  }

  async cambiarEstadoCuenta(id: string, estado: string, motivo: string | null): Promise<void> {
    vacio(await this.cliente.from("profiles").update({ estado, motivo_estado: motivo }).eq("id", id));
  }

  // ---------- Baja de cuenta ----------

  async rutasArchivosCuenta(): Promise<RutaDto[]> {
    return ok(await this.cliente.rpc("rutas_archivos_cuenta")) as RutaDto[];
  }

  async eliminarCuenta(): Promise<void> {
    vacio(await this.cliente.rpc("eliminar_mi_cuenta"));
    await this.cliente.auth.signOut({ scope: "local" }).catch(() => {});
  }
}
