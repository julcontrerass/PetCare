package frgp.utn.edu.petcare

import android.app.Activity
import frgp.utn.edu.petcare.ui.common.Avisos
import android.app.TimePickerDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Registro
import kotlinx.coroutines.launch
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import java.io.File
import java.util.Locale

/**
 * Alta de cuenta del veterinario en cinco pasos. Al terminar guarda los datos en [PerfilVetRepo]
 * y devuelve el correo y la contraseña para que la pantalla de inicio registre la cuenta.
 */
class RegistroVeterinarioActivity : BaseActivity() {

    companion object {
        const val EXTRA_EMAIL = "email"
        const val EXTRA_CONFIRMAR_CORREO = "confirmar_correo"

        private const val ESTADO_PASO = "paso"
        private const val ESTADO_ESPECIALIDADES = "especialidades"
        private const val ESTADO_DIAS = "dias"
        private const val ESTADO_APERTURA = "apertura"
        private const val ESTADO_CIERRE = "cierre"
        private const val ESTADO_FOTO = "foto"
        private const val ESTADO_TITULO = "titulo"
        private val TITULOS_PROFESIONALES = listOf("Dr.", "Dra.")

        private val TITULOS = listOf(
            "Datos personales", "Profesión y veterinaria", "Especialidades", "Días y horarios", "Tu cuenta"
        )
    }

    private var paso = 0
    private var especialidades = BooleanArray(PerfilVetRepo.todasLasEspecialidades.size)
    private var dias = booleanArrayOf(true, true, true, true, true, false, false)
    private var apertura = "09:00"
    private var cierre = "18:00"
    private var fotoPath: String? = null
    private var titulo: String? = null

    private lateinit var paneles: List<View>
    private lateinit var segmentos: List<View>
    private lateinit var btnAtras: MaterialButton
    private lateinit var btnSiguiente: MaterialButton

    private val elegirFoto = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { guardarFoto(it) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.registro_vet)
        VetUi.barras(this, conPadding = false)
        ajustarInsets()

        savedInstanceState?.let {
            paso = it.getInt(ESTADO_PASO)
            especialidades = it.getBooleanArray(ESTADO_ESPECIALIDADES) ?: especialidades
            dias = it.getBooleanArray(ESTADO_DIAS) ?: dias
            apertura = it.getString(ESTADO_APERTURA) ?: apertura
            cierre = it.getString(ESTADO_CIERRE) ?: cierre
            fotoPath = it.getString(ESTADO_FOTO)
            titulo = it.getString(ESTADO_TITULO)
        }

        paneles = listOf(R.id.paso1, R.id.paso2, R.id.paso3, R.id.paso4, R.id.paso5).map { findViewById(it) }
        btnAtras = findViewById(R.id.btnPasoAtras)
        btnSiguiente = findViewById(R.id.btnPasoSiguiente)

        crearSegmentos()
        crearChipsEspecialidades()
        crearChipsDias()
        configurarFoto()
        crearChipsTitulo()
        configurarHorario()

        btnAtras.setOnClickListener { irAlPasoAnterior() }
        btnSiguiente.setOnClickListener { avanzar() }
        findViewById<View>(R.id.btnBackRegVet).setOnClickListener { irAlPasoAnterior() }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = irAlPasoAnterior()
        })

        mostrarPaso(animar = false)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(ESTADO_PASO, paso)
        outState.putBooleanArray(ESTADO_ESPECIALIDADES, especialidades)
        outState.putBooleanArray(ESTADO_DIAS, dias)
        outState.putString(ESTADO_APERTURA, apertura)
        outState.putString(ESTADO_CIERRE, cierre)
        outState.putString(ESTADO_FOTO, fotoPath)
        outState.putString(ESTADO_TITULO, titulo)
    }

    private fun ajustarInsets() {
        val raiz = findViewById<View>(R.id.rootRegVet)
        ViewCompat.setOnApplyWindowInsetsListener(raiz) { vista, insets ->
            val barras = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val teclado = insets.getInsets(WindowInsetsCompat.Type.ime())
            vista.updatePadding(top = barras.top, bottom = maxOf(barras.bottom, teclado.bottom))
            insets
        }
        ViewCompat.requestApplyInsets(raiz)
    }

    // ---------- Navegación entre pasos ----------

    private fun crearSegmentos() {
        val contenedor = findViewById<android.widget.LinearLayout>(R.id.llProgreso)
        val margen = (3 * resources.displayMetrics.density).toInt()
        segmentos = TITULOS.map {
            View(this).also { segmento ->
                segmento.layoutParams = android.widget.LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f)
                    .apply { setMargins(margen, 0, margen, 0) }
                contenedor.addView(segmento)
            }
        }
    }

    private fun mostrarPaso(animar: Boolean = true) {
        paneles.forEachIndexed { i, panel ->
            val visible = i == paso
            panel.visibility = if (visible) View.VISIBLE else View.GONE
            if (visible && animar) {
                panel.alpha = 0f
                panel.translationX = 60f
                panel.animate().alpha(1f).translationX(0f).setDuration(220).start()
            }
        }
        segmentos.forEachIndexed { i, s ->
            s.setBackgroundResource(if (i <= paso) R.drawable.bg_progreso_on else R.drawable.bg_progreso_off)
        }
        findViewById<TextView>(R.id.tvPasoActual).text = "Paso ${paso + 1} de ${TITULOS.size} · ${TITULOS[paso]}"
        btnAtras.visibility = if (paso == 0) View.GONE else View.VISIBLE
        btnSiguiente.text = if (paso == TITULOS.lastIndex) "Crear cuenta" else "Continuar"
        findViewById<View>(R.id.scrollPasos).scrollTo(0, 0)
        currentFocus?.clearFocus()
        (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
            .hideSoftInputFromWindow(window.decorView.windowToken, 0)
        if (paso == 3) actualizarResumenHorario()
        if (paso == 4) actualizarResumenCuenta()
    }

    private fun irAlPasoAnterior() {
        if (paso > 0) {
            paso--
            mostrarPaso()
        } else if (hayDatosCargados()) {
            AlertDialog.Builder(this)
                .setTitle("Salir del registro")
                .setMessage("Si salís ahora se pierden los datos que cargaste.")
                .setPositiveButton("Salir") { _, _ -> finish() }
                .setNegativeButton("Seguir registrándome", null)
                .show()
        } else {
            finish()
        }
    }

    private fun hayDatosCargados() = listOf(R.id.etVetNombre, R.id.etVetDni, R.id.etVetTelefono)
        .any { texto(it).isNotEmpty() } || fotoPath != null

    private fun avanzar() {
        if (!validarPasoActual()) return
        if (paso < TITULOS.lastIndex) {
            paso++
            mostrarPaso()
        } else {
            crearCuenta()
        }
    }

    // ---------- Validaciones ----------

    private fun texto(id: Int) = findViewById<EditText>(id).text.toString().trim()

    private fun error(id: Int, mensaje: String): Boolean {
        val campo = findViewById<EditText>(id)
        campo.error = mensaje
        campo.requestFocus()
        return false
    }

    private fun validarPasoActual(): Boolean = when (paso) {
        0 -> validarDatosPersonales()
        1 -> validarProfesion()
        2 -> validarEspecialidades()
        3 -> validarHorario()
        else -> validarCuenta()
    }

    private fun validarDatosPersonales(): Boolean {
        var ok = true
        if (titulo == null) {
            Avisos.mostrar(this, "Elegí si sos Dr. o Dra.")
            ok = false
        }
        if (texto(R.id.etVetTelefono).count { it.isDigit() } < 8) ok = error(R.id.etVetTelefono, "Ingresá un teléfono válido")
        if (texto(R.id.etVetDni).length !in 7..8) ok = error(R.id.etVetDni, "El DNI debe tener 7 u 8 números")
        if (texto(R.id.etVetNombre).length < 3 || !texto(R.id.etVetNombre).contains(" ")) {
            ok = error(R.id.etVetNombre, "Ingresá tu nombre y apellido")
        }
        return ok
    }

    private fun validarProfesion(): Boolean {
        var ok = true
        if (texto(R.id.etVetDireccion).length < 5) ok = error(R.id.etVetDireccion, "Ingresá la dirección de la veterinaria")
        if (texto(R.id.etVetClinica).length < 3) ok = error(R.id.etVetClinica, "Ingresá el nombre de la veterinaria")
        if (texto(R.id.etVetMatricula).length < 3) ok = error(R.id.etVetMatricula, "Ingresá tu matrícula")
        return ok
    }

    private fun validarEspecialidades(): Boolean {
        val ok = especialidades.any { it }
        findViewById<View>(R.id.tvEspError).visibility = if (ok) View.GONE else View.VISIBLE
        return ok
    }

    private fun minutos(hora: String): Int {
        val partes = hora.split(":")
        return partes[0].toInt() * 60 + partes[1].toInt()
    }

    private fun validarHorario(): Boolean {
        if (dias.none { it }) {
            Avisos.mostrar(this, "Elegí al menos un día de atención")
            return false
        }
        if (minutos(cierre) - minutos(apertura) < DisponibilidadVet.DURACION_MIN) {
            Avisos.mostrar(this, "El horario de cierre tiene que ser posterior al de apertura")
            return false
        }
        return true
    }

    private fun validarCuenta(): Boolean {
        var ok = true
        if (!findViewById<CheckBox>(R.id.cbVetTerminos).isChecked) {
            Avisos.mostrar(this, "Tenés que aceptar los términos y condiciones")
            ok = false
        }
        val pass = findViewById<EditText>(R.id.etVetPassword).text.toString()
        if (pass != findViewById<EditText>(R.id.etVetPassword2).text.toString()) {
            ok = error(R.id.etVetPassword2, "Las contraseñas no coinciden")
        }
        if (pass.length < 6) ok = error(R.id.etVetPassword, "Mínimo 6 caracteres")
        val email = texto(R.id.etVetEmail).lowercase(Locale.ROOT)
        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            ok = error(R.id.etVetEmail, "Correo inválido")
        }
        return ok
    }

    // ---------- Paso 1: foto ----------

    private fun configurarFoto() {
        val abrir = View.OnClickListener { elegirFoto.launch("image/*") }
        findViewById<View>(R.id.btnRegFoto).setOnClickListener(abrir)
        findViewById<View>(R.id.ivRegFoto).setOnClickListener(abrir)
        fotoPath?.let { mostrarFoto(it) }
    }

    private fun guardarFoto(uri: Uri) {
        try {
            val destino = File(filesDir, "foto_veterinario_${System.currentTimeMillis()}.jpg")
            contentResolver.openInputStream(uri)?.use { entrada ->
                destino.outputStream().use { salida -> entrada.copyTo(salida) }
            } ?: throw IllegalStateException("No se pudo leer la imagen")
            fotoPath?.let { File(it).delete() }
            fotoPath = destino.absolutePath
            mostrarFoto(destino.absolutePath)
        } catch (e: Exception) {
            Avisos.mostrar(this, "No pudimos cargar la imagen")
        }
    }

    private fun mostrarFoto(path: String) {
        findViewById<com.google.android.material.imageview.ShapeableImageView>(R.id.ivRegFoto).apply {
            setContentPadding(0, 0, 0, 0)
            imageTintList = null
            scaleType = ImageView.ScaleType.CENTER_CROP
            setImageURI(Uri.fromFile(File(path)))
        }
    }

    private fun crearChipsTitulo() {
        val grupo = findViewById<ChipGroup>(R.id.cgTitulo)
        TITULOS_PROFESIONALES.forEach { t ->
            crearChip(t, t == titulo, { marcado ->
                if (marcado) titulo = t else if (titulo == t) titulo = null
            }, grupo)
        }
    }

    /** Nombre tal como se muestra en la app: título y nombre completo. */
    private fun nombreCompleto() = "${titulo.orEmpty()} ${texto(R.id.etVetNombre)}".trim()

    // ---------- Paso 3: especialidades ----------

    private fun crearChip(texto: String, marcado: Boolean, alCambiar: (Boolean) -> Unit, grupo: ChipGroup) {
        val chip = layoutInflater.inflate(R.layout.chip_registro, grupo, false) as Chip
        chip.text = texto
        chip.isChecked = marcado
        chip.setOnCheckedChangeListener { _, checked -> alCambiar(checked) }
        grupo.addView(chip)
    }

    private fun crearChipsEspecialidades() {
        val grupo = findViewById<ChipGroup>(R.id.cgEspecialidades)
        PerfilVetRepo.todasLasEspecialidades.forEachIndexed { i, nombre ->
            crearChip(nombre, especialidades[i], { checked ->
                especialidades[i] = checked
                actualizarContadorEspecialidades()
            }, grupo)
        }
        actualizarContadorEspecialidades()
    }

    private fun actualizarContadorEspecialidades() {
        val total = especialidades.count { it }
        findViewById<TextView>(R.id.tvEspCount).text = when (total) {
            0 -> "Ninguna seleccionada"
            1 -> "1 seleccionada"
            else -> "$total seleccionadas"
        }
        if (total > 0) findViewById<View>(R.id.tvEspError).visibility = View.GONE
    }

    // ---------- Paso 4: días y horarios ----------

    private fun crearChipsDias() {
        val grupo = findViewById<ChipGroup>(R.id.cgDias)
        PerfilVetRepo.todosLosDias.forEachIndexed { i, nombre ->
            crearChip(nombre.take(3), dias[i], { checked ->
                dias[i] = checked
                actualizarResumenHorario()
            }, grupo)
        }
        findViewById<View>(R.id.btnPresetLV).setOnClickListener { aplicarDias(5) }
        findViewById<View>(R.id.btnPresetLS).setOnClickListener { aplicarDias(6) }
    }

    private fun aplicarDias(cantidad: Int) {
        val grupo = findViewById<ChipGroup>(R.id.cgDias)
        for (i in dias.indices) (grupo.getChildAt(i) as Chip).isChecked = i < cantidad
    }

    private fun configurarHorario() {
        val etApertura = findViewById<EditText>(R.id.etVetApertura)
        val etCierre = findViewById<EditText>(R.id.etVetCierre)
        etApertura.setText("$apertura hs")
        etCierre.setText("$cierre hs")
        etApertura.setOnClickListener {
            elegirHora(apertura) { apertura = it; etApertura.setText("$it hs"); actualizarResumenHorario() }
        }
        etCierre.setOnClickListener {
            elegirHora(cierre) { cierre = it; etCierre.setText("$it hs"); actualizarResumenHorario() }
        }
    }

    private fun elegirHora(actual: String, alElegir: (String) -> Unit) {
        val h = actual.substringBefore(":").toInt()
        val m = actual.substringAfter(":").toInt()
        TimePickerDialog(this, { _, hh, mm -> alElegir("%02d:%02d".format(hh, mm)) }, h, m, true).show()
    }

    private fun textoDias(): String {
        val activos = PerfilVetRepo.todosLosDias.filterIndexed { i, _ -> dias[i] }
        return if (activos.isEmpty()) "ningún día" else activos.joinToString(", ") { it.take(3) }
    }

    private fun actualizarResumenHorario() {
        val minutosDia = minutos(cierre) - minutos(apertura)
        val texto = if (dias.none { it }) {
            "Elegí al menos un día de atención."
        } else if (minutosDia < DisponibilidadVet.DURACION_MIN) {
            "El horario de cierre tiene que ser posterior al de apertura."
        } else {
            "Atendés ${textoDias()} de $apertura a $cierre hs, con hasta " +
                "${minutosDia / DisponibilidadVet.DURACION_MIN} turnos de ${DisponibilidadVet.DURACION_MIN} min por día."
        }
        findViewById<TextView>(R.id.tvResumenHorarioReg).text = texto
    }

    // ---------- Paso 5: resumen y alta ----------

    private fun actualizarResumenCuenta() {
        val elegidas = PerfilVetRepo.todasLasEspecialidades.filterIndexed { i, _ -> especialidades[i] }
        findViewById<TextView>(R.id.tvResumenCuenta).text = buildString {
            appendLine(nombreCompleto() + " · DNI " + texto(R.id.etVetDni))
            appendLine("Matrícula " + texto(R.id.etVetMatricula))
            appendLine(texto(R.id.etVetClinica) + " · " + texto(R.id.etVetDireccion))
            appendLine(elegidas.joinToString(", "))
            append("Atención: ${textoDias()} · $apertura a $cierre hs")
        }
    }

    private fun crearCuenta() {
        val nombre = nombreCompleto()
        val datos = DatosRegistroVeterinario(
            nombre = nombre,
            dni = texto(R.id.etVetDni),
            telefono = texto(R.id.etVetTelefono),
            email = texto(R.id.etVetEmail).lowercase(Locale.ROOT),
            password = findViewById<EditText>(R.id.etVetPassword).text.toString(),
            matricula = texto(R.id.etVetMatricula),
            clinica = texto(R.id.etVetClinica),
            direccionClinica = texto(R.id.etVetDireccion),
            especialidades = PerfilVetRepo.todasLasEspecialidades.filterIndexed { i, _ -> especialidades[i] },
            dias = dias.indices.filter { dias[it] }.map { it + 1 },
            apertura = apertura,
            cierre = cierre,
            fotoPath = fotoPath
        )
        btnSiguiente.isEnabled = false
        btnSiguiente.text = "Creando cuenta..."
        lifecycleScope.launch {
            try {
                val resultado = Registro.veterinario(datos)
                Avisos.informar(
                    this@RegistroVeterinarioActivity, "Registro en revisión",
                    "¡Muchas gracias, $nombre!\nTus datos y matrícula (${datos.matricula}) fueron enviados correctamente " +
                        "y están en proceso de revisión por el Administrador. Una vez verificados, tu cuenta será dada de alta.",
                    cancelable = false
                ) {
                    setResult(
                        RESULT_OK,
                        Intent().putExtra(EXTRA_EMAIL, datos.email)
                            .putExtra(EXTRA_CONFIRMAR_CORREO, !resultado.sesionIniciada)
                    )
                    finish()
                }
            } catch (e: Registro.CorreoYaRegistrado) {
                btnSiguiente.isEnabled = true
                btnSiguiente.text = "Crear cuenta"
                error(R.id.etVetEmail, "Ese correo ya está registrado")
            } catch (e: Exception) {
                btnSiguiente.isEnabled = true
                btnSiguiente.text = "Crear cuenta"
                Avisos.error(this@RegistroVeterinarioActivity, Errores.mensaje(e))
            }
        }
    }
}
