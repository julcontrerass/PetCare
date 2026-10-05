package frgp.utn.edu.petcare

import android.app.DatePickerDialog
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import com.google.android.material.tabs.TabLayout
import java.util.Calendar
import java.util.Locale

class DetalleDeMascotaActivity : AppCompatActivity() {

    private lateinit var imageView3: ImageView
    private lateinit var textView9: TextView
    private lateinit var textView10: TextView
    private lateinit var textView11: TextView
    private lateinit var editTextText: TextView
    private lateinit var txtMicrochip: TextView
    private lateinit var editTextText2: TextView
    private lateinit var editTextText3: TextView
    private lateinit var tvPetStatus: TextView

    private val pickImageLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            imageView3.setImageURI(it)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.detalle_de_mascota)

        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        val tabLayout = findViewById<TabLayout>(R.id.tabLayout)
        tabLayout?.getTabAt(0)?.select()
        tabLayout?.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                when (tab?.position) {
                    1 -> {
                        finish()
                    }
                    2 -> {
                        finish()
                    }
                }
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        imageView3 = findViewById(R.id.imageView3)
        textView9 = findViewById(R.id.textView9)
        textView10 = findViewById(R.id.textView10)
        textView11 = findViewById(R.id.textView11)
        editTextText = findViewById(R.id.editTextText)
        txtMicrochip = findViewById(R.id.txtMicrochip)
        editTextText2 = findViewById(R.id.editTextText2)
        editTextText3 = findViewById(R.id.editTextText3)
        tvPetStatus = findViewById(R.id.tvPetStatus)

        val btnCameraOverlay = findViewById<View>(R.id.btnCameraOverlay)
        val petImageCard = findViewById<View>(R.id.petImageCard)

        val openImagePicker: (View) -> Unit = {
            pickImageLauncher.launch("image/*")
        }

        btnCameraOverlay?.setOnClickListener(openImagePicker)
        imageView3.setOnClickListener(openImagePicker)
        petImageCard?.setOnClickListener(openImagePicker)

        val btnEditarInfo = findViewById<Button>(R.id.btnEditarInfo)
        btnEditarInfo?.setOnClickListener {
            showEditDialog()
        }

        val btnDarDeBaja = findViewById<View>(R.id.btnDarDeBaja)
        btnDarDeBaja?.setOnClickListener {
            showDarDeBajaDialog()
        }

        val btnMore = findViewById<View>(R.id.btnMore)
        btnMore?.setOnClickListener {
            showDarDeBajaDialog()
        }
    }

    private fun showDarDeBajaDialog() {
        val petName = if (::textView9.isInitialized) textView9.text.toString().trim() else "Mascota"

        val dialog = AlertDialog.Builder(this)
            .setTitle(getString(R.string.confirmar_baja_title, petName))
            .setMessage(getString(R.string.confirmar_baja_msg))
            .setPositiveButton(R.string.btn_confirmar_baja) { _, _ ->
                Toast.makeText(this, R.string.mascota_dada_de_baja_msg, Toast.LENGTH_SHORT).show()
                finish()
            }
            .setNegativeButton(R.string.btn_cancelar, null)
            .create()

        dialog.show()
        dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.setTextColor(getColor(R.color.danger_red))
    }

    private fun showDatePickerDialog(editText: EditText) {
        val calendar = Calendar.getInstance()
        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH)
        val day = calendar.get(Calendar.DAY_OF_MONTH)

        val datePickerDialog = DatePickerDialog(
            this,
            { _, selectedYear, selectedMonth, selectedDay ->
                val selectedCal = Calendar.getInstance().apply {
                    set(selectedYear, selectedMonth, selectedDay, 0, 0, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                val today = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, 23)
                    set(Calendar.MINUTE, 59)
                    set(Calendar.SECOND, 59)
                }
                if (selectedCal.after(today)) {
                    Toast.makeText(this, "No podés seleccionar una fecha de nacimiento futura", Toast.LENGTH_SHORT).show()
                    return@DatePickerDialog
                }
                val meses = arrayOf("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")
                val formattedDate = String.format(Locale.getDefault(), "%02d %s %d", selectedDay, meses[selectedMonth], selectedYear)
                val currentText = editText.text.toString()
                if (currentText.contains("-")) {
                    val sexPart = currentText.substring(currentText.indexOf("-"))
                    editText.setText("Nacido el $formattedDate $sexPart")
                } else {
                    editText.setText(formattedDate)
                }
            },
            year, month, day
        )
        datePickerDialog.datePicker.maxDate = System.currentTimeMillis()
        datePickerDialog.show()
    }

    private fun showEditDialog() {
        val context = this
        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 32)
        }

        val params = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, 16, 0, 16)
        }

        val inputNombre = EditText(context).apply {
            hint = "Nombre"
            setText(textView9.text.toString().trim())
            layoutParams = params
        }
        val inputRaza = EditText(context).apply {
            hint = "Raza"
            setText(textView10.text.toString())
            layoutParams = params
        }
        val inputNacSexo = EditText(context).apply {
            hint = "Fecha de nacimiento"
            setText(textView11.text.toString())
            layoutParams = params
            isFocusable = false
            isClickable = true
            setOnClickListener {
                showDatePickerDialog(this)
            }
        }
        val inputPeso = EditText(context).apply {
            hint = "Peso"
            setText(editTextText.text.toString())
            layoutParams = params
        }
        val inputMicrochip = EditText(context).apply {
            hint = "Microchip"
            setText(txtMicrochip.text.toString())
            layoutParams = params
        }
        val inputColor = EditText(context).apply {
            hint = "Color"
            setText(editTextText2.text.toString())
            layoutParams = params
        }
        val inputObs = EditText(context).apply {
            hint = "Observaciones"
            setText(editTextText3.text.toString())
            layoutParams = params
        }

        layout.addView(inputNombre)
        layout.addView(inputRaza)
        layout.addView(inputNacSexo)
        layout.addView(inputPeso)
        layout.addView(inputMicrochip)
        layout.addView(inputColor)
        layout.addView(inputObs)

        val scrollView = ScrollView(context).apply {
            addView(layout)
        }

        AlertDialog.Builder(context)
            .setTitle("Editar Información de Mascota")
            .setView(scrollView)
            .setPositiveButton("Guardar") { _, _ ->
                textView9.text = inputNombre.text.toString()
                textView10.text = inputRaza.text.toString()
                textView11.text = inputNacSexo.text.toString()
                editTextText.text = inputPeso.text.toString()
                txtMicrochip.text = inputMicrochip.text.toString()
                editTextText2.text = inputColor.text.toString()
                editTextText3.text = inputObs.text.toString()
                Toast.makeText(context, "Información actualizada", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
