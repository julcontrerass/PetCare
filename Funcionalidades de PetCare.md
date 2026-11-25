# PetCare: todo lo que hace la app, flujo por flujo

Relevado del código de la app (Android, Kotlin) y de la base de datos (Supabase). Está ordenado por quién usa la app y, dentro de cada uno, por el recorrido que hace.

**Resumen rápido**

- Tres tipos de cuenta: **dueño**, **veterinario** y **administrador**. Una misma cuenta puede ser dueño y veterinario a la vez.
- Se conecta a Supabase: cuentas y sesión, base de datos con permisos por fila, almacenamiento de fotos y archivos, cambios en vivo y una función para crear cuentas de dueño desde el consultorio.
- Todo lo que se escribe se ve al instante en pantalla y se manda al servidor en segundo plano. Si el servidor lo rechaza, la app vuelve a pedir los datos para no quedar desincronizada.

---

## 1. Entrada a la app (para todos)

### 1.1 Bienvenida, ingreso y sesión
1. Pantalla de bienvenida con dos botones: **Iniciar sesión** y **Registrarse**.
2. **Iniciar sesión**: correo (se valida el formato) y contraseña. Los errores del servidor se traducen a mensajes en español.
3. Si el teléfono ya tiene una sesión abierta, al abrir la app entra directo al panel que corresponde. Sin conexión no puede confirmar que la cuenta siga vigente y pide ingresar de nuevo.
4. Según la cuenta, deriva al panel de **dueño**, de **veterinario** o de **administrador**.
5. **Cuentas bloqueadas**: no entran y se les explica por qué, con el motivo si existe:
   - en revisión (falta que el administrador verifique la matrícula),
   - rechazada,
   - suspendida.
6. **Cuenta de dueño y veterinario a la vez**: aparece "¿Cómo querés ingresar?" con dos opciones (como veterinario / como dueño). A un veterinario solo se le pregunta si ya tiene mascotas propias; si no, entra directo como veterinario.
7. Se puede **cambiar de modo sin cerrar sesión** desde el perfil. Los datos del modo anterior se descartan y se cargan los del nuevo.
8. Si el administrador **suspende o rechaza** una cuenta, se le cierran todas las sesiones abiertas en el servidor.

### 1.2 Recuperar la contraseña
1. Desde el ingreso, "¿Olvidaste tu contraseña?": se escribe el correo (se valida) y se manda el mensaje.
2. El enlace del correo usa la dirección `petcare://recuperar` y **vuelve a abrir la app**.
3. La app pide la contraseña nueva (mínimo 6 caracteres, repetida) y entra directo a la cuenta.
4. Si el enlace venció, vuelve al ingreso y avisa el motivo.

### 1.3 Registro de dueño (4 pasos)
Hay una barra de progreso, se puede volver atrás y, si hay datos cargados, pregunta antes de salir.
1. **Datos personales**: foto opcional, nombre y apellido, DNI (7 u 8 números) y teléfono (al menos 8 dígitos).
2. **Domicilio**: ciudad o localidad, calle y número, piso o depto opcional.
3. **Tus mascotas** (se puede omitir): alta, edición y quitado de mascotas. Cada una lleva foto, nombre, tipo (Perro, Gato, Ave, Reptil, Pez, Roedor u Otro), sexo, raza, nacimiento (no puede ser futuro), peso, color, microchip (15 dígitos si se carga) y observaciones.
4. **Tu cuenta**: correo, contraseña (mínimo 6, repetida) y aceptar términos y condiciones. Muestra un resumen antes de crear.
- El DNI no se puede repetir y el correo tampoco: si ya existe, avisa en el campo.
- Si el proyecto exige confirmar el correo, avisa "Confirmá tu correo". Si no, entra directo.
- Las fotos elegidas se suben cuando ya hay sesión abierta (en el primer ingreso).
- Si un veterinario había cargado una mascota a nombre de ese correo, al confirmar el correo la mascota queda vinculada a la cuenta nueva.

### 1.4 Registro de veterinario (5 pasos)
1. **Datos personales**: Dr. o Dra., nombre y apellido, DNI, teléfono y foto opcional.
2. **Profesión y veterinaria**: nombre de la veterinaria, dirección, matrícula (se comprueba que no esté repetida) y **foto del carnet o matrícula, obligatoria**, para que el administrador la verifique.
3. **Especialidades y prácticas** que realiza (con contador de elegidas).
4. **Animales que atiende y días y horarios**: tipos de animal, días de atención, apertura y cierre (el cierre debe ser posterior a la apertura) y **otros lugares de atención**, hasta 3 en total.
5. **Tu cuenta**: correo, contraseña y términos.
- La cuenta queda **"en revisión"**. Se avisa a los administradores y el veterinario no puede ingresar hasta que lo aprueben.
- **Si el correo ya tiene cuenta de dueño**, la app lo explica: hay que ingresar con esa cuenta y en el perfil tocar "Soy veterinario/a: pedir el alta". Ese camino salta los pasos de datos personales y de cuenta y termina en "Enviar solicitud". Mientras tanto sigue usando la app como dueño.
- El pedido de alta se puede **volver a presentar** si fue rechazado.

### 1.5 Primer ingreso de un dueño creado por un veterinario
Aparece un diálogo que no se puede cerrar: hay que elegir una **contraseña propia** (mínimo 6, repetida) y **aceptar los términos**. También se puede cerrar sesión.

---

## 2. Aviso y recordatorios en el teléfono (para todos)

- **Notificaciones del servidor**: llegan por los cambios en vivo mientras la app está abierta. Con la app cerrada, una tarea revisa cada 15 minutos si hay avisos nuevos y los muestra (solo los de las últimas horas).
- **Canales de Android**: "Avisos de turnos" y "Recordatorios".
- **Permiso**: en Android 13 o más la app lo pide. Si está apagado, la lista de notificaciones muestra una tarjeta que lleva a los ajustes del teléfono.
- Si entra con avisos sin leer, muestra "Tenés N notificaciones sin leer".
- **Recordatorios locales del dueño** (se reprograman cada vez que cambian los datos y se cancelan al cerrar sesión o cambiar de modo):
  - un día antes y dos horas antes de cada turno pendiente,
  - una semana antes y el día de cada **próxima dosis** de vacuna o desparasitación (a las 10),
  - un aviso único de "vacuna vencida" (hasta 90 días de vencida),
  - las tomas de cada **medicación** indicada (cada X horas durante Y días, las próximas 48 horas),
  - los **recordatorios hechos a mano** (a su hora, o a las 9 si no tiene).
- **Recordatorios locales del veterinario**: el resumen de las 8 de la mañana de cada día con turnos, un aviso una hora antes de cada turno pendiente y sus recordatorios hechos a mano.
- **Tipos de notificación**: turno, turno completado, cancelación, acceso, mascota y cuenta.
- El veterinario puede **apagar** tres tipos desde su perfil: solicitudes de acceso, turnos y cancelaciones. El servidor respeta esa preferencia.

---

## 3. Dueño de mascotas

### 3.1 Navegación
- **Barra inferior**: Inicio, Mascotas, Recordatorios y Más, con un botón central "+" para sacar un turno.
- **Menú "Más"**: Mi perfil, Veterinarios, Solicitudes, Salud (carnet), Calendario, Notificaciones (con punto rojo si hay sin leer) y Cerrar sesión.
- El botón atrás vuelve a Inicio.
- Mientras la pantalla está a la vista se piden los cambios que hacen los veterinarios cada 30 segundos, además de los cambios en vivo.

### 3.2 Inicio
- Saludo con el nombre, fecha de hoy y foto de perfil (lleva al perfil).
- **Tarjeta principal**: el próximo turno (con la foto del veterinario) o, si no hay, "Todo en orden" con un botón para agendar.
- **Accesos rápidos**: nuevo evento, historial, veterinarios y documentos (carnet).
- **Mis mascotas**: tarjetas de las mascotas activas con un chip de estado de salud (vacuna próxima o al día) y un botón para agregar.
- **Próximos recordatorios** (los 3 siguientes) y **Actividad reciente** de los últimos 30 días.
- Campana de notificaciones.

### 3.3 Mascotas
**Lista**
- Filtros: Todas, Perros, Gatos, Otras e **Históricas** (inactivas y fallecidas).
- Contador del estilo "2 mascotas · 1 en el historial".
- Cada tarjeta muestra foto o inicial, tipo y raza, edad, peso, sexo, estado y el próximo evento.

**Agregar mascota**
- Foto, nombre, tipo (7 opciones con ícono), raza y fecha de nacimiento.
- Se valida el nombre y el tipo. El servidor avisa "Agregaste una nueva mascota".

**Ficha de la mascota** (3 pestañas)
- **Información**:
  - foto (se puede cambiar), nombre, tipo y raza, nacimiento y sexo, peso, microchip, color y observaciones;
  - resumen con edad, peso, sexo, estado de salud y próximo evento;
  - **alertas clínicas** que cargó el veterinario (alergias, carácter, condiciones);
  - **evolución del peso** en un gráfico, si hay al menos dos mediciones;
  - botones para editar información, cambiar estado, ver el carnet, agendar turno y dar de baja.
- **Editar información**: valida que el nombre no esté vacío, que el microchip tenga 15 números, que el peso sea en kilos y mayor que cero, y que no haya otra mascota con el mismo nombre.
- **Cambiar estado**: Activa, Inactiva o Fallecida.
  - Al pasar a inactiva o fallecida pide confirmación, **cancela los turnos pendientes** y deja de permitir turnos nuevos.
  - La historia clínica se conserva y se ve en "Históricas".
  - Se puede volver a activar.
  - El dueño recibe una notificación del cambio.
- **Dar de baja**: muestra un cuadro de motivo (fallecimiento, adopción u otro). La baja saca la mascota de la lista, cancela sus turnos, revoca los accesos de los veterinarios y borra la foto. **El motivo elegido no se guarda.**
- **Historial**: línea de tiempo con los turnos de la mascota.
  - Hay **buscador**, **filtro por tipo de evento** y **filtro por fechas** (Desde y Hasta, con "Limpiar").
  - Tocar un turno abre su detalle.
  - También están el botón "Editar evento" y el "+" para agendar.
- **Recordatorios**: la misma lista de recordatorios, limitada a esa mascota.

### 3.4 Sacar o editar un turno (asistente de 3 pasos)
1. **Tipo de evento y mascota**.
   - Buscador de servicios (sin importar los acentos) sobre **6 servicios** (chequeo integral, castraciones y limpieza dental, cirugía 24hs, laboratorio y diagnóstico por imágenes, tomografía, baño y peluquería) y **17 especialidades**.
   - Solo se pueden elegir mascotas **activas**.
   - Se puede adjuntar **estudios previos**: elegir uno ya cargado en la ficha o subir uno nuevo, indicando de qué clase de estudio se trata.
   - Hay un campo de observaciones.
2. **Veterinario, fecha y hora**.
   - Solo aparecen veterinarios que ofrecen ese servicio y atienden ese tipo de animal. Cada uno muestra su estado de acceso y cuánto dura el turno con él.
   - Si atiende en más de un lugar, se pregunta **dónde**, porque cada lugar tiene sus propios días y horarios.
   - Calendario del mes donde solo se pueden elegir días en que atiende, y no fechas pasadas.
   - Grilla de horarios con los que ya pasaron o están ocupados marcados. El turno ocupa su duración completa, y se muestra a qué hora termina.
3. **Revisá y confirmá**: resumen y guardado.
- **Reglas que se aplican**: no se puede agendar en una fecha u hora pasada, ni en un horario que se pise con otro turno del veterinario, ni con otro turno de la misma mascota. El servidor vuelve a validar todo (día de atención, horario del lugar, duración, tipo de animal, mascota activa y veterinario disponible).
- Al agendar, el veterinario **pasa a ver la ficha de la mascota automáticamente**.
- **Editar un turno** usa el mismo asistente y muestra el turno actual. Si no hay cambios avisa "No hiciste ningún cambio". Solo se pueden editar los turnos próximos.
- El botón "Editar evento" lista los turnos próximos para elegir cuál editar.

### 3.5 Detalle de un turno (hoja inferior)
- Muestra servicio, mascota, estado (Próximo o Realizado), fecha, hora, veterinario con su foto y el lugar de atención si tiene más de uno, y las observaciones.
- Si el veterinario ya cargó la consulta, se ve: motivo, lo que el dueño contó, signos vitales, examen físico, diagnóstico, tratamiento indicado, **receta** (con botón para compartirla en **PDF**), lo que se cargó en el carnet, los estudios que el dueño adjuntó y los archivos que adjuntó el veterinario (se abren con la aplicación del teléfono).
- **Cancelar** un turno próximo pide confirmación y le avisa al veterinario. Un turno que ya pasó queda como registro y no se edita ni se cancela.

### 3.6 Calendario
- Calendario mensual (la semana empieza el lunes) con puntos en los días con turnos y marca para hoy.
- Botones de mes anterior y siguiente y de "Hoy". Cuenta cuántos turnos hay en el mes.
- Al tocar un día se listan sus turnos, y desde ahí se abre el detalle o se agenda uno nuevo.

### 3.7 Recordatorios
Tres solapas:
- **Próximos**: turnos que vienen, con "Hoy", "Mañana" o "Falta N días".
- **Completados**: turnos ya realizados.
- **Míos**: recordatorios hechos a mano.
  - El dueño los **crea, edita y borra**.
  - Cada uno tiene mascota, qué recordar, tipo (Vacuna, Control, Medicación, Higiene u Otro), fecha, hora opcional y nota.
  - La fecha no puede ser anterior a hoy.
  - También aparecen los que **le dejó su veterinario**, marcados con "De Dr./Dra. …". Esos se ven pero no se pueden editar ni borrar.
  - Avisan en el teléfono a su hora.

### 3.8 Notificaciones
- Diálogo con la lista. Las no leídas se marcan y recién después se dan por leídas.
- Cada notificación tiene una **"x" para borrarla** y hay un botón "Limpiar notificaciones" para borrar todas.

### 3.9 Veterinarios y permisos
- Lista de veterinarios con acceso, con filtros (Todos, Con acceso, Sin acceso) y buscador. Se aclara que los veterinarios con un turno ven la ficha automáticamente.
- Cada tarjeta muestra foto, especialidad, matrícula, cantidad de turnos, mascotas con acceso, próximo turno y estado (**"Con acceso hasta…"**, "Con acceso", **"Venció el…"** o "Sin acceso").
- **Revocar acceso** (con confirmación) y **Restablecer acceso**.
- **Autorizar a un veterinario nuevo**: se busca por usuario, correo o matrícula y se elige por cuánto tiempo.
- **Vencimiento del permiso**: sin vencimiento, 1, 3 o 6 meses, 1 año o una fecha elegida. Se puede cambiar o quitar con "Cambiar vencimiento". Un permiso vencido deja de dar acceso, también en el servidor.
- **Historial de permisos**: quién dio, pidió, aceptó, rechazó o revocó cada acceso, cuándo y hasta qué fecha.

### 3.10 Solicitudes
- Pedidos de acceso de veterinarios a las mascotas del dueño, para aceptar o rechazar.
- Si el veterinario dejó un **turno propuesto**, se **agenda solo** cuando el dueño acepta. Si no se puede agendar, el veterinario recibe un aviso con el motivo.

### 3.11 Carnet de salud
- Cinco solapas: **Vacunas, Desparasitaciones, Tratamientos, Cirugías y Documentos**.
- Resumen arriba: vacunas y desparasitaciones al día, pendientes o vencidas, y cantidad de documentos.
- Buscador y filtro por mascota (chips).
- **Agregar registro** según la solapa:
  - Vacuna y desparasitación: nombre, fecha, **próxima dosis**, marca o producto y, solo en vacunas, lote y vencimiento del lote. Estado automático: Al día, Próxima (30 días) o Vencida.
  - Tratamiento: medicamento, fecha de inicio y dosis o indicaciones.
  - Cirugía: nombre, fecha y detalles.
  - Documento: nombre y archivo (PDF, imagen o Word, hasta 15 MB).
- **Borrar** un registro con mantener apretado y confirmar. Los tratamientos indicados por el veterinario en una consulta no se pueden borrar desde acá.
- **Foto de la libreta física de vacunas**: se sube, se amplía y se puede cambiar.
- Tocar un documento lo abre.
- El carnet incluye los archivos que el veterinario adjuntó a las consultas y los tratamientos que indicó en sus informes.

### 3.12 Mi perfil
- Foto de perfil con **recorte arrastrable** y tres formas de ajustarla en el círculo.
- Datos de la cuenta, y accesos a la lista de mis mascotas y a la de veterinarios con acceso.
- **Editar datos**: nombre, teléfono y dirección. El correo no se cambia desde acá.
- **Cambiar contraseña**: pide la actual, la nueva (mínimo 6, distinta de la actual) y la confirmación.
- **Modo veterinario**: pedir el alta, ver cómo va (en revisión), volver a presentarla si fue rechazada, ver un rol suspendido o pasar a modo veterinario.
- Cerrar sesión y **eliminar cuenta** (confirmación). Se borran la cuenta, las mascotas, los turnos, el historial y los archivos, incluidos los del almacenamiento.

---

## 4. Veterinario

### 4.1 Navegación
- **Barra inferior**: Inicio, Pacientes, Agenda y Perfil, con un botón central para **agregar una consulta**.
- Las pantallas que se abren encima (ficha del paciente, solicitudes, vacunas) mantienen la barra y vuelven a la sección que se toque.

### 4.2 Inicio
- Saludo, fecha y foto.
- **Tarjeta principal**: la consulta "en horario" (dentro de los 45 minutos) o la próxima del día, o "Agenda libre".
- Contadores de pacientes de hoy y consultas pendientes, y la lista de consultas de hoy con la foto del dueño.
- Mosaico de **solicitudes pendientes** y tarjeta de **vacunas a recordar** (vencidas o por vencer).
- Campana con punto rojo.

### 4.3 Pacientes
- Búsqueda y una solapa por tipo de animal ("Todos" y cada especie, con su contador).
- Cada paciente muestra su estado si no está activo.
- Botón para agregar un paciente (nuevo dueño).

### 4.4 Ficha del paciente (cuatro pestañas)
Encabezado con foto, raza y sexo, edad, propietario con su foto y contacto. El menú de tres puntos ofrece: llamar, enviar correo, escribir por WhatsApp, certificado de vacunación (PDF), certificado de salud (PDF), crear la cuenta del dueño (si no tiene) y **recordatorios del paciente**.

1. **Informe** (la consulta, con turno o sin turno):
   - **Archivos adjuntos** a la consulta (se pueden quitar).
   - **Receta**: medicamentos con dosis, cada cuántas horas (1 a 168), cuántos días (1 a 365) e indicaciones, y botón de **receta en PDF** con la sede del turno en el encabezado.
   - **Vacunas aplicadas en la consulta**: nombre (con sugerencias según la especie), marca, lote, vencimiento del lote y próxima dosis. Quedan en el carnet del dueño.
   - **Informe clínico**: motivo, anamnesis, **signos vitales** (peso 0 a 999 kg, temperatura 25 a 45 °C, frecuencia cardíaca 10 a 400, frecuencia respiratoria 2 a 200), examen físico, diagnóstico y tratamiento. Pide al menos un dato.
   - Al guardar durante un turno se ofrece **completar el turno**. El peso medido pasa a ser el del paciente.
   - **Regla de edición**: un informe lo puede modificar solo quien lo hizo y solo el mismo día. Después queda cerrado (campos bloqueados, sin botón de guardar y con un aviso). El servidor lo exige igual.
2. **Información**: alertas clínicas editables, evolución del peso y los datos de la mascota y del propietario (dirección, teléfono, correo).
3. **Historial clínico**: turnos de la mascota con **buscador, filtro por tipo de evento y filtro por fechas**.
4. **Archivos**: subir (PDF, imagen o Word, hasta 15 MB), abrir, **renombrar** y eliminar.

### 4.5 Turnos (detalle)
- Ver servicio, motivo, fecha, hora, lugar, notas, paciente y propietario. Mostrar el informe escrito y los **estudios que el dueño adjuntó** al sacar el turno.
- Acciones sobre un turno pendiente: **Iniciar turno** (o "Continuar informe"), **Editar** (con validación de disponibilidad), **Completar** y **Cancelar** (el dueño recibe un aviso).

### 4.6 Agregar una consulta
- Elegir un paciente propio (solo activos) o **buscar un dueño por DNI o correo**, primero entre sus pacientes y después en toda la plataforma.
- Si la mascota todavía no fue compartida, se **pide acceso al dueño** y el turno queda propuesto: se agenda solo cuando el dueño acepta.
- También se puede **registrar un dueño y mascota nuevos** sin salir del flujo.
- Tipo de turno (Consulta, Control, Vacuna, Desparasitación, Tratamiento, Cirugía, Otro y los servicios que ofrece), lugar de atención, fecha y hora validados contra su disponibilidad, motivo y notas.
- No deja agendar un tipo de animal que el veterinario no atiende.
- Si la fecha es pasada, el turno se carga como completado. Según el tipo, también deja un registro en el carnet (vacuna, desparasitación, tratamiento o cirugía).

### 4.7 Nuevo dueño o paciente desde el consultorio
- Se cargan los datos del dueño (nombre, DNI, teléfono, correo, con sus validaciones) y de la mascota.
- Dos caminos: **guardar solo el paciente** (sin cuenta del dueño) o **crear la cuenta del dueño**. En ese caso se genera un usuario con contraseña temporal y se muestran los datos de acceso **una sola vez**, con atajos para mandarlos por WhatsApp o copiarlos.
- También sirve para crearle la cuenta a pacientes ya cargados (y a los otros del mismo propietario).
- Al ingresar por primera vez, el dueño elige su contraseña (ver 1.5).

### 4.8 Solicitudes
- Pedidos de acceso que le hacen los dueños (aceptar o rechazar) y los que él envió, que aparecen como "Esperando la respuesta del dueño". Al aceptar, la mascota se suma a sus pacientes.

### 4.9 Vacunas pendientes
- Pacientes con dosis **vencidas o que vencen en los próximos 30 días**, con la foto del dueño y su contacto.
- Atajos para **llamar** o **escribir por WhatsApp** con un mensaje ya armado que ofrece sacar un turno.

### 4.10 Recordatorios para un paciente
- Desde el menú de la ficha, "Recordatorios del paciente": crear, editar y borrar los que dejó el propio veterinario.
- El dueño recibe un aviso y los ve en su lista con "De Dr./Dra. …". Los del veterinario también le avisan al teléfono a su hora.

### 4.11 Agenda
- Tres solapas: **Próximos, Completados y Cancelados**, agrupadas por fecha ("Hoy", "Mañana"…).
- Cada turno muestra la foto del dueño, la hora, el paciente, el tipo, el motivo, el lugar (si atiende en varios) y el estado. Cuenta los turnos de cada solapa.

### 4.12 Perfil profesional
- Foto, nombre, matrícula, DNI, teléfono y correo.
- **Lugares de atención**: hasta 3. Cada uno tiene nombre, dirección, días y horario propios. Se pueden agregar, editar y borrar. No se puede borrar el último ni uno con turnos pendientes.
- **Especialidades y prácticas** que realiza.
- **Animales que atiende**: los dueños solo pueden sacar turno para esos tipos.
- **Duración de cada práctica** (de 15 a 480 minutos, de a 15), que define cuánto tiempo bloquea en la agenda.
- Editar el perfil: nombre, matrícula, teléfono y correo. **Si cambia la matrícula, la cuenta vuelve a revisión** y se avisa a los administradores.
- Cambiar contraseña y preferencias de notificación.
- Pasar a modo dueño, cerrar sesión (con confirmación) y eliminar la cuenta.

---

## 5. Administrador

Cuatro paneles en la barra inferior.
1. **Inicio**: mosaicos de veterinarios activos, dueños activos, mascotas y turnos pendientes de hoy. Muestra una tarjeta de **revisión pendiente** con un botón para revisar las solicitudes (o "Todo al día") y la lista de altas pendientes.
2. **Veterinarios**: filtros (En revisión, Activos, Rechazados, Suspendidos, Todos) y buscador por nombre, matrícula o clínica. El detalle muestra los datos, los horarios y la **foto del carnet** (se baja del almacenamiento privado, se ve y se descarta sin guardarse en el teléfono).
   - **Dar de alta** (con el recordatorio de verificar la matrícula en el colegio profesional).
   - **Rechazar** con motivo (opciones sugeridas o texto libre).
   - **Suspender** con motivo y **reactivar**.
3. **Dueños**: filtros (Todos, Activos, Suspendidos) y buscador por nombre, DNI o correo. El detalle muestra sus datos y sus mascotas. Se puede **suspender** (con motivo) o **reactivar**.
4. **Actividad**: registro de los movimientos de la plataforma (altas, aprobaciones, rechazos, suspensiones y reactivaciones).
- "Mi cuenta": correo, totales y cerrar sesión.
- La revisión del rol de veterinario de un dueño que también lo pidió **no toca su cuenta de dueño**.
- Quien resulta aprobado, rechazado, suspendido o reactivado recibe una notificación con el motivo.

---

## 6. Qué hace la base de datos por su cuenta

Estas reglas se cumplen aunque alguien intente saltearse la app.

- **Permisos por fila**: cada usuario ve solo lo suyo. El dueño ve sus mascotas, el veterinario las que le compartieron o creó, y el administrador todo. Las cuentas no activas quedan bloqueadas.
- **Turnos**:
  - se validan el día y el horario del lugar, la duración, que no sea una fecha pasada, que el veterinario atienda ese tipo de animal y que la mascota esté activa;
  - no puede haber turnos superpuestos del mismo veterinario;
  - la duración la fija el servidor según el servicio;
  - se guarda quién canceló.
- **Avisos automáticos**: nuevo turno, turno modificado, completado, cancelado, solicitud de acceso y su respuesta, mascota agregada, dada de baja, inactiva, fallecida o activa, recordatorio del veterinario, cuenta aprobada, rechazada, suspendida o reactivada, alta nueva de veterinario y matrícula modificada (estos dos, a los administradores).
- **Accesos**:
  - agendar con un veterinario le da acceso a la mascota;
  - una mascota cargada por un veterinario le da acceso a él;
  - un acceso puede vencer;
  - cada cambio de acceso queda en el historial.
- **Informes**: solo los edita el veterinario que los hizo y el mismo día; no se puede cambiarles la mascota, el turno ni el autor. El peso medido actualiza el de la mascota.
- **Mascotas**: la baja o el pase a inactiva o fallecida cancela los turnos pendientes. Se guarda desde qué día está en ese estado.
- **Lugares de atención**: máximo 3, siempre al menos uno y no se borra uno con turnos pendientes. Siempre hay un lugar principal.
- **Cuentas**: el DNI y la matrícula no se repiten; el estado de una cuenta solo lo cambia un administrador; cambiar la matrícula pide una revisión nueva.
- **Eliminar cuenta**: borra todo lo que la persona cargó.
- **Archivos**: fotos, documentos y carnets de veterinarios en almacenamiento privado, con permisos por carpeta. Las fotos de perfil se ven entre dueño y veterinario solo cuando hay un vínculo (un turno o un pedido de acceso).

---

## 7. Cosas que la app no hace (por ahora)

- No hay notificaciones "push" en tiempo real con la app cerrada: se revisa cada 15 minutos.
- La lista "Vacunas pendientes" del veterinario solo incluye **vacunas**; las próximas desparasitaciones avisan al dueño en su teléfono pero no aparecen en esa lista.
- Desparasitaciones y cirugías se cargan desde el carnet o al crear un turno; **no** desde la hoja de vacunas del informe.
- El veterinario no ve el vencimiento de un permiso: solo deja de ver la ficha cuando vence.
- El motivo elegido al dar de baja una mascota no se guarda.
- No hay registro de auditoría de cambios en los informes: la regla es que el informe no se modifica pasado el día.
- No hay pagos, chat interno ni receta electrónica con validez legal: la receta y los certificados son PDF para compartir.
