package frgp.utn.edu.petcare.data

import android.app.Activity
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.delay
import kotlinx.coroutines.Job
import frgp.utn.edu.petcare.NotificacionesVet
import android.content.Intent
import frgp.utn.edu.petcare.AdminRepo
import frgp.utn.edu.petcare.AgendaRepo
import frgp.utn.edu.petcare.ArchivosRepo
import frgp.utn.edu.petcare.InformesRepo
import frgp.utn.edu.petcare.PacientesRepo
import frgp.utn.edu.petcare.PerfilVetRepo
import frgp.utn.edu.petcare.SaludRepo
import frgp.utn.edu.petcare.SolicitudesRepo
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import frgp.utn.edu.petcare.ui.auth.AuthActivity
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/** La cuenta que tiene la sesión iniciada y la carga de sus datos desde el servidor. */
object Sesion {

    enum class Rol { DUENO, VETERINARIO, ADMIN }

    sealed interface Resultado {
        /** La cuenta puede usar la app y sus datos ya están cargados. */
        class Listo(val rol: Rol) : Resultado

        /** La cuenta existe pero no puede ingresar (en revisión, rechazada o suspendida). */
        class Bloqueada(val mensaje: String) : Resultado
    }

    var usuarioId: String? = null
        private set
    var rol: Rol? = null
        private set
    var perfil: PerfilDto? = null
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
        mensajeDeBloqueo(datos)?.let {
            cerrar()
            return Resultado.Bloqueada(it)
        }
        // Primer ingreso después de registrarse: se suben las fotos que se eligieron en el registro
        if (runCatching { FotosPendientes.subir(datos.email, id) }.getOrDefault(false)) {
            datos = Servicios.fuente.miPerfil()
            perfil = datos
        }
        val rolCuenta = when (datos.rol) {
            "veterinario" -> Rol.VETERINARIO
            "admin" -> Rol.ADMIN
            else -> Rol.DUENO
        }
        coroutineScope {
            when (rolCuenta) {
                Rol.DUENO -> DuenoRepo.cargar(datos)
                Rol.VETERINARIO -> {
                    PerfilVetRepo.cargar(datos)
                    recargarVeterinario()
                }
                Rol.ADMIN -> AdminRepo.cargar()
            }
        }
        rol = rolCuenta
        escucharCambios(rolCuenta)
        return Resultado.Listo(rolCuenta)
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
                    delay(300)
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
    suspend fun recargarVeterinario() = coroutineScope {
        // Los registros de salud se muestran con el nombre del paciente: primero hay que tener los pacientes
        PacientesRepo.cargar()
        val agenda = async { AgendaRepo.cargar() }
        val salud = async { SaludRepo.cargar() }
        val solicitudes = async { SolicitudesRepo.cargar() }
        val avisos = async { runCatching { NotificacionesVet.cargar() } }
        avisos.await()
        agenda.await()
        salud.await()
        solicitudes.await()
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
        escucha?.cancel()
        escucha = null
        usuarioId = null
        rol = null
        perfil = null
        DuenoRepo.limpiar()
        PerfilVetRepo.limpiar()
        PacientesRepo.limpiar()
        AgendaRepo.limpiar()
        SaludRepo.limpiar()
        ArchivosRepo.limpiar()
        InformesRepo.limpiar()
        SolicitudesRepo.limpiar()
        NotificacionesVet.limpiar()
        AdminRepo.limpiar()
        Imagenes.limpiarCache()
    }
}
