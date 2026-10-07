# PetCare

App Android de historial clínico de mascotas. Tiene tres tipos de usuario: **dueño**, **veterinario** y **administrador**.

## Estructura del código

El paquete base es `frgp.utn.edu.petcare`.

| Carpeta | Qué contiene |
|---|---|
| `ui/auth` | `AuthActivity`: bienvenida, ingreso, registro y recuperación de contraseña. Deriva a cada rol. |
| `ui/dueno` | App del dueño. `DuenoActivity` es el contenedor (barra inferior y navegación) y cada sección es una `Pantalla`. |
| `ui/common` | Utilidades de interfaz compartidas. |
| `model` | Clases de datos del dueño (`Mascota`, `EventoMascota`, `VeterinarioAcceso`, `PerfilDueno`...). |
| `data` | Repositorios en memoria: `DuenoRepo` (datos de la cuenta del dueño) y `CuentasRepo` (cuentas y roles). |
| raíz del paquete | Pantallas del veterinario y del administrador (`*Activity.kt`), sus repositorios (`AgendaRepo`, `PacientesRepo`, `AdminRepo`...) y los asistentes de registro. |

### Cómo se arma la app del dueño

`DuenoActivity` muestra una barra inferior fija y, arriba, una sola sección por vez. Cada sección extiende `Pantalla`, se dibuja con `mostrar()` dentro del contenedor y navega con los métodos `irA...()` de la actividad. Lo que comparten las secciones (la mascota abierta, el día elegido en el calendario) vive en `DuenoActivity`; los datos viven en `DuenoRepo`.

Para agregar una sección: crear la `Pantalla`, un método `irA...()` en `DuenoActivity` y, si va en la barra, el ítem en `BarraInferior`.

## Datos

Hoy los datos están en memoria (repositorios `object`) y la cuenta de demostración arranca con datos de ejemplo. Una cuenta nueva solo tiene lo que cargó al registrarse. Los repositorios son el punto de reemplazo cuando se conecte la base de datos (Supabase).

## Pruebas

```bash
./gradlew testDebugUnitTest
```

Hay pruebas de las reglas de negocio (`DuenoRepoTest`, `AdminRepoTest`, `RepositoriosTest`) y pruebas de pantallas con Robolectric (`PantallasSmokeTest`, `FuncionalidadTest`).

## Compilar

```bash
./gradlew assembleDebug
```
