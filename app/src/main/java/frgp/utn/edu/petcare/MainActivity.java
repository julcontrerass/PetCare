package frgp.utn.edu.petcare;

import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.cardview.widget.CardView;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.imageview.ShapeableImageView;
import com.google.android.material.shape.RelativeCornerSize;
import com.google.android.material.tabs.TabLayout;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        seedEventosDemoSiNecesario();
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        View mainRoot = findViewById(R.id.main);
        ViewCompat.setOnApplyWindowInsetsListener(mainRoot, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(mainRoot);

        Button btnIniciarSesion = findViewById(R.id.button);
        btnIniciarSesion.setOnClickListener(v -> {
            setContentView(R.layout.iniciar_sesion);
            View loginRoot = findViewById(R.id.loginRoot);
            ViewCompat.setOnApplyWindowInsetsListener(loginRoot, (v2, insets) -> {
                Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                v2.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
                return insets;
            });
            ViewCompat.requestApplyInsets(loginRoot);

            // Boton de ingreso
            Button btnIngresar = findViewById(R.id.btnLogin);
            if (btnIngresar != null) {
                btnIngresar.setOnClickListener(v2 -> {
                    showHomeView();
                });
            }
        });
    }

    private boolean isAppBaseSet = false;
    private int currentTabPosition = 0;

    private void switchViewWithAnimation(int newPosition, Runnable inflationRunnable) {
        ViewGroup container = findViewById(R.id.content_container);
        if (container == null) {
            inflationRunnable.run();
            currentTabPosition = newPosition;
            return;
        }

        float startX = (newPosition > currentTabPosition) ? container.getWidth() : -container.getWidth();

        inflationRunnable.run();

        container.setTranslationX(startX);
        container.setAlpha(0f);

        container.animate()
                .translationX(0f)
                .alpha(1f)
                .setDuration(250)
                .start();

        currentTabPosition = newPosition;
    }

    private void showHomeView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.home_dueno, container, true);

        highlightNavItem(R.id.nav_home);
        
        View ivHomeProfile = findViewById(R.id.iv_home_profile);
        if (ivHomeProfile != null) {
            ivHomeProfile.setOnClickListener(v -> {
                showProfileView();
            });
        }

        View petMilo = findViewById(R.id.pet_milo);
        if (petMilo != null) {
            petMilo.setOnClickListener(v -> showPetDetailView());
        }

        View btnAddPetHome = findViewById(R.id.btnAddPetHome);
        if (btnAddPetHome != null) {
            btnAddPetHome.setOnClickListener(v -> {
                bounceView(v);
                showNuevaMascotaView();
            });
        }
    }

    private void ensureAppBaseSet() {
        if (!isAppBaseSet) {
            setContentView(R.layout.app_base);
            
            View statusBarSpacer = findViewById(R.id.status_bar_spacer);
            View bottomNav = findViewById(R.id.bottom_navigation_container);
            View mainBaseLayout = findViewById(R.id.main_base_layout);

            if (statusBarSpacer != null || bottomNav != null) {
                ViewCompat.setOnApplyWindowInsetsListener(mainBaseLayout, (v, insets) -> {
                    Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());

                    if (statusBarSpacer != null) {
                        ViewGroup.LayoutParams lp = statusBarSpacer.getLayoutParams();
                        lp.height = systemBars.top;
                        statusBarSpacer.setLayoutParams(lp);
                    }

                    if (bottomNav != null) {
                        bottomNav.setPadding(0, 0, 0, systemBars.bottom);
                        ViewGroup.LayoutParams lp = bottomNav.getLayoutParams();
                        lp.height = 80 * (int) getResources().getDisplayMetrics().density + systemBars.bottom;
                        bottomNav.setLayoutParams(lp);
                    }

                    return WindowInsetsCompat.CONSUMED;
                });
                ViewCompat.requestApplyInsets(mainBaseLayout);
            }

            setupBottomNavigation();
            isAppBaseSet = true;
        }
    }

    private void showPetDetailView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.detalle_de_mascota, container, true);

        highlightNavItem(R.id.nav_mascotas);

        Toolbar toolbar = findViewById(R.id.toolbar);
        if (toolbar != null) {
            toolbar.setNavigationOnClickListener(v -> showPetsView());
        }

        TabLayout tabLayout = findViewById(R.id.tabLayout);
        if (tabLayout != null) {
            currentTabPosition = 0;
            TabLayout.Tab tab = tabLayout.getTabAt(0);
            if (tab != null) tab.select();

            tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
                @Override
                public void onTabSelected(TabLayout.Tab tab) {
                    int pos = tab.getPosition();
                    if (pos == currentTabPosition) return;
                    if (pos == 1) {
                        switchViewWithAnimation(1, () -> {
                            ViewGroup c = findViewById(R.id.content_container);
                            c.removeAllViews();
                            getLayoutInflater().inflate(R.layout.historial_clinico, c, true);
                            setupHistorialClinicoView();
                        });
                    } else if (pos == 2) {
                        switchViewWithAnimation(2, () -> {
                            ViewGroup c = findViewById(R.id.content_container);
                            c.removeAllViews();
                            getLayoutInflater().inflate(R.layout.recordatorios, c, true);
                            setupRecordatoriosView();
                        });
                    }
                }

                @Override
                public void onTabUnselected(TabLayout.Tab tab) {}

                @Override
                public void onTabReselected(TabLayout.Tab tab) {}
            });
        }

        View btnCameraOverlay = findViewById(R.id.btnCameraOverlay);
        View petImageCard = findViewById(R.id.petImageCard);
        ImageView imageView3 = findViewById(R.id.imageView3);

        View.OnClickListener openImagePicker = v -> {
            bounceView(v);
            pickFotoDetalleLauncher.launch("image/*");
        };

        if (btnCameraOverlay != null) btnCameraOverlay.setOnClickListener(openImagePicker);
        if (petImageCard != null) petImageCard.setOnClickListener(openImagePicker);
        if (imageView3 != null) imageView3.setOnClickListener(openImagePicker);

        View btnEditarInfo = findViewById(R.id.btnEditarInfo);
        if (btnEditarInfo != null) {
            btnEditarInfo.setOnClickListener(v -> {
                bounceView(v);
                showEditPetDetailDialog();
            });
        }
    }

    private final ActivityResultLauncher<String> pickFotoDetalleLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri == null) return;
                ImageView imageView3 = findViewById(R.id.imageView3);
                if (imageView3 != null) {
                    imageView3.setImageURI(uri);
                }
            });

    private void showEditPetDetailDialog() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(48, 32, 48, 32);

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 16, 0, 16);

        TextView tvName = findViewById(R.id.textView9);
        TextView tvBreed = findViewById(R.id.textView10);
        TextView tvBirthSex = findViewById(R.id.textView11);
        TextView tvWeight = findViewById(R.id.editTextText);
        TextView tvMicrochip = findViewById(R.id.txtMicrochip);
        TextView tvColor = findViewById(R.id.editTextText2);
        TextView tvObs = findViewById(R.id.editTextText3);

        EditText inputNombre = new EditText(this);
        inputNombre.setHint("Nombre");
        if (tvName != null) inputNombre.setText(tvName.getText().toString().trim());
        inputNombre.setLayoutParams(params);

        EditText inputRaza = new EditText(this);
        inputRaza.setHint("Raza");
        if (tvBreed != null) inputRaza.setText(tvBreed.getText().toString());
        inputRaza.setLayoutParams(params);

        EditText inputNacSexo = new EditText(this);
        inputNacSexo.setHint("Nacimiento y Sexo");
        if (tvBirthSex != null) inputNacSexo.setText(tvBirthSex.getText().toString());
        inputNacSexo.setLayoutParams(params);

        EditText inputPeso = new EditText(this);
        inputPeso.setHint("Peso");
        if (tvWeight != null) inputPeso.setText(tvWeight.getText().toString());
        inputPeso.setLayoutParams(params);

        EditText inputMicrochip = new EditText(this);
        inputMicrochip.setHint("Microchip");
        if (tvMicrochip != null) inputMicrochip.setText(tvMicrochip.getText().toString());
        inputMicrochip.setLayoutParams(params);

        EditText inputColor = new EditText(this);
        inputColor.setHint("Color");
        if (tvColor != null) inputColor.setText(tvColor.getText().toString());
        inputColor.setLayoutParams(params);

        EditText inputObs = new EditText(this);
        inputObs.setHint("Observaciones");
        if (tvObs != null) inputObs.setText(tvObs.getText().toString());
        inputObs.setLayoutParams(params);

        layout.addView(inputNombre);
        layout.addView(inputRaza);
        layout.addView(inputNacSexo);
        layout.addView(inputPeso);
        layout.addView(inputMicrochip);
        layout.addView(inputColor);
        layout.addView(inputObs);

        ScrollView scrollView = new ScrollView(this);
        scrollView.addView(layout);

        new AlertDialog.Builder(this)
                .setTitle("Editar Información de Mascota")
                .setView(scrollView)
                .setPositiveButton("Guardar", (dialog, which) -> {
                    if (tvName != null) tvName.setText(inputNombre.getText().toString());
                    if (tvBreed != null) tvBreed.setText(inputRaza.getText().toString());
                    if (tvBirthSex != null) tvBirthSex.setText(inputNacSexo.getText().toString());
                    if (tvWeight != null) tvWeight.setText(inputPeso.getText().toString());
                    if (tvMicrochip != null) tvMicrochip.setText(inputMicrochip.getText().toString());
                    if (tvColor != null) tvColor.setText(inputColor.getText().toString());
                    if (tvObs != null) tvObs.setText(inputObs.getText().toString());
                    Toast.makeText(this, "Información actualizada", Toast.LENGTH_SHORT).show();
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void setupHistorialClinicoView() {
        View btnBack = findViewById(R.id.toolbar);
        if (btnBack instanceof Toolbar) {
            ((Toolbar) btnBack).setNavigationOnClickListener(v -> showPetDetailView());
        }

        TabLayout tabLayout = findViewById(R.id.tabLayout);
        RecyclerView recyclerView = findViewById(R.id.recyclerViewHistorial);

        if (tabLayout != null) {
            currentTabPosition = 1;
            TabLayout.Tab tab = tabLayout.getTabAt(1);
            if (tab != null) tab.select();

            tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
                @Override
                public void onTabSelected(TabLayout.Tab tab) {
                    int pos = tab.getPosition();
                    if (pos == currentTabPosition) return;
                    if (pos == 0) {
                        switchViewWithAnimation(0, () -> {
                            ViewGroup c = findViewById(R.id.content_container);
                            c.removeAllViews();
                            getLayoutInflater().inflate(R.layout.detalle_de_mascota, c, true);
                            showPetDetailView();
                        });
                    } else if (pos == 2) {
                        switchViewWithAnimation(2, () -> {
                            ViewGroup c = findViewById(R.id.content_container);
                            c.removeAllViews();
                            getLayoutInflater().inflate(R.layout.recordatorios, c, true);
                            setupRecordatoriosView();
                        });
                    }
                }

                @Override
                public void onTabUnselected(TabLayout.Tab tab) {}

                @Override
                public void onTabReselected(TabLayout.Tab tab) {}
            });
        }

        if (recyclerView != null) {
            List<HistorialItem> items = Arrays.asList(
                    new HistorialItem("Consulta veterinaria", "10 May 2026 · Dr. Juan Pérez", R.drawable.ic_list, R.color.icon_blue_bg),
                    new HistorialItem("Vacuna múltiple", "15 Abr 2026 · Dr. Juan Pérez", R.drawable.ic_pencil, R.color.icon_green_bg),
                    new HistorialItem("Desparasitación", "01 Mar 2026 · Dr. Juan Pérez", R.drawable.ic_dog, R.color.icon_orange_bg),
                    new HistorialItem("Análisis de sangre", "10 Feb 2026 · Dr. Juan Pérez", R.drawable.ic_list, R.color.icon_purple_bg),
                    new HistorialItem("Cirugía", "15 Jul 2025 · Dr. Juan Pérez", R.drawable.ic_dog, R.color.icon_pink_bg),
                    new HistorialItem("Control general", "10 Ene 2025 · Dr. Juan Pérez", R.drawable.ic_calendar, R.color.icon_teal_bg)
            );
            recyclerView.setAdapter(new HistorialAdapter(items));
        }

        View fabAdd = findViewById(R.id.fabAdd);
        if (fabAdd != null) {
            fabAdd.setOnClickListener(v -> {
                bounceView(v);
                showNuevoEventoView(diaSeleccionado);
            });
        }

        View btnEditarEvento = findViewById(R.id.btnEditarEvento);
        if (btnEditarEvento != null) {
            btnEditarEvento.setOnClickListener(v -> {
                bounceView(v);
                Toast.makeText(this, "Editar evento", Toast.LENGTH_SHORT).show();
            });
        }
    }

    private void setupRecordatoriosView() {
        View toolbarView = findViewById(R.id.toolbar);
        if (toolbarView instanceof Toolbar) {
            ((Toolbar) toolbarView).setNavigationOnClickListener(v -> showPetDetailView());
        }

        TabLayout tabLayout = findViewById(R.id.tabLayoutRecordatorios);
        RecyclerView recyclerView = findViewById(R.id.recyclerViewRecordatorios);

        List<RecordatorioItem> proximosItems = Arrays.asList(
                new RecordatorioItem("Vacuna múltiple", "Koda", "15 May 2026", "Falta 5 días", R.drawable.ic_calendar),
                new RecordatorioItem("Control general", "Mika", "20 May 2026", "Falta 10 días", R.drawable.ic_pencil),
                new RecordatorioItem("Desparasitación", "Koda", "01 Jun 2026", "Falta 22 días", R.drawable.ic_dog)
        );

        List<RecordatorioItem> completadosItems = Arrays.asList(
                new RecordatorioItem("Antirrábica", "Koda", "02 Ago 2025", "Completado", R.drawable.ic_check_circle),
                new RecordatorioItem("Análisis general", "Koda", "10 Jul 2025", "Completado", R.drawable.ic_list)
        );

        if (recyclerView != null) {
            recyclerView.setAdapter(new RecordatoriosAdapter(proximosItems));
        }

        if (tabLayout != null) {
            currentTabPosition = 2;
            TabLayout.Tab tab = tabLayout.getTabAt(2);
            if (tab != null) tab.select();

            tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
                @Override
                public void onTabSelected(TabLayout.Tab tab) {
                    int pos = tab.getPosition();
                    if (pos == currentTabPosition) return;
                    if (pos == 0) {
                        switchViewWithAnimation(0, () -> {
                            ViewGroup c = findViewById(R.id.content_container);
                            c.removeAllViews();
                            getLayoutInflater().inflate(R.layout.detalle_de_mascota, c, true);
                            showPetDetailView();
                        });
                    } else if (pos == 1) {
                        switchViewWithAnimation(1, () -> {
                            ViewGroup c = findViewById(R.id.content_container);
                            c.removeAllViews();
                            getLayoutInflater().inflate(R.layout.historial_clinico, c, true);
                            setupHistorialClinicoView();
                        });
                    }
                }

                @Override
                public void onTabUnselected(TabLayout.Tab tab) {}

                @Override
                public void onTabReselected(TabLayout.Tab tab) {}
            });
        }

        Button btnProximos = findViewById(R.id.btn_proximos);
        Button btnCompletados = findViewById(R.id.btn_completados);

        if (btnProximos != null && btnCompletados != null) {
            btnProximos.setOnClickListener(v -> {
                bounceView(v);
                btnProximos.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.light_teal));
                btnProximos.setTextColor(ContextCompat.getColor(this, R.color.primary_teal));
                btnCompletados.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.light_gray));
                btnCompletados.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
                if (recyclerView != null) recyclerView.setAdapter(new RecordatoriosAdapter(proximosItems));
            });

            btnCompletados.setOnClickListener(v -> {
                bounceView(v);
                btnCompletados.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.light_teal));
                btnCompletados.setTextColor(ContextCompat.getColor(this, R.color.primary_teal));
                btnProximos.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.light_gray));
                btnProximos.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
                if (recyclerView != null) recyclerView.setAdapter(new RecordatoriosAdapter(completadosItems));
            });
        }

        View fabAdd = findViewById(R.id.fabAdd);
        if (fabAdd != null) {
            fabAdd.setOnClickListener(v -> {
                bounceView(v);
                showNuevoEventoView(diaSeleccionado);
            });
        }

        View btnToolbarAdd = findViewById(R.id.btnToolbarAdd);
        if (btnToolbarAdd != null) {
            btnToolbarAdd.setOnClickListener(v -> {
                bounceView(v);
                showNuevoEventoView(diaSeleccionado);
            });
        }

        View btnEditarEvento = findViewById(R.id.btnEditarEvento);
        if (btnEditarEvento != null) {
            btnEditarEvento.setOnClickListener(v -> {
                bounceView(v);
                Toast.makeText(this, "Editar evento", Toast.LENGTH_SHORT).show();
            });
        }
    }

    private void showProfileView() {
        ensureAppBaseSet();
        inicializarPerfilSiNecesario();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.mi_perfil, container, true);

        highlightNavItem(R.id.nav_mas);

        TextView tvUserName = findViewById(R.id.tvUserName);
        if (tvUserName != null) tvUserName.setText(nombreUsuario);
        TextView tvUserEmailValue = findViewById(R.id.tvUserEmailValue);
        if (tvUserEmailValue != null) tvUserEmailValue.setText(emailUsuario);
        TextView tvUserPhoneValue = findViewById(R.id.tvUserPhoneValue);
        if (tvUserPhoneValue != null) tvUserPhoneValue.setText(telefonoUsuario);
        TextView tvUserAddressValue = findViewById(R.id.tvUserAddressValue);
        if (tvUserAddressValue != null) tvUserAddressValue.setText(direccionUsuario);

        View llVeterinarios = findViewById(R.id.llVeterinarios);
        if (llVeterinarios != null) {
            llVeterinarios.setOnClickListener(v -> showVeterinariosView());
        }

        View llEditarDatos = findViewById(R.id.llEditarDatos);
        if (llEditarDatos != null) {
            llEditarDatos.setOnClickListener(v -> showEditarPerfilView());
        }
    }

    private void showEditarPerfilView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.editar_perfil, container, true);

        EditText etNombreCompleto = findViewById(R.id.etNombreCompleto);
        EditText etCorreo = findViewById(R.id.etCorreo);
        EditText etTelefono = findViewById(R.id.etTelefono);
        EditText etDireccion = findViewById(R.id.etDireccion);

        if (etNombreCompleto != null) etNombreCompleto.setText(nombreUsuario);
        if (etCorreo != null) etCorreo.setText(emailUsuario);
        if (etTelefono != null) etTelefono.setText(telefonoUsuario);
        if (etDireccion != null) etDireccion.setText(direccionUsuario);

        View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showProfileView());
        }

        View btnGuardarPerfil = findViewById(R.id.btnGuardarPerfil);
        if (btnGuardarPerfil != null) {
            btnGuardarPerfil.setOnClickListener(v -> {
                bounceView(v);
                String nombre = etNombreCompleto != null ? etNombreCompleto.getText().toString().trim() : "";
                String correo = etCorreo != null ? etCorreo.getText().toString().trim() : "";
                String telefono = etTelefono != null ? etTelefono.getText().toString().trim() : "";
                String direccion = etDireccion != null ? etDireccion.getText().toString().trim() : "";

                if (nombre.isEmpty() || correo.isEmpty()) {
                    Toast.makeText(this, "Completá al menos el nombre y el correo", Toast.LENGTH_SHORT).show();
                    return;
                }

                nombreUsuario = nombre;
                emailUsuario = correo;
                telefonoUsuario = telefono;
                direccionUsuario = direccion;

                Toast.makeText(this, R.string.perfil_actualizado_msg, Toast.LENGTH_SHORT).show();
                showProfileView();
            });
        }
    }

    private void showPetsView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.mis_mascotas, container, true);

        highlightNavItem(R.id.nav_mascotas);
        
        View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showHomeView());
        }

        View btnAddPet = findViewById(R.id.btnAddPet);
        if (btnAddPet != null) {
            btnAddPet.setOnClickListener(v -> {
                bounceView(v);
                showNuevaMascotaView();
            });
        }

        View layoutPet1 = findViewById(R.id.layout_pet_1);
        if (layoutPet1 != null) {
            layoutPet1.setOnClickListener(v -> showPetDetailView());
        }
        View layoutPet2 = findViewById(R.id.layout_pet_2);
        if (layoutPet2 != null) {
            layoutPet2.setOnClickListener(v -> showPetDetailView());
        }
        View layoutPet3 = findViewById(R.id.layout_pet_3);
        if (layoutPet3 != null) {
            layoutPet3.setOnClickListener(v -> showPetDetailView());
        }

        LinearLayout listaMascotasContainer = findViewById(R.id.listaMascotasContainer);
        if (listaMascotasContainer != null) {
            for (Mascota m : mascotasNuevas) {
                listaMascotasContainer.addView(buildMascotaCard(m));
            }
        }
    }

    private View buildMascotaCard(Mascota m) {
        CardView card = new CardView(this);
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(12);
        card.setLayoutParams(cardLp);
        card.setRadius(dp(12));
        card.setCardElevation(dp(2));
        card.setUseCompatPadding(true);

        LinearLayout inner = new LinearLayout(this);
        inner.setOrientation(LinearLayout.HORIZONTAL);
        inner.setGravity(Gravity.CENTER_VERTICAL);
        inner.setPadding(dp(12), dp(12), dp(12), dp(12));

        if (m.fotoUri != null) {
            ShapeableImageView ivFoto =
                    new ShapeableImageView(this);
            ivFoto.setLayoutParams(new LinearLayout.LayoutParams(dp(56), dp(56)));
            ivFoto.setScaleType(ImageView.ScaleType.CENTER_CROP);
            ivFoto.setShapeAppearanceModel(ivFoto.getShapeAppearanceModel().toBuilder()
                    .setAllCornerSizes(new RelativeCornerSize(0.5f))
                    .build());
            ivFoto.setImageURI(m.fotoUri);
            inner.addView(ivFoto);
        } else {
            FrameLayout iconCircle = new FrameLayout(this);
            iconCircle.setLayoutParams(new LinearLayout.LayoutParams(dp(56), dp(56)));
            iconCircle.setBackgroundResource(R.drawable.bg_icon_teal);
            ImageView icon = new ImageView(this);
            FrameLayout.LayoutParams iconLp = new FrameLayout.LayoutParams(dp(28), dp(28));
            iconLp.gravity = Gravity.CENTER;
            icon.setLayoutParams(iconLp);
            icon.setImageResource(R.drawable.ic_dog);
            icon.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
            iconCircle.addView(icon);
            inner.addView(iconCircle);
        }

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams textColLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        textColLp.setMarginStart(dp(16));
        textCol.setLayoutParams(textColLp);

        TextView tvNombre = new TextView(this);
        tvNombre.setText(m.nombre);
        tvNombre.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvNombre.setTextSize(16);
        tvNombre.setTypeface(tvNombre.getTypeface(), Typeface.BOLD);
        textCol.addView(tvNombre);

        TextView tvRaza = new TextView(this);
        tvRaza.setText(m.tipo + " - " + m.raza);
        tvRaza.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvRaza.setTextSize(13);
        LinearLayout.LayoutParams razaLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        razaLp.topMargin = dp(2);
        tvRaza.setLayoutParams(razaLp);
        textCol.addView(tvRaza);

        TextView tvFecha = new TextView(this);
        tvFecha.setText(m.fechaNacimiento);
        tvFecha.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvFecha.setTextSize(12);
        LinearLayout.LayoutParams fechaLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        fechaLp.topMargin = dp(2);
        tvFecha.setLayoutParams(fechaLp);
        textCol.addView(tvFecha);

        inner.addView(textCol);
        card.addView(inner);

        card.setOnClickListener(v -> showPetDetailView());
        return card;
    }

    private void showNuevaMascotaView() {
        ensureAppBaseSet();
        tipoMascotaNueva = null;
        fotoMascotaNuevaUri = null;
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.nueva_mascota, container, true);

        EditText etNombreMascota = findViewById(R.id.etNombreMascota);
        EditText etRaza = findViewById(R.id.etRaza);
        EditText etFechaNacimiento = findViewById(R.id.etFechaNacimiento);

        setupTipoMascotaOption(R.id.optTipoPerro, getString(R.string.tipo_perro));
        setupTipoMascotaOption(R.id.optTipoGato, getString(R.string.tipo_gato));
        setupTipoMascotaOption(R.id.optTipoOtro, getString(R.string.tipo_otro));

        View ivFotoMascota = findViewById(R.id.ivFotoMascota);
        View btnSeleccionarFoto = findViewById(R.id.btnSeleccionarFoto);
        View.OnClickListener seleccionarFotoListener = v -> {
            bounceView(v);
            pickFotoMascotaLauncher.launch("image/*");
        };
        if (ivFotoMascota != null) ivFotoMascota.setOnClickListener(seleccionarFotoListener);
        if (btnSeleccionarFoto != null) btnSeleccionarFoto.setOnClickListener(seleccionarFotoListener);

        View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showPetsView());
        }

        View btnGuardarMascota = findViewById(R.id.btnGuardarMascota);
        if (btnGuardarMascota != null) {
            btnGuardarMascota.setOnClickListener(v -> {
                bounceView(v);
                String nombre = etNombreMascota != null ? etNombreMascota.getText().toString().trim() : "";
                String raza = etRaza != null ? etRaza.getText().toString().trim() : "";
                String fecha = etFechaNacimiento != null ? etFechaNacimiento.getText().toString().trim() : "";

                if (nombre.isEmpty()) {
                    Toast.makeText(this, "Ingresá el nombre de la mascota", Toast.LENGTH_SHORT).show();
                    return;
                }
                if (tipoMascotaNueva == null) {
                    Toast.makeText(this, "Seleccioná el tipo de mascota", Toast.LENGTH_SHORT).show();
                    return;
                }

                mascotasNuevas.add(new Mascota(nombre, tipoMascotaNueva,
                        raza.isEmpty() ? tipoMascotaNueva : raza, fecha.isEmpty() ? "-" : fecha, fotoMascotaNuevaUri));

                Toast.makeText(this, R.string.mascota_agregada_msg, Toast.LENGTH_SHORT).show();
                showPetsView();
            });
        }
    }

    private void setupTipoMascotaOption(int viewId, String tipo) {
        TextView opt = findViewById(viewId);
        if (opt == null) return;
        opt.setOnClickListener(v -> {
            bounceView(v);
            tipoMascotaNueva = tipo;
            actualizarSeleccionTipoMascotaUI();
        });
    }

    private void actualizarSeleccionTipoMascotaUI() {
        int[] ids = {R.id.optTipoPerro, R.id.optTipoGato, R.id.optTipoOtro};
        String[] tipos = {getString(R.string.tipo_perro), getString(R.string.tipo_gato), getString(R.string.tipo_otro)};
        for (int i = 0; i < ids.length; i++) {
            TextView opt = findViewById(ids[i]);
            if (opt == null) continue;
            if (tipos[i].equals(tipoMascotaNueva)) {
                opt.setBackgroundResource(R.drawable.bg_chip_selected);
                opt.setTextColor(ContextCompat.getColor(this, R.color.white));
            } else {
                opt.setBackgroundResource(R.drawable.bg_chip_unselected);
                opt.setTextColor(ContextCompat.getColor(this, R.color.black));
            }
        }
    }

    private void setupBottomNavigation() {
        View navHome = findViewById(R.id.nav_home);
        View navMascotas = findViewById(R.id.nav_mascotas);
        View navLista = findViewById(R.id.nav_lista);
        View navMas = findViewById(R.id.nav_mas);
        View fabAdd = findViewById(R.id.fab_add);

        if (navHome != null) {
            navHome.setOnClickListener(v -> showHomeView());
        }
        if (navMascotas != null) {
            navMascotas.setOnClickListener(v -> showPetsView());
        }
        if (navLista != null) {
            navLista.setOnClickListener(v -> showCalendarView());
        }
        if (navMas != null) {
            navMas.setOnClickListener(v -> showProfileView());
        }
        if (fabAdd != null) {
            fabAdd.setOnClickListener(v -> {
                v.animate().scaleX(1.2f).scaleY(1.2f).setDuration(100).withEndAction(() -> {
                    v.animate().scaleX(1.0f).scaleY(1.0f).setDuration(100).start();
                }).start();
                showNuevoEventoView(diaSeleccionado);
            });
        }
    }

    private void highlightNavItem(int navId) {
        int activeColor = ContextCompat.getColor(this, R.color.primary_teal);
        int inactiveColor = ContextCompat.getColor(this, R.color.text_gray);

        int[] navIds = {R.id.nav_home, R.id.nav_mascotas, R.id.nav_lista, R.id.nav_mas};
        int[] iconIds = {R.id.iv_nav_home, R.id.iv_nav_mascotas, R.id.iv_nav_lista, R.id.iv_nav_mas};
        int[] textIds = {R.id.tv_nav_home, R.id.tv_nav_mascotas, R.id.tv_nav_lista, R.id.tv_nav_mas};

        for (int i = 0; i < navIds.length; i++) {
            View container = findViewById(navIds[i]);
            ImageView icon = findViewById(iconIds[i]);
            TextView text = findViewById(textIds[i]);

            if (container != null && icon != null && text != null) {
                if (navIds[i] == navId) {
                    icon.setColorFilter(activeColor);
                    text.setTextColor(activeColor);
                    container.animate().scaleX(1.1f).scaleY(1.1f).setDuration(200).start();
                } else {
                    icon.setColorFilter(inactiveColor);
                    text.setTextColor(inactiveColor);
                    container.animate().scaleX(1.0f).scaleY(1.0f).setDuration(200).start();
                }
            }
        }
    }

    // ===================== Calendario / Nuevo evento / Veterinarios =====================

    private static final String[] MESES = {"Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"};

    private static class EventoMascota {
        String categoria;
        String mascota;
        String veterinario;
        String hora;
        String observaciones;

        EventoMascota(String categoria, String mascota, String veterinario, String hora, String observaciones) {
            this.categoria = categoria;
            this.mascota = mascota;
            this.veterinario = veterinario;
            this.hora = hora;
            this.observaciones = observaciones;
        }
    }

    private static class Veterinario {
        String nombre;
        String especialidad;
        String matricula;

        Veterinario(String nombre, String especialidad, String matricula) {
            this.nombre = nombre;
            this.especialidad = especialidad;
            this.matricula = matricula;
        }
    }

    private final List<Veterinario> veterinariosDemo = Arrays.asList(
            new Veterinario("Dr. Alejandro Ramírez", "Vacuna", "MP-12345"),
            new Veterinario("Dra. Sofía Fernández", "Vacuna", "MP-77890"),
            new Veterinario("Dra. Carla Méndez", "Control", "MP-98765"),
            new Veterinario("Dr. Ricardo Soto", "Cirugía", "MP-45612"),
            new Veterinario("Dra. Valentina Ríos", "Estudio / Tratamiento", "MP-33221"));

    private static class Mascota {
        String nombre;
        String tipo;
        String raza;
        String fechaNacimiento;
        Uri fotoUri;

        Mascota(String nombre, String tipo, String raza, String fechaNacimiento, Uri fotoUri) {
            this.nombre = nombre;
            this.tipo = tipo;
            this.raza = raza;
            this.fechaNacimiento = fechaNacimiento;
            this.fotoUri = fotoUri;
        }
    }

    private final List<Mascota> mascotasNuevas = new ArrayList<>();
    private String tipoMascotaNueva = null;
    private Uri fotoMascotaNuevaUri = null;

    private final ActivityResultLauncher<String> pickFotoMascotaLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri == null) return;
                fotoMascotaNuevaUri = uri;
                ShapeableImageView ivFotoMascota = findViewById(R.id.ivFotoMascota);
                if (ivFotoMascota != null) {
                    ivFotoMascota.setPadding(0, 0, 0, 0);
                    ivFotoMascota.setScaleType(ImageView.ScaleType.CENTER_CROP);
                    ivFotoMascota.setImageURI(uri);
                }
            });

    private boolean perfilInicializado = false;
    private String nombreUsuario;
    private String emailUsuario;
    private String telefonoUsuario;
    private String direccionUsuario;

    private void inicializarPerfilSiNecesario() {
        if (!perfilInicializado) {
            nombreUsuario = getString(R.string.user_name);
            emailUsuario = getString(R.string.user_email);
            telefonoUsuario = getString(R.string.user_phone);
            direccionUsuario = getString(R.string.user_address);
            perfilInicializado = true;
        }
    }

    private final Map<String, List<EventoMascota>> eventosPorFecha = new HashMap<>();
    private boolean eventosDemoSeeded = false;

    private YearMonth mesCalendarioActual = YearMonth.of(2026, 5);
    private LocalDate diaSeleccionado = LocalDate.of(2026, 5, 15);
    private LocalDate fechaEventoNuevo = LocalDate.of(2026, 5, 15);
    private YearMonth mesEventoNuevo = YearMonth.of(2026, 5);

    private int stepperActual = 1;
    private String categoriaNuevoEvento = null;
    private String mascotaNuevoEvento = null;
    private String veterinarioNuevoEvento = null;
    private String horaNuevoEvento = "11:00";
    private String observacionesNuevoEvento = "";

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }

    private String dateKey(LocalDate fecha) {
        return fecha.toString();
    }

    private void agregarEvento(LocalDate fecha, String categoria, String mascota, String veterinario, String hora, String observaciones) {
        String key = dateKey(fecha);
        List<EventoMascota> lista = eventosPorFecha.get(key);
        if (lista == null) {
            lista = new ArrayList<>();
            eventosPorFecha.put(key, lista);
        }
        lista.add(new EventoMascota(categoria, mascota, veterinario, hora, observaciones));
    }

    private void seedEventosDemoSiNecesario() {
        if (eventosDemoSeeded) return;
        eventosDemoSeeded = true;
        agregarEvento(LocalDate.of(2026, 5, 15), "Vacuna", "Koda", "Dr. Alejandro Ramírez", "11:00", "");
        agregarEvento(LocalDate.of(2026, 5, 15), "Control", "Mika", "Dra. Carla Méndez", "11:00", "");
        agregarEvento(LocalDate.of(2026, 5, 20), "Cirugía", "Milo", "Dr. Ricardo Soto", "09:00", "");
        agregarEvento(LocalDate.of(2026, 5, 20), "Vacuna", "Luna", "Dra. Sofía Fernández", "14:00", "");
        agregarEvento(LocalDate.of(2026, 5, 22), "Control", "Koda", "Dra. Carla Méndez", "16:00", "");
        agregarEvento(LocalDate.of(2026, 5, 28), "Estudio / Tratamiento", "Mika", "Dra. Valentina Ríos", "10:00", "");
        agregarEvento(LocalDate.of(2026, 5, 28), "Vacuna", "Milo", "Dr. Alejandro Ramírez", "13:00", "");
    }

    private void showCalendarView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.calendario, container, true);

        highlightNavItem(R.id.nav_lista);

        View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showHomeView());
        }

        View btnAgregarEvento = findViewById(R.id.btnAgregarEvento);
        if (btnAgregarEvento != null) {
            btnAgregarEvento.setOnClickListener(v -> showNuevoEventoView(diaSeleccionado));
        }

        View btnMesAnterior = findViewById(R.id.btnMesAnterior);
        if (btnMesAnterior != null) {
            btnMesAnterior.setOnClickListener(v -> {
                mesCalendarioActual = mesCalendarioActual.minusMonths(1);
                renderCalendario();
            });
        }

        View btnMesSiguiente = findViewById(R.id.btnMesSiguiente);
        if (btnMesSiguiente != null) {
            btnMesSiguiente.setOnClickListener(v -> {
                mesCalendarioActual = mesCalendarioActual.plusMonths(1);
                renderCalendario();
            });
        }

        renderCalendario();
    }

    private void renderCalendario() {
        TextView tvMesAno = findViewById(R.id.tvMesAno);
        if (tvMesAno != null) {
            tvMesAno.setText(MESES[mesCalendarioActual.getMonthValue() - 1] + " " + mesCalendarioActual.getYear());
        }

        GridLayout grid = findViewById(R.id.gridCalendario);
        if (grid != null) {
            grid.removeAllViews();

            LocalDate primerDia = mesCalendarioActual.atDay(1);
            int diasEnMes = mesCalendarioActual.lengthOfMonth();
            int primerDiaSemana = primerDia.getDayOfWeek().getValue(); // 1=Lunes .. 7=Domingo

            for (int i = 0; i < primerDiaSemana - 1; i++) {
                TextView empty = new TextView(this);
                GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
                lp.width = 0;
                lp.height = dp(40);
                lp.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
                empty.setLayoutParams(lp);
                grid.addView(empty);
            }

            for (int dia = 1; dia <= diasEnMes; dia++) {
                LocalDate fecha = mesCalendarioActual.atDay(dia);
                grid.addView(buildCalendarDayCell(fecha, dia));
            }
        }

        renderEventosDia();
    }

    private FrameLayout buildCalendarDayCell(LocalDate fecha, int dia) {
        FrameLayout cell = new FrameLayout(this);
        GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
        lp.width = 0;
        lp.height = dp(40);
        lp.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
        lp.setMargins(dp(2), dp(2), dp(2), dp(2));
        cell.setLayoutParams(lp);

        boolean seleccionado = fecha.equals(diaSeleccionado);
        if (seleccionado) {
            cell.setBackgroundResource(R.drawable.bg_day_selected);
        }

        TextView tvDia = new TextView(this);
        tvDia.setText(String.valueOf(dia));
        tvDia.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams tvLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
        tvDia.setLayoutParams(tvLp);
        tvDia.setTextColor(ContextCompat.getColor(this, seleccionado ? R.color.white : R.color.black));
        tvDia.setTextSize(13);
        cell.addView(tvDia);

        List<EventoMascota> eventos = eventosPorFecha.get(dateKey(fecha));
        if (eventos != null && !eventos.isEmpty()) {
            View dot = new View(this);
            FrameLayout.LayoutParams dotLp = new FrameLayout.LayoutParams(dp(5), dp(5));
            dotLp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            dotLp.bottomMargin = dp(4);
            dot.setLayoutParams(dotLp);
            dot.setBackgroundResource(seleccionado ? R.drawable.bg_dot_orange : R.drawable.bg_dot_teal);
            cell.addView(dot);
        }

        cell.setOnClickListener(v -> {
            diaSeleccionado = fecha;
            renderCalendario();
        });

        return cell;
    }

    private void renderEventosDia() {
        TextView tvDiaSeleccionado = findViewById(R.id.tvDiaSeleccionado);
        LinearLayout listaEventos = findViewById(R.id.listaEventosDia);
        TextView tvSinEventos = findViewById(R.id.tvSinEventos);
        if (listaEventos == null) return;

        if (tvDiaSeleccionado != null) {
            tvDiaSeleccionado.setText("Eventos del " + diaSeleccionado.getDayOfMonth() + " de " + MESES[diaSeleccionado.getMonthValue() - 1]);
        }

        listaEventos.removeAllViews();
        List<EventoMascota> eventos = eventosPorFecha.get(dateKey(diaSeleccionado));

        if (eventos == null || eventos.isEmpty()) {
            if (tvSinEventos != null) tvSinEventos.setVisibility(View.VISIBLE);
            return;
        }
        if (tvSinEventos != null) tvSinEventos.setVisibility(View.GONE);

        for (EventoMascota evento : eventos) {
            listaEventos.addView(buildEventoCard(evento));
        }
    }

    private int[] getEstiloCategoria(String categoria) {
        if ("Vacuna".equals(categoria)) {
            return new int[]{R.drawable.ic_syringe, R.drawable.bg_icon_teal, R.color.primary_teal};
        } else if ("Control".equals(categoria)) {
            return new int[]{R.drawable.ic_pulse, R.drawable.bg_icon_teal, R.color.primary_teal};
        } else if ("Cirugía".equals(categoria)) {
            return new int[]{R.drawable.ic_cirugia, R.drawable.bg_icon_orange, R.color.accent_orange};
        } else {
            return new int[]{R.drawable.ic_activity, R.drawable.bg_icon_purple, R.color.accent_purple};
        }
    }

    private View buildEventoCard(EventoMascota evento) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setBackgroundResource(R.drawable.bg_edit_text);
        card.setPadding(dp(12), dp(12), dp(12), dp(12));
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(8);
        card.setLayoutParams(cardLp);

        int[] estilo = getEstiloCategoria(evento.categoria);

        FrameLayout iconCircle = new FrameLayout(this);
        iconCircle.setLayoutParams(new LinearLayout.LayoutParams(dp(36), dp(36)));
        iconCircle.setBackgroundResource(estilo[1]);

        ImageView icon = new ImageView(this);
        FrameLayout.LayoutParams iconInnerLp = new FrameLayout.LayoutParams(dp(18), dp(18));
        iconInnerLp.gravity = Gravity.CENTER;
        icon.setLayoutParams(iconInnerLp);
        icon.setImageResource(estilo[0]);
        icon.setColorFilter(ContextCompat.getColor(this, estilo[2]));
        iconCircle.addView(icon);
        card.addView(iconCircle);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams textColLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        textColLp.setMarginStart(dp(12));
        textCol.setLayoutParams(textColLp);

        TextView tvTitulo = new TextView(this);
        tvTitulo.setText(evento.categoria + " - " + evento.mascota);
        tvTitulo.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvTitulo.setTextSize(14);
        tvTitulo.setTypeface(tvTitulo.getTypeface(), Typeface.BOLD);
        textCol.addView(tvTitulo);

        TextView tvHora = new TextView(this);
        tvHora.setText(evento.veterinario != null && !evento.veterinario.isEmpty()
                ? evento.hora + " · " + evento.veterinario : evento.hora);
        tvHora.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvHora.setTextSize(12);
        textCol.addView(tvHora);

        card.addView(textCol);
        return card;
    }

    private void bounceView(View v) {
        if (v == null) return;
        v.animate().cancel();
        v.setScaleX(0.92f);
        v.setScaleY(0.92f);
        v.animate().scaleX(1f).scaleY(1f).setDuration(220)
                .setInterpolator(new OvershootInterpolator(4f)).start();
    }

    private void animateStepIn(View v) {
        if (v == null) return;
        v.animate().cancel();
        v.setAlpha(0f);
        v.setTranslationY(dp(16));
        v.animate().alpha(1f).translationY(0f).setDuration(280)
                .setInterpolator(new DecelerateInterpolator()).start();
    }

    private void applyRippleBackground(View v) {
        if (v == null) return;
        TypedValue outValue = new TypedValue();
        getTheme().resolveAttribute(android.R.attr.selectableItemBackground, outValue, true);
        v.setBackgroundResource(outValue.resourceId);
    }

    private void showNuevoEventoView(LocalDate fecha) {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.nuevo_evento, container, true);

        highlightNavItem(-1);

        fechaEventoNuevo = fecha;
        mesEventoNuevo = YearMonth.from(fecha);
        stepperActual = 1;
        categoriaNuevoEvento = null;
        mascotaNuevoEvento = null;
        veterinarioNuevoEvento = null;
        horaNuevoEvento = "11:00";
        observacionesNuevoEvento = "";

        View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showCalendarView());
        }

        View categoriaSelector = findViewById(R.id.categoriaSelector);
        View categoriaOptions = findViewById(R.id.categoriaOptions);
        if (categoriaSelector != null && categoriaOptions != null) {
            categoriaSelector.setOnClickListener(v ->
                    categoriaOptions.setVisibility(categoriaOptions.getVisibility() == View.VISIBLE
                            ? View.GONE : View.VISIBLE));
        }

        setupCategoriaOption(R.id.optVacuna, "Vacuna");
        setupCategoriaOption(R.id.optControl, "Control");
        setupCategoriaOption(R.id.optCirugia, "Cirugía");
        setupCategoriaOption(R.id.optEstudio, "Estudio / Tratamiento");

        View mascotaSelector = findViewById(R.id.mascotaSelector);
        View mascotaOptions = findViewById(R.id.mascotaOptions);
        if (mascotaSelector != null && mascotaOptions != null) {
            mascotaSelector.setOnClickListener(v ->
                    mascotaOptions.setVisibility(mascotaOptions.getVisibility() == View.VISIBLE
                            ? View.GONE : View.VISIBLE));
        }

        setupMascotaOption(R.id.optKoda, "Koda");
        setupMascotaOption(R.id.optMika, "Mika");
        setupMascotaOption(R.id.optLuna, "Luna");
        setupMascotaOption(R.id.optMilo, "Milo");

        setupHoraChip(R.id.chip0900, "09:00");
        setupHoraChip(R.id.chip1100, "11:00");
        setupHoraChip(R.id.chip1400, "14:00");
        setupHoraChip(R.id.chip1600, "16:00");
        setupHoraChip(R.id.chip1800, "18:00");

        View btnMesAnteriorMini = findViewById(R.id.btnMesAnteriorMini);
        if (btnMesAnteriorMini != null) {
            btnMesAnteriorMini.setOnClickListener(v -> {
                mesEventoNuevo = mesEventoNuevo.minusMonths(1);
                renderCalendarioMini();
            });
        }

        View btnMesSiguienteMini = findViewById(R.id.btnMesSiguienteMini);
        if (btnMesSiguienteMini != null) {
            btnMesSiguienteMini.setOnClickListener(v -> {
                mesEventoNuevo = mesEventoNuevo.plusMonths(1);
                renderCalendarioMini();
            });
        }

        TextView btnAtrasCancelar = findViewById(R.id.btnAtrasCancelar);
        TextView btnSiguienteGuardar = findViewById(R.id.btnSiguienteGuardar);

        if (btnAtrasCancelar != null) {
            btnAtrasCancelar.setOnClickListener(v -> {
                bounceView(v);
                if (stepperActual == 1) {
                    showCalendarView();
                } else {
                    stepperActual--;
                    actualizarStepperUI();
                }
            });
        }

        if (btnSiguienteGuardar != null) {
            btnSiguienteGuardar.setOnClickListener(v -> {
                bounceView(v);
                if (stepperActual == 1) {
                    if (categoriaNuevoEvento == null || mascotaNuevoEvento == null) {
                        Toast.makeText(this, "Seleccioná una categoría y una mascota", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    stepperActual = 2;
                    actualizarStepperUI();
                } else if (stepperActual == 2) {
                    if (veterinarioNuevoEvento == null) {
                        Toast.makeText(this, "Seleccioná un veterinario", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    stepperActual = 3;
                    actualizarStepperUI();
                } else if (stepperActual == 3) {
                    EditText etObservaciones = findViewById(R.id.etObservaciones);
                    observacionesNuevoEvento = etObservaciones != null ? etObservaciones.getText().toString().trim() : "";
                    stepperActual = 4;
                    actualizarStepperUI();
                } else {
                    agregarEvento(fechaEventoNuevo, categoriaNuevoEvento, mascotaNuevoEvento, veterinarioNuevoEvento, horaNuevoEvento, observacionesNuevoEvento);
                    diaSeleccionado = fechaEventoNuevo;
                    mesCalendarioActual = YearMonth.from(fechaEventoNuevo);
                    Toast.makeText(this, getString(R.string.btn_guardar_evento) + ": OK", Toast.LENGTH_SHORT).show();
                    showCalendarView();
                }
            });
        }

        actualizarStepperUI();
    }

    private void setupCategoriaOption(int viewId, String categoria) {
        View opt = findViewById(viewId);
        TextView tvCategoriaSeleccionada = findViewById(R.id.tvCategoriaSeleccionada);
        View categoriaOptions = findViewById(R.id.categoriaOptions);
        if (opt == null) return;
        applyRippleBackground(opt);
        opt.setOnClickListener(v -> {
            bounceView(v);
            categoriaNuevoEvento = categoria;
            veterinarioNuevoEvento = null;
            if (tvCategoriaSeleccionada != null) tvCategoriaSeleccionada.setText(categoria);
            if (categoriaOptions != null) categoriaOptions.setVisibility(View.GONE);
            actualizarSeleccionCategoriaUI();
        });
    }

    private void actualizarSeleccionCategoriaUI() {
        int[] ids = {R.id.optVacuna, R.id.optControl, R.id.optCirugia, R.id.optEstudio};
        String[] cats = {"Vacuna", "Control", "Cirugía", "Estudio / Tratamiento"};
        for (int i = 0; i < ids.length; i++) {
            View opt = findViewById(ids[i]);
            if (opt == null) continue;
            if (cats[i].equals(categoriaNuevoEvento)) {
                opt.setBackgroundResource(R.drawable.bg_option_selected);
            } else {
                applyRippleBackground(opt);
            }
        }
    }

    private void setupMascotaOption(int viewId, String mascota) {
        View opt = findViewById(viewId);
        TextView tvMascotaSeleccionada = findViewById(R.id.tvMascotaSeleccionada);
        View mascotaOptions = findViewById(R.id.mascotaOptions);
        if (opt == null) return;
        applyRippleBackground(opt);
        opt.setOnClickListener(v -> {
            bounceView(v);
            mascotaNuevoEvento = mascota;
            if (tvMascotaSeleccionada != null) tvMascotaSeleccionada.setText(mascota);
            if (mascotaOptions != null) mascotaOptions.setVisibility(View.GONE);
            actualizarSeleccionMascotaUI();
        });
    }

    private void actualizarSeleccionMascotaUI() {
        int[] ids = {R.id.optKoda, R.id.optMika, R.id.optLuna, R.id.optMilo};
        String[] mascotas = {"Koda", "Mika", "Luna", "Milo"};
        for (int i = 0; i < ids.length; i++) {
            View opt = findViewById(ids[i]);
            if (opt == null) continue;
            if (mascotas[i].equals(mascotaNuevoEvento)) {
                opt.setBackgroundResource(R.drawable.bg_option_selected);
            } else {
                applyRippleBackground(opt);
            }
        }
    }

    private void renderVeterinarioOptions() {
        LinearLayout container = findViewById(R.id.veterinarioOptionsContainer);
        TextView tvSinVeterinarios = findViewById(R.id.tvSinVeterinarios);
        if (container == null) return;
        container.removeAllViews();

        List<Veterinario> filtrados = new ArrayList<>();
        for (Veterinario vet : veterinariosDemo) {
            if (vet.especialidad.equals(categoriaNuevoEvento)) filtrados.add(vet);
        }

        if (filtrados.isEmpty()) {
            if (tvSinVeterinarios != null) tvSinVeterinarios.setVisibility(View.VISIBLE);
            return;
        }
        if (tvSinVeterinarios != null) tvSinVeterinarios.setVisibility(View.GONE);

        for (Veterinario vet : filtrados) {
            container.addView(buildVeterinarioCard(vet));
        }
    }

    private View buildVeterinarioCard(Veterinario vet) {
        boolean seleccionado = vet.nombre.equals(veterinarioNuevoEvento);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(12), dp(12), dp(12));
        card.setBackgroundResource(seleccionado ? R.drawable.bg_option_selected : R.drawable.bg_edit_text);
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(8);
        card.setLayoutParams(cardLp);

        FrameLayout iconCircle = new FrameLayout(this);
        iconCircle.setLayoutParams(new LinearLayout.LayoutParams(dp(36), dp(36)));
        iconCircle.setBackgroundResource(R.drawable.bg_icon_teal);
        ImageView icon = new ImageView(this);
        FrameLayout.LayoutParams iconLp = new FrameLayout.LayoutParams(dp(18), dp(18));
        iconLp.gravity = Gravity.CENTER;
        icon.setLayoutParams(iconLp);
        icon.setImageResource(R.drawable.ic_medical);
        icon.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
        iconCircle.addView(icon);
        card.addView(iconCircle);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams textColLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        textColLp.setMarginStart(dp(12));
        textCol.setLayoutParams(textColLp);

        TextView tvNombre = new TextView(this);
        tvNombre.setText(vet.nombre);
        tvNombre.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvNombre.setTextSize(14);
        tvNombre.setTypeface(tvNombre.getTypeface(), Typeface.BOLD);
        textCol.addView(tvNombre);

        TextView tvMatricula = new TextView(this);
        tvMatricula.setText(vet.especialidad + " · " + vet.matricula);
        tvMatricula.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvMatricula.setTextSize(12);
        textCol.addView(tvMatricula);

        card.addView(textCol);

        if (seleccionado) {
            ImageView check = new ImageView(this);
            check.setLayoutParams(new LinearLayout.LayoutParams(dp(22), dp(22)));
            check.setImageResource(R.drawable.ic_check_circle);
            check.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
            card.addView(check);
        }

        card.setOnClickListener(v -> {
            bounceView(v);
            veterinarioNuevoEvento = vet.nombre;
            renderVeterinarioOptions();
        });

        return card;
    }

    private void renderCalendarioMini() {
        TextView tvMesAnoMini = findViewById(R.id.tvMesAnoMini);
        if (tvMesAnoMini != null) {
            tvMesAnoMini.setText(MESES[mesEventoNuevo.getMonthValue() - 1] + " " + mesEventoNuevo.getYear());
        }

        GridLayout grid = findViewById(R.id.gridCalendarioMini);
        if (grid == null) return;
        grid.removeAllViews();

        LocalDate primerDia = mesEventoNuevo.atDay(1);
        int diasEnMes = mesEventoNuevo.lengthOfMonth();
        int primerDiaSemana = primerDia.getDayOfWeek().getValue();

        for (int i = 0; i < primerDiaSemana - 1; i++) {
            TextView empty = new TextView(this);
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
            lp.width = 0;
            lp.height = dp(36);
            lp.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
            empty.setLayoutParams(lp);
            grid.addView(empty);
        }

        for (int dia = 1; dia <= diasEnMes; dia++) {
            LocalDate fecha = mesEventoNuevo.atDay(dia);
            grid.addView(buildMiniDayCell(fecha, dia));
        }
    }

    private FrameLayout buildMiniDayCell(LocalDate fecha, int dia) {
        FrameLayout cell = new FrameLayout(this);
        GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
        lp.width = 0;
        lp.height = dp(36);
        lp.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
        lp.setMargins(dp(2), dp(2), dp(2), dp(2));
        cell.setLayoutParams(lp);

        boolean seleccionado = fecha.equals(fechaEventoNuevo);
        if (seleccionado) {
            cell.setBackgroundResource(R.drawable.bg_day_selected);
        }

        TextView tvDia = new TextView(this);
        tvDia.setText(String.valueOf(dia));
        tvDia.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams tvLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
        tvDia.setLayoutParams(tvLp);
        tvDia.setTextColor(ContextCompat.getColor(this, seleccionado ? R.color.white : R.color.black));
        tvDia.setTextSize(13);
        cell.addView(tvDia);

        cell.setOnClickListener(v -> {
            bounceView(v);
            fechaEventoNuevo = fecha;
            renderCalendarioMini();
        });

        return cell;
    }

    private void setupHoraChip(int viewId, String hora) {
        TextView chip = findViewById(viewId);
        if (chip == null) return;
        chip.setOnClickListener(v -> {
            bounceView(v);
            horaNuevoEvento = hora;
            actualizarChipsHora();
        });
    }

    private void actualizarChipsHora() {
        int[] chipIds = {R.id.chip0900, R.id.chip1100, R.id.chip1400, R.id.chip1600, R.id.chip1800};
        String[] horas = {"09:00", "11:00", "14:00", "16:00", "18:00"};
        for (int i = 0; i < chipIds.length; i++) {
            TextView chip = findViewById(chipIds[i]);
            if (chip == null) continue;
            if (horas[i].equals(horaNuevoEvento)) {
                chip.setBackgroundResource(R.drawable.bg_chip_selected);
                chip.setTextColor(ContextCompat.getColor(this, R.color.white));
            } else {
                chip.setBackgroundResource(R.drawable.bg_chip_unselected);
                chip.setTextColor(ContextCompat.getColor(this, R.color.black));
            }
        }
    }

    private void actualizarStepperUI() {
        int[] contentIds = {R.id.step1Content, R.id.step2Content, R.id.step3Content, R.id.step4Content};
        for (int i = 0; i < contentIds.length; i++) {
            View content = findViewById(contentIds[i]);
            if (content == null) continue;
            boolean visible = (i + 1) == stepperActual;
            if (visible) {
                content.setVisibility(View.VISIBLE);
                animateStepIn(content);
            } else {
                content.setVisibility(View.GONE);
            }
        }

        int[] circleIds = {R.id.step1Circle, R.id.step2Circle, R.id.step3Circle, R.id.step4Circle};
        int[] labelIds = {R.id.step1Label, R.id.step2Label, R.id.step3Label, R.id.step4Label};
        for (int i = 0; i < circleIds.length; i++) {
            View circle = findViewById(circleIds[i]);
            TextView label = findViewById(labelIds[i]);
            boolean activo = (i + 1) == stepperActual;
            boolean completado = (i + 1) < stepperActual;
            if (circle != null) circle.setBackgroundResource((activo || completado) ? R.drawable.bg_step_active : R.drawable.bg_step_inactive);
            if (label != null) label.setTextColor(ContextCompat.getColor(this, (activo || completado) ? R.color.primary_teal : R.color.text_gray));
        }

        int[] lineIds = {R.id.line1, R.id.line2, R.id.line3};
        for (int i = 0; i < lineIds.length; i++) {
            View line = findViewById(lineIds[i]);
            if (line == null) continue;
            boolean completado = (i + 1) < stepperActual;
            line.setBackgroundColor(ContextCompat.getColor(this, completado ? R.color.primary_teal : R.color.light_gray));
        }

        TextView btnAtrasCancelar = findViewById(R.id.btnAtrasCancelar);
        TextView btnSiguienteGuardar = findViewById(R.id.btnSiguienteGuardar);
        if (btnAtrasCancelar != null) {
            btnAtrasCancelar.setText(stepperActual == 1 ? getString(R.string.btn_cancelar) : getString(R.string.btn_atras));
        }
        if (btnSiguienteGuardar != null) {
            btnSiguienteGuardar.setText(stepperActual == 4 ? getString(R.string.btn_guardar_evento) : getString(R.string.btn_siguiente));
        }

        if (stepperActual == 1) {
            actualizarSeleccionCategoriaUI();
            actualizarSeleccionMascotaUI();
        } else if (stepperActual == 2) {
            renderVeterinarioOptions();
        } else if (stepperActual == 3) {
            renderCalendarioMini();
            actualizarChipsHora();
        } else if (stepperActual == 4) {
            actualizarResumen();
        }
    }

    private void actualizarResumen() {
        TextView tvResumenCategoria = findViewById(R.id.tvResumenCategoria);
        TextView tvResumenMascota = findViewById(R.id.tvResumenMascota);
        TextView tvResumenVeterinario = findViewById(R.id.tvResumenVeterinario);
        TextView tvResumenFecha = findViewById(R.id.tvResumenFecha);
        TextView tvResumenHora = findViewById(R.id.tvResumenHora);
        TextView tvResumenObservaciones = findViewById(R.id.tvResumenObservaciones);

        if (tvResumenCategoria != null) tvResumenCategoria.setText(categoriaNuevoEvento);
        if (tvResumenMascota != null) tvResumenMascota.setText(mascotaNuevoEvento);
        if (tvResumenVeterinario != null) tvResumenVeterinario.setText(veterinarioNuevoEvento);
        if (tvResumenFecha != null) {
            tvResumenFecha.setText(fechaEventoNuevo.getDayOfMonth() + " de " + MESES[fechaEventoNuevo.getMonthValue() - 1]
                    + ", " + fechaEventoNuevo.getYear());
        }
        if (tvResumenHora != null) tvResumenHora.setText(horaNuevoEvento);
        if (tvResumenObservaciones != null) {
            tvResumenObservaciones.setText(observacionesNuevoEvento.isEmpty()
                    ? getString(R.string.sin_observaciones) : observacionesNuevoEvento);
        }
    }

    private void showVeterinariosView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.veterinarios_autorizados, container, true);

        highlightNavItem(-1);

        View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showProfileView());
        }

        EditText etBuscar = findViewById(R.id.etBuscar);
        if (etBuscar != null) {
            etBuscar.addTextChangedListener(new TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) {
                    filtrarVeterinarios(s.toString());
                }

                @Override
                public void afterTextChanged(Editable s) {}
            });
        }

        View btnAgregarVeterinario = findViewById(R.id.btnAgregarVeterinario);
        if (btnAgregarVeterinario != null) {
            btnAgregarVeterinario.setOnClickListener(v -> mostrarDialogoNuevoVeterinario());
        }
    }

    private void filtrarVeterinarios(String query) {
        LinearLayout listaVeterinarios = findViewById(R.id.listaVeterinarios);
        TextView tvSinResultados = findViewById(R.id.tvSinResultados);
        if (listaVeterinarios == null) return;

        String q = query.trim().toLowerCase(Locale.getDefault());
        boolean algunoVisible = false;

        for (int i = 0; i < listaVeterinarios.getChildCount(); i++) {
            View child = listaVeterinarios.getChildAt(i);
            Object tag = child.getTag();
            if (tag == null) continue;
            boolean visible = q.isEmpty() || tag.toString().toLowerCase(Locale.getDefault()).contains(q);
            child.setVisibility(visible ? View.VISIBLE : View.GONE);
            if (visible) algunoVisible = true;
        }

        if (tvSinResultados != null) {
            tvSinResultados.setVisibility(algunoVisible ? View.GONE : View.VISIBLE);
        }
    }

    private void mostrarDialogoNuevoVeterinario() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(20);
        layout.setPadding(padding, padding, padding, padding);

        final EditText etNombre = new EditText(this);
        etNombre.setHint(getString(R.string.hint_nombre_veterinario));
        layout.addView(etNombre);

        final EditText etMatricula = new EditText(this);
        etMatricula.setHint(getString(R.string.hint_matricula));
        LinearLayout.LayoutParams lpMatricula = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lpMatricula.topMargin = dp(8);
        etMatricula.setLayoutParams(lpMatricula);
        layout.addView(etMatricula);

        new AlertDialog.Builder(this)
                .setTitle(R.string.dialog_nuevo_veterinario)
                .setView(layout)
                .setPositiveButton(R.string.btn_agregar, (dialog, which) -> {
                    String nombre = etNombre.getText().toString().trim();
                    String matricula = etMatricula.getText().toString().trim();
                    if (nombre.isEmpty()) {
                        Toast.makeText(this, getString(R.string.hint_nombre_veterinario), Toast.LENGTH_SHORT).show();
                        return;
                    }
                    agregarVeterinarioALista(nombre, matricula);
                })
                .setNegativeButton(R.string.btn_cancelar, null)
                .show();
    }

    private void agregarVeterinarioALista(String nombre, String matricula) {
        LinearLayout listaVeterinarios = findViewById(R.id.listaVeterinarios);
        if (listaVeterinarios == null) return;

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackgroundResource(R.drawable.bg_edit_text);
        card.setPadding(dp(14), dp(14), dp(14), dp(14));
        card.setTag(nombre);
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.topMargin = dp(12);
        card.setLayoutParams(cardLp);

        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView tvNombre = new TextView(this);
        tvNombre.setText(nombre);
        tvNombre.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvNombre.setTextSize(15);
        tvNombre.setTypeface(tvNombre.getTypeface(), Typeface.BOLD);
        tvNombre.setLayoutParams(new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        headerRow.addView(tvNombre);

        LinearLayout badge = new LinearLayout(this);
        badge.setOrientation(LinearLayout.HORIZONTAL);
        badge.setGravity(Gravity.CENTER_VERTICAL);
        badge.setBackgroundResource(R.drawable.bg_badge_orange);
        badge.setPadding(dp(8), dp(4), dp(8), dp(4));

        ImageView badgeIcon = new ImageView(this);
        badgeIcon.setLayoutParams(new LinearLayout.LayoutParams(dp(12), dp(12)));
        badgeIcon.setImageResource(R.drawable.ic_clock);
        badgeIcon.setColorFilter(ContextCompat.getColor(this, R.color.accent_orange));
        badge.addView(badgeIcon);

        TextView tvBadge = new TextView(this);
        tvBadge.setText(getString(R.string.estado_pendiente));
        tvBadge.setTextColor(ContextCompat.getColor(this, R.color.accent_orange));
        tvBadge.setTextSize(11);
        tvBadge.setTypeface(tvBadge.getTypeface(), Typeface.BOLD);
        LinearLayout.LayoutParams tvBadgeLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tvBadgeLp.setMarginStart(dp(4));
        tvBadge.setLayoutParams(tvBadgeLp);
        badge.addView(tvBadge);

        headerRow.addView(badge);
        card.addView(headerRow);

        TextView tvMatricula = new TextView(this);
        tvMatricula.setText("Matrícula: " + (matricula.isEmpty() ? "-" : matricula));
        tvMatricula.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvMatricula.setTextSize(12);
        LinearLayout.LayoutParams tvMatriculaLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tvMatriculaLp.topMargin = dp(4);
        tvMatricula.setLayoutParams(tvMatriculaLp);
        card.addView(tvMatricula);

        TextView tvMascotasLabel = new TextView(this);
        tvMascotasLabel.setText(R.string.mascotas_asociadas_label);
        tvMascotasLabel.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvMascotasLabel.setTextSize(12);
        LinearLayout.LayoutParams tvMascotasLabelLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tvMascotasLabelLp.topMargin = dp(8);
        tvMascotasLabel.setLayoutParams(tvMascotasLabelLp);
        card.addView(tvMascotasLabel);

        TextView tvMascotas = new TextView(this);
        tvMascotas.setText("-");
        tvMascotas.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvMascotas.setTextSize(13);
        card.addView(tvMascotas);

        int insertIndex = Math.max(0, listaVeterinarios.getChildCount() - 1);
        listaVeterinarios.addView(card, insertIndex);

        Toast.makeText(this, nombre + " agregado", Toast.LENGTH_SHORT).show();
    }
}