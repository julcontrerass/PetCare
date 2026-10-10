package frgp.utn.edu.petcare.data.remoto

import kotlinx.serialization.json.JsonObject
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.Flow

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
    suspend fun cambiarPassword(email: String, actual: String, nueva: String) {}
    suspend fun cerrarSesion() {}
    suspend fun matriculaDisponible(matricula: String): Boolean = true

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
    suspend fun solicitarAcceso(mascotaId: String): String = "pendiente"
    suspend fun buscarDueno(dato: String): List<DuenoBuscadoDto> = emptyList()
    /** Horas ("HH:mm") en las que el veterinario ya tiene un turno pendiente ese día. */
    suspend fun horariosOcupados(veterinarioId: String, fecha: String): List<String> = emptyList()

    // ---------- Historia clínica ----------
    suspend fun registrosSalud(): List<RegistroSaludDto> = emptyList()
    suspend fun crearRegistroSalud(registro: NuevoRegistroSaludDto) {}
    suspend fun eliminarRegistroSalud(id: String) {}
    suspend fun informesDe(mascotaId: String): List<InformeDto> = emptyList()
    suspend fun crearInforme(informe: NuevoInformeDto) {}
    suspend fun actualizarInforme(id: String, cambios: JsonObject) {}
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

    // ---------- Baja de cuenta ----------
    suspend fun rutasArchivosCuenta(): List<RutaDto> = emptyList()
    suspend fun eliminarCuenta() {}
}
