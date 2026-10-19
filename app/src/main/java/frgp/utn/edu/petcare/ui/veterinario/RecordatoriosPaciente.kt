package frgp.utn.edu.petcare.ui.veterinario

import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.repositorio.Paciente
import frgp.utn.edu.petcare.data.repositorio.RecordatorioManual
import frgp.utn.edu.petcare.data.repositorio.RecordatoriosRepo
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.EditorRecordatorio
import frgp.utn.edu.petcare.util.Fechas

/**
 * Recordatorios que el veterinario le deja a un paciente (un control, una dosis, un estudio): el dueño los ve en
 * su lista y recibe un aviso. Acá se ven, editan y borran los que dejó el propio veterinario.
 */
object RecordatoriosPaciente {

    fun mostrar(host: AppCompatActivity, paciente: Paciente) {
        val propios = RecordatoriosRepo.deMascota(paciente.id).filter { it.esMio }
        val etiquetas = propios.map {
            it.titulo + "\n" + Fechas.corta(it.fecha) + (it.hora?.let { h -> " · $h hs" } ?: "")
        }
        val dialogo = AlertDialog.Builder(host)
            .setTitle("Recordatorios de ${paciente.nombre}")
            .setPositiveButton("Nuevo") { _, _ ->
                EditorRecordatorio.mostrar(host, listOf(paciente.id to paciente.nombre)) {
                    Avisos.mostrar(host, "Le avisamos al dueño de ${paciente.nombre}")
                    mostrar(host, paciente)
                }
            }
            .setNegativeButton("Cerrar", null)
        if (propios.isEmpty()) {
            dialogo.setMessage("Todavía no dejaste recordatorios para ${paciente.nombre}. El dueño recibe un aviso cuando creás uno.")
        } else {
            dialogo.setItems(etiquetas.toTypedArray()) { _, i -> opciones(host, paciente, propios[i]) }
        }
        dialogo.show()
    }

    private fun opciones(host: AppCompatActivity, paciente: Paciente, r: RecordatorioManual) {
        AlertDialog.Builder(host)
            .setTitle(r.titulo)
            .setItems(arrayOf("Editar", "Eliminar")) { _, i ->
                if (i == 0) {
                    EditorRecordatorio.mostrar(host, listOf(paciente.id to paciente.nombre), r) { mostrar(host, paciente) }
                } else {
                    Avisos.confirmar(
                        host, "¿Eliminar el recordatorio?", "\"${r.titulo}\" también deja de verse en la lista del dueño.",
                        textoAceptar = "Eliminar"
                    ) {
                        RecordatoriosRepo.borrar(r)
                        mostrar(host, paciente)
                    }
                }
            }
            .setNegativeButton(R.string.btn_cancelar) { _, _ -> mostrar(host, paciente) }
            .show()
    }
}
