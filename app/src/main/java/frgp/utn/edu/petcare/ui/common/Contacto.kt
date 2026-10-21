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

    /**
     * Mensaje con el que el veterinario le pasa al dueño los datos para ingresar a la cuenta que le creó.
     * [veterinario] y [clinica] son los del que lo envía; [mascotas] son los nombres de lo que va a poder ver.
     */
    fun mensajeDeAcceso(
        dueno: String, mascotas: List<String>, email: String, password: String,
        veterinario: String, clinica: String
    ): String {
        val primerNombre = dueno.trim().substringBefore(' ')
        val deQuien = veterinario.trim().ifBlank { "tu veterinario" } +
            clinica.trim().takeIf { it.isNotEmpty() }?.let { " de $it" }.orEmpty()
        val cuales = when (mascotas.size) {
            0 -> "tus mascotas"
            1 -> mascotas.first()
            else -> mascotas.dropLast(1).joinToString(", ") + " y " + mascotas.last()
        }
        return "Hola $primerNombre, soy $deQuien. Te creé tu cuenta en la app PetCare para que veas desde tu casa " +
            "la ficha de $cuales: historial, vacunas, recetas y turnos.\n\n" +
            "Para ingresar:\n" +
            "Correo: $email\n" +
            "Contraseña temporal: $password\n\n" +
            "Al entrar, la app te va a pedir que elijas tu propia contraseña."
    }

    /** Mensaje con el que el administrador le cuenta a un veterinario cómo quedó su solicitud de alta. */
    fun mensajeDeRevision(veterinario: String, aprobado: Boolean, motivo: String = ""): String {
        val primerNombre = veterinario.trim().substringBefore(' ')
        return if (aprobado) {
            "Hola $primerNombre, te escribo de PetCare. Verificamos tu matrícula y tu alta como veterinario/a fue " +
                "aprobada. Ya podés ingresar a la app con tu cuenta."
        } else {
            "Hola $primerNombre, te escribo de PetCare. Tu solicitud de alta como veterinario/a no fue aprobada" +
                motivo.trim().takeIf { it.isNotEmpty() }?.let { ". Motivo: $it" }.orEmpty() +
                ". Podés corregir tus datos y volver a solicitarla."
        }
    }

    /** Abre la aplicación de correo con el mensaje armado; null si no hay una dirección usable. */
    fun correo(email: String, asunto: String, mensaje: String): Intent? {
        if (!email.contains('@')) return null
        return Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + Uri.encode(email.trim(), "@")))
            .putExtra(Intent.EXTRA_SUBJECT, asunto)
            .putExtra(Intent.EXTRA_TEXT, mensaje)
    }

    /** Abre el selector de aplicaciones para mandar un texto (cuando no hay un número de WhatsApp usable). */
    fun compartirTexto(texto: String): Intent =
        Intent.createChooser(
            Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, texto)
            },
            "Enviar datos de acceso"
        )

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
