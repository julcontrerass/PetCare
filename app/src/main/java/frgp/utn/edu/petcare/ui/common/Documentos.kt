package frgp.utn.edu.petcare.ui.common

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.graphics.Typeface
import androidx.core.content.FileProvider
import frgp.utn.edu.petcare.data.repositorio.Paciente
import frgp.utn.edu.petcare.data.repositorio.RegistroSalud
import frgp.utn.edu.petcare.model.Prescripcion
import frgp.utn.edu.petcare.util.Fechas
import java.io.File
import java.time.LocalDate

/**
 * Documentos en PDF que arma el veterinario con su matrícula: la receta de una consulta y los certificados de
 * vacunación y de salud. Se guardan en la caché de la app y se comparten con cualquier otra aplicación.
 *
 * Primero se arma el contenido ([Plano]) y después se dibuja en la hoja: así lo que se imprime se puede probar
 * sin generar el archivo.
 */
object Documentos {

    /** Quién firma: sale del perfil del veterinario. */
    class Profesional(
        val nombre: String, val matricula: String, val clinica: String = "", val direccion: String = "",
        val telefono: String = ""
    )

    /** El animal y su propietario tal como se imprimen. */
    class DatosPaciente(
        val nombre: String, val especie: String, val raza: String = "", val sexo: String = "",
        val edad: String = "", val peso: String = "", val microchip: String = "", val propietario: String = ""
    )

    // ---------- Contenido ----------

    /** Un elemento del documento, en el orden en que se imprime. */
    sealed interface Bloque {
        class Encabezado(val profesional: Profesional) : Bloque
        class Titulo(val texto: String) : Bloque
        class Subtitulo(val texto: String) : Bloque
        class Texto(val texto: String, val negrita: Boolean = false, val gris: Boolean = false, val sangria: Float = 0f) : Bloque
        class Paciente(val datos: DatosPaciente, val fecha: LocalDate) : Bloque
        class Espacio(val puntos: Float) : Bloque
        class Firma(val profesional: Profesional) : Bloque
    }

    class Plano(val tipo: String, val paciente: DatosPaciente, val fecha: LocalDate, val bloques: List<Bloque>) {
        /** Todo lo que lleva escrito el documento, una línea por elemento. */
        fun texto(): String = bloques.flatMap { b ->
            when (b) {
                is Bloque.Encabezado -> listOf(
                    b.profesional.clinica.ifBlank { "PetCare" },
                    "${b.profesional.nombre} · Matrícula ${b.profesional.matricula}"
                )
                is Bloque.Titulo -> listOf(b.texto)
                is Bloque.Subtitulo -> listOf(b.texto)
                is Bloque.Texto -> listOf(b.texto)
                is Bloque.Paciente -> listOf(
                    "Fecha: ${Fechas.larga(b.fecha)}", b.datos.nombre,
                    listOf(b.datos.especie, b.datos.raza, b.datos.sexo, b.datos.edad, b.datos.peso)
                        .filter { it.isNotBlank() }.joinToString(" · "),
                    "Propietario: ${b.datos.propietario}"
                )
                is Bloque.Firma -> listOf(b.profesional.nombre, "Matrícula ${b.profesional.matricula}")
                is Bloque.Espacio -> emptyList()
            }
        }.joinToString("\n")
    }

    private class Constructor {
        val bloques = mutableListOf<Bloque>()
        fun encabezado(p: Profesional) = bloques.add(Bloque.Encabezado(p))
        fun titulo(t: String) = bloques.add(Bloque.Titulo(t))
        fun subtitulo(t: String) = bloques.add(Bloque.Subtitulo(t))
        fun texto(t: String, negrita: Boolean = false, gris: Boolean = false, sangria: Float = 0f) =
            bloques.add(Bloque.Texto(t, negrita, gris, sangria))
        fun paciente(d: DatosPaciente, f: LocalDate) = bloques.add(Bloque.Paciente(d, f))
        fun espacio(p: Float) = bloques.add(Bloque.Espacio(p))
        fun firma(p: Profesional) = bloques.add(Bloque.Firma(p))
    }

    private fun plano(tipo: String, paciente: DatosPaciente, fecha: LocalDate, armar: (Constructor) -> Unit): Plano {
        val c = Constructor()
        armar(c)
        return Plano(tipo, paciente, fecha, c.bloques)
    }

    fun planoDeReceta(
        profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate, medicamentos: List<Prescripcion>,
        indicaciones: String = ""
    ): Plano = plano("receta", paciente, fecha) { d ->
        d.encabezado(profesional)
        d.titulo("RECETA VETERINARIA")
        d.paciente(paciente, fecha)
        d.subtitulo("Indicaciones")
        if (medicamentos.isEmpty()) d.texto("Sin medicamentos indicados.")
        medicamentos.forEachIndexed { i, m ->
            d.texto("${i + 1}. ${m.medicamento}", negrita = true)
            if (m.posologia.isNotBlank()) d.texto(m.posologia, sangria = 18f)
            if (m.indicaciones.isNotBlank()) d.texto(m.indicaciones, sangria = 18f, gris = true)
            d.espacio(6f)
        }
        if (indicaciones.isNotBlank()) {
            d.espacio(4f)
            d.subtitulo("Recomendaciones")
            d.texto(indicaciones)
        }
        d.firma(profesional)
    }

    fun planoDeCertificadoVacunacion(
        profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate, vacunas: List<RegistroSalud>
    ): Plano = plano("certificado-vacunacion", paciente, fecha) { d ->
        d.encabezado(profesional)
        d.titulo("CERTIFICADO DE VACUNACIÓN")
        d.paciente(paciente, fecha)
        d.texto(
            "Quien suscribe, ${profesional.nombre}, Médico/a Veterinario/a, matrícula ${profesional.matricula}, " +
                "certifica que el animal arriba identificado tiene registradas las siguientes vacunas:"
        )
        d.espacio(8f)
        if (vacunas.isEmpty()) d.texto("No hay vacunas registradas.", gris = true)
        vacunas.sortedBy { it.fecha }.forEach { v ->
            d.texto("${v.titulo} — ${v.fecha}", negrita = true)
            val detalle = listOfNotNull(
                v.marca?.let { "Producto: $it" },
                v.lote?.let { "Lote: $it" },
                v.loteVencimiento?.let { "Vencimiento del lote: ${Fechas.corta(it)}" },
                v.proximaDosis?.let { "Próxima dosis: ${Fechas.corta(it)}" }
            ).joinToString("  ·  ")
            if (detalle.isNotBlank()) d.texto(detalle, sangria = 18f, gris = true)
            d.espacio(6f)
        }
        d.espacio(4f)
        d.texto(
            "Para traslados oficiales, verificá los requisitos vigentes del SENASA y de la empresa de transporte.",
            gris = true
        )
        d.firma(profesional)
    }

    fun planoDeCertificadoSalud(
        profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate, observaciones: String = ""
    ): Plano = plano("certificado-salud", paciente, fecha) { d ->
        d.encabezado(profesional)
        d.titulo("CERTIFICADO DE SALUD")
        d.paciente(paciente, fecha)
        d.texto(
            "Quien suscribe, ${profesional.nombre}, Médico/a Veterinario/a, matrícula ${profesional.matricula}, " +
                "certifica que el animal arriba identificado fue examinado clínicamente en la fecha " +
                "${Fechas.larga(fecha)} y se encuentra en buen estado de salud aparente, sin signos clínicos de " +
                "enfermedades infectocontagiosas, apto para ser trasladado."
        )
        d.espacio(8f)
        if (observaciones.isNotBlank()) {
            d.subtitulo("Observaciones")
            d.texto(observaciones)
            d.espacio(8f)
        }
        d.texto("Este certificado tiene una validez de 10 días desde su emisión.", gris = true)
        d.firma(profesional)
    }

    // ---------- Archivos ----------

    fun receta(
        contexto: Context, profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate,
        medicamentos: List<Prescripcion>, indicaciones: String = ""
    ): File = guardar(contexto, planoDeReceta(profesional, paciente, fecha, medicamentos, indicaciones))

    fun certificadoVacunacion(
        contexto: Context, profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate,
        vacunas: List<RegistroSalud>
    ): File = guardar(contexto, planoDeCertificadoVacunacion(profesional, paciente, fecha, vacunas))

    fun certificadoSalud(
        contexto: Context, profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate,
        observaciones: String = ""
    ): File = guardar(contexto, planoDeCertificadoSalud(profesional, paciente, fecha, observaciones))

    /** Nombre del archivo: tipo, paciente y fecha, por ejemplo `receta-rex-2026-10-12.pdf`. */
    fun nombreDeArchivo(plano: Plano): String {
        val paciente = plano.paciente.nombre.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').ifEmpty { "mascota" }
        return "${plano.tipo}-$paciente-${plano.fecha}.pdf"
    }

    private fun guardar(contexto: Context, plano: Plano): File {
        val documento = PdfDocument()
        val hoja = Hoja(documento)
        plano.bloques.forEach { hoja.dibujar(it) }
        hoja.terminar()
        val carpeta = File(contexto.cacheDir, "documentos").apply { mkdirs() }
        val archivo = File(carpeta, nombreDeArchivo(plano))
        archivo.outputStream().use { documento.writeTo(it) }
        documento.close()
        return archivo
    }

    /** Abre el selector del teléfono para mandar o guardar el PDF. */
    fun compartir(contexto: Context, archivo: File, titulo: String) {
        val uri = FileProvider.getUriForFile(contexto, "${contexto.packageName}.fileprovider", archivo)
        val enviar = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, titulo)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        runCatching {
            contexto.startActivity(Intent.createChooser(enviar, titulo).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    // ---------- Dibujo ----------

    /** Escribe de arriba hacia abajo en hojas A4 y pasa a una nueva cuando se llena. */
    private class Hoja(private val documento: PdfDocument) {

        private val ancho = 595
        private val alto = 842
        private val margen = 44f
        private var numero = 0
        private var pagina: PdfDocument.Page? = null
        private var y = margen

        private val normal = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 11.5f; color = Color.rgb(30, 41, 59) }
        private val grisPaint = Paint(normal).apply { color = Color.rgb(100, 116, 139); textSize = 10.5f }
        private val negritaPaint = Paint(normal).apply { typeface = Typeface.DEFAULT_BOLD }
        private val subtituloPaint = Paint(normal).apply {
            typeface = Typeface.DEFAULT_BOLD; textSize = 13f; color = Color.rgb(13, 148, 136)
        }
        private val tituloPaint = Paint(normal).apply {
            typeface = Typeface.DEFAULT_BOLD; textSize = 19f; color = Color.rgb(15, 23, 42)
        }
        private val regla = Paint().apply { color = Color.rgb(203, 213, 225); strokeWidth = 1f }

        private val anchoUtil get() = ancho - margen * 2

        init {
            nuevaPagina()
        }

        private fun nuevaPagina() {
            pagina?.let { documento.finishPage(it) }
            numero++
            pagina = documento.startPage(PdfDocument.PageInfo.Builder(ancho, alto, numero).create())
            y = margen
        }

        fun terminar() {
            pagina?.let { documento.finishPage(it) }
            pagina = null
        }

        private fun asegurar(alturaNecesaria: Float) {
            if (y + alturaNecesaria > alto - margen) nuevaPagina()
        }

        private fun lineas(texto: String, paint: Paint, anchoMaximo: Float): List<String> {
            val resultado = mutableListOf<String>()
            texto.split('\n').forEach { parrafo ->
                var actual = ""
                parrafo.split(' ').forEach { palabra ->
                    val prueba = if (actual.isEmpty()) palabra else "$actual $palabra"
                    if (paint.measureText(prueba) <= anchoMaximo || actual.isEmpty()) actual = prueba
                    else {
                        resultado.add(actual)
                        actual = palabra
                    }
                }
                resultado.add(actual)
            }
            return resultado
        }

        private fun texto(contenido: String, paint: Paint, sangria: Float = 0f) {
            val alturaLinea = paint.textSize * 1.45f
            lineas(contenido, paint, anchoUtil - sangria).forEach { linea ->
                asegurar(alturaLinea)
                y += alturaLinea
                pagina!!.canvas.drawText(linea, margen + sangria, y, paint)
            }
        }

        private fun separador() {
            y += 6f
            pagina!!.canvas.drawLine(margen, y, ancho - margen, y, regla)
            y += 8f
        }

        fun dibujar(bloque: Bloque) {
            when (bloque) {
                is Bloque.Encabezado -> {
                    val p = bloque.profesional
                    asegurar(70f)
                    y += 20f
                    pagina!!.canvas.drawText(p.clinica.ifBlank { "PetCare" }, margen, y, tituloPaint)
                    y += 2f
                    texto("${p.nombre} · Matrícula ${p.matricula}", normal)
                    val contacto = listOf(p.direccion, p.telefono).filter { it.isNotBlank() }.joinToString(" · ")
                    if (contacto.isNotBlank()) texto(contacto, grisPaint)
                    separador()
                }
                is Bloque.Titulo -> {
                    y += 14f
                    asegurar(30f)
                    y += 24f
                    pagina!!.canvas.drawText(bloque.texto, margen, y, tituloPaint)
                    y += 8f
                }
                is Bloque.Subtitulo -> {
                    y += 6f
                    asegurar(24f)
                    y += 18f
                    pagina!!.canvas.drawText(bloque.texto, margen, y, subtituloPaint)
                    y += 4f
                }
                is Bloque.Texto -> texto(
                    bloque.texto,
                    when {
                        bloque.negrita -> negritaPaint
                        bloque.gris -> grisPaint
                        else -> normal
                    },
                    bloque.sangria
                )
                is Bloque.Paciente -> {
                    val p = bloque.datos
                    texto("Fecha: ${Fechas.larga(bloque.fecha)}", grisPaint)
                    y += 4f
                    dibujar(Bloque.Subtitulo("Paciente"))
                    texto(p.nombre, negritaPaint)
                    val datos = listOf(p.especie, p.raza, p.sexo, p.edad, p.peso).filter { it.isNotBlank() }.joinToString(" · ")
                    if (datos.isNotBlank()) texto(datos, normal)
                    if (p.microchip.isNotBlank()) texto("Microchip: ${p.microchip}", grisPaint)
                    if (p.propietario.isNotBlank()) texto("Propietario: ${p.propietario}", normal)
                    y += 8f
                    separador()
                }
                is Bloque.Espacio -> y += bloque.puntos
                is Bloque.Firma -> {
                    val p = bloque.profesional
                    asegurar(110f)
                    y += 46f
                    val x1 = ancho - margen - 220f
                    pagina!!.canvas.drawLine(x1, y, ancho - margen, y, regla)
                    y += 4f
                    y += 14f
                    pagina!!.canvas.drawText(p.nombre, x1, y, negritaPaint)
                    y += 14f
                    pagina!!.canvas.drawText("Matrícula ${p.matricula}", x1, y, grisPaint)
                    y += 18f
                    y += 12f
                    pagina!!.canvas.drawText("Emitido con PetCare", margen, y, grisPaint)
                }
            }
        }
    }
}
