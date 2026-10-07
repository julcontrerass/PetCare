package frgp.utn.edu.petcare

import java.time.LocalDate
import java.time.LocalDateTime

data class VetAdminItem(
    val id: Int,
    var nombre: String,
    var email: String,
    var matricula: String,
    var clinica: String,
    var direccion: String,
    var telefono: String,
    var especialidades: String,
    var diasYHorarios: String,
    var estado: String, // AdminRepo.PENDIENTE, ACTIVO, RECHAZADO o SUSPENDIDO
    var dni: String = "",
    var fotoPath: String? = null,
    var fechaRegistro: LocalDate = LocalDate.now(),
    /** Motivo del rechazo o de la suspensión, para que el veterinario sepa qué pasó. */
    var motivo: String = ""
)

data class DuenoAdminItem(
    val id: Int,
    val nombre: String,
    val dni: String,
    val email: String,
    val telefono: String,
    val direccion: String,
    val mascotas: List<String>,
    var estado: String = AdminRepo.ACTIVO, // ACTIVO o SUSPENDIDO
    val fotoPath: String? = null,
    val fechaRegistro: LocalDate = LocalDate.now(),
    var motivo: String = ""
)

enum class TipoActividad { REGISTRO, APROBACION, RECHAZO, SUSPENSION, REACTIVACION }

data class ActividadAdmin(val tipo: TipoActividad, val texto: String, val cuando: LocalDateTime)

object AdminRepo {

    const val PENDIENTE = "PENDIENTE_REVISION"
    const val ACTIVO = "ACTIVO"
    const val RECHAZADO = "RECHAZADO"
    const val SUSPENDIDO = "SUSPENDIDO"

    const val EMAIL_ADMIN = "admin@petcare.com"
    private const val SIN_MASCOTAS = "Sin mascotas por ahora"

    private var nextVetId = 200
    private var nextDuenoId = 100

    val listaVeterinarios = mutableListOf(
        VetAdminItem(
            1, "Dr. Juan Pérez", "juan.perez@clinica.com", "MP-12345",
            "Clínica Veterinaria Central", "Av. Santa Fe 2345, CABA", "+54 11 4000-1234",
            "Cirugía Veterinaria, Dermatología", "Lun a Vie · 09:00 a 18:00 hs", ACTIVO,
            dni = "30123456", fechaRegistro = LocalDate.now().minusDays(60)
        ),
        VetAdminItem(
            2, "Dra. Laura Sosa", "laura.sosa@petcare.com", "MP-24890",
            "Centro Veterinario Norte", "Cabildo 1500, CABA", "+54 11 4555-8822",
            "Vacunación, Odontología", "Lun a Sáb · 08:00 a 16:00 hs", PENDIENTE,
            dni = "32456789", fechaRegistro = LocalDate.now().minusDays(1)
        ),
        VetAdminItem(
            3, "Dr. Pablo Medina", "pablo.medina@petcare.com", "MP-19340",
            "Consultorio Vet Medina", "Belgrano 450, CABA", "+54 11 4777-1133",
            "Análisis de laboratorio, Ecografía", "Mar a Sáb · 10:00 a 19:00 hs", PENDIENTE,
            dni = "28741963", fechaRegistro = LocalDate.now()
        ),
        VetAdminItem(
            4, "Dr. Alejandro Ramírez", "alejandro.ramirez@petcare.com", "MP-23456",
            "Veterinaria San Martín", "San Martín 890, CABA", "+54 11 4222-3344",
            "Vacunas, Control general", "Lun a Vie · 09:00 a 17:00 hs", ACTIVO,
            dni = "27564812", fechaRegistro = LocalDate.now().minusDays(45)
        ),
        VetAdminItem(
            5, "Dra. Carla Méndez", "carla.mendez@petcare.com", "MP-98765",
            "Pet Care Palermo", "Palermo 120, CABA", "+54 11 4111-9988", "Control general",
            "Lun a Vie · 10:00 a 18:00 hs", ACTIVO,
            dni = "31987456", fechaRegistro = LocalDate.now().minusDays(30)
        ),
        VetAdminItem(
            6, "Dr. Ricardo Soto", "ricardo.soto@petcare.com", "MP-45612",
            "Soto Cirugía Veterinaria", "Honduras 3800, CABA", "+54 11 4833-5566",
            "Cirugía Veterinaria", "Lun a Vie · 08:00 a 14:00 hs", SUSPENDIDO,
            dni = "26331877", fechaRegistro = LocalDate.now().minusDays(80),
            motivo = "Matrícula vencida: debe presentar la renovación."
        ),
        VetAdminItem(
            7, "Dr. Gabriel Lucero", "gabriel.lucero@petcare.com", "MP-00112",
            "Consultorio Lucero", "Av. Rivadavia 7000, CABA", "+54 11 4600-7788",
            "Consulta general", "Lun a Vie · 09:00 a 13:00 hs", RECHAZADO,
            dni = "33100245", fechaRegistro = LocalDate.now().minusDays(12),
            motivo = "No se pudo verificar la matrícula en el colegio profesional."
        )
    )

    val listaDuenos = mutableListOf(
        DuenoAdminItem(1, "Julieta Gómez", "38123456", "julieta.gomez@email.com", "+54 11 5555-1200", "Av. Corrientes 2450, CABA", listOf("Koda (Golden Retriever)", "Mia (Maltés)"), fechaRegistro = LocalDate.now().minusDays(70)),
        DuenoAdminItem(2, "Lucas Rodríguez", "36987654", "lucas.rodriguez@email.com", "+54 11 4777-8899", "Juramento 1800, CABA", listOf("Milo (Bulldog Francés)"), fechaRegistro = LocalDate.now().minusDays(52)),
        DuenoAdminItem(3, "María Fernández", "35444555", "m.fernandez@email.com", "+54 11 4444-5555", "Av. Santa Fe 1234, CABA", listOf("Luna (Gato Siamés)"), fechaRegistro = LocalDate.now().minusDays(33)),
        DuenoAdminItem(4, "Carlos Pérez", "39888221", "carlos.perez@email.com", "+54 11 4888-2211", "Cabildo 3300, CABA", listOf("Simba (Gato Maine Coon)"), fechaRegistro = LocalDate.now().minusDays(20)),
        DuenoAdminItem(5, "Ana Martínez", "40111222", "ana@mail.com", "+54 11 4333-7777", "Rivadavia 5000, CABA", listOf("Rocky (Pug)"), fechaRegistro = LocalDate.now().minusDays(9))
    )

    val actividad = mutableListOf<ActividadAdmin>()

    init {
        val ahora = LocalDateTime.now()
        actividad.addAll(
            listOf(
                ActividadAdmin(TipoActividad.REGISTRO, "Pablo Medina pidió el alta como veterinario", ahora.minusHours(1)),
                ActividadAdmin(TipoActividad.REGISTRO, "Laura Sosa pidió el alta como veterinaria", ahora.minusHours(22)),
                ActividadAdmin(TipoActividad.REGISTRO, "Ana Martínez creó su cuenta con 1 mascota", ahora.minusDays(9)),
                ActividadAdmin(TipoActividad.RECHAZO, "Rechazaste a Gabriel Lucero: no se pudo verificar la matrícula", ahora.minusDays(12)),
                ActividadAdmin(TipoActividad.SUSPENSION, "Suspendiste a Ricardo Soto: matrícula vencida", ahora.minusDays(20)),
                ActividadAdmin(TipoActividad.APROBACION, "Diste de alta a Carla Méndez", ahora.minusDays(30))
            )
        )
    }

    // ---------- Consultas ----------

    fun porEstado(estado: String) = listaVeterinarios.filter { it.estado == estado }

    fun pendientesRevisionCount(): Int = listaVeterinarios.count { it.estado == PENDIENTE }

    fun vetsActivos(): Int = listaVeterinarios.count { it.estado == ACTIVO }

    fun duenosActivos(): Int = listaDuenos.count { it.estado == ACTIVO }

    fun totalMascotas(): Int = listaDuenos.sumOf { d -> d.mascotas.count { it != SIN_MASCOTAS } }

    fun vetPorId(id: Int) = listaVeterinarios.firstOrNull { it.id == id }

    fun duenoPorId(id: Int) = listaDuenos.firstOrNull { it.id == id }

    /**
     * Mensaje para mostrar si la cuenta con ese correo no puede ingresar (veterinario en revisión, rechazado o
     * suspendido, o dueño suspendido). Devuelve null cuando puede entrar.
     */
    fun motivoBloqueo(email: String): String? {
        listaVeterinarios.firstOrNull { it.email.equals(email, ignoreCase = true) }?.let { vet ->
            val detalle = if (vet.motivo.isNotBlank()) "\n\nMotivo: ${vet.motivo}" else ""
            return when (vet.estado) {
                PENDIENTE -> "Tu cuenta está en revisión. El administrador tiene que verificar tu matrícula antes de darte el alta; te vamos a avisar cuando esté lista."
                RECHAZADO -> "El administrador rechazó tu solicitud de alta.$detalle"
                SUSPENDIDO -> "El administrador suspendió tu cuenta.$detalle"
                else -> null
            }
        }
        listaDuenos.firstOrNull { it.email.equals(email, ignoreCase = true) }?.let { dueno ->
            if (dueno.estado == SUSPENDIDO) {
                val detalle = if (dueno.motivo.isNotBlank()) "\n\nMotivo: ${dueno.motivo}" else ""
                return "El administrador suspendió tu cuenta.$detalle"
            }
        }
        return null
    }

    // ---------- Acciones sobre veterinarios ----------

    private fun registrar(tipo: TipoActividad, texto: String) {
        actividad.add(0, ActividadAdmin(tipo, texto, LocalDateTime.now()))
    }

    fun aprobarVet(id: Int) {
        val vet = vetPorId(id) ?: return
        vet.estado = ACTIVO
        vet.motivo = ""
        registrar(TipoActividad.APROBACION, "Diste de alta a ${vet.nombre}")
    }

    fun rechazarVet(id: Int, motivo: String = "") {
        val vet = vetPorId(id) ?: return
        vet.estado = RECHAZADO
        vet.motivo = motivo
        registrar(TipoActividad.RECHAZO, "Rechazaste a ${vet.nombre}" + if (motivo.isNotBlank()) ": $motivo" else "")
    }

    fun suspenderVet(id: Int, motivo: String = "") {
        val vet = vetPorId(id) ?: return
        vet.estado = SUSPENDIDO
        vet.motivo = motivo
        registrar(TipoActividad.SUSPENSION, "Suspendiste a ${vet.nombre}" + if (motivo.isNotBlank()) ": $motivo" else "")
    }

    fun reactivarVet(id: Int) {
        val vet = vetPorId(id) ?: return
        vet.estado = ACTIVO
        vet.motivo = ""
        registrar(TipoActividad.REACTIVACION, "Reactivaste a ${vet.nombre}")
    }

    // ---------- Acciones sobre dueños ----------

    fun suspenderDueno(id: Int, motivo: String = "") {
        val dueno = duenoPorId(id) ?: return
        dueno.estado = SUSPENDIDO
        dueno.motivo = motivo
        registrar(TipoActividad.SUSPENSION, "Suspendiste la cuenta de ${dueno.nombre}" + if (motivo.isNotBlank()) ": $motivo" else "")
    }

    fun reactivarDueno(id: Int) {
        val dueno = duenoPorId(id) ?: return
        dueno.estado = ACTIVO
        dueno.motivo = ""
        registrar(TipoActividad.REACTIVACION, "Reactivaste la cuenta de ${dueno.nombre}")
    }

    // ---------- Altas que llegan desde los registros ----------

    fun registrarNuevoDueno(
        nombre: String, dni: String, email: String, telefono: String,
        direccion: String, mascotas: List<String>, fotoPath: String? = null
    ) {
        listaDuenos.add(
            0, DuenoAdminItem(
                id = nextDuenoId++,
                nombre = nombre,
                dni = dni,
                email = email,
                telefono = telefono,
                direccion = direccion,
                mascotas = mascotas,
                fotoPath = fotoPath
            )
        )
        val cantidad = mascotas.count { it != SIN_MASCOTAS }
        registrar(
            TipoActividad.REGISTRO,
            "$nombre creó su cuenta" + when (cantidad) {
                0 -> ""
                1 -> " con 1 mascota"
                else -> " con $cantidad mascotas"
            }
        )
    }

    fun registrarNuevoVet(
        nombre: String, email: String, matricula: String, clinica: String,
        direccion: String, telefono: String, especialidades: String, horarios: String,
        dni: String = "", fotoPath: String? = null
    ) {
        listaVeterinarios.add(
            0, VetAdminItem(
                id = nextVetId++,
                nombre = nombre,
                email = email,
                matricula = matricula,
                clinica = clinica,
                direccion = direccion,
                telefono = telefono,
                especialidades = especialidades,
                diasYHorarios = horarios,
                estado = PENDIENTE,
                dni = dni,
                fotoPath = fotoPath
            )
        )
        registrar(TipoActividad.REGISTRO, "$nombre pidió el alta como veterinario/a")
    }

    // ---------- Utilidades de presentación ----------

    /** Iniciales para el avatar, sin el "Dr." o "Dra." del principio. */
    fun iniciales(nombre: String): String {
        val partes = nombre.replace(Regex("^(Dr\\.|Dra\\.)\\s*"), "").trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        return when {
            partes.isEmpty() -> "?"
            partes.size == 1 -> partes[0].take(1).uppercase()
            else -> (partes[0].take(1) + partes[1].take(1)).uppercase()
        }
    }
}
