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
import android.util.Patterns;
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

public class MainActivity extends BaseActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        seedEventosDemoSiNecesario();
        EdgeToEdge.enable(this);
        backMenuMas = new androidx.activity.OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                cerrarMenuMas(true, true);
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backMenuMas);
        mostrarPantallaInicial();
    }

    private void mostrarPantallaInicial() {
        setContentView(R.layout.activity_main);
        View mainRoot = findViewById(R.id.main);
        View panelBienvenida = findViewById(R.id.panelBienvenida);
        if (mainRoot != null) {
            final int panelPaddingBottom = panelBienvenida != null ? panelBienvenida.getPaddingBottom() : 0;
            ViewCompat.setOnApplyWindowInsetsListener(mainRoot, (v, insets) -> {
                Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                v.setPadding(systemBars.left, systemBars.top, systemBars.right, 0);
                if (panelBienvenida != null) {
                    panelBienvenida.setPadding(panelBienvenida.getPaddingLeft(), panelBienvenida.getPaddingTop(),
                            panelBienvenida.getPaddingRight(), panelPaddingBottom + systemBars.bottom);
                }
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
                if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                    if (etEmail != null) etEmail.setError("Ingresá un correo válido");
                    return;
                }
                if (password.isEmpty()) {
                    if (etPassword != null) etPassword.setError("Ingresá tu contraseña");
                    return;
                }
                if (password.length() < 6) {
                    if (etPassword != null) etPassword.setError("Mínimo 6 caracteres");
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
                    DatosRegistroDueno dueno = duenosRegistrados.get(email);
                    if (dueno != null) cargarCuentaDueno(dueno); else restaurarDatosDemo();
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

    // El alta del dueño también es un asistente de pasos aparte: devuelve sus datos y sus mascotas
    private final Map<String, DatosRegistroDueno> duenosRegistrados = new HashMap<>();
    private final androidx.activity.result.ActivityResultLauncher<Intent> registroDuenoLauncher =
            registerForActivityResult(new androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult(), result -> {
                Intent data = result.getData();
                if (result.getResultCode() != RESULT_OK || data == null) return;
                DatosRegistroDueno datos = androidx.core.content.IntentCompat.getSerializableExtra(
                        data, RegistroDuenoActivity.EXTRA_DATOS, DatosRegistroDueno.class);
                if (datos == null) return;
                cuentasDemo.put(datos.getEmail(), false);
                passwordsDemo.put(datos.getEmail(), datos.getPassword());
                duenosRegistrados.put(datos.getEmail(), datos);
                Toast.makeText(this, "Cuenta creada. Iniciá sesión para continuar", Toast.LENGTH_LONG).show();
                mostrarLogin();
                EditText etEmailLogin = findViewById(R.id.etEmail);
                if (etEmailLogin != null) etEmailLogin.setText(datos.getEmail());
            });

    // El alta del veterinario es un asistente de pasos aparte; devuelve el correo y la contraseña elegidos
    private final androidx.activity.result.ActivityResultLauncher<Intent> registroVetLauncher =
            registerForActivityResult(new androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult(), result -> {
                Intent data = result.getData();
                if (result.getResultCode() != RESULT_OK || data == null) return;
                String email = data.getStringExtra(RegistroVeterinarioActivity.EXTRA_EMAIL);
                String pass = data.getStringExtra(RegistroVeterinarioActivity.EXTRA_PASSWORD);
                if (email == null || pass == null) return;
                cuentasDemo.put(email, true);
                passwordsDemo.put(email, pass);
                sincronizarVeterinarioRegistrado();
                Toast.makeText(this, "Cuenta creada. Iniciá sesión para continuar", Toast.LENGTH_LONG).show();
                mostrarLogin();
                EditText etEmailLogin = findViewById(R.id.etEmail);
                if (etEmailLogin != null) etEmailLogin.setText(email);
            });

    /**
     * El veterinario de ejemplo del catálogo del dueño ("@jperez") representa al veterinario en sesión:
     * cuando éste se registra con sus datos reales, el catálogo y los turnos de ejemplo pasan a usar su nombre.
     */
    private void sincronizarVeterinarioRegistrado() {
        PerfilVetRepo perfil = PerfilVetRepo.INSTANCE;
        List<Veterinario> todos = getTodosLosVeterinarios();
        for (Veterinario vet : todos) {
            if (!"@jperez".equals(vet.usuario)) continue;
            String anterior = vet.nombre;
            vet.nombre = perfil.getNombre();
            vet.email = perfil.getEmail();
            vet.matricula = perfil.getMatricula();
            for (List<EventoMascota> eventos : eventosPorFecha.values()) {
                for (EventoMascota ev : eventos) {
                    if (anterior.equalsIgnoreCase(ev.veterinario)) ev.veterinario = perfil.getNombre();
                }
            }
        }
    }

    private void mostrarRegistro() {
        setContentView(R.layout.registro);
        aplicarInsets(findViewById(R.id.registroRoot));

        registroComoVeterinario = false;
        MaterialButton btnDueno = findViewById(R.id.btnRegRoleDueno);
        MaterialButton btnVet = findViewById(R.id.btnRegRoleVet);
        View llAvisoDueno = findViewById(R.id.llAvisoDueno);
        View llAvisoVet = findViewById(R.id.llAvisoVet);
        Runnable actualizarRol = () -> {
            MaterialButton sel = registroComoVeterinario ? btnVet : btnDueno;
            MaterialButton nosel = registroComoVeterinario ? btnDueno : btnVet;
            sel.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.primary_teal));
            sel.setTextColor(ContextCompat.getColor(this, R.color.white));
            nosel.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.white));
            nosel.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
            llAvisoDueno.setVisibility(registroComoVeterinario ? View.GONE : View.VISIBLE);
            llAvisoVet.setVisibility(registroComoVeterinario ? View.VISIBLE : View.GONE);
        };
        btnDueno.setOnClickListener(v -> { registroComoVeterinario = false; actualizarRol.run(); });
        btnVet.setOnClickListener(v -> { registroComoVeterinario = true; actualizarRol.run(); });
        actualizarRol.run();

        findViewById(R.id.btnBackRegistro).setOnClickListener(v -> mostrarPantallaInicial());

        findViewById(R.id.btnComenzarDueno).setOnClickListener(v -> {
            Intent intent = new Intent(this, RegistroDuenoActivity.class);
            intent.putStringArrayListExtra(RegistroDuenoActivity.EXTRA_EMAILS_REGISTRADOS,
                    new java.util.ArrayList<>(cuentasDemo.keySet()));
            registroDuenoLauncher.launch(intent);
        });
        findViewById(R.id.btnComenzarVet).setOnClickListener(v -> {
            Intent intent = new Intent(this, RegistroVeterinarioActivity.class);
            intent.putStringArrayListExtra(RegistroVeterinarioActivity.EXTRA_EMAILS_REGISTRADOS,
                    new java.util.ArrayList<>(cuentasDemo.keySet()));
            registroVetLauncher.launch(intent);
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
            if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
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
        noSeleccionado.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.white));
        noSeleccionado.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
    }


    private void cerrarSesion() {
        quitarMenuMas();
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

        float startX = (newPosition > currentTabPosition) ? container.getWidth() * 0.25f : -container.getWidth() * 0.25f;

        inflationRunnable.run();

        container.setTranslationX(startX);
        container.setAlpha(0.3f);

        container.animate()
                .translationX(0f)
                .alpha(1f)
                .setDuration(300)
                .setInterpolator(new DecelerateInterpolator())
                .start();

        currentTabPosition = newPosition;
    }

    private void showHomeView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.home_dueno, container, true);
        viewingGlobalRecordatorios = true;
        configurarHeaderHome();

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
                View petView = buildMascotaHomeItem(m, containerMisMascotasHome);
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
                containerRecordatoriosHome.addView(buildEventoHomeCard(containerRecordatoriosHome, ecf, true));
                count++;
            }
            if (count == 0) {
                containerRecordatoriosHome.addView(buildEstadoVacioHome(containerRecordatoriosHome,
                        R.drawable.ic_notifications, "No hay próximos recordatorios",
                        "Creá uno para no olvidarte de vacunas y controles", "+ Crear recordatorio",
                        () -> showNuevoEventoView(LocalDate.now())));
            }
        }

        LinearLayout containerActividadRecienteHome = findViewById(R.id.containerActividadRecienteHome);
        if (containerActividadRecienteHome != null) {
            containerActividadRecienteHome.removeAllViews();
            List<EventoConFecha> reciente = obtenerActividadReciente30Dias();
            int count = 0;
            for (EventoConFecha ecf : reciente) {
                if (count >= 5) break;
                containerActividadRecienteHome.addView(buildEventoHomeCard(containerActividadRecienteHome, ecf, false));
                count++;
            }
            if (count == 0) {
                containerActividadRecienteHome.addView(buildEstadoVacioHome(containerActividadRecienteHome,
                        R.drawable.ic_history, "Sin actividad en los últimos 30 días",
                        "Acá vas a ver consultas, vacunas y tratamientos", null, null));
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
        actualizarResumenDetalle();
    }

    private void setTextoSiExiste(int id, String texto) {
        TextView tv = findViewById(id);
        if (tv != null) tv.setText(texto);
    }


    private int tabSwitchToken = 0;
    private boolean recordatoriosProximos = true;

    private void showPetDetailView() {
        if (mascotaActual == null) mascotaActual = mascotasDemo.get(0);
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.mascota_shell, container, true);

        highlightNavItem(R.id.nav_mascotas);

        Toolbar toolbar = findViewById(R.id.toolbar);
        if (toolbar != null) {
            toolbar.setNavigationOnClickListener(v -> showPetsView());
            TextView tvTitle = toolbar.findViewById(R.id.toolbar_title);
            if (tvTitle != null) tvTitle.setText(mascotaActual.nombre);
        }

        View btnMore = findViewById(R.id.btnMore);
        if (btnMore != null) {
            btnMore.setOnClickListener(v -> mostrarMenuMascota(v));
        }

        currentTabPosition = 0;
        tabSwitchToken++;
        mostrarTabMascota(0, false);

        TabLayout tabLayout = findViewById(R.id.tabLayout);
        if (tabLayout != null) {
            tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
                @Override
                public void onTabSelected(TabLayout.Tab tab) {
                    int pos = tab.getPosition();
                    if (pos != currentTabPosition) mostrarTabMascota(pos, true);
                }

                @Override
                public void onTabUnselected(TabLayout.Tab tab) {}

                @Override
                public void onTabReselected(TabLayout.Tab tab) {}
            });
        }
    }

    /** Cambia solo el contenido de la ficha: la barra y las pestañas quedan fijas y el contenido se desliza. */
    private void mostrarTabMascota(int pos, boolean animar) {
        FrameLayout contenido = findViewById(R.id.petTabContent);
        if (contenido == null) return;

        int layoutRes = pos == 0 ? R.layout.contenido_info
                : pos == 1 ? R.layout.contenido_historial : R.layout.contenido_recordatorios;
        final int direccion = pos >= currentTabPosition ? 1 : -1;
        currentTabPosition = pos;
        viewingGlobalRecordatorios = pos != 2;
        final int token = ++tabSwitchToken;
        final int desplazamiento = dp(36);

        Runnable mostrarNuevo = () -> {
            if (token != tabSwitchToken) return;
            contenido.removeAllViews();
            View nuevo = getLayoutInflater().inflate(layoutRes, contenido, false);
            contenido.addView(nuevo);
            if (pos == 0) {
                configurarTabInfo();
            } else if (pos == 1) {
                configurarTabHistorial();
            } else {
                configurarContenidoRecordatorios(false);
            }
            if (animar) {
                nuevo.setAlpha(0f);
                nuevo.setTranslationX(direccion * desplazamiento);
                nuevo.animate()
                        .alpha(1f)
                        .translationX(0f)
                        .setDuration(240)
                        .setInterpolator(new DecelerateInterpolator())
                        .start();
            }
        };

        if (animar && contenido.getChildCount() > 0) {
            View viejo = contenido.getChildAt(0);
            viejo.animate().cancel();
            viejo.animate()
                    .alpha(0f)
                    .translationX(-direccion * desplazamiento)
                    .setDuration(140)
                    .withEndAction(mostrarNuevo)
                    .start();
        } else {
            mostrarNuevo.run();
        }
    }

    private void configurarTabInfo() {
        llenarDetalleMascota();

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

        View btnVerCarnet = findViewById(R.id.btnVerCarnet);
        if (btnVerCarnet != null) {
            btnVerCarnet.setOnClickListener(v -> startActivity(new Intent(this, CarnetSaludActivity.class)));
        }

        View btnAgendarTurno = findViewById(R.id.btnAgendarTurno);
        if (btnAgendarTurno != null) {
            btnAgendarTurno.setOnClickListener(v -> {
                bounceView(v);
                if (mascotaActual != null) presetMascotaEvento = mascotaActual.nombre;
                showNuevoEventoView(LocalDate.now());
            });
        }
    }

    private void configurarTabHistorial() {
        RecyclerView recyclerView = findViewById(R.id.recyclerViewHistorial);
        if (recyclerView != null) {
            List<HistorialItem> items = new ArrayList<>();
            if (mascotaActual != null) {
                seedEventosDemoSiNecesario();
                for (Map.Entry<String, List<EventoMascota>> entry : eventosPorFecha.entrySet()) {
                    for (EventoMascota ev : entry.getValue()) {
                        if (ev.mascota != null && ev.mascota.equalsIgnoreCase(mascotaActual.nombre)) {
                            String title = ev.categoria;
                            String subtitle = ev.fecha + (ev.veterinario != null && !ev.veterinario.isEmpty() ? " · " + ev.veterinario : "");
                            int iconRes = getIconForCategory(ev.categoria);
                            int bgRes = getBgColorForCategory(ev.categoria);
                            items.add(new HistorialItem(title, subtitle, iconRes, bgRes));
                        }
                    }
                }
            }
            if (items.isEmpty()) {
                items.add(new HistorialItem("Sin eventos clínicos", "No hay turnos registrados para " + (mascotaActual != null ? mascotaActual.nombre : "esta mascota"), R.drawable.ic_calendar, R.color.icon_teal_bg));
            }
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
        viewingGlobalRecordatorios = true;
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.recordatorios_dueno, container, true);

        highlightNavItem(R.id.nav_lista);

        View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showHomeView());
        }
        View btnToolbarAdd = findViewById(R.id.btnToolbarAdd);
        if (btnToolbarAdd != null) {
            btnToolbarAdd.setOnClickListener(v -> {
                bounceView(v);
                showNuevoEventoView(LocalDate.now());
            });
        }

        configurarContenidoRecordatorios(true);
    }

    private void configurarContenidoRecordatorios(boolean global) {
        recordatoriosProximos = true;
        refrescarRecordatorios();

        Button btnProximos = findViewById(R.id.btn_proximos);
        Button btnCompletados = findViewById(R.id.btn_completados);
        if (btnProximos != null && btnCompletados != null) {
            btnProximos.setOnClickListener(v -> {
                recordatoriosProximos = true;
                refrescarRecordatorios();
            });
            btnCompletados.setOnClickListener(v -> {
                recordatoriosProximos = false;
                refrescarRecordatorios();
            });
        }

        View fabAdd = findViewById(R.id.fabAdd);
        if (fabAdd != null) {
            if (global) {
                fabAdd.setVisibility(View.GONE);
            } else {
                fabAdd.setOnClickListener(v -> {
                    bounceView(v);
                    showNuevoEventoView(diaSeleccionado);
                });
            }
        }

        View btnEditarEvento = findViewById(R.id.btnEditarEvento);
        if (btnEditarEvento != null) {
            btnEditarEvento.setOnClickListener(v -> {
                bounceView(v);
                mostrarSelectorEventoParaEditar();
            });
        }
    }

    private void refrescarRecordatorios() {
        List<RecordatorioItem> items = obtenerRecordatoriosItems(recordatoriosProximos);

        RecyclerView recyclerView = findViewById(R.id.recyclerViewRecordatorios);
        if (recyclerView != null) {
            recyclerView.setAdapter(new RecordatoriosAdapter(items));
            recyclerView.setVisibility(items.isEmpty() ? View.GONE : View.VISIBLE);
        }

        View vacio = findViewById(R.id.emptyRecordatorios);
        if (vacio != null) {
            vacio.setVisibility(items.isEmpty() ? View.VISIBLE : View.GONE);
            ((ImageView) vacio.findViewById(R.id.ivEmptyIcon)).setImageResource(R.drawable.ic_notifications);
            ((TextView) vacio.findViewById(R.id.tvEmptyTitle)).setText(recordatoriosProximos
                    ? "No hay recordatorios próximos" : "Todavía no hay recordatorios completados");
            ((TextView) vacio.findViewById(R.id.tvEmptyMessage)).setText(recordatoriosProximos
                    ? "Creá uno para no olvidarte de vacunas y controles"
                    : "Acá vas a ver los turnos que ya pasaron");
            TextView cta = vacio.findViewById(R.id.tvEmptyCta);
            if (recordatoriosProximos) {
                cta.setText("+ Crear recordatorio");
                cta.setVisibility(View.VISIBLE);
                cta.setOnClickListener(v -> showNuevoEventoView(LocalDate.now()));
            } else {
                cta.setVisibility(View.GONE);
            }
        }

        Button btnProximos = findViewById(R.id.btn_proximos);
        Button btnCompletados = findViewById(R.id.btn_completados);
        if (btnProximos != null && btnCompletados != null) {
            estiloSegmento(btnProximos, recordatoriosProximos);
            estiloSegmento(btnCompletados, !recordatoriosProximos);
        }

        TextView tvCount = findViewById(R.id.tvRecCount);
        if (tvCount != null) {
            int proximos = recordatoriosProximos ? items.size() : obtenerRecordatoriosItems(true).size();
            tvCount.setText(proximos == 1 ? "1 próximo" : proximos + " próximos");
        }
    }

    private void estiloSegmento(Button boton, boolean activo) {
        boton.setBackgroundTintList(activo
                ? ContextCompat.getColorStateList(this, R.color.primary_teal)
                : android.content.res.ColorStateList.valueOf(android.graphics.Color.TRANSPARENT));
        boton.setTextColor(ContextCompat.getColor(this, activo ? R.color.white : R.color.text_gray));
    }

    private Mascota mascotaActual = null;
    private boolean viewingGlobalRecordatorios = true;

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
                    if (mascotaActual != null) presetMascotaEvento = mascotaActual.nombre;
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
                {R.id.pet_luna, "Luna"}, {R.id.pet_milo, "Milo"}};
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
                    actualizarResumenDetalle();
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
                    Calendar selectedCal = Calendar.getInstance();
                    selectedCal.set(selectedYear, selectedMonth, selectedDay, 0, 0, 0);
                    selectedCal.set(Calendar.MILLISECOND, 0);

                    Calendar today = Calendar.getInstance();
                    today.set(Calendar.HOUR_OF_DAY, 23);
                    today.set(Calendar.MINUTE, 59);
                    today.set(Calendar.SECOND, 59);

                    if (selectedCal.after(today)) {
                        Toast.makeText(this, "No podés seleccionar una fecha de nacimiento futura", Toast.LENGTH_SHORT).show();
                        return;
                    }

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
        datePickerDialog.getDatePicker().setMaxDate(System.currentTimeMillis());
        datePickerDialog.show();
    }






    private boolean tieneTurnoCon(String nombreVet, String mascota) {
        for (List<EventoMascota> lista : eventosPorFecha.values()) {
            for (EventoMascota ev : lista) {
                if (nombreVet.equalsIgnoreCase(ev.veterinario) && mascota.equalsIgnoreCase(ev.mascota)) return true;
            }
        }
        return false;
    }

    private void actualizarContadorSolicitudes() {
        int pendientes = 0;
        for (SolicitudItem item : solicitudesDueno) {
            if (item.getEstado() == SolicitudItem.Estado.PENDIENTE) pendientes++;
        }
        TextView tvCount = findViewById(R.id.tvSolicitudesCount);
        if (tvCount != null) {
            tvCount.setText(pendientes == 0 ? "Sin solicitudes pendientes"
                    : pendientes == 1 ? "1 pendiente" : pendientes + " pendientes");
        }
        View vacio = findViewById(R.id.emptySolicitudes);
        RecyclerView rv = findViewById(R.id.rvSolicitudesDueno);
        boolean sinItems = solicitudesDueno.isEmpty();
        if (vacio != null) {
            vacio.setVisibility(sinItems ? View.VISIBLE : View.GONE);
            ((ImageView) vacio.findViewById(R.id.ivEmptyIcon)).setImageResource(R.drawable.ic_key);
            ((TextView) vacio.findViewById(R.id.tvEmptyTitle)).setText("No hay solicitudes");
            ((TextView) vacio.findViewById(R.id.tvEmptyMessage)).setText(
                    "Los veterinarios con turno tuyo ya ven la ficha de tu mascota sin pedir permiso");
        }
        if (rv != null) rv.setVisibility(sinItems ? View.GONE : View.VISIBLE);
    }

    private void showSolicitudesDuenoView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.solicitudes_dueno, container, true);

        highlightNavItem(-1);

        View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showHomeView());
        }

        RecyclerView rv = findViewById(R.id.rvSolicitudesDueno);
        if (rv != null) {
            if (solicitudesDueno.isEmpty() && !solicitudesDuenoSembradas) {
                solicitudesDuenoSembradas = true;
                solicitudesDueno.add(new SolicitudItem("Dra. Laura Sosa", "Solicita acceso a Koda", "Hace 2 horas", R.drawable.luna));
                solicitudesDueno.add(new SolicitudItem("Dr. Pablo Medina", "Solicita acceso a Mika", "Ayer", R.drawable.milo));
                veterinariosSolicitantes.put("Dra. Laura Sosa", new Veterinario("Dra. Laura Sosa", "Control", "MP-24680"));
                veterinariosSolicitantes.put("Dr. Pablo Medina", new Veterinario("Dr. Pablo Medina", "Vacuna", "MP-13579"));
            }

            // Quien ya tiene un turno con la mascota no necesita que se lo autorice.
            for (SolicitudItem item : solicitudesDueno) {
                if (item.getEstado() != SolicitudItem.Estado.PENDIENTE) continue;
                String mascota = item.getMascota().replace("Solicita acceso a ", "");
                if (tieneTurnoCon(item.getSolicitante(), mascota)) {
                    autorizarVeterinarioPorTurno(item.getSolicitante(), mascota, true);
                    item.setEstado(SolicitudItem.Estado.ACEPTADA);
                }
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
                actualizarContadorSolicitudes();
                return Unit.INSTANCE;
            }));
        }
        actualizarContadorSolicitudes();
    }

    private void showProfileView() {
        ensureAppBaseSet();
        inicializarPerfilSiNecesario();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.mi_perfil, container, true);

        highlightNavItem(R.id.nav_mas);

        View btnBackPerfil = findViewById(R.id.btnBack);
        if (btnBackPerfil != null) {
            btnBackPerfil.setOnClickListener(v -> showHomeView());
        }
        TextView tvPerfilMascotas = findViewById(R.id.tvPerfilMascotas);
        if (tvPerfilMascotas != null) tvPerfilMascotas.setText(String.valueOf(mascotasVisibles().size()));
        TextView tvPerfilVets = findViewById(R.id.tvPerfilVets);
        if (tvPerfilVets != null) {
            int conAcceso = 0;
            for (Veterinario vet : listaVeterinariosAutorizados) {
                if ("ACTIVO".equalsIgnoreCase(vet.estado)) conAcceso++;
            }
            tvPerfilVets.setText(String.valueOf(conAcceso));
        }

        ShapeableImageView ivProfilePic = findViewById(R.id.ivProfilePic);
        if (ivProfilePic != null) {
            if (profilePhotoUri != null) {
                ivProfilePic.setImageURI(profilePhotoUri);
                ivProfilePic.setTranslationX(profileTranslationX);
                ivProfilePic.setTranslationY(profileTranslationY);
            } else {
                cargarAvatarDueno(ivProfilePic);
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
        et.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
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


    private String filtroMascotas = "Todas";

    private List<Mascota> mascotasVisibles() {
        List<Mascota> lista = new ArrayList<>();
        for (Mascota m : mascotasDemo) {
            if (!mascotasEliminadas.contains(m.nombre)) lista.add(m);
        }
        lista.addAll(mascotasNuevas);
        return lista;
    }

    private void showPetsView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.mis_mascotas, container, true);
        viewingGlobalRecordatorios = true;

        highlightNavItem(R.id.nav_mascotas);
        filtroMascotas = "Todas";

        View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showHomeView());
        }

        View.OnClickListener agregarMascota = v -> {
            bounceView(v);
            showNuevaMascotaView();
        };
        View btnAddPet = findViewById(R.id.btnAddPet);
        if (btnAddPet != null) btnAddPet.setOnClickListener(agregarMascota);
        View btnAddPetCard = findViewById(R.id.btnAddPetCard);
        if (btnAddPetCard != null) btnAddPetCard.setOnClickListener(agregarMascota);

        int[] chipIds = {R.id.chipTodas, R.id.chipPerros, R.id.chipGatos, R.id.chipOtras};
        String[] filtros = {"Todas", "Perros", "Gatos", "Otras"};
        for (int i = 0; i < chipIds.length; i++) {
            View chip = findViewById(chipIds[i]);
            final String filtro = filtros[i];
            if (chip != null) {
                chip.setOnClickListener(v -> {
                    filtroMascotas = filtro;
                    actualizarListaMascotas();
                });
            }
        }

        actualizarListaMascotas();
    }

    private boolean coincideFiltroMascota(Mascota m, String filtro) {
        String tipo = m.tipo != null ? m.tipo.trim().toLowerCase(Locale.ROOT) : "";
        switch (filtro) {
            case "Perros":
                return tipo.equals("perro");
            case "Gatos":
                return tipo.equals("gato");
            case "Otras":
                return !tipo.equals("perro") && !tipo.equals("gato");
            default:
                return true;
        }
    }

    private void actualizarListaMascotas() {
        LinearLayout lista = findViewById(R.id.listaMascotasContainer);
        if (lista == null) return;
        lista.removeAllViews();

        List<Mascota> todas = mascotasVisibles();
        int mostradas = 0;
        for (Mascota m : todas) {
            if (coincideFiltroMascota(m, filtroMascotas)) {
                lista.addView(buildMascotaListItem(m, lista));
                mostradas++;
            }
        }
        if (mostradas == 0) {
            lista.addView(buildEstadoVacioHome(lista, R.drawable.ic_dog,
                    "No hay mascotas en esta categoría",
                    "Probá con otro filtro o agregá una nueva mascota", null, null));
            ((LinearLayout.LayoutParams) lista.getChildAt(0).getLayoutParams()).bottomMargin = dp(14);
        }

        TextView tvCount = findViewById(R.id.tvPetsCount);
        if (tvCount != null) {
            tvCount.setText(todas.size() == 1 ? "1 mascota" : todas.size() + " mascotas");
        }

        int[] chipIds = {R.id.chipTodas, R.id.chipPerros, R.id.chipGatos, R.id.chipOtras};
        String[] filtros = {"Todas", "Perros", "Gatos", "Otras"};
        for (int i = 0; i < chipIds.length; i++) {
            TextView chip = findViewById(chipIds[i]);
            if (chip == null) continue;
            boolean activo = filtros[i].equals(filtroMascotas);
            chip.setBackgroundResource(activo ? R.drawable.bg_pill_teal : R.drawable.bg_pill_white);
            chip.setTextColor(ContextCompat.getColor(this, activo ? R.color.white : R.color.text_gray));
        }
    }

    private View buildMascotaListItem(Mascota m, ViewGroup parent) {
        View item = getLayoutInflater().inflate(R.layout.item_mascota, parent, false);

        ShapeableImageView ivFoto = item.findViewById(R.id.ivFoto);
        TextView tvInicial = item.findViewById(R.id.tvInicial);
        if (m.fotoUri != null) {
            ivFoto.setImageURI(m.fotoUri);
            tvInicial.setVisibility(View.GONE);
        } else if (m.fotoRes != 0) {
            ivFoto.setImageResource(m.fotoRes);
            tvInicial.setVisibility(View.GONE);
        } else {
            ivFoto.setVisibility(View.GONE);
            tvInicial.setText(m.nombre != null && !m.nombre.isEmpty()
                    ? m.nombre.substring(0, 1).toUpperCase(Locale.ROOT) : "?");
        }

        ((TextView) item.findViewById(R.id.tvNombre)).setText(m.nombre);
        String tipoRaza = m.tipo != null ? m.tipo : "";
        if (m.raza != null && !m.raza.isEmpty()) tipoRaza += " · " + m.raza;
        ((TextView) item.findViewById(R.id.tvTipoRaza)).setText(tipoRaza);

        setChipTexto(item.findViewById(R.id.tvChipEdad), edadTexto(m));
        setChipTexto(item.findViewById(R.id.tvChipPeso), pesoValido(m.peso) ? m.peso : null);
        String sexo = sexoTexto(m);
        setChipTexto(item.findViewById(R.id.tvChipSexo), "—".equals(sexo) ? null : sexo);

        aplicarChipEstado(item.findViewById(R.id.tvEstado), m.nombre);
        String proximo = proximoEventoTexto(m.nombre);
        ((TextView) item.findViewById(R.id.tvProximo)).setText(
                proximo != null ? "Próx.: " + proximo : "Sin eventos próximos");

        item.setOnClickListener(v -> showPetDetailView(m));
        return item;
    }

    private void setChipTexto(TextView chip, String texto) {
        if (chip == null) return;
        if (texto == null || texto.isEmpty()) {
            chip.setVisibility(View.GONE);
        } else {
            chip.setText(texto);
            chip.setVisibility(View.VISIBLE);
        }
    }

    private boolean pesoValido(String peso) {
        return peso != null && !peso.trim().isEmpty() && !peso.equalsIgnoreCase("Sin datos");
    }

    private static final String[] MESES_ABREV = {"ene", "feb", "mar", "abr", "may", "jun",
            "jul", "ago", "sep", "oct", "nov", "dic"};

    private LocalDate parsearFechaNacimiento(String texto) {
        if (texto == null) return null;
        java.util.regex.Matcher t = java.util.regex.Pattern
                .compile("(\\d{1,2})\\s+([A-Za-zñÑ]{3,})\\.?\\s+(\\d{4})").matcher(texto);
        if (t.find()) {
            String mes = t.group(2).toLowerCase(Locale.ROOT).substring(0, 3);
            for (int i = 0; i < MESES_ABREV.length; i++) {
                if (MESES_ABREV[i].equals(mes)) {
                    try {
                        return LocalDate.of(Integer.parseInt(t.group(3)), i + 1, Integer.parseInt(t.group(1)));
                    } catch (Exception ignored) {
                        return null;
                    }
                }
            }
        }
        java.util.regex.Matcher n = java.util.regex.Pattern
                .compile("(\\d{1,2})/(\\d{1,2})/(\\d{4})").matcher(texto);
        if (n.find()) {
            try {
                return LocalDate.of(Integer.parseInt(n.group(3)), Integer.parseInt(n.group(2)),
                        Integer.parseInt(n.group(1)));
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private String edadTexto(Mascota m) {
        LocalDate nac = parsearFechaNacimiento(m.nacSexoTxt);
        if (nac == null) nac = parsearFechaNacimiento(m.fechaNacimiento);
        if (nac == null) return null;
        java.time.Period p = java.time.Period.between(nac, LocalDate.now());
        if (p.isNegative()) return null;
        if (p.getYears() >= 1) return p.getYears() == 1 ? "1 año" : p.getYears() + " años";
        int meses = p.getMonths();
        return meses <= 1 ? "1 mes" : meses + " meses";
    }

    private String sexoTexto(Mascota m) {
        String t = m.nacSexoTxt != null ? m.nacSexoTxt.toLowerCase(Locale.ROOT) : "";
        if (t.contains("hembra")) return "Hembra";
        if (t.contains("macho")) return "Macho";
        return "—";
    }

    private String proximoEventoTexto(String nombreMascota) {
        seedEventosDemoSiNecesario();
        LocalDate ref = fechaReferencia();
        LocalDate mejorFecha = null;
        String mejorCategoria = null;
        for (Map.Entry<String, List<EventoMascota>> entry : eventosPorFecha.entrySet()) {
            LocalDate fecha;
            try {
                fecha = LocalDate.parse(entry.getKey());
            } catch (Exception e) {
                continue;
            }
            if (fecha.isBefore(ref) || (mejorFecha != null && !fecha.isBefore(mejorFecha))) continue;
            for (EventoMascota ev : entry.getValue()) {
                if (ev.mascota != null && ev.mascota.equalsIgnoreCase(nombreMascota)) {
                    mejorFecha = fecha;
                    mejorCategoria = ev.categoria;
                    break;
                }
            }
        }
        if (mejorFecha == null) return null;
        return mejorCategoria + " · " + mejorFecha.getDayOfMonth() + " "
                + MESES_CORTO[mejorFecha.getMonthValue() - 1];
    }

    private void actualizarResumenDetalle() {
        Mascota m = mascotaActual;
        if (m == null) return;
        String edad = edadTexto(m);
        setTextoSiExiste(R.id.tvStatEdad, edad != null ? edad : "—");
        TextView tvPeso = findViewById(R.id.editTextText);
        String peso = tvPeso != null ? tvPeso.getText().toString() : m.peso;
        setTextoSiExiste(R.id.tvStatPeso, pesoValido(peso) ? peso : "—");
        setTextoSiExiste(R.id.tvStatSexo, sexoTexto(m));
        aplicarChipEstado(findViewById(R.id.tvSaludEstado), m.nombre);
        String proximo = proximoEventoTexto(m.nombre);
        setTextoSiExiste(R.id.tvSaludProximo,
                proximo != null ? "Próximo: " + proximo : "Sin eventos próximos agendados");
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



    private static final String[] DIAS_SEMANA = {"Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"};
    private static final String[] MESES_LARGO = {"enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"};

    private LocalDate fechaReferencia() {
        LocalDate hoy = LocalDate.now();
        return hoy.isBefore(LocalDate.of(2026, 5, 1)) ? LocalDate.of(2026, 5, 1) : hoy;
    }

    /** Muestra la foto elegida; una cuenta nueva sin foto usa el avatar neutro en vez del de ejemplo. */
    private void cargarAvatarDueno(ImageView iv) {
        if (iv == null) return;
        if (profilePhotoUri != null) iv.setImageURI(profilePhotoUri);
        else if (respaldoDemo != null) iv.setImageResource(R.drawable.avatar_default);
    }

    private void configurarHeaderHome() {
        inicializarPerfilSiNecesario();
        TextView saludo = findViewById(R.id.tv_welcome);
        if (saludo != null && nombreUsuario != null && !nombreUsuario.trim().isEmpty()) {
            saludo.setText("Hola, " + nombreUsuario.trim().split("\\s+")[0]);
        }
        cargarAvatarDueno(findViewById(R.id.iv_home_profile));
        TextView subtitulo = findViewById(R.id.tvHomeSubtitle);
        if (subtitulo != null) {
            LocalDate hoy = LocalDate.now();
            subtitulo.setText(DIAS_SEMANA[hoy.getDayOfWeek().getValue() - 1] + " " + hoy.getDayOfMonth()
                    + " de " + MESES_LARGO[hoy.getMonthValue() - 1] + " · " + getString(R.string.home_subtitulo));
        }

        configurarHeroProximoEvento();

        View qaNuevoEvento = findViewById(R.id.qaNuevoEvento);
        if (qaNuevoEvento != null) {
            qaNuevoEvento.setOnClickListener(v -> {
                bounceView(v);
                showNuevoEventoView(LocalDate.now());
            });
        }
        View qaHistorial = findViewById(R.id.qaHistorial);
        if (qaHistorial != null) {
            qaHistorial.setOnClickListener(v -> {
                bounceView(v);
                showPetsView();
            });
        }
        View qaVeterinarios = findViewById(R.id.qaVeterinarios);
        if (qaVeterinarios != null) {
            qaVeterinarios.setOnClickListener(v -> {
                bounceView(v);
                showVeterinariosView();
            });
        }
        View qaDocumentos = findViewById(R.id.qaDocumentos);
        if (qaDocumentos != null) {
            qaDocumentos.setOnClickListener(v -> {
                bounceView(v);
                startActivity(new Intent(this, CarnetSaludActivity.class));
            });
        }

        View verActividad = findViewById(R.id.tv_ver_actividad);
        if (verActividad != null) {
            verActividad.setOnClickListener(v -> showPetsView());
        }

        aplicarChipEstado(findViewById(R.id.chip_luna), "Luna");
        aplicarChipEstado(findViewById(R.id.chip_milo), "Milo");
    }

    private void configurarHeroProximoEvento() {
        TextView label = findViewById(R.id.tvHeroLabel);
        TextView titulo = findViewById(R.id.tvHeroTitle);
        TextView subtitulo = findViewById(R.id.tvHeroSubtitle);
        TextView accion = findViewById(R.id.btnHeroAction);
        ImageView icono = findViewById(R.id.ivHeroIcon);
        if (titulo == null || subtitulo == null || accion == null) return;

        List<EventoConFecha> proximos = obtenerEventosOrdenados(true);
        if (proximos.isEmpty()) {
            if (label != null) label.setText(R.string.home_hero_todo_en_orden);
            titulo.setText(R.string.home_hero_sin_eventos);
            subtitulo.setText(R.string.home_hero_sin_eventos_msg);
            accion.setText(R.string.home_hero_agendar);
            if (icono != null) icono.setImageResource(R.drawable.ic_check);
            accion.setOnClickListener(v -> {
                bounceView(v);
                showNuevoEventoView(LocalDate.now());
            });
            return;
        }

        EventoConFecha ecf = proximos.get(0);
        long dias = ChronoUnit.DAYS.between(fechaReferencia(), ecf.fecha);
        String cuando = dias <= 0 ? "Hoy" : dias == 1 ? "Mañana"
                : ecf.fecha.getDayOfMonth() + " " + MESES_CORTO[ecf.fecha.getMonthValue() - 1];
        StringBuilder detalle = new StringBuilder();
        if (ecf.evento.mascota != null && !ecf.evento.mascota.isEmpty()) {
            detalle.append(ecf.evento.mascota).append(" · ");
        }
        detalle.append(cuando).append(", ").append(ecf.evento.hora);
        if (ecf.evento.veterinario != null && !ecf.evento.veterinario.isEmpty()) {
            detalle.append(" · ").append(ecf.evento.veterinario);
        }

        if (label != null) label.setText(R.string.home_hero_label);
        titulo.setText(ecf.evento.categoria);
        subtitulo.setText(detalle.toString());
        accion.setText(R.string.home_hero_ver_detalle);
        if (icono != null) icono.setImageResource(R.drawable.ic_calendar);
        accion.setOnClickListener(v -> {
            bounceView(v);
            showRecordatoriosView();
        });
    }

    private boolean tieneVacunaPendiente(String nombreMascota) {
        seedEventosDemoSiNecesario();
        LocalDate ref = fechaReferencia();
        LocalDate limite = ref.plusDays(30);
        for (Map.Entry<String, List<EventoMascota>> entry : eventosPorFecha.entrySet()) {
            LocalDate fecha;
            try {
                fecha = LocalDate.parse(entry.getKey());
            } catch (Exception e) {
                continue;
            }
            if (fecha.isBefore(ref) || fecha.isAfter(limite)) continue;
            for (EventoMascota ev : entry.getValue()) {
                if (ev.mascota != null && ev.mascota.equalsIgnoreCase(nombreMascota)
                        && ev.categoria != null && ev.categoria.toLowerCase().contains("vacuna")) {
                    return true;
                }
            }
        }
        return false;
    }

    private void aplicarChipEstado(TextView chip, String nombreMascota) {
        if (chip == null) return;
        boolean pendiente = tieneVacunaPendiente(nombreMascota);
        chip.setText(pendiente ? R.string.estado_vacuna_pendiente : R.string.estado_al_dia);
        chip.setBackgroundResource(pendiente ? R.drawable.bg_chip_warn : R.drawable.bg_chip_ok);
        chip.setTextColor(ContextCompat.getColor(this, pendiente ? R.color.accent_orange_dark : R.color.success_green));
    }

    private View buildMascotaHomeItem(Mascota m, ViewGroup parent) {
        View item = getLayoutInflater().inflate(R.layout.item_home_mascota, parent, false);

        ShapeableImageView ivFoto = item.findViewById(R.id.ivFoto);
        if (m.fotoUri != null) {
            ivFoto.setImageURI(m.fotoUri);
        } else if (m.fotoRes != 0) {
            ivFoto.setImageResource(m.fotoRes);
        } else {
            ivFoto.setImageResource(R.drawable.ic_dog);
            ivFoto.setBackgroundResource(R.drawable.bg_icon_teal);
            ivFoto.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
            int padding = dp(24);
            ivFoto.setPadding(padding, padding, padding, padding);
        }

        ((TextView) item.findViewById(R.id.tvNombre)).setText(m.nombre);
        ((TextView) item.findViewById(R.id.tvDesc)).setText(
                m.raza != null && !m.raza.isEmpty() ? m.raza : m.tipo);
        aplicarChipEstado(item.findViewById(R.id.tvChip), m.nombre);

        item.setOnClickListener(v -> showPetDetailView(m));
        return item;
    }

    private int getColorFgParaCategoria(String categoria) {
        if (categoria == null) return R.color.primary_teal;
        String c = categoria.toLowerCase();
        if (c.contains("vacuna")) return R.color.success_green;
        if (c.contains("control") || c.contains("consulta")) return R.color.primary_teal;
        if (c.contains("cirug")) return R.color.danger_red;
        if (c.contains("desparasit")) return R.color.accent_orange;
        return R.color.accent_purple;
    }

    private View buildEventoHomeCard(ViewGroup parent, EventoConFecha ecf, boolean proximo) {
        View card = getLayoutInflater().inflate(R.layout.item_home_evento, parent, false);

        String categoria = ecf.evento.categoria;
        android.graphics.drawable.GradientDrawable fondoIcono = new android.graphics.drawable.GradientDrawable();
        fondoIcono.setCornerRadius(dp(13));
        fondoIcono.setColor(ContextCompat.getColor(this, getBgColorForCategory(categoria)));
        card.findViewById(R.id.flIcono).setBackground(fondoIcono);
        ImageView icono = card.findViewById(R.id.ivIcono);
        icono.setImageResource(getIconForCategory(categoria));
        icono.setColorFilter(ContextCompat.getColor(this, getColorFgParaCategoria(categoria)));

        String fechaCorta = ecf.fecha.getDayOfMonth() + " " + MESES_CORTO[ecf.fecha.getMonthValue() - 1];
        String mascota = ecf.evento.mascota != null ? ecf.evento.mascota : "";
        ((TextView) card.findViewById(R.id.tvTitulo)).setText(categoria);
        TextView subtitulo = card.findViewById(R.id.tvSubtitulo);
        TextView chip = card.findViewById(R.id.tvChip);
        View chevron = card.findViewById(R.id.ivChevron);

        if (proximo) {
            subtitulo.setText(mascota + " · " + fechaCorta + " · " + ecf.evento.hora);
            long dias = ChronoUnit.DAYS.between(fechaReferencia(), ecf.fecha);
            boolean cercano = dias <= 1;
            chip.setText(dias <= 0 ? "Hoy" : dias == 1 ? "Mañana" : "En " + dias + " días");
            chip.setBackgroundResource(cercano ? R.drawable.bg_chip_warn : R.drawable.bg_chip_ok);
            chip.setTextColor(ContextCompat.getColor(this, cercano ? R.color.accent_orange_dark : R.color.success_green));
            card.setOnClickListener(v -> showRecordatoriosView());
        } else {
            String vet = ecf.evento.veterinario != null && !ecf.evento.veterinario.isEmpty()
                    ? " · " + ecf.evento.veterinario : "";
            subtitulo.setText(mascota + " · " + fechaCorta + vet);
            chip.setVisibility(View.GONE);
            chevron.setVisibility(View.VISIBLE);
            card.setOnClickListener(v -> showPetDetailView(buscarMascota(ecf.evento.mascota)));
        }
        return card;
    }

    private View buildEstadoVacioHome(ViewGroup parent, int iconRes, String titulo, String mensaje,
                                      String cta, Runnable alCta) {
        View vista = getLayoutInflater().inflate(R.layout.view_empty_state, parent, false);
        ((ImageView) vista.findViewById(R.id.ivEmptyIcon)).setImageResource(iconRes);
        ((TextView) vista.findViewById(R.id.tvEmptyTitle)).setText(titulo);
        ((TextView) vista.findViewById(R.id.tvEmptyMessage)).setText(mensaje);
        TextView tvCta = vista.findViewById(R.id.tvEmptyCta);
        if (cta != null && alCta != null) {
            tvCta.setText(cta);
            tvCta.setVisibility(View.VISIBLE);
            tvCta.setOnClickListener(v -> {
                bounceView(v);
                alCta.run();
            });
        }
        return vista;
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
                        if (viewingGlobalRecordatorios || mascotaActual == null || (ev.mascota != null && ev.mascota.equalsIgnoreCase(mascotaActual.nombre))) {
                            list.add(new EventoConFecha(fecha, ev));
                        }
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
            items.add(new RecordatorioItem(title, petName, dateStr, daysLeft, iconRes,
                    getBgColorForCategory(ecf.evento.categoria), getColorFgParaCategoria(ecf.evento.categoria)));
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

    private int getBgColorForCategory(String categoria) {
        if (categoria == null) return R.color.icon_teal_bg;
        String catLower = categoria.toLowerCase();
        if (catLower.contains("vacuna")) return R.color.icon_green_bg;
        if (catLower.contains("control") || catLower.contains("consulta")) return R.color.icon_blue_bg;
        if (catLower.contains("cirug")) return R.color.icon_pink_bg;
        if (catLower.contains("desparasit")) return R.color.icon_orange_bg;
        return R.color.icon_purple_bg;
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
            navMas.setOnClickListener(v -> alternarMenuMas());
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

    private View overlayMas = null;
    private int ultimoNavResaltado = R.id.nav_home;
    private int navAntesDeMas = R.id.nav_home;
    private androidx.activity.OnBackPressedCallback backMenuMas;

    private void alternarMenuMas() {
        if (overlayMas != null) {
            cerrarMenuMas(true, true);
        } else {
            abrirMenuMas();
        }
    }

    private void abrirMenuMas() {
        ViewGroup root = findViewById(android.R.id.content);
        if (root == null) return;
        View nav = findViewById(R.id.bottom_navigation_container);

        navAntesDeMas = ultimoNavResaltado;
        View overlay = getLayoutInflater().inflate(R.layout.menu_mas_popup, root, false);
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) overlay.getLayoutParams();
        lp.bottomMargin = nav != null && nav.getHeight() > 0 ? nav.getHeight() : dp(80);
        overlay.setLayoutParams(lp);
        overlay.setOnClickListener(v -> cerrarMenuMas(true, true));

        overlay.findViewById(R.id.masMiPerfil).setOnClickListener(v -> elegirOpcionMas(false, this::showProfileView));
        overlay.findViewById(R.id.masVeterinarios).setOnClickListener(v -> elegirOpcionMas(false, this::showVeterinariosView));
        overlay.findViewById(R.id.masSolicitudes).setOnClickListener(v -> elegirOpcionMas(false, this::showSolicitudesDuenoView));
        overlay.findViewById(R.id.masSalud).setOnClickListener(v -> elegirOpcionMas(true,
                () -> startActivity(new Intent(this, CarnetSaludActivity.class))));
        overlay.findViewById(R.id.masCalendario).setOnClickListener(v -> elegirOpcionMas(false, this::showCalendarView));
        overlay.findViewById(R.id.masNotificaciones).setOnClickListener(v -> elegirOpcionMas(true, () -> {
            hayNotificacionesSinLeer = false;
            actualizarBadgeNotificaciones();
            showNotificationsDialog();
        }));
        overlay.findViewById(R.id.masCerrarSesion).setOnClickListener(v -> elegirOpcionMas(false, this::cerrarSesion));
        overlay.findViewById(R.id.masBadgeNotificaciones)
                .setVisibility(hayNotificacionesSinLeer ? View.VISIBLE : View.GONE);

        root.addView(overlay);
        overlayMas = overlay;
        if (backMenuMas != null) backMenuMas.setEnabled(true);
        resaltarNav(R.id.nav_mas);

        View card = overlay.findViewById(R.id.cardMasMenu);
        overlay.setAlpha(0f);
        card.setScaleX(0.9f);
        card.setScaleY(0.9f);
        card.setTranslationY(dp(16));
        card.post(() -> {
            card.setPivotX(card.getWidth() * 0.85f);
            card.setPivotY(card.getHeight());
            overlay.animate().alpha(1f).setDuration(160).start();
            card.animate().scaleX(1f).scaleY(1f).translationY(0f).setDuration(220)
                    .setInterpolator(new OvershootInterpolator(0.8f)).start();
        });
    }

    private void elegirOpcionMas(boolean restaurarNav, Runnable accion) {
        cerrarMenuMas(restaurarNav, false);
        accion.run();
    }

    private void quitarMenuMas() {
        cerrarMenuMas(false, false);
    }

    private void cerrarMenuMas(boolean restaurarNav, boolean animar) {
        View overlay = overlayMas;
        if (overlay == null) return;
        overlayMas = null;
        if (backMenuMas != null) backMenuMas.setEnabled(false);
        if (restaurarNav) resaltarNav(navAntesDeMas);

        Runnable quitar = () -> {
            ViewGroup padre = (ViewGroup) overlay.getParent();
            if (padre != null) padre.removeView(overlay);
        };
        if (animar) {
            View card = overlay.findViewById(R.id.cardMasMenu);
            card.animate().alpha(0f).scaleX(0.92f).scaleY(0.92f).translationY(dp(12)).setDuration(120).start();
            overlay.animate().alpha(0f).setDuration(140).withEndAction(quitar).start();
        } else {
            quitar.run();
        }
    }

    private void highlightNavItem(int navId) {
        quitarMenuMas();
        resaltarNav(navId);
    }

    private void resaltarNav(int navId) {
        ultimoNavResaltado = navId;
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
            new Veterinario("Dr. Alejandro Ramírez", "@aramirez", "alejandro.ramirez@petcare.com", "MP-23456", "Vacuna", "ACTIVO", "Koda, Mika"),
            new Veterinario("Dra. Carla Méndez", "@cmendez", "carla.mendez@petcare.com", "MP-98765", "Control", "PENDIENTE", "Luna"),
            new Veterinario("Dr. Ricardo Soto", "@rsoto", "ricardo.soto@petcare.com", "MP-45612", "Cirugía", "INACTIVO", "Milo")
    ));

    private final List<Veterinario> listaVeterinariosDisponibles = new ArrayList<>(Arrays.asList(
            new Veterinario("Dra. Sofía Fernández", "@sfernandez", "sofia.fernandez@petcare.com", "MP-77890", "Vacuna", "DISPONIBLE", ""),
            new Veterinario("Dra. Valentina Ríos", "@vrios", "valentina.rios@petcare.com", "MP-33221", "Estudio / Tratamiento", "DISPONIBLE", ""),
            new Veterinario("Dr. Gabriel Lucero", "@glucero", "gabriel.lucero@petcare.com", "MP-55443", "Cirugía", "DISPONIBLE", ""),
            new Veterinario("Dra. Mariana Costa", "@mcosta", "mariana.costa@petcare.com", "MP-88112", "Control", "DISPONIBLE", ""),
            new Veterinario(PerfilVetRepo.INSTANCE.getNombre(), "@jperez", PerfilVetRepo.INSTANCE.getEmail(),
                    PerfilVetRepo.INSTANCE.getMatricula(), "Control", "DISPONIBLE", "")
    ));

    private List<Veterinario> getTodosLosVeterinarios() {
        List<Veterinario> todos = new ArrayList<>(listaVeterinariosAutorizados);
        todos.addAll(listaVeterinariosDisponibles);
        return todos;
    }

    private Veterinario buscarVeterinarioPorNombre(String nombre) {
        if (nombre == null) return null;
        for (Veterinario vet : getTodosLosVeterinarios()) {
            if (vet.nombre.equalsIgnoreCase(nombre.trim())) return vet;
        }
        return null;
    }

    private void agregarMascotaAsociada(Veterinario vet, String mascota) {
        if (mascota == null || mascota.isEmpty()) return;
        Set<String> nombres = new java.util.LinkedHashSet<>();
        if (vet.mascotasAsociadas != null) {
            for (String parte : vet.mascotasAsociadas.split(",")) {
                if (!parte.trim().isEmpty()) nombres.add(parte.trim());
            }
        }
        nombres.add(mascota);
        vet.mascotasAsociadas = android.text.TextUtils.join(", ", nombres);
    }

    /**
     * Tener un turno con el veterinario alcanza para que vea la ficha de la mascota: no hay que
     * esperar ninguna autorización. Devuelve true si el veterinario pasó a tener acceso en este momento.
     */
    private boolean autorizarVeterinarioPorTurno(String nombreVet, String mascota, boolean reactivar) {
        Veterinario vet = buscarVeterinarioPorNombre(nombreVet);
        if (vet == null) return false;
        if ("INACTIVO".equalsIgnoreCase(vet.estado) && !reactivar) return false;
        boolean teniaAcceso = "ACTIVO".equalsIgnoreCase(vet.estado) && vet.mascotasAsociadas != null
                && java.util.Arrays.asList(vet.mascotasAsociadas.split("\\s*,\\s*")).contains(mascota);
        listaVeterinariosDisponibles.remove(vet);
        if (!listaVeterinariosAutorizados.contains(vet)) listaVeterinariosAutorizados.add(vet);
        vet.estado = "ACTIVO";
        agregarMascotaAsociada(vet, mascota);
        return !teniaAcceso;
    }

    /** Deja los accesos de los veterinarios de ejemplo coherentes con los turnos cargados. */
    private void sincronizarAccesoPorTurnos() {
        for (Veterinario vet : getTodosLosVeterinarios()) {
            if (!"INACTIVO".equalsIgnoreCase(vet.estado)) vet.mascotasAsociadas = "";
        }
        List<EventoMascota> todos = new ArrayList<>();
        for (List<EventoMascota> lista : eventosPorFecha.values()) todos.addAll(lista);
        Collections.sort(todos, (a, b) -> a.fecha.compareTo(b.fecha));
        for (EventoMascota ev : todos) autorizarVeterinarioPorTurno(ev.veterinario, ev.mascota, false);
    }

    private int turnosDeVeterinario(Veterinario vet) {
        int cantidad = 0;
        for (List<EventoMascota> lista : eventosPorFecha.values()) {
            for (EventoMascota ev : lista) {
                if (vet.nombre.equalsIgnoreCase(ev.veterinario)) cantidad++;
            }
        }
        return cantidad;
    }

    private String proximoTurnoDeVeterinario(Veterinario vet) {
        LocalDate ref = fechaReferencia();
        LocalDate mejor = null;
        String texto = null;
        for (Map.Entry<String, List<EventoMascota>> entry : eventosPorFecha.entrySet()) {
            LocalDate fecha;
            try {
                fecha = LocalDate.parse(entry.getKey());
            } catch (Exception e) {
                continue;
            }
            if (fecha.isBefore(ref) || (mejor != null && !fecha.isBefore(mejor))) continue;
            for (EventoMascota ev : entry.getValue()) {
                if (vet.nombre.equalsIgnoreCase(ev.veterinario)) {
                    mejor = fecha;
                    texto = ev.categoria + " de " + ev.mascota + " · " + fecha.getDayOfMonth() + " "
                            + MESES_CORTO[fecha.getMonthValue() - 1] + ", " + ev.hora;
                }
            }
        }
        return texto;
    }

    private String valorOSinDatos(String valor) {
        return valor == null || valor.trim().isEmpty() ? "Sin datos" : valor;
    }

    /** Acceso automático del veterinario y, si es el de la otra vista, la mascota y el turno le aparecen. */
    private void compartirTurnoConVeterinario(LocalDate fecha, String categoria, String mascota,
                                              String nombreVet, String hora, String observaciones) {
        if (nombreVet == null || nombreVet.isEmpty()) return;
        boolean nuevoAcceso = autorizarVeterinarioPorTurno(nombreVet, mascota, true);
        if (nuevoAcceso) {
            agregarNotificacion("Acceso por turno",
                    nombreVet + " ya puede ver la ficha de " + mascota + " por el turno del "
                            + fecha.getDayOfMonth() + "/" + fecha.getMonthValue() + ".",
                    "Ahora mismo", R.drawable.ic_check_circle);
        }

        if (!nombreVet.equalsIgnoreCase(PerfilVetRepo.INSTANCE.getNombre())) return;
        inicializarPerfilSiNecesario();
        Mascota m = buscarMascota(mascota);
        String sexo = sexoTexto(m);
        String especie = m.tipo != null && (m.tipo.equalsIgnoreCase("Perro") || m.tipo.equalsIgnoreCase("Gato"))
                ? m.tipo : PacientesRepo.ESPECIE_OTRO;
        Paciente paciente = PacientesRepo.INSTANCE.registrarDesdeDueno(
                m.nombre, especie, valorOSinDatos(m.raza), "—".equals(sexo) ? "Sin datos" : sexo,
                valorOSinDatos(m.fechaNacimiento), m.fotoRes, valorOSinDatos(m.peso),
                valorOSinDatos(m.microchip), valorOSinDatos(m.color), valorOSinDatos(m.observaciones),
                valorOSinDatos(nombreUsuario), valorOSinDatos(direccionUsuario),
                valorOSinDatos(telefonoUsuario), valorOSinDatos(emailUsuario));

        String tipo = "Vacuna".equals(categoria) ? "Vacuna" : "Control".equals(categoria) ? "Control"
                : "Cirugía".equals(categoria) ? "Cirugía" : "Tratamiento";
        AgendaRepo.INSTANCE.agregar(paciente.getId(), tipo,
                "Vacuna".equals(categoria) ? "Vacunación" : categoria, fecha, hora,
                EstadoEvento.PENDIENTE, observaciones == null ? "" : observaciones, nombreVet);
    }

    private final List<SolicitudItem> solicitudesDueno = new ArrayList<>();
    private boolean solicitudesDuenoSembradas = false;
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
                    R.drawable.luna, "28 kg", "985121054871236", "Dorado", "Alérgico a la penicilina"),
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

    /** Foto de lo que había antes de entrar con una cuenta nueva, para volver a la cuenta de demostración. */
    private static class EstadoDemo {
        final Map<String, List<EventoMascota>> eventos = new HashMap<>();
        final List<Veterinario> vetsEnOrden = new ArrayList<>();
        final List<Veterinario> autorizados = new ArrayList<>();
        final Map<Veterinario, String[]> estadoVets = new HashMap<>();
        final Set<String> mascotasEliminadas = new HashSet<>();
        final List<Mascota> mascotasNuevas = new ArrayList<>();
        final List<SolicitudItem> solicitudes = new ArrayList<>();
        final List<NotificacionItem> notificaciones = new ArrayList<>();
        boolean solicitudesSembradas;
        boolean hayNotificaciones;
        boolean perfilInicializado;
        String nombre, email, telefono, direccion, password;
        Uri foto;
    }

    private EstadoDemo respaldoDemo = null;

    /**
     * Una cuenta recién creada arranca sin los datos de ejemplo: solo tiene lo que cargó al registrarse
     * (sus datos y sus mascotas). Los datos de demostración se guardan y vuelven si entra a la cuenta de ejemplo.
     */
    private void cargarCuentaDueno(DatosRegistroDueno d) {
        if (respaldoDemo == null) {
            EstadoDemo r = new EstadoDemo();
            for (Map.Entry<String, List<EventoMascota>> e : eventosPorFecha.entrySet()) {
                r.eventos.put(e.getKey(), new ArrayList<>(e.getValue()));
            }
            r.vetsEnOrden.addAll(listaVeterinariosAutorizados);
            r.vetsEnOrden.addAll(listaVeterinariosDisponibles);
            r.autorizados.addAll(listaVeterinariosAutorizados);
            for (Veterinario v : r.vetsEnOrden) r.estadoVets.put(v, new String[]{v.estado, v.mascotasAsociadas});
            r.mascotasEliminadas.addAll(mascotasEliminadas);
            r.mascotasNuevas.addAll(mascotasNuevas);
            r.solicitudes.addAll(solicitudesDueno);
            r.notificaciones.addAll(listaNotificaciones);
            r.solicitudesSembradas = solicitudesDuenoSembradas;
            r.hayNotificaciones = hayNotificacionesSinLeer;
            r.perfilInicializado = perfilInicializado;
            r.nombre = nombreUsuario;
            r.email = emailUsuario;
            r.telefono = telefonoUsuario;
            r.direccion = direccionUsuario;
            r.password = passwordUsuario;
            r.foto = profilePhotoUri;
            respaldoDemo = r;
        }

        eventosPorFecha.clear();
        listaVeterinariosAutorizados.clear();
        listaVeterinariosDisponibles.clear();
        for (Veterinario v : respaldoDemo.vetsEnOrden) {
            v.estado = "DISPONIBLE";
            v.mascotasAsociadas = "";
            listaVeterinariosDisponibles.add(v);
        }
        mascotasEliminadas.clear();
        for (Mascota m : mascotasDemo) mascotasEliminadas.add(m.nombre);
        mascotasNuevas.clear();
        for (MascotaRegistro r : d.getMascotas()) {
            Uri foto = r.getFotoPath() != null ? Uri.fromFile(new java.io.File(r.getFotoPath())) : null;
            String nacimiento = r.getNacimiento().isEmpty() ? "-" : r.getNacimiento();
            Mascota m = new Mascota(r.getNombre(), r.getTipo(),
                    r.getRaza(), nacimiento, foto);
            m.nacSexoTxt = (r.getNacimiento().isEmpty() ? "Fecha de nacimiento sin datos"
                    : "Nacido el " + r.getNacimiento()) + " - " + r.getSexo();
            if (!r.getPeso().isEmpty()) m.peso = r.getPeso();
            if (!r.getColor().isEmpty()) m.color = r.getColor();
            if (!r.getMicrochip().isEmpty()) m.microchip = r.getMicrochip();
            if (!r.getObservaciones().isEmpty()) m.observaciones = r.getObservaciones();
            mascotasNuevas.add(m);
        }
        solicitudesDueno.clear();
        solicitudesDuenoSembradas = true;
        listaNotificaciones.clear();
        hayNotificacionesSinLeer = false;
        mascotaActual = null;

        perfilInicializado = true;
        nombreUsuario = d.getNombre();
        emailUsuario = d.getEmail();
        telefonoUsuario = d.getTelefono();
        direccionUsuario = d.getDireccion();
        passwordUsuario = d.getPassword();
        profilePhotoUri = d.getFotoPath() != null ? Uri.fromFile(new java.io.File(d.getFotoPath())) : null;
    }

    private void restaurarDatosDemo() {
        EstadoDemo r = respaldoDemo;
        if (r == null) return;
        respaldoDemo = null;
        eventosPorFecha.clear();
        eventosPorFecha.putAll(r.eventos);
        listaVeterinariosAutorizados.clear();
        listaVeterinariosDisponibles.clear();
        for (Veterinario v : r.vetsEnOrden) {
            String[] estado = r.estadoVets.get(v);
            v.estado = estado[0];
            v.mascotasAsociadas = estado[1];
            if (r.autorizados.contains(v)) listaVeterinariosAutorizados.add(v); else listaVeterinariosDisponibles.add(v);
        }
        mascotasEliminadas.clear();
        mascotasEliminadas.addAll(r.mascotasEliminadas);
        mascotasNuevas.clear();
        mascotasNuevas.addAll(r.mascotasNuevas);
        solicitudesDueno.clear();
        solicitudesDueno.addAll(r.solicitudes);
        solicitudesDuenoSembradas = r.solicitudesSembradas;
        listaNotificaciones.clear();
        listaNotificaciones.addAll(r.notificaciones);
        hayNotificacionesSinLeer = r.hayNotificaciones;
        mascotaActual = null;
        perfilInicializado = r.perfilInicializado;
        nombreUsuario = r.nombre;
        emailUsuario = r.email;
        telefonoUsuario = r.telefono;
        direccionUsuario = r.direccion;
        passwordUsuario = r.password;
        profilePhotoUri = r.foto;
    }

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

        sincronizarAccesoPorTurnos();
    }

    private void showCalendarView() {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.calendario, container, true);

        highlightNavItem(-1);

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

        View btnHoy = findViewById(R.id.btnHoy);
        if (btnHoy != null) {
            btnHoy.setOnClickListener(v -> {
                bounceView(v);
                diaSeleccionado = LocalDate.now();
                mesCalendarioActual = YearMonth.now();
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

        int turnosDelMes = 0;
        for (Map.Entry<String, List<EventoMascota>> entry : eventosPorFecha.entrySet()) {
            try {
                if (YearMonth.from(LocalDate.parse(entry.getKey())).equals(mesCalendarioActual)) {
                    turnosDelMes += entry.getValue().size();
                }
            } catch (Exception ignored) {
            }
        }
        TextView tvSubtitulo = findViewById(R.id.tvCalSubtitle);
        if (tvSubtitulo != null) {
            tvSubtitulo.setText(turnosDelMes == 0 ? "Sin turnos este mes"
                    : turnosDelMes == 1 ? "1 turno este mes" : turnosDelMes + " turnos este mes");
        }

        GridLayout grid = findViewById(R.id.gridCalendario);
        if (grid != null) {
            grid.removeAllViews();

            LocalDate primerDia = mesCalendarioActual.atDay(1);
            int diasEnMes = mesCalendarioActual.lengthOfMonth();
            int primerDiaSemana = primerDia.getDayOfWeek().getValue(); // 1=Lunes .. 7=Domingo

            for (int i = 0; i < primerDiaSemana - 1; i++) {
                View vacio = new View(this);
                GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
                lp.width = 0;
                lp.height = dp(48);
                lp.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
                vacio.setLayoutParams(lp);
                grid.addView(vacio);
            }

            for (int dia = 1; dia <= diasEnMes; dia++) {
                grid.addView(buildCalendarDayCell(mesCalendarioActual.atDay(dia), dia));
            }
        }

        renderEventosDia();
    }

    private FrameLayout buildCalendarDayCell(LocalDate fecha, int dia) {
        FrameLayout cell = new FrameLayout(this);
        GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
        lp.width = 0;
        lp.height = dp(48);
        lp.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
        cell.setLayoutParams(lp);

        boolean seleccionado = fecha.equals(diaSeleccionado);
        boolean esHoy = fecha.equals(LocalDate.now());
        boolean esPasado = fecha.isBefore(LocalDate.now());

        TextView tvDia = new TextView(this);
        FrameLayout.LayoutParams tvLp = new FrameLayout.LayoutParams(dp(38), dp(38));
        tvLp.gravity = Gravity.CENTER_HORIZONTAL;
        tvLp.topMargin = dp(2);
        tvDia.setLayoutParams(tvLp);
        tvDia.setText(String.valueOf(dia));
        tvDia.setGravity(Gravity.CENTER);
        tvDia.setTextSize(14);
        if (seleccionado) {
            tvDia.setBackgroundResource(R.drawable.bg_day_selected);
            tvDia.setTextColor(ContextCompat.getColor(this, R.color.white));
            tvDia.setTypeface(tvDia.getTypeface(), Typeface.BOLD);
        } else if (esHoy) {
            tvDia.setBackgroundResource(R.drawable.bg_day_today);
            tvDia.setTextColor(ContextCompat.getColor(this, R.color.primary_teal));
            tvDia.setTypeface(tvDia.getTypeface(), Typeface.BOLD);
        } else {
            tvDia.setTextColor(ContextCompat.getColor(this, esPasado ? R.color.text_gray : R.color.brand_navy));
            tvDia.setAlpha(esPasado ? 0.6f : 1f);
        }
        cell.addView(tvDia);

        List<EventoMascota> eventos = eventosPorFecha.get(dateKey(fecha));
        if (eventos != null && !eventos.isEmpty()) {
            View punto = new View(this);
            FrameLayout.LayoutParams dotLp = new FrameLayout.LayoutParams(dp(6), dp(6));
            dotLp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            dotLp.bottomMargin = dp(1);
            punto.setLayoutParams(dotLp);
            punto.setBackgroundResource(esPasado ? R.drawable.bg_dot_teal : R.drawable.bg_dot_orange);
            cell.addView(punto);
        }

        cell.setOnClickListener(v -> {
            diaSeleccionado = fecha;
            renderCalendario();
        });

        return cell;
    }

    private void renderEventosDia() {
        TextView tvDiaSeleccionado = findViewById(R.id.tvDiaSeleccionado);
        TextView tvCantidad = findViewById(R.id.tvCantidadDia);
        LinearLayout listaEventos = findViewById(R.id.listaEventosDia);
        View vacio = findViewById(R.id.emptyDia);
        if (listaEventos == null) return;

        if (tvDiaSeleccionado != null) {
            String prefijo = diaSeleccionado.equals(LocalDate.now()) ? "Turnos de hoy · " : "Turnos del ";
            tvDiaSeleccionado.setText(prefijo + diaSeleccionado.getDayOfMonth() + " de "
                    + MESES[diaSeleccionado.getMonthValue() - 1].toLowerCase(Locale.ROOT));
        }

        listaEventos.removeAllViews();
        List<EventoMascota> eventos = eventosPorFecha.get(dateKey(diaSeleccionado));
        boolean sinEventos = eventos == null || eventos.isEmpty();

        if (tvCantidad != null) {
            tvCantidad.setVisibility(sinEventos ? View.GONE : View.VISIBLE);
            if (!sinEventos) tvCantidad.setText(eventos.size() == 1 ? "1 turno" : eventos.size() + " turnos");
        }

        if (vacio != null) {
            vacio.setVisibility(sinEventos ? View.VISIBLE : View.GONE);
            if (sinEventos) {
                ((ImageView) vacio.findViewById(R.id.ivEmptyIcon)).setImageResource(R.drawable.ic_calendar);
                ((TextView) vacio.findViewById(R.id.tvEmptyTitle)).setText("Sin turnos este día");
                ((TextView) vacio.findViewById(R.id.tvEmptyMessage)).setText(
                        "Agendá un control o una vacuna para tus mascotas");
                TextView cta = vacio.findViewById(R.id.tvEmptyCta);
                cta.setText("+ Agendar turno");
                cta.setVisibility(View.VISIBLE);
                cta.setOnClickListener(v -> showNuevoEventoView(diaSeleccionado));
            }
        }
        if (sinEventos) return;

        List<EventoMascota> ordenados = new ArrayList<>(eventos);
        Collections.sort(ordenados, (a, b) -> a.hora.compareTo(b.hora));
        for (EventoMascota evento : ordenados) {
            listaEventos.addView(buildEventoDiaCard(listaEventos, evento));
        }
    }

    private View buildEventoDiaCard(ViewGroup parent, EventoMascota evento) {
        View card = getLayoutInflater().inflate(R.layout.item_home_evento, parent, false);

        android.graphics.drawable.GradientDrawable fondoIcono = new android.graphics.drawable.GradientDrawable();
        fondoIcono.setCornerRadius(dp(13));
        fondoIcono.setColor(ContextCompat.getColor(this, getBgColorForCategory(evento.categoria)));
        card.findViewById(R.id.flIcono).setBackground(fondoIcono);
        ImageView icono = card.findViewById(R.id.ivIcono);
        icono.setImageResource(getIconForCategory(evento.categoria));
        icono.setColorFilter(ContextCompat.getColor(this, getColorFgParaCategoria(evento.categoria)));

        ((TextView) card.findViewById(R.id.tvTitulo)).setText(
                "Vacuna".equals(evento.categoria) ? "Vacunación" : evento.categoria);
        String vet = evento.veterinario != null && !evento.veterinario.isEmpty() ? " · " + evento.veterinario : "";
        ((TextView) card.findViewById(R.id.tvSubtitulo)).setText(evento.mascota + vet);

        TextView chip = card.findViewById(R.id.tvChip);
        chip.setText(evento.hora);
        chip.setBackgroundResource(R.drawable.bg_chip_neutral);
        chip.setTextColor(ContextCompat.getColor(this, R.color.teal_dark));
        card.findViewById(R.id.ivChevron).setVisibility(View.VISIBLE);

        card.setOnClickListener(v -> mostrarDetalleTurno(evento));
        return card;
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
        etFecha.setOnClickListener(v -> {
            DatePickerDialog dpd = new DatePickerDialog(this, (view, y, m, d) -> {
                LocalDate nuevaFecha = LocalDate.of(y, m + 1, d);
                if (nuevaFecha.isBefore(LocalDate.now())) {
                    Toast.makeText(this, "No podés seleccionar una fecha que ya pasó", Toast.LENGTH_SHORT).show();
                    return;
                }
                fecha[0] = nuevaFecha;
                etFecha.setText(d + " de " + MESES[m] + " de " + y);
            }, fecha[0].getYear(), fecha[0].getMonthValue() - 1, fecha[0].getDayOfMonth());
            dpd.getDatePicker().setMinDate(System.currentTimeMillis() - 1000);
            dpd.show();
        });

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
                    if (fecha[0].isBefore(LocalDate.now())) {
                        Toast.makeText(this, "No podés seleccionar una fecha que ya pasó", Toast.LENGTH_SHORT).show();
                        return;
                    }
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
                    if (evento.veterinario != null && !evento.veterinario.isEmpty()) {
                        autorizarVeterinarioPorTurno(evento.veterinario, evento.mascota, true);
                    }
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














    private static final String[] CATEGORIAS_EVENTO = {"Vacuna", "Control", "Cirugía", "Estudio / Tratamiento"};
    private static final String[] HORAS_EVENTO = {"09:00", "10:00", "11:00", "12:00", "14:00", "15:00",
            "16:00", "17:00", "18:00"};
    private static final String[] SUBTITULOS_PASO = {
            "Paso 1 de 3 · Tipo de evento y mascota",
            "Paso 2 de 3 · Veterinario, fecha y hora",
            "Paso 3 de 3 · Revisá y confirmá"};

    private String presetMascotaEvento = null;

    private int[] idsCategoriasEvento() {
        return new int[]{R.id.optVacuna, R.id.optControl, R.id.optCirugia, R.id.optEstudio};
    }

    private void showNuevoEventoView(LocalDate fecha) {
        ensureAppBaseSet();
        ViewGroup container = findViewById(R.id.content_container);
        container.removeAllViews();
        getLayoutInflater().inflate(R.layout.nuevo_evento, container, true);

        highlightNavItem(-1);

        LocalDate fechaInicial = (fecha == null || fecha.isBefore(LocalDate.now())) ? LocalDate.now() : fecha;
        if (horaValidaPara(fechaInicial, "11:00") == null) fechaInicial = fechaInicial.plusDays(1);

        fechaEventoNuevo = fechaInicial;
        mesEventoNuevo = YearMonth.from(fechaInicial);
        stepperActual = 1;
        categoriaNuevoEvento = null;
        mascotaNuevoEvento = presetMascotaEvento;
        presetMascotaEvento = null;
        veterinarioNuevoEvento = null;
        horaNuevoEvento = horaValidaPara(fechaInicial, "11:00");
        observacionesNuevoEvento = "";

        View btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> showCalendarView());
        }

        int[] ids = idsCategoriasEvento();
        for (int i = 0; i < ids.length; i++) {
            View opcion = findViewById(ids[i]);
            final String categoria = CATEGORIAS_EVENTO[i];
            if (opcion == null) continue;
            opcion.setOnClickListener(v -> {
                bounceView(v);
                categoriaNuevoEvento = categoria;
                veterinarioNuevoEvento = null;
                actualizarSeleccionCategoriaUI();
            });
        }

        View btnMesAnteriorMini = findViewById(R.id.btnMesAnteriorMini);
        if (btnMesAnteriorMini != null) {
            btnMesAnteriorMini.setOnClickListener(v -> {
                if (mesEventoNuevo.isAfter(YearMonth.now())) {
                    mesEventoNuevo = mesEventoNuevo.minusMonths(1);
                    renderCalendarioMini();
                } else {
                    Toast.makeText(this, "No podés seleccionar una fecha que ya pasó", Toast.LENGTH_SHORT).show();
                }
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
                    if (stepperActual == 2) guardarObservacionesEvento();
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
                    if (fechaEventoNuevo.isBefore(LocalDate.now())) {
                        Toast.makeText(this, "No podés seleccionar una fecha que ya pasó", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    if (horaNuevoEvento == null || horaPasada(fechaEventoNuevo, horaNuevoEvento)) {
                        Toast.makeText(this, "Elegí un horario disponible", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    if (hayConflictoDeTurno(fechaEventoNuevo, horaNuevoEvento, mascotaNuevoEvento)) {
                        Toast.makeText(this, mascotaNuevoEvento + " ya tiene un turno en ese horario", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    guardarObservacionesEvento();
                    stepperActual = 3;
                    actualizarStepperUI();
                } else {
                    if (fechaEventoNuevo.isBefore(LocalDate.now())) {
                        Toast.makeText(this, "No podés seleccionar una fecha que ya pasó", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    agregarEvento(fechaEventoNuevo, categoriaNuevoEvento, mascotaNuevoEvento, veterinarioNuevoEvento, horaNuevoEvento, observacionesNuevoEvento);
                    compartirTurnoConVeterinario(fechaEventoNuevo, categoriaNuevoEvento, mascotaNuevoEvento,
                            veterinarioNuevoEvento, horaNuevoEvento, observacionesNuevoEvento);
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

                    Toast.makeText(this, "Evento guardado", Toast.LENGTH_SHORT).show();
                    showCalendarView();
                }
            });
        }

        renderMascotasEvento();
        actualizarStepperUI();
    }

    private void guardarObservacionesEvento() {
        EditText etObservaciones = findViewById(R.id.etObservaciones);
        if (etObservaciones != null) {
            observacionesNuevoEvento = etObservaciones.getText().toString().trim();
        }
    }

    private boolean horaPasada(LocalDate fecha, String hora) {
        if (!fecha.equals(LocalDate.now())) return false;
        try {
            return java.time.LocalTime.parse(hora).isBefore(java.time.LocalTime.now());
        } catch (Exception e) {
            return false;
        }
    }

    private String horaValidaPara(LocalDate fecha, String preferida) {
        if (preferida != null && !horaPasada(fecha, preferida)) return preferida;
        for (String hora : HORAS_EVENTO) {
            if (!horaPasada(fecha, hora)) return hora;
        }
        return null;
    }

    private boolean hayConflictoDeTurno(LocalDate fecha, String hora, String mascota) {
        List<EventoMascota> lista = eventosPorFecha.get(dateKey(fecha));
        if (lista == null || mascota == null) return false;
        for (EventoMascota e : lista) {
            if (hora.equals(e.hora) && mascota.equalsIgnoreCase(e.mascota)) return true;
        }
        return false;
    }

    private void actualizarSeleccionCategoriaUI() {
        int[] ids = idsCategoriasEvento();
        for (int i = 0; i < ids.length; i++) {
            View opcion = findViewById(ids[i]);
            if (opcion == null) continue;
            boolean activa = CATEGORIAS_EVENTO[i].equals(categoriaNuevoEvento);
            opcion.setBackgroundResource(activa ? R.drawable.bg_card_selected : R.drawable.bg_card_white);
            View check = opcion.findViewWithTag("check");
            if (check != null) check.setVisibility(activa ? View.VISIBLE : View.GONE);
        }
    }

    private void renderMascotasEvento() {
        LinearLayout fila = findViewById(R.id.llMascotasEvento);
        if (fila == null) return;
        fila.removeAllViews();

        List<Mascota> mascotas = mascotasVisibles();
        boolean existe = false;
        for (Mascota m : mascotas) {
            if (m.nombre.equals(mascotaNuevoEvento)) existe = true;
        }
        if (!existe) mascotaNuevoEvento = null;

        for (Mascota m : mascotas) {
            boolean activa = m.nombre.equals(mascotaNuevoEvento);

            LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.VERTICAL);
            item.setGravity(Gravity.CENTER_HORIZONTAL);
            LinearLayout.LayoutParams itemLp = new LinearLayout.LayoutParams(dp(78), LinearLayout.LayoutParams.WRAP_CONTENT);
            itemLp.setMarginEnd(dp(6));
            item.setLayoutParams(itemLp);
            item.setClickable(true);
            item.setFocusable(true);

            FrameLayout marco = new FrameLayout(this);
            marco.setLayoutParams(new LinearLayout.LayoutParams(dp(66), dp(66)));
            marco.setPadding(dp(3), dp(3), dp(3), dp(3));
            marco.setBackgroundResource(activa ? R.drawable.bg_pet_ring : R.drawable.circular_white);
            marco.setElevation(dp(2));

            if (m.fotoUri != null || m.fotoRes != 0) {
                ShapeableImageView foto = new ShapeableImageView(this);
                foto.setLayoutParams(new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
                foto.setScaleType(ImageView.ScaleType.CENTER_CROP);
                foto.setShapeAppearanceModel(foto.getShapeAppearanceModel().toBuilder()
                        .setAllCornerSizes(new RelativeCornerSize(0.5f)).build());
                if (m.fotoUri != null) foto.setImageURI(m.fotoUri); else foto.setImageResource(m.fotoRes);
                marco.addView(foto);
            } else {
                TextView inicial = new TextView(this);
                inicial.setLayoutParams(new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
                inicial.setGravity(Gravity.CENTER);
                inicial.setBackgroundResource(R.drawable.bg_circle_light_teal);
                inicial.setText(m.nombre.substring(0, 1).toUpperCase(Locale.ROOT));
                inicial.setTextColor(ContextCompat.getColor(this, R.color.primary_teal));
                inicial.setTextSize(22);
                inicial.setTypeface(inicial.getTypeface(), Typeface.BOLD);
                marco.addView(inicial);
            }
            item.addView(marco);

            TextView nombre = new TextView(this);
            LinearLayout.LayoutParams nombreLp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            nombreLp.topMargin = dp(6);
            nombre.setLayoutParams(nombreLp);
            nombre.setText(m.nombre);
            nombre.setTextSize(13);
            nombre.setTypeface(nombre.getTypeface(), activa ? Typeface.BOLD : Typeface.NORMAL);
            nombre.setTextColor(ContextCompat.getColor(this, activa ? R.color.primary_teal : R.color.text_gray));
            item.addView(nombre);

            item.setOnClickListener(v -> {
                bounceView(v);
                mascotaNuevoEvento = m.nombre;
                renderMascotasEvento();
            });
            fila.addView(item);
        }
    }

    private String estadoVeterinarioTexto(String estado) {
        if ("ACTIVO".equals(estado)) return "Con acceso";
        if ("INACTIVO".equals(estado)) return "Sin acceso · se restablece al agendar";
        return "Tendrá acceso al agendar";
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
        card.setPadding(dp(14), dp(12), dp(14), dp(12));
        card.setBackgroundResource(seleccionado ? R.drawable.bg_card_selected : R.drawable.bg_card_white);
        card.setElevation(dp(2));
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.bottomMargin = dp(10);
        card.setLayoutParams(cardLp);

        FrameLayout icono = new FrameLayout(this);
        icono.setLayoutParams(new LinearLayout.LayoutParams(dp(44), dp(44)));
        icono.setBackgroundResource(R.drawable.bg_icon_tile);
        ImageView imagen = new ImageView(this);
        FrameLayout.LayoutParams imagenLp = new FrameLayout.LayoutParams(dp(22), dp(22));
        imagenLp.gravity = Gravity.CENTER;
        imagen.setLayoutParams(imagenLp);
        imagen.setImageResource(R.drawable.ic_medical_kit);
        imagen.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
        icono.addView(imagen);
        card.addView(icono);

        LinearLayout textos = new LinearLayout(this);
        textos.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams textosLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        textosLp.setMarginStart(dp(12));
        textos.setLayoutParams(textosLp);

        TextView tvNombre = new TextView(this);
        tvNombre.setText(vet.nombre);
        tvNombre.setTextColor(ContextCompat.getColor(this, R.color.brand_navy));
        tvNombre.setTextSize(15);
        tvNombre.setTypeface(tvNombre.getTypeface(), Typeface.BOLD);
        textos.addView(tvNombre);

        TextView tvDetalle = new TextView(this);
        tvDetalle.setText(vet.matricula + " · " + estadoVeterinarioTexto(vet.estado));
        tvDetalle.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        tvDetalle.setTextSize(12.5f);
        textos.addView(tvDetalle);
        card.addView(textos);

        ImageView marca = new ImageView(this);
        marca.setLayoutParams(new LinearLayout.LayoutParams(dp(24), dp(24)));
        if (seleccionado) {
            marca.setImageResource(R.drawable.ic_check_circle);
            marca.setColorFilter(ContextCompat.getColor(this, R.color.primary_teal));
        } else {
            marca.setImageResource(R.drawable.ic_chevron_right);
            marca.setColorFilter(ContextCompat.getColor(this, R.color.text_gray));
        }
        card.addView(marca);

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
            View vacio = new View(this);
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
            lp.width = 0;
            lp.height = dp(42);
            lp.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
            vacio.setLayoutParams(lp);
            grid.addView(vacio);
        }

        for (int dia = 1; dia <= diasEnMes; dia++) {
            grid.addView(buildMiniDayCell(mesEventoNuevo.atDay(dia), dia));
        }
    }

    private FrameLayout buildMiniDayCell(LocalDate fecha, int dia) {
        FrameLayout celda = new FrameLayout(this);
        GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
        lp.width = 0;
        lp.height = dp(42);
        lp.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
        celda.setLayoutParams(lp);

        boolean esPasado = fecha.isBefore(LocalDate.now());
        boolean esHoy = fecha.equals(LocalDate.now());
        boolean seleccionado = fecha.equals(fechaEventoNuevo);

        TextView tvDia = new TextView(this);
        FrameLayout.LayoutParams tvLp = new FrameLayout.LayoutParams(dp(36), dp(36));
        tvLp.gravity = Gravity.CENTER;
        tvDia.setLayoutParams(tvLp);
        tvDia.setText(String.valueOf(dia));
        tvDia.setGravity(Gravity.CENTER);
        tvDia.setTextSize(14);
        if (seleccionado) {
            tvDia.setBackgroundResource(R.drawable.bg_day_selected);
            tvDia.setTextColor(ContextCompat.getColor(this, R.color.white));
            tvDia.setTypeface(tvDia.getTypeface(), Typeface.BOLD);
        } else if (esPasado) {
            tvDia.setTextColor(ContextCompat.getColor(this, R.color.text_gray));
            tvDia.setAlpha(0.4f);
        } else {
            tvDia.setTextColor(ContextCompat.getColor(this, esHoy ? R.color.primary_teal : R.color.brand_navy));
            if (esHoy) tvDia.setTypeface(tvDia.getTypeface(), Typeface.BOLD);
        }
        celda.addView(tvDia);

        celda.setOnClickListener(v -> {
            if (esPasado) {
                Toast.makeText(this, "No podés seleccionar una fecha que ya pasó", Toast.LENGTH_SHORT).show();
                return;
            }
            bounceView(tvDia);
            fechaEventoNuevo = fecha;
            horaNuevoEvento = horaValidaPara(fecha, horaNuevoEvento);
            renderCalendarioMini();
            renderHorasEvento();
        });

        return celda;
    }

    private void renderHorasEvento() {
        GridLayout grid = findViewById(R.id.gridHoras);
        if (grid == null) return;
        grid.removeAllViews();

        for (String hora : HORAS_EVENTO) {
            boolean pasada = horaPasada(fechaEventoNuevo, hora);
            boolean ocupada = hayConflictoDeTurno(fechaEventoNuevo, hora, mascotaNuevoEvento);
            boolean deshabilitada = pasada || ocupada;
            boolean activa = hora.equals(horaNuevoEvento) && !deshabilitada;

            TextView chip = new TextView(this);
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
            lp.width = 0;
            lp.height = dp(46);
            lp.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
            lp.setMargins(dp(4), dp(4), dp(4), dp(4));
            chip.setLayoutParams(lp);
            chip.setGravity(Gravity.CENTER);
            chip.setText(hora);
            chip.setTextSize(15);
            chip.setTypeface(chip.getTypeface(), Typeface.BOLD);
            chip.setBackgroundResource(activa ? R.drawable.bg_time_chip_selected : R.drawable.bg_time_chip);
            chip.setTextColor(ContextCompat.getColor(this, activa ? R.color.white : R.color.brand_navy));
            chip.setAlpha(deshabilitada ? 0.4f : 1f);
            chip.setClickable(true);
            chip.setOnClickListener(v -> {
                if (pasada) {
                    Toast.makeText(this, "Ese horario ya pasó", Toast.LENGTH_SHORT).show();
                    return;
                }
                if (ocupada) {
                    Toast.makeText(this, mascotaNuevoEvento + " ya tiene un turno a esa hora", Toast.LENGTH_SHORT).show();
                    return;
                }
                bounceView(v);
                horaNuevoEvento = hora;
                renderHorasEvento();
            });
            grid.addView(chip);
        }
    }

    private void actualizarStepperUI() {
        int[] contentIds = {R.id.step1Content, R.id.step2Content, R.id.step3Content};
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

        int[] circleIds = {R.id.step1Circle, R.id.step2Circle, R.id.step3Circle};
        int[] labelIds = {R.id.step1Label, R.id.step2Label, R.id.step3Label};
        for (int i = 0; i < circleIds.length; i++) {
            TextView circle = findViewById(circleIds[i]);
            TextView label = findViewById(labelIds[i]);
            boolean activo = (i + 1) == stepperActual;
            boolean completado = (i + 1) < stepperActual;
            if (circle != null) {
                circle.setBackgroundResource(completado ? R.drawable.bg_step_done
                        : activo ? R.drawable.bg_step_current : R.drawable.bg_step_pending);
                circle.setText(completado ? "✓" : String.valueOf(i + 1));
                circle.setTextColor(ContextCompat.getColor(this, completado ? R.color.white
                        : activo ? R.color.primary_teal : R.color.text_gray));
            }
            if (label != null) {
                label.setTextColor(ContextCompat.getColor(this, (activo || completado) ? R.color.primary_teal : R.color.text_gray));
            }
        }

        int[] lineIds = {R.id.line1, R.id.line2};
        for (int i = 0; i < lineIds.length; i++) {
            View line = findViewById(lineIds[i]);
            if (line == null) continue;
            boolean completado = (i + 1) < stepperActual;
            line.setBackgroundColor(completado ? ContextCompat.getColor(this, R.color.primary_teal)
                    : android.graphics.Color.parseColor("#E6EAE9"));
        }

        TextView subtitulo = findViewById(R.id.tvStepSubtitle);
        if (subtitulo != null) subtitulo.setText(SUBTITULOS_PASO[stepperActual - 1]);

        TextView btnAtrasCancelar = findViewById(R.id.btnAtrasCancelar);
        TextView btnSiguienteGuardar = findViewById(R.id.btnSiguienteGuardar);
        if (btnAtrasCancelar != null) {
            btnAtrasCancelar.setText(stepperActual == 1 ? getString(R.string.btn_cancelar) : getString(R.string.btn_atras));
        }
        if (btnSiguienteGuardar != null) {
            btnSiguienteGuardar.setText(stepperActual == 3 ? getString(R.string.btn_guardar_evento) : getString(R.string.btn_siguiente));
        }

        if (stepperActual == 1) {
            actualizarSeleccionCategoriaUI();
            renderMascotasEvento();
        } else if (stepperActual == 2) {
            renderVeterinarioOptions();
            renderCalendarioMini();
            renderHorasEvento();
        } else {
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

        if (tvResumenCategoria != null) {
            tvResumenCategoria.setText("Vacuna".equals(categoriaNuevoEvento) ? "Vacunación" : categoriaNuevoEvento);
        }
        if (tvResumenMascota != null) tvResumenMascota.setText(mascotaNuevoEvento);
        if (tvResumenVeterinario != null) tvResumenVeterinario.setText(veterinarioNuevoEvento);
        if (tvResumenFecha != null) {
            tvResumenFecha.setText(fechaEventoNuevo.getDayOfMonth() + " de " + MESES[fechaEventoNuevo.getMonthValue() - 1]
                    + ", " + fechaEventoNuevo.getYear());
        }
        if (tvResumenHora != null) tvResumenHora.setText(horaNuevoEvento + " hs");
        if (tvResumenObservaciones != null) {
            tvResumenObservaciones.setText(observacionesNuevoEvento.isEmpty()
                    ? getString(R.string.sin_observaciones) : observacionesNuevoEvento);
        }
        TextView tvNotaAcceso = findViewById(R.id.tvNotaAcceso);
        if (tvNotaAcceso != null) {
            tvNotaAcceso.setText(veterinarioNuevoEvento + " va a poder ver la ficha de " + mascotaNuevoEvento
                    + " apenas confirmes el turno. No hace falta autorizarlo.");
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
            btnBack.setOnClickListener(v -> showHomeView());
        }

        TextView[] chips = new TextView[]{
                findViewById(R.id.btnFiltroTodos),
                findViewById(R.id.btnFiltroActivos),
                findViewById(R.id.btnFiltroInactivos)};
        String[] estados = new String[]{"TODOS", "ACTIVO", "INACTIVO"};

        filtroEstadoSeleccionado = "TODOS";
        consultaBusquedaVet = "";

        for (int i = 0; i < chips.length; i++) {
            final String est = estados[i];
            if (chips[i] != null) {
                chips[i].setOnClickListener(v -> {
                    filtroEstadoSeleccionado = est;
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
            btnAgregarVeterinario.setOnClickListener(v -> {
                bounceView(v);
                mostrarDialogoAutorizarVeterinario();
            });
        }

        renderListaVeterinarios();
    }

    private void renderListaVeterinarios() {
        LinearLayout listaContainer = findViewById(R.id.listaVeterinarios);
        TextView tvSinResultados = findViewById(R.id.tvSinResultados);
        if (listaContainer == null) return;

        listaContainer.removeAllViews();

        String query = consultaBusquedaVet.toLowerCase(Locale.getDefault());
        List<Veterinario> filtrados = new ArrayList<>();
        int conAcceso = 0;

        for (Veterinario vet : listaVeterinariosAutorizados) {
            if ("ACTIVO".equalsIgnoreCase(vet.estado)) conAcceso++;

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

        TextView tvCount = findViewById(R.id.tvVetsCount);
        if (tvCount != null) {
            tvCount.setText(conAcceso == 1 ? "1 con acceso a tus mascotas" : conAcceso + " con acceso a tus mascotas");
        }

        String[] filtros = {"TODOS", "ACTIVO", "INACTIVO"};
        int[] chipIds = {R.id.btnFiltroTodos, R.id.btnFiltroActivos, R.id.btnFiltroInactivos};
        for (int i = 0; i < chipIds.length; i++) {
            TextView chip = findViewById(chipIds[i]);
            if (chip == null) continue;
            boolean activo = filtros[i].equals(filtroEstadoSeleccionado);
            chip.setBackgroundResource(activo ? R.drawable.bg_pill_teal : R.drawable.bg_pill_white);
            chip.setTextColor(ContextCompat.getColor(this, activo ? R.color.white : R.color.text_gray));
        }

        if (tvSinResultados != null) {
            tvSinResultados.setVisibility(filtrados.isEmpty() ? View.VISIBLE : View.GONE);
        }
        for (Veterinario vet : filtrados) {
            listaContainer.addView(buildCardVeterinarioAutorizado(vet, listaContainer));
        }
    }

    private View buildCardVeterinarioAutorizado(Veterinario vet, ViewGroup parent) {
        View card = getLayoutInflater().inflate(R.layout.item_veterinario, parent, false);
        boolean activo = "ACTIVO".equalsIgnoreCase(vet.estado);

        String sinTitulo = vet.nombre.replaceFirst("^Dra?\\.\\s*", "");
        ((TextView) card.findViewById(R.id.tvInicial)).setText(
                sinTitulo.isEmpty() ? "?" : sinTitulo.substring(0, 1).toUpperCase(Locale.ROOT));
        ((TextView) card.findViewById(R.id.tvNombre)).setText(vet.nombre);
        int turnos = turnosDeVeterinario(vet);
        ((TextView) card.findViewById(R.id.tvDatos)).setText(vet.especialidad + " · " + vet.matricula + " · "
                + (turnos == 1 ? "1 turno" : turnos + " turnos"));

        TextView tvEstado = card.findViewById(R.id.tvEstado);
        tvEstado.setText(activo ? "Con acceso" : "Sin acceso");
        tvEstado.setBackgroundResource(activo ? R.drawable.bg_chip_ok : R.drawable.bg_chip_danger);
        tvEstado.setTextColor(ContextCompat.getColor(this, activo ? R.color.success_green : R.color.danger_red));

        LinearLayout llMascotas = card.findViewById(R.id.llMascotas);
        View labelMascotas = card.findViewById(R.id.tvMascotasLabel);
        boolean hayMascotas = vet.mascotasAsociadas != null && !vet.mascotasAsociadas.trim().isEmpty();
        labelMascotas.setVisibility(hayMascotas ? View.VISIBLE : View.GONE);
        llMascotas.setVisibility(hayMascotas ? View.VISIBLE : View.GONE);
        if (hayMascotas) {
            for (String nombre : vet.mascotasAsociadas.split(",")) {
                if (nombre.trim().isEmpty()) continue;
                TextView chip = new TextView(this);
                chip.setLayoutParams(new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
                ((LinearLayout.LayoutParams) chip.getLayoutParams()).setMarginEnd(dp(6));
                chip.setBackgroundResource(R.drawable.bg_chip_neutral);
                chip.setPadding(dp(10), dp(4), dp(10), dp(4));
                chip.setText(nombre.trim());
                chip.setTextColor(ContextCompat.getColor(this, R.color.teal_dark));
                chip.setTextSize(12);
                chip.setTypeface(chip.getTypeface(), Typeface.BOLD);
                llMascotas.addView(chip);
            }
        }

        String proximo = proximoTurnoDeVeterinario(vet);
        ((TextView) card.findViewById(R.id.tvTurno)).setText(
                proximo != null ? "Próximo turno: " + proximo : "Sin turnos próximos");

        TextView btnAccion = card.findViewById(R.id.btnAccion);
        if (activo) {
            btnAccion.setText("Revocar acceso");
            btnAccion.setTextColor(ContextCompat.getColor(this, R.color.danger_red));
            btnAccion.setOnClickListener(v -> new AlertDialog.Builder(this)
                    .setTitle("Revocar acceso")
                    .setMessage(vet.nombre + " dejará de ver las fichas de tus mascotas hasta que agendes un nuevo turno.")
                    .setPositiveButton("Revocar", (d, w) -> {
                        vet.estado = "INACTIVO";
                        Toast.makeText(this, getString(R.string.vet_desautorizado_exito, vet.nombre), Toast.LENGTH_SHORT).show();
                        renderListaVeterinarios();
                    })
                    .setNegativeButton(R.string.btn_cancelar, null)
                    .show());
        } else {
            btnAccion.setText("Restablecer acceso");
            btnAccion.setTextColor(ContextCompat.getColor(this, R.color.primary_teal));
            btnAccion.setOnClickListener(v -> {
                vet.estado = "ACTIVO";
                Toast.makeText(this, getString(R.string.vet_autorizado_exito, vet.nombre), Toast.LENGTH_SHORT).show();
                renderListaVeterinarios();
            });
        }
        return card;
    }

    private String todasLasMascotasTexto() {
        List<String> nombres = new ArrayList<>();
        for (Mascota m : mascotasVisibles()) nombres.add(m.nombre);
        return android.text.TextUtils.join(", ", nombres);
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
                            listaVeterinariosDisponibles.remove(vet);
                            Veterinario nuevoAuth = new Veterinario(vet.nombre, vet.usuario, vet.email, vet.matricula, vet.especialidad, "ACTIVO", todasLasMascotasTexto());
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