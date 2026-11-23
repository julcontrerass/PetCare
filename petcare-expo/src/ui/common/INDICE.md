# Kit de interfaz (`src/ui/common/`)

Todo se importa por archivo: `import { Boton } from "../common/Boton"`. Los nombres de props en español; los
callbacks de eventos que son de React Native conservan su nombre (`onPress`, `onChangeText`, `onSubmitEditing`).
Estilos propios: prop `estilo` (no `style`). Colores/medidas: `Colores`, `Fuentes`, `Espaciado`, `Radios` de `tema.ts`.
Usar **Nunito** solo mediante `Texto` (no poner `fontWeight` en los estilos: el peso se elige con `negrita`/`peso`).

## Arquitectura en dos líneas
`<RaizApp>` (en `src/app/_layout.tsx`) envuelve todo y monta `<AvisosHost />`. Cada pantalla es una `<PantallaBase>` que
llama a `useDatos()` y `useSesionRequerida()` y lee los repositorios en el render.

## tema.ts
- `Colores, Fuentes, Espaciado, Radios` (reexportados), `type NombreColor`.
- `sombra(nivel?: 0|1|2|3|4): ViewStyle` — 1 = tarjetas (2dp), 3 = barra inferior (8dp), 4 = banner (10dp). `{ ...sombra(1) }` dentro de `StyleSheet.create`. Web: `boxShadow`; Android: `elevation`; iOS: `shadow*`.

## Primitivos
- **Texto** `{ variante?: "titulo"|"subtitulo"|"cuerpo"|"chico"|"etiqueta"|"boton"; color?: string; negrita?: boolean; peso?: "regular"|"medium"|"semibold"|"bold"|"extrabold"; tamano?: number; centrado?: boolean } & TextProps` — `<Texto variante="titulo">Mis mascotas</Texto>`. Limita la escala de letra del sistema a 1.15.
- **Boton** `{ titulo: string; onPress?; variante?: "primario"|"secundario"|"peligro"|"suave"|"texto"; icono?: NombreIcono; deshabilitado?; cargando?; alto?: number (52); estilo?; accessibilityLabel? }` — `<Boton titulo="Guardar" icono="check" cargando={guardando} onPress={guardar} />`. Ocupa todo el ancho (`alignSelf: stretch`); para media fila usar `estilo={{ flex: 1 }}`.
- **BotonIcono** `{ icono: NombreIcono; onPress; accessibilityLabel: string (obligatorio); fondo?: "blanco"|"suave"|"ninguno"; color?; tamano?; estilo? }` — `<BotonIcono icono="mas" accessibilityLabel="Agregar mascota" onPress={agregar} />`. 44x44.
- **Campo** `{ etiqueta?; error?: string|null; ayuda?; icono?: NombreIcono; multilinea?; contrasena?; forma?: "tarjeta"|"pildora"; estilo?; ref? } & TextInputProps (value, onChangeText, placeholder, keyboardType, onSubmitEditing, editable…)` — `<Campo etiqueta="Correo" icono="correo" value={c} onChangeText={setC} keyboardType="email-address" onSubmitEditing={enviar} />`. `contrasena` agrega el ojito. `estilo` es del contenedor.
- **Icono** `{ nombre: NombreIcono; tamano?: number (24); color?: string; accessibilityLabel?; estilo? }` — `<Icono nombre="mascotas" tamano={26} color={Colores.primaryTeal} />`. Sin `accessibilityLabel` es decorativo. Exporta `Iconos` (mapa nombre semántico -> MaterialCommunityIcons) y `type NombreIcono = keyof typeof Iconos`. Nombres: inicio, volver, adelante, chevronIzquierda/Derecha/Abajo/Arriba, cerrar, mas, menos, masOpciones, lista, buscar, filtro, refrescar, editar, borrar, compartir, copiar, descargar, subir, enlace, salir, ajustes, check, checkCirculo, cancelar, advertencia, info, estrella, favorito, persona, perfil, personas, veterinario, admin, candado, llave, ojo, ojoOculto, telefono, correo, whatsapp, ubicacion, sede, mapa, reloj, calendario, calendarioMas, turno, historial, camara, camaraMas, galeria, archivo, documento, pdf, informe, solicitud, notificacion, notificacionActiva, mascotas, perro, gato, ave, pez, reptil, roedor, conejo, caballo, vacuna, receta, medicamento, cirugia, botiquin, medico, pulso, actividad, peso, gota, nutricion, ciencia, chip, grafico, espCardiologia, espDermato, espDolor, espEndocrino, espExoticos, espFelina, espFisioterapia, espGastro, espHemato, espHomeopatia, espNefro, espNeuro, espNutricion, espOftalmologia, espOncologia, espParasito, espPulmones, srvBano, srvDiente, srvEstetoscopio, srvTomografia.
- **Tarjeta** `{ children; onPress?; seleccionada?; relleno?: number (16); estilo?; accessibilityLabel? }` — `<Tarjeta onPress={abrir}>…</Tarjeta>` (bg_card_white; con `seleccionada` borde teal de 2dp). Sin margen: ponerlo en `estilo`.
- **Chip** `{ texto; tono?: "neutro"|"ok"|"aviso"|"peligro"|"info"|"seleccionado"|"sinSeleccionar"; icono?; onPress?; estilo? }` — `<Chip texto="Al día" tono="ok" />`. `sinSeleccionar` (bg_chip_unselected) se agregó para filtros.
- **Encabezado** `{ titulo; subtitulo?; alVolver?: () => void; derecha?: ReactNode; estilo? }` — `<Encabezado titulo="Mis mascotas" subtitulo="3 mascotas" alVolver={router.back} derecha={<BotonIcono …/>} />`.
- **PantallaBase** `{ titulo?; subtitulo?; alVolver?; derecha?; scroll?: boolean (true); refrescando?; alRefrescar?; pie?: ReactNode; anchoMaximo?: number (480; admin 1100); margen?: number (20); bordes?: Edge[] (["top","bottom"]; en pestañas ["top"]); fondo?; estiloContenido?; children }` — `<PantallaBase titulo="Mascotas" pie={<Boton …/>}>…</PantallaBase>`. Si hay `titulo` dibuja el Encabezado fijo. En pantallas anchas centra una columna de `anchoMaximo` (web). Maneja el teclado.
- **EstadoVacio** `{ icono: NombreIcono; titulo; mensaje; textoBoton?; alBoton?; estilo? }` — `<EstadoVacio icono="mascotas" titulo="Sin mascotas" mensaje="Agregá la primera" textoBoton="Agregar" alBoton={agregar} />` (el botón solo si hay `textoBoton` y `alBoton`).
- **Insignia** `{ cantidad: number; estilo? }` — `<Insignia cantidad={n} estilo={{ position: "absolute", top: -4, right: -4 }} />` (nada si 0; "9+"). También `textoInsignia(cantidad): string`.
- **Avatar** `{ nombre?; fotoPath?; fotoUri?; bucket?; tamano?: number (44); estilo? }` — `<Avatar nombre={vet.nombre} fotoPath={vet.fotoPath} tamano={48} />`. Sin foto: inicial (o ícono de persona).
- **ImagenRemota** `{ fotoUri?; fotoPath?; bucket? (Imagenes.BUCKET_FOTOS); estilo?: ViewStyle (tamaño y radio); respaldo?: ReactNode; ajuste?: "cover"|…; accessibilityLabel? }` — `<ImagenRemota fotoPath={m.fotoPath} estilo={{ width: 96, height: 96, borderRadius: 12 }} respaldo={<Icono nombre="perro" />} />`. Orden: `fotoUri` → caché síncrona → descarga (fondo lightTeal del tamaño final). Funciona con `file://`, `blob:` y `https:`.

## Modales
- **DialogoCentral** `{ visible; alCerrar; cancelable?: boolean (true); anchoMaximo?: number (420); relleno?: number (20); estilo?; children }` — base de carteles y selectores; Escape (web) y atrás cierran.
- **HojaInferior** `{ visible; alCerrar; children; alturaMaxima?: number (0.9); scroll?: boolean (true); pie?: ReactNode; anchoMaximo?: number (480); cancelable? }` — `<HojaInferior visible={v} alCerrar={() => setV(false)}>…</HojaInferior>`. Cierra tocando afuera, arrastrando la manija, con atrás o con Escape. En web ancha queda centrada abajo con ancho máximo.
- **HojaLista** `{ visible; alCerrar; titulo; subtitulo; filas: FilaHojaLista[]; textoPrincipal?; alPrincipal? }`, `FilaHojaLista = { titulo; subtitulo; icono: NombreIcono; fotoUri?; fotoPath?; alTocar }` — `<HojaLista visible={v} alCerrar={c} titulo="Elegí la mascota" subtitulo="…" filas={filas} />`. Tocar una fila cierra y llama a `alTocar`. Trae el botón "Cerrar".
- **SelectorFecha** `{ visible; valor?: LocalDate|null; minima?; maxima?; diaHabilitado?: (f) => boolean; alTocarBloqueado?: (f) => void; titulo? ("Elegí la fecha"); subtitulo?; leyendaBloqueado? ("No disponible"); alElegir(f); alCerrar() }` — `<SelectorFecha visible={v} minima={LocalDate.now()} diaHabilitado={trabaja} leyendaBloqueado="No atiende" alTocarBloqueado={f => Avisos.mostrar("No atendés los …")} alElegir={setF} alCerrar={c} />`. Al elegir llama `alElegir` y después `alCerrar`. Los días fuera de `minima`/`maxima` se ven apagados y no responden; los que rechaza `diaHabilitado` se ven con círculo negro (bg_dia_bloqueado) y solo llaman a `alTocarBloqueado`.
- **SelectorHora** `{ visible; horarios: string[]; valor?; ocupados?: string[]; alTocarOcupado?: (h) => void; titulo? ("Elegí el horario"); subtitulo?; alElegir(h); alCerrar() }` — `<SelectorHora visible={v} horarios={todos} ocupados={noLibres} alElegir={setH} alCerrar={c} />`. Los `ocupados` (subconjunto de `horarios`) salen tachados y no eligen; si no queda ninguno libre muestra "No quedan horarios libres para este día".

## Avisos (`Avisos.ts` + `AvisosHost.tsx`)
`<AvisosHost />` se monta una vez (ya lo hace `RaizApp`). Nunca usar `Alert.alert`.
- `Avisos.mostrar(mensaje, tipo?: "exito"|"aviso"|"info")` — sin tipo decide la regex de éxito de Avisos.kt. `Avisos.exito(m)`, `Avisos.aviso(m)`. Banner de 3200 ms, se cierra al tocarlo.
- `Avisos.error(mensaje, titulo?)` — título por defecto: "Sin conexión" (si el mensaje contiene "conexión"), "No tenés permiso" ("permiso"), si no "No se pudo completar"; botón "Entendido".
- `Avisos.informar({ titulo, mensaje, icono?: NombreIcono ("checkCirculo"), textoAceptar? ("Entendido"), cancelable? (true), alAceptar? })`
- `Avisos.confirmar({ titulo, mensaje, textoAceptar, textoCancelar? ("Volver"), peligro? (true), icono? ("cancelar"), alAceptar })` — `Avisos.confirmar({ titulo: "Eliminar", mensaje: "…", textoAceptar: "Eliminar", alAceptar: borrar })`.
- Internos/pruebas: `Avisos.estado`, `Avisos.suscribir(fn)`, `Avisos.retirarBanner()`, `Avisos.cerrarCartel(id, aceptado)`, `Avisos.reiniciar()`. Tipos `TipoAviso`, `EstadoAvisos`, `CartelAviso`, `BannerAviso`.

## Hooks y utilidades
- `useDatos(): number` — redibuja la pantalla cuando cambian los datos (`Servicios.versionDatos`).
- `useSesionRequerida(): boolean` — sin sesión activa hace `router.replace("/auth")` (port de `volverSiNoHaySesion`).
- `useActualizarDatosVeterinario(): void` — mientras la pantalla está enfocada recarga con `Sesion.recargarVeterinario()` al entrar y cada 15 s y llama a `Servicios.avisarCambio()` (port de `actualizarDatosVeterinario`).
- `ModoDeUso.cambiar(nuevo: Rol): Promise<void>` — `Sesion.cambiarModo` + `router.replace("/vet" | "/dueno")`; errores con `Avisos.error`.
- `pedirPermisoDeNotificaciones(): Promise<void>` (`permisoNotificaciones.ts`) — cartel explicativo, una sola vez; no hace nada en la web.
- `useMargenes(): { top, bottom, left, right }` (`Margenes.ts`) — como `useSafeAreaInsets` pero con ceros sin provider.
- `useRebote(): { estilo, rebotar }` y `useEntradaDePaso(paso, desplazamiento = 24): estilo` (`Efectos.ts`) — para un `Animated.View`.
- `Diseno` (`Diseno.ts`): `AREA_TACTIL 44, ALTO_BOTON 52, ALTO_CAMPO 54, ANCHO_MINIMO 360, ESCALA_LETRA_MAXIMA 1.15, MARGEN_PANTALLA 20, DURACION_AVISO_MS 3200`.
- `Web.ts`: `ANCHO_COLUMNA (480)`, `esWeb()`, `useTeclaEscape(activo, fn)` (solo web), `cursorTocable`, `estiloFoco(enfocado)`, `useFoco()`, `sinContorno`. Para algo tocable propio: `<Pressable {...foco.props} style={[cursorTocable, estiloFoco(foco.enfocado)]}>`.

## RaizApp
`<RaizApp>{children}</RaizApp>` — carga Nunito (400–800) con `useFonts`, mantiene el splash hasta tenerlas (en la web no usa `expo-splash-screen`), `GestureHandlerRootView` + `SafeAreaProvider` + `StatusBar style="dark"` + `<AvisosHost />`, pone el fondo `loginBg` al `body` en la web y conecta `Servicios.alMostrarError` con `Avisos.error`.

## Web
- Columna central de 480 px (`PantallaBase.anchoMaximo`, 1100 para el admin) sobre `loginBg`; modales (cartel, selectores, hoja) centrados con ancho máximo.
- Escape cierra `DialogoCentral`, `HojaInferior`, carteles y selectores; Enter envía con `onSubmitEditing` en `Campo`; foco visible (anillo teal) y cursor de mano en lo tocable.
- Sombras con `boxShadow` en la web. El banner es `position: absolute` dentro de la raíz y respeta la columna.
- Un `Avisos` mostrado con un modal abierto (hoja/selector) queda detrás del modal (igual que en Android el banner quedaba detrás de un BottomSheetDialog).

## Lo que NO se portó (resuelto por la plataforma)
- `Diseno.forzar` (relayout tras el ingreso), `BaseActivity.attachBaseContext/Responsive` (densidad en pantallas <360dp; se cubre con layout flexible y `ESCALA_LETRA_MAXIMA` en `Texto`), `delegate.localNightMode` (modo claro: `userInterfaceStyle: "light"` + `StatusBar` oscura), insets/edge-to-edge (SafeArea), `Avatares.kt` (→ `Avatar` e `ImagenRemota`; `Avatares.veterinario/deEvento` se arman en la pantalla con `DuenoRepo.perfilDeVeterinario(id)?.fotoPath`), `Insignia.actualizar` (→ `<Insignia />`), `Avisos.iniciar` y `enPrimerPlano` (no hay Activities; el host siempre está montado).
