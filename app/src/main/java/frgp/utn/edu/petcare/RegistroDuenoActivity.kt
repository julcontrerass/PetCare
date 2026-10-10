package frgp.utn.edu.petcare

import android.app.Activity
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.ui.common.Avisos
import android.app.DatePickerDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Patterns
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
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
import com.google.android.material.imageview.ShapeableImageView
import java.io.File
import java.time.LocalDate
import java.util.Locale

/**
 * Alta de cuenta del dueño en cuatro pasos: datos personales, domicilio, mascotas y cuenta.
 * Devuelve un [DatosRegistroDueno] para que la pantalla de inicio cree la cuenta con sus mascotas.
 */
class RegistroDuenoActivity : BaseActivity() {

    companion object {
        const val EXTRA_EMAIL = "email"
        const val EXTRA_CONFIRMAR_CORREO = "confirmar_correo"

        private const val ESTADO_PASO = "paso"
        private const val ESTADO_FOTO = "foto"
        private const val ESTADO_MASCOTAS = "mascotas"

        private val TITULOS = listOf("Datos personales", "Domicilio", "Tus mascotas", "Tu cuenta")
        private val TIPOS = TiposMascota.TODOS
        private val SEXOS = listOf("Macho", "Hembra")
    }

    private var paso = 0
    private var fotoPath: String? = null
    private val mascotas = mutableListOf<MascotaRegistro>()

    private lateinit var paneles: List<View>
    private lateinit var segmentos: List<View>
    private lateinit var btnAtras: MaterialButton
    private lateinit var btnSiguiente: MaterialButton

    // La foto que se está eligiendo: la del dueño o la de la mascota del diálogo abierto
    private var destinoFoto: (String) -> Unit = {}
    private val elegirFoto = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { copiarFoto(it)?.let { path -> destinoFoto(path) } }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.registro_dueno)
        VetUi.barras(this, conPadding = false)
        ajustarInsets()

        savedInstanceState?.let {
            paso = it.getInt(ESTADO_PASO)
            fotoPath = it.getString(ESTADO_FOTO)
            @Suppress("UNCHECKED_CAST", "DEPRECATION")
            (it.getSerializable(ESTADO_MASCOTAS) as? ArrayList<MascotaRegistro>)?.let { l -> mascotas.addAll(l) }
        }

        paneles = listOf(R.id.paso1, R.id.paso2, R.id.paso3, R.id.paso4).map { findViewById(it) }
        btnAtras = findViewById(R.id.btnDuenoAtras)
        btnSiguiente = findViewById(R.id.btnDuenoSiguiente)

        crearSegmentos()
        configurarFoto()
        findViewById<View>(R.id.btnAgregarMascotaReg).setOnClickListener { mostrarDialogoMascota(null) }
        actualizarListaMascotas()

        btnAtras.setOnClickListener { irAlPasoAnterior() }
        btnSiguiente.setOnClickListener { avanzar() }
        findViewById<View>(R.id.btnBackRegDueno).setOnClickListener { irAlPasoAnterior() }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = irAlPasoAnterior()
        })

        mostrarPaso(animar = false)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(ESTADO_PASO, paso)
        outState.putString(ESTADO_FOTO, fotoPath)
        outState.putSerializable(ESTADO_MASCOTAS, ArrayList(mascotas))
    }

    private fun ajustarInsets() {
        val raiz = findViewById<View>(R.id.rootRegDueno)
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
        val contenedor = findViewById<LinearLayout>(R.id.llProgresoDueno)
        val margen = (3 * resources.displayMetrics.density).toInt()
        segmentos = TITULOS.map {
            View(this).also { segmento ->
                segmento.layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f)
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
        findViewById<TextView>(R.id.tvPasoDueno).text = "Paso ${paso + 1} de ${TITULOS.size} · ${TITULOS[paso]}"
        btnAtras.visibility = if (paso == 0) View.GONE else View.VISIBLE
        btnSiguiente.text = when {
            paso == TITULOS.lastIndex -> "Crear cuenta"
            paso == 2 && mascotas.isEmpty() -> "Omitir por ahora"
            else -> "Continuar"
        }
        findViewById<View>(R.id.scrollPasosDueno).scrollTo(0, 0)
        currentFocus?.clearFocus()
        (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
            .hideSoftInputFromWindow(window.decorView.windowToken, 0)
        if (paso == 3) actualizarResumen()
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

    private fun hayDatosCargados() = listOf(R.id.etDuenoNombre, R.id.etDuenoDni, R.id.etDuenoTelefono)
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
        1 -> validarDomicilio()
        2 -> true
        else -> validarCuenta()
    }

    private fun validarDatosPersonales(): Boolean {
        var ok = true
        if (texto(R.id.etDuenoTelefono).count { it.isDigit() } < 8) ok = error(R.id.etDuenoTelefono, "Ingresá un teléfono válido")
        if (texto(R.id.etDuenoDni).length !in 7..8) ok = error(R.id.etDuenoDni, "El DNI debe tener 7 u 8 números")
        if (texto(R.id.etDuenoNombre).length < 3 || !texto(R.id.etDuenoNombre).contains(" ")) {
            ok = error(R.id.etDuenoNombre, "Ingresá tu nombre y apellido")
        }
        return ok
    }

    private fun validarDomicilio(): Boolean {
        var ok = true
        if (texto(R.id.etDuenoCiudad).length < 3) ok = error(R.id.etDuenoCiudad, "Ingresá tu ciudad o localidad")
        if (texto(R.id.etDuenoDireccion).length < 5) ok = error(R.id.etDuenoDireccion, "Ingresá tu calle y número")
        return ok
    }

    private fun validarCuenta(): Boolean {
        var ok = true
        if (!findViewById<CheckBox>(R.id.cbDuenoTerminos).isChecked) {
            Avisos.mostrar(this, "Tenés que aceptar los términos y condiciones")
            ok = false
        }
        val pass = findViewById<EditText>(R.id.etDuenoPassword).text.toString()
        if (pass != findViewById<EditText>(R.id.etDuenoPassword2).text.toString()) {
            ok = error(R.id.etDuenoPassword2, "Las contraseñas no coinciden")
        }
        if (pass.length < 6) ok = error(R.id.etDuenoPassword, "Mínimo 6 caracteres")
        val email = texto(R.id.etDuenoEmail).lowercase(Locale.ROOT)
        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            ok = error(R.id.etDuenoEmail, "Correo inválido")
        }
        return ok
    }

    // ---------- Fotos ----------

    private fun copiarFoto(uri: Uri): String? = try {
        val destino = File(filesDir, "foto_registro_${System.currentTimeMillis()}.jpg")
        contentResolver.openInputStream(uri)?.use { entrada ->
            destino.outputStream().use { salida -> entrada.copyTo(salida) }
        } ?: throw IllegalStateException("No se pudo leer la imagen")
        destino.absolutePath
    } catch (e: Exception) {
        Avisos.mostrar(this, "No pudimos cargar la imagen")
        null
    }

    private fun mostrarFotoEn(imagen: ShapeableImageView, path: String) {
        imagen.setContentPadding(0, 0, 0, 0)
        imagen.imageTintList = null
        imagen.scaleType = ImageView.ScaleType.CENTER_CROP
        imagen.setImageURI(Uri.fromFile(File(path)))
    }

    private fun configurarFoto() {
        val imagen = findViewById<ShapeableImageView>(R.id.ivDuenoFoto)
        val abrir = View.OnClickListener {
            destinoFoto = { path ->
                fotoPath?.let { File(it).delete() }
                fotoPath = path
                mostrarFotoEn(imagen, path)
            }
            elegirFoto.launch("image/*")
        }
        findViewById<View>(R.id.btnDuenoFoto).setOnClickListener(abrir)
        imagen.setOnClickListener(abrir)
        fotoPath?.let { mostrarFotoEn(imagen, it) }
    }

    // ---------- Paso 3: mascotas ----------

    private fun detalleMascota(m: MascotaRegistro): String =
        listOf(m.tipo, m.raza, m.sexo).filter { it.isNotBlank() }.joinToString(" · ") +
            if (m.nacimiento.isNotBlank()) "\nNació el ${m.nacimiento}" else ""

    private fun actualizarListaMascotas() {
        val lista = findViewById<LinearLayout>(R.id.llMascotasReg)
        lista.removeAllViews()
        mascotas.forEachIndexed { i, m ->
            val item = layoutInflater.inflate(R.layout.item_mascota_registro, lista, false)
            item.findViewById<TextView>(R.id.tvMascotaItemNombre).text = m.nombre
            item.findViewById<TextView>(R.id.tvMascotaItemDetalle).text = detalleMascota(m)
            m.fotoPath?.let { path ->
                item.findViewById<ImageView>(R.id.ivMascotaItem).apply {
                    setPadding(0, 0, 0, 0)
                    imageTintList = null
                    scaleType = ImageView.ScaleType.CENTER_CROP
                    setImageURI(Uri.fromFile(File(path)))
                }
            }
            item.setOnClickListener { mostrarDialogoMascota(i) }
            item.findViewById<View>(R.id.btnQuitarMascota).setOnClickListener {
                AlertDialog.Builder(this)
                    .setTitle("Quitar mascota")
                    .setMessage("¿Querés quitar a ${m.nombre} de tu cuenta?")
                    .setPositiveButton("Quitar") { _, _ ->
                        mascotas.removeAt(i)
                        actualizarListaMascotas()
                    }
                    .setNegativeButton("Cancelar", null)
                    .show()
            }
            lista.addView(item)
        }
        findViewById<View>(R.id.tvSinMascotas).visibility = if (mascotas.isEmpty()) View.VISIBLE else View.GONE
        if (paso == 2) {
            btnSiguiente.text = if (mascotas.isEmpty()) "Omitir por ahora" else "Continuar"
        }
    }

    private fun chip(texto: String, grupo: ChipGroup, marcado: Boolean, alCambiar: (Boolean) -> Unit) {
        val chip = layoutInflater.inflate(R.layout.chip_registro, grupo, false) as Chip
        chip.text = texto
        chip.isChecked = marcado
        chip.setOnCheckedChangeListener { _, checked -> alCambiar(checked) }
        grupo.addView(chip)
    }

    /** Alta o edición de una mascota. [indice] es la posición en la lista si se está editando. */
    private fun mostrarDialogoMascota(indice: Int?) {
        val vista = LayoutInflater.from(this).inflate(R.layout.dialog_mascota_registro, null)
        val dialog = AlertDialog.Builder(this).setView(vista).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        dialog.window?.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        val existente = indice?.let { mascotas[it] }
        var tipo: String? = existente?.tipo
        var sexo: String? = existente?.sexo
        var foto: String? = existente?.fotoPath
        var nacimiento: String = existente?.nacimiento.orEmpty()

        val etNombre = vista.findViewById<EditText>(R.id.etMascotaNombre)
        val etRaza = vista.findViewById<EditText>(R.id.etMascotaRaza)
        val etNacimiento = vista.findViewById<EditText>(R.id.etMascotaNacimiento)
        val etPeso = vista.findViewById<EditText>(R.id.etMascotaPeso)
        val etColor = vista.findViewById<EditText>(R.id.etMascotaColor)
        val etMicrochip = vista.findViewById<EditText>(R.id.etMascotaMicrochip)
        val etObservaciones = vista.findViewById<EditText>(R.id.etMascotaObservaciones)
        val ivFoto = vista.findViewById<ShapeableImageView>(R.id.ivMascotaFoto)

        if (existente != null) {
            vista.findViewById<TextView>(R.id.tvTituloMascota).text = "Editar mascota"
            etNombre.setText(existente.nombre)
            etRaza.setText(existente.raza)
            etNacimiento.setText(existente.nacimiento)
            etPeso.setText(existente.peso)
            etColor.setText(existente.color)
            etMicrochip.setText(existente.microchip)
            etObservaciones.setText(existente.observaciones)
        }
        foto?.let { mostrarFotoEn(ivFoto, it) }

        val grupoTipo = vista.findViewById<ChipGroup>(R.id.cgMascotaTipo)
        TIPOS.forEach { t -> chip(t, grupoTipo, t == tipo) { marcado -> if (marcado) tipo = t else if (tipo == t) tipo = null } }
        val grupoSexo = vista.findViewById<ChipGroup>(R.id.cgMascotaSexo)
        SEXOS.forEach { s -> chip(s, grupoSexo, s == sexo) { marcado -> if (marcado) sexo = s else if (sexo == s) sexo = null } }

        val abrirFoto = View.OnClickListener {
            destinoFoto = { path ->
                if (foto != null && foto != existente?.fotoPath) File(foto!!).delete()
                foto = path
                mostrarFotoEn(ivFoto, path)
            }
            elegirFoto.launch("image/*")
        }
        vista.findViewById<View>(R.id.btnMascotaFoto).setOnClickListener(abrirFoto)
        ivFoto.setOnClickListener(abrirFoto)

        etNacimiento.setOnClickListener {
            val base = runCatching { fechaDesdeTexto(nacimiento) }.getOrNull() ?: LocalDate.now()
            DatePickerDialog(this, { _, y, m, d ->
                val elegida = LocalDate.of(y, m + 1, d)
                if (elegida.isAfter(LocalDate.now())) {
                    Avisos.mostrar(this, "No podés elegir una fecha futura")
                } else {
                    nacimiento = Fechas.corta(elegida)
                    etNacimiento.setText(nacimiento)
                }
            }, base.year, base.monthValue - 1, base.dayOfMonth).apply {
                datePicker.maxDate = System.currentTimeMillis()
            }.show()
        }

        vista.findViewById<View>(R.id.btnMascotaCancelar).setOnClickListener { dialog.dismiss() }
        vista.findViewById<View>(R.id.btnMascotaGuardar).setOnClickListener {
            val nombre = etNombre.text.toString().trim()
            if (nombre.isEmpty()) {
                etNombre.error = "Ingresá el nombre"
                etNombre.requestFocus()
                return@setOnClickListener
            }
            if (tipo == null) {
                Avisos.mostrar(this, "Elegí qué tipo de mascota es")
                return@setOnClickListener
            }
            if (sexo == null) {
                Avisos.mostrar(this, "Elegí el sexo de la mascota")
                return@setOnClickListener
            }
            val micro = etMicrochip.text.toString().trim()
            if (micro.isNotEmpty() && micro.length != 15) {
                etMicrochip.error = "El microchip tiene 15 dígitos"
                etMicrochip.requestFocus()
                return@setOnClickListener
            }
            val peso = etPeso.text.toString().trim()
            val nueva = MascotaRegistro(
                nombre = nombre, tipo = tipo!!, sexo = sexo!!, raza = etRaza.text.toString().trim(),
                nacimiento = nacimiento, fotoPath = foto,
                peso = if (peso.isEmpty()) "" else "$peso kg",
                color = etColor.text.toString().trim(), microchip = micro,
                observaciones = etObservaciones.text.toString().trim()
            )
            if (indice != null) mascotas[indice] = nueva else mascotas.add(nueva)
            actualizarListaMascotas()
            dialog.dismiss()
        }
        dialog.show()
        // El formulario es largo: el diálogo ocupa casi toda la pantalla y el contenido se desplaza
        dialog.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT, (resources.displayMetrics.heightPixels * 0.86).toInt()
        )
    }

    private fun fechaDesdeTexto(texto: String): LocalDate? {
        val partes = texto.split(" ")
        if (partes.size != 3) return null
        val meses = listOf("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")
        val mes = meses.indexOf(partes[1]) + 1
        if (mes == 0) return null
        return LocalDate.of(partes[2].toInt(), mes, partes[0].toInt())
    }

    // ---------- Paso 4: resumen y alta ----------

    private fun domicilio(): String = listOf(
        texto(R.id.etDuenoDireccion), texto(R.id.etDuenoPiso), texto(R.id.etDuenoCiudad)
    ).filter { it.isNotBlank() }.joinToString(", ")

    private fun actualizarResumen() {
        findViewById<TextView>(R.id.tvResumenDueno).text = buildString {
            appendLine(texto(R.id.etDuenoNombre) + " · DNI " + texto(R.id.etDuenoDni))
            appendLine(domicilio())
            append(
                if (mascotas.isEmpty()) "Sin mascotas por ahora"
                else "Mascotas: " + mascotas.joinToString(", ") { "${it.nombre} (${it.tipo.lowercase()})" }
            )
        }
    }

    private fun crearCuenta() {
        val datos = DatosRegistroDueno(
            nombre = texto(R.id.etDuenoNombre),
            dni = texto(R.id.etDuenoDni),
            telefono = texto(R.id.etDuenoTelefono),
            direccion = domicilio(),
            email = texto(R.id.etDuenoEmail).lowercase(Locale.ROOT),
            password = findViewById<EditText>(R.id.etDuenoPassword).text.toString(),
            fotoPath = fotoPath,
            mascotas = mascotas.toList()
        )
        btnSiguiente.isEnabled = false
        btnSiguiente.text = "Creando cuenta..."
        lifecycleScope.launch {
            try {
                val resultado = Registro.dueno(datos)
                setResult(
                    Activity.RESULT_OK,
                    Intent().putExtra(EXTRA_EMAIL, datos.email).putExtra(EXTRA_CONFIRMAR_CORREO, !resultado.sesionIniciada)
                )
                finish()
            } catch (e: Registro.CorreoYaRegistrado) {
                btnSiguiente.isEnabled = true
                btnSiguiente.text = "Crear cuenta"
                paso = 3
                error(R.id.etDuenoEmail, "Ese correo ya está registrado")
            } catch (e: Exception) {
                btnSiguiente.isEnabled = true
                btnSiguiente.text = "Crear cuenta"
                Avisos.error(this@RegistroDuenoActivity, Errores.mensaje(e))
            }
        }
    }
}
