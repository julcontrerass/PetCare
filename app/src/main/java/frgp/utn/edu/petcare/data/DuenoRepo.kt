package frgp.utn.edu.petcare.data

import frgp.utn.edu.petcare.AgendaRepo
import frgp.utn.edu.petcare.DatosRegistroDueno
import frgp.utn.edu.petcare.EstadoEvento
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.PacientesRepo
import frgp.utn.edu.petcare.PerfilVetRepo
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.SolicitudItem
import frgp.utn.edu.petcare.model.EstadoAcceso
import frgp.utn.edu.petcare.model.EventoMascota
import frgp.utn.edu.petcare.model.Mascota
import frgp.utn.edu.petcare.model.NotificacionDueno
import frgp.utn.edu.petcare.model.PerfilDueno
import frgp.utn.edu.petcare.model.SIN_DATOS
import frgp.utn.edu.petcare.model.Sexo
import frgp.utn.edu.petcare.model.TipoNotificacion
import frgp.utn.edu.petcare.model.VeterinarioAcceso
import java.time.LocalDate
import java.time.LocalTime
import android.net.Uri
import java.io.File

/** Todo lo que pertenece a la cuenta de un dueño. */
class EstadoDueno(
    val perfil: PerfilDueno,
    val esDemo: Boolean,
    val mascotas: MutableList<Mascota> = mutableListOf(),
    val eventos: MutableList<EventoMascota> = mutableListOf(),
    val autorizados: MutableList<VeterinarioAcceso> = mutableListOf(),
    val disponibles: MutableList<VeterinarioAcceso> = mutableListOf(),
    val solicitudes: MutableList<SolicitudItem> = mutableListOf(),
    val solicitantes: MutableMap<String, VeterinarioAcceso> = mutableMapOf(),
    val notificaciones: MutableList<NotificacionDueno> = mutableListOf(),
    var hayNotificacionesSinLeer: Boolean = false
)

/**
 * Datos del dueño en sesión (en memoria, sin servidor). Cada cuenta tiene su propio [EstadoDueno]:
 * la de demostración arranca con mascotas, turnos y veterinarios de ejemplo; una cuenta nueva solo
 * tiene lo que cargó al registrarse. Cuando haya base de datos, esta clase es el punto a reemplazar.
 */
object DuenoRepo {

    const val CATEGORIA_VACUNA = "Vacuna"
    val CATEGORIAS_EVENTO = listOf("Vacuna", "Control", "Cirugía", "Estudio / Tratamiento")
    val HORAS_EVENTO = listOf("09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00")

    private const val CLAVE_DEMO = "demo"
    private val estados = mutableMapOf<String, EstadoDueno>()
    private var claveActual = CLAVE_DEMO

    private val actual: EstadoDueno
        get() = estados.getOrPut(claveActual) { crearDemo() }

    // ---------- Sesión ----------

    /** Selecciona los datos de la cuenta que ingresa; cualquier correo sin registro usa la cuenta de demostración. */
    fun entrar(email: String) {
        val clave = email.lowercase()
        claveActual = if (estados.containsKey(clave)) clave else CLAVE_DEMO
    }

    /** Crea la cuenta del dueño con sus datos y mascotas del registro. */
    fun registrar(datos: DatosRegistroDueno) {
        val perfil = PerfilDueno(
            nombre = datos.nombre, email = datos.email, telefono = datos.telefono,
            direccion = datos.direccion, password = datos.password,
            fotoUri = datos.fotoPath?.let { Uri.fromFile(File(it)) }
        )
        val estado = EstadoDueno(perfil, esDemo = false)
        datos.mascotas.forEach { r ->
            estado.mascotas.add(
                Mascota(
                    nombre = r.nombre, tipo = r.tipo, raza = r.raza,
                    nacimiento = Fechas.parsear(r.nacimiento), sexo = Sexo.deTexto(r.sexo),
                    fotoUri = r.fotoPath?.let { Uri.fromFile(File(it)) },
                    peso = r.peso.ifBlank { SIN_DATOS }, color = r.color.ifBlank { SIN_DATOS },
                    microchip = r.microchip.ifBlank { SIN_DATOS },
                    observaciones = r.observaciones.ifBlank { "Sin observaciones" }
                )
            )
        }
        estado.disponibles.addAll(catalogo().onEach { it.estado = EstadoAcceso.DISPONIBLE })
        estados[datos.email.lowercase()] = estado
    }

    val esDemo: Boolean get() = actual.esDemo
    val perfil: PerfilDueno get() = actual.perfil
    val mascotas: MutableList<Mascota> get() = actual.mascotas
    val eventos: MutableList<EventoMascota> get() = actual.eventos
    val autorizados: MutableList<VeterinarioAcceso> get() = actual.autorizados
    val disponibles: MutableList<VeterinarioAcceso> get() = actual.disponibles
    val solicitudes: MutableList<SolicitudItem> get() = actual.solicitudes
    val notificaciones: List<NotificacionDueno> get() = actual.notificaciones
    val hayNotificacionesSinLeer: Boolean get() = actual.hayNotificacionesSinLeer

    // ---------- Mascotas ----------

    fun buscarMascota(nombre: String?): Mascota? = mascotas.firstOrNull { it.nombre == nombre }

    fun agregarMascota(mascota: Mascota) {
        mascotas.add(mascota)
        notificar(TipoNotificacion.MASCOTA, "Agregaste una nueva mascota",
            "Agregaste a ${mascota.nombre} (${mascota.tipo}) a tus mascotas.")
    }

    fun darDeBajaMascota(mascota: Mascota) {
        mascotas.remove(mascota)
        notificar(TipoNotificacion.MASCOTA, "Mascota dada de baja", "${mascota.nombre} fue dada de baja de tus mascotas.")
    }

    /** Estado de salud que se muestra en las tarjetas: hay una vacuna agendada en los próximos 30 días. */
    fun tieneVacunaPendiente(mascota: String): Boolean {
        val hoy = LocalDate.now()
        val limite = hoy.plusDays(30)
        return eventos.any {
            !it.fecha.isBefore(hoy) && !it.fecha.isAfter(limite) &&
                it.mascota.equals(mascota, ignoreCase = true) && it.categoria.contains("vacuna", ignoreCase = true)
        }
    }

    // ---------- Eventos ----------

    fun eventosDelDia(fecha: LocalDate): List<EventoMascota> =
        eventos.filter { it.fecha == fecha }.sortedBy { it.hora }

    fun cantidadDelMes(mes: java.time.YearMonth): Int =
        eventos.count { java.time.YearMonth.from(it.fecha) == mes }

    /** Eventos futuros (de hoy en adelante) o pasados, del más cercano al más lejano; opcionalmente de una sola mascota. */
    fun eventosOrdenados(proximos: Boolean, mascota: String? = null): List<EventoMascota> {
        val hoy = LocalDate.now()
        val lista = eventos
            .filter { (!it.fecha.isBefore(hoy)) == proximos }
            .filter { mascota == null || it.mascota.equals(mascota, ignoreCase = true) }
            .sortedWith(compareBy<EventoMascota>({ it.fecha }, { it.hora }))
        return if (proximos) lista else lista.reversed()
    }

    fun actividadReciente(): List<EventoMascota> {
        val hoy = LocalDate.now()
        val desde = hoy.minusDays(30)
        return eventos
            .filter { !it.fecha.isAfter(hoy) && !it.fecha.isBefore(desde) }
            .sortedWith(compareBy<EventoMascota>({ it.fecha }, { it.hora }))
            .reversed()
    }

    fun proximoEvento(mascota: String): EventoMascota? {
        val hoy = LocalDate.now()
        return eventos
            .filter { !it.fecha.isBefore(hoy) && it.mascota.equals(mascota, ignoreCase = true) }
            .minWithOrNull(compareBy<EventoMascota>({ it.fecha }, { it.hora }))
    }

    fun eventosDeMascota(nombre: String?): List<EventoMascota> =
        eventos.filter { nombre == null || it.mascota == nombre }

    fun horaPasada(fecha: LocalDate, hora: String): Boolean {
        if (fecha != LocalDate.now()) return false
        return runCatching { LocalTime.parse(hora).isBefore(LocalTime.now()) }.getOrDefault(false)
    }

    /** La hora preferida si todavía no pasó; si no, la primera hora libre del día (null si ya no queda ninguna). */
    fun horaValidaPara(fecha: LocalDate, preferida: String?): String? {
        if (preferida != null && !horaPasada(fecha, preferida)) return preferida
        return HORAS_EVENTO.firstOrNull { !horaPasada(fecha, it) }
    }

    fun hayConflictoDeTurno(fecha: LocalDate, hora: String, mascota: String?): Boolean =
        mascota != null && eventos.any { it.fecha == fecha && it.hora == hora && it.mascota.equals(mascota, ignoreCase = true) }

    /** Agenda el turno, da acceso al veterinario y lo comparte con su agenda si es el veterinario de la otra vista. */
    fun agendarEvento(
        fecha: LocalDate, categoria: String, mascota: String, veterinario: String, hora: String, observaciones: String
    ) {
        eventos.add(EventoMascota(categoria, mascota, veterinario, hora, observaciones, fecha))
        compartirTurnoConVeterinario(fecha, categoria, mascota, veterinario, hora, observaciones)
        val conVet = if (veterinario.isNotEmpty()) " con $veterinario" else ""
        notificar(
            TipoNotificacion.TURNO, "Tienes un nuevo turno",
            "Tienes un nuevo turno de $categoria para $mascota$conVet el ${fecha.dayOfMonth}/${fecha.monthValue} a las $hora hs."
        )
    }

    fun cancelarEvento(evento: EventoMascota, porElVeterinario: Boolean = false) {
        eventos.remove(evento)
        if (porElVeterinario) {
            notificar(TipoNotificacion.CANCELACION, "Turno cancelado por el veterinario",
                "El turno de ${evento.mascota} (${evento.categoria}) fue cancelado por el veterinario.")
        } else {
            notificar(TipoNotificacion.CANCELACION, "Cancelaste un turno",
                "Cancelaste el turno de ${evento.mascota} (${evento.categoria}).")
        }
    }

    fun modificarEvento(
        evento: EventoMascota, fecha: LocalDate, hora: String, veterinario: String, observaciones: String
    ) {
        evento.fecha = fecha
        evento.hora = hora
        evento.veterinario = veterinario
        evento.observaciones = observaciones
        if (veterinario.isNotEmpty()) autorizarPorTurno(veterinario, evento.mascota, true)
        notificar(
            TipoNotificacion.TURNO, "Modificaste un turno",
            "El turno de ${evento.mascota} (${evento.categoria}) ahora es el ${fecha.dayOfMonth} de " +
                "${Fechas.nombreMes(fecha.monthValue)} a las $hora."
        )
    }

    // ---------- Veterinarios y accesos ----------

    fun todosLosVeterinarios(): List<VeterinarioAcceso> = autorizados + disponibles

    fun buscarVeterinario(nombre: String?): VeterinarioAcceso? = buscarVeterinario(actual, nombre)

    private fun buscarVeterinario(estado: EstadoDueno, nombre: String?): VeterinarioAcceso? {
        if (nombre == null) return null
        return (estado.autorizados + estado.disponibles).firstOrNull { it.nombre.equals(nombre.trim(), ignoreCase = true) }
    }

    fun tieneTurnoCon(veterinario: String, mascota: String): Boolean =
        eventos.any { it.veterinario.equals(veterinario, ignoreCase = true) && it.mascota.equals(mascota, ignoreCase = true) }

    /**
     * Tener un turno con el veterinario alcanza para que vea la ficha de la mascota: no hay que esperar
     * ninguna autorización. Devuelve true si el veterinario pasó a tener acceso en este momento.
     */
    fun autorizarPorTurno(nombreVet: String, mascota: String, reactivar: Boolean): Boolean =
        autorizarPorTurno(actual, nombreVet, mascota, reactivar)

    private fun autorizarPorTurno(estado: EstadoDueno, nombreVet: String, mascota: String, reactivar: Boolean): Boolean {
        val vet = buscarVeterinario(estado, nombreVet) ?: return false
        if (vet.estado == EstadoAcceso.INACTIVO && !reactivar) return false
        val teniaAcceso = vet.estado == EstadoAcceso.ACTIVO && mascota in vet.mascotas
        estado.disponibles.remove(vet)
        if (vet !in estado.autorizados) estado.autorizados.add(vet)
        vet.estado = EstadoAcceso.ACTIVO
        vet.mascotas.add(mascota)
        return !teniaAcceso
    }

    /** Deja los accesos coherentes con los turnos cargados. */
    private fun sincronizarAccesoPorTurnos(estado: EstadoDueno) {
        (estado.autorizados + estado.disponibles).filter { it.estado != EstadoAcceso.INACTIVO }.forEach { it.mascotas.clear() }
        estado.eventos.sortedBy { it.fecha }.forEach { autorizarPorTurno(estado, it.veterinario, it.mascota, false) }
    }

    fun turnosDeVeterinario(vet: VeterinarioAcceso): Int =
        eventos.count { it.veterinario.equals(vet.nombre, ignoreCase = true) }

    fun proximoTurnoDeVeterinario(vet: VeterinarioAcceso): EventoMascota? {
        val hoy = LocalDate.now()
        return eventos
            .filter { !it.fecha.isBefore(hoy) && it.veterinario.equals(vet.nombre, ignoreCase = true) }
            .minByOrNull { it.fecha }
    }

    fun revocarAcceso(vet: VeterinarioAcceso) {
        vet.estado = EstadoAcceso.INACTIVO
    }

    fun restablecerAcceso(vet: VeterinarioAcceso) {
        vet.estado = EstadoAcceso.ACTIVO
    }

    /** Autoriza a un veterinario del catálogo para que vea todas las mascotas actuales. */
    fun autorizarVeterinario(candidato: VeterinarioAcceso) {
        val existente = autorizados.firstOrNull { it.matricula.equals(candidato.matricula, ignoreCase = true) }
        if (existente != null) {
            existente.estado = EstadoAcceso.ACTIVO
        } else {
            disponibles.remove(candidato)
            autorizados.add(
                VeterinarioAcceso(
                    candidato.nombre, candidato.usuario, candidato.email, candidato.matricula,
                    candidato.especialidad, EstadoAcceso.ACTIVO, mascotas.map { it.nombre }
                )
            )
        }
    }

    /** Veterinarios que todavía se pueden autorizar. */
    fun candidatosAAutorizar(consulta: String): List<VeterinarioAcceso> {
        val q = consulta.trim().lowercase()
        return disponibles.filter { vet ->
            val yaAutorizado = autorizados.any {
                it.matricula.equals(vet.matricula, ignoreCase = true) && it.estado != EstadoAcceso.INACTIVO
            }
            !yaAutorizado && (q.isEmpty() || listOf(vet.nombre, vet.usuario, vet.email, vet.matricula).any { it.lowercase().contains(q) })
        }
    }

    // ---------- Solicitudes de acceso ----------

    fun aceptarSolicitud(item: SolicitudItem) {
        val vet = actual.solicitantes[item.solicitante]
        val mascota = item.mascota.replace("Solicita acceso a ", "")
        if (vet != null && vet !in autorizados) {
            vet.estado = EstadoAcceso.ACTIVO
            vet.mascotas.clear()
            vet.mascotas.add(mascota)
            disponibles.remove(vet)
            autorizados.add(vet)
        }
        notificar(TipoNotificacion.ACCESO, "Solicitud aceptada", "${item.solicitante} ahora puede ver la ficha de tu mascota.")
    }

    /** Quien ya tiene un turno con la mascota no necesita que se lo autorice: se acepta solo. */
    fun resolverSolicitudesPorTurno() {
        solicitudes.filter { it.estado == SolicitudItem.Estado.PENDIENTE }.forEach { item ->
            val mascota = item.mascota.replace("Solicita acceso a ", "")
            if (tieneTurnoCon(item.solicitante, mascota)) {
                autorizarPorTurno(item.solicitante, mascota, true)
                item.estado = SolicitudItem.Estado.ACEPTADA
            }
        }
    }

    // ---------- Notificaciones ----------

    fun notificar(tipo: TipoNotificacion, titulo: String, mensaje: String) {
        actual.notificaciones.add(0, NotificacionDueno(tipo, titulo, mensaje))
        actual.hayNotificacionesSinLeer = true
    }

    fun marcarNotificacionesLeidas() {
        actual.hayNotificacionesSinLeer = false
    }

    fun limpiarNotificaciones() {
        actual.notificaciones.clear()
        actual.hayNotificacionesSinLeer = false
    }

    // ---------- Vista del veterinario ----------

    /**
     * El veterinario de ejemplo del catálogo ("@jperez") representa al veterinario en sesión: cuando éste se
     * registra con sus datos reales, el catálogo y los turnos de ejemplo pasan a usar su nombre.
     */
    fun sincronizarVeterinarioRegistrado() {
        val perfilVet = PerfilVetRepo
        estados.values.forEach { estado ->
            (estado.autorizados + estado.disponibles).filter { it.usuario == "@jperez" }.forEach { vet ->
                val anterior = vet.nombre
                vet.nombre = perfilVet.nombre
                vet.email = perfilVet.email
                vet.matricula = perfilVet.matricula
                estado.eventos.filter { it.veterinario.equals(anterior, ignoreCase = true) }
                    .forEach { it.veterinario = perfilVet.nombre }
            }
        }
    }

    /** Acceso automático del veterinario y, si es el de la otra vista, la mascota y el turno le aparecen. */
    private fun compartirTurnoConVeterinario(
        fecha: LocalDate, categoria: String, mascota: String, nombreVet: String, hora: String, observaciones: String
    ) {
        if (nombreVet.isEmpty()) return
        if (autorizarPorTurno(nombreVet, mascota, true)) {
            notificar(
                TipoNotificacion.ACCESO, "Acceso por turno",
                "$nombreVet ya puede ver la ficha de $mascota por el turno del ${fecha.dayOfMonth}/${fecha.monthValue}."
            )
        }
        if (!nombreVet.equals(PerfilVetRepo.nombre, ignoreCase = true)) return

        val m = buscarMascota(mascota) ?: return
        val especie = if (m.tipo.equals("Perro", true) || m.tipo.equals("Gato", true)) m.tipo else PacientesRepo.ESPECIE_OTRO
        fun dato(valor: String?) = valor?.takeIf { it.isNotBlank() } ?: SIN_DATOS
        val paciente = PacientesRepo.registrarDesdeDueno(
            m.nombre, especie, dato(m.raza), m.sexo?.etiqueta ?: SIN_DATOS,
            m.nacimiento?.let { Fechas.corta(it) } ?: SIN_DATOS, m.fotoRes, dato(m.peso),
            dato(m.microchip), dato(m.color), dato(m.observaciones),
            dato(perfil.nombre), dato(perfil.direccion), dato(perfil.telefono), dato(perfil.email)
        )
        val tipo = when (categoria) {
            "Vacuna" -> "Vacuna"
            "Control" -> "Control"
            "Cirugía" -> "Cirugía"
            else -> "Tratamiento"
        }
        AgendaRepo.agregar(
            paciente.id, tipo, if (categoria == "Vacuna") "Vacunación" else categoria, fecha, hora,
            EstadoEvento.PENDIENTE, observaciones, nombreVet
        )
    }

    // ---------- Datos de demostración ----------

    private fun catalogo(): List<VeterinarioAcceso> = listOf(
        VeterinarioAcceso("Dr. Alejandro Ramírez", "@aramirez", "alejandro.ramirez@petcare.com", "MP-23456", "Vacuna", EstadoAcceso.DISPONIBLE),
        VeterinarioAcceso("Dra. Carla Méndez", "@cmendez", "carla.mendez@petcare.com", "MP-98765", "Control", EstadoAcceso.DISPONIBLE),
        VeterinarioAcceso("Dr. Ricardo Soto", "@rsoto", "ricardo.soto@petcare.com", "MP-45612", "Cirugía", EstadoAcceso.DISPONIBLE),
        VeterinarioAcceso("Dra. Sofía Fernández", "@sfernandez", "sofia.fernandez@petcare.com", "MP-77890", "Vacuna", EstadoAcceso.DISPONIBLE),
        VeterinarioAcceso("Dra. Valentina Ríos", "@vrios", "valentina.rios@petcare.com", "MP-33221", "Estudio / Tratamiento", EstadoAcceso.DISPONIBLE),
        VeterinarioAcceso("Dr. Gabriel Lucero", "@glucero", "gabriel.lucero@petcare.com", "MP-55443", "Cirugía", EstadoAcceso.DISPONIBLE),
        VeterinarioAcceso("Dra. Mariana Costa", "@mcosta", "mariana.costa@petcare.com", "MP-88112", "Control", EstadoAcceso.DISPONIBLE),
        VeterinarioAcceso(PerfilVetRepo.nombre, "@jperez", PerfilVetRepo.email, PerfilVetRepo.matricula, "Control", EstadoAcceso.DISPONIBLE)
    )

    private fun crearDemo(): EstadoDueno {
        val estado = EstadoDueno(
            PerfilDueno("Juan Perez", "juan.perez@example.com", "+54 11 1234–5678", "Calle Falsa 123"),
            esDemo = true
        )
        estado.mascotas.addAll(
            listOf(
                Mascota("Koda", "Perro", "Golden Retriever", LocalDate.of(2020, 3, 15), Sexo.MACHO, fotoRes = R.drawable.luna,
                    peso = "28 kg", microchip = "985121054871236", color = "Dorado", observaciones = "Alérgico a la penicilina"),
                Mascota("Mika", "Gato", "Europeo", LocalDate.of(2019, 11, 2), Sexo.HEMBRA, fotoRes = R.drawable.milo,
                    peso = "4 kg", microchip = "985121054870001", color = "Gris atigrado"),
                Mascota("Luna", "Perro", "Cocker spaniel", LocalDate.of(2020, 6, 10), Sexo.HEMBRA, fotoRes = R.drawable.luna,
                    peso = "11 kg", microchip = "985121054870002", color = "Café", observaciones = "Control dental pendiente"),
                Mascota("Milo", "Gato", "Siamés", LocalDate.of(2014, 1, 21), Sexo.MACHO, fotoRes = R.drawable.milo,
                    peso = "5 kg", microchip = "985121054870003", color = "Crema y marrón", observaciones = "Medicación para la tiroides")
            )
        )

        val vets = catalogo().associateBy { it.usuario }
        vets.getValue("@aramirez").apply { this.estado = EstadoAcceso.ACTIVO; mascotas.addAll(listOf("Koda", "Mika")) }
        vets.getValue("@cmendez").apply { this.estado = EstadoAcceso.PENDIENTE; mascotas.add("Luna") }
        vets.getValue("@rsoto").apply { this.estado = EstadoAcceso.INACTIVO; mascotas.add("Milo") }
        estado.autorizados.addAll(listOf(vets.getValue("@aramirez"), vets.getValue("@cmendez"), vets.getValue("@rsoto")))
        estado.disponibles.addAll(vets.values.filter { it !in estado.autorizados })

        // Turnos de ejemplo relativos a hoy: los próximos y los de las últimas semanas
        val hoy = LocalDate.now()
        fun turno(dias: Long, cat: String, mascota: String, vet: String, hora: String, obs: String = "") =
            estado.eventos.add(EventoMascota(cat, mascota, vet, hora, obs, hoy.plusDays(dias)))
        turno(2, "Vacuna", "Koda", "Dr. Alejandro Ramírez", "11:00")
        turno(2, "Control", "Mika", "Dra. Carla Méndez", "11:00")
        turno(7, "Cirugía", "Milo", "Dr. Ricardo Soto", "09:00")
        turno(7, "Vacuna", "Luna", "Dra. Sofía Fernández", "14:00")
        turno(9, "Control", "Koda", "Dra. Carla Méndez", "16:00")
        turno(15, "Estudio / Tratamiento", "Mika", "Dra. Valentina Ríos", "10:00")
        turno(15, "Vacuna", "Milo", "Dr. Alejandro Ramírez", "13:00")
        turno(-3, "Control general", "Milo", "Dra. Carla Méndez", "10:00", "Chequeo de rutina OK")
        turno(-11, "Vacuna múltiple", "Luna", "Dr. Alejandro Ramírez", "12:00", "Refuerzo anual aplicado")
        turno(-18, "Consulta veterinaria", "Koda", PerfilVetRepo.nombre, "15:30", "Control de peso")
        turno(-25, "Desparasitación", "Mika", "Dra. Valentina Ríos", "11:00", "Dosis completada")
        sincronizarAccesoPorTurnos(estado)

        // Solicitudes de acceso pendientes
        estado.solicitudes.add(SolicitudItem("Dra. Laura Sosa", "Solicita acceso a Koda", "Hace 2 horas", R.drawable.luna))
        estado.solicitudes.add(SolicitudItem("Dr. Pablo Medina", "Solicita acceso a Mika", "Ayer", R.drawable.milo))
        estado.solicitantes["Dra. Laura Sosa"] = VeterinarioAcceso.desdeNombre("Dra. Laura Sosa", "Control", "MP-24680")
        estado.solicitantes["Dr. Pablo Medina"] = VeterinarioAcceso.desdeNombre("Dr. Pablo Medina", "Vacuna", "MP-13579")
        return estado
    }
}
