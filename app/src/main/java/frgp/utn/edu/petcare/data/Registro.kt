package frgp.utn.edu.petcare.data

import frgp.utn.edu.petcare.DatosRegistroDueno
import frgp.utn.edu.petcare.DatosRegistroVeterinario
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.MascotaRegistro
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
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
            put("dias_atencion", buildJsonArray { d.dias.forEach { add(it) } })
            put("hora_apertura", d.apertura)
            put("hora_cierre", d.cierre)
        }
        val resultado = crear(d.email, d.password, datos)
        FotosPendientes.guardar(d.email, d.fotoPath, emptyList())
        // Un veterinario nuevo queda en revisión y todavía no puede subir fotos: se suben cuando lo aprueben
        return resultado
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
