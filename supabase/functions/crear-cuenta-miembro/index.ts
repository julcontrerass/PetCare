// Crea la cuenta de una persona del equipo de una veterinaria (veterinario, recepción o administración) a pedido del
// titular o de un administrador de esa veterinaria (Mis veterinarias → equipo → "No tiene cuenta: crearla").
//
// Como crear-cuenta-dueno:
//   1. comprueba que quien llama es titular o administrador activo de la veterinaria (y que esté aprobada),
//   2. crea el usuario con una contraseña temporal (sin pedir confirmar el correo),
//   3. lo deja como miembro activo con los roles pedidos y marcado para elegir su contraseña al primer ingreso
//      (vincular_cuenta_a_clinica).
// Recepción y administración: cuenta de rol 'dueno' (si algún día carga mascotas propias, las ve desde el modo dueño).
// Veterinario: cuenta de rol 'veterinario' con su matrícula y la foto del carnet, en revisión como cualquier
// veterinario nuevo (no puede ingresar ni aparece su agenda hasta que el administrador la aprueba).
//
// Los errores esperables (DNI repetido, correo repetido...) se responden con 200 y { ok: false, error, mensaje }
// para que la app los muestre tal cual.
//
// Se despliega con verify_jwt activado:  supabase functions deploy crear-cuenta-miembro
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Por cuenta que crea (se comparte con las cuentas de dueños que crea el mismo veterinario)
const MAX_CUENTAS_POR_DIA = 20;
const ROLES_PERMITIDOS = ["recepcion", "administrador", "veterinario"];
/** Foto del carnet en base64: hasta ~4 MB. */
const MAX_CREDENCIAL_B64 = 5_600_000;

function bytesDeBase64(b64: string): Uint8Array {
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SIMBOLOS = "#@*+=?";

const responder = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const rechazo = (error: string, mensaje: string, status = 200) => responder(status, { ok: false, error, mensaje });

/** Misma contraseña temporal que crear-cuenta-dueno: sin caracteres que se confunden y con un símbolo en el medio. */
function passwordTemporal(largo = 10): string {
  while (true) {
    const salida: string[] = [];
    const limite = 256 - (256 % ALFABETO.length);
    while (salida.length < largo - 1) {
      const bytes = crypto.getRandomValues(new Uint8Array(largo * 2));
      for (const b of bytes) {
        if (b < limite && salida.length < largo - 1) salida.push(ALFABETO[b % ALFABETO.length]);
      }
    }
    const azar = crypto.getRandomValues(new Uint8Array(2));
    const simbolo = SIMBOLOS[azar[0] % SIMBOLOS.length];
    const posicion = 2 + (azar[1] % (largo - 4));
    salida.splice(posicion, 0, simbolo);
    const p = salida.join("");
    if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p)) return p;
  }
}

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return rechazo("metodo", "Método no permitido", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Quién llama
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: sesion, error: errSesion } = await admin.auth.getUser(token);
  if (errSesion || !sesion?.user) return rechazo("sin_sesion", "Tu sesión venció. Volvé a ingresar.", 401);
  const actorId = sesion.user.id;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return rechazo("datos", "No pudimos leer los datos enviados", 400);
  }
  const clinicaId = texto(cuerpo.clinica_id, 40);
  const roles = (Array.isArray(cuerpo.roles) ? cuerpo.roles : []).filter(
    (r): r is string => typeof r === "string" && ROLES_PERMITIDOS.includes(r),
  );
  if (!clinicaId) return rechazo("datos", "Falta la veterinaria", 400);
  if (roles.length === 0) return rechazo("roles", "Elegí el rol de la persona en la veterinaria");
  const esVeterinario = roles.includes("veterinario");

  // 2. Que sea titular o administrador activo de esa veterinaria (y que su cuenta esté activa)
  const { data: actor } = await admin.from("profiles").select("id, estado, nombre").eq("id", actorId).maybeSingle();
  const { data: miembro } = await admin
    .from("clinica_miembros")
    .select("roles, estado, clinicas(nombre, activa, revision)")
    .eq("clinica_id", clinicaId)
    .eq("cuenta_id", actorId)
    .maybeSingle();
  const rolesActor = (miembro?.roles as string[] | undefined) ?? [];
  const clinica = miembro?.clinicas as { nombre?: string; activa?: boolean; revision?: string } | null;
  if (
    !actor || actor.estado !== "activo" || !miembro || miembro.estado !== "activo" || !clinica?.activa ||
    !rolesActor.some((r) => r === "titular" || r === "administrador")
  ) {
    return rechazo("no_autorizado", "Solo el titular o un administrador de la veterinaria puede crear cuentas del equipo.", 403);
  }
  if (clinica.revision !== "aprobada") {
    return rechazo("en_revision", "La veterinaria todavía está en revisión. Cuando el administrador la apruebe vas a poder sumar a tu equipo.", 403);
  }

  // 3. Límite diario, para que no se use para crear cuentas en masa
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("clinica_historial")
    .select("id", { count: "exact", head: true })
    .eq("actor", actorId)
    .eq("accion", "alta")
    .eq("detalle", "cuenta creada por la veterinaria")
    .gte("created_at", desde);
  if ((count ?? 0) >= MAX_CUENTAS_POR_DIA) {
    return rechazo("limite", "Llegaste al máximo de cuentas que se pueden crear por día. Probá mañana.", 429);
  }

  // 4. Datos de la persona
  const nombre = texto(cuerpo.nombre, 80);
  const dni = texto(cuerpo.dni, 8);
  const telefono = texto(cuerpo.telefono, 30);
  const email = texto(cuerpo.email, 120).toLowerCase();
  if (nombre.length < 2) return rechazo("nombre", "Ingresá el nombre y el apellido");
  if (!/^[0-9]{7,8}$/.test(dni)) return rechazo("dni", "El DNI debe tener 7 u 8 números");
  if (telefono.replace(/\D/g, "").length < 6) return rechazo("telefono", "Ingresá un teléfono válido");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return rechazo("correo", "Ingresá un correo válido");

  const { data: dniUsado } = await admin.from("perfiles_privados").select("profile_id").eq("dni", dni).maybeSingle();
  if (dniUsado) return rechazo("dni_en_uso", "Ese DNI ya tiene una cuenta en PetCare. Invitalo/a con su DNI o su correo.");
  const { data: correoUsado } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (correoUsado) return rechazo("correo_en_uso", "Ese correo ya está registrado en PetCare. Invitalo/a con su correo.");

  // Veterinario: matrícula libre y foto del carnet (el administrador la necesita para aprobarlo)
  const matricula = texto(cuerpo.matricula, 30);
  const credencialB64 = typeof cuerpo.credencial === "string" ? cuerpo.credencial : "";
  if (esVeterinario) {
    if (matricula.length < 3) return rechazo("matricula", "Ingresá la matrícula del veterinario");
    const { data: matriculaUsada } = await admin.from("veterinarios").select("profile_id").ilike("matricula", matricula).maybeSingle();
    if (matriculaUsada) return rechazo("matricula_en_uso", "Esa matrícula ya está registrada. Invitalo/a con su DNI o su correo.");
    if (!credencialB64) return rechazo("credencial", "Sumá la foto del carnet o de la matrícula");
    if (credencialB64.length > MAX_CREDENCIAL_B64) return rechazo("credencial", "La foto del carnet es muy pesada");
  }

  // 5. Alta del usuario. El trigger de la base arma el perfil y el DNI (y, si es veterinario, sus datos en revisión
  //    y su propia veterinaria).
  const password = passwordTemporal();
  const { data: creado, error: errAlta } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: esVeterinario
      ? { rol: "veterinario", nombre, dni, telefono, matricula }
      : { rol: "dueno", nombre, dni, telefono },
  });
  if (errAlta || !creado?.user) {
    const m = (errAlta?.message ?? "").toLowerCase();
    if (m.includes("already") || m.includes("exists")) {
      return rechazo("correo_en_uso", "Ese correo ya está registrado en PetCare. Invitalo/a con su correo.");
    }
    if (m.includes("dni")) return rechazo("dni_en_uso", "Ese DNI ya tiene una cuenta en PetCare.");
    console.error("createUser", errAlta?.message);
    return rechazo("servidor", "No pudimos crear la cuenta: " + (errAlta?.message ?? "error desconocido"), 500);
  }
  const cuentaId = creado.user.id;

  // El carnet va a la carpeta del veterinario en el bucket privado, como cuando se registra solo
  if (esVeterinario) {
    const ruta = `${cuentaId}/${crypto.randomUUID()}.jpg`;
    let errFoto: string | null = null;
    try {
      const { error } = await admin.storage.from("credenciales").upload(ruta, bytesDeBase64(credencialB64), { contentType: "image/jpeg" });
      if (error) errFoto = error.message;
      else {
        const { error: errRuta } = await admin.from("veterinarios").update({ credencial_path: ruta }).eq("profile_id", cuentaId);
        if (errRuta) errFoto = errRuta.message;
      }
    } catch (e) {
      errFoto = e instanceof Error ? e.message : String(e);
    }
    if (errFoto) {
      console.error("credencial", errFoto);
      await admin.auth.admin.deleteUser(cuentaId);
      return rechazo("servidor", "No pudimos guardar la foto del carnet: " + errFoto, 500);
    }
  }

  // 6. Miembro activo de la veterinaria y contraseña para cambiar (en la base, por los triggers de `private`)
  const { error: errVinculo } = await admin.rpc("vincular_cuenta_a_clinica", {
    p_cuenta: cuentaId, p_clinica: clinicaId, p_roles: roles, p_actor: actorId,
  });
  if (errVinculo) {
    console.error("vinculo", errVinculo.message);
    await admin.auth.admin.deleteUser(cuentaId);
    return rechazo("servidor", "No pudimos sumar la cuenta a la veterinaria: " + errVinculo.message, 500);
  }

  // 7. Constancia para el administrador de la plataforma (si falla no importa: la cuenta ya está creada)
  await admin.from("actividad_admin").insert({
    tipo: "registro",
    texto: esVeterinario
      ? `${actor.nombre} dio de alta al veterinario ${nombre} (matrícula ${matricula}) en ${clinica.nombre ?? "su veterinaria"}: falta verificar la matrícula`
      : `${actor.nombre} creó la cuenta de ${nombre} en ${clinica.nombre ?? "su veterinaria"}`,
    actor_id: actorId, objetivo_id: cuentaId,
  });

  return responder(200, { ok: true, usuario_id: cuentaId, email, password_temporal: password, en_revision: esVeterinario });
});
