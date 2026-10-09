package frgp.utn.edu.petcare

import android.app.Application
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.data.Servicios

class PetCareApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Servicios.iniciar(this)
        Imagenes.iniciar(this)
        Avisos.iniciar(this)
    }
}
