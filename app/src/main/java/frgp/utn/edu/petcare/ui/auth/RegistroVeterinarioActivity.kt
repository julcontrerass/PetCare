package frgp.utn.edu.petcare.ui.auth

import android.app.Activity
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
import androidx.core.view.updatePadding
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import frgp.utn.edu.petcare.data.CredencialVet
import frgp.utn.edu.petcare.data.DatosRegistroVeterinario
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.SolicitudAltaVeterinarioDto
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Registro
import frgp.utn.edu.petcare.data.repositorio.DisponibilidadVet
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.BaseActivity
import frgp.utn.edu.petcare.ui.common.VetUi
import java.io.File
import java.util.Locale
import kotlinx.coroutines.launch

/**
 * Alta de cuenta del veterinario en cinco pasos. Al terminar guarda los datos en [PerfilVetRepo]
 * y devuelve el correo y la contraseña para que la pantalla de inicio registre la cuenta.
 */
class RegistroVeterinarioActivity : BaseActivity() {

    companion object {
        const val EXTRA_EMAIL = "email"
        const val EXTRA_CONFIRMAR_CORREO = "confirmar_correo"

        /** Un dueño con cuenta activa pide el alta como veterinario: no crea usuario, solo manda sus datos. */
        const val EXTRA_CUENTA_EXISTENTE = "cuenta_existente"

        private const val ESTADO_PASO = "paso"
        private const val ESTADO_ESPECIALIDADES = "especialidades"
        private const val ESTADO_TIPOS = "tipos_animales"
        private const val ESTADO_DIAS = "dias"
        private const val ESTADO_APERTURA = "apertura"
        private const val ESTADO_CIERRE = "cierre"
        private const val ESTADO_FOTO = "foto"
        private const val ESTADO_TITULO = "titulo"
        private const val ESTADO_CREDENCIAL = "credencial"
        private val TITULOS_PROFESIONALES = listOf("Dr.", "Dra.")

        private val TITULOS = listOf(
            "Datos personales", "Profesión y veterinaria", "Especialidades", "Días y horarios", "Tu cuenta"
        )
    }

    private var paso = 0
    private var especialidades = BooleanArray(PerfilVetRepo.todasLasEspecialidades.size)
    private var tiposAnimales = BooleanArray(TiposMascota.TODOS.size)
    private var dias = booleanArrayOf(true, true, true, true, true, false, false)
    private var apertura = "09:00"
    private var cierre = "18:00"
    private var fotoPath: String? = null
    private var credencialPath: String? = null
    private var titulo: String? = null

    /** Cuenta de dueño que suma el rol de veterinario: se salta lo personal y la creación del usuario. */
    private var cuentaExistente = false
    private val primerPaso get() = if (cuentaExistente) 1 else 0

    private lateinit var paneles: List<View>
    private lateinit var segmentos: List<View>
    private lateinit var btnAtras: MaterialButton
    private lateinit var btnSiguiente: MaterialButton

    private val elegirFoto = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { guardarFoto(it) }
    }

    private val elegirCredencial = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { guardarCredencial(it) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_registro_vet)
        VetUi.barras(this, conPadding = false)
        ajustarInsets()
        cuentaExistente = intent.getBooleanExtra(EXTRA_CUENTA_EXISTENTE, false)
        if (cuentaExistente && savedInstanceState == null) paso = primerPaso

        savedInstanceState?.let {
            paso = it.getInt(ESTADO_PASO)
            especialidades = it.getBooleanArray(ESTADO_ESPECIALIDADES) ?: especialidades
            tiposAnimales = it.getBooleanArray(ESTADO_TIPOS) ?: tiposAnimales
            dias = it.getBooleanArray(ESTADO_DIAS) ?: dias
            apertura = it.getString(ESTADO_APERTURA) ?: apertura
            cierre = it.getString(ESTADO_CIERRE) ?: cierre
            fotoPath = it.getString(ESTADO_FOTO)
            credencialPath = it.getString(ESTADO_CREDENCIAL)
            titulo = it.getString(ESTADO_TITULO)
        }

        paneles = listOf(R.id.paso1, R.id.paso2, R.id.paso3, R.id.paso4, R.id.paso5).map { findViewById(it) }
        btnAtras = findViewById(R.id.btnPasoAtras)
        btnSiguiente = findViewById(R.id.btnPasoSiguiente)

        crearSegmentos()
        crearChipsEspecialidades()
        crearChipsTiposAnimales()
        crearChipsDias()
        configurarFoto()
        configurarCredencial()
        crearChipsTitulo()
        configurarHorario()
        if (cuentaExistente) prepararParaCuentaExistente()

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
        outState.putBooleanArray(ESTADO_TIPOS, tiposAnimales)
        outState.putBooleanArray(ESTADO_DIAS, dias)
        outState.putString(ESTADO_APERTURA, apertura)
        outState.putString(ESTADO_CIERRE, cierre)
        outState.putString(ESTADO_FOTO, fotoPath)
        outState.putString(ESTADO_CREDENCIAL, credencialPath)
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
        segmentos = TITULOS.drop(primerPaso).map {
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
            s.setBackgroundResource(if (i + primerPaso <= paso) R.drawable.bg_progreso_on else R.drawable.bg_progreso_off)
        }
        findViewById<TextView>(R.id.tvPasoActual).text =
            "Paso ${paso - primerPaso + 1} de ${TITULOS.size - primerPaso} · ${TITULOS[paso]}"
        btnAtras.visibility = if (paso == primerPaso) View.GONE else View.VISIBLE
        btnSiguiente.text = when {
            paso != TITULOS.lastIndex -> "Continuar"
            cuentaExistente -> "Enviar solicitud"
            else -> "Crear cuenta"
        }
        findViewById<View>(R.id.scrollPasos).scrollTo(0, 0)
        currentFocus?.clearFocus()
        (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
            .hideSoftInputFromWindow(window.decorView.windowToken, 0)
        if (paso == 3) actualizarResumenHorario()
        if (paso == 4) actualizarResumenCuenta()
    }

    private fun irAlPasoAnterior() {
        if (paso > primerPaso) {
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
        .any { texto(it).isNotEmpty() } || fotoPath != null || credencialPath != null

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
        if (credencialPath == null) {
            Avisos.mostrar(this, "Subí la foto de tu carnet o matrícula para que el administrador pueda verificarte")
            ok = false
        }
        return ok
    }

    private fun validarEspecialidades(): Boolean {
        val ok = especialidades.any { it }
        findViewById<View>(R.id.tvEspError).visibility = if (ok) View.GONE else View.VISIBLE
        val okTipos = tiposAnimales.any { it }
        findViewById<View>(R.id.tvTiposError).visibility = if (okTipos) View.GONE else View.VISIBLE
        return ok && okTipos
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
        // La cuenta ya existe: no hay usuario ni contraseña que crear ni términos que volver a aceptar
        if (cuentaExistente) return true
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

    // ---------- Paso 2: foto del carnet o matrícula ----------

    private fun configurarCredencial() {
        val abrir = View.OnClickListener { elegirCredencial.launch("image/*") }
        findViewById<View>(R.id.btnCredencial).setOnClickListener(abrir)
        findViewById<View>(R.id.ivCredencial).setOnClickListener(abrir)
        credencialPath?.let { mostrarCredencial(it) }
    }

    private fun guardarCredencial(uri: Uri) {
        try {
            val destino = File(filesDir, "credencial_vet_${System.currentTimeMillis()}.jpg")
            contentResolver.openInputStream(uri)?.use { entrada ->
                destino.outputStream().use { salida -> entrada.copyTo(salida) }
            } ?: throw IllegalStateException("No se pudo leer la imagen")
            credencialPath?.let { File(it).delete() }
            credencialPath = destino.absolutePath
            mostrarCredencial(destino.absolutePath)
        } catch (e: Exception) {
            Avisos.mostrar(this, "No pudimos cargar la imagen")
        }
    }

    private fun mostrarCredencial(path: String) {
        findViewById<ImageView>(R.id.ivCredencial).apply {
            setPadding(0, 0, 0, 0)
            imageTintList = null
            scaleType = ImageView.ScaleType.CENTER_CROP
            setImageURI(Uri.fromFile(File(path)))
        }
        findViewById<MaterialButton>(R.id.btnCredencial).text = "Cambiar foto"
    }

    /** Un dueño con cuenta pide el alta: se ocultan los datos personales y los de acceso, que ya tiene. */
    private fun prepararParaCuentaExistente() {
        findViewById<View>(R.id.paso1).visibility = View.GONE
        for (id in listOf(
            R.id.lblVetEmail, R.id.etVetEmail, R.id.lblVetPassword, R.id.etVetPassword,
            R.id.lblVetPassword2, R.id.etVetPassword2, R.id.cbVetTerminos
        )) {
            findViewById<View>(id).visibility = View.GONE
        }
        findViewById<TextView>(R.id.tvPaso5Titulo).text = "Revisá y enviá"
        findViewById<TextView>(R.id.tvPaso5Sub).text =
            "El administrador va a verificar tu matrícula. Mientras tanto seguís usando la app como dueño."
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
    private fun nombreCompleto() =
        if (cuentaExistente) Sesion.perfil?.nombre.orEmpty()
        else "${titulo.orEmpty()} ${texto(R.id.etVetNombre)}".trim()

    // ---------- Paso 3: especialidades ----------

    private fun crearChip(texto: String, marcado: Boolean, alCambiar: (Boolean) -> Unit, grupo: ChipGroup) {
        val chip = layoutInflater.inflate(R.layout.view_chip_registro, grupo, false) as Chip
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

    private fun crearChipsTiposAnimales() {
        val grupo = findViewById<ChipGroup>(R.id.cgTiposAnimales)
        TiposMascota.TODOS.forEachIndexed { i, tipo ->
            crearChip(TiposMascota.plural(tipo), tiposAnimales[i], { checked ->
                tiposAnimales[i] = checked
                if (checked) findViewById<View>(R.id.tvTiposError).visibility = View.GONE
            }, grupo)
        }
    }

    private fun tiposElegidos() = TiposMascota.TODOS.filterIndexed { i, _ -> tiposAnimales[i] }

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
            "Atendés ${textoDias()} de $apertura a $cierre hs. La duración de cada práctica la podés ajustar " +
                "después desde tu perfil."
        }
        findViewById<TextView>(R.id.tvResumenHorarioReg).text = texto
    }

    // ---------- Paso 5: resumen y alta ----------

    private fun actualizarResumenCuenta() {
        val elegidas = PerfilVetRepo.todasLasEspecialidades.filterIndexed { i, _ -> especialidades[i] }
        findViewById<TextView>(R.id.tvResumenCuenta).text = buildString {
            appendLine(if (cuentaExistente) nombreCompleto() else nombreCompleto() + " · DNI " + texto(R.id.etVetDni))
            appendLine("Matrícula " + texto(R.id.etVetMatricula))
            appendLine(texto(R.id.etVetClinica) + " · " + texto(R.id.etVetDireccion))
            appendLine(elegidas.joinToString(", "))
            appendLine("Animales: " + tiposElegidos().joinToString(", ") { TiposMascota.plural(it) })
            append("Atención: ${textoDias()} · $apertura a $cierre hs")
        }
    }

    /** Un dueño con cuenta activa pide el alta como veterinario: sube el carnet y manda sus datos profesionales. */
    private fun solicitarAlta() {
        val usuario = Sesion.usuarioId ?: run {
            Avisos.error(this, "Tu sesión venció. Volvé a ingresar.")
            return
        }
        val carnet = credencialPath ?: return
        btnSiguiente.isEnabled = false
        btnSiguiente.text = "Enviando..."
        lifecycleScope.launch {
            try {
                val preparada = Imagenes.prepararFoto(Uri.fromFile(File(carnet)))
                val ruta = CredencialVet.subirArchivo(preparada, usuario)
                Servicios.fuente.solicitarAltaVeterinario(
                    SolicitudAltaVeterinarioDto(
                        matricula = texto(R.id.etVetMatricula), clinica = texto(R.id.etVetClinica),
                        direccionClinica = texto(R.id.etVetDireccion),
                        dias = dias.indices.filter { dias[it] }.map { it + 1 },
                        apertura = apertura, cierre = cierre,
                        especialidades = PerfilVetRepo.todasLasEspecialidades.filterIndexed { i, _ -> especialidades[i] },
                        tiposAnimales = tiposElegidos(), credencialPath = ruta
                    )
                )
                runCatching { preparada.delete(); File(carnet).delete() }
                runCatching { Sesion.actualizarRoles() }
                Avisos.informar(
                    this@RegistroVeterinarioActivity, "Solicitud enviada",
                    "Tus datos y la foto de tu carnet fueron enviados al administrador. Cuando verifique tu matrícula " +
                        "vas a poder ingresar también como veterinario. Mientras tanto seguís usando la app como dueño.",
                    cancelable = false
                ) {
                    setResult(RESULT_OK)
                    finish()
                }
            } catch (e: Exception) {
                btnSiguiente.isEnabled = true
                btnSiguiente.text = "Enviar solicitud"
                Avisos.error(this@RegistroVeterinarioActivity, Errores.mensaje(e))
            }
        }
    }

    private fun crearCuenta() {
        if (cuentaExistente) {
            solicitarAlta()
            return
        }
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
            tiposAnimales = tiposElegidos(),
            dias = dias.indices.filter { dias[it] }.map { it + 1 },
            apertura = apertura,
            cierre = cierre,
            fotoPath = fotoPath,
            credencialPath = credencialPath
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
                Avisos.informar(
                    this@RegistroVeterinarioActivity, "Ese correo ya tiene una cuenta",
                    "Si es tu cuenta de dueño, no hace falta crear otra: ingresá con ella y, en tu perfil, tocá " +
                        "\"Soy veterinario/a: pedir el alta\". Vas a poder usar la misma cuenta como dueño y como veterinario."
                )
            } catch (e: Exception) {
                btnSiguiente.isEnabled = true
                btnSiguiente.text = "Crear cuenta"
                Avisos.error(this@RegistroVeterinarioActivity, Errores.mensaje(e))
            }
        }
    }
}
