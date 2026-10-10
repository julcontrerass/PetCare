package frgp.utn.edu.petcare.data

import android.net.Uri
import frgp.utn.edu.petcare.data.avisos.Recordatorios
import frgp.utn.edu.petcare.data.avisos.AvisosDelSistema
import frgp.utn.edu.petcare.data.CatalogoMedico
import frgp.utn.edu.petcare.data.remoto.NuevoEstudioTurnoDto
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.SolicitudItem
import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.data.remoto.MascotaDto
import frgp.utn.edu.petcare.data.remoto.NotificacionDto
import frgp.utn.edu.petcare.data.remoto.NuevaMascotaDto
import frgp.utn.edu.petcare.data.remoto.NuevoTurnoDto
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import frgp.utn.edu.petcare.data.remoto.TurnoDto
import frgp.utn.edu.petcare.model.AjusteFoto
import frgp.utn.edu.petcare.model.EstadoAcceso
import frgp.utn.edu.petcare.model.EstadoTurno
import frgp.utn.edu.petcare.model.EventoMascota
import frgp.utn.edu.petcare.model.Mascota
import frgp.utn.edu.petcare.model.NotificacionDueno
import frgp.utn.edu.petcare.model.PerfilDueno
import frgp.utn.edu.petcare.model.SIN_DATOS
import frgp.utn.edu.petcare.model.Sexo
import frgp.utn.edu.petcare.model.TipoNotificacion
import frgp.utn.edu.petcare.model.VeterinarioAcceso
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.time.LocalDate
import java.time.LocalTime

/** Todo lo que pertenece a la cuenta del dueño en sesión. */
private class EstadoDueno(
    var perfil: PerfilDueno = PerfilDueno("", "", "", ""),
    val mascotas: MutableList<Mascota> = mutableListOf(),
    val eventos: MutableList<EventoMascota> = mutableListOf(),
    val autorizados: MutableList<VeterinarioAcceso> = mutableListOf(),
    val disponibles: MutableList<VeterinarioAcceso> = mutableListOf(),
    val solicitudes: MutableList<SolicitudItem> = mutableListOf(),
    val notificaciones: MutableList<NotificacionDueno> = mutableListOf(),
    var accesos: List<AccesoDto> = emptyList(),
    var veterinarios: Map<String, PerfilDto> = emptyMap()
)

/**
 * Datos del dueño en sesión. Guarda una copia en memoria de lo que dice el servidor para que las pantallas
 * lean sin esperar, y manda cada cambio a Supabase en segundo plano. Lo que el servidor genera solo (accesos
 * por turno, avisos) se vuelve a pedir después de cada cambio.
 */
object DuenoRepo {

    const val CATEGORIA_VACUNA = "Vacuna"

    /** Duración de cada turno; coincide con la franja que controla la base de datos. */
    const val DURACION_TURNO_MIN = 30

    private var estado = EstadoDueno()

    val perfil: PerfilDueno get() = estado.perfil
    val mascotas: MutableList<Mascota> get() = estado.mascotas
    val eventos: MutableList<EventoMascota> get() = estado.eventos
    val autorizados: MutableList<VeterinarioAcceso> get() = estado.autorizados
    val disponibles: MutableList<VeterinarioAcceso> get() = estado.disponibles
    val solicitudes: MutableList<SolicitudItem> get() = estado.solicitudes
    val notificaciones: List<NotificacionDueno> get() = estado.notificaciones
    val hayNotificacionesSinLeer: Boolean get() = estado.notificaciones.any { !it.leida }

    // ---------- Carga ----------

    fun limpiar() {
        estado = EstadoDueno()
    }

    /** Pide al servidor todo lo del dueño y lo deja listo para las pantallas. */
    suspend fun cargar(perfilDto: PerfilDto) = coroutineScope {
        val f = Servicios.fuente
        val mascotasDto = async { f.misMascotas() }
        val turnosDto = async { f.turnos() }
        val catalogo = async { f.catalogoVeterinarios() }
        val accesosDto = async { f.accesos() }
        val avisos = async { f.notificaciones() }

        val nuevo = EstadoDueno(perfil = aPerfil(perfilDto))
        nuevo.mascotas.addAll(mascotasDto.await().map(::aMascota))
        nuevo.veterinarios = catalogo.await().associateBy { it.id }
        nuevo.accesos = accesosDto.await()
        nuevo.eventos.addAll(turnosDto.await().filter { t -> t.estado != "cancelado" && nuevo.mascotas.any { it.id == t.mascotaId } }.map { aEvento(it, nuevo) })
        val avisosDelServidor = avisos.await()
        nuevo.notificaciones.addAll(avisosDelServidor.map(::aNotificacion))
        reconstruirVeterinarios(nuevo)
        estado = nuevo
        // Al iniciar sesión lo que ya estaba no suena; solo se programan los recordatorios de los próximos turnos
        Servicios.contextoApp?.let {
            runCatching { AvisosDelSistema.mostrarNuevas(it, avisosDelServidor, silencioso = true) }
            Recordatorios.programar(it, Recordatorios.paraDueno(nuevo.eventos))
        }
    }

    /** Vuelve a pedir lo que el servidor modifica por su cuenta (accesos, avisos) y avisa a la pantalla. */
    suspend fun recargarDerivados() {
        val f = Servicios.fuente
        val actual = estado
        val accesos = f.accesos()
        val catalogo = f.catalogoVeterinarios()
        val avisos = f.notificaciones()
        val turnos = f.turnos()
        actual.accesos = accesos
        actual.veterinarios = catalogo.associateBy { it.id }
        reconstruirVeterinarios(actual)
        actual.eventos.clear()
        actual.eventos.addAll(turnos.filter { t -> t.estado != "cancelado" && actual.mascotas.any { it.id == t.mascotaId } }.map { aEvento(it, actual) })
        actual.notificaciones.clear()
        actual.notificaciones.addAll(avisos.map(::aNotificacion))
        Servicios.contextoApp?.let {
            runCatching { AvisosDelSistema.mostrarNuevas(it, avisos) }
            Recordatorios.programar(it, Recordatorios.paraDueno(actual.eventos))
        }
        Servicios.avisarCambio()
    }

    /** Descarta la copia local y vuelve a pedir todo; se usa cuando el servidor rechazó un cambio. */
    suspend fun recargarTodo() {
        val perfilDto = Servicios.fuente.miPerfil()
        cargar(perfilDto)
        Servicios.avisarCambio()
    }

    private fun recargarAlTerminar(): suspend () -> Unit = { recargarDerivados() }
    private fun recargarSiFalla(): suspend () -> Unit = { recargarTodo() }

    // ---------- Conversión de filas ----------

    private fun aPerfil(p: PerfilDto): PerfilDueno {
        val ajuste = p.fotoAjuste
        return PerfilDueno(
            nombre = p.nombre, email = p.email, telefono = p.telefono.orEmpty(), direccion = p.direccion.orEmpty(),
            dni = p.privados?.dni.orEmpty(), fotoPath = p.fotoPath,
            ajusteFoto = AjusteFoto.entries.firstOrNull { it.name == ajuste?.get("ajuste")?.jsonPrimitive?.content }
                ?: AjusteFoto.LLENAR,
            desplazamientoFotoX = ajuste?.get("x")?.jsonPrimitive?.doubleOrNull?.toFloat() ?: 0f,
            desplazamientoFotoY = ajuste?.get("y")?.jsonPrimitive?.doubleOrNull?.toFloat() ?: 0f
        )
    }

    private fun aMascota(m: MascotaDto) = Mascota(
        nombre = m.nombre, tipo = m.tipo, raza = m.raza.orEmpty(),
        nacimiento = m.nacimiento?.let { runCatching { LocalDate.parse(it) }.getOrNull() },
        sexo = Sexo.deTexto(m.sexo), fotoPath = m.fotoPath, id = m.id,
        peso = textoDePeso(m.pesoKg), microchip = m.microchip?.takeIf { it.isNotBlank() } ?: SIN_DATOS,
        color = m.color?.takeIf { it.isNotBlank() } ?: SIN_DATOS,
        observaciones = m.observaciones?.takeIf { it.isNotBlank() } ?: "Sin observaciones"
    )

    private fun aEvento(t: TurnoDto, e: EstadoDueno): EventoMascota {
        val mascota = e.mascotas.firstOrNull { it.id == t.mascotaId }?.nombre.orEmpty()
        return EventoMascota(
            categoria = t.categoria, mascota = mascota, veterinario = t.veterinarioId?.let { nombreVeterinario(e, it) }.orEmpty(),
            hora = t.hora.take(5), observaciones = t.notas.orEmpty(), fecha = LocalDate.parse(t.fecha),
            id = t.id, mascotaId = t.mascotaId, veterinarioId = t.veterinarioId,
            estado = if (t.estado == "completado") EstadoTurno.COMPLETADO else EstadoTurno.PENDIENTE
        )
    }

    private fun aNotificacion(n: NotificacionDto) = NotificacionDueno(
        tipo = TipoNotificacion.deClave(n.tipo),
        titulo = n.titulo, mensaje = n.mensaje, creada = Fechas.instante(n.createdAt), leida = n.leida
    )

    private fun nombreVeterinario(e: EstadoDueno, id: String) = e.veterinarios[id]?.nombre.orEmpty()

    private fun aVeterinario(p: PerfilDto, estadoAcceso: EstadoAcceso, mascotas: Collection<String>): VeterinarioAcceso {
        val datos = p.veterinarios
        return VeterinarioAcceso(
            nombre = p.nombre, usuario = "@" + p.email.substringBefore('@'), email = p.email,
            matricula = datos?.matricula.orEmpty(),
            especialidad = datos?.especialidades.orEmpty().take(2).joinToString(", ").ifBlank { "Chequeo médico integral" },
            estado = estadoAcceso, mascotas = mascotas, id = p.id, fotoPath = p.fotoPath,
            especialidades = datos?.especialidades.orEmpty(),
            diasAtencion = datos?.diasAtencion.orEmpty().toSet(),
            apertura = (datos?.horaApertura ?: "09:00").take(5), cierre = (datos?.horaCierre ?: "18:00").take(5)
        )
    }

    /**
     * Arma las listas de veterinarios y de solicitudes a partir de los accesos del servidor:
     * quien pidió acceso y todavía no fue aceptado aparece como solicitud; quien tiene al menos un acceso
     * activo o pendiente (iniciado por el dueño) como veterinario autorizado; el resto, como disponible.
     */
    private fun reconstruirVeterinarios(e: EstadoDueno) {
        val nombrePorMascota = e.mascotas.associate { it.id to it.nombre }
        val accesos = e.accesos.filter { it.mascotaId in nombrePorMascota }
        e.autorizados.clear()
        e.disponibles.clear()
        e.solicitudes.clear()

        val porVeterinario = accesos.groupBy { it.veterinarioId }
        for ((vetId, lista) in porVeterinario) {
            val perfilVet = e.veterinarios[vetId]?.takeIf { it.estado == "activo" } ?: continue
            for (a in lista.filter { it.estado == "pendiente" && it.iniciadoPor == "veterinario" }) {
                e.solicitudes.add(
                    SolicitudItem(
                        id = a.id, solicitante = perfilVet.nombre,
                        mascota = "Solicita acceso a ${nombrePorMascota[a.mascotaId]}",
                        hace = Fechas.haceTexto(a.createdAt), fotoPath = perfilVet.fotoPath
                    )
                )
            }
            val propios = lista.filterNot { it.estado == "pendiente" && it.iniciadoPor == "veterinario" }
            if (propios.isEmpty()) continue
            val estadoAcceso = when {
                propios.any { it.estado == "activo" } -> EstadoAcceso.ACTIVO
                propios.any { it.estado == "pendiente" } -> EstadoAcceso.PENDIENTE
                else -> EstadoAcceso.INACTIVO
            }
            val conAcceso = propios.filter { it.estado == "activo" || it.estado == "pendiente" }
                .mapNotNull { nombrePorMascota[it.mascotaId] }
            e.autorizados.add(aVeterinario(perfilVet, estadoAcceso, conAcceso))
        }
        val yaListados = porVeterinario.keys
        e.veterinarios.values.filter { it.id !in yaListados && it.estado == "activo" }.forEach {
            e.disponibles.add(aVeterinario(it, EstadoAcceso.DISPONIBLE, emptyList()))
        }
    }

    // ---------- Perfil ----------

    /** Guarda los datos editables del perfil (el correo es el de la cuenta y no se cambia desde acá). */
    fun guardarPerfil(nombre: String, telefono: String, direccion: String) {
        perfil.nombre = nombre
        perfil.telefono = telefono
        perfil.direccion = direccion
        Servicios.escribir(alFallar = recargarSiFalla()) {
            Servicios.fuente.actualizarPerfil(buildJsonObject {
                put("nombre", nombre)
                put("telefono", telefono.ifBlank { null })
                put("direccion", direccion.ifBlank { null })
            })
        }
    }

    /** Guarda cómo se acomoda la foto dentro del círculo del perfil. */
    fun guardarAjusteFoto() {
        val p = perfil
        Servicios.escribir {
            Servicios.fuente.actualizarPerfil(buildJsonObject {
                put("foto_ajuste", buildJsonObject {
                    put("ajuste", p.ajusteFoto.name)
                    put("x", p.desplazamientoFotoX)
                    put("y", p.desplazamientoFotoY)
                })
            })
        }
    }

    /** Sube la foto de perfil elegida y la guarda en el perfil. */
    fun cambiarFotoPerfil(uri: Uri) {
        val p = perfil
        val anterior = p.fotoPath
        p.fotoUri = uri
        Servicios.escribir {
            val usuario = Sesion.usuarioId ?: return@escribir
            val ruta = Imagenes.subirFoto(Imagenes.prepararFoto(uri), usuario)
            Servicios.fuente.actualizarPerfil(buildJsonObject {
                put("foto_path", ruta)
                put("foto_ajuste", buildJsonObject {
                    put("ajuste", p.ajusteFoto.name)
                    put("x", p.desplazamientoFotoX)
                    put("y", p.desplazamientoFotoY)
                })
            })
            p.fotoPath = ruta
            Imagenes.borrarFoto(anterior)
        }
    }

    // ---------- Mascotas ----------

    fun buscarMascota(nombre: String?): Mascota? = mascotas.firstOrNull { it.nombre == nombre }

    fun agregarMascota(mascota: Mascota) {
        mascotas.add(mascota)
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            val usuario = Sesion.usuarioId ?: error("No hay una sesión iniciada")
            val ruta = mascota.fotoUri?.let { Imagenes.subirFoto(Imagenes.prepararFoto(it), usuario) }
            mascota.fotoPath = ruta ?: mascota.fotoPath
            Servicios.fuente.crearMascota(
                NuevaMascotaDto(
                    id = mascota.id, duenoId = usuario, nombre = mascota.nombre, tipo = mascota.tipo,
                    raza = mascota.raza.ifBlank { null }, nacimiento = mascota.nacimiento?.toString(),
                    sexo = mascota.sexo?.name?.lowercase(), pesoKg = pesoDeTexto(mascota.peso),
                    microchip = mascota.microchip.takeIf { it != SIN_DATOS }, color = mascota.color.takeIf { it != SIN_DATOS },
                    observaciones = mascota.observaciones.takeIf { it != "Sin observaciones" }, fotoPath = ruta
                )
            )
        }
    }

    /** El peso se escribe en kilos ("12", "3,5" o "12 kg") y tiene que ser mayor que cero. */
    fun pesoValido(texto: String): Boolean = (pesoDeTexto(texto) ?: 0.0) > 0.0

    /** Guarda los datos editados de una mascota. */
    fun guardarMascota(m: Mascota) {
        eventos.filter { it.mascotaId == m.id }.forEach { it.mascota = m.nombre }
        Servicios.escribir(alFallar = recargarSiFalla()) {
            Servicios.fuente.actualizarMascota(m.id, buildJsonObject {
                put("nombre", m.nombre)
                put("raza", m.raza.ifBlank { null })
                put("nacimiento", m.nacimiento?.toString())
                put("sexo", m.sexo?.name?.lowercase())
                put("peso_kg", pesoDeTexto(m.peso))
                put("microchip", m.microchip.takeIf { it != SIN_DATOS })
                put("color", m.color.takeIf { it != SIN_DATOS })
                put("observaciones", m.observaciones.takeIf { it != "Sin observaciones" })
            })
        }
    }

    fun cambiarFotoMascota(m: Mascota, uri: Uri) {
        val anterior = m.fotoPath
        m.fotoUri = uri
        Servicios.escribir {
            val usuario = Sesion.usuarioId ?: return@escribir
            val ruta = Imagenes.subirFoto(Imagenes.prepararFoto(uri), usuario)
            Servicios.fuente.actualizarMascota(m.id, buildJsonObject { put("foto_path", ruta) })
            m.fotoPath = ruta
            Imagenes.borrarFoto(anterior)
        }
    }

    fun darDeBajaMascota(mascota: Mascota) {
        mascotas.remove(mascota)
        // Los turnos que le quedaban se cancelan para que no queden colgados en la agenda del veterinario
        val turnos = eventos.filter { it.mascotaId == mascota.id }.map { it.id }
        eventos.removeAll { it.mascotaId == mascota.id }
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            turnos.forEach { Servicios.fuente.actualizarTurno(it, buildJsonObject { put("estado", "cancelado") }) }
            Servicios.fuente.actualizarMascota(mascota.id, buildJsonObject { put("activa", false) })
            Imagenes.borrarFoto(mascota.fotoPath)
        }
    }

    /** Estado de salud que se muestra en las tarjetas: hay una vacuna agendada en los próximos 30 días. */
    fun tieneVacunaPendiente(mascota: String): Boolean {
        val hoy = LocalDate.now()
        val limite = hoy.plusDays(30)
        return eventos.any {
            it.vigente(hoy) && !it.fecha.isAfter(limite) &&
                it.mascota.equals(mascota, ignoreCase = true) && it.categoria.contains("vacuna", ignoreCase = true)
        }
    }

    // ---------- Eventos ----------

    fun eventosDelDia(fecha: LocalDate): List<EventoMascota> =
        eventos.filter { it.fecha == fecha }.sortedBy { it.hora }

    fun cantidadDelMes(mes: java.time.YearMonth): Int =
        eventos.count { java.time.YearMonth.from(it.fecha) == mes }

    /** Un turno sigue "próximo" mientras no pasó su fecha y el veterinario no lo marcó como completado. */
    private fun EventoMascota.vigente(hoy: LocalDate) = estado != EstadoTurno.COMPLETADO && !fecha.isBefore(hoy)

    /** Eventos próximos o ya realizados, del más cercano al más lejano; opcionalmente de una sola mascota. */
    fun eventosOrdenados(proximos: Boolean, mascota: String? = null): List<EventoMascota> {
        val hoy = LocalDate.now()
        val lista = eventos
            .filter { it.vigente(hoy) == proximos }
            .filter { mascota == null || it.mascota.equals(mascota, ignoreCase = true) }
            .sortedWith(compareBy<EventoMascota>({ it.fecha }, { it.hora }))
        return if (proximos) lista else lista.reversed()
    }

    fun actividadReciente(): List<EventoMascota> {
        val hoy = LocalDate.now()
        val desde = hoy.minusDays(30)
        return eventos
            .filter { (it.estado == EstadoTurno.COMPLETADO || !it.fecha.isAfter(hoy)) && !it.fecha.isBefore(desde) }
            .sortedWith(compareBy<EventoMascota>({ it.fecha }, { it.hora }))
            .reversed()
    }

    fun proximoEvento(mascota: String): EventoMascota? {
        val hoy = LocalDate.now()
        return eventos
            .filter { it.vigente(hoy) && it.mascota.equals(mascota, ignoreCase = true) }
            .minWithOrNull(compareBy<EventoMascota>({ it.fecha }, { it.hora }))
    }

    /** Un turno se puede editar o cancelar solo si es próximo: no está completado y todavía no llegó su hora. */
    fun esEditable(evento: EventoMascota): Boolean =
        evento.estado != EstadoTurno.COMPLETADO && evento.estado != EstadoTurno.CANCELADO &&
            !evento.fecha.isBefore(LocalDate.now()) && !horaPasada(evento.fecha, evento.hora)

    /** Los turnos próximos que se pueden editar, del más cercano al más lejano; opcionalmente de una sola mascota. */
    fun eventosEditables(mascota: String? = null): List<EventoMascota> =
        eventos.filter { esEditable(it) && (mascota == null || it.mascota.equals(mascota, ignoreCase = true)) }
            .sortedWith(compareBy<EventoMascota>({ it.fecha }, { it.hora }))

    fun eventosDeMascota(nombre: String?): List<EventoMascota> =
        eventos.filter { nombre == null || it.mascota == nombre }

    fun horaPasada(fecha: LocalDate, hora: String): Boolean {
        if (fecha != LocalDate.now()) return false
        return runCatching { LocalTime.parse(hora).isBefore(LocalTime.now()) }.getOrDefault(false)
    }

    /**
     * Veterinarios que ofrecen el servicio o la especialidad elegida. Sin elección (null) se ofrecen todos.
     */
    fun veterinariosPara(servicio: String?): List<VeterinarioAcceso> {
        val todos = todosLosVeterinarios()
        if (servicio == null) return todos
        return todos.filter { vet -> vet.especialidades.any { it.equals(servicio, ignoreCase = true) } }
    }

    fun trabajaEl(vet: VeterinarioAcceso, fecha: LocalDate): Boolean = fecha.dayOfWeek.value in vet.diasAtencion

    /** Horarios de turno ("HH:mm") que el veterinario ofrece ese día, uno cada [DURACION_TURNO_MIN] minutos. */
    fun horasDe(vet: VeterinarioAcceso, fecha: LocalDate): List<String> {
        if (!trabajaEl(vet, fecha)) return emptyList()
        fun minutos(hora: String) = hora.substringBefore(':').toInt() * 60 + hora.substringAfter(':').toInt()
        val horas = mutableListOf<String>()
        var t = minutos(vet.apertura)
        val fin = minutos(vet.cierre)
        while (t + DURACION_TURNO_MIN <= fin) {
            horas.add("%02d:%02d".format(t / 60, t % 60))
            t += DURACION_TURNO_MIN
        }
        return horas
    }

    /** Horarios en los que el veterinario ya tiene otro turno ese día (la lista de turnos ajenos no es visible). */
    suspend fun horasOcupadas(vet: VeterinarioAcceso, fecha: LocalDate): Set<String> =
        Servicios.fuente.horariosOcupados(vet.id, fecha.toString()).toSet()

    /** [ignorar] es el turno que se está editando: no choca consigo mismo. */
    fun hayConflictoDeTurno(fecha: LocalDate, hora: String, mascota: String?, ignorar: EventoMascota? = null): Boolean =
        mascota != null && eventos.any {
            it !== ignorar && it.id != ignorar?.id && it.fecha == fecha && it.hora == hora &&
                it.mascota.equals(mascota, ignoreCase = true)
        }

    /** Un estudio anterior (ya guardado en la ficha) que el dueño adjunta a un turno. */
    class EstudioAdjunto(val nombre: String, val extension: String, val ruta: String, val tipo: String = TIPO_GENERICO)

    /** Clases de estudio que se pueden indicar al adjuntar un documento médico a un turno. */
    val TIPOS_ESTUDIO = listOf(
        "Radiografía", "Análisis de sangre", "Ecografía", "Análisis de orina", "Electrocardiograma",
        "Receta o indicaciones", "Informe médico", "Otro estudio"
    )
    private const val TIPO_GENERICO = "Estudio"

    /** Documentos y archivos que ya tiene cargados la mascota, para elegir uno al sacar un turno. */
    suspend fun estudiosDisponibles(mascota: Mascota): List<EstudioAdjunto> = coroutineScope {
        val f = Servicios.fuente
        val registros = async { runCatching { f.registrosSalud() }.getOrDefault(emptyList()) }
        val archivos = async { runCatching { f.archivosDe(mascota.id) }.getOrDefault(emptyList()) }
        val deCarnet = registros.await()
            .filter { it.mascotaId == mascota.id && it.tipo == "documento" && !it.archivoPath.isNullOrBlank() }
            .map { EstudioAdjunto(it.titulo, it.archivoPath!!.substringAfterLast('.', "pdf"), it.archivoPath) }
        val sueltos = archivos.await().map { EstudioAdjunto(it.nombre, it.extension, it.storagePath) }
        (deCarnet + sueltos).distinctBy { it.ruta }
    }

    /** Sube un estudio nuevo a la ficha de la mascota y devuelve el adjunto listo para el turno. */
    suspend fun subirEstudio(
        mascota: Mascota, tipo: String, nombre: String, extension: String, bytes: ByteArray, tipoMime: String
    ): EstudioAdjunto {
        // En la ficha queda con el tipo adelante ("Radiografía - tórax") para encontrarlo fácil en Documentos
        val nombreVisible = "$tipo - ${nombre.substringBeforeLast('.')}"
        val item = frgp.utn.edu.petcare.ArchivosRepo.agregar(mascota.id, nombreVisible, extension, bytes, tipoMime)
        return EstudioAdjunto(item.nombre, item.tipoExtension.lowercase(), item.storagePath, tipo)
    }

    /** Agenda el turno. El servidor valida el horario del veterinario y le da acceso a la mascota. */
    fun agendarEvento(
        fecha: LocalDate, categoria: String, mascota: String, veterinario: String, hora: String, observaciones: String,
        estudios: List<EstudioAdjunto> = emptyList()
    ) {
        val m = buscarMascota(mascota) ?: return
        val vet = buscarVeterinario(veterinario)
        val evento = EventoMascota(
            categoria, mascota, veterinario, hora, observaciones, fecha,
            mascotaId = m.id, veterinarioId = vet?.id?.ifBlank { null }
        )
        eventos.add(evento)
        if (vet != null && veterinario.isNotEmpty()) autorizarPorTurno(veterinario, mascota, true)
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            val usuario = Sesion.usuarioId ?: error("No hay una sesión iniciada")
            Servicios.fuente.crearTurno(
                NuevoTurnoDto(
                    id = evento.id, mascotaId = m.id, veterinarioId = evento.veterinarioId, categoria = categoria,
                    fecha = fecha.toString(), hora = "$hora:00", notas = observaciones.ifBlank { null }, creadoPor = usuario
                )
            )
            // Los estudios se enlazan después de crear el turno, que es de lo que dependen
            if (estudios.isNotEmpty()) {
                Servicios.fuente.adjuntarEstudios(
                    estudios.map {
                        NuevoEstudioTurnoDto(
                            turnoId = evento.id, storagePath = it.ruta, nombre = it.nombre,
                            extension = it.extension, tipo = it.tipo, adjuntadoPor = usuario
                        )
                    }
                )
            }
        }
    }

    fun cancelarEvento(evento: EventoMascota) {
        eventos.remove(evento)
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            Servicios.fuente.actualizarTurno(evento.id, buildJsonObject { put("estado", "cancelado") })
        }
    }

    fun modificarEvento(
        evento: EventoMascota, fecha: LocalDate, hora: String, veterinario: String, observaciones: String
    ) {
        val vet = buscarVeterinario(veterinario)
        evento.fecha = fecha
        evento.hora = hora
        evento.veterinario = veterinario
        evento.veterinarioId = vet?.id?.ifBlank { null }
        evento.observaciones = observaciones
        if (veterinario.isNotEmpty()) autorizarPorTurno(veterinario, evento.mascota, true)
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            Servicios.fuente.actualizarTurno(evento.id, buildJsonObject {
                put("fecha", fecha.toString())
                put("hora", "$hora:00")
                put("veterinario_id", evento.veterinarioId)
                put("notas", observaciones.ifBlank { null })
            })
        }
    }

    // ---------- Veterinarios y accesos ----------

    fun todosLosVeterinarios(): List<VeterinarioAcceso> = autorizados + disponibles

    fun buscarVeterinario(nombre: String?): VeterinarioAcceso? {
        if (nombre.isNullOrBlank()) return null
        return todosLosVeterinarios().firstOrNull { it.nombre.equals(nombre.trim(), ignoreCase = true) }
    }

    fun tieneTurnoCon(veterinario: String, mascota: String): Boolean =
        eventos.any { it.veterinario.equals(veterinario, ignoreCase = true) && it.mascota.equals(mascota, ignoreCase = true) }

    /**
     * Tener un turno con el veterinario alcanza para que vea la ficha de la mascota: el servidor crea el acceso
     * al agendar. Acá solo se refleja en pantalla. Devuelve true si el veterinario pasó a tener acceso ahora.
     */
    fun autorizarPorTurno(nombreVet: String, mascota: String, reactivar: Boolean): Boolean {
        val vet = buscarVeterinario(nombreVet) ?: return false
        if (vet.estado == EstadoAcceso.INACTIVO && !reactivar) return false
        val teniaAcceso = vet.estado == EstadoAcceso.ACTIVO && mascota in vet.mascotas
        disponibles.remove(vet)
        if (vet !in autorizados) autorizados.add(vet)
        vet.estado = EstadoAcceso.ACTIVO
        vet.mascotas.add(mascota)
        return !teniaAcceso
    }

    fun turnosDeVeterinario(vet: VeterinarioAcceso): Int =
        eventos.count { it.veterinario.equals(vet.nombre, ignoreCase = true) }

    fun proximoTurnoDeVeterinario(vet: VeterinarioAcceso): EventoMascota? {
        val hoy = LocalDate.now()
        return eventos
            .filter { it.vigente(hoy) && it.veterinario.equals(vet.nombre, ignoreCase = true) }
            .minByOrNull { it.fecha }
    }

    fun revocarAcceso(vet: VeterinarioAcceso) {
        vet.estado = EstadoAcceso.INACTIVO
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            Servicios.fuente.actualizarAccesosDeVeterinario(vet.id, "inactivo")
        }
    }

    fun restablecerAcceso(vet: VeterinarioAcceso) {
        vet.estado = EstadoAcceso.ACTIVO
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            Servicios.fuente.actualizarAccesosDeVeterinario(vet.id, "activo")
        }
    }

    /** Autoriza a un veterinario del catálogo para que vea todas las mascotas actuales. */
    fun autorizarVeterinario(candidato: VeterinarioAcceso) {
        val existente = autorizados.firstOrNull { it.id == candidato.id }
        if (existente != null) {
            existente.estado = EstadoAcceso.ACTIVO
        } else {
            disponibles.remove(candidato)
            candidato.estado = EstadoAcceso.ACTIVO
            candidato.mascotas.addAll(mascotas.map { it.nombre })
            autorizados.add(candidato)
        }
        val ids = mascotas.map { it.id }
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            Servicios.fuente.compartirMascotas(ids, candidato.id)
        }
    }

    /** Veterinarios que todavía se pueden autorizar. */
    fun candidatosAAutorizar(consulta: String): List<VeterinarioAcceso> {
        val q = consulta.trim().lowercase()
        return disponibles.filter { vet ->
            val yaAutorizado = autorizados.any { it.id == vet.id && it.estado != EstadoAcceso.INACTIVO }
            !yaAutorizado && (q.isEmpty() || listOf(vet.nombre, vet.usuario, vet.email, vet.matricula).any { it.lowercase().contains(q) })
        }
    }

    // ---------- Solicitudes de acceso ----------

    /** El dueño acepta o rechaza el pedido de un veterinario para ver una mascota. */
    fun resolverSolicitud(item: SolicitudItem, aceptar: Boolean) {
        item.estado = if (aceptar) SolicitudItem.Estado.ACEPTADA else SolicitudItem.Estado.RECHAZADA
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            Servicios.fuente.actualizarAcceso(item.id, if (aceptar) "activo" else "rechazado")
        }
    }

    /** Un archivo que el veterinario subió a la ficha durante el turno. */
    class ArchivoDeTurno(val nombre: String, val extension: String, val ruta: String, val tipo: String = "")

    /** Lo que dejó el veterinario en un turno: informe, vacunas o tratamientos cargados y archivos adjuntos. */
    class DetalleTurno(
        val motivo: String,
        val diagnostico: String,
        val tratamiento: String,
        val registros: List<String>,
        val archivos: List<ArchivoDeTurno>,
        /** Estudios anteriores que el propio dueño adjuntó al sacar el turno. */
        val estudios: List<ArchivoDeTurno> = emptyList()
    ) {
        val vacio: Boolean
            get() = motivo.isBlank() && diagnostico.isBlank() && tratamiento.isBlank() && registros.isEmpty() &&
                archivos.isEmpty() && estudios.isEmpty()
    }

    /**
     * Arma el detalle de un turno para el dueño, que puede leerlo pero no editarlo. Los archivos son los que el
     * veterinario adjuntó al informe de ese turno; los registros de salud se asocian por veterinario y día.
     */
    suspend fun detalleDelTurno(evento: EventoMascota): DetalleTurno = coroutineScope {
        val f = Servicios.fuente
        val informes = async { f.informesDe(evento.mascotaId) }
        val registros = async { f.registrosSalud() }
        val archivos = async { f.archivosDe(evento.mascotaId) }
        val estudios = async { runCatching { f.estudiosDeTurno(evento.id) }.getOrDefault(emptyList()) }

        val informe = informes.await().firstOrNull { it.turnoId == evento.id }
        val vet = evento.veterinarioId
        val dia = evento.fecha.toString()
        val delTurno = registros.await()
            .filter { it.mascotaId == evento.mascotaId && it.fecha == dia && (vet == null || it.creadoPor == vet) }
            .map {
                val tipo = when (it.tipo) {
                    "vacuna" -> "Vacuna"
                    "tratamiento" -> "Tratamiento"
                    else -> "Documento"
                }
                "$tipo: ${it.titulo}"
            }
        // Los archivos de la consulta son los que adjuntó el veterinario al informe, no los que subió el dueño
        val adjuntos = archivos.await()
            .filter { it.turnoId == evento.id && (vet == null || it.subidoPor == vet) }
            .map { ArchivoDeTurno(nombreConExtension(it.nombre, it.extension), it.extension, it.storagePath) }
        DetalleTurno(
            motivo = informe?.motivo.orEmpty(), diagnostico = informe?.diagnostico.orEmpty(),
            tratamiento = informe?.tratamiento.orEmpty(), registros = delTurno, archivos = adjuntos,
            estudios = estudios.await().map { ArchivoDeTurno(it.nombre, it.extension, it.storagePath, it.tipo) }
        )
    }

    private fun nombreConExtension(nombre: String, extension: String) =
        if (nombre.endsWith(".$extension", ignoreCase = true)) nombre else "$nombre.$extension"

    // ---------- Notificaciones ----------

    fun marcarNotificacionesLeidas() {
        if (estado.notificaciones.none { !it.leida }) return
        estado.notificaciones.forEach { it.leida = true }
        Servicios.escribir { Servicios.fuente.marcarNotificacionesLeidas() }
    }

    fun limpiarNotificaciones() {
        estado.notificaciones.clear()
        Servicios.escribir { Servicios.fuente.borrarNotificaciones() }
    }

    // ---------- Utilidades ----------

    private fun pesoDeTexto(texto: String): Double? =
        Regex("(\\d+(?:[.,]\\d+)?)").find(texto)?.groupValues?.get(1)?.replace(',', '.')?.toDoubleOrNull()

    private fun textoDePeso(kg: Double?): String = when {
        kg == null -> SIN_DATOS
        kg % 1.0 == 0.0 -> "${kg.toInt()} kg"
        else -> "$kg kg"
    }
}

private fun JsonObject.getOrNull(clave: String) = this[clave]?.takeIf { it !is JsonNull }

@Suppress("unused")
private fun jsonDe(valor: String?) = if (valor == null) JsonNull else JsonPrimitive(valor)
