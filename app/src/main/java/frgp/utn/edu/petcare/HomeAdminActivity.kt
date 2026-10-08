package frgp.utn.edu.petcare

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import frgp.utn.edu.petcare.ui.auth.AuthActivity
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import java.time.LocalDate

/**
 * Panel del administrador: resumen general, revisión de altas de veterinarios, listado de dueños con sus
 * mascotas y registro de actividad. Desde acá se da de alta, rechaza, suspende o reactiva cuentas.
 */
class HomeAdminActivity : BaseActivity() {

    private lateinit var bottomNav: BottomNavigationView
    private lateinit var paneles: Map<Int, View>

    private lateinit var adapterVets: AdminVetAdapter
    private lateinit var adapterDuenos: AdminDuenoAdapter
    private lateinit var adapterActividad: AdminActividadAdapter

    private val chipsVets = linkedMapOf<String?, Chip>()
    private val chipsDuenos = linkedMapOf<String?, Chip>()
    private var filtroVets: String? = AdminRepo.PENDIENTE
    private var filtroDuenos: String? = null
    private var busquedaVets = ""
    private var busquedaDuenos = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.home_admin)
        VetUi.barras(this)

        paneles = mapOf(
            R.id.nav_admin_inicio to findViewById(R.id.panelInicio),
            R.id.nav_admin_vets to findViewById(R.id.panelVets),
            R.id.nav_admin_duenos to findViewById(R.id.panelDuenos),
            R.id.nav_admin_actividad to findViewById(R.id.panelActividad)
        )
        bottomNav = findViewById(R.id.bottomNavigation)

        configurarListas()
        configurarFiltros()
        configurarBusquedas()
        configurarInicio()

        bottomNav.setOnItemSelectedListener { item ->
            mostrarPanel(item.itemId)
            true
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (bottomNav.selectedItemId != R.id.nav_admin_inicio) {
                    bottomNav.selectedItemId = R.id.nav_admin_inicio
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        mostrarPanel(R.id.nav_admin_inicio)
        refrescarTodo()
    }

    override fun onResume() {
        super.onResume()
        refrescarTodo()
    }

    // ---------- Configuración inicial ----------

    private fun configurarListas() {
        adapterVets = AdminVetAdapter(
            emptyList(),
            alAbrir = { mostrarDetalleVet(it) },
            alAprobar = { aprobar(it) },
            alRechazar = { pedirRechazo(it) }
        )
        findViewById<RecyclerView>(R.id.rvVetsAdmin).adapter = adapterVets

        adapterDuenos = AdminDuenoAdapter(emptyList()) { mostrarDetalleDueno(it) }
        findViewById<RecyclerView>(R.id.rvDuenosAdmin).adapter = adapterDuenos

        adapterActividad = AdminActividadAdapter(emptyList())
        findViewById<RecyclerView>(R.id.rvActividadAdmin).adapter = adapterActividad
    }

    private fun crearChip(grupo: ChipGroup, texto: String): Chip {
        val chip = layoutInflater.inflate(R.layout.chip_registro, grupo, false) as Chip
        chip.id = View.generateViewId()
        chip.text = texto
        grupo.addView(chip)
        return chip
    }

    private fun configurarFiltros() {
        val grupoVets = findViewById<ChipGroup>(R.id.cgFiltroVets)
        listOf<Pair<String?, String>>(
            AdminRepo.PENDIENTE to "En revisión", AdminRepo.ACTIVO to "Activos",
            AdminRepo.RECHAZADO to "Rechazados", AdminRepo.SUSPENDIDO to "Suspendidos", null to "Todos"
        ).forEach { (estado, texto) -> chipsVets[estado] = crearChip(grupoVets, texto) }
        chipsVets[filtroVets]?.isChecked = true
        grupoVets.setOnCheckedStateChangeListener { _, ids ->
            val elegido = chipsVets.entries.firstOrNull { it.value.id == ids.firstOrNull() } ?: return@setOnCheckedStateChangeListener
            filtroVets = elegido.key
            refrescarVets()
        }

        val grupoDuenos = findViewById<ChipGroup>(R.id.cgFiltroDuenos)
        listOf<Pair<String?, String>>(
            null to "Todos", AdminRepo.ACTIVO to "Activos", AdminRepo.SUSPENDIDO to "Suspendidos"
        ).forEach { (estado, texto) -> chipsDuenos[estado] = crearChip(grupoDuenos, texto) }
        chipsDuenos[filtroDuenos]?.isChecked = true
        grupoDuenos.setOnCheckedStateChangeListener { _, ids ->
            val elegido = chipsDuenos.entries.firstOrNull { it.value.id == ids.firstOrNull() } ?: return@setOnCheckedStateChangeListener
            filtroDuenos = elegido.key
            refrescarDuenos()
        }
    }

    private fun alEscribir(campo: EditText, accion: (String) -> Unit) {
        campo.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) =
                accion(s?.toString().orEmpty().trim())
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun configurarBusquedas() {
        alEscribir(findViewById(R.id.etBuscarVetAdmin)) { busquedaVets = it; refrescarVets() }
        alEscribir(findViewById(R.id.etBuscarDuenoAdmin)) { busquedaDuenos = it; refrescarDuenos() }
    }

    private fun configurarInicio() {
        findViewById<View>(R.id.tileAdminVets).setOnClickListener { verVeterinarios(AdminRepo.ACTIVO) }
        findViewById<View>(R.id.tileAdminDuenos).setOnClickListener { bottomNav.selectedItemId = R.id.nav_admin_duenos }
        findViewById<View>(R.id.tileAdminMascotas).setOnClickListener { bottomNav.selectedItemId = R.id.nav_admin_duenos }
        findViewById<View>(R.id.tileAdminTurnos).setOnClickListener {
            val hoy = AgendaRepo.deHoy().size
            Toast.makeText(
                this,
                if (hoy == 1) "Hay 1 turno pendiente para hoy" else "Hay $hoy turnos pendientes para hoy",
                Toast.LENGTH_SHORT
            ).show()
        }
        findViewById<View>(R.id.btnVerTodasPendientes).setOnClickListener { verVeterinarios(AdminRepo.PENDIENTE) }
        findViewById<View>(R.id.btnVerActividad).setOnClickListener { bottomNav.selectedItemId = R.id.nav_admin_actividad }
        findViewById<View>(R.id.btnAdminCuenta).setOnClickListener { mostrarCuenta() }
    }

    // ---------- Navegación ----------

    private fun mostrarPanel(navId: Int) {
        paneles.forEach { (id, panel) ->
            val visible = id == navId
            if (visible && panel.visibility != View.VISIBLE) {
                panel.alpha = 0f
                panel.visibility = View.VISIBLE
                panel.animate().alpha(1f).setDuration(180).start()
            } else if (!visible) {
                panel.visibility = View.GONE
            }
        }
    }

    private fun verVeterinarios(estado: String?) {
        filtroVets = estado
        chipsVets[estado]?.isChecked = true
        bottomNav.selectedItemId = R.id.nav_admin_vets
        refrescarVets()
    }

    // ---------- Refresco de datos ----------

    private fun refrescarTodo() {
        refrescarInicio()
        refrescarVets()
        refrescarDuenos()
        refrescarActividad()
        val pendientes = AdminRepo.pendientesRevisionCount()
        if (pendientes > 0) {
            bottomNav.getOrCreateBadge(R.id.nav_admin_vets).apply {
                number = pendientes
                backgroundColor = getColor(R.color.danger_red)
                badgeTextColor = getColor(R.color.white)
            }
        } else {
            bottomNav.removeBadge(R.id.nav_admin_vets)
        }
    }

    private fun mostrarVacio(vacio: View, icono: Int, titulo: String, mensaje: String) {
        vacio.findViewById<ImageView>(R.id.ivEmptyIcon).setImageResource(icono)
        vacio.findViewById<TextView>(R.id.tvEmptyTitle).text = titulo
        vacio.findViewById<TextView>(R.id.tvEmptyMessage).text = mensaje
    }

    private val dias = arrayOf("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")

    private fun refrescarInicio() {
        val hoy = LocalDate.now()
        findViewById<TextView>(R.id.tvAdminFecha).text =
            "${dias[hoy.dayOfWeek.value - 1]} ${hoy.dayOfMonth} de ${Fechas.mesAnio(hoy).substringBefore(' ').lowercase()}"

        val pendientes = AdminRepo.pendientesRevisionCount()
        val etiqueta = findViewById<TextView>(R.id.tvAdminHeroLabel)
        val titulo = findViewById<TextView>(R.id.tvAdminHeroTitulo)
        val subtitulo = findViewById<TextView>(R.id.tvAdminHeroSub)
        val boton = findViewById<TextView>(R.id.btnAdminHeroAccion)
        if (pendientes > 0) {
            etiqueta.text = "Revisión pendiente"
            titulo.text = if (pendientes == 1) "1 veterinario espera tu aprobación" else "$pendientes veterinarios esperan tu aprobación"
            subtitulo.text = "Verificá la matrícula antes de darlos de alta."
            boton.text = "Revisar solicitudes"
            boton.setOnClickListener { verVeterinarios(AdminRepo.PENDIENTE) }
        } else {
            etiqueta.text = "Todo al día"
            titulo.text = "No hay altas pendientes"
            subtitulo.text = "Cuando un veterinario pida el alta lo vas a ver acá."
            boton.text = "Ver veterinarios"
            boton.setOnClickListener { verVeterinarios(null) }
        }

        findViewById<TextView>(R.id.tvStatVets).text = AdminRepo.vetsActivos().toString()
        findViewById<TextView>(R.id.tvStatDuenos).text = AdminRepo.listaDuenos.size.toString()
        findViewById<TextView>(R.id.tvStatMascotas).text = AdminRepo.totalMascotas().toString()
        findViewById<TextView>(R.id.tvStatTurnos).text = AgendaRepo.deHoy().size.toString()

        val contenedorPend = findViewById<android.widget.LinearLayout>(R.id.llPendientesInicio)
        contenedorPend.removeAllViews()
        val pendientesLista = AdminRepo.porEstado(AdminRepo.PENDIENTE)
        pendientesLista.take(3).forEach { vet ->
            val fila = layoutInflater.inflate(R.layout.item_admin_pendiente, contenedorPend, false)
            AdminUi.avatar(
                fila.findViewById(R.id.tvPendIniciales), fila.findViewById(R.id.ivPendFoto), vet.nombre, vet.fotoPath
            )
            fila.findViewById<TextView>(R.id.tvPendNombre).text = vet.nombre
            fila.findViewById<TextView>(R.id.tvPendDetalle).text = "Matrícula ${vet.matricula} · ${vet.clinica}"
            fila.findViewById<TextView>(R.id.tvPendCuando).text = "Pidió el alta · ${AdminUi.hace(vet.fechaRegistro).lowercase()}"
            fila.setOnClickListener { mostrarDetalleVet(vet) }
            contenedorPend.addView(fila)
        }
        val vacioPend = findViewById<View>(R.id.emptyPendientesInicio)
        vacioPend.visibility = if (pendientesLista.isEmpty()) View.VISIBLE else View.GONE
        findViewById<View>(R.id.btnVerTodasPendientes).visibility = if (pendientesLista.isEmpty()) View.GONE else View.VISIBLE
        mostrarVacio(vacioPend, R.drawable.ic_check_circle, "Sin solicitudes pendientes", "Ya revisaste todas las altas")

        val contenedorAct = findViewById<android.widget.LinearLayout>(R.id.llActividadInicio)
        contenedorAct.removeAllViews()
        AdminRepo.actividad.take(4).forEach { contenedorAct.addView(AdminUi.vistaActividad(layoutInflater, contenedorAct, it)) }
    }

    private fun textoContiene(q: String, vararg campos: String) =
        q.isBlank() || campos.any { it.contains(q, ignoreCase = true) }

    private fun refrescarVets() {
        for ((estado, chip) in chipsVets) {
            val base = chip.text.toString().substringBefore(" (")
            val cantidad = if (estado == null) AdminRepo.listaVeterinarios.size else AdminRepo.porEstado(estado).size
            chip.text = "$base ($cantidad)"
        }
        val lista = AdminRepo.listaVeterinarios
            .filter { filtroVets == null || it.estado == filtroVets }
            .filter { textoContiene(busquedaVets, it.nombre, it.matricula, it.clinica, it.email, it.dni) }
            .sortedBy { if (it.estado == AdminRepo.PENDIENTE) 0 else 1 }
        adapterVets.actualizar(lista)

        findViewById<TextView>(R.id.tvVetsCount).text =
            "${AdminRepo.vetsActivos()} activos · ${AdminRepo.pendientesRevisionCount()} en revisión"
        val vacio = findViewById<View>(R.id.emptyVetsAdmin)
        vacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
        findViewById<View>(R.id.rvVetsAdmin).visibility = if (lista.isEmpty()) View.GONE else View.VISIBLE
        mostrarVacio(
            vacio, R.drawable.ic_medical_kit,
            if (busquedaVets.isNotBlank()) "No encontramos veterinarios" else "Sin veterinarios acá",
            if (busquedaVets.isNotBlank()) "Probá con otro nombre, matrícula o clínica" else "No hay veterinarios con este estado"
        )
    }

    private fun refrescarDuenos() {
        for ((estado, chip) in chipsDuenos) {
            val base = chip.text.toString().substringBefore(" (")
            val cantidad = if (estado == null) AdminRepo.listaDuenos.size else AdminRepo.listaDuenos.count { it.estado == estado }
            chip.text = "$base ($cantidad)"
        }
        val lista = AdminRepo.listaDuenos
            .filter { filtroDuenos == null || it.estado == filtroDuenos }
            .filter { textoContiene(busquedaDuenos, it.nombre, it.dni, it.email, it.telefono) }
        adapterDuenos.actualizar(lista)

        findViewById<TextView>(R.id.tvDuenosCount).text =
            "${AdminRepo.listaDuenos.size} dueños · ${AdminRepo.totalMascotas()} mascotas"
        val vacio = findViewById<View>(R.id.emptyDuenosAdmin)
        vacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
        findViewById<View>(R.id.rvDuenosAdmin).visibility = if (lista.isEmpty()) View.GONE else View.VISIBLE
        mostrarVacio(
            vacio, R.drawable.ic_person,
            if (busquedaDuenos.isNotBlank()) "No encontramos dueños" else "Sin dueños acá",
            if (busquedaDuenos.isNotBlank()) "Probá con otro nombre, DNI o correo" else "No hay dueños con este estado"
        )
    }

    private fun refrescarActividad() {
        adapterActividad.actualizar(AdminRepo.actividad.toList())
        findViewById<TextView>(R.id.tvActividadCount).text = "Últimos movimientos de la plataforma"
        val vacio = findViewById<View>(R.id.emptyActividadAdmin)
        vacio.visibility = if (AdminRepo.actividad.isEmpty()) View.VISIBLE else View.GONE
        mostrarVacio(vacio, R.drawable.ic_history, "Sin actividad", "Los registros y cambios de cuentas aparecen acá")
    }

    // ---------- Acciones sobre veterinarios ----------

    private fun aprobar(vet: VetAdminItem) {
        AdminRepo.aprobarVet(vet.id)
        Toast.makeText(this, "${vet.nombre} ya está dado de alta", Toast.LENGTH_SHORT).show()
        refrescarTodo()
    }

    private fun pedirRechazo(vet: VetAdminItem, alTerminar: () -> Unit = {}) {
        pedirMotivo(
            "Rechazar a ${vet.nombre}", "El veterinario va a ver este motivo cuando intente ingresar.",
            listOf("No se pudo verificar la matrícula", "Datos incompletos o incorrectos", "Documentación inválida"),
            "Rechazar"
        ) { motivo ->
            AdminRepo.rechazarVet(vet.id, motivo)
            Toast.makeText(this, "Solicitud de ${vet.nombre} rechazada", Toast.LENGTH_SHORT).show()
            refrescarTodo()
            alTerminar()
        }
    }

    private fun pedirSuspensionVet(vet: VetAdminItem, alTerminar: () -> Unit) {
        pedirMotivo(
            "Suspender a ${vet.nombre}", "No va a poder ingresar hasta que lo reactives.",
            listOf("Matrícula vencida", "Reclamos de dueños", "Datos desactualizados"),
            "Suspender"
        ) { motivo ->
            AdminRepo.suspenderVet(vet.id, motivo)
            Toast.makeText(this, "${vet.nombre} quedó suspendido", Toast.LENGTH_SHORT).show()
            refrescarTodo()
            alTerminar()
        }
    }

    private fun pedirSuspensionDueno(dueno: DuenoAdminItem, alTerminar: () -> Unit) {
        pedirMotivo(
            "Suspender a ${dueno.nombre}", "No va a poder ingresar hasta que lo reactives.",
            listOf("Datos falsos", "Uso indebido de la plataforma", "Pedido del propio usuario"),
            "Suspender"
        ) { motivo ->
            AdminRepo.suspenderDueno(dueno.id, motivo)
            Toast.makeText(this, "La cuenta de ${dueno.nombre} quedó suspendida", Toast.LENGTH_SHORT).show()
            refrescarTodo()
            alTerminar()
        }
    }

    private fun pedirMotivo(
        titulo: String, ayuda: String, sugerencias: List<String>, confirmar: String, alConfirmar: (String) -> Unit
    ) {
        val vista = LayoutInflater.from(this).inflate(R.layout.dialog_motivo_admin, null)
        val dialog = AlertDialog.Builder(this).setView(vista).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        vista.findViewById<TextView>(R.id.tvMotivoTitulo).text = titulo
        vista.findViewById<TextView>(R.id.tvMotivoAyuda).text = ayuda
        val campo = vista.findViewById<EditText>(R.id.etMotivoAdmin)
        val grupo = vista.findViewById<ChipGroup>(R.id.cgMotivos)
        sugerencias.forEach { texto ->
            val chip = layoutInflater.inflate(R.layout.chip_registro, grupo, false) as Chip
            chip.text = texto
            chip.isCheckable = false
            chip.setOnClickListener { campo.setText(texto); campo.setSelection(texto.length) }
            grupo.addView(chip)
        }
        vista.findViewById<MaterialButton>(R.id.btnMotivoConfirmar).apply {
            text = confirmar
            setOnClickListener {
                val motivo = campo.text.toString().trim()
                if (motivo.length < 5) {
                    campo.error = "Escribí el motivo"
                    campo.requestFocus()
                    return@setOnClickListener
                }
                dialog.dismiss()
                alConfirmar(motivo)
            }
        }
        vista.findViewById<View>(R.id.btnMotivoCancelar).setOnClickListener { dialog.dismiss() }
        dialog.show()
    }

    // ---------- Detalles ----------

    private fun abrirExterno(intent: Intent) {
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "No hay una aplicación disponible para esta acción", Toast.LENGTH_SHORT).show()
        }
    }

    private fun llamar(telefono: String) =
        abrirExterno(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + telefono.filter { it.isDigit() || it == '+' })))

    private fun escribir(email: String) = abrirExterno(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$email")))

    private fun crearSheet(vista: View): BottomSheetDialog {
        val sheet = BottomSheetDialog(this)
        sheet.setContentView(vista)
        sheet.behavior.state = BottomSheetBehavior.STATE_EXPANDED
        sheet.behavior.skipCollapsed = true
        return sheet
    }

    private fun texto(vista: View, id: Int, valor: String) {
        vista.findViewById<TextView>(id).text = valor.ifBlank { "Sin datos" }
    }

    private fun mostrarDetalleVet(vet: VetAdminItem) {
        val vista = layoutInflater.inflate(R.layout.sheet_admin_vet, null)
        val sheet = crearSheet(vista)
        AdminUi.avatar(vista.findViewById(R.id.tvVetIniciales), vista.findViewById(R.id.ivVetFoto), vet.nombre, vet.fotoPath)
        vista.findViewById<TextView>(R.id.tvVetNombre).text = vet.nombre
        AdminUi.aplicar(vista.findViewById(R.id.tvVetEstado), AdminUi.estiloVet(vet.estado))
        texto(vista, R.id.tvVetDni, vet.dni)
        texto(vista, R.id.tvVetMatricula, vet.matricula)
        texto(vista, R.id.tvVetClinica, vet.clinica)
        texto(vista, R.id.tvVetDireccion, vet.direccion)
        texto(vista, R.id.tvVetTelefono, vet.telefono)
        texto(vista, R.id.tvVetEmail, vet.email)
        texto(vista, R.id.tvVetEspecialidades, vet.especialidades)
        texto(vista, R.id.tvVetHorarios, vet.diasYHorarios)
        texto(vista, R.id.tvVetRegistro, "${Fechas.corta(vet.fechaRegistro)} (${AdminUi.hace(vet.fechaRegistro).lowercase()})")

        val aviso = vista.findViewById<TextView>(R.id.tvVetAviso)
        when {
            vet.estado == AdminRepo.PENDIENTE -> {
                aviso.text = "Verificá la matrícula ${vet.matricula} en el colegio profesional antes de dar el alta."
                aviso.visibility = View.VISIBLE
            }
            vet.motivo.isNotBlank() -> {
                aviso.text = "Motivo: ${vet.motivo}"
                aviso.visibility = View.VISIBLE
            }
        }

        vista.findViewById<View>(R.id.btnVetLlamar).setOnClickListener { llamar(vet.telefono) }
        vista.findViewById<View>(R.id.btnVetCorreo).setOnClickListener { escribir(vet.email) }

        val principal = vista.findViewById<MaterialButton>(R.id.btnVetPrincipal)
        val secundario = vista.findViewById<MaterialButton>(R.id.btnVetSecundario)
        principal.visibility = View.GONE
        secundario.visibility = View.GONE
        when (vet.estado) {
            AdminRepo.PENDIENTE -> {
                principal.configurar("Dar de alta") { AdminRepo.aprobarVet(vet.id); terminarAccion(sheet, "${vet.nombre} ya está dado de alta") }
                secundario.configurar("Rechazar solicitud") { pedirRechazo(vet) { sheet.dismiss() } }
            }
            AdminRepo.ACTIVO ->
                secundario.configurar("Suspender cuenta") { pedirSuspensionVet(vet) { sheet.dismiss() } }
            AdminRepo.SUSPENDIDO ->
                principal.configurar("Reactivar cuenta") { AdminRepo.reactivarVet(vet.id); terminarAccion(sheet, "${vet.nombre} fue reactivado") }
            else ->
                principal.configurar("Dar de alta igualmente") { AdminRepo.aprobarVet(vet.id); terminarAccion(sheet, "${vet.nombre} ya está dado de alta") }
        }
        sheet.show()
    }

    private fun mostrarDetalleDueno(dueno: DuenoAdminItem) {
        val vista = layoutInflater.inflate(R.layout.sheet_admin_dueno, null)
        val sheet = crearSheet(vista)
        AdminUi.avatar(vista.findViewById(R.id.tvDuenoIniciales), vista.findViewById(R.id.ivDuenoFoto), dueno.nombre, dueno.fotoPath)
        vista.findViewById<TextView>(R.id.tvDuenoNombre).text = dueno.nombre
        AdminUi.aplicar(vista.findViewById(R.id.tvDuenoEstado), AdminUi.estiloDueno(dueno.estado))
        texto(vista, R.id.tvDuenoDni, dueno.dni)
        texto(vista, R.id.tvDuenoEmail, dueno.email)
        texto(vista, R.id.tvDuenoTelefono, dueno.telefono)
        texto(vista, R.id.tvDuenoDireccion, dueno.direccion)
        texto(vista, R.id.tvDuenoRegistro, "${Fechas.corta(dueno.fechaRegistro)} (${AdminUi.hace(dueno.fechaRegistro).lowercase()})")
        texto(vista, R.id.tvDuenoMascotasDetalle, dueno.mascotas.joinToString("\n") { "• $it" })

        val aviso = vista.findViewById<TextView>(R.id.tvDuenoAviso)
        if (dueno.motivo.isNotBlank()) {
            aviso.text = "Motivo de la suspensión: ${dueno.motivo}"
            aviso.visibility = View.VISIBLE
        }
        vista.findViewById<View>(R.id.btnDuenoLlamar).setOnClickListener { llamar(dueno.telefono) }
        vista.findViewById<View>(R.id.btnDuenoCorreo).setOnClickListener { escribir(dueno.email) }

        val principal = vista.findViewById<MaterialButton>(R.id.btnDuenoPrincipal)
        val secundario = vista.findViewById<MaterialButton>(R.id.btnDuenoSecundario)
        principal.visibility = View.GONE
        secundario.visibility = View.GONE
        if (dueno.estado == AdminRepo.SUSPENDIDO) {
            principal.configurar("Reactivar cuenta") { AdminRepo.reactivarDueno(dueno.id); terminarAccion(sheet, "La cuenta de ${dueno.nombre} fue reactivada") }
        } else {
            secundario.configurar("Suspender cuenta") { pedirSuspensionDueno(dueno) { sheet.dismiss() } }
        }
        sheet.show()
    }

    private fun MaterialButton.configurar(texto: String, accion: () -> Unit) {
        this.text = texto
        visibility = View.VISIBLE
        setOnClickListener { accion() }
    }

    private fun terminarAccion(sheet: BottomSheetDialog, mensaje: String) {
        sheet.dismiss()
        Toast.makeText(this, mensaje, Toast.LENGTH_SHORT).show()
        refrescarTodo()
    }

    // ---------- Cuenta del administrador ----------

    private fun mostrarCuenta() {
        val vista = layoutInflater.inflate(R.layout.sheet_admin_cuenta, null)
        val sheet = crearSheet(vista)
        vista.findViewById<TextView>(R.id.tvCuentaEmail).text = AdminRepo.EMAIL_ADMIN
        vista.findViewById<TextView>(R.id.tvCuentaVets).text =
            "${AdminRepo.vetsActivos()} activos de ${AdminRepo.listaVeterinarios.size}"
        vista.findViewById<TextView>(R.id.tvCuentaDuenos).text =
            "${AdminRepo.listaDuenos.size} dueños · ${AdminRepo.totalMascotas()} mascotas"
        val pendientes = AdminRepo.pendientesRevisionCount()
        vista.findViewById<TextView>(R.id.tvCuentaPendientes).text = when (pendientes) {
            0 -> "Ninguna"
            1 -> "1 pendiente"
            else -> "$pendientes pendientes"
        }
        vista.findViewById<View>(R.id.btnCuentaVolver).setOnClickListener { sheet.dismiss() }
        vista.findViewById<View>(R.id.btnCuentaCerrarSesion).setOnClickListener {
            sheet.dismiss()
            val intent = Intent(this, AuthActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            startActivity(intent)
        }
        sheet.show()
    }
}
