package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.data.remoto.ActividadDto
import frgp.utn.edu.petcare.data.remoto.ArchivoDto
import frgp.utn.edu.petcare.data.remoto.DuenoBuscadoDto
import frgp.utn.edu.petcare.data.remoto.FuenteDatos
import frgp.utn.edu.petcare.data.remoto.InformeDto
import frgp.utn.edu.petcare.data.remoto.MascotaDto
import frgp.utn.edu.petcare.data.remoto.NotificacionDto
import frgp.utn.edu.petcare.data.remoto.NuevaMascotaDto
import frgp.utn.edu.petcare.data.remoto.NuevoAccesoDto
import frgp.utn.edu.petcare.data.remoto.NuevoArchivoDto
import frgp.utn.edu.petcare.data.remoto.NuevoInformeDto
import frgp.utn.edu.petcare.data.remoto.NuevoRegistroSaludDto
import frgp.utn.edu.petcare.data.remoto.NuevoTurnoDto
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import frgp.utn.edu.petcare.data.remoto.PrivadoDto
import frgp.utn.edu.petcare.data.remoto.RegistroSaludDto
import frgp.utn.edu.petcare.data.remoto.ResultadoRegistro
import frgp.utn.edu.petcare.data.remoto.RutaDto
import frgp.utn.edu.petcare.data.remoto.TurnoDto
import frgp.utn.edu.petcare.data.remoto.VeterinarioDto
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.put

/**
 * Servidor de mentira para las pruebas: guarda todo en listas y anota cada escritura en [llamadas] para poder
 * comprobar qué se le mandó a Supabase sin necesitar red.
 */
class FuenteEnMemoria(var yo: PerfilDto) : FuenteDatos {

    val perfiles = mutableListOf<PerfilDto>()
    val mascotas = mutableListOf<MascotaDto>()
    val turnos = mutableListOf<TurnoDto>()
    val accesos = mutableListOf<AccesoDto>()
    val notificaciones = mutableListOf<NotificacionDto>()
    val registros = mutableListOf<RegistroSaludDto>()
    val informes = mutableListOf<InformeDto>()
    val archivos = mutableListOf<ArchivoDto>()
    val actividad = mutableListOf<ActividadDto>()
    val duenosBuscables = mutableListOf<DuenoBuscadoDto>()
    var ocupados: List<String> = emptyList()
    var resumen: JsonObject = JsonObject(emptyMap())
    var haySesionGuardada = false
    var sesionCerrada = false

    /** Una línea por escritura, por ejemplo `crearMascota:Rex` o `estadoCuenta:<id>=activo`. */
    val llamadas = mutableListOf<String>()
    val subidas = mutableListOf<String>()

    // ---------- Sesión ----------

    override suspend fun restaurarSesion(): String? = if (haySesionGuardada) yo.id else null

    override suspend fun ingresar(email: String, password: String): String {
        haySesionGuardada = true
        sesionCerrada = false
        return yo.id
    }

    override suspend fun registrar(email: String, password: String, datos: JsonObject): ResultadoRegistro {
        llamadas.add("registrar:$email")
        return ResultadoRegistro(sesionIniciada = true, usuarioId = yo.id)
    }

    override suspend fun cambiarPassword(email: String, actual: String, nueva: String) {
        llamadas.add("password:$email")
    }

    override suspend fun cerrarSesion() {
        haySesionGuardada = false
        sesionCerrada = true
    }

    // ---------- Perfil ----------

    override suspend fun miPerfil(): PerfilDto = yo

    override suspend fun actualizarPerfil(cambios: JsonObject) {
        llamadas.add("perfil:" + cambios.keys.sorted().joinToString(","))
    }

    override suspend fun actualizarVeterinario(cambios: JsonObject) {
        llamadas.add("veterinario:" + cambios.keys.sorted().joinToString(","))
    }

    // ---------- Mascotas ----------

    override suspend fun misMascotas() = mascotas.filter { it.duenoId == yo.id && it.activa }

    override suspend fun mascotasDelVeterinario() = mascotas.filter { it.activa }

    override suspend fun mascotasAdmin() = mascotas.filter { it.activa }

    override suspend fun crearMascota(mascota: NuevaMascotaDto) {
        llamadas.add("crearMascota:${mascota.nombre}")
        mascotas.add(
            MascotaDto(
                id = mascota.id, duenoId = mascota.duenoId, nombre = mascota.nombre, tipo = mascota.tipo, raza = mascota.raza,
                nacimiento = mascota.nacimiento, sexo = mascota.sexo, pesoKg = mascota.pesoKg,
                propietarioNombre = mascota.propietarioNombre
            )
        )
    }

    override suspend fun actualizarMascota(id: String, cambios: JsonObject) {
        llamadas.add("mascota:$id:" + cambios.keys.sorted().joinToString(","))
        if ((cambios["activa"] as? JsonPrimitive)?.content == "false") {
            val i = mascotas.indexOfFirst { it.id == id }
            if (i >= 0) mascotas[i] = mascotas[i].copy(activa = false)
        }
    }

    // ---------- Turnos ----------

    override suspend fun turnos() = turnos.toList()

    override suspend fun crearTurno(turno: NuevoTurnoDto) {
        llamadas.add("crearTurno:${turno.fecha} ${turno.hora}")
        turnos.add(
            TurnoDto(
                id = turno.id, mascotaId = turno.mascotaId, veterinarioId = turno.veterinarioId, categoria = turno.categoria,
                motivo = turno.motivo, fecha = turno.fecha, hora = turno.hora, estado = turno.estado, notas = turno.notas
            )
        )
        // El servidor le da acceso al veterinario apenas se agenda el turno
        val vet = turno.veterinarioId
        if (vet != null && accesos.none { it.mascotaId == turno.mascotaId && it.veterinarioId == vet }) {
            accesos.add(AccesoDto("acc-${accesos.size}", turno.mascotaId, vet, "activo", "dueno"))
        }
    }

    override suspend fun actualizarTurno(id: String, cambios: JsonObject) {
        llamadas.add("turno:$id:" + cambios.entries.sortedBy { it.key }.joinToString(",") { "${it.key}=${(it.value as? JsonPrimitive)?.content}" })
        val i = turnos.indexOfFirst { it.id == id }
        if (i < 0) return
        fun texto(clave: String) = (cambios[clave] as? JsonPrimitive)?.takeIf { it.content != "null" }?.content
        var t = turnos[i]
        texto("estado")?.let { t = t.copy(estado = it) }
        texto("fecha")?.let { t = t.copy(fecha = it) }
        texto("hora")?.let { t = t.copy(hora = it) }
        if ("veterinario_id" in cambios) t = t.copy(veterinarioId = texto("veterinario_id"))
        if ("notas" in cambios) t = t.copy(notas = texto("notas"))
        turnos[i] = t
    }

    // ---------- Veterinarios y accesos ----------

    override suspend fun catalogoVeterinarios() = perfiles.filter { it.rol == "veterinario" }

    override suspend fun accesos() = accesos.toList()

    override suspend fun compartirMascotas(mascotaIds: List<String>, veterinarioId: String) {
        llamadas.add("compartir:${mascotaIds.size}:$veterinarioId")
        mascotaIds.forEach { id ->
            val i = accesos.indexOfFirst { it.mascotaId == id && it.veterinarioId == veterinarioId }
            if (i >= 0) accesos[i] = accesos[i].copy(estado = "activo")
            else accesos.add(AccesoDto("acc-${accesos.size}", id, veterinarioId, "activo", "dueno"))
        }
    }

    override suspend fun actualizarAcceso(id: String, estado: String) {
        llamadas.add("acceso:$id=$estado")
        val i = accesos.indexOfFirst { it.id == id }
        if (i >= 0) accesos[i] = accesos[i].copy(estado = estado)
    }

    override suspend fun actualizarAccesosDeVeterinario(veterinarioId: String, estado: String) {
        llamadas.add("accesosDe:$veterinarioId=$estado")
        for (i in accesos.indices) if (accesos[i].veterinarioId == veterinarioId) accesos[i] = accesos[i].copy(estado = estado)
    }

    override suspend fun solicitarAcceso(mascotaId: String): String {
        llamadas.add("solicitarAcceso:$mascotaId")
        accesos.add(AccesoDto("acc-${accesos.size}", mascotaId, yo.id, "pendiente", "veterinario"))
        return "pendiente"
    }

    override suspend fun buscarDueno(dato: String) = duenosBuscables.toList()

    override suspend fun horariosOcupados(veterinarioId: String, fecha: String) = ocupados

    // ---------- Historia clínica ----------

    override suspend fun registrosSalud() = registros.toList()

    override suspend fun crearRegistroSalud(registro: NuevoRegistroSaludDto) {
        llamadas.add("crearRegistro:${registro.tipo}:${registro.titulo}")
    }

    override suspend fun eliminarRegistroSalud(id: String) {
        llamadas.add("eliminarRegistro:$id")
    }

    override suspend fun informesDe(mascotaId: String) = informes.filter { it.mascotaId == mascotaId }

    override suspend fun crearInforme(informe: NuevoInformeDto) {
        llamadas.add("crearInforme:${informe.mascotaId}")
    }

    override suspend fun actualizarInforme(id: String, cambios: JsonObject) {
        llamadas.add("actualizarInforme:$id")
    }

    override suspend fun archivosDe(mascotaId: String) = archivos.filter { it.mascotaId == mascotaId }

    override suspend fun crearArchivo(archivo: NuevoArchivoDto) {
        llamadas.add("crearArchivo:${archivo.nombre}")
    }

    override suspend fun renombrarArchivo(id: String, nombre: String) {
        llamadas.add("renombrarArchivo:$nombre")
    }

    override suspend fun eliminarArchivo(id: String) {
        llamadas.add("eliminarArchivo:$id")
    }

    // ---------- Storage ----------

    override suspend fun subir(bucket: String, ruta: String, bytes: ByteArray, tipoMime: String) {
        subidas.add("$bucket/$ruta")
    }

    override suspend fun borrar(bucket: String, rutas: List<String>) {
        llamadas.add("borrar:$bucket:${rutas.size}")
    }

    // ---------- Notificaciones ----------

    override suspend fun notificaciones() = notificaciones.toList()

    override suspend fun marcarNotificacionesLeidas() {
        llamadas.add("notificacionesLeidas")
    }

    override suspend fun borrarNotificaciones() {
        llamadas.add("notificacionesBorradas")
        notificaciones.clear()
    }

    // ---------- Administrador ----------

    override suspend fun perfilesAdmin() = perfiles.filter { it.rol != "admin" }

    override suspend fun actividadAdmin() = actividad.toList()

    override suspend fun resumenAdmin() = resumen

    override suspend fun cambiarEstadoCuenta(id: String, estado: String, motivo: String?) {
        llamadas.add("estadoCuenta:$id=$estado" + (motivo?.let { ":$it" } ?: ""))
        val i = perfiles.indexOfFirst { it.id == id }
        if (i >= 0) perfiles[i] = perfiles[i].copy(estado = estado, motivoEstado = motivo)
    }

    // ---------- Baja ----------

    override suspend fun rutasArchivosCuenta() = listOf(RutaDto("fotos", "${yo.id}/a.jpg"), RutaDto("archivos", "m/x.pdf"))

    override suspend fun eliminarCuenta() {
        llamadas.add("eliminarCuenta")
    }
}

/** Datos de ejemplo que arman cada prueba (viven solo en los tests, no en la app). */
object Escenario {

    const val DUENO_ID = "dueno-1"
    const val VET_ID = "vet-1"
    const val ADMIN_ID = "admin-1"

    fun perfil(
        id: String, rol: String, nombre: String, estado: String = "activo", motivo: String? = null,
        veterinario: VeterinarioDto? = null, dni: String? = null
    ) = PerfilDto(
        id = id, rol = rol, estado = estado, motivoEstado = motivo, nombre = nombre, email = "$id@prueba.test",
        telefono = "1155550000", direccion = "Calle 123", createdAt = "2026-01-10T12:00:00+00:00",
        veterinarios = veterinario, privados = dni?.let { PrivadoDto(it) }
    )

    fun dueno() = perfil(DUENO_ID, "dueno", "Ana Prueba", dni = "30111222")

    fun veterinario(id: String = VET_ID, nombre: String = "Dr. Vera", estado: String = "activo") = perfil(
        id, "veterinario", nombre, estado = estado, dni = "28999888",
        veterinario = VeterinarioDto(
            profileId = id, matricula = "MP-100", clinica = "Clínica Sur", direccionClinica = "Av. Siempreviva 742",
            diasAtencion = listOf(1, 2, 3, 4, 5), horaApertura = "09:00:00", horaCierre = "12:00:00",
            especialidades = listOf("Consulta general", "Vacunación y prevención")
        )
    )

    fun admin() = perfil(ADMIN_ID, "admin", "Administración")

    fun mascota(id: String, nombre: String, dueno: String? = DUENO_ID, tipo: String = "Perro") = MascotaDto(
        id = id, duenoId = dueno, nombre = nombre, tipo = tipo, raza = "Mestizo", nacimiento = "2020-03-15", sexo = "macho",
        pesoKg = 12.0
    )

    fun turno(id: String, mascotaId: String, fecha: String, hora: String, vet: String? = VET_ID, estado: String = "pendiente") =
        TurnoDto(id = id, mascotaId = mascotaId, veterinarioId = vet, categoria = "Control", fecha = fecha, hora = hora, estado = estado)

    fun resumen(vararg pares: Pair<String, Int>): JsonObject = buildJsonObject { pares.forEach { (k, v) -> put(k, v) } }

    fun entero(json: JsonObject, clave: String) = (json[clave] as? JsonPrimitive)?.intOrNull
}
