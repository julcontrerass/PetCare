package frgp.utn.edu.petcare

data class Paciente(
    val id: Int,
    val nombre: String,
    val especie: String,
    val raza: String,
    val sexo: String,
    val nacimiento: String,
    val fotoRes: Int,
    val peso: String,
    val microchip: String,
    val color: String,
    val observaciones: String,
    val propietario: String,
    val direccion: String,
    val telefono: String,
    val email: String,
    val ultimaConsulta: String,
    val proximoRecordatorio: String
) {
    val razaYSexo: String get() = "$raza - $sexo"
}

/** Datos de demostración hasta que exista el backend. */
object PacientesRepo {

    const val ESPECIE_PERRO = "Perro"
    const val ESPECIE_GATO = "Gato"
    const val ESPECIE_OTRO = "Otro"

    private val lista: MutableList<Paciente> = mutableListOf(
        Paciente(
            1, "Koda", ESPECIE_PERRO, "Golden Retriever", "Macho", "12 Mar 2020 (6 años)", R.drawable.milo,
            "28 kg", "981020000111222", "Dorado", "Sin observaciones.",
            "Julieta Gómez", "Av. Corrientes 2450, CABA", "+54 11 5555-1200", "julieta.gomez@email.com",
            "10 May 2026", "Vacuna antirrábica • 10 May 2027"
        ),
        Paciente(
            2, "Mia", ESPECIE_PERRO, "Maltés", "Hembra", "03 Jul 2021 (5 años)", R.drawable.luna,
            "3.8 kg", "981020000222333", "Blanco", "Alergia a algunos alimentos con pollo.",
            "Julieta Gómez", "Av. Corrientes 2450, CABA", "+54 11 5555-1200", "julieta.gomez@email.com",
            "22 Abr 2026", "Control general • 22 Oct 2026"
        ),
        Paciente(
            3, "Milo", ESPECIE_PERRO, "Bulldog Francés", "Macho", "15 Nov 2019 (6 años)", R.drawable.milo,
            "12 kg", "981020000333444", "Atigrado", "Sensible al calor. Evitar ejercicio intenso.",
            "Lucas Rodríguez", "Juramento 1800, CABA", "+54 11 4777-8899", "lucas.rodriguez@email.com",
            "02 May 2026", "Desparasitación • 02 Ago 2026"
        ),
        Paciente(
            4, "Luna", ESPECIE_GATO, "Gato Siamés", "Hembra", "20 May 2018 (8 años)", R.drawable.luna,
            "4.5 kg", "981020000123456", "Marrón y Negro", "Sensibilidad a ciertos tipos de arena para gatos.",
            "María Fernández", "Av. Santa Fe 1234, CABA", "+54 11 4444-5555", "m.fernandez@email.com",
            "18 May 2026", "Vacuna antirrábica • 18 May 2027"
        ),
        Paciente(
            5, "Simba", ESPECIE_GATO, "Gato Maine Coon", "Macho", "08 Ene 2022 (4 años)", R.drawable.milo,
            "7.2 kg", "981020000444555", "Naranja", "Sin observaciones.",
            "Carlos Pérez", "Cabildo 3300, CABA", "+54 11 4888-2211", "carlos.perez@email.com",
            "30 Abr 2026", "Vacuna triple felina • 30 Abr 2027"
        )
    )

    val pacientes: List<Paciente> get() = lista

    /** Agrega un paciente nuevo (alta manual o solicitud aceptada) y devuelve el paciente con su id. */
    fun agregar(base: Paciente): Paciente {
        val nuevo = base.copy(id = (lista.maxOfOrNull { it.id } ?: 0) + 1)
        lista.add(nuevo)
        return nuevo
    }

    fun nuevo(
        nombre: String, especie: String, raza: String, sexo: String,
        propietario: String, telefono: String
    ) = Paciente(
        0, nombre, especie, raza.ifBlank { especie }, sexo, "Sin datos", R.drawable.ic_dog,
        "Sin datos", "Sin datos", "Sin datos", "Sin observaciones",
        propietario, "Sin datos", telefono.ifBlank { "Sin datos" }, "Sin datos",
        "Sin consultas", "Sin recordatorios"
    )

    /**
     * Cuando un dueño agenda un turno con este veterinario, la mascota pasa a ser su paciente
     * sin pedir autorización. Si ya la tiene, devuelve la existente.
     */
    @JvmStatic
    fun registrarDesdeDueno(
        nombre: String, especie: String, raza: String, sexo: String, nacimiento: String,
        fotoRes: Int, peso: String, microchip: String, color: String, observaciones: String,
        propietario: String, direccion: String, telefono: String, email: String
    ): Paciente {
        lista.firstOrNull {
            it.nombre.equals(nombre, ignoreCase = true) && it.propietario.equals(propietario, ignoreCase = true)
        }?.let { return it }
        return agregar(
            Paciente(
                0, nombre, especie, raza.ifBlank { especie }, sexo, nacimiento,
                if (fotoRes != 0) fotoRes else R.drawable.ic_dog,
                peso, microchip, color, observaciones, propietario, direccion, telefono, email,
                "Sin consultas", "Sin recordatorios"
            )
        )
    }

    fun porId(id: Int): Paciente = pacientes.firstOrNull { it.id == id } ?: pacientes.first()

    fun filtrar(consulta: String, especie: String?): List<Paciente> {
        val q = consulta.trim().lowercase()
        return pacientes.filter { p ->
            (especie == null || p.especie == especie) &&
                (q.isEmpty() ||
                    p.nombre.lowercase().contains(q) ||
                    p.raza.lowercase().contains(q) ||
                    p.propietario.lowercase().contains(q))
        }
    }
}
