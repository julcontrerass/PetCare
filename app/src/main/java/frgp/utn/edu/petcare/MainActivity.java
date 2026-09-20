package frgp.utn.edu.petcare;

import android.os.Bundle;
import android.widget.Button;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        seedEventosDemoSiNecesario();
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        android.view.View mainRoot = findViewById(R.id.main);
        ViewCompat.setOnApplyWindowInsetsListener(mainRoot, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(mainRoot);

        Button btnIniciarSesion = findViewById(R.id.button);
        btnIniciarSesion.setOnClickListener(v -> {
            setContentView(R.layout.iniciar_sesion);
            android.view.View loginRoot = findViewById(R.id.loginRoot);
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

    private void showHomeView() {
        ensureAppBaseSet();
        android.view.ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.home_dueno, container, true);

        highlightNavItem(R.id.nav_home);
        
        android.view.View ivHomeProfile = findViewById(R.id.iv_home_profile);
        if (ivHomeProfile != null) {
            ivHomeProfile.setOnClickListener(v -> {
                showProfileView();
            });
        }

        android.view.View petMilo = findViewById(R.id.pet_milo);
        if (petMilo != null) {
            petMilo.setOnClickListener(v -> showPetDetailView());
        }

        android.view.View btnAddPetHome = findViewById(R.id.btnAddPetHome);
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
            
            android.view.View statusBarSpacer = findViewById(R.id.status_bar_spacer);
            android.view.View bottomNav = findViewById(R.id.bottom_navigation_container);
            android.view.View mainBaseLayout = findViewById(R.id.main_base_layout);

            if (statusBarSpacer != null || bottomNav != null) {
                ViewCompat.setOnApplyWindowInsetsListener(mainBaseLayout, (v, insets) -> {
                    Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());

                    if (statusBarSpacer != null) {
                        android.view.ViewGroup.LayoutParams lp = statusBarSpacer.getLayoutParams();
                        lp.height = systemBars.top;
                        statusBarSpacer.setLayoutParams(lp);
                    }

                    if (bottomNav != null) {
                        bottomNav.setPadding(0, 0, 0, systemBars.bottom);
                        android.view.ViewGroup.LayoutParams lp = bottomNav.getLayoutParams();
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
        android.view.ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.detalle_de_mascota, container, true);

        // Pet detail is a sub-view, maybe highlight "Mascotas" or none
        highlightNavItem(R.id.nav_mascotas);
        setupPetDetailTabs();

        android.view.View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showHomeView());
        }
    }

    private void setupPetDetailTabs() {
        android.view.View layoutInformacion = findViewById(R.id.layout_informacion);
        android.view.View layoutHistorial = findViewById(R.id.layout_historial);
        android.view.View layoutRecordatorios = findViewById(R.id.layout_recordatorios);

        android.view.View btnInformacion = findViewById(R.id.button7);
        android.view.View btnHistorial = findViewById(R.id.button8);
        android.view.View btnRecordatorios = findViewById(R.id.button9);

        if (btnInformacion != null && layoutInformacion != null) {
            btnInformacion.setOnClickListener(v -> {
                layoutInformacion.setVisibility(android.view.View.VISIBLE);
                layoutHistorial.setVisibility(android.view.View.GONE);
                layoutRecordatorios.setVisibility(android.view.View.GONE);
            });
        }

        if (btnHistorial != null && layoutHistorial != null) {
            btnHistorial.setOnClickListener(v -> {
                layoutInformacion.setVisibility(android.view.View.GONE);
                layoutHistorial.setVisibility(android.view.View.VISIBLE);
                layoutRecordatorios.setVisibility(android.view.View.GONE);
            });
        }

        if (btnRecordatorios != null && layoutRecordatorios != null) {
            btnRecordatorios.setOnClickListener(v -> {
                layoutInformacion.setVisibility(android.view.View.GONE);
                layoutHistorial.setVisibility(android.view.View.GONE);
                layoutRecordatorios.setVisibility(android.view.View.VISIBLE);
            });
        }

        android.view.View layoutProximos = findViewById(R.id.layout_recordatorios_proximos);
        android.view.View layoutCompletados = findViewById(R.id.layout_recordatorios_completados);
        android.view.View btnProximos = findViewById(R.id.btn_proximos);
        android.view.View btnCompletados = findViewById(R.id.btn_completados);

        if (btnProximos != null && layoutProximos != null) {
            btnProximos.setOnClickListener(v -> {
                layoutProximos.setVisibility(android.view.View.VISIBLE);
                layoutCompletados.setVisibility(android.view.View.GONE);
            });
        }

        if (btnCompletados != null && layoutCompletados != null) {
            btnCompletados.setOnClickListener(v -> {
                layoutProximos.setVisibility(android.view.View.GONE);
                layoutCompletados.setVisibility(android.view.View.VISIBLE);
            });
        }
    }

    private void showProfileView() {
        ensureAppBaseSet();
        inicializarPerfilSiNecesario();
        android.view.ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.mi_perfil, container, true);

        highlightNavItem(R.id.nav_mas);

        android.widget.TextView tvUserName = findViewById(R.id.tvUserName);
        if (tvUserName != null) tvUserName.setText(nombreUsuario);
        android.widget.TextView tvUserEmailValue = findViewById(R.id.tvUserEmailValue);
        if (tvUserEmailValue != null) tvUserEmailValue.setText(emailUsuario);
        android.widget.TextView tvUserPhoneValue = findViewById(R.id.tvUserPhoneValue);
        if (tvUserPhoneValue != null) tvUserPhoneValue.setText(telefonoUsuario);
        android.widget.TextView tvUserAddressValue = findViewById(R.id.tvUserAddressValue);
        if (tvUserAddressValue != null) tvUserAddressValue.setText(direccionUsuario);

        android.view.View llVeterinarios = findViewById(R.id.llVeterinarios);
        if (llVeterinarios != null) {
            llVeterinarios.setOnClickListener(v -> showVeterinariosView());
        }

        android.view.View llEditarDatos = findViewById(R.id.llEditarDatos);
        if (llEditarDatos != null) {
            llEditarDatos.setOnClickListener(v -> showEditarPerfilView());
        }
    }

    private void showEditarPerfilView() {
        ensureAppBaseSet();
        android.view.ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.editar_perfil, container, true);

        android.widget.EditText etNombreCompleto = findViewById(R.id.etNombreCompleto);
        android.widget.EditText etCorreo = findViewById(R.id.etCorreo);
        android.widget.EditText etTelefono = findViewById(R.id.etTelefono);
        android.widget.EditText etDireccion = findViewById(R.id.etDireccion);

        if (etNombreCompleto != null) etNombreCompleto.setText(nombreUsuario);
        if (etCorreo != null) etCorreo.setText(emailUsuario);
        if (etTelefono != null) etTelefono.setText(telefonoUsuario);
        if (etDireccion != null) etDireccion.setText(direccionUsuario);

        android.view.View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showProfileView());
        }

        android.view.View btnGuardarPerfil = findViewById(R.id.btnGuardarPerfil);
        if (btnGuardarPerfil != null) {
            btnGuardarPerfil.setOnClickListener(v -> {
                bounceView(v);
                String nombre = etNombreCompleto != null ? etNombreCompleto.getText().toString().trim() : "";
                String correo = etCorreo != null ? etCorreo.getText().toString().trim() : "";
                String telefono = etTelefono != null ? etTelefono.getText().toString().trim() : "";
                String direccion = etDireccion != null ? etDireccion.getText().toString().trim() : "";

                if (nombre.isEmpty() || correo.isEmpty()) {
                    android.widget.Toast.makeText(this, "Completá al menos el nombre y el correo", android.widget.Toast.LENGTH_SHORT).show();
                    return;
                }

                nombreUsuario = nombre;
                emailUsuario = correo;
                telefonoUsuario = telefono;
                direccionUsuario = direccion;

                android.widget.Toast.makeText(this, R.string.perfil_actualizado_msg, android.widget.Toast.LENGTH_SHORT).show();
                showProfileView();
            });
        }
    }

    private void showPetsView() {
        ensureAppBaseSet();
        android.view.ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.mis_mascotas, container, true);

        highlightNavItem(R.id.nav_mascotas);
        
        android.view.View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showHomeView());
        }

        android.view.View btnAddPet = findViewById(R.id.btnAddPet);
        if (btnAddPet != null) {
            btnAddPet.setOnClickListener(v -> {
                bounceView(v);
                showNuevaMascotaView();
            });
        }

        android.view.View layoutPet1 = findViewById(R.id.layout_pet_1);
        if (layoutPet1 != null) {
            layoutPet1.setOnClickListener(v -> showPetDetailView());
        }
        android.view.View layoutPet2 = findViewById(R.id.layout_pet_2);
        if (layoutPet2 != null) {
            layoutPet2.setOnClickListener(v -> showPetDetailView());
        }
        android.view.View layoutPet3 = findViewById(R.id.layout_pet_3);
        if (layoutPet3 != null) {
            layoutPet3.setOnClickListener(v -> showPetDetailView());
        }

        android.widget.LinearLayout listaMascotasContainer = findViewById(R.id.listaMascotasContainer);
        if (listaMascotasContainer != null) {
            for (Mascota m : mascotasNuevas) {
                listaMascotasContainer.addView(buildMascotaCard(m));
            }
        }
    }

    private android.view.View buildMascotaCard(Mascota m) {
        androidx.cardview.widget.CardView card = new androidx.cardview.widget.CardView(this);
        android.widget.LinearLayout.LayoutParams cardLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(12);
        card.setLayoutParams(cardLp);
        card.setRadius(dp(12));
        card.setCardElevation(dp(2));
        card.setUseCompatPadding(true);

        android.widget.LinearLayout inner = new android.widget.LinearLayout(this);
        inner.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        inner.setGravity(android.view.Gravity.CENTER_VERTICAL);
        inner.setPadding(dp(12), dp(12), dp(12), dp(12));

        if (m.fotoUri != null) {
            com.google.android.material.imageview.ShapeableImageView ivFoto =
                    new com.google.android.material.imageview.ShapeableImageView(this);
            ivFoto.setLayoutParams(new android.widget.LinearLayout.LayoutParams(dp(56), dp(56)));
            ivFoto.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);
            ivFoto.setShapeAppearanceModel(ivFoto.getShapeAppearanceModel().toBuilder()
                    .setAllCornerSizes(new com.google.android.material.shape.RelativeCornerSize(0.5f))
                    .build());
            ivFoto.setImageURI(m.fotoUri);
            inner.addView(ivFoto);
        } else {
            android.widget.FrameLayout iconCircle = new android.widget.FrameLayout(this);
            iconCircle.setLayoutParams(new android.widget.LinearLayout.LayoutParams(dp(56), dp(56)));
            iconCircle.setBackgroundResource(R.drawable.bg_icon_teal);
            android.widget.ImageView icon = new android.widget.ImageView(this);
            android.widget.FrameLayout.LayoutParams iconLp = new android.widget.FrameLayout.LayoutParams(dp(28), dp(28));
            iconLp.gravity = android.view.Gravity.CENTER;
            icon.setLayoutParams(iconLp);
            icon.setImageResource(R.drawable.ic_dog);
            icon.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
            iconCircle.addView(icon);
            inner.addView(iconCircle);
        }

        android.widget.LinearLayout textCol = new android.widget.LinearLayout(this);
        textCol.setOrientation(android.widget.LinearLayout.VERTICAL);
        android.widget.LinearLayout.LayoutParams textColLp = new android.widget.LinearLayout.LayoutParams(
                0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        textColLp.setMarginStart(dp(16));
        textCol.setLayoutParams(textColLp);

        android.widget.TextView tvNombre = new android.widget.TextView(this);
        tvNombre.setText(m.nombre);
        tvNombre.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvNombre.setTextSize(16);
        tvNombre.setTypeface(tvNombre.getTypeface(), android.graphics.Typeface.BOLD);
        textCol.addView(tvNombre);

        android.widget.TextView tvRaza = new android.widget.TextView(this);
        tvRaza.setText(m.tipo + " - " + m.raza);
        tvRaza.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvRaza.setTextSize(13);
        android.widget.LinearLayout.LayoutParams razaLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        razaLp.topMargin = dp(2);
        tvRaza.setLayoutParams(razaLp);
        textCol.addView(tvRaza);

        android.widget.TextView tvFecha = new android.widget.TextView(this);
        tvFecha.setText(m.fechaNacimiento);
        tvFecha.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvFecha.setTextSize(12);
        android.widget.LinearLayout.LayoutParams fechaLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
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
        android.view.ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.nueva_mascota, container, true);

        android.widget.EditText etNombreMascota = findViewById(R.id.etNombreMascota);
        android.widget.EditText etRaza = findViewById(R.id.etRaza);
        android.widget.EditText etFechaNacimiento = findViewById(R.id.etFechaNacimiento);

        setupTipoMascotaOption(R.id.optTipoPerro, getString(R.string.tipo_perro));
        setupTipoMascotaOption(R.id.optTipoGato, getString(R.string.tipo_gato));
        setupTipoMascotaOption(R.id.optTipoOtro, getString(R.string.tipo_otro));

        android.view.View ivFotoMascota = findViewById(R.id.ivFotoMascota);
        android.view.View btnSeleccionarFoto = findViewById(R.id.btnSeleccionarFoto);
        android.view.View.OnClickListener seleccionarFotoListener = v -> {
            bounceView(v);
            pickFotoMascotaLauncher.launch("image/*");
        };
        if (ivFotoMascota != null) ivFotoMascota.setOnClickListener(seleccionarFotoListener);
        if (btnSeleccionarFoto != null) btnSeleccionarFoto.setOnClickListener(seleccionarFotoListener);

        android.view.View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showPetsView());
        }

        android.view.View btnGuardarMascota = findViewById(R.id.btnGuardarMascota);
        if (btnGuardarMascota != null) {
            btnGuardarMascota.setOnClickListener(v -> {
                bounceView(v);
                String nombre = etNombreMascota != null ? etNombreMascota.getText().toString().trim() : "";
                String raza = etRaza != null ? etRaza.getText().toString().trim() : "";
                String fecha = etFechaNacimiento != null ? etFechaNacimiento.getText().toString().trim() : "";

                if (nombre.isEmpty()) {
                    android.widget.Toast.makeText(this, "Ingresá el nombre de la mascota", android.widget.Toast.LENGTH_SHORT).show();
                    return;
                }
                if (tipoMascotaNueva == null) {
                    android.widget.Toast.makeText(this, "Seleccioná el tipo de mascota", android.widget.Toast.LENGTH_SHORT).show();
                    return;
                }

                mascotasNuevas.add(new Mascota(nombre, tipoMascotaNueva,
                        raza.isEmpty() ? tipoMascotaNueva : raza, fecha.isEmpty() ? "-" : fecha, fotoMascotaNuevaUri));

                android.widget.Toast.makeText(this, R.string.mascota_agregada_msg, android.widget.Toast.LENGTH_SHORT).show();
                showPetsView();
            });
        }
    }

    private void setupTipoMascotaOption(int viewId, String tipo) {
        android.widget.TextView opt = findViewById(viewId);
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
            android.widget.TextView opt = findViewById(ids[i]);
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
        android.view.View navHome = findViewById(R.id.nav_home);
        android.view.View navMascotas = findViewById(R.id.nav_mascotas);
        android.view.View navLista = findViewById(R.id.nav_lista);
        android.view.View navMas = findViewById(R.id.nav_mas);
        android.view.View fabAdd = findViewById(R.id.fab_add);

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
            android.view.View container = findViewById(navIds[i]);
            android.widget.ImageView icon = findViewById(iconIds[i]);
            android.widget.TextView text = findViewById(textIds[i]);

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

    private final java.util.List<Veterinario> veterinariosDemo = java.util.Arrays.asList(
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
        android.net.Uri fotoUri;

        Mascota(String nombre, String tipo, String raza, String fechaNacimiento, android.net.Uri fotoUri) {
            this.nombre = nombre;
            this.tipo = tipo;
            this.raza = raza;
            this.fechaNacimiento = fechaNacimiento;
            this.fotoUri = fotoUri;
        }
    }

    private final java.util.List<Mascota> mascotasNuevas = new java.util.ArrayList<>();
    private String tipoMascotaNueva = null;
    private android.net.Uri fotoMascotaNuevaUri = null;

    private final androidx.activity.result.ActivityResultLauncher<String> pickFotoMascotaLauncher =
            registerForActivityResult(new androidx.activity.result.contract.ActivityResultContracts.GetContent(), uri -> {
                if (uri == null) return;
                fotoMascotaNuevaUri = uri;
                com.google.android.material.imageview.ShapeableImageView ivFotoMascota = findViewById(R.id.ivFotoMascota);
                if (ivFotoMascota != null) {
                    ivFotoMascota.setPadding(0, 0, 0, 0);
                    ivFotoMascota.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);
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

    private final java.util.Map<String, java.util.List<EventoMascota>> eventosPorFecha = new java.util.HashMap<>();
    private boolean eventosDemoSeeded = false;

    private java.time.YearMonth mesCalendarioActual = java.time.YearMonth.of(2026, 5);
    private java.time.LocalDate diaSeleccionado = java.time.LocalDate.of(2026, 5, 15);
    private java.time.LocalDate fechaEventoNuevo = java.time.LocalDate.of(2026, 5, 15);
    private java.time.YearMonth mesEventoNuevo = java.time.YearMonth.of(2026, 5);

    private int stepperActual = 1;
    private String categoriaNuevoEvento = null;
    private String mascotaNuevoEvento = null;
    private String veterinarioNuevoEvento = null;
    private String horaNuevoEvento = "11:00";
    private String observacionesNuevoEvento = "";

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }

    private String dateKey(java.time.LocalDate fecha) {
        return fecha.toString();
    }

    private void agregarEvento(java.time.LocalDate fecha, String categoria, String mascota, String veterinario, String hora, String observaciones) {
        String key = dateKey(fecha);
        java.util.List<EventoMascota> lista = eventosPorFecha.get(key);
        if (lista == null) {
            lista = new java.util.ArrayList<>();
            eventosPorFecha.put(key, lista);
        }
        lista.add(new EventoMascota(categoria, mascota, veterinario, hora, observaciones));
    }

    private void seedEventosDemoSiNecesario() {
        if (eventosDemoSeeded) return;
        eventosDemoSeeded = true;
        agregarEvento(java.time.LocalDate.of(2026, 5, 15), "Vacuna", "Koda", "Dr. Alejandro Ramírez", "11:00", "");
        agregarEvento(java.time.LocalDate.of(2026, 5, 15), "Control", "Mika", "Dra. Carla Méndez", "11:00", "");
        agregarEvento(java.time.LocalDate.of(2026, 5, 20), "Cirugía", "Milo", "Dr. Ricardo Soto", "09:00", "");
        agregarEvento(java.time.LocalDate.of(2026, 5, 20), "Vacuna", "Luna", "Dra. Sofía Fernández", "14:00", "");
        agregarEvento(java.time.LocalDate.of(2026, 5, 22), "Control", "Koda", "Dra. Carla Méndez", "16:00", "");
        agregarEvento(java.time.LocalDate.of(2026, 5, 28), "Estudio / Tratamiento", "Mika", "Dra. Valentina Ríos", "10:00", "");
        agregarEvento(java.time.LocalDate.of(2026, 5, 28), "Vacuna", "Milo", "Dr. Alejandro Ramírez", "13:00", "");
    }

    private void showCalendarView() {
        ensureAppBaseSet();
        android.view.ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.calendario, container, true);

        highlightNavItem(R.id.nav_lista);

        android.view.View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showHomeView());
        }

        android.view.View btnAgregarEvento = findViewById(R.id.btnAgregarEvento);
        if (btnAgregarEvento != null) {
            btnAgregarEvento.setOnClickListener(v -> showNuevoEventoView(diaSeleccionado));
        }

        android.view.View btnMesAnterior = findViewById(R.id.btnMesAnterior);
        if (btnMesAnterior != null) {
            btnMesAnterior.setOnClickListener(v -> {
                mesCalendarioActual = mesCalendarioActual.minusMonths(1);
                renderCalendario();
            });
        }

        android.view.View btnMesSiguiente = findViewById(R.id.btnMesSiguiente);
        if (btnMesSiguiente != null) {
            btnMesSiguiente.setOnClickListener(v -> {
                mesCalendarioActual = mesCalendarioActual.plusMonths(1);
                renderCalendario();
            });
        }

        renderCalendario();
    }

    private void renderCalendario() {
        android.widget.TextView tvMesAno = findViewById(R.id.tvMesAno);
        if (tvMesAno != null) {
            tvMesAno.setText(MESES[mesCalendarioActual.getMonthValue() - 1] + " " + mesCalendarioActual.getYear());
        }

        android.widget.GridLayout grid = findViewById(R.id.gridCalendario);
        if (grid != null) {
            grid.removeAllViews();

            java.time.LocalDate primerDia = mesCalendarioActual.atDay(1);
            int diasEnMes = mesCalendarioActual.lengthOfMonth();
            int primerDiaSemana = primerDia.getDayOfWeek().getValue(); // 1=Lunes .. 7=Domingo

            for (int i = 0; i < primerDiaSemana - 1; i++) {
                android.widget.TextView empty = new android.widget.TextView(this);
                android.widget.GridLayout.LayoutParams lp = new android.widget.GridLayout.LayoutParams();
                lp.width = 0;
                lp.height = dp(40);
                lp.columnSpec = android.widget.GridLayout.spec(android.widget.GridLayout.UNDEFINED, 1f);
                empty.setLayoutParams(lp);
                grid.addView(empty);
            }

            for (int dia = 1; dia <= diasEnMes; dia++) {
                java.time.LocalDate fecha = mesCalendarioActual.atDay(dia);
                grid.addView(buildCalendarDayCell(fecha, dia));
            }
        }

        renderEventosDia();
    }

    private android.widget.FrameLayout buildCalendarDayCell(java.time.LocalDate fecha, int dia) {
        android.widget.FrameLayout cell = new android.widget.FrameLayout(this);
        android.widget.GridLayout.LayoutParams lp = new android.widget.GridLayout.LayoutParams();
        lp.width = 0;
        lp.height = dp(40);
        lp.columnSpec = android.widget.GridLayout.spec(android.widget.GridLayout.UNDEFINED, 1f);
        lp.setMargins(dp(2), dp(2), dp(2), dp(2));
        cell.setLayoutParams(lp);

        boolean seleccionado = fecha.equals(diaSeleccionado);
        if (seleccionado) {
            cell.setBackgroundResource(R.drawable.bg_day_selected);
        }

        android.widget.TextView tvDia = new android.widget.TextView(this);
        tvDia.setText(String.valueOf(dia));
        tvDia.setGravity(android.view.Gravity.CENTER);
        android.widget.FrameLayout.LayoutParams tvLp = new android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT, android.widget.FrameLayout.LayoutParams.MATCH_PARENT);
        tvDia.setLayoutParams(tvLp);
        tvDia.setTextColor(ContextCompat.getColor(this, seleccionado ? R.color.white : R.color.black));
        tvDia.setTextSize(13);
        cell.addView(tvDia);

        java.util.List<EventoMascota> eventos = eventosPorFecha.get(dateKey(fecha));
        if (eventos != null && !eventos.isEmpty()) {
            android.view.View dot = new android.view.View(this);
            android.widget.FrameLayout.LayoutParams dotLp = new android.widget.FrameLayout.LayoutParams(dp(5), dp(5));
            dotLp.gravity = android.view.Gravity.BOTTOM | android.view.Gravity.CENTER_HORIZONTAL;
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
        android.widget.TextView tvDiaSeleccionado = findViewById(R.id.tvDiaSeleccionado);
        android.widget.LinearLayout listaEventos = findViewById(R.id.listaEventosDia);
        android.widget.TextView tvSinEventos = findViewById(R.id.tvSinEventos);
        if (listaEventos == null) return;

        if (tvDiaSeleccionado != null) {
            tvDiaSeleccionado.setText("Eventos del " + diaSeleccionado.getDayOfMonth() + " de " + MESES[diaSeleccionado.getMonthValue() - 1]);
        }

        listaEventos.removeAllViews();
        java.util.List<EventoMascota> eventos = eventosPorFecha.get(dateKey(diaSeleccionado));

        if (eventos == null || eventos.isEmpty()) {
            if (tvSinEventos != null) tvSinEventos.setVisibility(android.view.View.VISIBLE);
            return;
        }
        if (tvSinEventos != null) tvSinEventos.setVisibility(android.view.View.GONE);

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

    private android.view.View buildEventoCard(EventoMascota evento) {
        android.widget.LinearLayout card = new android.widget.LinearLayout(this);
        card.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        card.setGravity(android.view.Gravity.CENTER_VERTICAL);
        card.setBackgroundResource(R.drawable.bg_edit_text);
        card.setPadding(dp(12), dp(12), dp(12), dp(12));
        android.widget.LinearLayout.LayoutParams cardLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(8);
        card.setLayoutParams(cardLp);

        int[] estilo = getEstiloCategoria(evento.categoria);

        android.widget.FrameLayout iconCircle = new android.widget.FrameLayout(this);
        iconCircle.setLayoutParams(new android.widget.LinearLayout.LayoutParams(dp(36), dp(36)));
        iconCircle.setBackgroundResource(estilo[1]);

        android.widget.ImageView icon = new android.widget.ImageView(this);
        android.widget.FrameLayout.LayoutParams iconInnerLp = new android.widget.FrameLayout.LayoutParams(dp(18), dp(18));
        iconInnerLp.gravity = android.view.Gravity.CENTER;
        icon.setLayoutParams(iconInnerLp);
        icon.setImageResource(estilo[0]);
        icon.setColorFilter(ContextCompat.getColor(this, estilo[2]));
        iconCircle.addView(icon);
        card.addView(iconCircle);

        android.widget.LinearLayout textCol = new android.widget.LinearLayout(this);
        textCol.setOrientation(android.widget.LinearLayout.VERTICAL);
        android.widget.LinearLayout.LayoutParams textColLp = new android.widget.LinearLayout.LayoutParams(
                0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        textColLp.setMarginStart(dp(12));
        textCol.setLayoutParams(textColLp);

        android.widget.TextView tvTitulo = new android.widget.TextView(this);
        tvTitulo.setText(evento.categoria + " - " + evento.mascota);
        tvTitulo.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvTitulo.setTextSize(14);
        tvTitulo.setTypeface(tvTitulo.getTypeface(), android.graphics.Typeface.BOLD);
        textCol.addView(tvTitulo);

        android.widget.TextView tvHora = new android.widget.TextView(this);
        tvHora.setText(evento.veterinario != null && !evento.veterinario.isEmpty()
                ? evento.hora + " · " + evento.veterinario : evento.hora);
        tvHora.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvHora.setTextSize(12);
        textCol.addView(tvHora);

        card.addView(textCol);
        return card;
    }

    private void bounceView(android.view.View v) {
        if (v == null) return;
        v.animate().cancel();
        v.setScaleX(0.92f);
        v.setScaleY(0.92f);
        v.animate().scaleX(1f).scaleY(1f).setDuration(220)
                .setInterpolator(new android.view.animation.OvershootInterpolator(4f)).start();
    }

    private void animateStepIn(android.view.View v) {
        if (v == null) return;
        v.animate().cancel();
        v.setAlpha(0f);
        v.setTranslationY(dp(16));
        v.animate().alpha(1f).translationY(0f).setDuration(280)
                .setInterpolator(new android.view.animation.DecelerateInterpolator()).start();
    }

    private void applyRippleBackground(android.view.View v) {
        if (v == null) return;
        android.util.TypedValue outValue = new android.util.TypedValue();
        getTheme().resolveAttribute(android.R.attr.selectableItemBackground, outValue, true);
        v.setBackgroundResource(outValue.resourceId);
    }

    private void showNuevoEventoView(java.time.LocalDate fecha) {
        ensureAppBaseSet();
        android.view.ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.nuevo_evento, container, true);

        highlightNavItem(-1);

        fechaEventoNuevo = fecha;
        mesEventoNuevo = java.time.YearMonth.from(fecha);
        stepperActual = 1;
        categoriaNuevoEvento = null;
        mascotaNuevoEvento = null;
        veterinarioNuevoEvento = null;
        horaNuevoEvento = "11:00";
        observacionesNuevoEvento = "";

        android.view.View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showCalendarView());
        }

        android.view.View categoriaSelector = findViewById(R.id.categoriaSelector);
        android.view.View categoriaOptions = findViewById(R.id.categoriaOptions);
        if (categoriaSelector != null && categoriaOptions != null) {
            categoriaSelector.setOnClickListener(v ->
                    categoriaOptions.setVisibility(categoriaOptions.getVisibility() == android.view.View.VISIBLE
                            ? android.view.View.GONE : android.view.View.VISIBLE));
        }

        setupCategoriaOption(R.id.optVacuna, "Vacuna");
        setupCategoriaOption(R.id.optControl, "Control");
        setupCategoriaOption(R.id.optCirugia, "Cirugía");
        setupCategoriaOption(R.id.optEstudio, "Estudio / Tratamiento");

        android.view.View mascotaSelector = findViewById(R.id.mascotaSelector);
        android.view.View mascotaOptions = findViewById(R.id.mascotaOptions);
        if (mascotaSelector != null && mascotaOptions != null) {
            mascotaSelector.setOnClickListener(v ->
                    mascotaOptions.setVisibility(mascotaOptions.getVisibility() == android.view.View.VISIBLE
                            ? android.view.View.GONE : android.view.View.VISIBLE));
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

        android.view.View btnMesAnteriorMini = findViewById(R.id.btnMesAnteriorMini);
        if (btnMesAnteriorMini != null) {
            btnMesAnteriorMini.setOnClickListener(v -> {
                mesEventoNuevo = mesEventoNuevo.minusMonths(1);
                renderCalendarioMini();
            });
        }

        android.view.View btnMesSiguienteMini = findViewById(R.id.btnMesSiguienteMini);
        if (btnMesSiguienteMini != null) {
            btnMesSiguienteMini.setOnClickListener(v -> {
                mesEventoNuevo = mesEventoNuevo.plusMonths(1);
                renderCalendarioMini();
            });
        }

        android.widget.TextView btnAtrasCancelar = findViewById(R.id.btnAtrasCancelar);
        android.widget.TextView btnSiguienteGuardar = findViewById(R.id.btnSiguienteGuardar);

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
                        android.widget.Toast.makeText(this, "Seleccioná una categoría y una mascota", android.widget.Toast.LENGTH_SHORT).show();
                        return;
                    }
                    stepperActual = 2;
                    actualizarStepperUI();
                } else if (stepperActual == 2) {
                    if (veterinarioNuevoEvento == null) {
                        android.widget.Toast.makeText(this, "Seleccioná un veterinario", android.widget.Toast.LENGTH_SHORT).show();
                        return;
                    }
                    stepperActual = 3;
                    actualizarStepperUI();
                } else if (stepperActual == 3) {
                    android.widget.EditText etObservaciones = findViewById(R.id.etObservaciones);
                    observacionesNuevoEvento = etObservaciones != null ? etObservaciones.getText().toString().trim() : "";
                    stepperActual = 4;
                    actualizarStepperUI();
                } else {
                    agregarEvento(fechaEventoNuevo, categoriaNuevoEvento, mascotaNuevoEvento, veterinarioNuevoEvento, horaNuevoEvento, observacionesNuevoEvento);
                    diaSeleccionado = fechaEventoNuevo;
                    mesCalendarioActual = java.time.YearMonth.from(fechaEventoNuevo);
                    android.widget.Toast.makeText(this, getString(R.string.btn_guardar_evento) + ": OK", android.widget.Toast.LENGTH_SHORT).show();
                    showCalendarView();
                }
            });
        }

        actualizarStepperUI();
    }

    private void setupCategoriaOption(int viewId, String categoria) {
        android.view.View opt = findViewById(viewId);
        android.widget.TextView tvCategoriaSeleccionada = findViewById(R.id.tvCategoriaSeleccionada);
        android.view.View categoriaOptions = findViewById(R.id.categoriaOptions);
        if (opt == null) return;
        applyRippleBackground(opt);
        opt.setOnClickListener(v -> {
            bounceView(v);
            categoriaNuevoEvento = categoria;
            veterinarioNuevoEvento = null;
            if (tvCategoriaSeleccionada != null) tvCategoriaSeleccionada.setText(categoria);
            if (categoriaOptions != null) categoriaOptions.setVisibility(android.view.View.GONE);
            actualizarSeleccionCategoriaUI();
        });
    }

    private void actualizarSeleccionCategoriaUI() {
        int[] ids = {R.id.optVacuna, R.id.optControl, R.id.optCirugia, R.id.optEstudio};
        String[] cats = {"Vacuna", "Control", "Cirugía", "Estudio / Tratamiento"};
        for (int i = 0; i < ids.length; i++) {
            android.view.View opt = findViewById(ids[i]);
            if (opt == null) continue;
            if (cats[i].equals(categoriaNuevoEvento)) {
                opt.setBackgroundResource(R.drawable.bg_option_selected);
            } else {
                applyRippleBackground(opt);
            }
        }
    }

    private void setupMascotaOption(int viewId, String mascota) {
        android.view.View opt = findViewById(viewId);
        android.widget.TextView tvMascotaSeleccionada = findViewById(R.id.tvMascotaSeleccionada);
        android.view.View mascotaOptions = findViewById(R.id.mascotaOptions);
        if (opt == null) return;
        applyRippleBackground(opt);
        opt.setOnClickListener(v -> {
            bounceView(v);
            mascotaNuevoEvento = mascota;
            if (tvMascotaSeleccionada != null) tvMascotaSeleccionada.setText(mascota);
            if (mascotaOptions != null) mascotaOptions.setVisibility(android.view.View.GONE);
            actualizarSeleccionMascotaUI();
        });
    }

    private void actualizarSeleccionMascotaUI() {
        int[] ids = {R.id.optKoda, R.id.optMika, R.id.optLuna, R.id.optMilo};
        String[] mascotas = {"Koda", "Mika", "Luna", "Milo"};
        for (int i = 0; i < ids.length; i++) {
            android.view.View opt = findViewById(ids[i]);
            if (opt == null) continue;
            if (mascotas[i].equals(mascotaNuevoEvento)) {
                opt.setBackgroundResource(R.drawable.bg_option_selected);
            } else {
                applyRippleBackground(opt);
            }
        }
    }

    private void renderVeterinarioOptions() {
        android.widget.LinearLayout container = findViewById(R.id.veterinarioOptionsContainer);
        android.widget.TextView tvSinVeterinarios = findViewById(R.id.tvSinVeterinarios);
        if (container == null) return;
        container.removeAllViews();

        java.util.List<Veterinario> filtrados = new java.util.ArrayList<>();
        for (Veterinario vet : veterinariosDemo) {
            if (vet.especialidad.equals(categoriaNuevoEvento)) filtrados.add(vet);
        }

        if (filtrados.isEmpty()) {
            if (tvSinVeterinarios != null) tvSinVeterinarios.setVisibility(android.view.View.VISIBLE);
            return;
        }
        if (tvSinVeterinarios != null) tvSinVeterinarios.setVisibility(android.view.View.GONE);

        for (Veterinario vet : filtrados) {
            container.addView(buildVeterinarioCard(vet));
        }
    }

    private android.view.View buildVeterinarioCard(Veterinario vet) {
        boolean seleccionado = vet.nombre.equals(veterinarioNuevoEvento);

        android.widget.LinearLayout card = new android.widget.LinearLayout(this);
        card.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        card.setGravity(android.view.Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(12), dp(12), dp(12));
        card.setBackgroundResource(seleccionado ? R.drawable.bg_option_selected : R.drawable.bg_edit_text);
        android.widget.LinearLayout.LayoutParams cardLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(8);
        card.setLayoutParams(cardLp);

        android.widget.FrameLayout iconCircle = new android.widget.FrameLayout(this);
        iconCircle.setLayoutParams(new android.widget.LinearLayout.LayoutParams(dp(36), dp(36)));
        iconCircle.setBackgroundResource(R.drawable.bg_icon_teal);
        android.widget.ImageView icon = new android.widget.ImageView(this);
        android.widget.FrameLayout.LayoutParams iconLp = new android.widget.FrameLayout.LayoutParams(dp(18), dp(18));
        iconLp.gravity = android.view.Gravity.CENTER;
        icon.setLayoutParams(iconLp);
        icon.setImageResource(R.drawable.ic_medical);
        icon.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
        iconCircle.addView(icon);
        card.addView(iconCircle);

        android.widget.LinearLayout textCol = new android.widget.LinearLayout(this);
        textCol.setOrientation(android.widget.LinearLayout.VERTICAL);
        android.widget.LinearLayout.LayoutParams textColLp = new android.widget.LinearLayout.LayoutParams(
                0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        textColLp.setMarginStart(dp(12));
        textCol.setLayoutParams(textColLp);

        android.widget.TextView tvNombre = new android.widget.TextView(this);
        tvNombre.setText(vet.nombre);
        tvNombre.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvNombre.setTextSize(14);
        tvNombre.setTypeface(tvNombre.getTypeface(), android.graphics.Typeface.BOLD);
        textCol.addView(tvNombre);

        android.widget.TextView tvMatricula = new android.widget.TextView(this);
        tvMatricula.setText(vet.especialidad + " · " + vet.matricula);
        tvMatricula.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvMatricula.setTextSize(12);
        textCol.addView(tvMatricula);

        card.addView(textCol);

        if (seleccionado) {
            android.widget.ImageView check = new android.widget.ImageView(this);
            check.setLayoutParams(new android.widget.LinearLayout.LayoutParams(dp(22), dp(22)));
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
        android.widget.TextView tvMesAnoMini = findViewById(R.id.tvMesAnoMini);
        if (tvMesAnoMini != null) {
            tvMesAnoMini.setText(MESES[mesEventoNuevo.getMonthValue() - 1] + " " + mesEventoNuevo.getYear());
        }

        android.widget.GridLayout grid = findViewById(R.id.gridCalendarioMini);
        if (grid == null) return;
        grid.removeAllViews();

        java.time.LocalDate primerDia = mesEventoNuevo.atDay(1);
        int diasEnMes = mesEventoNuevo.lengthOfMonth();
        int primerDiaSemana = primerDia.getDayOfWeek().getValue();

        for (int i = 0; i < primerDiaSemana - 1; i++) {
            android.widget.TextView empty = new android.widget.TextView(this);
            android.widget.GridLayout.LayoutParams lp = new android.widget.GridLayout.LayoutParams();
            lp.width = 0;
            lp.height = dp(36);
            lp.columnSpec = android.widget.GridLayout.spec(android.widget.GridLayout.UNDEFINED, 1f);
            empty.setLayoutParams(lp);
            grid.addView(empty);
        }

        for (int dia = 1; dia <= diasEnMes; dia++) {
            java.time.LocalDate fecha = mesEventoNuevo.atDay(dia);
            grid.addView(buildMiniDayCell(fecha, dia));
        }
    }

    private android.widget.FrameLayout buildMiniDayCell(java.time.LocalDate fecha, int dia) {
        android.widget.FrameLayout cell = new android.widget.FrameLayout(this);
        android.widget.GridLayout.LayoutParams lp = new android.widget.GridLayout.LayoutParams();
        lp.width = 0;
        lp.height = dp(36);
        lp.columnSpec = android.widget.GridLayout.spec(android.widget.GridLayout.UNDEFINED, 1f);
        lp.setMargins(dp(2), dp(2), dp(2), dp(2));
        cell.setLayoutParams(lp);

        boolean seleccionado = fecha.equals(fechaEventoNuevo);
        if (seleccionado) {
            cell.setBackgroundResource(R.drawable.bg_day_selected);
        }

        android.widget.TextView tvDia = new android.widget.TextView(this);
        tvDia.setText(String.valueOf(dia));
        tvDia.setGravity(android.view.Gravity.CENTER);
        android.widget.FrameLayout.LayoutParams tvLp = new android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT, android.widget.FrameLayout.LayoutParams.MATCH_PARENT);
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
        android.widget.TextView chip = findViewById(viewId);
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
            android.widget.TextView chip = findViewById(chipIds[i]);
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
            android.view.View content = findViewById(contentIds[i]);
            if (content == null) continue;
            boolean visible = (i + 1) == stepperActual;
            if (visible) {
                content.setVisibility(android.view.View.VISIBLE);
                animateStepIn(content);
            } else {
                content.setVisibility(android.view.View.GONE);
            }
        }

        int[] circleIds = {R.id.step1Circle, R.id.step2Circle, R.id.step3Circle, R.id.step4Circle};
        int[] labelIds = {R.id.step1Label, R.id.step2Label, R.id.step3Label, R.id.step4Label};
        for (int i = 0; i < circleIds.length; i++) {
            android.view.View circle = findViewById(circleIds[i]);
            android.widget.TextView label = findViewById(labelIds[i]);
            boolean activo = (i + 1) == stepperActual;
            boolean completado = (i + 1) < stepperActual;
            if (circle != null) circle.setBackgroundResource((activo || completado) ? R.drawable.bg_step_active : R.drawable.bg_step_inactive);
            if (label != null) label.setTextColor(ContextCompat.getColor(this, (activo || completado) ? R.color.primary_teal : R.color.text_gray));
        }

        int[] lineIds = {R.id.line1, R.id.line2, R.id.line3};
        for (int i = 0; i < lineIds.length; i++) {
            android.view.View line = findViewById(lineIds[i]);
            if (line == null) continue;
            boolean completado = (i + 1) < stepperActual;
            line.setBackgroundColor(ContextCompat.getColor(this, completado ? R.color.primary_teal : R.color.light_gray));
        }

        android.widget.TextView btnAtrasCancelar = findViewById(R.id.btnAtrasCancelar);
        android.widget.TextView btnSiguienteGuardar = findViewById(R.id.btnSiguienteGuardar);
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
        android.widget.TextView tvResumenCategoria = findViewById(R.id.tvResumenCategoria);
        android.widget.TextView tvResumenMascota = findViewById(R.id.tvResumenMascota);
        android.widget.TextView tvResumenVeterinario = findViewById(R.id.tvResumenVeterinario);
        android.widget.TextView tvResumenFecha = findViewById(R.id.tvResumenFecha);
        android.widget.TextView tvResumenHora = findViewById(R.id.tvResumenHora);
        android.widget.TextView tvResumenObservaciones = findViewById(R.id.tvResumenObservaciones);

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
        android.view.ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.veterinarios_autorizados, container, true);

        highlightNavItem(-1);

        android.view.View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showProfileView());
        }

        android.widget.EditText etBuscar = findViewById(R.id.etBuscar);
        if (etBuscar != null) {
            etBuscar.addTextChangedListener(new android.text.TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) {
                    filtrarVeterinarios(s.toString());
                }

                @Override
                public void afterTextChanged(android.text.Editable s) {}
            });
        }

        android.view.View btnAgregarVeterinario = findViewById(R.id.btnAgregarVeterinario);
        if (btnAgregarVeterinario != null) {
            btnAgregarVeterinario.setOnClickListener(v -> mostrarDialogoNuevoVeterinario());
        }
    }

    private void filtrarVeterinarios(String query) {
        android.widget.LinearLayout listaVeterinarios = findViewById(R.id.listaVeterinarios);
        android.widget.TextView tvSinResultados = findViewById(R.id.tvSinResultados);
        if (listaVeterinarios == null) return;

        String q = query.trim().toLowerCase(java.util.Locale.getDefault());
        boolean algunoVisible = false;

        for (int i = 0; i < listaVeterinarios.getChildCount(); i++) {
            android.view.View child = listaVeterinarios.getChildAt(i);
            Object tag = child.getTag();
            if (tag == null) continue;
            boolean visible = q.isEmpty() || tag.toString().toLowerCase(java.util.Locale.getDefault()).contains(q);
            child.setVisibility(visible ? android.view.View.VISIBLE : android.view.View.GONE);
            if (visible) algunoVisible = true;
        }

        if (tvSinResultados != null) {
            tvSinResultados.setVisibility(algunoVisible ? android.view.View.GONE : android.view.View.VISIBLE);
        }
    }

    private void mostrarDialogoNuevoVeterinario() {
        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        int padding = dp(20);
        layout.setPadding(padding, padding, padding, padding);

        final android.widget.EditText etNombre = new android.widget.EditText(this);
        etNombre.setHint(getString(R.string.hint_nombre_veterinario));
        layout.addView(etNombre);

        final android.widget.EditText etMatricula = new android.widget.EditText(this);
        etMatricula.setHint(getString(R.string.hint_matricula));
        android.widget.LinearLayout.LayoutParams lpMatricula = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        lpMatricula.topMargin = dp(8);
        etMatricula.setLayoutParams(lpMatricula);
        layout.addView(etMatricula);

        new androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle(R.string.dialog_nuevo_veterinario)
                .setView(layout)
                .setPositiveButton(R.string.btn_agregar, (dialog, which) -> {
                    String nombre = etNombre.getText().toString().trim();
                    String matricula = etMatricula.getText().toString().trim();
                    if (nombre.isEmpty()) {
                        android.widget.Toast.makeText(this, getString(R.string.hint_nombre_veterinario), android.widget.Toast.LENGTH_SHORT).show();
                        return;
                    }
                    agregarVeterinarioALista(nombre, matricula);
                })
                .setNegativeButton(R.string.btn_cancelar, null)
                .show();
    }

    private void agregarVeterinarioALista(String nombre, String matricula) {
        android.widget.LinearLayout listaVeterinarios = findViewById(R.id.listaVeterinarios);
        if (listaVeterinarios == null) return;

        android.widget.LinearLayout card = new android.widget.LinearLayout(this);
        card.setOrientation(android.widget.LinearLayout.VERTICAL);
        card.setBackgroundResource(R.drawable.bg_edit_text);
        card.setPadding(dp(14), dp(14), dp(14), dp(14));
        card.setTag(nombre);
        android.widget.LinearLayout.LayoutParams cardLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.topMargin = dp(12);
        card.setLayoutParams(cardLp);

        android.widget.LinearLayout headerRow = new android.widget.LinearLayout(this);
        headerRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        headerRow.setGravity(android.view.Gravity.CENTER_VERTICAL);

        android.widget.TextView tvNombre = new android.widget.TextView(this);
        tvNombre.setText(nombre);
        tvNombre.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvNombre.setTextSize(15);
        tvNombre.setTypeface(tvNombre.getTypeface(), android.graphics.Typeface.BOLD);
        tvNombre.setLayoutParams(new android.widget.LinearLayout.LayoutParams(
                0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        headerRow.addView(tvNombre);

        android.widget.LinearLayout badge = new android.widget.LinearLayout(this);
        badge.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        badge.setGravity(android.view.Gravity.CENTER_VERTICAL);
        badge.setBackgroundResource(R.drawable.bg_badge_orange);
        badge.setPadding(dp(8), dp(4), dp(8), dp(4));

        android.widget.ImageView badgeIcon = new android.widget.ImageView(this);
        badgeIcon.setLayoutParams(new android.widget.LinearLayout.LayoutParams(dp(12), dp(12)));
        badgeIcon.setImageResource(R.drawable.ic_clock);
        badgeIcon.setColorFilter(ContextCompat.getColor(this, R.color.accent_orange));
        badge.addView(badgeIcon);

        android.widget.TextView tvBadge = new android.widget.TextView(this);
        tvBadge.setText(getString(R.string.estado_pendiente));
        tvBadge.setTextColor(ContextCompat.getColor(this, R.color.accent_orange));
        tvBadge.setTextSize(11);
        tvBadge.setTypeface(tvBadge.getTypeface(), android.graphics.Typeface.BOLD);
        android.widget.LinearLayout.LayoutParams tvBadgeLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        tvBadgeLp.setMarginStart(dp(4));
        tvBadge.setLayoutParams(tvBadgeLp);
        badge.addView(tvBadge);

        headerRow.addView(badge);
        card.addView(headerRow);

        android.widget.TextView tvMatricula = new android.widget.TextView(this);
        tvMatricula.setText("Matrícula: " + (matricula.isEmpty() ? "-" : matricula));
        tvMatricula.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvMatricula.setTextSize(12);
        android.widget.LinearLayout.LayoutParams tvMatriculaLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        tvMatriculaLp.topMargin = dp(4);
        tvMatricula.setLayoutParams(tvMatriculaLp);
        card.addView(tvMatricula);

        android.widget.TextView tvMascotasLabel = new android.widget.TextView(this);
        tvMascotasLabel.setText(R.string.mascotas_asociadas_label);
        tvMascotasLabel.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvMascotasLabel.setTextSize(12);
        android.widget.LinearLayout.LayoutParams tvMascotasLabelLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        tvMascotasLabelLp.topMargin = dp(8);
        tvMascotasLabel.setLayoutParams(tvMascotasLabelLp);
        card.addView(tvMascotasLabel);

        android.widget.TextView tvMascotas = new android.widget.TextView(this);
        tvMascotas.setText("-");
        tvMascotas.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvMascotas.setTextSize(13);
        card.addView(tvMascotas);

        int insertIndex = Math.max(0, listaVeterinarios.getChildCount() - 1);
        listaVeterinarios.addView(card, insertIndex);

        android.widget.Toast.makeText(this, nombre + " agregado", android.widget.Toast.LENGTH_SHORT).show();
    }
}