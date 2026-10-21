package frgp.utn.edu.petcare.data.repositorio

import android.net.Uri
import frgp.utn.edu.petcare.data.avisos.AvisosDelSistema
import frgp.utn.edu.petcare.data.avisos.Recordatorios
import frgp.utn.edu.petcare.data.CatalogoMedico
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.data.remoto.atiendeComoVeterinario
import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.data.remoto.HoraOcupadaDto
import frgp.utn.edu.petcare.data.remoto.MascotaDto
import frgp.utn.edu.petcare.data.remoto.NotificacionDto
import frgp.utn.edu.petcare.data.remoto.NuevaMascotaDto
import frgp.utn.edu.petcare.data.remoto.NuevoEstudioTurnoDto
import frgp.utn.edu.petcare.data.remoto.NuevoTurnoDto
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import frgp.utn.edu.petcare.data.remoto.PrescripcionDto
import frgp.utn.edu.petcare.data.remoto.RegistroSaludDto
import frgp.utn.edu.petcare.data.remoto.TurnoDto
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.model.AjusteFoto
import frgp.utn.edu.petcare.model.EstadoAcceso
import frgp.utn.edu.petcare.model.EstadoMascota
import frgp.utn.edu.petcare.model.EstadoTurno
import frgp.utn.edu.petcare.model.EventoMascota
import frgp.utn.edu.petcare.model.Mascota
import frgp.utn.edu.petcare.model.NotificacionDueno
import frgp.utn.edu.petcare.model.PerfilDueno
import frgp.utn.edu.petcare.model.SedeVet
import frgp.utn.edu.petcare.model.Prescripcion
import frgp.utn.edu.petcare.model.Sexo
import frgp.utn.edu.petcare.model.SignosVitales
import frgp.utn.edu.petcare.model.SIN_DATOS
import frgp.utn.edu.petcare.model.TipoNotificacion
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.model.VeterinarioAcceso
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate
import java.time.LocalTime
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.put

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
    var veterinarios: Map<String, PerfilDto> = emptyMap(),
    /** Vacunas y recetas de sus mascotas: de acá salen los recordatorios de próxima dosis y de medicación. */
    var salud: List<RegistroSaludDto> = emptyList(),
    var recetas: List<PrescripcionDto> = emptyList(),
    var ultimaCargaSalud: Long = 0
)

/**
 * Datos del dueño en sesión. Guarda una copia en memoria de lo que dice el servidor para que las pantallas
 * lean sin esperar, y manda cada cambio a Supabase en segundo plano. Lo que el servidor genera solo (accesos
 * por turno, avisos) se vuelve a pedir después de cada cambio.
 */
object DuenoRepo {

    const val CATEGORIA_VACUNA = "Vacuna"

    /** Cada cuántos minutos arrancan los horarios que se ofrecen (la duración de cada turno es aparte). */
    const val PASO_HORARIOS_MIN = 30

    private var estado = EstadoDueno()

    val perfil: PerfilDueno get() = estado.perfil
    val mascotas: MutableList<Mascota> get() = estado.mascotas
    val eventos: MutableList<EventoMascota> get() = estado.eventos
    val autorizados: MutableList<VeterinarioAcceso> get() = estado.autorizados
    val disponibles: MutableList<VeterinarioAcceso> get() = estado.disponibles
    val solicitudes: MutableList<SolicitudItem> get() = estado.solicitudes
    val notificaciones: List<NotificacionDueno> get() = estado.notificaciones
    val hayNotificacionesSinLeer: Boolean get() = estado.notificaciones.any { !it.leida }
    val notificacionesSinLeer: Int get() = estado.notificaciones.count { !it.leida }

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
        runCatching { RecordatoriosRepo.cargar() }
        cargarSalud(nuevo, forzar = true)
        // Al iniciar sesión lo que ya estaba no suena; solo se programan los recordatorios de lo que viene
        Servicios.contextoApp?.let {
            runCatching { AvisosDelSistema.mostrarNuevas(it, avisosDelServidor, silencioso = true) }
            programarAvisos(it, nuevo)
        }
    }

    /**
     * Pone al día lo que el veterinario puede cambiar de una mascota (peso y alertas) sin tocar lo demás, que el
     * dueño edita y puede tener cambios pendientes de guardar.
     */
    private fun actualizarDatosClinicos(e: EstadoDueno, desdeElServidor: List<MascotaDto>) {
        for (dto in desdeElServidor) {
            val propia = e.mascotas.firstOrNull { it.id == dto.id } ?: continue
            if (dto.pesoKg != null) propia.peso = textoDePeso(dto.pesoKg)
            propia.alertas = dto.alertasClinicas.orEmpty()
        }
    }

    /** Vacunas y recetas cambian poco: se piden al iniciar y después cada [INTERVALO_SALUD_MS]. */
    private suspend fun cargarSalud(e: EstadoDueno, forzar: Boolean) {
        val ahora = System.currentTimeMillis()
        if (!forzar && ahora - e.ultimaCargaSalud < INTERVALO_SALUD_MS) return
        val f = Servicios.fuente
        e.salud = runCatching { f.registrosSalud() }.getOrDefault(e.salud)
        e.recetas = runCatching { f.prescripciones() }.getOrDefault(e.recetas)
        e.ultimaCargaSalud = ahora
    }

    private const val INTERVALO_SALUD_MS = 5 * 60 * 1000L

    /** Turnos, próximas dosis de vacunas y tomas de medicación: todo lo que tiene que avisar el teléfono. */
    private fun programarAvisos(contexto: android.content.Context, e: EstadoDueno) {
        val ahora = java.time.LocalDateTime.now()
        val nombres = e.mascotas.associate { it.id to it.nombre }
        val vacunas = e.salud
            .filter { (it.tipo == "vacuna" || it.tipo == "desparasitacion") && it.mascotaId in nombres }
            .mapNotNull { r ->
                val proxima = r.proximaDosis?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return@mapNotNull null
                val clase = if (r.tipo == "vacuna") "vacuna" else "desparasitación"
                Recordatorios.VacunaProxima(r.id, nombres.getValue(r.mascotaId), r.titulo, proxima, clase)
            }
        val medicacion = e.recetas
            .filter { it.mascotaId in nombres }
            .mapNotNull { p ->
                val cada = p.frecuenciaHoras ?: return@mapNotNull null
                val dias = p.duracionDias ?: return@mapNotNull null
                val inicio = p.createdAt?.let { Fechas.instante(it) }
                    ?: runCatching { LocalDate.parse(p.inicio).atTime(9, 0) }.getOrNull()
                    ?: return@mapNotNull null
                Recordatorios.Medicacion(p.id, nombres.getValue(p.mascotaId), p.medicamento, p.dosis.orEmpty(), cada, inicio, dias)
            }
        val manuales = RecordatoriosRepo.lista.mapNotNull { r ->
            val mascota = nombres[r.mascotaId] ?: return@mapNotNull null
            Recordatorios.Manual(r.id, mascota, r.titulo, r.fecha, r.hora, r.nota)
        }
        val avisos = Recordatorios.paraDueno(e.eventos, ahora) +
            Recordatorios.paraVacunas(vacunas, ahora, AvisosDelSistema.vacunasAvisadas(contexto)) +
            Recordatorios.paraMedicacion(medicacion, ahora) +
            Recordatorios.paraManuales(manuales, ahora)
        Recordatorios.programar(contexto, avisos, ahora)
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
        // El veterinario actualiza el peso (y las alertas) de la mascota al guardar un informe
        runCatching { f.misMascotas() }.getOrNull()?.let { actualizarDatosClinicos(actual, it) }
        reconstruirVeterinarios(actual)
        actual.eventos.clear()
        actual.eventos.addAll(turnos.filter { t -> t.estado != "cancelado" && actual.mascotas.any { it.id == t.mascotaId } }.map { aEvento(it, actual) })
        actual.notificaciones.clear()
        actual.notificaciones.addAll(avisos.map(::aNotificacion))
        runCatching { RecordatoriosRepo.cargar() }
        cargarSalud(actual, forzar = false)
        Servicios.contextoApp?.let {
            runCatching { AvisosDelSistema.mostrarNuevas(it, avisos) }
            programarAvisos(it, actual)
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
            dni = p.privados?.dni.orEmpty(), fotoPath = p.fotoPath, debeCambiarPassword = p.debeCambiarPassword,
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
        observaciones = m.observaciones?.takeIf { it.isNotBlank() } ?: "Sin observaciones",
        alertas = m.alertasClinicas.orEmpty(), estado = EstadoMascota.deClave(m.estado)
    )

    private fun aEvento(t: TurnoDto, e: EstadoDueno): EventoMascota {
        val mascota = e.mascotas.firstOrNull { it.id == t.mascotaId }?.nombre.orEmpty()
        return EventoMascota(
            categoria = t.categoria, mascota = mascota, veterinario = t.veterinarioId?.let { nombreVeterinario(e, it) }.orEmpty(),
            hora = t.hora.take(5), observaciones = t.notas.orEmpty(), fecha = LocalDate.parse(t.fecha),
            id = t.id, mascotaId = t.mascotaId, veterinarioId = t.veterinarioId,
            estado = if (t.estado == "completado") EstadoTurno.COMPLETADO else EstadoTurno.PENDIENTE,
            duracionMin = t.duracionMin, sedeId = t.sedeId
        )
    }

    private fun aNotificacion(n: NotificacionDto) = NotificacionDueno(
        tipo = TipoNotificacion.deClave(n.tipo),
        titulo = n.titulo, mensaje = n.mensaje, creada = Fechas.instante(n.createdAt), leida = n.leida, id = n.id
    )

    private fun nombreVeterinario(e: EstadoDueno, id: String) = e.veterinarios[id]?.nombre.orEmpty()

    private fun aVeterinario(p: PerfilDto, estadoAcceso: EstadoAcceso, mascotas: Collection<String>): VeterinarioAcceso {
        val datos = p.veterinarios
        val sedes = datos?.lugares().orEmpty().map {
            SedeVet(
                id = it.id, nombre = it.nombre, direccion = it.direccion.orEmpty(), dias = it.diasAtencion.toSet(),
                apertura = it.horaApertura.take(5), cierre = it.horaCierre.take(5)
            )
        }
        val principal = sedes.firstOrNull()
        return VeterinarioAcceso(
            nombre = p.nombre, usuario = "@" + p.email.substringBefore('@'), email = p.email,
            matricula = datos?.matricula.orEmpty(),
            especialidad = datos?.especialidades.orEmpty().take(2).joinToString(", ").ifBlank { "Chequeo médico integral" },
            estado = estadoAcceso, mascotas = mascotas, id = p.id, fotoPath = p.fotoPath,
            especialidades = datos?.especialidades.orEmpty(),
            diasAtencion = principal?.dias ?: datos?.diasAtencion.orEmpty().toSet(),
            apertura = principal?.apertura ?: (datos?.horaApertura ?: "09:00").take(5),
            cierre = principal?.cierre ?: (datos?.horaCierre ?: "18:00").take(5),
            tiposAnimales = datos?.tiposAnimales?.map { TiposMascota.normalizar(it) }?.toSet()
                ?: TiposMascota.TODOS.toSet(),
            duraciones = datos?.duraciones.orEmpty(),
            sedes = sedes
        )
    }

    /**
     * Arma las listas de veterinarios y de solicitudes a partir de los accesos del servidor:
     * quien pidió acceso y todavía no fue aceptado aparece como solicitud; quien tiene al menos un acceso
     * activo o pendiente (iniciado por el dueño) como veterinario autorizado; el resto, como disponible.
     */
    private fun vencio(a: AccesoDto, hoy: LocalDate): Boolean =
        Fechas.iso(a.venceEl)?.isBefore(hoy) == true

    private fun reconstruirVeterinarios(e: EstadoDueno) {
        val nombrePorMascota = e.mascotas.associate { it.id to it.nombre }
        val accesos = e.accesos.filter { it.mascotaId in nombrePorMascota }
        e.autorizados.clear()
        e.disponibles.clear()
        e.solicitudes.clear()

        val porVeterinario = accesos.groupBy { it.veterinarioId }
        for ((vetId, lista) in porVeterinario) {
            val perfilVet = e.veterinarios[vetId]?.takeIf { it.atiendeComoVeterinario } ?: continue
            for (a in lista.filter { it.estado == "pendiente" && it.iniciadoPor == "veterinario" }) {
                val propuesta = a.turnoPropuesto
                val turno = propuesta?.let {
                    val fecha = runCatching { LocalDate.parse(it["fecha"]?.jsonPrimitive?.content) }.getOrNull()
                    val hora = it["hora"]?.jsonPrimitive?.content?.take(5)
                    val servicio = it["categoria"]?.jsonPrimitive?.content?.takeIf { s -> s.isNotBlank() }
                    if (fecha == null) null
                    else " para un turno" + (servicio?.let { s -> " de $s" } ?: "") +
                        " el ${Fechas.corta(fecha)}" + (hora?.let { h -> " a las $h hs" } ?: "")
                }
                e.solicitudes.add(
                    SolicitudItem(
                        id = a.id, solicitante = perfilVet.nombre,
                        mascota = "Solicita acceso a ${nombrePorMascota[a.mascotaId]}" + turno.orEmpty(),
                        hace = Fechas.haceTexto(a.createdAt), fotoPath = perfilVet.fotoPath
                    )
                )
            }
            val propios = lista.filterNot { it.estado == "pendiente" && it.iniciadoPor == "veterinario" }
            if (propios.isEmpty()) continue
            // Un permiso activo con la fecha pasada ya no vale: el servidor tampoco lo deja ver
            val hoy = LocalDate.now()
            val vigentes = propios.filter { it.estado == "activo" && !vencio(it, hoy) }
            val vencidos = propios.filter { it.estado == "activo" && vencio(it, hoy) }
            val estadoAcceso = when {
                vigentes.isNotEmpty() -> EstadoAcceso.ACTIVO
                propios.any { it.estado == "pendiente" } -> EstadoAcceso.PENDIENTE
                else -> EstadoAcceso.INACTIVO
            }
            val conAcceso = (vigentes + propios.filter { it.estado == "pendiente" })
                .mapNotNull { nombrePorMascota[it.mascotaId] }
            val vet = aVeterinario(perfilVet, estadoAcceso, conAcceso)
            vet.venceEl = vigentes.mapNotNull { Fechas.iso(it.venceEl) }.minOrNull()
            if (vigentes.isEmpty() && vencidos.isNotEmpty()) {
                vet.vencido = true
                vet.venceEl = vencidos.mapNotNull { Fechas.iso(it.venceEl) }.maxOrNull()
            }
            e.autorizados.add(vet)
        }
        val yaListados = porVeterinario.keys
        e.veterinarios.values.filter { it.id !in yaListados && it.atiendeComoVeterinario }.forEach {
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

    /** Las mascotas con las que se puede sacar turno: las inactivas y las fallecidas quedan en el historial. */
    val mascotasActivas: List<Mascota> get() = mascotas.filter { it.estado == EstadoMascota.ACTIVA }

    /**
     * Pasa la mascota a otro estado. Si deja de estar activa se cancelan los turnos que le quedaban pendientes
     * (los ya completados se conservan en su historial).
     */
    fun cambiarEstadoMascota(mascota: Mascota, nuevo: EstadoMascota) {
        if (mascota.estado == nuevo) return
        mascota.estado = nuevo
        val pendientes = if (nuevo == EstadoMascota.ACTIVA) emptyList()
        else eventos.filter { it.mascotaId == mascota.id && it.estado == EstadoTurno.PENDIENTE }
        eventos.removeAll(pendientes.toSet())
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            pendientes.forEach { Servicios.fuente.actualizarTurno(it.id, buildJsonObject { put("estado", "cancelado") }) }
            Servicios.fuente.actualizarMascota(mascota.id, buildJsonObject { put("estado", nuevo.clave) })
        }
    }

    /** [motivo] es por qué se da de baja (fallecimiento, adopción u otro) y queda guardado. */
    fun darDeBajaMascota(mascota: Mascota, motivo: String? = null) {
        mascotas.remove(mascota)
        // Los turnos que le quedaban se cancelan para que no queden colgados en la agenda del veterinario
        val turnos = eventos.filter { it.mascotaId == mascota.id }.map { it.id }
        eventos.removeAll { it.mascotaId == mascota.id }
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            turnos.forEach { Servicios.fuente.actualizarTurno(it, buildJsonObject { put("estado", "cancelado") }) }
            Servicios.fuente.actualizarMascota(mascota.id, buildJsonObject {
                put("activa", false)
                put("motivo_baja", motivo?.takeIf { it.isNotBlank() })
            })
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
     * Veterinarios que ofrecen el servicio o la especialidad elegida y atienden ese tipo de mascota. Sin
     * servicio (null) se ofrecen todos; sin tipo de mascota (null) no se filtra por animal.
     */
    fun veterinariosPara(servicio: String?, tipoMascota: String? = null): List<VeterinarioAcceso> {
        var lista = todosLosVeterinarios()
        if (servicio != null) {
            lista = lista.filter { vet -> vet.especialidades.any { it.equals(servicio, ignoreCase = true) } }
        }
        if (tipoMascota != null) lista = lista.filter { it.atiende(tipoMascota) }
        return lista
    }

    /** True si atiende ese día en [sede] (o, sin indicarla, en su lugar principal). */
    fun trabajaEl(vet: VeterinarioAcceso, fecha: LocalDate, sede: SedeVet? = vet.sede(null)): Boolean =
        fecha.dayOfWeek.value in (sede?.dias ?: vet.diasAtencion)

    /** True si atiende ese día en alguno de sus lugares. */
    fun trabajaEnAlgunLugar(vet: VeterinarioAcceso, fecha: LocalDate): Boolean =
        vet.sedes.ifEmpty { listOf(null) }.any { trabajaEl(vet, fecha, it) }

    private fun minutos(hora: String) = hora.substringBefore(':').toInt() * 60 + hora.substringAfter(':').toInt()

    /** "10:00" + 90 min = "11:30". */
    fun horaFin(hora: String, duracionMin: Int): String {
        val fin = minutos(hora) + duracionMin
        return "%02d:%02d".format(fin / 60 % 24, fin % 60)
    }

    /**
     * Horarios de inicio ("HH:mm") que el veterinario ofrece ese día, uno cada [PASO_HORARIOS_MIN] minutos, para
     * un turno que dura [duracionMin]: solo los que terminan antes de que cierre.
     */
    fun horasDe(
        vet: VeterinarioAcceso, fecha: LocalDate, duracionMin: Int = CatalogoMedico.DURACION_GENERAL_MIN,
        sede: SedeVet? = vet.sede(null)
    ): List<String> {
        if (!trabajaEl(vet, fecha, sede)) return emptyList()
        val horas = mutableListOf<String>()
        var t = minutos(sede?.apertura ?: vet.apertura)
        val fin = minutos(sede?.cierre ?: vet.cierre)
        while (t + duracionMin <= fin) {
            horas.add("%02d:%02d".format(t / 60, t % 60))
            t += PASO_HORARIOS_MIN
        }
        return horas
    }

    /** True si dos turnos que arrancan a [horaA] y [horaB] se pisan, según lo que dura cada uno. */
    fun seSuperponen(horaA: String, duracionA: Int, horaB: String, duracionB: Int): Boolean {
        val a = minutos(horaA)
        val b = minutos(horaB)
        return a < b + duracionB && b < a + duracionA
    }

    /** True si un turno de [duracionMin] que arranca a [hora] pisa alguno de los turnos [ocupados]. */
    fun estaOcupado(hora: String, duracionMin: Int, ocupados: List<HoraOcupadaDto>): Boolean =
        ocupados.any { seSuperponen(hora, duracionMin, it.hora, it.duracionMin) }

    /** Turnos que ya tiene el veterinario ese día (hora y duración; la lista de turnos ajenos no es visible). */
    suspend fun horasOcupadas(vet: VeterinarioAcceso, fecha: LocalDate): List<HoraOcupadaDto> =
        Servicios.fuente.horariosOcupados(vet.id, fecha.toString())

    /**
     * True si la mascota ya tiene otro turno que se pisa con este. [ignorar] es el turno que se está editando:
     * no choca consigo mismo.
     */
    fun hayConflictoDeTurno(
        fecha: LocalDate, hora: String, mascota: String?, ignorar: EventoMascota? = null,
        duracionMin: Int = CatalogoMedico.DURACION_GENERAL_MIN
    ): Boolean =
        mascota != null && eventos.any {
            it !== ignorar && it.id != ignorar?.id && it.fecha == fecha &&
                it.estado == EstadoTurno.PENDIENTE && it.mascota.equals(mascota, ignoreCase = true) &&
                seSuperponen(hora, duracionMin, it.hora, it.duracionMin)
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
        val item = frgp.utn.edu.petcare.data.repositorio.ArchivosRepo.agregar(mascota.id, nombreVisible, extension, bytes, tipoMime)
        return EstudioAdjunto(item.nombre, item.tipoExtension.lowercase(), item.storagePath, tipo)
    }

    /** Agenda el turno. El servidor valida el horario del veterinario y le da acceso a la mascota. */
    fun agendarEvento(
        fecha: LocalDate, categoria: String, mascota: String, veterinario: String, hora: String, observaciones: String,
        estudios: List<EstudioAdjunto> = emptyList(), sedeId: String? = null
    ) {
        val m = buscarMascota(mascota) ?: return
        val vet = buscarVeterinario(veterinario)
        val sede = vet?.sede(sedeId)?.takeIf { it.id.isNotBlank() }
        val evento = EventoMascota(
            categoria, mascota, veterinario, hora, observaciones, fecha,
            mascotaId = m.id, veterinarioId = vet?.id?.ifBlank { null }, sedeId = sede?.id
        )
        eventos.add(evento)
        if (vet != null && veterinario.isNotEmpty()) autorizarPorTurno(veterinario, mascota, true)
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            val usuario = Sesion.usuarioId ?: error("No hay una sesión iniciada")
            Servicios.fuente.crearTurno(
                NuevoTurnoDto(
                    id = evento.id, mascotaId = m.id, veterinarioId = evento.veterinarioId, categoria = categoria,
                    fecha = fecha.toString(), hora = "$hora:00", notas = observaciones.ifBlank { null }, creadoPor = usuario,
                    sedeId = evento.sedeId
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
        evento: EventoMascota, fecha: LocalDate, hora: String, veterinario: String, observaciones: String,
        sedeId: String? = evento.sedeId
    ) {
        val vet = buscarVeterinario(veterinario)
        evento.fecha = fecha
        evento.hora = hora
        evento.veterinario = veterinario
        evento.veterinarioId = vet?.id?.ifBlank { null }
        evento.sedeId = vet?.sede(sedeId)?.takeIf { it.id.isNotBlank() }?.id
        evento.observaciones = observaciones
        if (veterinario.isNotEmpty()) autorizarPorTurno(veterinario, evento.mascota, true)
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            Servicios.fuente.actualizarTurno(evento.id, buildJsonObject {
                put("fecha", fecha.toString())
                put("hora", "$hora:00")
                put("veterinario_id", evento.veterinarioId)
                put("sede_id", evento.sedeId)
                put("notas", observaciones.ifBlank { null })
            })
        }
    }

    // ---------- Veterinarios y accesos ----------

    fun todosLosVeterinarios(): List<VeterinarioAcceso> = autorizados + disponibles

    /** El lugar donde es [evento], si se sabe cuál. */
    fun sedeDe(evento: EventoMascota): SedeVet? {
        val vet = buscarVeterinario(evento.veterinario) ?: return null
        return evento.sedeId?.let { id -> vet.sedes.firstOrNull { it.id == id } } ?: vet.sede(null)
    }

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

    /** Vuelve a dar acceso; [venceEl] es el último día del permiso (null = sin vencimiento). */
    fun restablecerAcceso(vet: VeterinarioAcceso, venceEl: LocalDate? = null) {
        vet.estado = EstadoAcceso.ACTIVO
        vet.vencido = false
        vet.venceEl = venceEl
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            Servicios.fuente.actualizarAccesosDeVeterinario(vet.id, "activo")
            Servicios.fuente.fijarVencimientoDeAccesos(vet.id, venceEl?.toString())
        }
    }

    /** Cambia hasta cuándo sirve el permiso de un veterinario que ya tiene acceso. */
    fun cambiarVencimiento(vet: VeterinarioAcceso, venceEl: LocalDate?) {
        vet.venceEl = venceEl
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            Servicios.fuente.fijarVencimientoDeAccesos(vet.id, venceEl?.toString())
        }
    }

    /** Una línea del historial de permisos ya con los nombres. */
    class EntradaPermiso(
        val cuando: java.time.LocalDateTime,
        val evento: String,
        val veterinario: String,
        val mascota: String,
        val actor: String,
        val venceEl: LocalDate?
    )

    /** Quién autorizó, pidió o sacó cada permiso y cuándo (lo más nuevo primero). */
    suspend fun historialDePermisos(): List<EntradaPermiso> {
        val e = estado
        val yo = Sesion.usuarioId
        val mascotas = e.mascotas.associate { it.id to it.nombre }
        return Servicios.fuente.historialDeAccesos().filter { it.mascotaId in mascotas }.map {
            EntradaPermiso(
                cuando = Fechas.instante(it.createdAt), evento = it.evento,
                veterinario = e.veterinarios[it.veterinarioId]?.nombre ?: "Veterinario",
                mascota = mascotas[it.mascotaId].orEmpty(),
                actor = when (it.actorId) {
                    null -> "El sistema"
                    yo -> "Vos"
                    else -> e.veterinarios[it.actorId]?.nombre ?: "Otra persona"
                },
                venceEl = Fechas.iso(it.venceEl)
            )
        }
    }

    /** Autoriza a un veterinario del catálogo para que vea todas las mascotas actuales. */
    fun autorizarVeterinario(candidato: VeterinarioAcceso, venceEl: LocalDate? = null) {
        val existente = autorizados.firstOrNull { it.id == candidato.id }
        candidato.venceEl = venceEl
        if (existente != null) {
            existente.estado = EstadoAcceso.ACTIVO
            existente.vencido = false
            existente.venceEl = venceEl
        } else {
            disponibles.remove(candidato)
            candidato.estado = EstadoAcceso.ACTIVO
            candidato.mascotas.addAll(mascotas.map { it.nombre })
            autorizados.add(candidato)
        }
        val ids = mascotas.map { it.id }
        Servicios.escribir(alFallar = recargarSiFalla(), alTerminar = recargarAlTerminar()) {
            Servicios.fuente.compartirMascotas(ids, candidato.id, venceEl?.toString())
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
        val estudios: List<ArchivoDeTurno> = emptyList(),
        val anamnesis: String = "",
        val examenFisico: String = "",
        val signos: SignosVitales = SignosVitales(),
        /** Medicamentos que recetó el veterinario en esa consulta. */
        val receta: List<Prescripcion> = emptyList()
    ) {
        val vacio: Boolean
            get() = motivo.isBlank() && diagnostico.isBlank() && tratamiento.isBlank() && registros.isEmpty() &&
                archivos.isEmpty() && estudios.isEmpty() && anamnesis.isBlank() && examenFisico.isBlank() &&
                signos.vacio && receta.isEmpty()
    }

    /** Perfil de un veterinario del catálogo, con matrícula y datos de la clínica (para firmar la receta). */
    fun perfilDeVeterinario(id: String?): PerfilDto? = id?.let { estado.veterinarios[it] }

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
        val recetas = async { runCatching { f.prescripciones(evento.mascotaId) }.getOrDefault(emptyList()) }

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
            estudios = estudios.await().map { ArchivoDeTurno(it.nombre, it.extension, it.storagePath, it.tipo) },
            anamnesis = informe?.anamnesis.orEmpty(), examenFisico = informe?.examenFisico.orEmpty(),
            signos = SignosVitales(
                informe?.pesoKg, informe?.temperaturaC, informe?.frecuenciaCardiaca, informe?.frecuenciaRespiratoria
            ),
            receta = recetas.await().filter { it.turnoId == evento.id }.map(Prescripcion::deDto)
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

    /** Borra una sola notificación: se saca de la lista ya y se borra del servidor en segundo plano. */
    fun borrarNotificacion(notificacion: NotificacionDueno) {
        estado.notificaciones.remove(notificacion)
        if (notificacion.id.isBlank()) return
        Servicios.escribir { Servicios.fuente.borrarNotificacion(notificacion.id) }
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
