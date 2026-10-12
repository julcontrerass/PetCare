package frgp.utn.edu.petcare.ui.veterinario

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import frgp.utn.edu.petcare.data.CatalogoMedico
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.repositorio.AgendaRepo
import frgp.utn.edu.petcare.data.repositorio.ArchivosRepo
import frgp.utn.edu.petcare.data.repositorio.EstadoEvento
import frgp.utn.edu.petcare.data.repositorio.InformeData
import frgp.utn.edu.petcare.data.repositorio.InformesRepo
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.data.repositorio.PrescripcionesRepo
import frgp.utn.edu.petcare.data.repositorio.SaludRepo
import frgp.utn.edu.petcare.data.repositorio.TipoRegistro
import frgp.utn.edu.petcare.model.Prescripcion
import frgp.utn.edu.petcare.model.SignosVitales
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.ArchivosUi
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.Documentos
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Pestaña "Informe" de la ficha del paciente: lo que el veterinario escribe durante o después del turno. */
class InformeFragment : Fragment() {

    private fun decimal(campo: EditText?): Double? =
        campo?.text?.toString().orEmpty().trim().replace(',', '.').toDoubleOrNull()

    private fun entero(campo: EditText?): Int? = campo?.text?.toString().orEmpty().trim().toIntOrNull()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_informe_paciente, container, false)
        val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as AppCompatActivity)

        val etMotivo = view.findViewById<EditText>(R.id.etMotivoConsulta)
        val etAnamnesis = view.findViewById<EditText>(R.id.etAnamnesis)
        val etPeso = view.findViewById<EditText>(R.id.etPeso)
        val etTemperatura = view.findViewById<EditText>(R.id.etTemperatura)
        val etFrecuenciaCardiaca = view.findViewById<EditText>(R.id.etFrecuenciaCardiaca)
        val etFrecuenciaRespiratoria = view.findViewById<EditText>(R.id.etFrecuenciaRespiratoria)
        val etExamen = view.findViewById<EditText>(R.id.etExamenFisico)
        val etDiagnostico = view.findViewById<EditText>(R.id.etDiagnostico)
        val etTratamiento = view.findViewById<EditText>(R.id.etTratamiento)
        val btnGuardar = view.findViewById<MaterialButton>(R.id.btnGuardarInforme)

        val turnoId = requireActivity().intent.getStringExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID)
        val turno = AgendaRepo.porId(turnoId)
        val motivoTurno = turno?.motivo.orEmpty()

        // ---------- Archivos adjuntos ----------
        val contenedorArchivos = view.findViewById<LinearLayout>(R.id.llArchivosInforme)
        val sinArchivos = view.findViewById<View>(R.id.tvSinArchivosInforme)
        // Con turno se ven los adjuntos de ese turno. Sin turno la lista parte vacía: lo que ya estaba cargado
        // vive en los archivos de la mascota, y acá solo se muestra lo que se adjunta en esta pantalla.
        val adjuntadosAhora = mutableSetOf<String>()
        fun archivosDeLaConsulta() =
            if (turnoId != null) ArchivosRepo.deTurno(paciente.id, turnoId)
            else ArchivosRepo.dePaciente(paciente.id).filter { it.id in adjuntadosAhora }

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
                    val nuevo = ArchivosRepo.agregar(
                        paciente.id, elegido.nombre, elegido.extension, elegido.bytes, elegido.mime, turnoId
                    )
                    adjuntadosAhora.add(nuevo.id)
                    dibujarArchivos()
                    Avisos.exito(requireContext(), "Archivo adjuntado a la consulta")
                } catch (e: Exception) {
                    Avisos.error(requireContext(), Errores.mensaje(e))
                }
            }
        }
        view.findViewById<View>(R.id.btnAdjuntarArchivo).setOnClickListener { elegirArchivo.launch("*/*") }

        // ---------- Receta ----------
        val contenedorReceta = view.findViewById<LinearLayout>(R.id.llRecetaInforme)
        val sinReceta = view.findViewById<View>(R.id.tvSinReceta)
        val btnRecetaPdf = view.findViewById<View>(R.id.btnRecetaPdf)

        fun dibujarReceta() {
            contenedorReceta.removeAllViews()
            val medicamentos = PrescripcionesRepo.deConsulta(paciente.id, turnoId)
            btnRecetaPdf.visibility = if (medicamentos.isEmpty()) View.GONE else View.VISIBLE
            if (medicamentos.isEmpty()) {
                contenedorReceta.addView(sinReceta)
                return
            }
            medicamentos.forEach { m ->
                val fila = layoutInflater.inflate(R.layout.item_turno_detalle, contenedorReceta, false)
                fila.findViewById<ImageView>(R.id.ivDetalleIcono).setImageResource(R.drawable.ic_syringe)
                fila.findViewById<TextView>(R.id.tvDetalleTitulo).text = m.medicamento
                fila.findViewById<TextView>(R.id.tvDetalleValor).text =
                    m.posologia.ifBlank { "Sin dosis indicada" } +
                        m.indicaciones.takeIf { it.isNotBlank() }?.let { "\n$it" }.orEmpty()
                fila.findViewById<TextView>(R.id.tvDetalleAccion).apply {
                    text = "Quitar"
                    setTextColor(requireContext().getColor(R.color.danger_red))
                    visibility = View.VISIBLE
                    setOnClickListener {
                        PrescripcionesRepo.eliminar(m)
                        dibujarReceta()
                    }
                }
                contenedorReceta.addView(fila)
            }
        }
        dibujarReceta()
        viewLifecycleOwner.lifecycleScope.launch {
            runCatching { PrescripcionesRepo.cargar(paciente.id) }.onSuccess { dibujarReceta() }
        }

        view.findViewById<View>(R.id.btnAgregarMedicamento).setOnClickListener {
            val hoja = BottomSheetDialog(requireContext())
            val vista = layoutInflater.inflate(R.layout.sheet_medicamento, null)
            hoja.setContentView(vista)
            vista.findViewById<View>(R.id.btnCancelarMedicamento).setOnClickListener { hoja.dismiss() }
            vista.findViewById<View>(R.id.btnGuardarMedicamento).setOnClickListener {
                val nombre = vista.findViewById<EditText>(R.id.etMedicamento)
                if (nombre.text.isBlank()) {
                    nombre.error = "Indicá el medicamento"
                    return@setOnClickListener
                }
                val cada = entero(vista.findViewById(R.id.etCadaHoras))
                val dias = entero(vista.findViewById(R.id.etDias))
                if ((cada != null && cada !in 1..168) || (dias != null && dias !in 1..365)) {
                    Avisos.aviso(requireContext(), "Revisá las horas (1 a 168) y los días (1 a 365)")
                    return@setOnClickListener
                }
                PrescripcionesRepo.agregar(
                    paciente.id, turnoId, nombre.text.toString(),
                    vista.findViewById<EditText>(R.id.etDosis).text.toString(), cada, dias,
                    vista.findViewById<EditText>(R.id.etIndicacionesMedicamento).text.toString()
                )
                dibujarReceta()
                hoja.dismiss()
            }
            hoja.show()
        }

        btnRecetaPdf.setOnClickListener {
            val medicamentos = PrescripcionesRepo.deConsulta(paciente.id, turnoId)
            if (medicamentos.isEmpty()) return@setOnClickListener
            val contexto = requireContext()
            val indicaciones = etTratamiento?.text?.toString().orEmpty().trim()
            viewLifecycleOwner.lifecycleScope.launch {
                val archivo = withContext(Dispatchers.IO) {
                    Documentos.receta(
                        contexto, PerfilVetRepo.comoProfesional(), paciente.comoDocumento(), LocalDate.now(),
                        medicamentos, indicaciones
                    )
                }
                Documentos.compartir(contexto, archivo, "Receta de ${paciente.nombre}")
            }
        }

        // ---------- Vacunas aplicadas en la consulta ----------
        val contenedorVacunas = view.findViewById<LinearLayout>(R.id.llVacunasInforme)
        val sinVacunas = view.findViewById<View>(R.id.tvSinVacunas)
        // La vacuna se anota con el día del turno (o con hoy si no hay turno o es a futuro)
        val diaDeLaConsulta = turno?.fecha?.takeIf { !it.isAfter(LocalDate.now()) } ?: LocalDate.now()

        fun dibujarVacunas() {
            contenedorVacunas.removeAllViews()
            val aplicadas = SaludRepo.registros.filter {
                it.mascotaId == paciente.id && it.tipo == TipoRegistro.VACUNA && it.fechaAplicada == diaDeLaConsulta
            }
            if (aplicadas.isEmpty()) {
                contenedorVacunas.addView(sinVacunas)
                return
            }
            aplicadas.forEach { v ->
                val fila = layoutInflater.inflate(R.layout.item_turno_detalle, contenedorVacunas, false)
                fila.findViewById<ImageView>(R.id.ivDetalleIcono).setImageResource(R.drawable.ic_syringe)
                fila.findViewById<TextView>(R.id.tvDetalleTitulo).text = v.titulo
                fila.findViewById<TextView>(R.id.tvDetalleValor).text = v.detalle
                fila.findViewById<TextView>(R.id.tvDetalleAccion).apply {
                    text = "Quitar"
                    setTextColor(requireContext().getColor(R.color.danger_red))
                    visibility = View.VISIBLE
                    setOnClickListener {
                        SaludRepo.eliminar(v)
                        dibujarVacunas()
                    }
                }
                contenedorVacunas.addView(fila)
            }
        }
        dibujarVacunas()

        fun elegirFecha(campo: EditText) {
            val hoy = LocalDate.now()
            android.app.DatePickerDialog(
                requireContext(), { _, a, m, d -> campo.setText(Fechas.corta(LocalDate.of(a, m + 1, d))) },
                hoy.year, hoy.monthValue - 1, hoy.dayOfMonth
            ).show()
        }

        view.findViewById<View>(R.id.btnRegistrarVacuna).setOnClickListener {
            val hoja = BottomSheetDialog(requireContext())
            val vista = layoutInflater.inflate(R.layout.sheet_vacuna, null)
            hoja.setContentView(vista)
            vista.findViewById<TextView>(R.id.tvVacunaPaciente).text =
                "${paciente.nombre} · ${Fechas.corta(diaDeLaConsulta)}"
            val nombre = vista.findViewById<android.widget.AutoCompleteTextView>(R.id.etVacunaNombre)
            nombre.setAdapter(
                android.widget.ArrayAdapter(
                    requireContext(), android.R.layout.simple_dropdown_item_1line,
                    CatalogoMedico.vacunasHabituales(paciente.especie)
                )
            )
            nombre.setOnFocusChangeListener { _, tieneFoco -> if (tieneFoco) nombre.showDropDown() }
            val venceLote = vista.findViewById<EditText>(R.id.etVacunaVenceLote)
            val proxima = vista.findViewById<EditText>(R.id.etVacunaProximaDosis)
            venceLote.setOnClickListener { elegirFecha(venceLote) }
            proxima.setOnClickListener { elegirFecha(proxima) }
            vista.findViewById<View>(R.id.btnCancelarVacuna).setOnClickListener { hoja.dismiss() }
            vista.findViewById<View>(R.id.btnGuardarVacuna).setOnClickListener {
                val titulo = nombre.text.toString().trim()
                if (titulo.isEmpty()) {
                    nombre.error = "Indicá la vacuna"
                    return@setOnClickListener
                }
                SaludRepo.agregar(
                    TipoRegistro.VACUNA, paciente.id, titulo, null, diaDeLaConsulta,
                    proximaDosis = Fechas.parsear(proxima.text.toString()),
                    marca = vista.findViewById<EditText>(R.id.etVacunaMarca).text.toString().trim().ifEmpty { null },
                    lote = vista.findViewById<EditText>(R.id.etVacunaLote).text.toString().trim().ifEmpty { null },
                    loteVencimiento = Fechas.parsear(venceLote.text.toString())
                )
                dibujarVacunas()
                hoja.dismiss()
                Avisos.exito(requireContext(), "Vacuna guardada en el carnet de ${paciente.nombre}")
            }
            hoja.show()
        }

        // ---------- Informe ----------
        fun mostrar(informe: InformeData) {
            etMotivo?.setText(informe.motivo.ifBlank { motivoTurno })
            etAnamnesis?.setText(informe.anamnesis)
            etExamen?.setText(informe.examenFisico)
            etDiagnostico?.setText(informe.diagnostico)
            etTratamiento?.setText(informe.tratamiento)
            etPeso?.setText(informe.signos.pesoKg?.let { SignosVitales.numero(it) }.orEmpty())
            etTemperatura?.setText(informe.signos.temperaturaC?.let { SignosVitales.numero(it) }.orEmpty())
            etFrecuenciaCardiaca?.setText(informe.signos.frecuenciaCardiaca?.toString().orEmpty())
            etFrecuenciaRespiratoria?.setText(informe.signos.frecuenciaRespiratoria?.toString().orEmpty())
        }

        // Lo que ya había escrito el veterinario se pide al servidor; mientras tanto se ve el motivo del turno
        mostrar(InformesRepo.obtener(paciente.id, turnoId))
        viewLifecycleOwner.lifecycleScope.launch {
            runCatching { InformesRepo.cargar(paciente.id, turnoId) }.onSuccess { mostrar(it) }
        }

        /** Lee los signos vitales y comprueba que sean valores posibles; si no, avisa cuál está mal. */
        fun leerSignos(): SignosVitales? {
            val peso = decimal(etPeso)
            val temperatura = decimal(etTemperatura)
            val fc = entero(etFrecuenciaCardiaca)
            val fr = entero(etFrecuenciaRespiratoria)
            val problema = when {
                etPeso?.text?.isNotBlank() == true && (peso == null || peso <= 0 || peso > SignosVitales.PESO_MAXIMO) ->
                    "El peso tiene que estar entre 0 y 999 kg"
                etTemperatura?.text?.isNotBlank() == true && (temperatura == null || temperatura !in SignosVitales.TEMPERATURA) ->
                    "La temperatura tiene que estar entre 25 y 45 °C"
                etFrecuenciaCardiaca?.text?.isNotBlank() == true && (fc == null || fc !in SignosVitales.FRECUENCIA_CARDIACA) ->
                    "La frecuencia cardíaca tiene que estar entre 10 y 400 lpm"
                etFrecuenciaRespiratoria?.text?.isNotBlank() == true && (fr == null || fr !in SignosVitales.FRECUENCIA_RESPIRATORIA) ->
                    "La frecuencia respiratoria tiene que estar entre 2 y 200 rpm"
                else -> null
            }
            if (problema != null) {
                Avisos.aviso(requireContext(), problema)
                return null
            }
            return SignosVitales(peso, temperatura, fc, fr)
        }

        btnGuardar?.setOnClickListener {
            val signos = leerSignos() ?: return@setOnClickListener
            val m = etMotivo?.text?.toString().orEmpty().trim()
            val a = etAnamnesis?.text?.toString().orEmpty().trim()
            val e = etExamen?.text?.toString().orEmpty().trim()
            val d = etDiagnostico?.text?.toString().orEmpty().trim()
            val t = etTratamiento?.text?.toString().orEmpty().trim()
            if (d.isEmpty() && t.isEmpty() && a.isEmpty() && e.isEmpty() && signos.vacio) {
                Avisos.aviso(requireContext(), "Completá al menos la anamnesis, los signos vitales, el diagnóstico o el tratamiento")
                return@setOnClickListener
            }

            InformesRepo.guardar(paciente.id, m, d, t, turnoId, a, e, signos)
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
