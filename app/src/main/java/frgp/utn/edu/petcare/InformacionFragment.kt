package frgp.utn.edu.petcare

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.cardview.widget.CardView
import androidx.fragment.app.Fragment
import com.google.android.material.dialog.MaterialAlertDialogBuilder

class InformacionFragment : Fragment() {

    private lateinit var ivPetPhoto: ImageView
    private lateinit var tvPetName: TextView
    private lateinit var tvPetBreed: TextView
    private lateinit var tvPetBirth: TextView
    private lateinit var tvPetWeight: TextView
    private lateinit var tvPetMicrochip: TextView
    private lateinit var tvPetColor: TextView
    private lateinit var tvPetObservations: TextView

    private val pickImageLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            ivPetPhoto.setImageURI(it)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_informacion, container, false)

        // Initialize views
        ivPetPhoto = view.findViewById(R.id.ivPetPhoto)
        tvPetName = view.findViewById(R.id.tvPetNameHeader)
        tvPetBreed = view.findViewById(R.id.tvPetBreedHeader)
        tvPetBirth = view.findViewById(R.id.tvPetBirthHeader)
        tvPetWeight = view.findViewById(R.id.tvPetWeight)
        tvPetMicrochip = view.findViewById(R.id.tvPetMicrochip)
        tvPetColor = view.findViewById(R.id.tvPetColor)
        tvPetObservations = view.findViewById(R.id.tvPetObservations)

        val btnChangePhoto = view.findViewById<CardView>(R.id.btnChangePhoto)
        val btnEditHeader = view.findViewById<ImageView>(R.id.btnEditHeader)
        val btnEditInfo = view.findViewById<Button>(R.id.btnEditInfo)

        btnChangePhoto.setOnClickListener {
            pickImageLauncher.launch("image/*")
        }

        btnEditHeader.setOnClickListener {
            showEditHeaderDialog()
        }

        btnEditInfo.setOnClickListener {
            showEditInfoDialog()
        }

        return view
    }

    private fun showEditHeaderDialog() {
        val context = requireContext()
        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(50, 40, 50, 10)
        }

        val etName = EditText(context).apply { 
            hint = "Nombre"
            setText(tvPetName.text)
        }
        val etBreed = EditText(context).apply {
            hint = "Raza"
            setText(tvPetBreed.text)
        }
        val etBirth = EditText(context).apply {
            hint = "Fecha y Sexo"
            setText(tvPetBirth.text)
        }

        layout.addView(etName)
        layout.addView(etBreed)
        layout.addView(etBirth)

        MaterialAlertDialogBuilder(context)
            .setTitle("Editar Perfil")
            .setView(layout)
            .setPositiveButton("Guardar") { _, _ ->
                tvPetName.text = etName.text.toString()
                tvPetBreed.text = etBreed.text.toString()
                tvPetBirth.text = etBirth.text.toString()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun showEditInfoDialog() {
        val context = requireContext()
        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(50, 40, 50, 10)
        }

        val etWeight = EditText(context).apply { 
            hint = "Peso"
            setText(tvPetWeight.text)
        }
        val etMicrochip = EditText(context).apply {
            hint = "Microchip"
            setText(tvPetMicrochip.text)
        }
        val etColor = EditText(context).apply {
            hint = "Color"
            setText(tvPetColor.text)
        }
        val etObs = EditText(context).apply {
            hint = "Observaciones"
            setText(tvPetObservations.text)
        }

        layout.addView(etWeight)
        layout.addView(etMicrochip)
        layout.addView(etColor)
        layout.addView(etObs)

        MaterialAlertDialogBuilder(context)
            .setTitle("Editar Detalles")
            .setView(layout)
            .setPositiveButton("Guardar") { _, _ ->
                tvPetWeight.text = etWeight.text.toString()
                tvPetMicrochip.text = etMicrochip.text.toString()
                tvPetColor.text = etColor.text.toString()
                tvPetObservations.text = etObs.text.toString()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}