package frgp.utn.edu.petcare

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
    var estado: String // "PENDIENTE_REVISION", "ACTIVO", "RECHAZADO"
)

data class DuenoAdminItem(
    val id: Int,
    val nombre: String,
    val dni: String,
    val email: String,
    val telefono: String,
    val direccion: String,
    val mascotas: List<String>
)

object AdminRepo {
    private var nextVetId = 200

    val listaVeterinarios = mutableListOf(
        VetAdminItem(
            1, "Dr. Juan Pérez", "juan.perez@clinica.com", "MP-12345",
            "Clínica Veterinaria Central", "Av. Santa Fe 2345, CABA", "+54 11 4000-1234",
            "Cirugía Veterinaria, Dermatología", "Lun a Vie · 09:00 a 18:00 hs", "ACTIVO"
        ),
        VetAdminItem(
            2, "Dra. Laura Sosa", "laura.sosa@petcare.com", "MP-24890",
            "Centro Veterinario Norte", "Cabildo 1500, CABA", "+54 11 4555-8822",
            "Vacunación, Odontología", "Lun a Sáb · 08:00 a 16:00 hs", "PENDIENTE_REVISION"
        ),
        VetAdminItem(
            3, "Dr. Pablo Medina", "pablo.medina@petcare.com", "MP-19340",
            "Consultorio Vet Medina", "Belgrano 450, CABA", "+54 11 4777-1133",
            "Análisis de laboratorio, Ecografía", "Mar a Sáb · 10:00 a 19:00 hs", "PENDIENTE_REVISION"
        ),
        VetAdminItem(
            4, "Dr. Alejandro Ramírez", "alejandro.ramirez@petcare.com", "MP-23456",
            "Veterinaria San Martín", "San Martín 890, CABA", "+54 11 4222-3344",
            "Vacunas, Control general", "Lun a Vie · 09:00 a 17:00 hs", "ACTIVO"
        ),
        VetAdminItem(
            5, "Dra. Carla Méndez", "carla.mendez@petcare.com", "MP-98765",
            "Pet Care Palermo", "Palermo 120, CABA", "+54 11 4111-9988", "Control general",
            "Lun a Vie · 10:00 a 18:00 hs", "ACTIVO"
        )
    )

    val listaDuenos = mutableListOf(
        DuenoAdminItem(1, "Julieta Gómez", "38123456", "julieta.gomez@email.com", "+54 11 5555-1200", "Av. Corrientes 2450, CABA", listOf("Koda (Golden Retriever)", "Mia (Maltés)")),
        DuenoAdminItem(2, "Lucas Rodríguez", "36987654", "lucas.rodriguez@email.com", "+54 11 4777-8899", "Juramento 1800, CABA", listOf("Milo (Bulldog Francés)")),
        DuenoAdminItem(3, "María Fernández", "35444555", "m.fernandez@email.com", "+54 11 4444-5555", "Av. Santa Fe 1234, CABA", listOf("Luna (Gato Siamés)")),
        DuenoAdminItem(4, "Carlos Pérez", "39888221", "carlos.perez@email.com", "+54 11 4888-2211", "Cabildo 3300, CABA", listOf("Simba (Gato Maine Coon)")),
        DuenoAdminItem(5, "Ana Martínez", "40111222", "ana@mail.com", "+54 11 4333-7777", "Rivadavia 5000, CABA", listOf("Rocky (Pug)"))
    )

    private var nextDuenoId = 100

    fun registrarNuevoDueno(
        nombre: String, dni: String, email: String, telefono: String,
        direccion: String, mascotas: List<String>
    ) {
        listaDuenos.add(
            0, DuenoAdminItem(
                id = nextDuenoId++,
                nombre = nombre,
                dni = dni,
                email = email,
                telefono = telefono,
                direccion = direccion,
                mascotas = mascotas
            )
        )
    }

    fun pendientesRevisionCount(): Int = listaVeterinarios.count { it.estado == "PENDIENTE_REVISION" }

    fun aprobarVet(id: Int) {
        listaVeterinarios.firstOrNull { it.id == id }?.estado = "ACTIVO"
    }

    fun rechazarVet(id: Int) {
        listaVeterinarios.firstOrNull { it.id == id }?.estado = "RECHAZADO"
    }

    fun registrarNuevoVet(
        nombre: String, email: String, matricula: String, clinica: String,
        direccion: String, telefono: String, especialidades: String, horarios: String
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
                estado = "PENDIENTE_REVISION"
            )
        )
    }
}
