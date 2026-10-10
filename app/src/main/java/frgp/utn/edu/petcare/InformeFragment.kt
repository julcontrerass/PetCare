package frgp.utn.edu.petcare

import android.os.Bundle
import frgp.utn.edu.petcare.ui.common.ArchivosUi
import frgp.utn.edu.petcare.data.Errores
import androidx.activity.result.contract.ActivityResultContracts
import android.widget.TextView
import android.widget.LinearLayout
import android.widget.ImageView
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import frgp.utn.edu.petcare.ui.common.Avisos
import kotlinx.coroutines.launch

/** Pestaña "Informe" de la ficha del paciente: lo que el veterinario escribe durante o después del turno. */
class InformeFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_informe_paciente, container, false)
        val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as AppCompatActivity)

        val etMotivo = view.findViewById<EditText>(R.id.etMotivoConsulta)
        val etDiagnostico = view.findViewById<EditText>(R.id.etDiagnostico)
        val etTratamiento = view.findViewById<EditText>(R.id.etTratamiento)
        val btnGuardar = view.findViewById<MaterialButton>(R.id.btnGuardarInforme)

        val turnoId = requireActivity().intent.getStringExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID)
        val turno = AgendaRepo.porId(turnoId)
        val motivoTurno = turno?.motivo.orEmpty()

        val contenedorArchivos = view.findViewById<LinearLayout>(R.id.llArchivosInforme)
        val sinArchivos = view.findViewById<View>(R.id.tvSinArchivosInforme)
        fun archivosDeLaConsulta() =
            if (turnoId != null) ArchivosRepo.deTurno(paciente.id, turnoId)
            else ArchivosRepo.dePaciente(paciente.id).filter { it.turnoId == null }

        fun dibujarArchivos() {
            contenedorArchivos.removeAllViews()
            val lista = archivosDeLaConsulta()
            if (lista.isEmpty()) {
                contenedorArchivos.addView(sinArchivos)
                return
            }
            lista.forEach { archivo ->
                val fila = layoutInflater.inflate(R.layout.item_turno_detalle, contenedorArchivos, false)
                fila.findViewById<ImageView>(R.id.ivDetalleIcono).setImageResource(archivo.iconRes)
                fila.findViewById<TextView>(R.id.tvDetalleTitulo).text = archivo.fecha
                fila.findViewById<TextView>(R.id.tvDetalleValor).text = archivo.nombre
                fila.findViewById<TextView>(R.id.tvDetalleAccion).apply {
                    text = "Quitar"
                    setTextColor(requireContext().getColor(R.color.danger_red))
                    visibility = View.VISIBLE
                    setOnClickListener {
                        Avisos.confirmar(
                            requireContext(), "¿Quitar el archivo?",
                            "Se borra '${archivo.nombre}' de la consulta y de la ficha.",
                            textoAceptar = "Quitar", textoCancelar = "Cancelar"
                        ) {
                            ArchivosRepo.eliminar(archivo)
                            dibujarArchivos()
                        }
                    }
                }
                fila.setOnClickListener {
                    viewLifecycleOwner.lifecycleScope.launch {
                        ArchivosUi.abrir(requireContext(), ArchivosRepo.BUCKET, archivo.storagePath, archivo.tipoExtension)
                    }
                }
                contenedorArchivos.addView(fila)
            }
        }
        dibujarArchivos()
        viewLifecycleOwner.lifecycleScope.launch {
            runCatching { ArchivosRepo.cargar(paciente.id) }.onSuccess { dibujarArchivos() }
        }

        val elegirArchivo = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            if (uri == null) return@registerForActivityResult
            viewLifecycleOwner.lifecycleScope.launch {
                val elegido = ArchivosUi.leer(requireContext(), uri) ?: return@launch
                try {
                    ArchivosRepo.agregar(paciente.id, elegido.nombre, elegido.extension, elegido.bytes, elegido.mime, turnoId)
                    dibujarArchivos()
                    Avisos.exito(requireContext(), "Archivo adjuntado a la consulta")
                } catch (e: Exception) {
                    Avisos.error(requireContext(), Errores.mensaje(e))
                }
            }
        }
        view.findViewById<View>(R.id.btnAdjuntarArchivo).setOnClickListener { elegirArchivo.launch("*/*") }

        fun mostrar(informe: InformeData) {
            etMotivo?.setText(informe.motivo.ifBlank { motivoTurno })
            etDiagnostico?.setText(informe.diagnostico)
            etTratamiento?.setText(informe.tratamiento)
        }

        // Lo que ya había escrito el veterinario se pide al servidor; mientras tanto se ve el motivo del turno
        mostrar(InformesRepo.obtener(paciente.id, turnoId))
        viewLifecycleOwner.lifecycleScope.launch {
            runCatching { InformesRepo.cargar(paciente.id, turnoId) }.onSuccess { mostrar(it) }
        }

        btnGuardar?.setOnClickListener {
            val m = etMotivo?.text?.toString().orEmpty().trim()
            val d = etDiagnostico?.text?.toString().orEmpty().trim()
            val t = etTratamiento?.text?.toString().orEmpty().trim()
            if (d.isEmpty() && t.isEmpty()) {
                Avisos.aviso(requireContext(), "Completá al menos el diagnóstico o el tratamiento")
                return@setOnClickListener
            }

            InformesRepo.guardar(paciente.id, m, d, t, turnoId)
            if (turno == null || turno.estado != EstadoEvento.PENDIENTE) {
                Avisos.exito(requireContext(), "Informe guardado")
                return@setOnClickListener
            }
            // Durante un turno, guardar el informe es el momento natural para cerrarlo
            Avisos.confirmar(
                requireContext(), "Informe guardado",
                "¿Querés dar por terminado el turno de ${paciente.nombre}? Queda como completado en tu agenda " +
                    "y el dueño puede ver el informe.",
                textoAceptar = "Completar turno", textoCancelar = "Todavía no", peligro = false,
                icono = R.drawable.ic_check_circle
            ) {
                AgendaRepo.cambiarEstado(turno, EstadoEvento.COMPLETADO)
                requireActivity().finish()
            }
        }

        return view
    }
}
