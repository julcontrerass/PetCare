# Guía para portar pantallas (Kotlin + XML -> React Native)

Complemento de `MIGRACION.md`. La app Kotlin que se menciona acá ya no está en el repositorio: se puede consultar en
el historial de git (rama `main`, carpeta `app/`).

Complemento de `MIGRACION.md`. Vale para todo lo que está en `ui/<rol>/` de la app Kotlin.

## Qué se porta y de dónde sale cada cosa
- **Lógica y comportamiento**: el `.kt` (Activity, Pantalla, Fragment, Dialog). Se conserva TODO: validaciones,
  textos, orden de las cosas, estados vacíos, permisos, animaciones razonables, mensajes de error y de éxito.
- **Aspecto**: el XML de `app/src/main/res/layout/*.xml` que infla ese `.kt` y los `drawable/*.xml` que usa
  (fondos, formas, colores). Copiá las medidas en dp como unidades de React Native, los paddings, márgenes,
  tamaños de texto en sp, radios y colores. Los estilos (`style="@style/..."`) están en `res/values/themes.xml`.
- **Adapters de RecyclerView** (`*Adapter.kt`) pasan a componentes de fila + `FlatList` (o `map` si son pocos).
- **Fragments con pestañas** (por ejemplo la ficha del paciente) pasan a un componente con pestañas internas.
- **BottomSheetDialog / AlertDialog / PopupMenu**: `HojaInferior`, `DialogoCentral`, `Avisos.*` o un menú propio.
- **`Intent` con extras** -> parámetros de ruta (`router.push({ pathname: "/vet/paciente/[id]", params: { id } })`).
- **`startActivityForResult` / `registerForActivityResult`** -> el resultado vuelve por un callback guardado en un
  módulo de estado de la pantalla (o por `router.back()` y `Servicios.avisarCambio()` si solo hace falta refrescar).
- **`onBackPressedDispatcher`**: expo-router ya vuelve atrás; si la Activity interceptaba el atrás para otra cosa,
  usá `useFocusEffect` + `BackHandler` (en la web no existe: guardalo con `Platform.OS !== "web"`).
- **Pedido de permisos / selectores de archivo o foto**: `expo-image-picker` / `expo-document-picker`.

## Cómo se escribe una pantalla
```tsx
export function MascotasPantalla() {
  useSesionRequerida();           // si no hay sesión, vuelve al ingreso
  useDatos();                     // se vuelve a dibujar cuando cambian los datos
  const mascotas = DuenoRepo.mascotasActivas;   // se lee directo del repositorio, como en el Kotlin
  ...
}
```
- Estado de la pantalla (lo que en Kotlin eran campos de la clase) con `useState`; lo que es una consulta al
  servidor con `async`/`await` dentro de un `useEffect` o del manejador, con `try/catch` y `Avisos.error(Errores.mensaje(e))`.
- Los textos se copian al pie de la letra del Kotlin y de `strings.xml`.
- Usá SIEMPRE el kit de `src/ui/common/` (leé `src/ui/common/INDICE.md`): `PantallaBase`, `Texto`, `Boton`, `Campo`,
  `Tarjeta`, `Chip`, `HojaInferior`, `SelectorFecha`, `Avisos`, etc. No uses `Alert`. No uses `fontWeight`: el peso lo
  da `Texto`. Si te falta un componente genérico que se vaya a usar en más de una pantalla, no lo agregues al kit:
  hacelo dentro de tu carpeta (`src/ui/<rol>/`) y anotalo en el informe.
- Los componentes de dominio compartidos entre roles (PDF, contacto, panel de avisos, timeline, editor de
  recordatorios, ficha clínica, archivos, etc.) los porta el agente de "común de dominio": cuando los necesites
  importalos de `src/ui/common/<NombreKotlin>` con la API del Kotlin; si todavía no existen asumí que van a existir.
  Mirá su `INDICE.md` ampliado cuando termine.

## Web (obligatorio)
Todo tiene que verse y funcionar bien en la web (ver sección Web de `MIGRACION.md`): columna de ~480 px centrada
(`PantallaBase anchoMaximo`), foco visible, Enter envía formularios, Escape cierra modales, mouse y teclado,
nada cortado en 360/768/1280 px. Nada de módulos nativos sin camino web.

## Rutas
Cada pantalla se exporta como componente de `src/ui/<rol>/` y la ruta de `src/app/<grupo>/...` solo la monta.
Las rutas de cada grupo y sus nombres los fijás vos (el que porta el grupo) y los documentás al final de tu informe
en una tabla `ruta -> pantalla -> parámetros`, porque las otras pantallas van a navegar hacia ellas. Rutas ya
fijadas: `/auth` (ingreso), `/auth/registro-dueno`, `/auth/registro-veterinario`, `/auth/recuperar`, `/dueno`
(inicio del dueño), `/vet` (inicio del veterinario), `/admin` (panel del administrador).

## Pruebas
- Por cada pantalla escribí al menos una prueba de humo con `@testing-library/react-native` en `__tests__/ui/<rol>/`:
  se arma el escenario con `__tests__/soporte/pruebaBase.ts` (`prepararServicios()`, `ingresarComoDueno()`...), se
  renderiza la pantalla con `await render(...)` (la versión 14 de RNTL es asíncrona) y se comprueba algo real (un
  texto del Kotlin, que el botón guardar llama a `Servicios.fuente...`, una validación, un estado vacío).
  `expo-router` y `@expo/vector-icons` ya están simulados globalmente (`jest.setup.js`); los parámetros de ruta se
  fijan con `fijarRuta({ id: "..." })` de `__tests__/soporte/rutas.ts` y las navegaciones se verifican con `enrutador.push`.
- Corré tus pruebas: `npx jest __tests__/ui/<rol>`.

## Verificación y límites
- `cd /home/user/PetCare/petcare-expo && npx tsc --noEmit 2>&1 | grep -E "<tus rutas>"`. Otros agentes escriben a la vez:
  ignorá los errores de archivos que no son tuyos.
- No ejecutes git. No instales paquetes (prohibido `npm install`, `npx expo install`). Solo creá/editá tus archivos
  y las rutas de tu grupo en `src/app/<grupo>/`. No modifiques `src/ui/common/*`, `src/data/*`, `src/model/*`,
  `src/util/*` (si hay un error o falta algo ahí, anotalo en el informe con el archivo y el motivo).
- Informe final (máx. 30 líneas): archivos creados, tabla de rutas, desvíos respecto del Kotlin y por qué, lo que
  quedó pendiente o dudoso, y lo que no pudiste probar (no hay dispositivo ni navegador en este entorno).
