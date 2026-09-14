package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity

class DetalleDeMascotaActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.detalle_de_mascota)

        // Referencias a los 3 contenedores
        val layoutInformacion = findViewById<LinearLayout>(R.id.layout_informacion)
        val layoutHistorial = findViewById<LinearLayout>(R.id.layout_historial)
        val layoutRecordatorios = findViewById<LinearLayout>(R.id.layout_recordatorios)

        // Referencias a los 3 botones
        val btnInformacion = findViewById<Button>(R.id.button7)
        val btnHistorial = findViewById<Button>(R.id.button8)
        val btnRecordatorios = findViewById<Button>(R.id.button9)


        val layoutProximos = findViewById<LinearLayout>(R.id.layout_recordatorios_proximos)
        val layoutCompletados = findViewById<LinearLayout>(R.id.layout_recordatorios_completados)

        val btnProximos = findViewById<Button>(R.id.btn_proximos)
        val btnCompletados = findViewById<Button>(R.id.btn_completados)

        btnInformacion.setOnClickListener {
            layoutInformacion.visibility = View.VISIBLE
            layoutHistorial.visibility = View.GONE
            layoutRecordatorios.visibility = View.GONE
        }

        btnHistorial.setOnClickListener {
            layoutInformacion.visibility = View.GONE
            layoutHistorial.visibility = View.VISIBLE
            layoutRecordatorios.visibility = View.GONE
        }

        btnRecordatorios.setOnClickListener {
            layoutInformacion.visibility = View.GONE
            layoutHistorial.visibility = View.GONE
            layoutRecordatorios.visibility = View.VISIBLE
        }

        btnProximos.setOnClickListener {
            layoutProximos.visibility = View.VISIBLE
            layoutCompletados.visibility = View.GONE
        }

        btnCompletados.setOnClickListener {
            layoutProximos.visibility = View.GONE
            layoutCompletados.visibility = View.VISIBLE
        }
    }
}