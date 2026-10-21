package frgp.utn.edu.petcare.data.remoto

import android.content.Context
import android.net.Uri
import frgp.utn.edu.petcare.BuildConfig
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.FlowType
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.exceptions.RestException
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.serializer.KotlinXSerializer
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.storage.storage
import io.github.jan.supabase.SupabaseClient
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import java.util.UUID
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
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
            // Los enlaces del correo (recuperar contraseña) vuelven a la app con un código que se canjea por la sesión
            flowType = FlowType.PKCE
            scheme = "petcare"
            host = "recuperar"
            sessionManager = SesionGuardada(contexto)
            codeVerifierCache = CodigoVerificadorGuardado(contexto)
        }
        install(Postgrest)
        install(Storage)
        install(Realtime)
        install(Functions)
    }

    private companion object {
        const val ENLACE_DE_RECUPERACION = "petcare://recuperar"
        const val PERFIL_COMPLETO = "*,veterinarios(*,sedes(*)),perfiles_privados(dni)"

        /** Lo que muestra el panel del administrador: sin las preferencias ni el encuadre de la foto. */
        const val PERFIL_ADMIN = "id,rol,estado,motivo_estado,nombre,email,telefono,direccion,foto_path,created_at," +
            "veterinarios(*,sedes(*)),perfiles_privados(dni)"
        const val CATALOGO = "id,rol,estado,nombre,email,telefono,direccion,foto_path,veterinarios!inner(*,sedes(*))"
        const val MASCOTA_CON_DUENO = "*,dueno:profiles!mascotas_dueno_id_fkey(nombre,email,telefono,direccion,foto_path)"
    }

    // ---------- Cambios en vivo ----------

    private val tablasEscuchadas = listOf(
        "turnos", "accesos_mascota", "notificaciones", "mascotas", "informes_clinicos", "archivos_mascota",
        "registros_salud", "prescripciones", "sedes", "recordatorios"
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
        val usuario = try {
            cliente.auth.signUpWith(Email) {
                this.email = email
                this.password = password
                this.data = datos
            }
        } catch (e: io.github.jan.supabase.exceptions.RestException) {
            // Si la base rechaza el alta (DNI o matrícula ya registrados) el servidor responde 500 sin explicar
            if (e.statusCode >= 500) {
                throw IllegalStateException(
                    "No pudimos crear la cuenta. Lo más probable es que el DNI o la matrícula ya estén registrados " +
                        "con otra cuenta: revisalos e intentá de nuevo. Si ya tenés una cuenta de dueño, ingresá con " +
                        "ella y pedí el alta como veterinario desde tu perfil."
                )
            }
            throw e
        }
        val sesion = cliente.auth.currentSessionOrNull()
        val yaExistia = sesion == null && usuario != null && usuario.identities.orEmpty().isEmpty()
        return ResultadoRegistro(
            sesionIniciada = sesion != null, usuarioId = sesion?.user?.id ?: usuario?.id, correoYaRegistrado = yaExistia
        )
    }

    override suspend fun solicitarAltaVeterinario(datos: SolicitudAltaVeterinarioDto) {
        cliente.postgrest.rpc("solicitar_alta_veterinario", buildJsonObject {
            put("p_matricula", datos.matricula)
            put("p_clinica", datos.clinica)
            put("p_direccion_clinica", datos.direccionClinica)
            put("p_dias", kotlinx.serialization.json.JsonArray(datos.dias.map { kotlinx.serialization.json.JsonPrimitive(it) }))
            put("p_apertura", datos.apertura)
            put("p_cierre", datos.cierre)
            put("p_especialidades", kotlinx.serialization.json.JsonArray(datos.especialidades.map { kotlinx.serialization.json.JsonPrimitive(it) }))
            put("p_tipos_animales", kotlinx.serialization.json.JsonArray(datos.tiposAnimales.map { kotlinx.serialization.json.JsonPrimitive(it) }))
            put("p_credencial_path", datos.credencialPath)
            put("p_sedes", frgp.utn.edu.petcare.data.Registro.datosDeSedes(datos.sedesExtra))
        })
    }

    override suspend fun guardarCredencial(ruta: String) {
        cliente.postgrest.rpc("guardar_credencial", buildJsonObject { put("p_path", ruta) })
    }

    override suspend fun recuperarPassword(email: String) {
        // El correo vuelve a la app con este enlace (está declarado en el manifest y en las URL permitidas de Supabase)
        cliente.auth.resetPasswordForEmail(email, redirectUrl = ENLACE_DE_RECUPERACION)
    }

    override suspend fun abrirEnlaceDeRecuperacion(enlace: String) {
        val uri = Uri.parse(enlace)
        // Según cómo responda Supabase, los datos llegan en la consulta o en el fragmento
        val fragmento = uri.fragment?.let { Uri.parse("?$it") }
        fun dato(nombre: String) = uri.getQueryParameter(nombre) ?: fragmento?.getQueryParameter(nombre)

        val enlaceInvalido = "El enlace no es válido. Pedí uno nuevo desde \"Olvidé mi contraseña\"."
        dato("error_description")?.let { motivo ->
            val vencido = dato("error_code") == "otp_expired" || "expired" in motivo.lowercase()
            throw IllegalStateException(
                if (vencido) "El enlace venció o ya se usó. Pedí uno nuevo desde \"Olvidé mi contraseña\"."
                else enlaceInvalido
            )
        }
        val codigo = dato("code") ?: throw IllegalStateException(enlaceInvalido)
        try {
            cliente.auth.exchangeCodeForSession(codigo)
        } catch (e: Exception) {
            if (e is java.io.IOException || e.cause is java.io.IOException) throw e
            throw IllegalStateException(
                "No pudimos validar el enlace. Pedí uno nuevo y abrilo en este mismo teléfono."
            )
        }
    }

    override suspend fun cambiarPassword(email: String, actual: String, nueva: String) {
        // Se vuelve a validar la contraseña actual antes de cambiarla
        cliente.auth.signInWith(Email) {
            this.email = email
            this.password = actual
        }
        cliente.auth.updateUser { password = nueva }
    }

    override suspend fun definirPassword(nueva: String) {
        cliente.auth.updateUser { password = nueva }
    }

    override suspend fun completarPrimerIngreso(terminosVersion: String) {
        cliente.postgrest.rpc("completar_primer_ingreso", buildJsonObject { put("p_terminos", terminosVersion) })
    }

    override suspend fun crearCuentaDueno(datos: NuevaCuentaDuenoDto): CuentaDuenoCreadaDto {
        val cuerpo = try {
            val respuesta = cliente.functions.invoke("crear-cuenta-dueno", datos)
            Json.parseToJsonElement(respuesta.bodyAsText()).jsonObject
        } catch (e: RestException) {
            // La función responde con un mensaje pensado para el veterinario también cuando rechaza el pedido
            val mensaje = runCatching {
                Json.parseToJsonElement(e.response.bodyAsText()).jsonObject["mensaje"]?.jsonPrimitive?.contentOrNull
            }.getOrNull()
            throw IllegalStateException(
                mensaje ?: if (e.statusCode == 404) {
                    "La creación de cuentas todavía no está habilitada en el servidor."
                } else {
                    "No pudimos crear la cuenta del dueño. Intentá de nuevo en un rato."
                }
            )
        }
        if (cuerpo["ok"]?.jsonPrimitive?.booleanOrNull != true) {
            throw IllegalStateException(
                cuerpo["mensaje"]?.jsonPrimitive?.contentOrNull ?: "No pudimos crear la cuenta del dueño."
            )
        }
        return Json { ignoreUnknownKeys = true }.decodeFromJsonElement(CuentaDuenoCreadaDto.serializer(), cuerpo)
    }

    override suspend fun cerrarSesion() {
        try {
            cliente.auth.signOut()
        } finally {
            // Sin conexión (o si se corta la espera) no se avisa al servidor, pero la sesión guardada en el teléfono igual se descarta
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

    override suspend fun crearSede(sede: NuevaSedeDto) {
        cliente.from("sedes").insert(sede)
    }

    override suspend fun actualizarSede(id: String, cambios: JsonObject) {
        cliente.from("sedes").update(cambios) { filter { eq("id", id) } }
    }

    override suspend fun eliminarSede(id: String) {
        cliente.from("sedes").delete { filter { eq("id", id) } }
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
        cliente.from("mascotas").select(Columns.raw("id,dueno_id,nombre,tipo,raza,activa")) {
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
        // Todas las cuentas con rol de veterinario visibles para el usuario (también los dueños que se dieron de alta)
        cliente.from("profiles").select(Columns.raw(CATALOGO)) {
            order("nombre", Order.ASCENDING)
        }.decodeList()

    override suspend fun accesos(): List<AccesoDto> = cliente.from("accesos_mascota").select().decodeList()

    override suspend fun compartirMascotas(mascotaIds: List<String>, veterinarioId: String, venceEl: String?) {
        if (mascotaIds.isEmpty()) return
        val existentes = cliente.from("accesos_mascota").select {
            filter {
                eq("veterinario_id", veterinarioId)
                isIn("mascota_id", mascotaIds)
            }
        }.decodeList<AccesoDto>()
        val yaTienen = existentes.map { it.mascotaId }.toSet()
        val nuevos = mascotaIds.filter { it !in yaTienen }.map {
            NuevoAccesoDto(
                mascotaId = it, veterinarioId = veterinarioId, estado = "activo", iniciadoPor = "dueno", venceEl = venceEl
            )
        }
        if (nuevos.isNotEmpty()) cliente.from("accesos_mascota").insert(nuevos)
        // Los que ya existían quedan activos y con el vencimiento elegido
        val actuales = existentes.map { it.id }
        if (actuales.isNotEmpty()) {
            cliente.from("accesos_mascota").update(buildJsonObject {
                put("estado", "activo")
                put("vence_el", venceEl)
            }) {
                filter { isIn("id", actuales) }
            }
        }
    }

    override suspend fun fijarVencimientoDeAccesos(veterinarioId: String, venceEl: String?) {
        cliente.from("accesos_mascota").update(buildJsonObject { put("vence_el", venceEl) }) {
            filter {
                eq("veterinario_id", veterinarioId)
                eq("estado", "activo")
            }
        }
    }

    override suspend fun historialDeAccesos(): List<AccesoHistorialDto> =
        cliente.from("accesos_historial").select {
            order("created_at", Order.DESCENDING)
            limit(200)
        }.decodeList()

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

    override suspend fun solicitarAcceso(mascotaId: String, turno: JsonObject?): String =
        cliente.postgrest.rpc("solicitar_acceso", buildJsonObject {
            put("p_mascota", mascotaId)
            if (turno != null) put("p_turno", turno)
        }).decodeAs<String>()

    override suspend fun misSolicitudes(): List<SolicitudAccesoDto> =
        cliente.postgrest.rpc("mis_solicitudes").decodeList()

    override suspend fun buscarDueno(dato: String): List<DuenoBuscadoDto> =
        cliente.postgrest.rpc("buscar_dueno", buildJsonObject { put("p_dato", dato) }).decodeList()

    override suspend fun horariosOcupados(veterinarioId: String, fecha: String): List<HoraOcupadaDto> =
        cliente.postgrest.rpc("horarios_ocupados", buildJsonObject {
            put("p_veterinario", veterinarioId)
            put("p_fecha", fecha)
        }).decodeList<HoraOcupadaDto>().map { it.copy(hora = it.hora.take(5)) }

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

    override suspend fun recordatorios(): List<RecordatorioDto> =
        cliente.from("recordatorios").select {
            order("fecha", Order.ASCENDING)
        }.decodeList()

    override suspend fun crearRecordatorio(recordatorio: NuevoRecordatorioDto) {
        cliente.from("recordatorios").insert(recordatorio)
    }

    override suspend fun actualizarRecordatorio(id: String, cambios: JsonObject) {
        cliente.from("recordatorios").update(cambios) { filter { eq("id", id) } }
    }

    override suspend fun borrarRecordatorio(id: String) {
        cliente.from("recordatorios").delete { filter { eq("id", id) } }
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

    override suspend fun prescripciones(mascotaId: String?): List<PrescripcionDto> =
        cliente.from("prescripciones").select {
            if (mascotaId != null) filter { eq("mascota_id", mascotaId) }
            order("created_at", Order.DESCENDING)
        }.decodeList()

    override suspend fun crearPrescripcion(prescripcion: NuevaPrescripcionDto) {
        cliente.from("prescripciones").insert(prescripcion)
    }

    override suspend fun eliminarPrescripcion(id: String) {
        cliente.from("prescripciones").delete { filter { eq("id", id) } }
    }

    override suspend fun guardarAlertas(mascotaId: String, alertas: String) {
        cliente.postgrest.rpc("guardar_alertas", buildJsonObject {
            put("p_mascota", mascotaId)
            put("p_alertas", alertas)
        })
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

    override suspend fun borrarNotificacion(id: String) {
        cliente.from("notificaciones").delete { filter { eq("id", id); eq("usuario_id", miId()) } }
    }

    // ---------- Administrador ----------

    override suspend fun perfilesAdmin(): List<PerfilDto> =
        cliente.from("profiles").select(Columns.raw(PERFIL_ADMIN)) {
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

    override suspend fun revisarVeterinario(id: String, estado: String, motivo: String?) {
        cliente.postgrest.rpc("revisar_veterinario", buildJsonObject {
            put("p_id", id)
            put("p_estado", estado)
            if (motivo != null) put("p_motivo", motivo)
        })
    }

    override suspend fun avisarRevisionPorCorreo(veterinarioId: String) {
        // La revisión ya quedó guardada (y el veterinario ve el aviso en la app): si el correo no sale, no se muestra error
        runCatching { cliente.functions.invoke("avisar-veterinario", buildJsonObject { put("veterinario_id", veterinarioId) }) }
    }

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
