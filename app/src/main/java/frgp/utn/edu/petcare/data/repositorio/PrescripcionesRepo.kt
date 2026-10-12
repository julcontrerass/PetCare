package frgp.utn.edu.petcare.data.repositorio

import frgp.utn.edu.petcare.data.remoto.NuevaPrescripcionDto
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.model.Prescripcion
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

/** Medicamentos que el veterinario en sesión receta a sus pacientes; los de una consulta forman su receta. */
object PrescripcionesRepo {

    private val lista = mutableListOf<Prescripcion>()

    fun limpiar() = lista.clear()

    /** Vuelve a pedir al servidor las recetas de ese paciente. */
    suspend fun cargar(pacienteId: String) {
        val nuevas = Servicios.fuente.prescripciones(pacienteId).map(Prescripcion::deDto)
        lista.removeAll { it.mascotaId == pacienteId }
        lista.addAll(nuevas)
    }

    /** Las recetas de la consulta (o las que se hicieron sin turno, desde la ficha del paciente). */
    fun deConsulta(pacienteId: String, turnoId: String?): List<Prescripcion> =
        lista.filter { it.mascotaId == pacienteId && it.turnoId == turnoId }
            .sortedBy { it.creada ?: LocalDateTime.MIN }

    fun deMascota(pacienteId: String): List<Prescripcion> = lista.filter { it.mascotaId == pacienteId }

    fun agregar(
        pacienteId: String, turnoId: String?, medicamento: String, dosis: String, frecuenciaHoras: Int?,
        duracionDias: Int?, indicaciones: String
    ): Prescripcion {
        val p = Prescripcion(
            id = UUID.randomUUID().toString(), mascotaId = pacienteId, turnoId = turnoId,
            medicamento = medicamento.trim(), dosis = dosis.trim(), frecuenciaHoras = frecuenciaHoras,
            duracionDias = duracionDias, indicaciones = indicaciones.trim(), inicio = LocalDate.now(),
            creada = LocalDateTime.now()
        )
        lista.add(p)
        Servicios.escribir(alFallar = { cargar(pacienteId); Servicios.avisarCambio() }) {
            Servicios.fuente.crearPrescripcion(
                NuevaPrescripcionDto(
                    id = p.id, mascotaId = pacienteId, turnoId = turnoId,
                    veterinarioId = Sesion.usuarioId ?: error("No hay una sesión iniciada"),
                    medicamento = p.medicamento, dosis = p.dosis.ifBlank { null }, frecuenciaHoras = frecuenciaHoras,
                    duracionDias = duracionDias, indicaciones = p.indicaciones.ifBlank { null },
                    inicio = p.inicio.toString()
                )
            )
        }
        return p
    }

    fun eliminar(p: Prescripcion) {
        lista.remove(p)
        Servicios.escribir(alFallar = { cargar(p.mascotaId); Servicios.avisarCambio() }) {
            Servicios.fuente.eliminarPrescripcion(p.id)
        }
    }
}
