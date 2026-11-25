// Crea la cuenta de una persona de la recepción a pedido de un veterinario activo (Perfil → Recepción).
//
// Igual que crear-cuenta-dueno:
//   1. comprueba que quien llama es un veterinario activo,
//   2. crea el usuario con una contraseña temporal (sin pedir confirmar el correo),
//   3. deja el vínculo de recepción activo y la cuenta marcada para elegir su contraseña al primer ingreso
//      (vincular_cuenta_recepcionista).
// La cuenta es de rol 'dueno': si algún día carga mascotas propias, también las ve desde el modo dueño.
//
// Los errores esperables (DNI repetido, correo repetido...) se responden con 200 y { ok: false, error, mensaje }
// para que la app los muestre tal cual.
//
// Se despliega con verify_jwt activado:  supabase functions deploy crear-cuenta-recepcionista
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Se comparte con las cuentas de dueños que crea el mismo veterinario
const MAX_CUENTAS_POR_DIA = 20;
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

  // 1. Quién llama: un veterinario con el rol aprobado y la cuenta activa
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: sesion, error: errSesion } = await admin.auth.getUser(token);
  if (errSesion || !sesion?.user) return rechazo("sin_sesion", "Tu sesión venció. Volvé a ingresar.", 401);
  const vetId = sesion.user.id;

  const { data: vet } = await admin
    .from("profiles")
    .select("id, estado, nombre, veterinarios(estado_revision)")
    .eq("id", vetId)
    .maybeSingle();
  const revision = (vet?.veterinarios as { estado_revision?: string } | null)?.estado_revision;
  if (!vet || vet.estado !== "activo" || revision !== "activo") {
    return rechazo("no_autorizado", "Solo los veterinarios con la cuenta aprobada pueden crear cuentas de recepción.", 403);
  }

  // 2. Límite diario, para que no se use para crear cuentas en masa
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("creada_por_veterinario", vetId)
    .gte("created_at", desde);
  if ((count ?? 0) >= MAX_CUENTAS_POR_DIA) {
    return rechazo("limite", "Llegaste al máximo de cuentas que se pueden crear por día. Probá mañana.", 429);
  }
  const { count: vinculos } = await admin
    .from("recepcionistas_vet")
    .select("id", { count: "exact", head: true })
    .eq("veterinario_id", vetId);
  if ((vinculos ?? 0) >= 10) return rechazo("limite", "Llegaste al máximo de vínculos de recepción");

  // 3. Datos
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return rechazo("datos", "No pudimos leer los datos enviados", 400);
  }
  const nombre = texto(cuerpo.nombre, 80);
  const dni = texto(cuerpo.dni, 8);
  const telefono = texto(cuerpo.telefono, 30);
  const email = texto(cuerpo.email, 120).toLowerCase();

  if (nombre.length < 2) return rechazo("nombre", "Ingresá el nombre y el apellido");
  if (!/^[0-9]{7,8}$/.test(dni)) return rechazo("dni", "El DNI debe tener 7 u 8 números");
  if (telefono.replace(/\D/g, "").length < 6) return rechazo("telefono", "Ingresá un teléfono válido");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return rechazo("correo", "Ingresá un correo válido");

  // 4. Que no exista ya una cuenta con ese DNI o ese correo (si existe, se la invita desde la misma hoja)
  const { data: dniUsado } = await admin.from("perfiles_privados").select("profile_id").eq("dni", dni).maybeSingle();
  if (dniUsado) {
    return rechazo("dni_en_uso", "Ese DNI ya tiene una cuenta en PetCare. Invitalo/a con su DNI o su correo.");
  }
  const { data: correoUsado } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (correoUsado) {
    return rechazo("correo_en_uso", "Ese correo ya está registrado en PetCare. Invitalo/a con su correo.");
  }

  // 5. Alta del usuario. El trigger de la base arma el perfil y el DNI.
  const password = passwordTemporal();
  const { data: creado, error: errAlta } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { rol: "dueno", nombre, dni, telefono },
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

  // 6. Vínculo activo y contraseña para cambiar (en la base, por los triggers de `private`)
  const { error: errVinculo } = await admin.rpc("vincular_cuenta_recepcionista", { p_cuenta: cuentaId, p_veterinario: vetId });
  if (errVinculo) {
    console.error("vinculo", errVinculo.message);
    await admin.auth.admin.deleteUser(cuentaId);
    return rechazo("servidor", "No pudimos sumar la cuenta a tu recepción: " + errVinculo.message, 500);
  }

  // 7. Constancia para el administrador (si falla no importa: la cuenta ya está creada)
  await admin
    .from("actividad_admin")
    .insert({ tipo: "registro", texto: `${vet.nombre} creó la cuenta de recepción de ${nombre}`, actor_id: vetId, objetivo_id: cuentaId });

  return responder(200, { ok: true, usuario_id: cuentaId, email, password_temporal: password });
});
