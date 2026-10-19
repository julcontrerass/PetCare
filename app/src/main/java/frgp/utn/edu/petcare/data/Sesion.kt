package frgp.utn.edu.petcare.data

import android.app.Activity
import android.content.Intent
import frgp.utn.edu.petcare.data.avisos.AvisosDelSistema
import frgp.utn.edu.petcare.data.avisos.Recordatorios
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import frgp.utn.edu.petcare.data.repositorio.AdminRepo
import frgp.utn.edu.petcare.data.repositorio.AgendaRepo
import frgp.utn.edu.petcare.data.repositorio.ArchivosRepo
import frgp.utn.edu.petcare.data.repositorio.DuenoRepo
import frgp.utn.edu.petcare.data.repositorio.InformesRepo
import frgp.utn.edu.petcare.data.repositorio.NotificacionesVet
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.data.repositorio.PrescripcionesRepo
import frgp.utn.edu.petcare.data.repositorio.RecordatoriosRepo
import frgp.utn.edu.petcare.data.repositorio.SaludRepo
import frgp.utn.edu.petcare.data.repositorio.SolicitudesRepo
import frgp.utn.edu.petcare.ui.auth.AuthActivity
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/** La cuenta que tiene la sesión iniciada y la carga de sus datos desde el servidor. */
object Sesion {

    enum class Rol { DUENO, VETERINARIO, ADMIN }

    sealed interface Resultado {
        /** La cuenta puede usar la app y sus datos ya están cargados. */
        class Listo(val rol: Rol) : Resultado

        /** La cuenta existe pero no puede ingresar (en revisión, rechazada o suspendida). */
        class Bloqueada(val mensaje: String) : Resultado

        /** La cuenta es dueño y veterinario a la vez: hay que elegir cómo ingresar con [entrarComo]. */
        class Elegir(val roles: List<Rol>) : Resultado
    }

    var usuarioId: String? = null
        private set
    var rol: Rol? = null
        private set
    var perfil: PerfilDto? = null
        private set

    /** Modos en los que se puede usar la cuenta (dueño, veterinario o los dos). */
    var rolesDisponibles: List<Rol> = emptyList()
        private set

    val activa: Boolean get() = usuarioId != null

    /** Id de la sesión abierta en el servidor, aunque todavía no se hayan cargado los datos de la cuenta. */
    suspend fun usuarioIdActual(): String? = Servicios.fuente.restaurarSesion()

    /** Intenta retomar la sesión guardada en el dispositivo; devuelve null si no hay ninguna. */
    suspend fun restaurar(): Resultado? {
        val id = Servicios.fuente.restaurarSesion() ?: return null
        return try {
            cargar(id)
        } catch (e: Exception) {
            // Sin conexión no se puede saber si la cuenta sigue vigente: se vuelve a pedir el ingreso.
            null
        }
    }

    suspend fun ingresar(email: String, password: String): Resultado {
        val id = Servicios.fuente.ingresar(email, password)
        return cargar(id)
    }

    /** Se usa después de crear una cuenta cuando Supabase ya dejó la sesión abierta. */
    suspend fun continuarTrasRegistro(id: String): Resultado = cargar(id)

    private suspend fun cargar(id: String): Resultado {
        var datos = Servicios.fuente.miPerfil()
        usuarioId = id
        perfil = datos
        runCatching { FotosPendientes.subirCredencial(datos.email, id) }
        mensajeDeBloqueo(datos)?.let {
            cerrar()
            return Resultado.Bloqueada(it)
        }
        // Primer ingreso después de registrarse: se suben las fotos que se eligieron en el registro
        if (runCatching { FotosPendientes.subir(datos.email, id) }.getOrDefault(false)) {
            datos = Servicios.fuente.miPerfil()
            perfil = datos
        }
        val roles = rolesDe(datos)
        rolesDisponibles = roles
        // Con dos modos posibles se pregunta cómo ingresar antes de cargar los datos de uno de ellos. A un veterinario
        // solo se le pregunta si ya tiene mascotas propias; si no, entra directo (desde su perfil puede pasar a dueño).
        val preguntar = roles.size > 1 && (datos.rol != "veterinario" || tieneMascotas())
        if (preguntar) return Resultado.Elegir(roles)
        return entrarComo(roles.first())
    }

    private suspend fun tieneMascotas(): Boolean =
        runCatching { Servicios.fuente.misMascotas().isNotEmpty() }.getOrDefault(false)

    /**
     * Modos en los que puede usarse la cuenta. Todo veterinario puede ser también dueño de sus mascotas; un dueño
     * suma el modo veterinario cuando el administrador aprueba su alta.
     */
    private fun rolesDe(datos: PerfilDto): List<Rol> = when (datos.rol) {
        "admin" -> listOf(Rol.ADMIN)
        "veterinario" -> listOf(Rol.VETERINARIO, Rol.DUENO)
        else -> if (datos.veterinarios?.estadoRevision == "activo") listOf(Rol.DUENO, Rol.VETERINARIO) else listOf(Rol.DUENO)
    }

    /** Carga los datos del modo elegido y deja la sesión lista para usarse en él. */
    suspend fun entrarComo(rolElegido: Rol): Resultado.Listo {
        val datos = perfil ?: error("No hay una sesión abierta")
        require(rolElegido in rolesDisponibles) { "La cuenta no puede ingresar como $rolElegido" }
        coroutineScope {
            when (rolElegido) {
                Rol.DUENO -> DuenoRepo.cargar(datos)
                Rol.VETERINARIO -> {
                    PerfilVetRepo.cargar(datos)
                    recargarVeterinario(silencioso = true)
                }
                Rol.ADMIN -> AdminRepo.cargar()
            }
        }
        rol = rolElegido
        escucharCambios(rolElegido)
        Servicios.contextoApp?.let { Recordatorios.vigilarAvisos(it) }
        avisarSiHayAvisosSinLeer(rolElegido)
        return Resultado.Listo(rolElegido)
    }

    /** Pasa de un modo al otro sin cerrar la sesión: se descartan los datos del anterior y se cargan los nuevos. */
    suspend fun cambiarModo(nuevo: Rol): Resultado.Listo {
        require(nuevo in rolesDisponibles) { "La cuenta no puede ingresar como $nuevo" }
        descartarDatosDelModo()
        return entrarComo(nuevo)
    }

    /** Vuelve a pedir el perfil: sirve para enterarse de que el rol de veterinario fue aprobado. */
    suspend fun actualizarRoles() {
        val datos = Servicios.fuente.miPerfil()
        perfil = datos
        rolesDisponibles = rolesDe(datos)
    }

    /**
     * Lo que llegó mientras la cuenta no estaba abierta no suena (ya pasó), pero se avisa que hay avisos sin leer
     * para que no queden escondidos en la campana.
     */
    private fun avisarSiHayAvisosSinLeer(rolCuenta: Rol) {
        val cantidad = when (rolCuenta) {
            Rol.DUENO -> DuenoRepo.notificaciones.count { !it.leida }
            Rol.VETERINARIO -> NotificacionesVet.sinLeer
            Rol.ADMIN -> 0
        }
        if (cantidad == 0) return
        Servicios.scope.launch {
            // Da tiempo a que se abra la pantalla principal, que es donde tiene que verse
            delay(1500)
            frgp.utn.edu.petcare.ui.common.Avisos.mostrar(
                null, if (cantidad == 1) "Tenés 1 notificación sin leer" else "Tenés $cantidad notificaciones sin leer"
            )
        }
    }

    private fun mensajeDeBloqueo(p: PerfilDto): String? {
        val detalle = p.motivoEstado?.takeIf { it.isNotBlank() }?.let { "\n\nMotivo: $it" }.orEmpty()
        return when (p.estado) {
            "pendiente_revision" ->
                "Tu cuenta está en revisión. El administrador tiene que verificar tu matrícula antes de darte el alta."
            "rechazado" -> "El administrador rechazó tu solicitud de alta.$detalle"
            "suspendido" -> "El administrador suspendió tu cuenta.$detalle"
            else -> null
        }
    }

    private var escucha: Job? = null

    /**
     * Mientras hay sesión se escuchan los cambios del servidor y se vuelven a pedir los datos al instante, así
     * un turno nuevo, una cancelación o un informe aparecen sin esperar ni tocar nada.
     */
    private fun escucharCambios(rolCuenta: Rol) {
        escucha?.cancel()
        escucha = Servicios.scope.launch {
            Servicios.fuente.cambios()
                .catch { }
                .conflate()
                .collect {
                    // Si llegan varios cambios seguidos (un turno y su aviso) se piden los datos una sola vez
                    delay(if (rolCuenta == Rol.ADMIN) 1500 else 300)
                    runCatching {
                        when (rolCuenta) {
                            Rol.DUENO -> DuenoRepo.recargarDerivados()
                            Rol.VETERINARIO -> recargarVeterinario()
                            Rol.ADMIN -> AdminRepo.cargar()
                        }
                    }
                    Servicios.avisarCambio()
                }
        }
    }

    /** Pide al servidor los pacientes, la agenda, el carnet y las solicitudes del veterinario. */
    suspend fun recargarVeterinario(silencioso: Boolean = false) = coroutineScope {
        // Los registros de salud se muestran con el nombre del paciente: primero hay que tener los pacientes
        PacientesRepo.cargar()
        val agenda = async { AgendaRepo.cargar() }
        val salud = async { SaludRepo.cargar() }
        val solicitudes = async { SolicitudesRepo.cargar() }
        val avisos = async { runCatching { NotificacionesVet.cargar(silencioso) } }
        val recordatorios = async { runCatching { RecordatoriosRepo.cargar() } }
        avisos.await()
        recordatorios.await()
        agenda.await()
        salud.await()
        solicitudes.await()
        Servicios.contextoApp?.let {
            val manuales = RecordatoriosRepo.lista.map { r ->
                Recordatorios.Manual(r.id, PacientesRepo.nombreDe(r.mascotaId), r.titulo, r.fecha, r.hora, r.nota)
            }
            Recordatorios.programar(it, Recordatorios.paraVeterinario(AgendaRepo.eventos) + Recordatorios.paraManuales(manuales))
        }
    }

    /** Vuelve a pedir el perfil propio después de un cambio que el servidor rechazó. */
    suspend fun recargarPerfil() {
        val datos = Servicios.fuente.miPerfil()
        perfil = datos
        when (rol) {
            Rol.VETERINARIO -> PerfilVetRepo.cargar(datos)
            Rol.DUENO -> DuenoRepo.cargar(datos)
            else -> Unit
        }
        Servicios.avisarCambio()
    }

    /** Cierra la sesión en el servidor y descarta todo lo que había en memoria. */
    suspend fun cerrar() {
        runCatching { Servicios.fuente.cerrarSesion() }
        olvidar()
    }

    /** Cierra la sesión y vuelve a la pantalla de ingreso, sin dejar pantallas anteriores en la pila. */
    fun cerrarYVolver(actividad: Activity) {
        volverAlIngreso(actividad)
        Servicios.scope.launch { runCatching { Servicios.fuente.cerrarSesion() } }
    }

    /** Descarta los datos en memoria y abre el ingreso como única pantalla. */
    fun volverAlIngreso(actividad: Activity) {
        val intent = Intent(actividad, AuthActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        olvidar()
        actividad.startActivity(intent)
    }

    /**
     * Da de baja la cuenta: primero se borran del almacenamiento las fotos y archivos propios (la base no puede
     * hacerlo sola) y después se elimina el usuario con todo lo que cargó.
     */
    suspend fun eliminarCuenta() {
        val f = Servicios.fuente
        f.rutasArchivosCuenta().groupBy { it.bucket }.forEach { (bucket, rutas) ->
            f.borrar(bucket, rutas.map { it.ruta })
        }
        f.eliminarCuenta()
    }

    /** Descarta los datos de la cuenta anterior sin tocar el servidor (la sesión ya se cerró o venció). */
    fun olvidar() {
        descartarDatosDelModo()
        usuarioId = null
        perfil = null
        rolesDisponibles = emptyList()
        Imagenes.limpiarCache()
    }

    /** Vacía los datos del modo que se estaba usando; la sesión y el perfil siguen. */
    private fun descartarDatosDelModo() {
        Servicios.contextoApp?.let {
            Recordatorios.cancelarTodo(it)
            AvisosDelSistema.olvidar(it)
        }
        escucha?.cancel()
        escucha = null
        rol = null
        DuenoRepo.limpiar()
        PerfilVetRepo.limpiar()
        PacientesRepo.limpiar()
        AgendaRepo.limpiar()
        SaludRepo.limpiar()
        RecordatoriosRepo.limpiar()
        ArchivosRepo.limpiar()
        InformesRepo.limpiar()
        PrescripcionesRepo.limpiar()
        SolicitudesRepo.limpiar()
        NotificacionesVet.limpiar()
        AdminRepo.limpiar()
    }
}
