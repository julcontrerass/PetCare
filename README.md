# PetCare

App Android de historial clínico de mascotas. Tiene tres tipos de usuario: **dueño**, **veterinario** y **administrador**. Los datos viven en un proyecto de [Supabase](https://supabase.com) (Postgres, Auth y Storage).

## Estructura del código

El paquete base es `frgp.utn.edu.petcare`.

| Carpeta | Qué contiene |
|---|---|
| `ui/auth` | `AuthActivity` (bienvenida, ingreso y recuperación de contraseña, deriva a cada rol) y las pantallas de registro de dueño y de veterinario. |
| `ui/dueno` | App del dueño. `DuenoActivity` es el contenedor (barra inferior y navegación) y cada sección es una `Pantalla`. Incluye el carnet de salud. |
| `ui/veterinario` | App del veterinario: inicio, agenda, pacientes, informe de la consulta, perfil, solicitudes de acceso y vacunas a recordar. |
| `ui/admin` | Panel del administrador: cuentas, revisión de veterinarios y registro de actividad. |
| `ui/common` | Piezas de interfaz compartidas: `BaseActivity`, avisos, hojas de selección, PDFs (`Documentos`) y gráfico de peso. |
| `model` | Clases de datos del dueño (`Mascota`, `EventoMascota`, `VeterinarioAcceso`...) y de la historia clínica. |
| `data` | `Sesion` (quién ingresó y carga de sus datos), `Registro`, `Servicios`, `Errores`, `Imagenes` y el catálogo médico. |
| `data/repositorio` | Un repositorio por tema, con la copia en memoria de lo que dice el servidor: `DuenoRepo`, `AgendaRepo`, `PacientesRepo`, `InformesRepo`, `SaludRepo`, `AdminRepo`... |
| `data/remoto` | Conexión con Supabase: `FuenteDatos` (lo que la app le pide al servidor), `SupabaseFuente` (la implementación real) y los `Dtos` de cada tabla. |
| `data/avisos` | Recordatorios locales (turnos, vacunas, medicación) y avisos del sistema. |
| `util` | `Fechas`: formato de fechas y horas. |

### Cómo fluyen los datos

1. `AuthActivity` llama a `Sesion.ingresar` (o `Sesion.restaurar` si el teléfono ya tiene una sesión). `Sesion` pide el perfil, bloquea las cuentas en revisión, rechazadas o suspendidas y, según el rol, carga los repositorios.
2. Los repositorios (`DuenoRepo`, `AgendaRepo`, `PacientesRepo`...) guardan una copia en memoria de lo que dice el servidor, así las pantallas leen sin esperar.
3. Cada cambio se ve enseguida y se manda a Supabase en segundo plano con `Servicios.escribir`. Si el servidor lo rechaza (por ejemplo, un horario ocupado) se avisa con un mensaje y se vuelven a pedir los datos reales.
4. Lo que el servidor calcula solo (accesos de un veterinario al agendar un turno, notificaciones, actividad del administrador) se vuelve a pedir después de cada cambio y cada 30 segundos mientras la pantalla del dueño está abierta.

La seguridad no depende de la app: todas las tablas tienen RLS y los permisos por columna están definidos en la base. La clave que usa la app (`SUPABASE_KEY` en `app/build.gradle.kts`) es la *publishable*, pensada para estar en el cliente.

### Cómo se arma la app del dueño

`DuenoActivity` muestra una barra inferior fija y, arriba, una sola sección por vez. Cada sección extiende `Pantalla`, se dibuja con `mostrar()` dentro del contenedor y navega con los métodos `irA...()` de la actividad. Lo que comparten las secciones (la mascota abierta, el día elegido en el calendario) vive en `DuenoActivity`; los datos viven en `DuenoRepo`.

Para agregar una sección: crear la `Pantalla`, un método `irA...()` en `DuenoActivity` y, si va en la barra, el ítem en `BarraInferior`.

## Configuración en Supabase

- **Correo de confirmación:** el registro pide confirmar el correo si está activado en *Authentication → Providers → Email*. El servidor de correo incluido en Supabase manda muy pocos mensajes por hora; para producción conviene configurar un SMTP propio.
- **Contraseñas filtradas:** activar *Leaked password protection* en *Authentication → Policies*.
- **Cuenta de administrador:** se crea una sola vez desde el panel de Supabase (usuario con rol `admin` en `profiles`); la app no permite registrarse como administrador.

### Turnos: duración y tipos de animal

- Cada servicio o especialidad tiene una duración habitual (`CatalogoMedico.duracionPorDefecto`, que tiene que coincidir con `private.duracion_por_defecto` en la base). El veterinario puede cambiarla desde su perfil (*Duración de los turnos*); queda en `veterinarios.duraciones`.
- La duración real de un turno la fija el servidor al crearlo (`turnos.duracion_min`, trigger `turnos_duracion`) y de ahí sale el rango que impide superposiciones. La app calcula lo mismo para mostrar solo los horarios en los que el turno entra completo.
- El veterinario elige qué animales atiende al registrarse o desde su perfil (`veterinarios.tipos_animales`). El dueño solo ve veterinarios que atienden el tipo de su mascota y la base rechaza el turno si no es así.

### Lugares de atención

- Un veterinario puede atender en hasta 3 lugares (tabla `sedes`), cada uno con su nombre, dirección, días y horario. Se cargan desde *Perfil → Lugares de atención*; el primero es el principal y sus datos se reflejan en `veterinarios.clinica`, `direccion_clinica`, `dias_atencion` y `hora_*` (lo que leen las versiones anteriores de la app).
- Cada turno guarda dónde es (`turnos.sede_id`). El dueño elige el lugar al sacar el turno y los horarios que ve salen de ese lugar; el trigger `turnos_validar` valida el turno contra el lugar elegido (o, si no viene, contra el primero que atiende ese día y a esa hora).
- La agenda es una sola: un turno en un lugar bloquea el mismo horario en los demás (la restricción `turnos_sin_superposicion_vet` no distingue lugares).
- No se puede borrar el único lugar ni uno con turnos pendientes.

### Historia clínica, recetas y avisos de salud

- **Informe de consulta (SOAP):** motivo, anamnesis, signos vitales (peso, temperatura, frecuencia cardíaca y respiratoria), examen físico, diagnóstico y plan. El peso medido pasa a ser el peso actual de la mascota (trigger `informes_peso`) y alimenta el gráfico de evolución.
- **Vacunas:** guardan producto, lote y vencimiento del lote. El veterinario tiene la lista *Vacunas a recordar* (vencidas o por vencer en 30 días) con atajos a WhatsApp y llamada.
- **Recetas:** un medicamento por fila en `prescripciones`; las de una consulta forman la receta, que se comparte en PDF. Si tienen frecuencia y duración, el dueño recibe un aviso en cada toma.
- **Certificados:** de vacunación y de salud en PDF con la matrícula del veterinario (`ui/common/Documentos.kt`).
- **Avisos al dueño:** una semana antes y el día de cada próxima dosis, y una sola vez cuando una vacuna ya venció (`Recordatorios.paraVacunas`).
- **Alertas clínicas** de la mascota (alergias, carácter), editables por el veterinario con acceso (`guardar_alertas`).

### Una cuenta, dos modos: dueño y veterinario

Una misma cuenta (un correo, una contraseña) puede usarse como dueño de mascotas y como veterinario:

- **Rol de veterinario con revisión propia:** `veterinarios.estado_revision` guarda si el alta fue aprobada. La cuenta de dueño sigue activa mientras el administrador revisa. Quien se registró como veterinario sigue el mismo estado que su cuenta (un disparador los mantiene juntos).
- **Cómo se suma el rol:** el dueño toca *Soy veterinario/a: pedir el alta* en su perfil, carga matrícula, clínica, horarios y la **foto de su carnet o matrícula** (bucket privado `credenciales`, solo la ve el administrador) y la función `solicitar_alta_veterinario` lo deja pendiente. Los veterinarios nuevos suben el mismo carnet al registrarse.
- **Revisión:** en el panel del administrador, *Ver foto del carnet o matrícula* y los botones de alta, rechazo o suspensión llaman a `revisar_veterinario`, que solo toca el rol (la cuenta de dueño no se suspende).
- **Al ingresar** con las dos posibilidades activas, la app pregunta *¿Cómo querés ingresar?* (`Sesion.Resultado.Elegir`). Un veterinario sin mascotas propias entra directo. Desde el perfil se puede pasar de un modo al otro sin cerrar sesión (`ModoDeUso`).
- **Seguridad:** las políticas y funciones de la base usan `private.es_vet_activo()` (rol aprobado y cuenta activa) en lugar de un rol único. Quien es veterinario de una mascota propia no se pide acceso a sí mismo: la ve desde el modo dueño.

### Cuentas de dueños creadas por el veterinario

Un dueño que todavía no usa la app puede recibir su cuenta en el consultorio, sin pasar por un turno:

1. El veterinario carga al dueño (nombre, DNI, teléfono, correo) y a la mascota en *Nuevo dueño y mascota* (`NuevoDuenoActivity`), o elige *Crear cuenta del dueño* en la ficha de un paciente que ya cargó sin cuenta.
2. La función `crear-cuenta-dueno` (Edge Function del proyecto de Supabase) valida que quien llama sea un veterinario activo, crea el usuario con una contraseña temporal, deja la mascota a nombre del dueño y mantiene el acceso del veterinario. Máximo 20 cuentas por veterinario por día.
3. La app muestra el correo y la contraseña temporal una sola vez y arma el mensaje para WhatsApp.
4. Al ingresar, el dueño tiene que elegir su propia contraseña y aceptar los términos (`profiles.debe_cambiar_password`, función `completar_primer_ingreso`).

La función vive en el proyecto de Supabase (*Edge Functions*, con la verificación de JWT activada) y no está en este repositorio. Usa la clave de servicio, que Supabase le entrega al desplegarla: no va en la app. Para marcar la cuenta y pasar las mascotas al dueño llama a `public.vincular_cuenta_dueno`, una función de la base que solo puede ejecutar el servicio.

## Pruebas

```bash
./gradlew testDebugUnitTest
```

Las pruebas no usan la red: `FuenteEnMemoria` reemplaza a Supabase (`Servicios.fuentePrueba`) y `Escenario` arma los datos de cada caso. Hay pruebas de las reglas de cada repositorio (`DuenoRepoTest`, `VeterinarioRepoTest`, `AdminRepoTest`, `SesionTest`, `FechasTest`) y de pantallas con Robolectric (`PantallasTest`).

## Compilar

```bash
./gradlew assembleDebug
```
