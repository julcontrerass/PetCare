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

---

# Dominio (compartido entre roles)

Port de los componentes de dominio de `ui/common/` y `ui/dueno/` del Kotlin. Todo se importa por archivo, igual que el kit.
Los `object X` del Kotlin se exportan como funciones sueltas **y** como un objeto `X` con las mismas (`Contacto.llamar(...)`).
Las pruebas están en `__tests__/ui/` (`npx jest __tests__/ui`).

## Documentos.ts (lógica pura de recetas y certificados; sin dependencias de plataforma)
- `interface Profesional { nombre; matricula; clinica; direccion; telefono }` (todos string) — `perfilVetRepo.comoProfesional(sedeId?)` ya lo arma. `crearProfesional({ nombre, matricula, clinica?, direccion?, telefono? })` pone `""` a lo que falte.
- `interface DatosPaciente { nombre; especie; raza; sexo; edad; peso; microchip; propietario }` — `pacientesRepo.comoDocumento(p)` ya lo arma. `crearDatosPaciente({ nombre, especie, ...resto opcional })`.
- `type Bloque` (unión por `tipo`: encabezado, titulo, subtitulo, texto, paciente, espacio, firma); `class Plano { tipo; paciente; fecha; bloques; texto(): string }`.
- `planoDeReceta(profesional, paciente, fecha: LocalDate, medicamentos: Prescripcion[], indicaciones = ""): Plano`
- `planoDeCertificadoVacunacion(profesional, paciente, fecha, vacunas: RegistroSalud[]): Plano`
- `planoDeCertificadoSalud(profesional, paciente, fecha, observaciones = ""): Plano`
- `nombreDeArchivo(plano): string` → `receta-rex-2026-10-12.pdf`. También `Documentos.{planoDeReceta, planoDeCertificadoVacunacion, planoDeCertificadoSalud, nombreDeArchivo}`.
- Ejemplo: `const plano = planoDeReceta(PerfilVetRepo.comoProfesional(turno.sedeId), comoDocumento(paciente), LocalDate.now(), recetas);`

## DocumentosPdf.ts (HTML A4 -> PDF con `expo-print`; compartir con `expo-sharing`)
- `interface ArchivoPdf { uri: string | null; nombre: string; plano: Plano; html: string }` — `uri` es null en la web (no hay archivo).
- `receta(profesional, paciente, fecha, medicamentos, indicaciones = ""): Promise<ArchivoPdf>`; `certificadoVacunacion(profesional, paciente, fecha, vacunas): Promise<ArchivoPdf>`; `certificadoSalud(profesional, paciente, fecha, observaciones = ""): Promise<ArchivoPdf>`; `generarPdf(plano): Promise<ArchivoPdf>`; `htmlDePlano(plano): string`.
- `compartir(archivo, titulo): Promise<boolean>` — celular: selector del sistema con el PDF; web: `navigator.share` (con el texto) o, si no hay, el diálogo de impresión. Nunca lanza.
- `imprimir(archivo, titulo?): Promise<boolean>` — web: abre el HTML en otra ventana (o iframe oculto) y llama a `print()` ("Guardar como PDF"); celular: igual que `compartir`. En la web `Print.printAsync({ html })` imprime la página actual, no el HTML, por eso no se usa.
- Ejemplo: `await DocumentosPdf.compartir(await DocumentosPdf.certificadoSalud(prof, pac, LocalDate.now(), obs), "Certificado de salud");` (también `DocumentosPdf.*`)

## Contacto.ts (WhatsApp, llamar, correo, compartir texto)
- `type Intencion = string | (() => Promise<void>)` — una URL (`https://wa.me/...`, `tel:...`, `mailto:...`) o una acción propia; en Kotlin era un `Intent`.
- `numeroWhatsApp(telefono): string | null`; `whatsApp(telefono, mensaje): Intencion | null`; `llamar(telefono): Intencion | null`; `correo(email): Intencion`; `compartirTexto(texto): Intencion` (celular: `Share`; web: `navigator.share` o copia con expo-clipboard).
- `mensajeDeAcceso(dueno, mascotas: string[], email, password, veterinario, clinica): string`.
- `mensajeDeSaludo(propietario, mascota): string` ("Hola Ana, te escribo por Rex.", el del menú de la ficha del paciente) y `mensajeDeRevision(propietario | null, clinica, mascota, tipo, titulo, proximaDosis: LocalDate | null, hoy: LocalDate): string` (el recordatorio de "Vacunas pendientes"). Estos dos no estaban en `Contacto.kt` (eran privados de las Activities); se agregaron acá.
- `abrir(intencion: Intencion | null, sinDatos: string): Promise<void>` — null avisa `sinDatos`; si falla avisa "No hay una aplicación disponible para esta acción".
- Ejemplo: `await Contacto.abrir(Contacto.whatsApp(p.telefono, msg) ?? Contacto.compartirTexto(msg), "No pudimos abrir WhatsApp");`

## PanelAvisos.tsx, TarjetaAviso.tsx, TarjetaPermiso.tsx
- `<PanelAvisos visible alCerrar avisos: ItemAviso[] alBorrar(item) alBorrarTodas() />` — hoja inferior con grupos HOY/AYER/ESTA SEMANA/ANTERIORES, resumen, estado vacío, borrar una y "Borrar todas" con confirmación; `TarjetaPermiso` va arriba. La lista es una copia tomada al abrir. `interface ItemAviso { tipo: TipoNotificacion; titulo; mensaje; creada: LocalDateTime; sinLeer: boolean; origen?: unknown }`. Puras: `grupo(fecha, hoy?)`, `resumen(total, sinLeer)` (también `PanelAvisos.grupo/resumen`).
- `<TarjetaAviso tipo titulo mensaje creada sinLeer? alBorrar? estilo? />` (sin `alBorrar` no hay cruz; `alBorrar` se llama después de la animación de salida). Puras: `estilo(tipo): { fondo, color, icono }`, `tiempo(creada, ahora?)` (también `TarjetaAviso.estilo/tiempo`).
- `<TarjetaPermiso estilo? />` — se dibuja sola solo si las notificaciones están apagadas ("Activar" abre los ajustes; en la web pide el permiso y solo aparece si el navegador tiene `Notification`).
- `<NotificacionesVetPanel visible alCerrar alCambiar? />` — al abrirse hace `NotificacionesVet.cargar()`, muestra los avisos (los sin leer resaltados), después los marca como leídos; borrar una/todas llama a `NotificacionesVet.borrar/borrarTodas`. Errores con `Avisos.error` y se cierra.
- `<NotificacionesDuenoPanel visible alCerrar alCambiar? />` — igual con `DuenoRepo.notificaciones` / `marcarNotificacionesLeidas` / `borrarNotificacion` / `limpiarNotificaciones`. `alCambiar` sirve para refrescar la campana (los dos ya llaman a `Servicios.avisarCambio()`).
- Ejemplo: `<NotificacionesDuenoPanel visible={panel} alCerrar={() => setPanel(false)} />` y la campana lee `DuenoRepo.notificacionesSinLeer` / `NotificacionesVet.sinLeer` con `<Insignia />`.

## FiltroLineaTiempo.tsx (buscador + tipo + rango de fechas)
- `useFiltroLineaTiempo(): FiltroControl { estado; cambiar(parcial); limpiar(); activo: boolean; admite(texto, tipoEvento, fecha: LocalDate | null): boolean }`.
- `<FiltroLineaTiempo filtro={filtro} tipos={string[]} />` — con un solo tipo no se muestran los chips. Puras: `filtroAdmite(estado, texto, tipoEvento, fecha)`, `filtroActivo(estado)`, `FILTRO_VACIO`.
- Ejemplo: `const f = useFiltroLineaTiempo(); <FiltroLineaTiempo filtro={f} tipos={["Consulta","Vacuna"]} /> … eventos.filter(e => f.admite(e.titulo, e.tipo, e.fecha))`; si queda vacío: `f.activo ? "sin resultados" : "sin eventos"`.

## EditorRecordatorio.tsx
- `<EditorRecordatorio visible alCerrar mascotas: { id: string; nombre: string }[] existente?: RecordatorioManual | null alGuardar() />` — crea con `RecordatoriosRepo.crear` o edita con `editar`; si no hay mascotas ni `existente` avisa "Primero necesitás una mascota para crear un recordatorio" y se cierra. Con una sola mascota o editando no pregunta cuál. Ejemplo: `<EditorRecordatorio visible={v} alCerrar={c} mascotas={[{ id: m.id, nombre: m.nombre }]} alGuardar={refrescar} />`.

## FichaClinica.tsx + GraficoPesoView.tsx
- `<AlertasClinicas texto alEditar? estilo? />` (también `FichaClinica.alertas`): sin `alEditar` solo se lee.
- `<EvolucionPeso puntos: PuntoPeso[] estilo? />` (también `FichaClinica.peso`): `null` con menos de 2 mediciones. `type PuntoPeso = readonly [LocalDate, number]`.
- `<GraficoPesoView puntos estilo? />` (react-native-svg, 170 de alto, ancho del contenedor); pura: `geometriaPeso(puntos, ancho, alto)`.
- Ejemplo: `<AlertasClinicas texto={paciente.alertas} alEditar={editar} /><EvolucionPeso puntos={pesos} />`.

## ArchivosUi.ts
- `elegir(): Promise<ArchivoElegido | null>` — selector (PDF, jpg/png/webp, doc/docx), valida tipo y 15 MB, avisa los errores; `null` si se cancela o no sirve. `leer(uri, nombre?)` valida un uri ya elegido. `interface ArchivoElegido { nombre; extension; mime; bytes: Uint8Array }`.
- `abrir(bucket, ruta, extension): Promise<void>` — baja (si hace falta) y lo abre con la aplicación del teléfono (`File.preview`); en la web `window.open(url)`. `compartir(bucket, ruta, extension, titulo?)` — `expo-sharing` (en la web abre en otra pestaña). Constantes `TIPOS_ADMITIDOS`, `TAMANO_MAXIMO`, `mimeDe(extension)`.
- Ejemplo: `const a = await ArchivosUi.elegir(); if (a) await ArchivosRepo.agregar(pacienteId, a.nombre, a.extension, a.bytes, a.mime)` / `await ArchivosUi.abrir(ArchivosRepo.BUCKET, item.storagePath, item.tipoExtension)`.

## VetUi.tsx, BajaDeCuenta.ts
- `<FotoVet tamano? estilo? />` — foto del veterinario en sesión (`PerfilVetRepo.fotoUri/fotoPath`, con su inicial de respaldo). `VetUi.barras` no se portó (lo resuelven `StatusBar` y `PantallaBase`).
- `BajaDeCuenta.confirmar(): void` — cartel "¿Eliminar tu cuenta?"; si acepta: `Sesion.eliminarCuenta()`, "Tu cuenta fue eliminada" y `Sesion.volverAlIngreso()` (RaizApp ya lo conecta con `router.replace("/auth")`). Ejemplo: `<Boton titulo="Eliminar cuenta" variante="peligro" onPress={BajaDeCuenta.confirmar} />`.

## ComponentesDueno.tsx (de ui/dueno/Componentes.kt) y EstiloCategoria.ts
- `<ChipEstadoMascota nombreMascota />` — "Al día" (ok) / "Vacuna pendiente" (aviso) o la etiqueta del estado si no está activa (neutro); lee `DuenoRepo` en el render (llamar a `useDatos()`).
- `diasHasta(fecha: LocalDate): number` — días desde hoy (negativo si ya pasó).
- `<SelectorFechaNacimiento visible inicial? alElegir(fecha) alCerrar />` — calendario sin días futuros.
- `EstadoVacio` se reexporta del kit (el `Componentes.estadoVacio` del Kotlin).
- `EstiloCategoria.icono(categoria | null): NombreIcono`, `.fondo(categoria | null): string`, `.colorIcono(categoria | null): string` (colores de `Colores`), `.servicio(nombre): { icono, fondo, color }` (servicios y especialidades del catálogo), `.turno(categoria): { icono, fondo, color }` (encabezado de la ficha de un turno). También exportadas sueltas (`icono`, `fondo`, `colorIcono`, `servicio`, `turno`).
- Ejemplo: `const e = EstiloCategoria.servicio(nombre); <View style={{ backgroundColor: e.fondo }}><Icono nombre={e.icono} color={e.color} /></View>`.
