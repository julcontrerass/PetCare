# PetCare

App de historial clínico de mascotas, hecha con **React Native y Expo** (Android, iOS y web). Tiene tres tipos de usuario: **dueño**, **veterinario** y **administrador**. Los datos viven en un proyecto de [Supabase](https://supabase.com) (Postgres, Auth, Storage, Realtime y Edge Functions).

## Qué hay en el repositorio

| Carpeta | Qué contiene |
|---|---|
| [`petcare-expo/`](petcare-expo/README.md) | La app. Cómo instalarla, correrla, probarla y publicarla está en su README. |
| `supabase/functions/` | Código de las Edge Functions que están desplegadas en el proyecto de Supabase (ver más abajo). |

La versión anterior de la app, en Android nativo con Kotlin, se reemplazó por la de Expo. Sigue en el historial de git (rama `main`).

## La seguridad no depende de la app

Todas las tablas tienen RLS y los permisos por columna están definidos en la base. La clave que usa la app (`EXPO_PUBLIC_SUPABASE_KEY`) es la *publishable*, pensada para estar en el cliente.

## Configuración en Supabase

- **Correo de confirmación:** el registro pide confirmar el correo si está activado en *Authentication → Providers → Email*. El servidor de correo incluido en Supabase manda muy pocos mensajes por hora; para producción conviene configurar un SMTP propio.
- **Contraseñas filtradas:** activar *Leaked password protection* en *Authentication → Policies*.
- **Cuenta de administrador:** se crea una sola vez desde el panel de Supabase (usuario con rol `admin` en `profiles`); la app no permite registrarse como administrador.
- **Enlaces de recuperación de contraseña:** en *Authentication → URL Configuration → Redirect URLs* agregar `petcare://recuperar` (desde la app) y `https://TU-DOMINIO/auth/recuperar` (desde la web).

## Edge Functions

| Función | Para qué sirve | Verificación de JWT |
|---|---|---|
| `crear-cuenta-dueno` | El veterinario le crea la cuenta a un dueño en el consultorio (ver más abajo). | Sí |
| `avisar-veterinario` | Manda un correo al veterinario cuando el administrador aprueba o rechaza su alta. La app la llama después de revisar la solicitud. | Sí |
| `enviar-correos` | Vacía la cola `public.correos_cola` y manda los correos de aprobación, rechazo, suspensión, reactivación y revisión de cuentas de veterinario. La dispara la base cuando cambia el estado de la cuenta y un cron cada 5 minutos reintenta lo pendiente. | No |

Secretos del proyecto (*Edge Functions → Secrets*): `SMTP_USER` y `SMTP_PASS` (por ejemplo una cuenta de Gmail con contraseña de aplicación) o, en `enviar-correos`, `RESEND_API_KEY` y `MAIL_FROM`. Las funciones usan la clave de servicio que Supabase les entrega al desplegarlas: no va en la app.

Para desplegar una: `supabase functions deploy <nombre>`.

## Turnos: duración y tipos de animal

- Cada servicio o especialidad tiene una duración habitual (`duracionPorDefecto` en `petcare-expo/src/data/catalogoMedico.ts`, que tiene que coincidir con `private.duracion_por_defecto` en la base). El veterinario puede cambiarla desde su perfil (*Duración de los turnos*); queda en `veterinarios.duraciones`.
- La duración real de un turno la fija el servidor al crearlo (`turnos.duracion_min`, trigger `turnos_duracion`) y de ahí sale el rango que impide superposiciones. La app calcula lo mismo para mostrar solo los horarios en los que el turno entra completo.
- El veterinario elige qué animales atiende al registrarse o desde su perfil (`veterinarios.tipos_animales`). El dueño solo ve veterinarios que atienden el tipo de su mascota y la base rechaza el turno si no es así.

## Lugares de atención

- Un veterinario puede atender en hasta 3 lugares (tabla `sedes`), cada uno con su nombre, dirección, días y horario. Se cargan desde *Perfil → Lugares de atención*; el primero es el principal y sus datos se reflejan en `veterinarios.clinica`, `direccion_clinica`, `dias_atencion` y `hora_*`.
- Cada turno guarda dónde es (`turnos.sede_id`). El dueño elige el lugar al sacar el turno y los horarios que ve salen de ese lugar; el trigger `turnos_validar` valida el turno contra el lugar elegido (o, si no viene, contra el primero que atiende ese día y a esa hora).
- La agenda es una sola: un turno en un lugar bloquea el mismo horario en los demás (la restricción `turnos_sin_superposicion_vet` no distingue lugares).
- No se puede borrar el único lugar ni uno con turnos pendientes.

## Historia clínica, recetas y avisos de salud

- **Informe de consulta (SOAP):** motivo, anamnesis, signos vitales (peso, temperatura, frecuencia cardíaca y respiratoria), examen físico, diagnóstico y plan. El peso medido pasa a ser el peso actual de la mascota (trigger `informes_peso`) y alimenta el gráfico de evolución. Un informe solo lo puede modificar quien lo hizo y el mismo día (trigger `informes_validar`).
- **Vacunas y desparasitaciones:** guardan producto, lote y vencimiento del lote. El veterinario tiene la lista *Vacunas a recordar* (vencidas o por vencer en 30 días) con atajos a WhatsApp y llamada.
- **Recetas:** un medicamento por fila en `prescripciones`; las de una consulta forman la receta, que se comparte en PDF. Si tienen frecuencia y duración, el dueño recibe un aviso en cada toma.
- **Certificados:** de vacunación y de salud en PDF con la matrícula del veterinario (`petcare-expo/src/ui/common/Documentos.ts`).
- **Avisos al dueño:** una semana antes y el día de cada próxima dosis, y una sola vez cuando una vacuna ya venció (`paraVacunas` en `petcare-expo/src/data/avisos/recordatorios.ts`).
- **Alertas clínicas** de la mascota (alergias, carácter), editables por el veterinario con acceso (`guardar_alertas`).
- **Estado de la mascota:** activa, inactiva o fallecida. Al dejar de estar activa se cancelan sus turnos pendientes y no se pueden agendar turnos nuevos (`mascotas.estado`).
- **Permisos de acceso:** pueden tener fecha de vencimiento (`accesos_mascota.vence_el`) y cada cambio queda en `accesos_historial`.
- **Recordatorios:** los puede crear el dueño para su mascota o el veterinario para un paciente (tabla `recordatorios`).

## Mascotas con más de un dueño

Una mascota puede compartirse entre varias cuentas (por ejemplo, una pareja) sin cargarla dos veces:

- **Invitar:** en la ficha de la mascota, *Más opciones → Dueños de la mascota*, se escribe el DNI o el correo de la otra persona (tiene que tener cuenta). La función `invitar_codueno` crea la invitación en `coduenos_mascota` y le manda un aviso.
- **Aceptar:** la invitación aparece en el Inicio de la persona invitada (`mis_invitaciones_codueno`) con *Aceptar* y *Rechazar* (`responder_invitacion_codueno`). Hasta que acepta no ve nada de la mascota.
- **Permisos:** un co-dueño ve y edita lo mismo que el dueño (ficha, historial, turnos, vacunas, archivos, accesos de veterinarios) e invita a otros. Solo el dueño original (`mascotas.dueno_id`) puede dar de baja a la mascota y quitar co-dueños (`quitar_codueno`); el trigger `mascotas_proteger_dueno` lo hace cumplir en la base. Un co-dueño puede salir cuando quiera.
- **En la base:** `private.es_dueno_de()` cuenta a los co-dueños activos, así que todas las políticas que la usan los incluyen. Los avisos de turnos, recordatorios, accesos y cambios de estado les llegan a todos los dueños (`private.duenos_de()`).
- **Baja de cuenta:** si el dueño original elimina su cuenta, cada mascota compartida pasa al co-dueño más antiguo en vez de borrarse (y sus archivos se conservan).
- La migración está en `supabase/migrations/20261123180000_coduenos_mascota.sql`.

## Una cuenta, dos modos: dueño y veterinario

Una misma cuenta (un correo, una contraseña) puede usarse como dueño de mascotas y como veterinario:

- **Rol de veterinario con revisión propia:** `veterinarios.estado_revision` guarda si el alta fue aprobada. La cuenta de dueño sigue activa mientras el administrador revisa. Quien se registró como veterinario sigue el mismo estado que su cuenta (un disparador los mantiene juntos).
- **Cómo se suma el rol:** el dueño toca *Soy veterinario/a: pedir el alta* en su perfil, carga matrícula, clínica, horarios y la **foto de su carnet o matrícula** (bucket privado `credenciales`, solo la ve el administrador) y la función `solicitar_alta_veterinario` lo deja pendiente. Los veterinarios nuevos suben el mismo carnet al registrarse.
- **Revisión:** en el panel del administrador, *Ver foto del carnet o matrícula* y los botones de alta, rechazo o suspensión llaman a `revisar_veterinario`, que solo toca el rol (la cuenta de dueño no se suspende).
- **Al ingresar** con las dos posibilidades activas, la app pregunta *¿Cómo querés ingresar?*. Un veterinario sin mascotas propias entra directo. Desde el perfil se puede pasar de un modo al otro sin cerrar sesión (`ModoDeUso`).
- **Seguridad:** las políticas y funciones de la base usan `private.es_vet_activo()` (rol aprobado y cuenta activa) en lugar de un rol único. Quien es veterinario de una mascota propia no se pide acceso a sí mismo: la ve desde el modo dueño.

## Cuentas de dueños creadas por el veterinario

Un dueño que todavía no usa la app puede recibir su cuenta en el consultorio, sin pasar por un turno:

1. El veterinario carga al dueño (nombre, DNI, teléfono, correo) y a la mascota en *Nuevo dueño y mascota*, o elige *Crear cuenta del dueño* en la ficha de un paciente que ya cargó sin cuenta.
2. La función `crear-cuenta-dueno` valida que quien llama sea un veterinario activo, crea el usuario con una contraseña temporal, deja la mascota a nombre del dueño y mantiene el acceso del veterinario. Máximo 20 cuentas por veterinario por día. Para marcar la cuenta y pasar las mascotas al dueño llama a `public.vincular_cuenta_dueno`, una función de la base que solo puede ejecutar el servicio.
3. La app muestra el correo y la contraseña temporal una sola vez y arma el mensaje para WhatsApp.
4. Al ingresar, el dueño tiene que elegir su propia contraseña y aceptar los términos (`profiles.debe_cambiar_password`, función `completar_primer_ingreso`).
