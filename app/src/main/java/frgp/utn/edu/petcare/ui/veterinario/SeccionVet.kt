package frgp.utn.edu.petcare.ui.veterinario

import android.view.View

/**
 * Una sección de la app del veterinario (inicio, pacientes, agenda o perfil). Se dibuja dentro del contenedor de
 * [HomeVeterinarioActivity], que deja fija la barra inferior y solo cambia el contenido.
 */
abstract class SeccionVet(protected val host: HomeVeterinarioActivity) {

    /** Diseño de la sección, sin barra inferior. */
    abstract val layout: Int

    /** Solapa de la barra inferior que le corresponde. */
    abstract val navId: Int

    /** Engancha los botones y listas de la sección recién dibujada. */
    abstract fun configurar()

    /** Vuelve a pintar la sección con los datos actuales. */
    abstract fun refrescar()

    protected fun <T : View> findViewById(id: Int): T = host.findViewById(id)
}
