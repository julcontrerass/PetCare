# PetCare: migración de Android nativo (Kotlin) a React Native con Expo

Este proyecto (`petcare-expo/`) es la migración completa de la app Android que está en `../app/`.
Mantiene **las mismas funciones, los mismos textos en español, el mismo backend (Supabase) y la misma
lógica** que la versión Kotlin; cambian el lenguaje (TypeScript), la interfaz (React Native) y las
herramientas (Expo SDK 58, expo-router).

La app Android original **no se toca**: sirve de referencia. Cada archivo de `src/` nombra en su comentario
inicial o en su nombre el archivo Kotlin del que viene.

## Estructura

```
petcare-expo/
  src/
    app/            rutas de expo-router (archivos finos: importan la pantalla de src/ui)
    util/           tiempo.ts (LocalDate, LocalDateTime, YearMonth), fechas.ts, errores.ts, uuid.ts
    model/          modelos.ts, clinica.ts, tiposMascota.ts          (de model/*.kt)
    theme/          colores.ts, tipografia.ts                          (de colors.xml / typography.xml)
    data/
      catalogoMedico.ts
      servicios.ts                          (de Servicios.kt)
      sesion.ts, registro.ts, ...           (de data/*.kt)
      remoto/       dtos.ts, fuenteDatos.ts, supabaseFuente.ts, almacenSeguro.ts
      repositorio/  duenoRepo.ts, agendaRepo.ts, ...                   (de data/repositorio/*.kt)
      avisos/       recordatorios.ts, avisosDelSistema.ts              (de data/avisos/*.kt)
    ui/
      common/       componentes compartidos (de ui/common/*.kt)
      auth/ dueno/ veterinario/ admin/                                 (de ui/<rol>/*.kt)
  __tests__/        pruebas de jest (de app/src/test/**)
```

El nombre de cada archivo TypeScript es el del Kotlin en camelCase (`DuenoRepo.kt` -> `duenoRepo.ts`,
`PerfilVetSeccion.kt` -> `PerfilVetSeccion.tsx` si es un componente de React).

## Cómo se traduce el Kotlin

| Kotlin | TypeScript |
|---|---|
| `object FooRepo { var a; fun b() }` | `export const FooRepo = ...` (instancia única de una clase), se usa igual: `FooRepo.a`, `FooRepo.b()` |
| `suspend fun` | `async` (devuelve `Promise`); `coroutineScope { async {} }` -> `Promise.all` |
| `class X(val a, var b)` | `class X` con los mismos campos y nombres |
| `data class` | `interface` + función de creación; `copy(...)` -> `{ ...x, campo }` |
| `enum class` | unión de strings + registro de datos (mirá `EstadoMascota` en `model/modelos.ts`) |
| `sealed interface` | unión discriminada (campo `tipo`) |
| `List`, `MutableList` | arrays; `Set` -> `Set`; `Map` -> `Record` o `Map` |
| `LocalDate`, `LocalDateTime`, `YearMonth`, `Period` | las de `util/tiempo.ts` (misma API). **Se comparan con `.equals()`, nunca con `===`** |
| `Uri` | `string` (uri `file://`, `content://` o `https://`) |
| `String.format("%.1f")` | `toFixed(1)` |
| `x ?: y`, `x?.y` | `x ?? y`, `x?.y` |
| `runCatching { }` | `try { } catch { }` |
| `Servicios.scope.launch { }` | llamar la promesa sin `await` (`void p`) o `Servicios.escribir(...)` |
| `Servicios.escribir(alFallar, alTerminar) { }` | `Servicios.escribir({ alFallar, alTerminar }, async () => { })` |
| DTO `d.mascotaId` (camelCase) | `d.mascota_id`: **los DTO de TypeScript usan los nombres de las columnas de la base (snake_case)**, ver `data/remoto/dtos.ts` |
| `Sesion`/`Repo` con `Context` de Android | no hay `Context`; lo que necesitaba el contexto (preferencias, archivos, notificaciones) usa Expo (ver abajo) |

Android -> Expo:

| Android | Expo / React Native |
|---|---|
| SharedPreferences / EncryptedSharedPreferences | `@react-native-async-storage/async-storage` (datos comunes), `expo-secure-store` (sesión: `data/remoto/almacenSeguro.ts`) |
| WorkManager + notificaciones locales | `expo-notifications` (notificaciones locales programadas, sin servidor) |
| FileProvider / Intent.ACTION_SEND | `expo-sharing` + `expo-file-system` |
| PdfDocument | `expo-print` (se arma HTML y se convierte a PDF) |
| Intents (`wa.me`, `mailto:`, `tel:`) | `Linking.openURL` de `react-native` |
| Selector de imagen / archivo | `expo-image-picker`, `expo-document-picker` |
| Cámara | `expo-image-picker` (`launchCameraAsync`) |
| Recorte/achique de fotos | `expo-image-manipulator` |
| Íconos `ic_*` (drawables) | `@expo/vector-icons` (`MaterialCommunityIcons`), se elige el nombre equivalente |
| Gráficos dibujados a mano (`GraficoPesoView`) | `react-native-svg` |
| Fuente Nunito | `@expo-google-fonts/nunito` (pesos en `theme/tipografia.ts`) |
| Deep link `petcare://recuperar?code=` | esquema `petcare` ya declarado en `app.json`; la ruta es `/auth/recuperar` |

## Reglas de la traducción

1. **Misma funcionalidad**: no se quita, no se agrega ni se simplifica ninguna función. Si algo de Android no
   tiene equivalente directo, se resuelve con el equivalente de Expo y se anota en un comentario.
2. **Mismos textos**: todos los mensajes, títulos, etiquetas y validaciones en español de la app Kotlin se copian
   tal cual (acentos, voseo, puntuación).
3. **Mismo comportamiento de datos**: mismas consultas a Supabase (la capa `data/remoto` ya está hecha), mismas
   reglas de negocio, mismos valores por defecto. Las escrituras son optimistas: se actualiza la copia en
   memoria y se manda al servidor con `Servicios.escribir`, que avisa el error y vuelve a pedir los datos.
4. **Comentarios**: se traducen los KDoc a comentarios TSDoc en español, con el mismo nivel de detalle que
   el original (ni más ni menos). Nombres de variables, funciones y clases en español, igual que el Kotlin.
5. TypeScript estricto: sin `any` (si no hay otra salida, `unknown` y se acota). Sin dependencias nuevas.
6. Nada de librerías de estado: los repositorios son la fuente de verdad en memoria, como en Kotlin.

## Reactividad (de `Servicios.alCambiarDatos`)

Los repositorios guardan los datos en memoria. Cuando cambian (por una escritura o por un cambio en vivo del
servidor) se llama a `Servicios.avisarCambio()`. Las pantallas se vuelven a dibujar con el hook
`useDatos()` (`src/ui/common/useDatos.ts`), que se suscribe a ese aviso. Una pantalla lee los repositorios
directamente en su render, igual que el Kotlin lo hacía en `mostrar()`.

## Navegación

expo-router. `src/app/_layout.tsx` (raíz) y `src/app/index.tsx` (control de sesión) los escribe quien integra.
Cada grupo escribe sus propias rutas y su `_layout.tsx`:

| Grupo | Carpeta | Quién |
|---|---|---|
| Ingreso y registros | `src/app/auth/` (`index`, `registro-dueno`, `registro-veterinario`, `recuperar`) | auth |
| Dueño | `src/app/dueno/` (pestañas Inicio, Mascotas, Calendario, Más, y pilas para el detalle, el carnet, etc.) | dueño |
| Veterinario | `src/app/vet/` (pestañas Inicio, Agenda, Pacientes, Perfil, y pilas) | veterinario |
| Administrador | `src/app/admin/` | admin |

- Todas las pantallas se exportan como componentes de `src/ui/<rol>/` y los archivos de `src/app/` solo los
  montan (`export { default } from ...` o un wrapper chico que lee `useLocalSearchParams`).
- Navegar: `router.push("/dueno/mascota/123")`, `router.replace(...)`, `router.back()`. Los parámetros viajan
  como strings por la ruta; lo que en Kotlin era un `Intent.putExtra` pasa a parámetro de ruta.
- Lo que en Android compartían las pantallas de una misma Activity (`mascotaActual`, `diaSeleccionado`) vive en
  un módulo de estado del grupo (`src/ui/dueno/estadoDueno.ts`), no en parámetros.
- El botón "atrás" del sistema vuelve a la pantalla anterior (lo hace expo-router).
- Después de cerrar sesión se llama a `router.replace("/auth")`.

## Dependencias instaladas (no instalar otras)

expo, expo-router, react-native, @supabase/supabase-js, react-native-url-polyfill, expo-secure-store,
@react-native-async-storage/async-storage, expo-notifications, expo-device, expo-image, expo-image-picker,
expo-image-manipulator, expo-document-picker, expo-file-system, expo-print, expo-sharing, expo-linking,
expo-clipboard, expo-haptics, expo-crypto, expo-font, expo-linear-gradient, expo-splash-screen,
expo-status-bar, expo-system-ui, @expo-google-fonts/nunito, @expo/vector-icons, react-native-svg,
@react-native-community/datetimepicker, react-native-safe-area-context, react-native-screens,
react-native-gesture-handler, react-native-reanimated, react-native-worklets.
Dev: jest, jest-expo, @testing-library/react-native, react-test-renderer, @types/jest, eslint, eslint-config-expo.

Si hace falta algo más, no se instala: se anota en el informe final.

## Web

La app tiene que funcionar **igual de bien en la web** (Expo con react-native-web, `npx expo start --web` y
`npx expo export --platform web`, salida `single`/SPA). Reglas para todo el código:

- Una sola base de código: nada de archivos `.android`/`.ios` salvo que sea imprescindible; las diferencias se
  resuelven con `Platform.OS === "web"` o con archivos `.web.ts(x)` y siempre con un comportamiento equivalente.
- Cada módulo nativo tiene que tener su camino web:
  - `expo-secure-store` no existe en la web: `data/remoto/almacenSeguro.ts` ya usa el almacenamiento del navegador.
  - `expo-notifications`: las notificaciones locales programadas no existen en la web. Ahí `AvisosDelSistema` no
    programa nada y los avisos se ven dentro de la app (campana y banners); si el navegador lo permite se puede
    usar la API `Notification` solo mientras la pestaña está abierta. Ninguna función puede fallar por esto.
  - `expo-file-system`: en la web no hay caché de archivos; las imágenes y archivos se muestran con una URL
    firmada de Supabase o con `URL.createObjectURL` de los bytes bajados (devolver esa uri desde `Imagenes`).
  - `expo-print`/`expo-sharing`: en la web `printToFileAsync` no está disponible; los PDF se arman con el mismo
    HTML y se abren con `Print.printAsync({ html })` (diálogo de impresión/guardar como PDF) o se descargan;
    compartir usa `navigator.share` si existe y si no descarga/copia.
  - `expo-image-picker` y `expo-document-picker` funcionan en la web (devuelven `blob:`/`data:` URI).
  - `Linking.openURL` abre WhatsApp (`https://wa.me/...`), `mailto:` y `tel:` también en la web.
  - Los selectores de fecha y hora son los propios del kit (no `@react-native-community/datetimepicker`, que no
    tiene web).
  - `expo-haptics` en la web no hace nada: ya es seguro llamarlo.
- Diseño responsivo: en pantallas anchas (web de escritorio) el contenido de las pantallas se centra en una
  columna de máximo ~480 px de ancho sobre el fondo `loginBg` (la app es de formato teléfono), salvo el panel del
  administrador, que puede usar hasta ~1100 px. Nada puede quedar cortado ni mal alineado en 360 px, 768 px ni
  1280 px de ancho.
- Entradas con teclado y mouse: todo lo táctil tiene que poder usarse con mouse (`Pressable` ya funciona), con
  foco visible y con Enter para enviar formularios (`onSubmitEditing`). Los modales cierran con Escape.
- Rutas con enlaces profundos reales en la web (`/auth/recuperar?code=...`, `/dueno/mascota/123`): al recargar la
  página la sesión se restaura sola y la ruta se mantiene.
- `Alert` de React Native no hace nada en la web: usar siempre `Avisos.*`, nunca `Alert.alert`.

## Verificación

```bash
npx tsc --noEmit          # tipos
npx jest                  # pruebas
npx expo lint             # estilo
npx expo export --platform android   # arma el bundle de Android (comprueba que todo se resuelve)
npx expo export --platform web       # arma el sitio web (comprueba lo mismo para la web)
```
