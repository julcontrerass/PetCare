package frgp.utn.edu.petcare.data.remoto

import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.JsonObject

/** Qué pasó al crear una cuenta: si Supabase pide confirmar el correo no hay sesión hasta que lo confirme. */
data class ResultadoRegistro(
    val sesionIniciada: Boolean,
    val usuarioId: String?,
    /** Supabase no avisa con un error cuando el correo ya existe: devuelve un usuario sin identidades. */
    val correoYaRegistrado: Boolean = false
)

/**
 * Todo lo que la app le pide al servidor. La implementación real es [SupabaseFuente]; en las pruebas se
 * reemplaza por una fuente en memoria. Los métodos de escritura devuelven Unit y fallan con excepción.
 * Los valores por defecto sirven para que las fuentes de prueba solo implementen lo que necesitan.
 */
interface FuenteDatos {

    /**
     * Emite un valor cada vez que algo cambia en el servidor y puede afectar a lo que ve el usuario (turnos,
     * accesos, avisos, fichas). Las fuentes de prueba no emiten nada.
     */
    fun cambios(): Flow<Unit> = emptyFlow()

    // ---------- Sesión ----------
    suspend fun restaurarSesion(): String? = null
    suspend fun ingresar(email: String, password: String): String = "usuario-de-prueba"
    suspend fun registrar(email: String, password: String, datos: JsonObject): ResultadoRegistro =
        ResultadoRegistro(sesionIniciada = true, usuarioId = "usuario-de-prueba")
    suspend fun recuperarPassword(email: String) {}
    /**
     * Abre el enlace del correo de recuperación (`petcare://recuperar?code=...`). Deja una sesión abierta para
     * poder elegir la contraseña nueva con [definirPassword]. Falla con un mensaje si el enlace venció.
     */
    suspend fun abrirEnlaceDeRecuperacion(enlace: String) {}
    suspend fun cambiarPassword(email: String, actual: String, nueva: String) {}
    suspend fun cerrarSesion() {}
    /** Elige una contraseña nueva para la sesión abierta (sirve para reemplazar la temporal del primer ingreso). */
    suspend fun definirPassword(nueva: String) {}
    /** El dueño con cuenta creada por un veterinario termina su primer ingreso: acepta los términos y apaga la marca. */
    suspend fun completarPrimerIngreso(terminosVersion: String) {}
    suspend fun matriculaDisponible(matricula: String): Boolean = true
    /** Un dueño con la cuenta activa pide el alta como veterinario; queda en revisión hasta que el administrador la apruebe. */
    suspend fun solicitarAltaVeterinario(datos: SolicitudAltaVeterinarioDto) {}
    /** Registra la foto del carnet o matrícula ya subida al bucket `credenciales`. */
    suspend fun guardarCredencial(ruta: String) {}

    // ---------- Perfil propio ----------
    suspend fun miPerfil(): PerfilDto = throw UnsupportedOperationException("miPerfil")
    suspend fun actualizarPerfil(cambios: JsonObject) {}
    suspend fun actualizarVeterinario(cambios: JsonObject) {}
    suspend fun actualizarDni(dni: String) {}

    // ---------- Mascotas ----------
    /** Mascotas activas del dueño en sesión. */
    suspend fun misMascotas(): List<MascotaDto> = emptyList()
    /** Mascotas que el veterinario puede ver, con los datos de su dueño. */
    suspend fun mascotasDelVeterinario(): List<MascotaDto> = emptyList()
    /** Todas las mascotas activas (solo el administrador). */
    suspend fun mascotasAdmin(): List<MascotaDto> = emptyList()
    suspend fun crearMascota(mascota: NuevaMascotaDto) {}
    suspend fun actualizarMascota(id: String, cambios: JsonObject) {}

    // ---------- Turnos ----------
    suspend fun turnos(): List<TurnoDto> = emptyList()
    suspend fun crearTurno(turno: NuevoTurnoDto) {}
    suspend fun actualizarTurno(id: String, cambios: JsonObject) {}

    // ---------- Veterinarios y accesos ----------
    suspend fun catalogoVeterinarios(): List<PerfilDto> = emptyList()
    suspend fun accesos(): List<AccesoDto> = emptyList()
    /** El dueño comparte las mascotas indicadas con un veterinario (si ya existe el acceso, lo reactiva). */
    suspend fun compartirMascotas(mascotaIds: List<String>, veterinarioId: String) {}
    suspend fun actualizarAcceso(id: String, estado: String) {}
    /** El dueño cambia el estado de todos los accesos de un veterinario a sus mascotas. */
    suspend fun actualizarAccesosDeVeterinario(veterinarioId: String, estado: String) {}
    /** El veterinario pide acceso a una mascota; con [turno] queda pedido el turno que se agenda al aceptar. */
    suspend fun solicitarAcceso(mascotaId: String, turno: JsonObject? = null): String = "pendiente"
    suspend fun buscarDueno(dato: String): List<DuenoBuscadoDto> = emptyList()
    /**
     * El veterinario le crea la cuenta a un dueño que todavía no usa la app y le deja la mascota a su nombre.
     * Devuelve la contraseña temporal, que se muestra una sola vez para pasársela al dueño.
     */
    suspend fun crearCuentaDueno(datos: NuevaCuentaDuenoDto): CuentaDuenoCreadaDto =
        throw UnsupportedOperationException("crearCuentaDueno")
    /** Las solicitudes de acceso del veterinario: las que pidió y las que un dueño le compartió sin responder. */
    suspend fun misSolicitudes(): List<SolicitudAccesoDto> = emptyList()
    /** Turnos pendientes del veterinario ese día: hora de inicio y duración en minutos. */
    suspend fun horariosOcupados(veterinarioId: String, fecha: String): List<HoraOcupadaDto> = emptyList()

    // ---------- Estudios previos de un turno ----------
    suspend fun estudiosDeTurno(turnoId: String): List<EstudioTurnoDto> = emptyList()
    suspend fun adjuntarEstudios(estudios: List<NuevoEstudioTurnoDto>) {}

    // ---------- Historia clínica ----------
    suspend fun registrosSalud(): List<RegistroSaludDto> = emptyList()
    suspend fun crearRegistroSalud(registro: NuevoRegistroSaludDto) {}
    suspend fun eliminarRegistroSalud(id: String) {}
    suspend fun informesDe(mascotaId: String): List<InformeDto> = emptyList()
    suspend fun crearInforme(informe: NuevoInformeDto) {}
    suspend fun actualizarInforme(id: String, cambios: JsonObject) {}
    /** Recetas de las mascotas que el usuario puede ver; con [mascotaId] solo las de esa mascota. */
    suspend fun prescripciones(mascotaId: String? = null): List<PrescripcionDto> = emptyList()
    suspend fun crearPrescripcion(prescripcion: NuevaPrescripcionDto) {}
    suspend fun eliminarPrescripcion(id: String) {}
    /** Guarda las alertas clínicas de la mascota (las pueden cambiar el dueño y los veterinarios con acceso). */
    suspend fun guardarAlertas(mascotaId: String, alertas: String) {}
    suspend fun archivosDe(mascotaId: String): List<ArchivoDto> = emptyList()
    suspend fun crearArchivo(archivo: NuevoArchivoDto) {}
    suspend fun renombrarArchivo(id: String, nombre: String) {}
    suspend fun eliminarArchivo(id: String) {}

    // ---------- Archivos (Storage) ----------
    suspend fun subir(bucket: String, ruta: String, bytes: ByteArray, tipoMime: String) {}
    suspend fun descargar(bucket: String, ruta: String): ByteArray = ByteArray(0)
    suspend fun borrar(bucket: String, rutas: List<String>) {}

    // ---------- Notificaciones ----------
    suspend fun notificaciones(): List<NotificacionDto> = emptyList()
    suspend fun marcarNotificacionesLeidas() {}
    suspend fun borrarNotificaciones() {}

    // ---------- Administrador ----------
    suspend fun perfilesAdmin(): List<PerfilDto> = emptyList()
    suspend fun actividadAdmin(): List<ActividadDto> = emptyList()
    suspend fun resumenAdmin(): JsonObject = JsonObject(emptyMap())
    suspend fun cambiarEstadoCuenta(id: String, estado: String, motivo: String?) {}
    /** Aprueba, rechaza, suspende o reactiva el rol de veterinario de una cuenta (la cuenta de dueño no se toca). */
    suspend fun revisarVeterinario(id: String, estado: String, motivo: String?) {}

    // ---------- Baja de cuenta ----------
    suspend fun rutasArchivosCuenta(): List<RutaDto> = emptyList()
    suspend fun eliminarCuenta() {}
}
