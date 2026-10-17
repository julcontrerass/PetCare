package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.data.remoto.CuentaDuenoCreadaDto
import frgp.utn.edu.petcare.data.remoto.MascotaCreadaDto
import frgp.utn.edu.petcare.data.remoto.NuevaCuentaDuenoDto
import frgp.utn.edu.petcare.data.remoto.ActividadDto
import frgp.utn.edu.petcare.data.remoto.ArchivoDto
import frgp.utn.edu.petcare.data.remoto.DuenoBuscadoDto
import frgp.utn.edu.petcare.data.remoto.EstudioTurnoDto
import frgp.utn.edu.petcare.data.remoto.FuenteDatos
import frgp.utn.edu.petcare.data.remoto.HoraOcupadaDto
import frgp.utn.edu.petcare.data.remoto.InformeDto
import frgp.utn.edu.petcare.data.remoto.MascotaDto
import frgp.utn.edu.petcare.data.remoto.NotificacionDto
import frgp.utn.edu.petcare.data.remoto.NuevaMascotaDto
import frgp.utn.edu.petcare.data.remoto.NuevaSedeDto
import frgp.utn.edu.petcare.data.remoto.NuevaPrescripcionDto
import frgp.utn.edu.petcare.data.remoto.NuevoAccesoDto
import frgp.utn.edu.petcare.data.remoto.NuevoArchivoDto
import frgp.utn.edu.petcare.data.remoto.NuevoEstudioTurnoDto
import frgp.utn.edu.petcare.data.remoto.NuevoInformeDto
import frgp.utn.edu.petcare.data.remoto.NuevoRegistroSaludDto
import frgp.utn.edu.petcare.data.remoto.NuevoTurnoDto
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import frgp.utn.edu.petcare.data.remoto.PrescripcionDto
import frgp.utn.edu.petcare.data.remoto.PrivadoDto
import frgp.utn.edu.petcare.data.remoto.RegistroSaludDto
import frgp.utn.edu.petcare.data.remoto.ResultadoRegistro
import frgp.utn.edu.petcare.data.remoto.RutaDto
import frgp.utn.edu.petcare.data.remoto.SedeDto
import frgp.utn.edu.petcare.data.remoto.SolicitudAccesoDto
import frgp.utn.edu.petcare.data.remoto.TurnoDto
import frgp.utn.edu.petcare.data.remoto.VeterinarioDto
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
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
    var ocupados: List<HoraOcupadaDto> = emptyList()
    var resumen: JsonObject = JsonObject(emptyMap())
    var haySesionGuardada = false
    var sesionCerrada = false

    /** Una línea por escritura, por ejemplo `crearMascota:Rex` o `estadoCuenta:<id>=activo`. */
    val llamadas = mutableListOf<String>()
    val subidas = mutableListOf<String>()
    val borradas = mutableListOf<String>()

    /** Las pruebas emiten acá para simular que el servidor avisó de un cambio. */
    val avisosDelServidor = kotlinx.coroutines.flow.MutableSharedFlow<Unit>(extraBufferCapacity = 8)

    override fun cambios() = avisosDelServidor

    // ---------- Sesión ----------

    override suspend fun restaurarSesion(): String? = if (haySesionGuardada) yo.id else null

    override suspend fun ingresar(email: String, password: String): String {
        haySesionGuardada = true
        sesionCerrada = false
        return yo.id
    }

    val matriculasEnUso = mutableSetOf<String>()

    override suspend fun matriculaDisponible(matricula: String) = matricula.lowercase() !in matriculasEnUso

    /** Los datos con los que se creó la última cuenta (lo que el servidor guarda de la persona y del veterinario). */
    var ultimosDatosDeRegistro: JsonObject? = null

    override suspend fun registrar(email: String, password: String, datos: JsonObject): ResultadoRegistro {
        llamadas.add("registrar:$email")
        ultimosDatosDeRegistro = datos
        return ResultadoRegistro(sesionIniciada = true, usuarioId = yo.id)
    }

    override suspend fun cambiarPassword(email: String, actual: String, nueva: String) {
        llamadas.add("password:$email")
    }

    override suspend fun definirPassword(nueva: String) {
        llamadas.add("definirPassword")
    }

    /** Si tiene valor, abrir el enlace de recuperación falla con ese mensaje (enlace vencido, por ejemplo). */
    var errorAlAbrirEnlace: String? = null

    override suspend fun abrirEnlaceDeRecuperacion(enlace: String) {
        llamadas.add("enlace:$enlace")
        errorAlAbrirEnlace?.let { throw IllegalStateException(it) }
        // Abrir el enlace deja una sesión abierta, como en el servidor real
        haySesionGuardada = true
    }

    override suspend fun completarPrimerIngreso(terminosVersion: String) {
        llamadas.add("primerIngreso:$terminosVersion")
    }

    /** Lo último que se le pidió al servidor al crear la cuenta de un dueño. */
    var ultimaCuentaPedida: NuevaCuentaDuenoDto? = null
    /** Si tiene valor, crear la cuenta falla con ese mensaje (DNI repetido, correo repetido...). */
    var errorAlCrearCuenta: String? = null

    /** Como el servidor: crea las mascotas nuevas, las deja a nombre del dueño y el veterinario conserva el acceso. */
    override suspend fun crearCuentaDueno(datos: NuevaCuentaDuenoDto): CuentaDuenoCreadaDto {
        llamadas.add("crearCuentaDueno:${datos.email}")
        ultimaCuentaPedida = datos
        errorAlCrearCuenta?.let { throw IllegalStateException(it) }
        val duenoId = "dueno-nuevo"
        val creadas = datos.mascotasNuevas.mapIndexed { i, m ->
            val id = "nueva-$i"
            mascotas.add(MascotaDto(id = id, duenoId = duenoId, nombre = m.nombre, tipo = m.tipo, raza = m.raza))
            accesos.add(AccesoDto("acc-$id", id, Escenario.VET_ID, "activo", "veterinario"))
            MascotaCreadaDto(id, m.nombre)
        }
        val vinculadas = datos.mascotasExistentes.map { id ->
            val i = mascotas.indexOfFirst { it.id == id }
            mascotas[i] = mascotas[i].copy(duenoId = duenoId)
            if (accesos.none { it.mascotaId == id }) {
                accesos.add(AccesoDto("acc-$id", id, Escenario.VET_ID, "activo", "veterinario"))
            }
            MascotaCreadaDto(id, mascotas[i].nombre)
        }
        return CuentaDuenoCreadaDto(duenoId, datos.email, "Temp1234ab", creadas + vinculadas)
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

    // ---------- Lugares de atención ----------

    private fun cambiarSedes(veterinarioId: String, nuevas: (List<SedeDto>) -> List<SedeDto>) {
        fun PerfilDto.conSedes() = copy(veterinarios = veterinarios?.copy(sedes = nuevas(veterinarios.lugares())))
        if (yo.id == veterinarioId) yo = yo.conSedes()
        val i = perfiles.indexOfFirst { it.id == veterinarioId }
        if (i >= 0) perfiles[i] = perfiles[i].conSedes()
    }

    override suspend fun crearSede(sede: NuevaSedeDto) {
        llamadas.add("crearSede:${sede.nombre}")
        cambiarSedes(sede.veterinarioId) { actuales ->
            // Una sede "de siempre" (sin id) pasa a ser real al agregar la segunda
            val reales = actuales.mapIndexed { i, s -> if (s.id.isBlank()) s.copy(id = "sede-base-$i") else s }
            reales + SedeDto(
                id = sede.id ?: "sede-${reales.size + 1}", veterinarioId = sede.veterinarioId, nombre = sede.nombre,
                direccion = sede.direccion, diasAtencion = sede.diasAtencion, horaApertura = sede.horaApertura,
                horaCierre = sede.horaCierre, createdAt = "2026-01-%02d".format(reales.size + 1)
            )
        }
    }

    override suspend fun actualizarSede(id: String, cambios: JsonObject) {
        llamadas.add("actualizarSede:$id:" + cambios.keys.sorted().joinToString(","))
        fun texto(clave: String) = (cambios[clave] as? JsonPrimitive)?.takeIf { it.content != "null" }?.content
        val duenos = (perfiles + yo).map { it.id }.distinct()
        duenos.forEach { vet ->
            cambiarSedes(vet) { actuales ->
                actuales.map { s ->
                    if (s.id != id) s else s.copy(
                        nombre = texto("nombre") ?: s.nombre,
                        direccion = if ("direccion" in cambios) texto("direccion") else s.direccion,
                        horaApertura = texto("hora_apertura") ?: s.horaApertura,
                        horaCierre = texto("hora_cierre") ?: s.horaCierre,
                        diasAtencion = (cambios["dias_atencion"] as? kotlinx.serialization.json.JsonArray)
                            ?.map { it.toString().toInt() } ?: s.diasAtencion
                    )
                }
            }
        }
    }

    override suspend fun eliminarSede(id: String) {
        llamadas.add("eliminarSede:$id")
        (perfiles + yo).map { it.id }.distinct().forEach { vet ->
            cambiarSedes(vet) { actuales -> actuales.filterNot { it.id == id } }
        }
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
                propietarioNombre = mascota.propietarioNombre, propietarioDni = mascota.propietarioDni
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
                motivo = turno.motivo, fecha = turno.fecha, hora = turno.hora, estado = turno.estado, notas = turno.notas,
                sedeId = turno.sedeId
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
        if ("sede_id" in cambios) t = t.copy(sedeId = texto("sede_id"))
        if ("notas" in cambios) t = t.copy(notas = texto("notas"))
        turnos[i] = t
    }

    // ---------- Veterinarios y accesos ----------

    override suspend fun catalogoVeterinarios() = perfiles.filter { it.rol == "veterinario" }

    override suspend fun accesos() = accesos.toList()

    override suspend fun misSolicitudes() = accesos
        .filter { it.veterinarioId == yo.id && (it.iniciadoPor == "veterinario" || it.estado == "pendiente") }
        .map { a ->
            val m = mascotas.firstOrNull { it.id == a.mascotaId }
            SolicitudAccesoDto(
                id = a.id, mascotaNombre = m?.nombre ?: "Mascota", mascotaTipo = m?.tipo,
                duenoNombre = m?.dueno?.nombre ?: m?.propietarioNombre, estado = a.estado,
                iniciadoPor = a.iniciadoPor, createdAt = a.createdAt
            )
        }

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

    var ultimoTurnoPropuesto: JsonObject? = null

    override suspend fun solicitarAcceso(mascotaId: String, turno: JsonObject?): String {
        llamadas.add("solicitarAcceso:$mascotaId")
        ultimoTurnoPropuesto = turno
        accesos.add(AccesoDto("acc-${accesos.size}", mascotaId, yo.id, "pendiente", "veterinario"))
        return "pendiente"
    }

    override suspend fun buscarDueno(dato: String) = duenosBuscables.toList()

    override suspend fun horariosOcupados(veterinarioId: String, fecha: String) = ocupados

    // ---------- Estudios previos de un turno ----------

    val estudios = mutableListOf<EstudioTurnoDto>()

    override suspend fun estudiosDeTurno(turnoId: String) = estudios.filter { it.turnoId == turnoId }

    override suspend fun adjuntarEstudios(estudios: List<NuevoEstudioTurnoDto>) {
        llamadas.add("adjuntarEstudios:${estudios.size}")
        estudios.forEach {
            this.estudios.add(EstudioTurnoDto("est-${this.estudios.size}", it.turnoId, it.storagePath, it.nombre, it.extension, it.tipo))
        }
    }

    // ---------- Historia clínica ----------

    override suspend fun registrosSalud() = registros.toList()

    var ultimoRegistroCreado: NuevoRegistroSaludDto? = null

    override suspend fun crearRegistroSalud(registro: NuevoRegistroSaludDto) {
        llamadas.add("crearRegistro:${registro.tipo}:${registro.titulo}")
        ultimoRegistroCreado = registro
    }

    override suspend fun eliminarRegistroSalud(id: String) {
        llamadas.add("eliminarRegistro:$id")
    }

    override suspend fun informesDe(mascotaId: String) = informes.filter { it.mascotaId == mascotaId }

    override suspend fun crearInforme(informe: NuevoInformeDto) {
        llamadas.add("crearInforme:${informe.mascotaId}")
        ultimoInformeCreado = informe
    }

    override suspend fun actualizarInforme(id: String, cambios: JsonObject) {
        llamadas.add("actualizarInforme:$id")
        ultimosCambiosDeInforme = cambios
    }

    val recetas = mutableListOf<PrescripcionDto>()
    var ultimosCambiosDeInforme: JsonObject? = null
    var ultimoInformeCreado: NuevoInformeDto? = null

    override suspend fun prescripciones(mascotaId: String?) =
        recetas.filter { mascotaId == null || it.mascotaId == mascotaId }

    override suspend fun crearPrescripcion(prescripcion: NuevaPrescripcionDto) {
        llamadas.add("crearPrescripcion:${prescripcion.medicamento}")
        recetas.add(
            PrescripcionDto(
                prescripcion.id, prescripcion.mascotaId, prescripcion.turnoId, prescripcion.veterinarioId,
                prescripcion.medicamento, prescripcion.dosis, prescripcion.frecuenciaHoras, prescripcion.duracionDias,
                prescripcion.indicaciones, prescripcion.inicio
            )
        )
    }

    override suspend fun eliminarPrescripcion(id: String) {
        llamadas.add("eliminarPrescripcion:$id")
        recetas.removeAll { it.id == id }
    }

    override suspend fun guardarAlertas(mascotaId: String, alertas: String) {
        llamadas.add("alertas:$mascotaId:$alertas")
    }

    override suspend fun archivosDe(mascotaId: String) = archivos.filter { it.mascotaId == mascotaId }

    override suspend fun crearArchivo(archivo: NuevoArchivoDto) {
        llamadas.add("crearArchivo:${archivo.nombre}")
        archivos.add(
            ArchivoDto(
                archivo.id, archivo.mascotaId, archivo.nombre, archivo.extension, archivo.storagePath,
                archivo.tamanoBytes, archivo.subidoPor, archivo.turnoId
            )
        )
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
        rutas.forEach { borradas.add("$bucket/$it") }
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

    var fallaAlCargarAdmin = false

    override suspend fun perfilesAdmin(): List<PerfilDto> {
        if (fallaAlCargarAdmin) throw java.io.IOException("sin conexión")
        return perfiles.filter { it.rol != "admin" }
    }

    override suspend fun actividadAdmin() = actividad.toList()

    override suspend fun resumenAdmin() = resumen

    override suspend fun cambiarEstadoCuenta(id: String, estado: String, motivo: String?) {
        llamadas.add("estadoCuenta:$id=$estado" + (motivo?.let { ":$it" } ?: ""))
        val i = perfiles.indexOfFirst { it.id == id }
        if (i >= 0) {
            val p = perfiles[i]
            // Como el servidor: en un veterinario el estado de la cuenta y el de la revisión van juntos
            perfiles[i] = p.copy(
                estado = estado, motivoEstado = motivo,
                veterinarios = p.veterinarios?.takeIf { p.rol == "veterinario" }
                    ?.copy(estadoRevision = estado, motivoRevision = motivo) ?: p.veterinarios
            )
        }
    }

    override suspend fun revisarVeterinario(id: String, estado: String, motivo: String?) {
        llamadas.add("revisionVet:$id=$estado" + (motivo?.let { ":$it" } ?: ""))
        val i = perfiles.indexOfFirst { it.id == id }
        if (i < 0) return
        val p = perfiles[i]
        perfiles[i] = p.copy(
            // Si es su rol principal la cuenta sigue la revisión; si es dueño, la cuenta no se toca
            estado = if (p.rol == "veterinario") estado else p.estado,
            motivoEstado = if (p.rol == "veterinario") motivo else p.motivoEstado,
            veterinarios = p.veterinarios?.copy(estadoRevision = estado, motivoRevision = motivo)
        )
    }

    // ---------- Alta como veterinario sobre una cuenta de dueño ----------

    var ultimaSolicitudDeAlta: frgp.utn.edu.petcare.data.remoto.SolicitudAltaVeterinarioDto? = null
    var ultimaCredencial: String? = null
    val rutasSubidas get() = subidas.toList()

    override suspend fun solicitarAltaVeterinario(datos: frgp.utn.edu.petcare.data.remoto.SolicitudAltaVeterinarioDto) {
        llamadas.add("altaVeterinario:${datos.matricula}")
        ultimaSolicitudDeAlta = datos
        // Como el servidor: el dueño queda con un rol de veterinario pendiente de revisión
        yo = yo.copy(
            veterinarios = VeterinarioDto(
                profileId = yo.id, matricula = datos.matricula, clinica = datos.clinica,
                direccionClinica = datos.direccionClinica, credencialPath = datos.credencialPath,
                estadoRevision = "pendiente_revision",
                // Como el servidor: el primer lugar sale de lo "de siempre" y los demás son los extra
                sedes = if (datos.sedesExtra.isEmpty()) emptyList() else listOf(
                    SedeDto(
                        id = "sede-1", veterinarioId = yo.id, nombre = datos.clinica, direccion = datos.direccionClinica,
                        diasAtencion = datos.dias, horaApertura = datos.apertura + ":00", horaCierre = datos.cierre + ":00",
                        createdAt = "2026-01-01"
                    )
                ) + datos.sedesExtra.mapIndexed { i, e ->
                    SedeDto(
                        id = "sede-${i + 2}", veterinarioId = yo.id, nombre = e.nombre, direccion = e.direccion,
                        diasAtencion = e.dias.sorted(), horaApertura = e.apertura + ":00", horaCierre = e.cierre + ":00",
                        createdAt = "2026-01-0${i + 2}"
                    )
                }
            )
        )
        val i = perfiles.indexOfFirst { it.id == yo.id }
        if (i >= 0) perfiles[i] = yo
    }

    override suspend fun guardarCredencial(ruta: String) {
        llamadas.add("credencial:$ruta")
        ultimaCredencial = ruta
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
            especialidades = listOf("Chequeo médico integral", "Cardiología"),
            // En el servidor la revisión del rol acompaña al estado de la cuenta
            estadoRevision = estado
        )
    )

    /** El mismo veterinario atendiendo en dos lugares: de lunes a viernes por la mañana y los sábados en otro. */
    fun veterinarioEnDosLugares(id: String = VET_ID, nombre: String = "Dr. Vera"): PerfilDto {
        val base = veterinario(id, nombre)
        return base.copy(
            veterinarios = base.veterinarios!!.copy(
                sedes = listOf(
                    SedeDto(
                        id = "sede-a", veterinarioId = id, nombre = "Clínica Sur", direccion = "Av. Siempreviva 742",
                        diasAtencion = listOf(1, 2, 3, 4, 5), horaApertura = "09:00:00", horaCierre = "12:00:00",
                        createdAt = "2026-01-01"
                    ),
                    SedeDto(
                        id = "sede-b", veterinarioId = id, nombre = "Consultorio Centro", direccion = "San Martín 100",
                        diasAtencion = listOf(6), horaApertura = "10:00:00", horaCierre = "14:00:00",
                        createdAt = "2026-01-02"
                    )
                )
            )
        )
    }

    /** Un dueño que además es veterinario: la cuenta es de dueño y el rol de veterinario tiene su propia revisión. */
    fun duenoYVeterinario(revision: String = "activo") = perfil(
        DUENO_ID, "dueno", "Ana Prueba", dni = "30111222",
        veterinario = VeterinarioDto(
            profileId = DUENO_ID, matricula = "MP-777", clinica = "Clínica Norte", direccionClinica = "Calle 5",
            diasAtencion = listOf(1, 2, 3, 4, 5), horaApertura = "09:00:00", horaCierre = "18:00:00",
            credencialPath = "$DUENO_ID/carnet.jpg", estadoRevision = revision
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
