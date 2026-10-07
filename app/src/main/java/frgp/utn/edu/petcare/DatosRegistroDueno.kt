package frgp.utn.edu.petcare

import java.io.Serializable

/** Mascota cargada durante el registro del dueño. */
data class MascotaRegistro(
    val nombre: String,
    val tipo: String,
    val sexo: String,
    val raza: String = "",
    val nacimiento: String = "",
    val fotoPath: String? = null,
    val peso: String = "",
    val color: String = "",
    val microchip: String = "",
    val observaciones: String = ""
) : Serializable

/** Todo lo que se pide al dueño al crear su cuenta. */
data class DatosRegistroDueno(
    val nombre: String,
    val dni: String,
    val telefono: String,
    val direccion: String,
    val email: String,
    val password: String,
    val fotoPath: String? = null,
    val mascotas: List<MascotaRegistro> = emptyList()
) : Serializable
