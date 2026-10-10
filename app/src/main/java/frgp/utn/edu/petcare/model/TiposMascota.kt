package frgp.utn.edu.petcare.model

import androidx.annotation.DrawableRes
import frgp.utn.edu.petcare.R

/** Los tipos de animal que se pueden cargar; es la lista única de la app del dueño y del veterinario. */
object TiposMascota {

    const val PERRO = "Perro"
    const val GATO = "Gato"
    const val AVE = "Ave"
    const val REPTIL = "Reptil"
    const val PEZ = "Pez"
    const val ROEDOR = "Roedor"
    const val OTRO = "Otro"

    /** Los tipos con nombre propio, en el orden en que se muestran. */
    val PRINCIPALES = listOf(PERRO, GATO, AVE, REPTIL, PEZ, ROEDOR)

    /** Todos los tipos que se pueden elegir; "Otro" sirve para cualquier animal que no esté en la lista. */
    val TODOS = PRINCIPALES + OTRO

    /** "Perro" pasa a "Perros", "Pez" a "Peces", y así. */
    fun plural(tipo: String): String = when (tipo) {
        PERRO -> "Perros"
        GATO -> "Gatos"
        AVE -> "Aves"
        REPTIL -> "Reptiles"
        PEZ -> "Peces"
        ROEDOR -> "Roedores"
        else -> "Otros"
    }

    /** True si el tipo tiene nombre propio; si no, se cuenta como "Otro". */
    fun esConocido(tipo: String) = PRINCIPALES.any { it.equals(tipo, ignoreCase = true) }

    @DrawableRes
    fun icono(tipo: String?): Int = when (tipo) {
        PERRO -> R.drawable.ic_dog
        GATO -> R.drawable.ic_esp_felina
        AVE -> R.drawable.ic_esp_exoticos
        REPTIL -> R.drawable.ic_tipo_reptil
        PEZ -> R.drawable.ic_tipo_pez
        ROEDOR -> R.drawable.ic_tipo_roedor
        else -> R.drawable.ic_dog
    }
}
