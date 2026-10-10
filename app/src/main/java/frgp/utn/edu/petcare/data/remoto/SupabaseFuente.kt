package frgp.utn.edu.petcare.data.remoto

import android.content.Context
import java.util.UUID
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CoroutineScope
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.PostgresAction
import frgp.utn.edu.petcare.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.serializer.KotlinXSerializer
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.storage.storage
import io.ktor.http.ContentType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Implementación de [FuenteDatos] contra el proyecto de Supabase. */
class SupabaseFuente(contexto: Context) : FuenteDatos {

    private val cliente: SupabaseClient = createSupabaseClient(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_KEY) {
        defaultSerializer = KotlinXSerializer(Json {
            ignoreUnknownKeys = true
            encodeDefaults = false
            explicitNulls = false
        })
        install(Auth) {
            sessionManager = SesionGuardada(contexto)
            codeVerifierCache = CodigoVerificadorGuardado(contexto)
        }
        install(Postgrest)
        install(Storage)
        install(Realtime)
    }

    private companion object {
        const val PERFIL_COMPLETO = "*,veterinarios(*),perfiles_privados(dni)"
        const val CATALOGO = "id,rol,estado,nombre,email,telefono,direccion,foto_path,veterinarios(*)"
        const val MASCOTA_CON_DUENO = "*,dueno:profiles!mascotas_dueno_id_fkey(nombre,email,telefono,direccion)"
    }

    // ---------- Cambios en vivo ----------

    private val tablasEscuchadas = listOf(
        "turnos", "accesos_mascota", "notificaciones", "mascotas", "informes_clinicos", "archivos_mascota", "registros_salud"
    )

    /** Escucha los cambios de las tablas; el servidor solo manda los que el usuario puede ver (RLS). */
    override fun cambios(): Flow<Unit> = callbackFlow {
        val canal = cliente.channel("cambios-" + UUID.randomUUID())
        val flujos = tablasEscuchadas.map { nombre ->
            canal.postgresChangeFlow<PostgresAction>(schema = "public") { table = nombre }
        }
        flujos.forEach { flujo -> launch { flujo.collect { trySend(Unit) } } }
        canal.subscribe(blockUntilSubscribed = true)
        awaitClose {
            CoroutineScope(Dispatchers.IO).launch {
                runCatching {
                    canal.unsubscribe()
                    cliente.realtime.removeChannel(canal)
                }
            }
        }
    }

    // ---------- Sesión ----------

    override suspend fun restaurarSesion(): String? {
        cliente.auth.awaitInitialization()
        return cliente.auth.currentSessionOrNull()?.user?.id
    }

    override suspend fun ingresar(email: String, password: String): String {
        cliente.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
        return cliente.auth.currentUserOrNull()?.id ?: error("No se pudo iniciar la sesión")
    }

    override suspend fun registrar(email: String, password: String, datos: JsonObject): ResultadoRegistro {
        val usuario = cliente.auth.signUpWith(Email) {
            this.email = email
            this.password = password
            this.data = datos
        }
        val sesion = cliente.auth.currentSessionOrNull()
        val yaExistia = sesion == null && usuario != null && usuario.identities.orEmpty().isEmpty()
        return ResultadoRegistro(
            sesionIniciada = sesion != null, usuarioId = sesion?.user?.id ?: usuario?.id, correoYaRegistrado = yaExistia
        )
    }

    override suspend fun recuperarPassword(email: String) {
        cliente.auth.resetPasswordForEmail(email)
    }

    override suspend fun cambiarPassword(email: String, actual: String, nueva: String) {
        // Se vuelve a validar la contraseña actual antes de cambiarla
        cliente.auth.signInWith(Email) {
            this.email = email
            this.password = actual
        }
        cliente.auth.updateUser { password = nueva }
    }

    override suspend fun cerrarSesion() {
        try {
            cliente.auth.signOut()
        } catch (e: Exception) {
            // Sin conexión no se puede avisar al servidor, pero la sesión guardada en el teléfono igual se descarta
            cliente.auth.clearSession()
        }
    }

    override suspend fun matriculaDisponible(matricula: String): Boolean =
        cliente.postgrest.rpc("matricula_disponible", buildJsonObject { put("p_matricula", matricula) })
            .decodeAs<Boolean>()

    // ---------- Perfil ----------

    private fun miId(): String = cliente.auth.currentUserOrNull()?.id ?: error("No hay una sesión iniciada")

    override suspend fun miPerfil(): PerfilDto =
        cliente.from("profiles").select(Columns.raw(PERFIL_COMPLETO)) {
            filter { eq("id", miId()) }
        }.decodeSingle()

    override suspend fun actualizarPerfil(cambios: JsonObject) {
        cliente.from("profiles").update(cambios) { filter { eq("id", miId()) } }
    }

    override suspend fun actualizarVeterinario(cambios: JsonObject) {
        cliente.from("veterinarios").update(cambios) { filter { eq("profile_id", miId()) } }
    }

    override suspend fun actualizarDni(dni: String) {
        cliente.from("perfiles_privados").update(buildJsonObject { put("dni", dni) }) {
            filter { eq("profile_id", miId()) }
        }
    }

    // ---------- Mascotas ----------

    override suspend fun misMascotas(): List<MascotaDto> =
        cliente.from("mascotas").select {
            filter {
                eq("dueno_id", miId())
                eq("activa", true)
            }
            order("nombre", Order.ASCENDING)
        }.decodeList()

    override suspend fun mascotasDelVeterinario(): List<MascotaDto> =
        cliente.from("mascotas").select(Columns.raw(MASCOTA_CON_DUENO)) {
            filter { eq("activa", true) }
            order("nombre", Order.ASCENDING)
        }.decodeList()

    override suspend fun mascotasAdmin(): List<MascotaDto> =
        cliente.from("mascotas").select {
            filter { eq("activa", true) }
        }.decodeList()

    override suspend fun crearMascota(mascota: NuevaMascotaDto) {
        cliente.from("mascotas").insert(mascota)
    }

    override suspend fun actualizarMascota(id: String, cambios: JsonObject) {
        cliente.from("mascotas").update(cambios) { filter { eq("id", id) } }
    }

    // ---------- Turnos ----------

    override suspend fun turnos(): List<TurnoDto> =
        cliente.from("turnos").select {
            order("fecha", Order.ASCENDING)
            order("hora", Order.ASCENDING)
        }.decodeList()

    override suspend fun crearTurno(turno: NuevoTurnoDto) {
        cliente.from("turnos").insert(turno)
    }

    override suspend fun actualizarTurno(id: String, cambios: JsonObject) {
        cliente.from("turnos").update(cambios) { filter { eq("id", id) } }
    }

    // ---------- Veterinarios y accesos ----------

    override suspend fun catalogoVeterinarios(): List<PerfilDto> =
        cliente.from("profiles").select(Columns.raw(CATALOGO)) {
            filter { eq("rol", "veterinario") }
            order("nombre", Order.ASCENDING)
        }.decodeList()

    override suspend fun accesos(): List<AccesoDto> = cliente.from("accesos_mascota").select().decodeList()

    override suspend fun compartirMascotas(mascotaIds: List<String>, veterinarioId: String) {
        if (mascotaIds.isEmpty()) return
        val existentes = cliente.from("accesos_mascota").select {
            filter {
                eq("veterinario_id", veterinarioId)
                isIn("mascota_id", mascotaIds)
            }
        }.decodeList<AccesoDto>()
        val yaTienen = existentes.map { it.mascotaId }.toSet()
        val nuevos = mascotaIds.filter { it !in yaTienen }.map {
            NuevoAccesoDto(mascotaId = it, veterinarioId = veterinarioId, estado = "activo", iniciadoPor = "dueno")
        }
        if (nuevos.isNotEmpty()) cliente.from("accesos_mascota").insert(nuevos)
        val aReactivar = existentes.filter { it.estado != "activo" }.map { it.id }
        if (aReactivar.isNotEmpty()) {
            cliente.from("accesos_mascota").update(buildJsonObject { put("estado", "activo") }) {
                filter { isIn("id", aReactivar) }
            }
        }
    }

    override suspend fun actualizarAcceso(id: String, estado: String) {
        cliente.from("accesos_mascota").update(buildJsonObject { put("estado", estado) }) {
            filter { eq("id", id) }
        }
    }

    override suspend fun actualizarAccesosDeVeterinario(veterinarioId: String, estado: String) {
        cliente.from("accesos_mascota").update(buildJsonObject { put("estado", estado) }) {
            filter { eq("veterinario_id", veterinarioId) }
        }
    }

    override suspend fun solicitarAcceso(mascotaId: String): String =
        cliente.postgrest.rpc("solicitar_acceso", buildJsonObject { put("p_mascota", mascotaId) }).decodeAs<String>()

    override suspend fun buscarDueno(dato: String): List<DuenoBuscadoDto> =
        cliente.postgrest.rpc("buscar_dueno", buildJsonObject { put("p_dato", dato) }).decodeList()

    override suspend fun horariosOcupados(veterinarioId: String, fecha: String): List<String> =
        cliente.postgrest.rpc("horarios_ocupados", buildJsonObject {
            put("p_veterinario", veterinarioId)
            put("p_fecha", fecha)
        }).decodeList<HoraOcupadaDto>().map { it.hora.take(5) }

    // ---------- Estudios previos de un turno ----------

    override suspend fun estudiosDeTurno(turnoId: String): List<EstudioTurnoDto> =
        cliente.from("turnos_estudios").select {
            filter { eq("turno_id", turnoId) }
            order("created_at", Order.ASCENDING)
        }.decodeList()

    override suspend fun adjuntarEstudios(estudios: List<NuevoEstudioTurnoDto>) {
        if (estudios.isNotEmpty()) cliente.from("turnos_estudios").insert(estudios)
    }

    // ---------- Historia clínica ----------

    override suspend fun registrosSalud(): List<RegistroSaludDto> =
        cliente.from("registros_salud").select {
            order("fecha", Order.DESCENDING)
        }.decodeList()

    override suspend fun crearRegistroSalud(registro: NuevoRegistroSaludDto) {
        cliente.from("registros_salud").insert(registro)
    }

    override suspend fun eliminarRegistroSalud(id: String) {
        cliente.from("registros_salud").delete { filter { eq("id", id) } }
    }

    override suspend fun informesDe(mascotaId: String): List<InformeDto> =
        cliente.from("informes_clinicos").select {
            filter { eq("mascota_id", mascotaId) }
            order("created_at", Order.DESCENDING)
        }.decodeList()

    override suspend fun crearInforme(informe: NuevoInformeDto) {
        cliente.from("informes_clinicos").insert(informe)
    }

    override suspend fun actualizarInforme(id: String, cambios: JsonObject) {
        cliente.from("informes_clinicos").update(cambios) { filter { eq("id", id) } }
    }

    override suspend fun archivosDe(mascotaId: String): List<ArchivoDto> =
        cliente.from("archivos_mascota").select {
            filter { eq("mascota_id", mascotaId) }
            order("created_at", Order.DESCENDING)
        }.decodeList()

    override suspend fun crearArchivo(archivo: NuevoArchivoDto) {
        cliente.from("archivos_mascota").insert(archivo)
    }

    override suspend fun renombrarArchivo(id: String, nombre: String) {
        cliente.from("archivos_mascota").update(buildJsonObject { put("nombre", nombre) }) {
            filter { eq("id", id) }
        }
    }

    override suspend fun eliminarArchivo(id: String) {
        cliente.from("archivos_mascota").delete { filter { eq("id", id) } }
    }

    // ---------- Storage ----------

    override suspend fun subir(bucket: String, ruta: String, bytes: ByteArray, tipoMime: String) {
        cliente.storage.from(bucket).upload(ruta, bytes) {
            upsert = true
            contentType = ContentType.parse(tipoMime)
        }
    }

    override suspend fun descargar(bucket: String, ruta: String): ByteArray =
        cliente.storage.from(bucket).downloadAuthenticated(ruta)

    override suspend fun borrar(bucket: String, rutas: List<String>) {
        if (rutas.isNotEmpty()) cliente.storage.from(bucket).delete(rutas)
    }

    // ---------- Notificaciones ----------

    override suspend fun notificaciones(): List<NotificacionDto> =
        cliente.from("notificaciones").select {
            order("created_at", Order.DESCENDING)
        }.decodeList()

    override suspend fun marcarNotificacionesLeidas() {
        cliente.from("notificaciones").update(buildJsonObject { put("leida", true) }) {
            filter { eq("usuario_id", miId()) }
        }
    }

    override suspend fun borrarNotificaciones() {
        cliente.from("notificaciones").delete { filter { eq("usuario_id", miId()) } }
    }

    // ---------- Administrador ----------

    override suspend fun perfilesAdmin(): List<PerfilDto> =
        cliente.from("profiles").select(Columns.raw(PERFIL_COMPLETO)) {
            filter { neq("rol", "admin") }
            order("created_at", Order.DESCENDING)
        }.decodeList()

    override suspend fun actividadAdmin(): List<ActividadDto> =
        cliente.from("actividad_admin").select {
            order("created_at", Order.DESCENDING)
            limit(100)
        }.decodeList()

    override suspend fun resumenAdmin(): JsonObject =
        cliente.postgrest.rpc("admin_resumen").decodeAs<JsonObject>()

    override suspend fun cambiarEstadoCuenta(id: String, estado: String, motivo: String?) {
        cliente.from("profiles").update(buildJsonObject {
            put("estado", estado)
            put("motivo_estado", motivo)
        }) { filter { eq("id", id) } }
    }

    // ---------- Baja de cuenta ----------

    override suspend fun rutasArchivosCuenta(): List<RutaDto> =
        cliente.postgrest.rpc("rutas_archivos_cuenta").decodeList()

    override suspend fun eliminarCuenta() {
        cliente.postgrest.rpc("eliminar_mi_cuenta")
        cliente.auth.signOut()
    }
}
