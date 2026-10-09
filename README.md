# PetCare

App Android de historial clínico de mascotas. Tiene tres tipos de usuario: **dueño**, **veterinario** y **administrador**. Los datos viven en un proyecto de [Supabase](https://supabase.com) (Postgres, Auth y Storage).

## Estructura del código

El paquete base es `frgp.utn.edu.petcare`.

| Carpeta | Qué contiene |
|---|---|
| `ui/auth` | `AuthActivity`: bienvenida, ingreso, registro y recuperación de contraseña. Deriva a cada rol. |
| `ui/dueno` | App del dueño. `DuenoActivity` es el contenedor (barra inferior y navegación) y cada sección es una `Pantalla`. |
| `ui/common` | Utilidades de interfaz compartidas. |
| `model` | Clases de datos del dueño (`Mascota`, `EventoMascota`, `VeterinarioAcceso`, `PerfilDueno`...). |
| `data` | `Sesion` (quién ingresó y carga de sus datos), `DuenoRepo`, `Registro`, `Servicios`, `Errores` e `Imagenes`. |
| `data/remoto` | Conexión con Supabase: `FuenteDatos` (lo que la app le pide al servidor), `SupabaseFuente` (la implementación real) y los `Dtos` de cada tabla. |
| raíz del paquete | Pantallas del veterinario y del administrador (`*Activity.kt`), sus repositorios (`AgendaRepo`, `PacientesRepo`, `SaludRepo`, `AdminRepo`...) y los asistentes de registro. |

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

## Pruebas

```bash
./gradlew testDebugUnitTest
```

Las pruebas no usan la red: `FuenteEnMemoria` reemplaza a Supabase (`Servicios.fuentePrueba`) y `Escenario` arma los datos de cada caso. Hay pruebas de las reglas de cada repositorio (`DuenoRepoTest`, `VeterinarioRepoTest`, `AdminRepoTest`, `SesionTest`, `FechasTest`) y de pantallas con Robolectric (`PantallasTest`).

## Compilar

```bash
./gradlew assembleDebug
```
