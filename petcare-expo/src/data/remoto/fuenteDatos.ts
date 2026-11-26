import type {
  AccesoDto, AccesoHistorialDto, ActividadDto, ArchivoDto, CuentaDuenoCreadaDto, DuenoBuscadoDto, DuenoMascotaDto,
  EstudioTurnoDto, HoraOcupadaDto, InformeDto, InvitacionCoduenoDto, JsonObject, MascotaDto, NotificacionDto, NuevaCuentaDuenoDto, NuevaMascotaDto,
  NuevaPrescripcionDto, NuevaSedeDto, NuevoArchivoDto, NuevoEstudioTurnoDto, NuevoInformeDto, NuevoRecordatorioDto,
  NuevoRegistroSaludDto, NuevoTurnoDto, PerfilDto, PrescripcionDto, RecordatorioDto, RegistroSaludDto, RutaDto,
  SolicitudAccesoDto, SolicitudAltaVeterinarioDto, TomaDto, TurnoDto,
  AgendaManejadaDto, ClinicaDto, ClinicaParaRevisarDto, CuentaMiembroCreadaDto, MiembroClinicaDto, NuevaCuentaMiembroDto, RolClinica,
} from "./dtos";

/** Qué pasó al crear una cuenta: si Supabase pide confirmar el correo no hay sesión hasta que lo confirme. */
export interface ResultadoRegistro {
  sesionIniciada: boolean;
  usuarioId: string | null;
  /** Supabase no avisa con un error cuando el correo ya existe: devuelve un usuario sin identidades. */
  correoYaRegistrado: boolean;
}

/**
 * Todo lo que la app le pide al servidor. La implementación real es SupabaseFuente; en las pruebas se
 * reemplaza por una fuente en memoria. Los métodos de escritura no devuelven nada y fallan con una excepción.
 */
export interface FuenteDatos {
  /**
   * Avisa cada vez que algo cambia en el servidor y puede afectar a lo que ve el usuario (turnos, accesos,
   * avisos, fichas). Devuelve la función que corta la escucha. Las fuentes de prueba no emiten nada.
   */
  cambios(alCambiar: () => void): () => void;

  // ---------- Sesión ----------
  restaurarSesion(): Promise<string | null>;
  ingresar(email: string, password: string): Promise<string>;
  registrar(email: string, password: string, datos: JsonObject): Promise<ResultadoRegistro>;
  recuperarPassword(email: string): Promise<void>;
  /**
   * Abre el enlace del correo de recuperación (`petcare://recuperar?code=...`). Deja una sesión abierta para
   * poder elegir la contraseña nueva con [definirPassword]. Falla con un mensaje si el enlace venció.
   */
  abrirEnlaceDeRecuperacion(enlace: string): Promise<void>;
  cambiarPassword(email: string, actual: string, nueva: string): Promise<void>;
  cerrarSesion(): Promise<void>;
  /** Elige una contraseña nueva para la sesión abierta (sirve para reemplazar la temporal del primer ingreso). */
  definirPassword(nueva: string): Promise<void>;
  /** El dueño con cuenta creada por un veterinario termina su primer ingreso: acepta los términos y apaga la marca. */
  completarPrimerIngreso(terminosVersion: string): Promise<void>;
  matriculaDisponible(matricula: string): Promise<boolean>;
  /** Un dueño con la cuenta activa pide el alta como veterinario; queda en revisión hasta que el administrador la apruebe. */
  solicitarAltaVeterinario(datos: SolicitudAltaVeterinarioDto): Promise<void>;
  /** Registra la foto del carnet o matrícula ya subida al bucket `credenciales`. */
  guardarCredencial(ruta: string): Promise<void>;

  // ---------- Perfil propio ----------
  miPerfil(): Promise<PerfilDto>;
  actualizarPerfil(cambios: JsonObject): Promise<void>;
  actualizarVeterinario(cambios: JsonObject): Promise<void>;
  crearSede(sede: NuevaSedeDto): Promise<void>;
  actualizarSede(id: string, cambios: JsonObject): Promise<void>;
  eliminarSede(id: string): Promise<void>;
  actualizarDni(dni: string): Promise<void>;

  // ---------- Mascotas ----------
  /** Mascotas activas del dueño en sesión: las suyas y las que comparte como co-dueño. */
  misMascotas(): Promise<MascotaDto[]>;
  /** Invita a otra cuenta (por DNI o correo) a ser co-dueña de la mascota. Devuelve el nombre de la persona invitada. */
  invitarCodueno(mascotaId: string, dniOCorreo: string): Promise<string>;
  /** Invitaciones a ser co-dueño que recibió la cuenta y todavía no respondió. */
  misInvitacionesCodueno(): Promise<InvitacionCoduenoDto[]>;
  responderInvitacionCodueno(invitacionId: string, aceptar: boolean): Promise<void>;
  /** Dueños de la mascota (el original primero) e invitaciones pendientes. */
  duenosDeMascota(mascotaId: string): Promise<DuenoMascotaDto[]>;
  /** Quita a un co-dueño o una invitación; con la fila propia, la cuenta deja de ser dueña. */
  quitarCodueno(coduenoId: string): Promise<void>;

  // ---------- Veterinarias ----------
  /** Veterinarias de la cuenta, también las invitaciones que todavía no respondió. */
  misClinicas(): Promise<ClinicaDto[]>;
  /** Equipo de una veterinaria (solo para sus miembros). */
  equipoClinica(clinicaId: string): Promise<MiembroClinicaDto[]>;
  /** Veterinarios cuya agenda maneja la cuenta (titular, administración o recepción de una veterinaria). */
  agendasQueManejo(): Promise<AgendaManejadaDto[]>;
  /**
   * Registra una veterinaria y la cuenta queda como titular; devuelve su id. Si no la registra un veterinario aprobado,
   * queda pendiente hasta que el administrador la verifica.
   */
  crearClinica(nombre: string, direccion: string | null, telefono: string | null): Promise<string>;
  /** Invita a una cuenta (por DNI o correo) con esos roles; devuelve el nombre de la persona. */
  invitarAClinica(clinicaId: string, dniOCorreo: string, roles: RolClinica[]): Promise<string>;
  responderInvitacionClinica(miembroId: string, aceptar: boolean): Promise<void>;
  /** Saca a alguien del equipo (o la cuenta se va sola). */
  quitarDeClinica(miembroId: string): Promise<void>;
  cambiarRolesClinica(miembroId: string, roles: RolClinica[]): Promise<void>;
  /** Crea la cuenta de una persona del equipo (Edge Function); queda como miembro activo al instante. */
  crearCuentaMiembro(datos: NuevaCuentaMiembroDto): Promise<CuentaMiembroCreadaDto>;
  /** Veterinarias que esperan la revisión (solo el administrador). */
  clinicasParaRevisar(): Promise<ClinicaParaRevisarDto[]>;
  /** El administrador aprueba o rechaza (con motivo) una veterinaria. */
  revisarClinica(clinicaId: string, aprobar: boolean, motivo: string | null): Promise<void>;
  /** Titular o administración cambian (o quitan, con null) el logo; la ruta tiene que estar en su carpeta de `fotos`. */
  cambiarLogoClinica(clinicaId: string, logoPath: string | null): Promise<void>;
  /** Mascotas que el veterinario puede ver, con los datos de su dueño. */
  mascotasDelVeterinario(): Promise<MascotaDto[]>;
  /** Todas las mascotas activas (solo el administrador). */
  mascotasAdmin(): Promise<MascotaDto[]>;
  crearMascota(mascota: NuevaMascotaDto): Promise<void>;
  actualizarMascota(id: string, cambios: JsonObject): Promise<void>;

  // ---------- Turnos ----------
  turnos(): Promise<TurnoDto[]>;
  crearTurno(turno: NuevoTurnoDto): Promise<void>;
  actualizarTurno(id: string, cambios: JsonObject): Promise<void>;

  // ---------- Veterinarios y accesos ----------
  catalogoVeterinarios(): Promise<PerfilDto[]>;
  accesos(): Promise<AccesoDto[]>;
  /** El dueño comparte las mascotas indicadas con un veterinario (si ya existe el acceso, lo reactiva). */
  compartirMascotas(mascotaIds: string[], veterinarioId: string, venceEl?: string | null): Promise<void>;
  /** Cambia el vencimiento (null = sin vencimiento) de los permisos activos de ese veterinario. */
  fijarVencimientoDeAccesos(veterinarioId: string, venceEl: string | null): Promise<void>;
  historialDeAccesos(): Promise<AccesoHistorialDto[]>;
  actualizarAcceso(id: string, estado: string): Promise<void>;
  /** El dueño cambia el estado de todos los accesos de un veterinario a sus mascotas. */
  actualizarAccesosDeVeterinario(veterinarioId: string, estado: string): Promise<void>;
  /** El veterinario pide acceso a una mascota; con [turno] queda pedido el turno que se agenda al aceptar. */
  solicitarAcceso(mascotaId: string, turno?: JsonObject | null): Promise<string>;
  buscarDueno(dato: string): Promise<DuenoBuscadoDto[]>;
  /**
   * El veterinario le crea la cuenta a un dueño que todavía no usa la app y le deja la mascota a su nombre.
   * Devuelve la contraseña temporal, que se muestra una sola vez para pasársela al dueño.
   */
  crearCuentaDueno(datos: NuevaCuentaDuenoDto): Promise<CuentaDuenoCreadaDto>;
  /** Las solicitudes de acceso del veterinario: las que pidió y las que un dueño le compartió sin responder. */
  misSolicitudes(): Promise<SolicitudAccesoDto[]>;
  /** Turnos pendientes del veterinario ese día: hora de inicio y duración en minutos. */
  horariosOcupados(veterinarioId: string, fecha: string): Promise<HoraOcupadaDto[]>;

  // ---------- Estudios previos de un turno ----------
  estudiosDeTurno(turnoId: string): Promise<EstudioTurnoDto[]>;
  adjuntarEstudios(estudios: NuevoEstudioTurnoDto[]): Promise<void>;

  // ---------- Historia clínica ----------
  registrosSalud(): Promise<RegistroSaludDto[]>;
  crearRegistroSalud(registro: NuevoRegistroSaludDto): Promise<void>;
  eliminarRegistroSalud(id: string): Promise<void>;

  // Recordatorios hechos a mano
  recordatorios(): Promise<RecordatorioDto[]>;
  crearRecordatorio(recordatorio: NuevoRecordatorioDto): Promise<void>;
  actualizarRecordatorio(id: string, cambios: JsonObject): Promise<void>;
  borrarRecordatorio(id: string): Promise<void>;

  informesDe(mascotaId: string): Promise<InformeDto[]>;
  crearInforme(informe: NuevoInformeDto): Promise<void>;
  actualizarInforme(id: string, cambios: JsonObject): Promise<void>;
  /** Recetas de las mascotas que el usuario puede ver; con [mascotaId] solo las de esa mascota. */
  prescripciones(mascotaId?: string | null): Promise<PrescripcionDto[]>;
  crearPrescripcion(prescripcion: NuevaPrescripcionDto): Promise<void>;
  eliminarPrescripcion(id: string): Promise<void>;
  /** Tomas de medicación ya dadas de las mascotas que el usuario puede ver; con [mascotaId], solo de esa mascota. */
  tomas(mascotaId?: string | null): Promise<TomaDto[]>;
  /** Tilda una toma: [programada] es la hora a la que tocaba ("2026-11-24T08:00:00"). */
  registrarToma(prescripcionId: string, programada: string): Promise<void>;
  quitarToma(prescripcionId: string, programada: string): Promise<void>;
  /** Guarda las alertas clínicas de la mascota (las pueden cambiar el dueño y los veterinarios con acceso). */
  guardarAlertas(mascotaId: string, alertas: string): Promise<void>;
  archivosDe(mascotaId: string): Promise<ArchivoDto[]>;
  crearArchivo(archivo: NuevoArchivoDto): Promise<void>;
  renombrarArchivo(id: string, nombre: string): Promise<void>;
  eliminarArchivo(id: string): Promise<void>;

  // ---------- Archivos (Storage) ----------
  subir(bucket: string, ruta: string, bytes: Uint8Array, tipoMime: string): Promise<void>;
  descargar(bucket: string, ruta: string): Promise<Uint8Array>;
  borrar(bucket: string, rutas: string[]): Promise<void>;

  // ---------- Notificaciones ----------
  notificaciones(): Promise<NotificacionDto[]>;
  marcarNotificacionesLeidas(): Promise<void>;
  borrarNotificaciones(): Promise<void>;
  borrarNotificacion(id: string): Promise<void>;

  // ---------- Administrador ----------
  perfilesAdmin(): Promise<PerfilDto[]>;
  actividadAdmin(): Promise<ActividadDto[]>;
  resumenAdmin(): Promise<JsonObject>;
  cambiarEstadoCuenta(id: string, estado: string, motivo: string | null): Promise<void>;
  /** Aprueba, rechaza, suspende o reactiva el rol de veterinario de una cuenta (la cuenta de dueño no se toca). */
  revisarVeterinario(id: string, estado: string, motivo: string | null): Promise<void>;
  /** Le manda un correo al veterinario con cómo quedó su solicitud de alta (aprobada o rechazada). */
  avisarRevisionPorCorreo(veterinarioId: string): Promise<void>;

  // ---------- Baja de cuenta ----------
  rutasArchivosCuenta(): Promise<RutaDto[]>;
  eliminarCuenta(): Promise<void>;
}

/**
 * Base con valores por defecto para que las fuentes de prueba solo implementen lo que necesitan: las lecturas
 * devuelven listas vacías y las escrituras no hacen nada.
 */
export class FuenteBase implements FuenteDatos {
  cambios(_alCambiar: () => void): () => void {
    return () => {};
  }

  async restaurarSesion(): Promise<string | null> { return null; }
  async ingresar(_email: string, _password: string): Promise<string> { return "usuario-de-prueba"; }
  async registrar(_email: string, _password: string, _datos: JsonObject): Promise<ResultadoRegistro> {
    return { sesionIniciada: true, usuarioId: "usuario-de-prueba", correoYaRegistrado: false };
  }
  async recuperarPassword(_email: string): Promise<void> {}
  async abrirEnlaceDeRecuperacion(_enlace: string): Promise<void> {}
  async cambiarPassword(_email: string, _actual: string, _nueva: string): Promise<void> {}
  async cerrarSesion(): Promise<void> {}
  async definirPassword(_nueva: string): Promise<void> {}
  async completarPrimerIngreso(_terminosVersion: string): Promise<void> {}
  async matriculaDisponible(_matricula: string): Promise<boolean> { return true; }
  async solicitarAltaVeterinario(_datos: SolicitudAltaVeterinarioDto): Promise<void> {}
  async guardarCredencial(_ruta: string): Promise<void> {}

  async miPerfil(): Promise<PerfilDto> { throw new Error("Operación no disponible: miPerfil"); }
  async actualizarPerfil(_cambios: JsonObject): Promise<void> {}
  async actualizarVeterinario(_cambios: JsonObject): Promise<void> {}
  async crearSede(_sede: NuevaSedeDto): Promise<void> {}
  async actualizarSede(_id: string, _cambios: JsonObject): Promise<void> {}
  async eliminarSede(_id: string): Promise<void> {}
  async actualizarDni(_dni: string): Promise<void> {}

  async misMascotas(): Promise<MascotaDto[]> { return []; }
  async invitarCodueno(_mascotaId: string, _dniOCorreo: string): Promise<string> {
    throw new Error("Operación no disponible: invitarCodueno");
  }
  async misInvitacionesCodueno(): Promise<InvitacionCoduenoDto[]> { return []; }
  async responderInvitacionCodueno(_invitacionId: string, _aceptar: boolean): Promise<void> {}
  async duenosDeMascota(_mascotaId: string): Promise<DuenoMascotaDto[]> { return []; }
  async quitarCodueno(_coduenoId: string): Promise<void> {}
  async misClinicas(): Promise<ClinicaDto[]> { return []; }
  async equipoClinica(_clinicaId: string): Promise<MiembroClinicaDto[]> { return []; }
  async agendasQueManejo(): Promise<AgendaManejadaDto[]> { return []; }
  async crearClinica(_nombre: string, _direccion: string | null, _telefono: string | null): Promise<string> {
    throw new Error("Operación no disponible: crearClinica");
  }
  async invitarAClinica(_clinicaId: string, _dniOCorreo: string, _roles: RolClinica[]): Promise<string> {
    throw new Error("Operación no disponible: invitarAClinica");
  }
  async responderInvitacionClinica(_miembroId: string, _aceptar: boolean): Promise<void> {}
  async quitarDeClinica(_miembroId: string): Promise<void> {}
  async cambiarRolesClinica(_miembroId: string, _roles: RolClinica[]): Promise<void> {}
  async crearCuentaMiembro(_datos: NuevaCuentaMiembroDto): Promise<CuentaMiembroCreadaDto> {
    throw new Error("Operación no disponible: crearCuentaMiembro");
  }
  async clinicasParaRevisar(): Promise<ClinicaParaRevisarDto[]> { return []; }
  async revisarClinica(_clinicaId: string, _aprobar: boolean, _motivo: string | null): Promise<void> {}
  async cambiarLogoClinica(_clinicaId: string, _logoPath: string | null): Promise<void> {}
  async mascotasDelVeterinario(): Promise<MascotaDto[]> { return []; }
  async mascotasAdmin(): Promise<MascotaDto[]> { return []; }
  async crearMascota(_mascota: NuevaMascotaDto): Promise<void> {}
  async actualizarMascota(_id: string, _cambios: JsonObject): Promise<void> {}

  async turnos(): Promise<TurnoDto[]> { return []; }
  async crearTurno(_turno: NuevoTurnoDto): Promise<void> {}
  async actualizarTurno(_id: string, _cambios: JsonObject): Promise<void> {}

  async catalogoVeterinarios(): Promise<PerfilDto[]> { return []; }
  async accesos(): Promise<AccesoDto[]> { return []; }
  async compartirMascotas(_mascotaIds: string[], _veterinarioId: string, _venceEl?: string | null): Promise<void> {}
  async fijarVencimientoDeAccesos(_veterinarioId: string, _venceEl: string | null): Promise<void> {}
  async historialDeAccesos(): Promise<AccesoHistorialDto[]> { return []; }
  async actualizarAcceso(_id: string, _estado: string): Promise<void> {}
  async actualizarAccesosDeVeterinario(_veterinarioId: string, _estado: string): Promise<void> {}
  async solicitarAcceso(_mascotaId: string, _turno?: JsonObject | null): Promise<string> { return "pendiente"; }
  async buscarDueno(_dato: string): Promise<DuenoBuscadoDto[]> { return []; }
  async crearCuentaDueno(_datos: NuevaCuentaDuenoDto): Promise<CuentaDuenoCreadaDto> {
    throw new Error("Operación no disponible: crearCuentaDueno");
  }
  async misSolicitudes(): Promise<SolicitudAccesoDto[]> { return []; }
  async horariosOcupados(_veterinarioId: string, _fecha: string): Promise<HoraOcupadaDto[]> { return []; }

  async estudiosDeTurno(_turnoId: string): Promise<EstudioTurnoDto[]> { return []; }
  async adjuntarEstudios(_estudios: NuevoEstudioTurnoDto[]): Promise<void> {}

  async registrosSalud(): Promise<RegistroSaludDto[]> { return []; }
  async crearRegistroSalud(_registro: NuevoRegistroSaludDto): Promise<void> {}
  async eliminarRegistroSalud(_id: string): Promise<void> {}

  async recordatorios(): Promise<RecordatorioDto[]> { return []; }
  async crearRecordatorio(_recordatorio: NuevoRecordatorioDto): Promise<void> {}
  async actualizarRecordatorio(_id: string, _cambios: JsonObject): Promise<void> {}
  async borrarRecordatorio(_id: string): Promise<void> {}

  async informesDe(_mascotaId: string): Promise<InformeDto[]> { return []; }
  async crearInforme(_informe: NuevoInformeDto): Promise<void> {}
  async actualizarInforme(_id: string, _cambios: JsonObject): Promise<void> {}
  async prescripciones(_mascotaId?: string | null): Promise<PrescripcionDto[]> { return []; }
  async crearPrescripcion(_prescripcion: NuevaPrescripcionDto): Promise<void> {}
  async eliminarPrescripcion(_id: string): Promise<void> {}
  async tomas(_mascotaId?: string | null): Promise<TomaDto[]> { return []; }
  async registrarToma(_prescripcionId: string, _programada: string): Promise<void> {}
  async quitarToma(_prescripcionId: string, _programada: string): Promise<void> {}
  async guardarAlertas(_mascotaId: string, _alertas: string): Promise<void> {}
  async archivosDe(_mascotaId: string): Promise<ArchivoDto[]> { return []; }
  async crearArchivo(_archivo: NuevoArchivoDto): Promise<void> {}
  async renombrarArchivo(_id: string, _nombre: string): Promise<void> {}
  async eliminarArchivo(_id: string): Promise<void> {}

  async subir(_bucket: string, _ruta: string, _bytes: Uint8Array, _tipoMime: string): Promise<void> {}
  async descargar(_bucket: string, _ruta: string): Promise<Uint8Array> { return new Uint8Array(0); }
  async borrar(_bucket: string, _rutas: string[]): Promise<void> {}

  async notificaciones(): Promise<NotificacionDto[]> { return []; }
  async marcarNotificacionesLeidas(): Promise<void> {}
  async borrarNotificaciones(): Promise<void> {}
  async borrarNotificacion(_id: string): Promise<void> {}

  async perfilesAdmin(): Promise<PerfilDto[]> { return []; }
  async actividadAdmin(): Promise<ActividadDto[]> { return []; }
  async resumenAdmin(): Promise<JsonObject> { return {}; }
  async cambiarEstadoCuenta(_id: string, _estado: string, _motivo: string | null): Promise<void> {}
  async revisarVeterinario(_id: string, _estado: string, _motivo: string | null): Promise<void> {}
  async avisarRevisionPorCorreo(_veterinarioId: string): Promise<void> {}

  async rutasArchivosCuenta(): Promise<RutaDto[]> { return []; }
  async eliminarCuenta(): Promise<void> {}
}
