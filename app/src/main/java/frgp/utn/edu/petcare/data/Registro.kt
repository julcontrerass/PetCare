package frgp.utn.edu.petcare.data

import frgp.utn.edu.petcare.util.Fechas
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.put

/**
 * Alta de cuentas nuevas. El servidor arma el perfil (y las mascotas del dueño) a partir de los datos que van
 * con el registro; las fotos se suben después, cuando ya hay una sesión abierta.
 */
object Registro {

    const val VERSION_TERMINOS = "1.0"

    /** [sesionIniciada] es falso cuando el proyecto pide confirmar el correo antes de dejar entrar. */
    class Resultado(val sesionIniciada: Boolean)

    class CorreoYaRegistrado : Exception("Ese correo ya está registrado")

    suspend fun dueno(d: DatosRegistroDueno): Resultado {
        val datos = buildJsonObject {
            put("rol", "dueno")
            put("nombre", d.nombre)
            put("dni", d.dni)
            put("telefono", d.telefono)
            put("direccion", d.direccion)
            put("terminos_version", VERSION_TERMINOS)
            put("mascotas", buildJsonArray { d.mascotas.forEach { add(datosDeMascota(it)) } })
        }
        val resultado = crear(d.email, d.password, datos)
        FotosPendientes.guardar(d.email, d.fotoPath, d.mascotas.mapNotNull { m -> m.fotoPath?.let { m.nombre to it } })
        subirSiHaySesion(d.email, resultado)
        return resultado
    }

    suspend fun veterinario(d: DatosRegistroVeterinario): Resultado {
        if (!Servicios.fuente.matriculaDisponible(d.matricula)) {
            throw IllegalStateException("Esa matrícula ya está registrada con otra cuenta")
        }
        val datos = buildJsonObject {
            put("rol", "veterinario")
            put("nombre", d.nombre)
            put("dni", d.dni)
            put("telefono", d.telefono)
            put("matricula", d.matricula)
            put("clinica", d.clinica)
            put("direccion_clinica", d.direccionClinica)
            put("terminos_version", VERSION_TERMINOS)
            put("especialidades", buildJsonArray { d.especialidades.forEach { add(it) } })
            put("tipos_animales", buildJsonArray { d.tiposAnimales.forEach { add(it) } })
            put("dias_atencion", buildJsonArray { d.dias.forEach { add(it) } })
            put("hora_apertura", d.apertura)
            put("hora_cierre", d.cierre)
            put("sedes", datosDeSedes(d.sedesExtra))
        }
        val resultado = crear(d.email, d.password, datos)
        FotosPendientes.guardar(d.email, d.fotoPath, emptyList())
        d.credencialPath?.let { FotosPendientes.guardarCredencial(d.email, it) }
        // El carnet se sube ya (si hay sesión) porque el administrador lo necesita para revisar la cuenta; las demás
        // fotos esperan a que lo aprueben
        if (resultado.sesionIniciada) {
            Sesion.usuarioIdActual()?.let { runCatching { FotosPendientes.subirCredencial(d.email, it) } }
        }
        return resultado
    }

    /** Los lugares extra como los espera el servidor (`sedes` del registro y `p_sedes` del pedido de alta). */
    fun datosDeSedes(sedes: List<frgp.utn.edu.petcare.model.SedeVet>) = buildJsonArray {
        sedes.forEach { s ->
            add(buildJsonObject {
                put("nombre", s.nombre)
                put("direccion", s.direccion)
                put("dias_atencion", buildJsonArray { s.dias.sorted().forEach { add(it) } })
                put("hora_apertura", s.apertura)
                put("hora_cierre", s.cierre)
            })
        }
    }

    /** Si el registro dejó la sesión abierta, sube las fotos ya; si no, quedan para el primer ingreso. */
    private suspend fun subirSiHaySesion(email: String, resultado: Resultado) {
        if (!resultado.sesionIniciada) return
        val usuario = Sesion.usuarioIdActual() ?: return
        runCatching { FotosPendientes.subir(email, usuario) }
    }

    private suspend fun crear(email: String, password: String, datos: JsonObject): Resultado {
        val r = Servicios.fuente.registrar(email, password, datos)
        if (r.correoYaRegistrado) throw CorreoYaRegistrado()
        return Resultado(r.sesionIniciada)
    }

    private fun datosDeMascota(m: MascotaRegistro) = buildJsonObject {
        put("nombre", m.nombre)
        put("tipo", m.tipo)
        put("sexo", m.sexo)
        put("raza", m.raza)
        put("nacimiento", Fechas.parsear(m.nacimiento)?.toString().orEmpty())
        put("peso", m.peso)
        put("color", m.color)
        put("microchip", m.microchip)
        put("observaciones", m.observaciones)
    }
}
