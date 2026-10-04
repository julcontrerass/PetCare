package frgp.utn.edu.petcare;

import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.ArrayAdapter;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.Spinner;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.RelativeLayout;
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

import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.imageview.ShapeableImageView;
import com.google.android.material.shape.RelativeCornerSize;
import com.google.android.material.tabs.TabLayout;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import kotlin.Unit;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
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
        mostrarPantallaInicial();
    }

    private void mostrarPantallaInicial() {
        setContentView(R.layout.activity_main);
        View mainRoot = findViewById(R.id.main);
        if (mainRoot != null) {
            ViewCompat.setOnApplyWindowInsetsListener(mainRoot, (v, insets) -> {
                Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
                return insets;
            });
            ViewCompat.requestApplyInsets(mainRoot);
        }

        Button btnCrearCuenta = findViewById(R.id.button2);
        if (btnCrearCuenta != null) {
            btnCrearCuenta.setOnClickListener(v -> mostrarRegistro());
        }

        Button btnIniciarSesion = findViewById(R.id.button);
        btnIniciarSesion.setOnClickListener(v -> mostrarLogin());
    }

    private void aplicarInsets(View root) {
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(root);
    }

    // Cuentas creadas en esta sesión (demo, sin backend): correo -> es veterinario
    private final Map<String, Boolean> cuentasDemo = new HashMap<>();
    private final Map<String, String> passwordsDemo = new HashMap<>();

    private void mostrarLogin() {
        setContentView(R.layout.iniciar_sesion);
        aplicarInsets(findViewById(R.id.loginRoot));

        // Selector de rol (dueño / veterinario)
        rolVeterinarioSeleccionado = false;
        MaterialButton btnRoleDueno = findViewById(R.id.btnRoleDueno);
        MaterialButton btnRoleVeterinario = findViewById(R.id.btnRoleVeterinario);
        if (btnRoleDueno != null && btnRoleVeterinario != null) {
            actualizarSelectorRol(btnRoleDueno, btnRoleVeterinario);
            btnRoleDueno.setOnClickListener(v2 -> {
                rolVeterinarioSeleccionado = false;
                actualizarSelectorRol(btnRoleDueno, btnRoleVeterinario);
            });
            btnRoleVeterinario.setOnClickListener(v2 -> {
                rolVeterinarioSeleccionado = true;
                actualizarSelectorRol(btnRoleDueno, btnRoleVeterinario);
            });
        }

        View tvForgotPassword = findViewById(R.id.tvForgotPassword);
        if (tvForgotPassword != null) {
            tvForgotPassword.setOnClickListener(v2 -> mostrarRecuperarPassword());
        }

        View tvSignUp = findViewById(R.id.tvSignUp);
        if (tvSignUp != null) {
            tvSignUp.setOnClickListener(v2 -> mostrarRegistro());
        }

        View btnGoogle = findViewById(R.id.btnGoogle);
        if (btnGoogle != null) {
            btnGoogle.setOnClickListener(v2 -> mostrarLoginSocial("Google"));
        }

        View btnApple = findViewById(R.id.btnApple);
        if (btnApple != null) {
            btnApple.setOnClickListener(v2 -> mostrarLoginSocial("Apple"));
        }

        // Boton de ingreso
        Button btnIngresar = findViewById(R.id.btnLogin);
        if (btnIngresar != null) {
            btnIngresar.setOnClickListener(v2 -> {
                EditText etEmail = findViewById(R.id.etEmail);
                EditText etPassword = findViewById(R.id.etPassword);
                String email = etEmail != null ? etEmail.getText().toString().trim().toLowerCase(Locale.ROOT) : "";
                String password = etPassword != null ? etPassword.getText().toString() : "";
                if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                    if (etEmail != null) etEmail.setError("Ingresá un correo válido");
                    return;
                }
                if (password.isEmpty()) {
                    if (etPassword != null) etPassword.setError("Ingresá tu contraseña");
                    return;
                }
                if (cuentasDemo.containsKey(email) && !password.equals(passwordsDemo.get(email))) {
                    if (etPassword != null) etPassword.setError("Contraseña incorrecta");
                    return;
                }
                // Si la cuenta fue creada en el registro, el rol sale de ahí
                boolean esVeterinario = cuentasDemo.containsKey(email)
                        ? cuentasDemo.get(email) : rolVeterinarioSeleccionado;
                if (esVeterinario) {
                    startActivity(new Intent(this, HomeVeterinarioActivity.class));
                } else {
                    showHomeView();
                }
            });
        }
    }

    /** Ingreso con cuenta social: sin backend, se simula la cuenta y se elige el rol. */
    private void mostrarLoginSocial(String proveedor) {
        new AlertDialog.Builder(this)
                .setTitle("Continuar con " + proveedor)
                .setMessage("Elegí cómo querés usar PetCare con esta cuenta.")
                .setPositiveButton(R.string.rol_dueno, (d, w) -> showHomeView())
                .setNegativeButton(R.string.rol_veterinario,
                        (d, w) -> startActivity(new Intent(this, HomeVeterinarioActivity.class)))
                .setNeutralButton(R.string.btn_cancelar, null)
                .show();
    }

    private boolean registroComoVeterinario = false;

    private void mostrarRegistro() {
        setContentView(R.layout.registro);
        aplicarInsets(findViewById(R.id.registroRoot));

        registroComoVeterinario = false;
        MaterialButton btnDueno = findViewById(R.id.btnRegRoleDueno);
        MaterialButton btnVet = findViewById(R.id.btnRegRoleVet);
        View llMatricula = findViewById(R.id.llMatricula);
        Runnable actualizarRol = () -> {
            MaterialButton sel = registroComoVeterinario ? btnVet : btnDueno;
            MaterialButton nosel = registroComoVeterinario ? btnDueno : btnVet;
            sel.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.primary_teal));
            sel.setTextColor(ContextCompat.getColor(this, R.color.white));
            nosel.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.light_gray));
            nosel.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
            llMatricula.setVisibility(registroComoVeterinario ? View.VISIBLE : View.GONE);
        };
        btnDueno.setOnClickListener(v -> { registroComoVeterinario = false; actualizarRol.run(); });
        btnVet.setOnClickListener(v -> { registroComoVeterinario = true; actualizarRol.run(); });
        actualizarRol.run();

        findViewById(R.id.btnBackRegistro).setOnClickListener(v -> mostrarPantallaInicial());

        EditText etNombre = findViewById(R.id.etRegNombre);
        EditText etEmail = findViewById(R.id.etRegEmail);
        EditText etMatricula = findViewById(R.id.etRegMatricula);
        EditText etPass = findViewById(R.id.etRegPassword);
        EditText etPass2 = findViewById(R.id.etRegPassword2);
        CheckBox cbTerminos = findViewById(R.id.cbTerminos);

        findViewById(R.id.btnRegistrar).setOnClickListener(v -> {
            String nombre = etNombre.getText().toString().trim();
            String email = etEmail.getText().toString().trim().toLowerCase(Locale.ROOT);
            String pass = etPass.getText().toString();
            boolean ok = true;
            if (nombre.isEmpty()) { etNombre.setError("Ingresá tu nombre"); ok = false; }
            if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                etEmail.setError("Correo inválido"); ok = false;
            } else if (cuentasDemo.containsKey(email)) {
                etEmail.setError("Ese correo ya está registrado"); ok = false;
            }
            if (registroComoVeterinario && etMatricula.getText().toString().trim().isEmpty()) {
                etMatricula.setError("Ingresá tu matrícula"); ok = false;
            }
            if (pass.length() < 6) { etPass.setError("Mínimo 6 caracteres"); ok = false; }
            if (!pass.equals(etPass2.getText().toString())) {
                etPass2.setError("Las contraseñas no coinciden"); ok = false;
            }
            if (!cbTerminos.isChecked()) {
                Toast.makeText(this, "Tenés que aceptar los términos y condiciones", Toast.LENGTH_SHORT).show();
                ok = false;
            }
            if (!ok) return;

            inicializarPerfilSiNecesario();
            cuentasDemo.put(email, registroComoVeterinario);
            passwordsDemo.put(email, pass);
            passwordUsuario = pass;
            nombreUsuario = nombre;
            emailUsuario = email;
            Toast.makeText(this, "Cuenta creada. Iniciá sesión para continuar", Toast.LENGTH_LONG).show();
            mostrarLogin();
        });
    }

    private void mostrarRecuperarPassword() {
        setContentView(R.layout.recuperar_password);
        aplicarInsets(findViewById(R.id.recuperarRoot));

        findViewById(R.id.btnBackRecuperar).setOnClickListener(v -> mostrarLogin());
        EditText etEmail = findViewById(R.id.etRecuperarEmail);
        View tvOk = findViewById(R.id.tvRecuperarOk);
        findViewById(R.id.btnEnviarRecuperar).setOnClickListener(v -> {
            String email = etEmail.getText().toString().trim();
            if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                etEmail.setError("Correo inválido");
                tvOk.setVisibility(View.GONE);
                return;
            }
            tvOk.setVisibility(View.VISIBLE);
        });
    }

    private boolean rolVeterinarioSeleccionado = false;

    private void actualizarSelectorRol(MaterialButton btnRoleDueno, MaterialButton btnRoleVeterinario) {
        MaterialButton seleccionado = rolVeterinarioSeleccionado ? btnRoleVeterinario : btnRoleDueno;
        MaterialButton noSeleccionado = rolVeterinarioSeleccionado ? btnRoleDueno : btnRoleVeterinario;
        seleccionado.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.primary_teal));
        seleccionado.setTextColor(ContextCompat.getColor(this, R.color.white));
        noSeleccionado.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.light_gray));
        noSeleccionado.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
    }

    private void cerrarSesion() {
        isAppBaseSet = false;
        currentTabPosition = 0;
        mostrarPantallaInicial();
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

        View btnNotificationsContainer = findViewById(R.id.btn_notifications_container);
        View btnNotifications = findViewById(R.id.btn_notifications);
        actualizarBadgeNotificaciones();

        View notifClickTarget = btnNotificationsContainer != null ? btnNotificationsContainer : btnNotifications;
        if (notifClickTarget != null) {
            notifClickTarget.setOnClickListener(v -> {
                bounceView(v);
                hayNotificacionesSinLeer = false;
                actualizarBadgeNotificaciones();
                showNotificationsDialog();
            });
        }

        View petLuna = findViewById(R.id.pet_luna);
        if (petLuna != null) {
            petLuna.setOnClickListener(v -> showPetDetailView(demoPorNombre("Luna")));
        }

        View petMilo = findViewById(R.id.pet_milo);
        if (petMilo != null) {
            petMilo.setOnClickListener(v -> showPetDetailView(demoPorNombre("Milo")));
        }

        ocultarMascotasEliminadas();

        View tvVerTodas = findViewById(R.id.tv_ver_todas_mascotas);
        if (tvVerTodas != null) {
            tvVerTodas.setOnClickListener(v -> showPetsView());
        }

        View btnAddPetHome = findViewById(R.id.btnAddPetHome);
        if (btnAddPetHome != null) {
            btnAddPetHome.setOnClickListener(v -> {
                bounceView(v);
                showNuevaMascotaView();
            });
        }

        LinearLayout containerMisMascotasHome = findViewById(R.id.containerMisMascotasHome);
        if (containerMisMascotasHome != null && btnAddPetHome != null) {
            int addBtnIndex = containerMisMascotasHome.indexOfChild(btnAddPetHome);
            for (Mascota m : mascotasNuevas) {
                View petView = buildMascotaHomeItem(m);
                containerMisMascotasHome.addView(petView, addBtnIndex);
                addBtnIndex++;
            }
        }

        View tvVerTodasRecordatorios = findViewById(R.id.tv_ver_todas_recordatorios);
        if (tvVerTodasRecordatorios != null) {
            tvVerTodasRecordatorios.setOnClickListener(v -> showRecordatoriosView());
        }

        LinearLayout containerRecordatoriosHome = findViewById(R.id.containerRecordatoriosHome);
        if (containerRecordatoriosHome != null) {
            containerRecordatoriosHome.removeAllViews();
            List<EventoConFecha> proximos = obtenerEventosOrdenados(true);
            int count = 0;
            for (EventoConFecha ecf : proximos) {
                if (count >= 3) break;
                containerRecordatoriosHome.addView(buildReminderHomeCard(ecf));
                count++;
            }
            if (count == 0) {
                TextView tvSinRecordatorios = new TextView(this);
                tvSinRecordatorios.setText("No hay próximos recordatorios");
                tvSinRecordatorios.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
                tvSinRecordatorios.setPadding(0, dp(8), 0, dp(8));
                containerRecordatoriosHome.addView(tvSinRecordatorios);
            }
        }

        LinearLayout containerActividadRecienteHome = findViewById(R.id.containerActividadRecienteHome);
        if (containerActividadRecienteHome != null) {
            containerActividadRecienteHome.removeAllViews();
            List<EventoConFecha> reciente = obtenerActividadReciente30Dias();
            int count = 0;
            for (EventoConFecha ecf : reciente) {
                if (count >= 5) break;
                containerActividadRecienteHome.addView(buildActividadRecienteCard(ecf));
                count++;
            }
            if (count == 0) {
                TextView tvSinActividad = new TextView(this);
                tvSinActividad.setText("No hay actividad reciente en los últimos 30 días");
                tvSinActividad.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
                tvSinActividad.setPadding(0, dp(8), 0, dp(8));
                containerActividadRecienteHome.addView(tvSinActividad);
            }
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

    private void showPetDetailView(Mascota m) {
        mascotaActual = m;
        showPetDetailView();
    }

    private void llenarDetalleMascota() {
        Mascota m = mascotaActual;
        if (m == null) return;
        setTextoSiExiste(R.id.textView9, m.nombre);
        setTextoSiExiste(R.id.textView10, m.tipoRazaTxt);
        setTextoSiExiste(R.id.textView11, m.nacSexoTxt);
        setTextoSiExiste(R.id.editTextText, m.peso);
        setTextoSiExiste(R.id.txtMicrochip, m.microchip);
        setTextoSiExiste(R.id.editTextText2, m.color);
        setTextoSiExiste(R.id.editTextText3, m.observaciones);
        ImageView iv = findViewById(R.id.imageView3);
        if (iv != null) {
            if (m.fotoUri != null) {
                iv.setImageURI(m.fotoUri);
            } else if (m.fotoRes != 0) {
                iv.setImageResource(m.fotoRes);
            } else {
                iv.setImageResource(R.drawable.ic_dog);
            }
        }
    }

    private void setTextoSiExiste(int id, String texto) {
        TextView tv = findViewById(id);
        if (tv != null) tv.setText(texto);
    }

    private void showPetDetailView() {
        if (mascotaActual == null) mascotaActual = mascotasDemo.get(0);
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.detalle_de_mascota, container, true);

        highlightNavItem(R.id.nav_mascotas);
        llenarDetalleMascota();

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

        View btnDarDeBaja = findViewById(R.id.btnDarDeBaja);
        if (btnDarDeBaja != null) {
            btnDarDeBaja.setOnClickListener(v -> mostrarDialogoDarDeBajaMascota());
        }

        View btnMore = findViewById(R.id.btnMore);
        if (btnMore != null) {
            btnMore.setOnClickListener(v -> mostrarMenuMascota(v));
        }
    }

    private Mascota mascotaActual = null;

    private void mostrarMenuMascota(View ancla) {
        PopupMenu menu = new PopupMenu(this, ancla);
        menu.getMenu().add(0, 1, 0, "Editar información");
        menu.getMenu().add(0, 2, 1, "Cambiar foto");
        menu.getMenu().add(0, 3, 2, "Agendar turno");
        menu.getMenu().add(0, 4, 3, "Eliminar mascota");
        menu.setOnMenuItemClickListener(item -> {
            switch (item.getItemId()) {
                case 1:
                    showEditPetDetailDialog();
                    break;
                case 2:
                    pickFotoDetalleLauncher.launch("image/*");
                    break;
                case 3:
                    if (mascotaActual != null) mascotaNuevoEvento = mascotaActual.nombre;
                    showNuevoEventoView(diaSeleccionado);
                    break;
                default:
                    mostrarDialogoDarDeBajaMascota();
            }
            return true;
        });
        menu.show();
    }

    /** Oculta en las listas las mascotas demo que el usuario eliminó. */
    private void ocultarMascotasEliminadas() {
        Object[][] mapa = {
                {R.id.pet_luna, "Luna"}, {R.id.pet_milo, "Milo"},
                {R.id.layout_pet_1, "Mika"}, {R.id.layout_pet_2, "Koda"}, {R.id.layout_pet_3, "Luna"}};
        for (Object[] par : mapa) {
            View v = findViewById((Integer) par[0]);
            if (v != null && mascotasEliminadas.contains((String) par[1])) v.setVisibility(View.GONE);
        }
    }

    private final ActivityResultLauncher<String> pickFotoDetalleLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri == null) return;
                if (mascotaActual != null) mascotaActual.fotoUri = uri;
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
        inputNacSexo.setHint("Fecha de nacimiento");
        if (tvBirthSex != null) inputNacSexo.setText(tvBirthSex.getText().toString());
        inputNacSexo.setLayoutParams(params);
        inputNacSexo.setFocusable(false);
        inputNacSexo.setClickable(true);
        inputNacSexo.setOnClickListener(v -> showDatePickerDialog(inputNacSexo));

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
                    if (mascotaActual != null) {
                        mascotaActual.nombre = inputNombre.getText().toString().trim();
                        mascotaActual.tipoRazaTxt = inputRaza.getText().toString();
                        mascotaActual.nacSexoTxt = inputNacSexo.getText().toString();
                        mascotaActual.peso = inputPeso.getText().toString();
                        mascotaActual.microchip = inputMicrochip.getText().toString();
                        mascotaActual.color = inputColor.getText().toString();
                        mascotaActual.observaciones = inputObs.getText().toString();
                    }
                    Toast.makeText(this, "Información actualizada", Toast.LENGTH_SHORT).show();
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void showDatePickerDialog(EditText editText) {
        Calendar calendar = Calendar.getInstance();
        int year = calendar.get(Calendar.YEAR);
        int month = calendar.get(Calendar.MONTH);
        int day = calendar.get(Calendar.DAY_OF_MONTH);

        DatePickerDialog datePickerDialog = new DatePickerDialog(
                this,
                (view, selectedYear, selectedMonth, selectedDay) -> {
                    String[] meses = {"Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"};
                    String formattedDate = String.format(Locale.getDefault(), "%02d %s %d", selectedDay, meses[selectedMonth], selectedYear);
                    String currentText = editText.getText() != null ? editText.getText().toString() : "";
                    if (currentText.contains("-")) {
                        String sexPart = currentText.substring(currentText.indexOf("-"));
                        editText.setText("Nacido el " + formattedDate + " " + sexPart);
                    } else {
                        editText.setText(formattedDate);
                    }
                },
                year, month, day
        );
        datePickerDialog.show();
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
                        switchViewWithAnimation(0, MainActivity.this::showPetDetailView);
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
                mostrarSelectorEventoParaEditar();
            });
        }
    }

    private void showRecordatoriosView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.recordatorios, container, true);

        highlightNavItem(R.id.nav_lista);

        setupRecordatoriosView();
    }

    private void setupRecordatoriosView() {
        Toolbar toolbarView = findViewById(R.id.toolbar);
        if (toolbarView != null) {
            toolbarView.setNavigationOnClickListener(v -> showHomeView());
        }

        View btnToolbarAdd = findViewById(R.id.btnToolbarAdd);
        if (btnToolbarAdd != null) {
            btnToolbarAdd.setOnClickListener(v -> {
                bounceView(v);
                showNuevoEventoView(LocalDate.now());
            });
        }

        TabLayout tabLayout = findViewById(R.id.tabLayoutRecordatorios);
        RecyclerView recyclerView = findViewById(R.id.recyclerViewRecordatorios);

        List<RecordatorioItem> proximosItems = obtenerRecordatoriosItems(true);
        List<RecordatorioItem> completadosItems = obtenerRecordatoriosItems(false);

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
                        switchViewWithAnimation(0, MainActivity.this::showPetDetailView);
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
                if (recyclerView != null) recyclerView.setAdapter(new RecordatoriosAdapter(obtenerRecordatoriosItems(true)));
            });

            btnCompletados.setOnClickListener(v -> {
                bounceView(v);
                btnCompletados.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.light_teal));
                btnCompletados.setTextColor(ContextCompat.getColor(this, R.color.primary_teal));
                btnProximos.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.light_gray));
                btnProximos.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
                if (recyclerView != null) recyclerView.setAdapter(new RecordatoriosAdapter(obtenerRecordatoriosItems(false)));
            });
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
                mostrarSelectorEventoParaEditar();
            });
        }
    }

    private void showMasView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.mas_dueno, container, true);

        highlightNavItem(R.id.nav_mas);

        findViewById(R.id.optMiPerfil).setOnClickListener(v -> showProfileView());
        findViewById(R.id.optVeterinarios).setOnClickListener(v -> showVeterinariosView());
        findViewById(R.id.optSolicitudes).setOnClickListener(v -> showSolicitudesDuenoView());
        findViewById(R.id.optSalud).setOnClickListener(v ->
                startActivity(new Intent(this, CarnetSaludActivity.class)));
        findViewById(R.id.optCalendario).setOnClickListener(v -> showCalendarView());
        findViewById(R.id.optNotificaciones).setOnClickListener(v -> {
            hayNotificacionesSinLeer = false;
            actualizarBadgeNotificaciones();
            showNotificationsDialog();
        });
        findViewById(R.id.optCerrarSesion).setOnClickListener(v -> cerrarSesion());
    }

    private void showSolicitudesDuenoView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.solicitudes_dueno, container, true);

        highlightNavItem(R.id.nav_mas);

        androidx.appcompat.widget.Toolbar toolbar = findViewById(R.id.btnBack);
        if (toolbar != null) {
            toolbar.setNavigationOnClickListener(v -> showMasView());
        }

        RecyclerView rv = findViewById(R.id.rvSolicitudesDueno);
        if (rv != null) {
            if (solicitudesDueno.isEmpty()) {
                solicitudesDueno.add(new SolicitudItem("Dra. Laura Sosa", "Solicita acceso a Koda", "Hace 2 horas", R.drawable.luna));
                solicitudesDueno.add(new SolicitudItem("Dr. Pablo Medina", "Solicita acceso a Mika", "Ayer", R.drawable.milo));
                veterinariosSolicitantes.put("Dra. Laura Sosa", new Veterinario("Dra. Laura Sosa", "Control", "MP-24680"));
                veterinariosSolicitantes.put("Dr. Pablo Medina", new Veterinario("Dr. Pablo Medina", "Vacuna", "MP-13579"));
            }
            rv.setAdapter(new SolicitudesAdapter(solicitudesDueno, (item, estado) -> {
                if (estado == SolicitudItem.Estado.ACEPTADA) {
                    Veterinario vet = veterinariosSolicitantes.get(item.getSolicitante());
                    if (vet != null && !listaVeterinariosAutorizados.contains(vet)) {
                        vet.estado = "ACTIVO";
                        vet.mascotasAsociadas = item.getMascota().replace("Solicita acceso a ", "");
                        listaVeterinariosDisponibles.remove(vet);
                        listaVeterinariosAutorizados.add(vet);
                    }
                    agregarNotificacion("Solicitud aceptada",
                            item.getSolicitante() + " ahora puede ver la ficha de tu mascota.",
                            "Ahora mismo", R.drawable.ic_check_circle);
                    Toast.makeText(this, item.getSolicitante() + " fue autorizado/a", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(this, "Solicitud rechazada", Toast.LENGTH_SHORT).show();
                }
                return Unit.INSTANCE;
            }));
        }
    }

    private void showProfileView() {
        ensureAppBaseSet();
        inicializarPerfilSiNecesario();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.mi_perfil, container, true);

        highlightNavItem(R.id.nav_mas);

        ShapeableImageView ivProfilePic = findViewById(R.id.ivProfilePic);
        if (ivProfilePic != null) {
            if (profilePhotoUri != null) {
                ivProfilePic.setImageURI(profilePhotoUri);
                ivProfilePic.setTranslationX(profileTranslationX);
                ivProfilePic.setTranslationY(profileTranslationY);
            }
            ivProfilePic.setScaleType(profileScaleType);
            ivProfilePic.setOnClickListener(v -> {
                if (profilePhotoUri == null) {
                    Toast.makeText(this, "Primero elegí una foto tocando el ícono del lápiz", Toast.LENGTH_SHORT).show();
                    return;
                }
                bounceView(v);
                showAdjustPhotoDialog(ivProfilePic);
            });
        }

        View btnEditProfilePic = findViewById(R.id.btnEditProfilePic);
        if (btnEditProfilePic != null) {
            btnEditProfilePic.setOnClickListener(v -> {
                bounceView(v);
                pickProfilePhotoLauncher.launch("image/*");
            });
        }

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

        View llCambiarContrasena = findViewById(R.id.llCambiarContrasena);
        if (llCambiarContrasena != null) {
            llCambiarContrasena.setOnClickListener(v -> mostrarDialogoCambiarPassword());
        }

        View llCerrarSesion = findViewById(R.id.llCerrarSesion);
        if (llCerrarSesion != null) {
            llCerrarSesion.setOnClickListener(v -> cerrarSesion());
        }
    }

    private void mostrarDialogoCambiarPassword() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(20), dp(16), dp(20), dp(4));
        EditText etActual = campoPassword("Contraseña actual");
        EditText etNueva = campoPassword("Nueva contraseña");
        EditText etConfirmar = campoPassword("Confirmar nueva contraseña");
        layout.addView(etActual);
        layout.addView(etNueva);
        layout.addView(etConfirmar);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Cambiar contraseña")
                .setView(layout)
                .setPositiveButton("Guardar", null)
                .setNegativeButton(R.string.btn_cancelar, null)
                .create();
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String actual = etActual.getText().toString();
            String nueva = etNueva.getText().toString();
            String error = null;
            if (actual.isEmpty()) error = "Ingresá tu contraseña actual";
            else if (passwordUsuario != null && !actual.equals(passwordUsuario)) error = "La contraseña actual es incorrecta";
            else if (nueva.length() < 6) error = "La nueva contraseña debe tener al menos 6 caracteres";
            else if (!nueva.equals(etConfirmar.getText().toString())) error = "Las contraseñas no coinciden";
            else if (nueva.equals(actual)) error = "La nueva contraseña debe ser distinta a la actual";
            if (error != null) {
                Toast.makeText(this, error, Toast.LENGTH_SHORT).show();
                return;
            }
            passwordUsuario = nueva;
            Toast.makeText(this, "Contraseña actualizada", Toast.LENGTH_SHORT).show();
            dialog.dismiss();
        }));
        dialog.show();
    }

    private EditText campoPassword(String hint) {
        EditText et = new EditText(this);
        et.setHint(hint);
        et.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(8);
        et.setLayoutParams(lp);
        return et;
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

        ocultarMascotasEliminadas();

        View layoutPet1 = findViewById(R.id.layout_pet_1);
        if (layoutPet1 != null) {
            layoutPet1.setOnClickListener(v -> showPetDetailView(demoPorNombre("Mika")));
        }
        View layoutPet2 = findViewById(R.id.layout_pet_2);
        if (layoutPet2 != null) {
            layoutPet2.setOnClickListener(v -> showPetDetailView(demoPorNombre("Koda")));
        }
        View layoutPet3 = findViewById(R.id.layout_pet_3);
        if (layoutPet3 != null) {
            layoutPet3.setOnClickListener(v -> showPetDetailView(demoPorNombre("Luna")));
        }

        LinearLayout listaMascotasContainer = findViewById(R.id.listaMascotasContainer);
        if (listaMascotasContainer != null) {
            for (Mascota m : mascotasNuevas) {
                listaMascotasContainer.addView(buildMascotaCard(m));
            }
        }
    }

    private String nombreMascotaActual() {
        return mascotaActual != null ? mascotaActual.nombre : "Koda";
    }

    private void mostrarDialogoDarDeBajaMascota() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(20);
        container.setPadding(padding, padding, padding, padding);

        TextView tvMsg = new TextView(this);
        tvMsg.setText(R.string.confirmar_baja_msg);
        tvMsg.setTextSize(14f);
        tvMsg.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        container.addView(tvMsg);

        TextView tvMotivoLabel = new TextView(this);
        tvMotivoLabel.setText(R.string.motivo_baja_label);
        tvMotivoLabel.setTextSize(14f);
        tvMotivoLabel.setTypeface(tvMotivoLabel.getTypeface(), Typeface.BOLD);
        tvMotivoLabel.setTextColor(ContextCompat.getColor(this, R.color.black));
        LinearLayout.LayoutParams lpLabel = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lpLabel.topMargin = dp(16);
        tvMotivoLabel.setLayoutParams(lpLabel);
        container.addView(tvMotivoLabel);

        final RadioGroup radioGroup = new RadioGroup(this);
        radioGroup.setOrientation(RadioGroup.VERTICAL);
        LinearLayout.LayoutParams lpRg = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lpRg.topMargin = dp(8);
        radioGroup.setLayoutParams(lpRg);

        RadioButton rbFallecimiento = new RadioButton(this);
        rbFallecimiento.setText(R.string.motivo_fallecimiento);
        rbFallecimiento.setChecked(true);
        radioGroup.addView(rbFallecimiento);

        RadioButton rbAdopcion = new RadioButton(this);
        rbAdopcion.setText(R.string.motivo_adopcion);
        radioGroup.addView(rbAdopcion);

        RadioButton rbOtro = new RadioButton(this);
        rbOtro.setText(R.string.motivo_otro);
        radioGroup.addView(rbOtro);

        container.addView(radioGroup);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(getString(R.string.confirmar_baja_title, nombreMascotaActual()))
                .setView(container)
                .setPositiveButton(R.string.btn_confirmar_baja, (d, which) -> {
                    String nombreBaja = nombreMascotaActual();
                    if (!mascotasNuevas.remove(mascotaActual)) mascotasEliminadas.add(nombreBaja);
                    mascotaActual = null;
                    agregarNotificacion("Mascota dada de baja", nombreBaja + " fue dada de baja de tus mascotas.",
                            "Ahora mismo", R.drawable.ic_dog);
                    Toast.makeText(this, R.string.mascota_dada_de_baja_msg, Toast.LENGTH_SHORT).show();
                    showPetsView();
                })
                .setNegativeButton(R.string.btn_cancelar, null)
                .create();

        dialog.show();
        Button positiveBtn = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
        if (positiveBtn != null) {
            positiveBtn.setTextColor(ContextCompat.getColor(this, R.color.danger_red));
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

        card.setOnClickListener(v -> showPetDetailView(m));
        return card;
    }

    private View buildMascotaHomeItem(Mascota m) {
        LinearLayout item = new LinearLayout(this);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.setMarginEnd(dp(16));
        item.setLayoutParams(lp);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER);
        item.setClickable(true);
        item.setFocusable(true);

        TypedValue outValue = new TypedValue();
        getTheme().resolveAttribute(android.R.attr.selectableItemBackground, outValue, true);
        item.setBackgroundResource(outValue.resourceId);

        ShapeableImageView ivFoto = new ShapeableImageView(this);
        LinearLayout.LayoutParams imgLp = new LinearLayout.LayoutParams(dp(80), dp(80));
        ivFoto.setLayoutParams(imgLp);
        ivFoto.setScaleType(ImageView.ScaleType.CENTER_CROP);
        ivFoto.setShapeAppearanceModel(ivFoto.getShapeAppearanceModel().toBuilder()
                .setAllCornerSizes(dp(20))
                .build());

        if (m.fotoUri != null) {
            ivFoto.setImageURI(m.fotoUri);
        } else {
            ivFoto.setImageResource(R.drawable.ic_dog);
            ivFoto.setBackgroundResource(R.drawable.bg_icon_teal);
            ivFoto.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
            int padding = dp(16);
            ivFoto.setPadding(padding, padding, padding, padding);
        }
        item.addView(ivFoto);

        TextView tvNombre = new TextView(this);
        LinearLayout.LayoutParams nameLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        nameLp.topMargin = dp(8);
        tvNombre.setLayoutParams(nameLp);
        tvNombre.setText(m.nombre);
        tvNombre.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvNombre.setTypeface(tvNombre.getTypeface(), Typeface.BOLD);
        item.addView(tvNombre);

        TextView tvRaza = new TextView(this);
        tvRaza.setText(m.raza != null && !m.raza.isEmpty() ? m.raza : m.tipo);
        tvRaza.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvRaza.setTextSize(12);
        tvRaza.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        item.addView(tvRaza);

        item.setOnClickListener(v -> showPetDetailView(m));

        return item;
    }

    private static class EventoConFecha implements Comparable<EventoConFecha> {
        LocalDate fecha;
        EventoMascota evento;

        EventoConFecha(LocalDate fecha, EventoMascota evento) {
            this.fecha = fecha;
            this.evento = evento;
        }

        @Override
        public int compareTo(EventoConFecha o) {
            int cmp = this.fecha.compareTo(o.fecha);
            if (cmp == 0) {
                return this.evento.hora.compareTo(o.evento.hora);
            }
            return cmp;
        }
    }

    private static final String[] MESES_CORTO = {"Ene", "Feb", "Mar", "Abr", "May", "Jun",
            "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"};

    private List<EventoConFecha> obtenerEventosOrdenados(boolean proximos) {
        seedEventosDemoSiNecesario();
        LocalDate hoy = LocalDate.now();
        LocalDate refDate = hoy.isBefore(LocalDate.of(2026, 5, 1)) ? LocalDate.of(2026, 5, 1) : hoy;

        List<EventoConFecha> list = new ArrayList<>();
        for (Map.Entry<String, List<EventoMascota>> entry : eventosPorFecha.entrySet()) {
            try {
                LocalDate fecha = LocalDate.parse(entry.getKey());
                boolean isProximo = !fecha.isBefore(refDate);
                if (isProximo == proximos) {
                    for (EventoMascota ev : entry.getValue()) {
                        list.add(new EventoConFecha(fecha, ev));
                    }
                }
            } catch (Exception ignored) {}
        }
        Collections.sort(list);
        if (!proximos) {
            Collections.reverse(list);
        }
        return list;
    }

    private List<RecordatorioItem> obtenerRecordatoriosItems(boolean proximos) {
        List<EventoConFecha> eventos = obtenerEventosOrdenados(proximos);
        List<RecordatorioItem> items = new ArrayList<>();
        LocalDate refDate = LocalDate.now().isBefore(LocalDate.of(2026, 5, 1)) ? LocalDate.of(2026, 5, 1) : LocalDate.now();

        for (EventoConFecha ecf : eventos) {
            String title = ecf.evento.categoria;
            String petName = ecf.evento.mascota;
            String dateStr = ecf.fecha.getDayOfMonth() + " " +
                    MESES_CORTO[ecf.fecha.getMonthValue() - 1] + " " +
                    ecf.fecha.getYear();

            String daysLeft;
            if (proximos) {
                long dias = ChronoUnit.DAYS.between(refDate, ecf.fecha);
                if (dias <= 0) {
                    daysLeft = "Hoy - " + ecf.evento.hora;
                } else if (dias == 1) {
                    daysLeft = "Mañana - " + ecf.evento.hora;
                } else {
                    daysLeft = "Falta " + dias + " días";
                }
            } else {
                daysLeft = "Completado";
            }

            int iconRes = getIconForCategory(ecf.evento.categoria);
            items.add(new RecordatorioItem(title, petName, dateStr, daysLeft, iconRes));
        }
        return items;
    }

    private int getIconForCategory(String categoria) {
        if (categoria == null) return R.drawable.ic_calendar;
        String catLower = categoria.toLowerCase();
        if (catLower.contains("vacuna")) return R.drawable.ic_syringe;
        if (catLower.contains("control")) return R.drawable.ic_pencil;
        if (catLower.contains("cirug")) return R.drawable.ic_cirugia;
        if (catLower.contains("estudio") || catLower.contains("tratamiento")) return R.drawable.ic_pulse;
        return R.drawable.ic_calendar;
    }

    private View buildReminderHomeCard(EventoConFecha ecf) {
        MaterialCardView card =
                new MaterialCardView(this);
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(12);
        card.setLayoutParams(cardLp);
        card.setCardBackgroundColor(ContextCompat.getColor(this, R.color.light_gray));
        card.setRadius(dp(16));
        card.setCardElevation(0);
        card.setStrokeWidth(0);

        RelativeLayout relativeLayout = new RelativeLayout(this);
        relativeLayout.setLayoutParams(new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT));
        relativeLayout.setPadding(dp(16), dp(16), dp(16), dp(16));

        int imgId = View.generateViewId();
        ShapeableImageView ivImg = new ShapeableImageView(this);
        ivImg.setId(imgId);
        RelativeLayout.LayoutParams imgLp = new RelativeLayout.LayoutParams(dp(40), dp(40));
        ivImg.setLayoutParams(imgLp);
        ivImg.setScaleType(ImageView.ScaleType.CENTER_CROP);
        ivImg.setShapeAppearanceModel(ivImg.getShapeAppearanceModel().toBuilder()
                .setAllCornerSizes(dp(12)).build());

        if ("Luna".equalsIgnoreCase(ecf.evento.mascota)) {
            ivImg.setImageResource(R.drawable.luna);
        } else if ("Milo".equalsIgnoreCase(ecf.evento.mascota)) {
            ivImg.setImageResource(R.drawable.milo);
        } else {
            Uri petFoto = null;
            for (Mascota m : mascotasNuevas) {
                if (m.nombre != null && m.nombre.equalsIgnoreCase(ecf.evento.mascota)) {
                    petFoto = m.fotoUri;
                    break;
                }
            }
            if (petFoto != null) {
                ivImg.setImageURI(petFoto);
            } else {
                ivImg.setImageResource(getIconForCategory(ecf.evento.categoria));
                ivImg.setBackgroundResource(R.drawable.bg_icon_teal);
                ivImg.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
                int p = dp(8);
                ivImg.setPadding(p, p, p, p);
            }
        }
        relativeLayout.addView(ivImg);

        int timeId = View.generateViewId();
        TextView tvTime = new TextView(this);
        tvTime.setId(timeId);
        RelativeLayout.LayoutParams timeLp = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.WRAP_CONTENT, RelativeLayout.LayoutParams.WRAP_CONTENT);
        timeLp.addRule(RelativeLayout.ALIGN_PARENT_END);
        timeLp.addRule(RelativeLayout.CENTER_VERTICAL);
        tvTime.setLayoutParams(timeLp);
        tvTime.setText(ecf.evento.hora);
        tvTime.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvTime.setTypeface(tvTime.getTypeface(), Typeface.BOLD);
        tvTime.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_clock, 0, 0, 0);
        tvTime.setCompoundDrawablePadding(dp(4));
        relativeLayout.addView(tvTime);

        LinearLayout infoCol = new LinearLayout(this);
        infoCol.setOrientation(LinearLayout.VERTICAL);
        RelativeLayout.LayoutParams infoLp = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.WRAP_CONTENT, RelativeLayout.LayoutParams.WRAP_CONTENT);
        infoLp.setMarginStart(dp(12));
        infoLp.addRule(RelativeLayout.END_OF, imgId);
        infoLp.addRule(RelativeLayout.START_OF, timeId);
        infoCol.setLayoutParams(infoLp);

        TextView tvTitle = new TextView(this);
        tvTitle.setText(ecf.evento.categoria + " (" + ecf.evento.mascota + ")");
        tvTitle.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvTitle.setTypeface(tvTitle.getTypeface(), Typeface.BOLD);
        infoCol.addView(tvTitle);

        TextView tvSub = new TextView(this);
        String dateFormatted = ecf.fecha.getDayOfMonth() + " " + MESES_CORTO[ecf.fecha.getMonthValue() - 1] + " " + ecf.fecha.getYear();
        tvSub.setText(ecf.evento.veterinario != null && !ecf.evento.veterinario.isEmpty()
                ? dateFormatted + " · " + ecf.evento.veterinario : dateFormatted);
        tvSub.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvSub.setTextSize(12);
        infoCol.addView(tvSub);

        relativeLayout.addView(infoCol);
        card.addView(relativeLayout);

        card.setOnClickListener(v -> showRecordatoriosView());
        return card;
    }

    private List<EventoConFecha> obtenerActividadReciente30Dias() {
        seedEventosDemoSiNecesario();
        LocalDate hoy = LocalDate.now();
        LocalDate refDate = hoy.isBefore(LocalDate.of(2026, 5, 1)) ? LocalDate.of(2026, 5, 15) : hoy;
        LocalDate hace30Dias = refDate.minusDays(30);

        List<EventoConFecha> list = new ArrayList<>();
        for (Map.Entry<String, List<EventoMascota>> entry : eventosPorFecha.entrySet()) {
            try {
                LocalDate fecha = LocalDate.parse(entry.getKey());
                if (!fecha.isAfter(refDate) && !fecha.isBefore(hace30Dias)) {
                    for (EventoMascota ev : entry.getValue()) {
                        list.add(new EventoConFecha(fecha, ev));
                    }
                }
            } catch (Exception ignored) {}
        }
        Collections.sort(list);
        Collections.reverse(list);
        return list;
    }

    private View buildActividadRecienteCard(EventoConFecha ecf) {
        MaterialCardView card =
                new MaterialCardView(this);
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(12);
        card.setLayoutParams(cardLp);
        card.setCardBackgroundColor(ContextCompat.getColor(this, R.color.light_gray));
        card.setRadius(dp(16));
        card.setCardElevation(0);
        card.setStrokeWidth(0);

        RelativeLayout relativeLayout = new RelativeLayout(this);
        relativeLayout.setLayoutParams(new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT));
        relativeLayout.setPadding(dp(16), dp(16), dp(16), dp(16));

        int iconContainerId = View.generateViewId();
        FrameLayout iconContainer = new FrameLayout(this);
        iconContainer.setId(iconContainerId);
        RelativeLayout.LayoutParams iconContainerLp = new RelativeLayout.LayoutParams(dp(40), dp(40));
        iconContainer.setLayoutParams(iconContainerLp);
        iconContainer.setBackgroundResource(R.drawable.bg_icon_teal);

        ImageView icon = new ImageView(this);
        FrameLayout.LayoutParams iconInnerLp = new FrameLayout.LayoutParams(dp(20), dp(20));
        iconInnerLp.gravity = Gravity.CENTER;
        icon.setLayoutParams(iconInnerLp);
        icon.setImageResource(getIconForCategory(ecf.evento.categoria));
        icon.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
        iconContainer.addView(icon);
        relativeLayout.addView(iconContainer);

        int chevronId = View.generateViewId();
        ImageView chevron = new ImageView(this);
        chevron.setId(chevronId);
        RelativeLayout.LayoutParams chevronLp = new RelativeLayout.LayoutParams(dp(24), dp(24));
        chevronLp.addRule(RelativeLayout.ALIGN_PARENT_END);
        chevronLp.addRule(RelativeLayout.CENTER_VERTICAL);
        chevron.setLayoutParams(chevronLp);
        chevron.setImageResource(R.drawable.ic_chevron_right);
        chevron.setColorFilter(ContextCompat.getColor(this, R.color.text_gray));
        relativeLayout.addView(chevron);

        LinearLayout infoCol = new LinearLayout(this);
        infoCol.setOrientation(LinearLayout.VERTICAL);
        RelativeLayout.LayoutParams infoLp = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.WRAP_CONTENT, RelativeLayout.LayoutParams.WRAP_CONTENT);
        infoLp.setMarginStart(dp(12));
        infoLp.addRule(RelativeLayout.END_OF, iconContainerId);
        infoLp.addRule(RelativeLayout.START_OF, chevronId);
        infoCol.setLayoutParams(infoLp);

        TextView tvTitle = new TextView(this);
        tvTitle.setText(ecf.evento.categoria + " - " + ecf.evento.mascota);
        tvTitle.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvTitle.setTypeface(tvTitle.getTypeface(), Typeface.BOLD);
        infoCol.addView(tvTitle);

        TextView tvSub = new TextView(this);
        String dateFormatted = ecf.fecha.getDayOfMonth() + " " + MESES_CORTO[ecf.fecha.getMonthValue() - 1] + " " + ecf.fecha.getYear();
        tvSub.setText(ecf.evento.veterinario != null && !ecf.evento.veterinario.isEmpty()
                ? dateFormatted + " · " + ecf.evento.veterinario : dateFormatted);
        tvSub.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvSub.setTextSize(12);
        infoCol.addView(tvSub);

        relativeLayout.addView(infoCol);
        card.addView(relativeLayout);

        card.setOnClickListener(v -> showPetDetailView(buscarMascota(ecf.evento.mascota)));
        return card;
    }

    private static class NotificacionItem {
        String titulo;
        String mensaje;
        String tiempo;
        int iconRes;

        NotificacionItem(String titulo, String mensaje, String tiempo, int iconRes) {
            this.titulo = titulo;
            this.mensaje = mensaje;
            this.tiempo = tiempo;
            this.iconRes = iconRes;
        }
    }

    private final List<NotificacionItem> listaNotificaciones = new ArrayList<>();
    private boolean hayNotificacionesSinLeer = false;

    private void agregarNotificacion(String titulo, String mensaje, String tiempo, int iconRes) {
        listaNotificaciones.add(0, new NotificacionItem(titulo, mensaje, tiempo, iconRes));
        hayNotificacionesSinLeer = true;
        actualizarBadgeNotificaciones();
    }

    private void actualizarBadgeNotificaciones() {
        View badge = findViewById(R.id.notification_badge);
        if (badge != null) {
            badge.setVisibility(hayNotificacionesSinLeer ? View.VISIBLE : View.GONE);
        }
    }

    private void showNotificationsDialog() {
        hayNotificacionesSinLeer = false;
        actualizarBadgeNotificaciones();

        LinearLayout contentLayout = new LinearLayout(this);
        contentLayout.setOrientation(LinearLayout.VERTICAL);
        contentLayout.setPadding(dp(20), dp(16), dp(20), dp(16));

        if (listaNotificaciones.isEmpty()) {
            TextView tvEmpty = new TextView(this);
            tvEmpty.setText("No tenés notificaciones.");
            tvEmpty.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
            tvEmpty.setPadding(0, dp(16), 0, dp(16));
            tvEmpty.setGravity(Gravity.CENTER);
            contentLayout.addView(tvEmpty);
        } else {
            for (NotificacionItem n : listaNotificaciones) {
                View notifCard = buildNotificacionCard(n);
                contentLayout.addView(notifCard);
            }
        }

        ScrollView scrollView = new ScrollView(this);
        scrollView.addView(contentLayout);

        AlertDialog.Builder builder = new AlertDialog.Builder(this)
                .setTitle("Notificaciones")
                .setView(scrollView)
                .setPositiveButton("Cerrar", (dialog, which) -> dialog.dismiss());

        if (!listaNotificaciones.isEmpty()) {
            builder.setNeutralButton("Limpiar notificaciones", (dialog, which) -> {
                listaNotificaciones.clear();
                hayNotificacionesSinLeer = false;
                actualizarBadgeNotificaciones();
                Toast.makeText(this, "Notificaciones borradas", Toast.LENGTH_SHORT).show();
            });
        }

        AlertDialog dialog = builder.create();
        dialog.show();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(ContextCompat.getDrawable(this, R.drawable.bg_dialog_rounded));
        }
    }

    private View buildNotificacionCard(NotificacionItem n) {
        MaterialCardView card =
                new MaterialCardView(this);
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(10);
        card.setLayoutParams(cardLp);
        card.setCardBackgroundColor(ContextCompat.getColor(this, R.color.white));
        card.setRadius(dp(12));
        card.setCardElevation(dp(1));
        card.setStrokeWidth(dp(1));
        card.setStrokeColor(ContextCompat.getColor(this, R.color.divider_light));

        RelativeLayout relativeLayout = new RelativeLayout(this);
        relativeLayout.setLayoutParams(new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT));
        relativeLayout.setPadding(dp(12), dp(12), dp(12), dp(12));

        int iconId = View.generateViewId();
        FrameLayout iconCircle = new FrameLayout(this);
        iconCircle.setId(iconId);
        RelativeLayout.LayoutParams iconLp = new RelativeLayout.LayoutParams(dp(36), dp(36));
        iconCircle.setLayoutParams(iconLp);

        int bgRes = R.drawable.bg_icon_teal;
        int tintColor = ContextCompat.getColor(this, R.color.primary_teal);

        if (n.iconRes == R.drawable.ic_cancel || (n.titulo != null && n.titulo.toLowerCase().contains("cancelad"))) {
            bgRes = R.drawable.bg_icon_orange;
            tintColor = ContextCompat.getColor(this, R.color.accent_orange);
        } else if (n.iconRes == R.drawable.ic_calendar || (n.titulo != null && n.titulo.toLowerCase().contains("turno"))) {
            bgRes = R.drawable.bg_icon_purple;
            tintColor = ContextCompat.getColor(this, R.color.accent_purple);
        } else if (n.iconRes == R.drawable.ic_check_circle) {
            bgRes = R.drawable.bg_icon_teal;
            tintColor = ContextCompat.getColor(this, R.color.success_green);
        }

        iconCircle.setBackgroundResource(bgRes);

        ImageView icon = new ImageView(this);
        FrameLayout.LayoutParams iconInnerLp = new FrameLayout.LayoutParams(dp(18), dp(18));
        iconInnerLp.gravity = Gravity.CENTER;
        icon.setLayoutParams(iconInnerLp);
        icon.setImageResource(n.iconRes);
        icon.setColorFilter(tintColor);
        iconCircle.addView(icon);
        relativeLayout.addView(iconCircle);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        RelativeLayout.LayoutParams textColLp = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT);
        textColLp.addRule(RelativeLayout.END_OF, iconId);
        textColLp.setMarginStart(dp(12));
        textCol.setLayoutParams(textColLp);

        TextView tvTitulo = new TextView(this);
        tvTitulo.setText(n.titulo);
        tvTitulo.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvTitulo.setTypeface(tvTitulo.getTypeface(), Typeface.BOLD);
        tvTitulo.setTextSize(14);
        textCol.addView(tvTitulo);

        TextView tvMsg = new TextView(this);
        tvMsg.setText(n.mensaje);
        tvMsg.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvMsg.setTextSize(12);
        LinearLayout.LayoutParams msgLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        msgLp.topMargin = dp(2);
        tvMsg.setLayoutParams(msgLp);
        textCol.addView(tvMsg);

        TextView tvTiempo = new TextView(this);
        tvTiempo.setText(n.tiempo);
        tvTiempo.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvTiempo.setTextSize(10);
        LinearLayout.LayoutParams tiempoLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tiempoLp.topMargin = dp(4);
        tvTiempo.setLayoutParams(tiempoLp);
        textCol.addView(tvTiempo);

        relativeLayout.addView(textCol);
        card.addView(relativeLayout);
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
        if (etFechaNacimiento != null) {
            etFechaNacimiento.setFocusable(false);
            etFechaNacimiento.setClickable(true);
            etFechaNacimiento.setOnClickListener(v -> showDatePickerDialog(etFechaNacimiento));
        }

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

                agregarNotificacion(
                        "Agregaste una nueva mascota",
                        "Agregaste a " + nombre + " (" + tipoMascotaNueva + ") a tus mascotas.",
                        "Ahora mismo",
                        R.drawable.ic_dog
                );

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
            navLista.setOnClickListener(v -> showRecordatoriosView());
        }
        if (navMas != null) {
            navMas.setOnClickListener(v -> showMasView());
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
        LocalDate fecha;

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
        String usuario;
        String email;
        String matricula;
        String especialidad;
        String estado;
        String mascotasAsociadas;

        Veterinario(String nombre, String especialidad, String matricula) {
            this(nombre,
                 "@" + nombre.toLowerCase(Locale.getDefault()).replaceAll("[^a-z]", ""),
                 nombre.toLowerCase(Locale.getDefault()).replaceAll("[^a-z]", "") + "@petcare.com",
                 matricula, especialidad, "ACTIVO", "");
        }

        Veterinario(String nombre, String usuario, String email, String matricula, String especialidad, String estado, String mascotasAsociadas) {
            this.nombre = nombre;
            this.usuario = usuario;
            this.email = email;
            this.matricula = matricula;
            this.especialidad = especialidad;
            this.estado = estado;
            this.mascotasAsociadas = mascotasAsociadas;
        }
    }

    private final List<Veterinario> listaVeterinariosAutorizados = new ArrayList<>(Arrays.asList(
            new Veterinario("Dr. Alejandro Ramírez", "@aramirez", "alejandro.ramirez@petcare.com", "MP-12345", "Vacuna", "ACTIVO", "Koda, Mika"),
            new Veterinario("Dra. Carla Méndez", "@cmendez", "carla.mendez@petcare.com", "MP-98765", "Control", "PENDIENTE", "Luna"),
            new Veterinario("Dr. Ricardo Soto", "@rsoto", "ricardo.soto@petcare.com", "MP-45612", "Cirugía", "INACTIVO", "Milo")
    ));

    private final List<Veterinario> listaVeterinariosDisponibles = new ArrayList<>(Arrays.asList(
            new Veterinario("Dra. Sofía Fernández", "@sfernandez", "sofia.fernandez@petcare.com", "MP-77890", "Vacuna", "DISPONIBLE", ""),
            new Veterinario("Dra. Valentina Ríos", "@vrios", "valentina.rios@petcare.com", "MP-33221", "Estudio / Tratamiento", "DISPONIBLE", ""),
            new Veterinario("Dr. Gabriel Lucero", "@glucero", "gabriel.lucero@petcare.com", "MP-55443", "Cirugía", "DISPONIBLE", ""),
            new Veterinario("Dra. Mariana Costa", "@mcosta", "mariana.costa@petcare.com", "MP-88112", "Control", "DISPONIBLE", "")
    ));

    private List<Veterinario> getTodosLosVeterinarios() {
        List<Veterinario> todos = new ArrayList<>(listaVeterinariosAutorizados);
        todos.addAll(listaVeterinariosDisponibles);
        return todos;
    }

    private final List<SolicitudItem> solicitudesDueno = new ArrayList<>();
    private final Map<String, Veterinario> veterinariosSolicitantes = new HashMap<>();
    private final Set<String> mascotasEliminadas = new HashSet<>();
    private String passwordUsuario = null;

    private static class Mascota {
        String nombre;
        String tipo;
        String raza;
        String fechaNacimiento;
        Uri fotoUri;
        int fotoRes = 0;
        // Datos de la ficha (se editan desde el detalle)
        String tipoRazaTxt;
        String nacSexoTxt;
        String peso = "Sin datos";
        String microchip = "Sin datos";
        String color = "Sin datos";
        String observaciones = "Sin observaciones";

        Mascota(String nombre, String tipo, String raza, String fechaNacimiento, Uri fotoUri) {
            this.nombre = nombre;
            this.tipo = tipo;
            this.raza = raza;
            this.fechaNacimiento = fechaNacimiento;
            this.fotoUri = fotoUri;
            this.tipoRazaTxt = (raza != null && !raza.isEmpty()) ? tipo + " - " + raza : tipo;
            this.nacSexoTxt = fechaNacimiento != null && !fechaNacimiento.isEmpty()
                    ? "Nacido el " + fechaNacimiento : "Fecha de nacimiento sin datos";
        }

        static Mascota demo(String nombre, String tipo, String raza, String nacimiento, String sexo,
                            int fotoRes, String peso, String microchip, String color, String obs) {
            Mascota m = new Mascota(nombre, tipo, raza, nacimiento, null);
            m.fotoRes = fotoRes;
            m.nacSexoTxt = "Nacido el " + nacimiento + " - " + sexo;
            m.peso = peso;
            m.microchip = microchip;
            m.color = color;
            m.observaciones = obs;
            return m;
        }
    }

    private final List<Mascota> mascotasDemo = Arrays.asList(
            Mascota.demo("Koda", "Perro", "Golden Retriever", "15 mar 2020", "Macho",
                    R.drawable.milo, "28 kg", "985121054871236", "Dorado", "Alérgico a la penicilina"),
            Mascota.demo("Mika", "Gato", "Europeo", "02 nov 2019", "Hembra",
                    R.drawable.milo, "4 kg", "985121054870001", "Gris atigrado", "Sin observaciones"),
            Mascota.demo("Luna", "Perro", "Cocker spaniel", "10 jun 2020", "Hembra",
                    R.drawable.luna, "11 kg", "985121054870002", "Café", "Control dental pendiente"),
            Mascota.demo("Milo", "Gato", "Siamés", "21 ene 2014", "Macho",
                    R.drawable.milo, "5 kg", "985121054870003", "Crema y marrón", "Medicación para la tiroides"));

    private Mascota buscarMascota(String nombre) {
        for (Mascota m : mascotasNuevas) {
            if (m.nombre.equals(nombre)) return m;
        }
        return demoPorNombre(nombre);
    }

    private Mascota demoPorNombre(String nombre) {
        for (Mascota m : mascotasDemo) {
            if (m.nombre.equals(nombre)) return m;
        }
        return mascotasDemo.get(0);
    }

    private final List<Mascota> mascotasNuevas = new ArrayList<>();
    private String tipoMascotaNueva = null;
    private Uri fotoMascotaNuevaUri = null;
    private Uri profilePhotoUri = null;
    private ImageView.ScaleType profileScaleType = ImageView.ScaleType.CENTER_CROP;

    private void showAdjustPhotoDialog(ImageView ivProfilePic) {
        String[] options = {"Llenar círculo (Center Crop)", "Ajustar completa (Fit Center)", "Centrar imagen"};
        new AlertDialog.Builder(this)
                .setTitle("Ajustar posición de la foto")
                .setItems(options, (dialog, which) -> {
                    if (which == 0) {
                        ivProfilePic.setScaleType(ImageView.ScaleType.CENTER_CROP);
                        profileScaleType = ImageView.ScaleType.CENTER_CROP;
                        Toast.makeText(this, "Ajustado: Llenar círculo", Toast.LENGTH_SHORT).show();
                    } else if (which == 1) {
                        ivProfilePic.setScaleType(ImageView.ScaleType.FIT_CENTER);
                        profileScaleType = ImageView.ScaleType.FIT_CENTER;
                        Toast.makeText(this, "Ajustado: Mostrar completa", Toast.LENGTH_SHORT).show();
                    } else if (which == 2) {
                        ivProfilePic.setScaleType(ImageView.ScaleType.CENTER);
                        profileScaleType = ImageView.ScaleType.CENTER;
                        Toast.makeText(this, "Ajustado: Centrar imagen", Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

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

    private float profileTranslationX = 0f;
    private float profileTranslationY = 0f;

    private final ActivityResultLauncher<String> pickProfilePhotoLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri == null) return;
                showPhotoCropDialog(uri);
            });

    private void showPhotoCropDialog(Uri uri) {
        View dialogView = getLayoutInflater().inflate(R.layout.dialog_crop_photo, null);
        View frameContainer = dialogView.findViewById(R.id.frameCropContainer);
        ImageView imgPreview = dialogView.findViewById(R.id.imgCropPreview);
        Button btnCancel = dialogView.findViewById(R.id.btnCancelCrop);
        Button btnSave = dialogView.findViewById(R.id.btnSaveCrop);

        imgPreview.setImageURI(uri);

        final float[] lastTouchX = new float[1];
        final float[] lastTouchY = new float[1];

        View.OnTouchListener touchListener = (v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    lastTouchX[0] = event.getRawX();
                    lastTouchY[0] = event.getRawY();
                    break;
                case MotionEvent.ACTION_MOVE:
                    float dx = event.getRawX() - lastTouchX[0];
                    float dy = event.getRawY() - lastTouchY[0];
                    imgPreview.setTranslationX(imgPreview.getTranslationX() + dx);
                    imgPreview.setTranslationY(imgPreview.getTranslationY() + dy);
                    lastTouchX[0] = event.getRawX();
                    lastTouchY[0] = event.getRawY();
                    break;
                case MotionEvent.ACTION_UP:
                    v.performClick();
                    break;
            }
            return true;
        };

        if (frameContainer != null) frameContainer.setOnTouchListener(touchListener);
        imgPreview.setOnTouchListener(touchListener);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setView(dialogView)
                .setCancelable(true)
                .create();

        btnCancel.setOnClickListener(v -> dialog.dismiss());
        btnSave.setOnClickListener(v -> {
            profilePhotoUri = uri;
            // Ratio entre 400dp (preview image) y 120dp (perfil image) -> 120f / 400f = 0.3f
            profileTranslationX = imgPreview.getTranslationX() * 0.3f;
            profileTranslationY = imgPreview.getTranslationY() * 0.3f;
            ShapeableImageView ivProfilePic = findViewById(R.id.ivProfilePic);
            if (ivProfilePic != null) {
                ivProfilePic.setImageURI(uri);
                ivProfilePic.setScaleType(profileScaleType);
                ivProfilePic.setTranslationX(profileTranslationX);
                ivProfilePic.setTranslationY(profileTranslationY);
            }
            Toast.makeText(this, "Foto de perfil actualizada", Toast.LENGTH_SHORT).show();
            dialog.dismiss();
        });

        dialog.show();
    }

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
        EventoMascota evento = new EventoMascota(categoria, mascota, veterinario, hora, observaciones);
        evento.fecha = fecha;
        lista.add(evento);
    }

    private void seedEventosDemoSiNecesario() {
        if (eventosDemoSeeded) return;
        eventosDemoSeeded = true;
        // Eventos futuros
        agregarEvento(LocalDate.of(2026, 5, 15), "Vacuna", "Koda", "Dr. Alejandro Ramírez", "11:00", "");
        agregarEvento(LocalDate.of(2026, 5, 15), "Control", "Mika", "Dra. Carla Méndez", "11:00", "");
        agregarEvento(LocalDate.of(2026, 5, 20), "Cirugía", "Milo", "Dr. Ricardo Soto", "09:00", "");
        agregarEvento(LocalDate.of(2026, 5, 20), "Vacuna", "Luna", "Dra. Sofía Fernández", "14:00", "");
        agregarEvento(LocalDate.of(2026, 5, 22), "Control", "Koda", "Dra. Carla Méndez", "16:00", "");
        agregarEvento(LocalDate.of(2026, 5, 28), "Estudio / Tratamiento", "Mika", "Dra. Valentina Ríos", "10:00", "");
        agregarEvento(LocalDate.of(2026, 5, 28), "Vacuna", "Milo", "Dr. Alejandro Ramírez", "13:00", "");

        // Eventos pasados recientes (últimos 30 días)
        agregarEvento(LocalDate.of(2026, 5, 10), "Control general", "Milo", "Dra. Carla Méndez", "10:00", "Chequeo de rutina OK");
        agregarEvento(LocalDate.of(2026, 5, 2), "Vacuna múltiple", "Luna", "Dr. Alejandro Ramírez", "12:00", "Refuerzo anual aplicado");
        agregarEvento(LocalDate.of(2026, 4, 25), "Consulta veterinaria", "Koda", "Dr. Juan Pérez", "15:30", "Control de peso");
        agregarEvento(LocalDate.of(2026, 4, 18), "Desparasitación", "Mika", "Dra. Valentina Ríos", "11:00", "Dosis completada");
    }

    private void showCalendarView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.calendario, container, true);

        highlightNavItem(R.id.nav_mas);

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

        card.setOnClickListener(v -> mostrarDetalleTurno(evento));

        return card;
    }

    private void mostrarDetalleTurno(EventoMascota evento) {
        BottomSheetDialog sheet = new BottomSheetDialog(this);
        View vista = getLayoutInflater().inflate(R.layout.bottom_sheet_turno, null);
        sheet.setContentView(vista);

        int[] estilo = getEstiloCategoria(evento.categoria);
        vista.findViewById(R.id.flTurnoIcono).setBackgroundResource(estilo[1]);
        ImageView ivIcono = vista.findViewById(R.id.ivTurnoIcono);
        ivIcono.setImageResource(estilo[0]);
        ivIcono.setColorFilter(ContextCompat.getColor(this, estilo[2]));

        ((TextView) vista.findViewById(R.id.tvTurnoTitulo)).setText(evento.categoria);
        ((TextView) vista.findViewById(R.id.tvTurnoMascota)).setText(evento.mascota);

        boolean proximo = evento.fecha != null && !evento.fecha.isBefore(LocalDate.now());
        TextView tvEstado = vista.findViewById(R.id.tvTurnoEstado);
        tvEstado.setText(proximo ? "Próximo" : "Realizado");
        tvEstado.setBackgroundResource(proximo ? R.drawable.bg_badge_orange : R.drawable.bg_badge_green);
        tvEstado.setTextColor(ContextCompat.getColor(this, proximo ? R.color.accent_orange : R.color.success_green));

        String fechaTxt = evento.fecha != null
                ? evento.fecha.getDayOfMonth() + " de " + MESES[evento.fecha.getMonthValue() - 1] + " de " + evento.fecha.getYear()
                : "Sin fecha";
        ((TextView) vista.findViewById(R.id.tvTurnoFecha)).setText(fechaTxt);
        ((TextView) vista.findViewById(R.id.tvTurnoHora)).setText(evento.hora + " hs");
        ((TextView) vista.findViewById(R.id.tvTurnoVet)).setText(
                evento.veterinario != null && !evento.veterinario.isEmpty() ? evento.veterinario : "Sin asignar");
        boolean hayObs = evento.observaciones != null && !evento.observaciones.isEmpty();
        vista.findViewById(R.id.rowTurnoObs).setVisibility(hayObs ? View.VISIBLE : View.GONE);
        if (hayObs) ((TextView) vista.findViewById(R.id.tvTurnoObs)).setText(evento.observaciones);

        vista.findViewById(R.id.btnTurnoCancelar).setVisibility(proximo ? View.VISIBLE : View.GONE);
        vista.findViewById(R.id.btnTurnoEditar).setOnClickListener(v -> {
            sheet.dismiss();
            mostrarDialogoEditarEvento(evento);
        });
        vista.findViewById(R.id.btnTurnoCancelar).setOnClickListener(v -> {
            sheet.dismiss();
            new AlertDialog.Builder(this)
                    .setTitle("Cancelar turno")
                    .setMessage("¿Querés cancelar el turno de " + evento.mascota + " (" + evento.categoria + ")?")
                    .setPositiveButton("Cancelar turno", (d, w) -> {
                        eliminarEvento(evento);
                        agregarNotificacion("Cancelaste un turno",
                                "Cancelaste el turno de " + evento.mascota + " (" + evento.categoria + ").",
                                "Ahora mismo", R.drawable.ic_cancel);
                        Toast.makeText(this, "Turno cancelado", Toast.LENGTH_SHORT).show();
                        refrescarCalendarioSiVisible();
                    })
                    .setNegativeButton("Volver", null)
                    .show();
        });
        vista.findViewById(R.id.tvTurnoSimular).setOnClickListener(v -> {
            sheet.dismiss();
            eliminarEvento(evento);
            agregarNotificacion(
                    "Turno cancelado por el veterinario",
                    "El turno de " + evento.mascota + " (" + evento.categoria + ") fue cancelado por el veterinario.",
                    "Ahora mismo",
                    R.drawable.ic_cancel
            );
            Toast.makeText(this, "Turno cancelado. Se generó una notificación.", Toast.LENGTH_SHORT).show();
            refrescarCalendarioSiVisible();
        });
        sheet.show();
    }

    private void eliminarEvento(EventoMascota evento) {
        if (evento.fecha == null) return;
        List<EventoMascota> lista = eventosPorFecha.get(dateKey(evento.fecha));
        if (lista != null) lista.remove(evento);
    }

    private void refrescarCalendarioSiVisible() {
        if (findViewById(R.id.listaEventosDia) != null) {
            renderCalendario();
            renderEventosDia();
        }
    }

    private void mostrarDialogoEditarEvento(EventoMascota evento) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(20), dp(16), dp(20), dp(4));

        final LocalDate[] fecha = {evento.fecha != null ? evento.fecha : LocalDate.now()};
        EditText etFecha = campoSoloLectura("Fecha");
        etFecha.setText(fecha[0].getDayOfMonth() + " de " + MESES[fecha[0].getMonthValue() - 1] + " de " + fecha[0].getYear());
        etFecha.setOnClickListener(v -> new DatePickerDialog(this, (view, y, m, d) -> {
            fecha[0] = LocalDate.of(y, m + 1, d);
            etFecha.setText(d + " de " + MESES[m] + " de " + y);
        }, fecha[0].getYear(), fecha[0].getMonthValue() - 1, fecha[0].getDayOfMonth()).show());

        EditText etHora = campoSoloLectura("Hora");
        etHora.setText(evento.hora);
        etHora.setOnClickListener(v -> {
            String[] partes = etHora.getText().toString().split(":");
            int h = 9, mi = 0;
            try {
                h = Integer.parseInt(partes[0]);
                mi = Integer.parseInt(partes[1]);
            } catch (Exception ignored) {
            }
            new TimePickerDialog(this, (view, hh, mm) ->
                    etHora.setText(String.format(Locale.getDefault(), "%02d:%02d", hh, mm)), h, mi, true).show();
        });

        List<String> nombres = new ArrayList<>();
        nombres.add("Sin asignar");
        for (Veterinario vet : getTodosLosVeterinarios()) nombres.add(vet.nombre);
        Spinner spVet = new Spinner(this);
        spVet.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, nombres));
        int idx = nombres.indexOf(evento.veterinario);
        spVet.setSelection(Math.max(idx, 0));

        EditText etObs = new EditText(this);
        etObs.setHint("Observaciones");
        etObs.setText(evento.observaciones);
        etObs.setMinLines(2);

        layout.addView(etFecha);
        layout.addView(etHora);
        layout.addView(spVet);
        layout.addView(etObs);

        new AlertDialog.Builder(this)
                .setTitle("Editar turno de " + evento.mascota)
                .setView(layout)
                .setPositiveButton("Guardar", (d, w) -> {
                    eliminarEvento(evento);
                    evento.fecha = fecha[0];
                    evento.hora = etHora.getText().toString();
                    evento.veterinario = spVet.getSelectedItemPosition() == 0 ? "" : (String) spVet.getSelectedItem();
                    evento.observaciones = etObs.getText().toString().trim();
                    String key = dateKey(evento.fecha);
                    List<EventoMascota> lista = eventosPorFecha.get(key);
                    if (lista == null) {
                        lista = new ArrayList<>();
                        eventosPorFecha.put(key, lista);
                    }
                    lista.add(evento);
                    agregarNotificacion("Modificaste un turno",
                            "El turno de " + evento.mascota + " (" + evento.categoria + ") ahora es el "
                                    + evento.fecha.getDayOfMonth() + " de " + MESES[evento.fecha.getMonthValue() - 1]
                                    + " a las " + evento.hora + ".",
                            "Ahora mismo", R.drawable.ic_calendar);
                    Toast.makeText(this, "Turno actualizado", Toast.LENGTH_SHORT).show();
                    refrescarCalendarioSiVisible();
                })
                .setNegativeButton(R.string.btn_cancelar, null)
                .show();
    }

    private EditText campoSoloLectura(String hint) {
        EditText et = new EditText(this);
        et.setHint(hint);
        et.setFocusable(false);
        et.setClickable(true);
        return et;
    }

    /** Botón "Editar evento" de las pestañas de la mascota: elige uno de sus eventos para editarlo. */
    private void mostrarSelectorEventoParaEditar() {
        String nombre = mascotaActual != null ? mascotaActual.nombre : null;
        List<EventoMascota> propios = new ArrayList<>();
        for (List<EventoMascota> lista : eventosPorFecha.values()) {
            for (EventoMascota e : lista) {
                if (nombre == null || nombre.equals(e.mascota)) propios.add(e);
            }
        }
        if (propios.isEmpty()) {
            Toast.makeText(this, "No hay eventos para editar", Toast.LENGTH_SHORT).show();
            return;
        }
        Collections.sort(propios, (a, b) -> b.fecha.compareTo(a.fecha));
        String[] etiquetas = new String[propios.size()];
        for (int i = 0; i < propios.size(); i++) {
            EventoMascota e = propios.get(i);
            etiquetas[i] = e.fecha.getDayOfMonth() + " " + MESES_CORTO[e.fecha.getMonthValue() - 1] + " " + e.fecha.getYear()
                    + " · " + e.categoria + " · " + e.mascota;
        }
        new AlertDialog.Builder(this)
                .setTitle("Elegí el evento a editar")
                .setItems(etiquetas, (d, which) -> mostrarDialogoEditarEvento(propios.get(which)))
                .setNegativeButton(R.string.btn_cancelar, null)
                .show();
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

        LinearLayout mascotaOptionsLayout = findViewById(R.id.mascotaOptions);
        if (mascotaOptionsLayout != null) {
            for (Mascota m : mascotasNuevas) {
                TextView opt = new TextView(this);
                opt.setPadding(dp(12), dp(12), dp(12), dp(12));
                opt.setText(m.nombre);
                opt.setTextColor(ContextCompat.getColor(this, R.color.black));
                opt.setTextSize(14);
                opt.setOnClickListener(v -> {
                    bounceView(v);
                    mascotaNuevoEvento = m.nombre;
                    TextView tvMascotaSeleccionada = findViewById(R.id.tvMascotaSeleccionada);
                    if (tvMascotaSeleccionada != null) tvMascotaSeleccionada.setText(m.nombre);
                    mascotaOptionsLayout.setVisibility(View.GONE);
                });
                mascotaOptionsLayout.addView(opt);
            }
        }

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

                    String vetInfo = (veterinarioNuevoEvento != null && !veterinarioNuevoEvento.isEmpty())
                            ? " con " + veterinarioNuevoEvento : "";
                    agregarNotificacion(
                            "Tienes un nuevo turno",
                            "Tienes un nuevo turno de " + categoriaNuevoEvento + " para " + mascotaNuevoEvento + vetInfo +
                            " el " + fechaEventoNuevo.getDayOfMonth() + "/" + fechaEventoNuevo.getMonthValue() + " a las " + horaNuevoEvento + " hs.",
                            "Ahora mismo",
                            R.drawable.ic_calendar
                    );

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
        for (Veterinario vet : getTodosLosVeterinarios()) {
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

    private String filtroEstadoSeleccionado = "TODOS";
    private String consultaBusquedaVet = "";

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

        TextView btnFiltroTodos = findViewById(R.id.btnFiltroTodos);
        TextView btnFiltroActivos = findViewById(R.id.btnFiltroActivos);
        TextView btnFiltroPendientes = findViewById(R.id.btnFiltroPendientes);
        TextView btnFiltroInactivos = findViewById(R.id.btnFiltroInactivos);

        TextView[] chips = new TextView[]{btnFiltroTodos, btnFiltroActivos, btnFiltroPendientes, btnFiltroInactivos};
        String[] estados = new String[]{"TODOS", "ACTIVO", "PENDIENTE", "INACTIVO"};

        filtroEstadoSeleccionado = "TODOS";
        consultaBusquedaVet = "";

        for (int i = 0; i < chips.length; i++) {
            final String est = estados[i];
            final TextView chip = chips[i];
            if (chip != null) {
                chip.setOnClickListener(v -> {
                    filtroEstadoSeleccionado = est;
                    actualizarChipsUI(chips, chip);
                    renderListaVeterinarios();
                });
            }
        }

        EditText etBuscar = findViewById(R.id.etBuscar);
        if (etBuscar != null) {
            etBuscar.setText("");
            etBuscar.addTextChangedListener(new TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) {
                    consultaBusquedaVet = s.toString().trim();
                    renderListaVeterinarios();
                }

                @Override
                public void afterTextChanged(Editable s) {}
            });
        }

        View btnAgregarVeterinario = findViewById(R.id.btnAgregarVeterinario);
        if (btnAgregarVeterinario != null) {
            btnAgregarVeterinario.setOnClickListener(v -> mostrarDialogoAutorizarVeterinario());
        }

        renderListaVeterinarios();
    }

    private void actualizarChipsUI(TextView[] chips, TextView seleccionado) {
        for (TextView chip : chips) {
            if (chip == null) continue;
            if (chip == seleccionado) {
                chip.setBackgroundResource(R.drawable.bg_chip_selected);
                chip.setTextColor(ContextCompat.getColor(this, R.color.white));
                chip.setTypeface(chip.getTypeface(), Typeface.BOLD);
            } else {
                chip.setBackgroundResource(R.drawable.bg_chip_unselected);
                chip.setTextColor(ContextCompat.getColor(this, R.color.black));
                chip.setTypeface(null, Typeface.NORMAL);
            }
        }
    }

    private void renderListaVeterinarios() {
        LinearLayout listaContainer = findViewById(R.id.listaVeterinarios);
        TextView tvSinResultados = findViewById(R.id.tvSinResultados);
        if (listaContainer == null) return;

        listaContainer.removeAllViews();

        String query = consultaBusquedaVet.toLowerCase(Locale.getDefault());
        List<Veterinario> filtrados = new ArrayList<>();

        for (Veterinario vet : listaVeterinariosAutorizados) {
            boolean matchEstado = filtroEstadoSeleccionado.equals("TODOS")
                    || vet.estado.equalsIgnoreCase(filtroEstadoSeleccionado);

            boolean matchQuery = query.isEmpty()
                    || (vet.nombre != null && vet.nombre.toLowerCase(Locale.getDefault()).contains(query))
                    || (vet.usuario != null && vet.usuario.toLowerCase(Locale.getDefault()).contains(query))
                    || (vet.email != null && vet.email.toLowerCase(Locale.getDefault()).contains(query))
                    || (vet.matricula != null && vet.matricula.toLowerCase(Locale.getDefault()).contains(query))
                    || (vet.mascotasAsociadas != null && vet.mascotasAsociadas.toLowerCase(Locale.getDefault()).contains(query));

            if (matchEstado && matchQuery) {
                filtrados.add(vet);
            }
        }

        if (filtrados.isEmpty()) {
            if (tvSinResultados != null) {
                tvSinResultados.setVisibility(View.VISIBLE);
                listaContainer.addView(tvSinResultados);
            }
            return;
        }

        if (tvSinResultados != null) {
            tvSinResultados.setVisibility(View.GONE);
        }

        for (Veterinario vet : filtrados) {
            listaContainer.addView(buildCardVeterinarioAutorizado(vet));
        }
    }

    private View buildCardVeterinarioAutorizado(Veterinario vet) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackgroundResource(R.drawable.bg_edit_text);
        card.setPadding(dp(14), dp(14), dp(14), dp(14));
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.topMargin = dp(12);
        card.setLayoutParams(cardLp);

        // Header: Nombre y Usuario + Badge
        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView tvNombre = new TextView(this);
        String tituloText = vet.nombre + (vet.usuario != null && !vet.usuario.isEmpty() ? " (" + vet.usuario + ")" : "");
        tvNombre.setText(tituloText);
        tvNombre.setTextColor(ContextCompat.getColor(this, R.color.black));
        tvNombre.setTextSize(15);
        tvNombre.setTypeface(tvNombre.getTypeface(), Typeface.BOLD);
        tvNombre.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        headerRow.addView(tvNombre);

        // Badge
        LinearLayout badge = new LinearLayout(this);
        badge.setOrientation(LinearLayout.HORIZONTAL);
        badge.setGravity(Gravity.CENTER_VERTICAL);
        badge.setPadding(dp(8), dp(4), dp(8), dp(4));

        ImageView badgeIcon = new ImageView(this);
        badgeIcon.setLayoutParams(new LinearLayout.LayoutParams(dp(12), dp(12)));

        TextView tvBadge = new TextView(this);
        tvBadge.setTextSize(11);
        tvBadge.setTypeface(tvBadge.getTypeface(), Typeface.BOLD);
        LinearLayout.LayoutParams tvBadgeLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tvBadgeLp.setMarginStart(dp(4));
        tvBadge.setLayoutParams(tvBadgeLp);

        if ("ACTIVO".equalsIgnoreCase(vet.estado)) {
            badge.setBackgroundResource(R.drawable.bg_badge_green);
            badgeIcon.setImageResource(R.drawable.ic_check_circle);
            badgeIcon.setColorFilter(ContextCompat.getColor(this, R.color.success_green));
            tvBadge.setText(R.string.estado_activo);
            tvBadge.setTextColor(ContextCompat.getColor(this, R.color.success_green));
        } else if ("PENDIENTE".equalsIgnoreCase(vet.estado)) {
            badge.setBackgroundResource(R.drawable.bg_badge_orange);
            badgeIcon.setImageResource(R.drawable.ic_clock);
            badgeIcon.setColorFilter(ContextCompat.getColor(this, R.color.accent_orange));
            tvBadge.setText(R.string.estado_pendiente);
            tvBadge.setTextColor(ContextCompat.getColor(this, R.color.accent_orange));
        } else {
            badge.setBackgroundResource(R.drawable.bg_badge_red);
            badgeIcon.setImageResource(R.drawable.ic_cancel);
            badgeIcon.setColorFilter(ContextCompat.getColor(this, R.color.danger_red));
            tvBadge.setText(R.string.filtro_inactivos);
            tvBadge.setTextColor(ContextCompat.getColor(this, R.color.danger_red));
        }

        badge.addView(badgeIcon);
        badge.addView(tvBadge);
        headerRow.addView(badge);
        card.addView(headerRow);

        // Email y Matrícula
        TextView tvInfo = new TextView(this);
        String infoText = (vet.email != null ? vet.email : "") + " • Matrícula: " + (vet.matricula != null ? vet.matricula : "-");
        tvInfo.setText(infoText);
        tvInfo.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvInfo.setTextSize(12);
        LinearLayout.LayoutParams tvInfoLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tvInfoLp.topMargin = dp(4);
        tvInfo.setLayoutParams(tvInfoLp);
        card.addView(tvInfo);

        // Mascotas asociadas
        if (vet.mascotasAsociadas != null && !vet.mascotasAsociadas.isEmpty()) {
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
            tvMascotas.setText(vet.mascotasAsociadas);
            tvMascotas.setTextColor(ContextCompat.getColor(this, R.color.black));
            tvMascotas.setTextSize(13);
            card.addView(tvMascotas);
        }

        // Botón de acción (Revocar / Reautorizar)
        MaterialButton btnAccion = new MaterialButton(this, null, androidx.appcompat.R.attr.borderlessButtonStyle);
        btnAccion.setTextSize(12);
        btnAccion.setAllCaps(false);
        LinearLayout.LayoutParams lpBtn = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lpBtn.topMargin = dp(8);
        btnAccion.setLayoutParams(lpBtn);

        if ("INACTIVO".equalsIgnoreCase(vet.estado)) {
            btnAccion.setText(R.string.btn_reautorizar);
            btnAccion.setTextColor(ContextCompat.getColor(this, R.color.primary_teal));
            btnAccion.setOnClickListener(v -> {
                vet.estado = "ACTIVO";
                Toast.makeText(this, getString(R.string.vet_autorizado_exito, vet.nombre), Toast.LENGTH_SHORT).show();
                renderListaVeterinarios();
            });
        } else {
            btnAccion.setText(R.string.btn_revocar);
            btnAccion.setTextColor(ContextCompat.getColor(this, R.color.danger_red));
            btnAccion.setOnClickListener(v -> {
                vet.estado = "INACTIVO";
                Toast.makeText(this, getString(R.string.vet_desautorizado_exito, vet.nombre), Toast.LENGTH_SHORT).show();
                renderListaVeterinarios();
            });
        }

        card.addView(btnAccion);
        return card;
    }

    private void mostrarDialogoAutorizarVeterinario() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(20);
        container.setPadding(padding, padding, padding, padding);

        TextView tvInstruction = new TextView(this);
        tvInstruction.setText("Buscá por usuario, mail o matrícula para autorizar a un veterinario:");
        tvInstruction.setTextSize(13);
        tvInstruction.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        container.addView(tvInstruction);

        final EditText etBusquedaDialog = new EditText(this);
        etBusquedaDialog.setHint(R.string.buscar_vet_hint);
        LinearLayout.LayoutParams lpEdit = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lpEdit.topMargin = dp(10);
        etBusquedaDialog.setLayoutParams(lpEdit);
        container.addView(etBusquedaDialog);

        final ScrollView scrollView = new ScrollView(this);
        LinearLayout.LayoutParams lpScroll = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(220));
        lpScroll.topMargin = dp(12);
        scrollView.setLayoutParams(lpScroll);

        final LinearLayout resultsContainer = new LinearLayout(this);
        resultsContainer.setOrientation(LinearLayout.VERTICAL);
        scrollView.addView(resultsContainer);
        container.addView(scrollView);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(R.string.dialog_autorizar_veterinario)
                .setView(container)
                .setNegativeButton(R.string.btn_cancelar, null)
                .create();

        Runnable actualizarResultados = () -> {
            resultsContainer.removeAllViews();
            String q = etBusquedaDialog.getText().toString().trim().toLowerCase(Locale.getDefault());

            List<Veterinario> candidates = new ArrayList<>();
            for (Veterinario vet : listaVeterinariosDisponibles) {
                boolean yaAutorizado = false;
                for (Veterinario aut : listaVeterinariosAutorizados) {
                    if (aut.matricula.equalsIgnoreCase(vet.matricula) && !"INACTIVO".equalsIgnoreCase(aut.estado)) {
                        yaAutorizado = true;
                        break;
                    }
                }
                if (yaAutorizado) continue;

                boolean matches = q.isEmpty()
                        || (vet.nombre != null && vet.nombre.toLowerCase(Locale.getDefault()).contains(q))
                        || (vet.usuario != null && vet.usuario.toLowerCase(Locale.getDefault()).contains(q))
                        || (vet.email != null && vet.email.toLowerCase(Locale.getDefault()).contains(q))
                        || (vet.matricula != null && vet.matricula.toLowerCase(Locale.getDefault()).contains(q));

                if (matches) {
                    candidates.add(vet);
                }
            }

            if (candidates.isEmpty()) {
                TextView tvEmpty = new TextView(this);
                tvEmpty.setText(R.string.sin_veterinarios_disponibles);
                tvEmpty.setTextSize(13);
                tvEmpty.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
                tvEmpty.setPadding(0, dp(16), 0, dp(16));
                tvEmpty.setGravity(Gravity.CENTER);
                resultsContainer.addView(tvEmpty);
            } else {
                for (Veterinario vet : candidates) {
                    LinearLayout vetRow = new LinearLayout(this);
                    vetRow.setOrientation(LinearLayout.HORIZONTAL);
                    vetRow.setGravity(Gravity.CENTER_VERTICAL);
                    vetRow.setPadding(0, dp(8), 0, dp(8));

                    LinearLayout colText = new LinearLayout(this);
                    colText.setOrientation(LinearLayout.VERTICAL);
                    colText.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

                    TextView tvNombre = new TextView(this);
                    tvNombre.setText(vet.nombre + " (" + vet.usuario + ")");
                    tvNombre.setTextSize(14);
                    tvNombre.setTypeface(tvNombre.getTypeface(), Typeface.BOLD);
                    tvNombre.setTextColor(ContextCompat.getColor(this, R.color.black));
                    colText.addView(tvNombre);

                    TextView tvSub = new TextView(this);
                    tvSub.setText(vet.email + " • " + vet.matricula);
                    tvSub.setTextSize(12);
                    tvSub.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
                    colText.addView(tvSub);

                    vetRow.addView(colText);

                    MaterialButton btnAuth = new MaterialButton(this);
                    btnAuth.setText(R.string.btn_autorizar);
                    btnAuth.setTextSize(12);
                    btnAuth.setAllCaps(false);
                    btnAuth.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.primary_teal));
                    btnAuth.setOnClickListener(v -> {
                        Veterinario existenteInactivo = null;
                        for (Veterinario aut : listaVeterinariosAutorizados) {
                            if (aut.matricula.equalsIgnoreCase(vet.matricula)) {
                                existenteInactivo = aut;
                                break;
                            }
                        }
                        if (existenteInactivo != null) {
                            existenteInactivo.estado = "ACTIVO";
                        } else {
                            Veterinario nuevoAuth = new Veterinario(vet.nombre, vet.usuario, vet.email, vet.matricula, vet.especialidad, "ACTIVO", "Koda");
                            listaVeterinariosAutorizados.add(nuevoAuth);
                        }
                        Toast.makeText(this, getString(R.string.vet_autorizado_exito, vet.nombre), Toast.LENGTH_SHORT).show();
                        dialog.dismiss();
                        renderListaVeterinarios();
                    });

                    vetRow.addView(btnAuth);
                    resultsContainer.addView(vetRow);

                    View divider = new View(this);
                    divider.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)));
                    divider.setBackgroundColor(ContextCompat.getColor(this, R.color.light_gray));
                    resultsContainer.addView(divider);
                }
            }
        };

        etBusquedaDialog.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                actualizarResultados.run();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });

        dialog.show();
        actualizarResultados.run();
    }
}