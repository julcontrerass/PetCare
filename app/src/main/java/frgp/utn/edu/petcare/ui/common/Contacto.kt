package frgp.utn.edu.petcare.ui.common

import android.content.Context
import android.content.Intent
import android.net.Uri

/** Atajos para hablar con el dueño de un paciente desde la app. */
object Contacto {

    /**
     * Número en el formato de WhatsApp para Argentina: código de país, 9 de celular y el número sin 0 ni 15.
     * Devuelve null si no hay un número usable.
     */
    fun numeroWhatsApp(telefono: String): String? {
        var digitos = telefono.filter { it.isDigit() }
        if (digitos.length < 8) return null
        if (digitos.startsWith("00")) digitos = digitos.drop(2)
        if (digitos.startsWith("54")) {
            // Ya trae el país: si falta el 9 de celular se agrega
            return if (digitos.getOrNull(2) == '9') digitos else "549" + digitos.drop(2)
        }
        digitos = digitos.trimStart('0')
        // "11 15 1234 5678" o "011 15 ...": el 15 de celular no va con el 9 del código de país
        Regex("^(\\d{2,4})15(\\d{6,8})$").matchEntire(digitos)?.let { digitos = it.groupValues[1] + it.groupValues[2] }
        return "549$digitos"
    }

    /** Abre WhatsApp con el mensaje armado; null si el número no sirve. */
    fun whatsApp(telefono: String, mensaje: String): Intent? {
        val numero = numeroWhatsApp(telefono) ?: return null
        val uri = Uri.parse("https://wa.me/$numero?text=" + Uri.encode(mensaje))
        return Intent(Intent.ACTION_VIEW, uri)
    }

    fun llamar(telefono: String): Intent? {
        val numero = telefono.filter { it.isDigit() || it == '+' }
        if (numero.length < 6) return null
        return Intent(Intent.ACTION_DIAL, Uri.parse("tel:$numero"))
    }

    fun abrir(contexto: Context, intent: Intent?, sinDatos: String) {
        if (intent == null) {
            Avisos.aviso(contexto, sinDatos)
            return
        }
        try {
            contexto.startActivity(intent)
        } catch (e: Exception) {
            Avisos.aviso(contexto, "No hay una aplicación disponible para esta acción")
        }
    }
}
