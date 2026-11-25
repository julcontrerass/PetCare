// Crea la cuenta de un dueño a pedido de un veterinario con la cuenta aprobada.
//
// El veterinario carga los datos del dueño y de su mascota en el consultorio; la app llama a esta función, que:
//   1. comprueba que quien llama es un veterinario activo,
//   2. crea el usuario con una contraseña temporal (sin pedir confirmar el correo),
//   3. deja a la mascota a nombre del nuevo dueño; el veterinario mantiene su acceso.
// El dueño ingresa después con esa contraseña y la app le pide elegir la suya (profiles.debe_cambiar_password).
//
// Los errores esperables (DNI repetido, correo repetido...) se responden con 200 y { ok: false, error, mensaje }
// para que la app los muestre tal cual.
//
// Se despliega con verify_jwt activado:  supabase functions deploy crear-cuenta-dueno
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CUENTAS_POR_DIA = 20;
const MAX_MASCOTAS = 5;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
// Un símbolo en el medio, por si el proyecto exige símbolos en las contraseñas
const SIMBOLOS = "#@*+=?";

const responder = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const rechazo = (error: string, mensaje: string, status = 200) => responder(status, { ok: false, error, mensaje });

/**
 * Contraseña temporal: letras sin caracteres que se confunden (0/O, 1/l/I), números y un símbolo en el medio,
 * con mayúscula, minúscula y número seguro.
 */
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
    const posicion = 2 + (azar[1] % (largo - 4)); // nunca al principio ni al final
    salida.splice(posicion, 0, simbolo);
    const p = salida.join("");
    if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p)) return p;
  }
}

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

interface MascotaNueva {
  nombre: string;
  tipo: string;
  sexo: string | null;
  raza: string | null;
  nacimiento: string | null;
  peso_kg: number | null;
  color: string | null;
  microchip: string | null;
}

function leerMascota(m: Record<string, unknown>): MascotaNueva | string {
  const nombre = texto(m.nombre, 60);
  if (!nombre) return "Falta el nombre de la mascota";
  const tipo = texto(m.tipo, 30) || "Otro";
  const sexo = texto(m.sexo, 10).toLowerCase();
  const nacimiento = texto(m.nacimiento, 10);
  if (nacimiento && (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento) || new Date(nacimiento) > new Date())) {
    return "La fecha de nacimiento de la mascota no es válida";
  }
  const peso = typeof m.peso_kg === "number" ? m.peso_kg : null;
  if (peso !== null && !(peso > 0 && peso < 500)) return "El peso de la mascota no es válido";
  const microchip = texto(m.microchip, 15);
  if (microchip && !/^[0-9]{15}$/.test(microchip)) return "El microchip tiene que tener 15 números";
  return {
    nombre,
    tipo,
    sexo: sexo === "macho" || sexo === "hembra" ? sexo : null,
    raza: texto(m.raza, 60) || null,
    nacimiento: nacimiento || null,
    peso_kg: peso,
    color: texto(m.color, 40) || null,
    microchip: microchip || null,
  };
}

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
  const vetId = sesion.user.id;

  const { data: vet } = await admin.from("profiles").select("id, rol, estado, nombre").eq("id", vetId).maybeSingle();
  if (!vet || vet.rol !== "veterinario" || vet.estado !== "activo") {
    return rechazo("no_autorizado", "Solo los veterinarios con la cuenta aprobada pueden crear cuentas de dueños.", 403);
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
  const direccion = texto(cuerpo.direccion, 120) || null;

  if (nombre.length < 2) return rechazo("nombre", "Ingresá el nombre del dueño");
  if (!/^[0-9]{7,8}$/.test(dni)) return rechazo("dni", "El DNI debe tener 7 u 8 números");
  if (telefono.replace(/\D/g, "").length < 6) return rechazo("telefono", "Ingresá un teléfono válido");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return rechazo("correo", "Ingresá un correo válido");

  const nuevas: MascotaNueva[] = [];
  const bruto = Array.isArray(cuerpo.mascotas_nuevas) ? cuerpo.mascotas_nuevas : [];
  for (const m of bruto.slice(0, MAX_MASCOTAS)) {
    const leida = leerMascota((m ?? {}) as Record<string, unknown>);
    if (typeof leida === "string") return rechazo("mascota", leida);
    nuevas.push(leida);
  }
  const existentes = (Array.isArray(cuerpo.mascotas_existentes) ? cuerpo.mascotas_existentes : [])
    .filter((x): x is string => typeof x === "string")
    .slice(0, 10);
  if (nuevas.length + existentes.length === 0) return rechazo("mascota", "Falta cargar al menos una mascota");

  // 4. Que no exista ya una cuenta con ese DNI o ese correo
  const { data: dniUsado } = await admin.from("perfiles_privados").select("profile_id").eq("dni", dni).maybeSingle();
  if (dniUsado) {
    return rechazo(
      "dni_en_uso",
      "Ese DNI ya tiene una cuenta en PetCare. Buscalo por DNI al agendar un turno y pedile acceso a su mascota.",
    );
  }
  const { data: correoUsado } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (correoUsado) {
    return rechazo("correo_en_uso", "Ese correo ya está registrado en PetCare. Usá otro o buscá al dueño por su correo.");
  }

  // 5. Las mascotas ya cargadas tienen que ser del veterinario y no tener dueño con cuenta
  if (existentes.length > 0) {
    const { data: propias } = await admin
      .from("mascotas")
      .select("id")
      .in("id", existentes)
      .eq("creada_por", vetId)
      .is("dueno_id", null)
      .eq("activa", true);
    if ((propias ?? []).length !== new Set(existentes).size) {
      return rechazo("mascota", "Alguna de las mascotas ya tiene dueño con cuenta o no es tuya");
    }
  }

  // 6. Alta del usuario. El trigger de la base arma el perfil y el DNI.
  const password = passwordTemporal();
  const { data: creado, error: errAlta } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { rol: "dueno", nombre, dni, telefono, direccion: direccion ?? "" },
  });
  if (errAlta || !creado?.user) {
    const m = (errAlta?.message ?? "").toLowerCase();
    if (m.includes("already") || m.includes("exists")) {
      return rechazo("correo_en_uso", "Ese correo ya está registrado en PetCare. Usá otro o buscá al dueño por su correo.");
    }
    if (m.includes("dni")) return rechazo("dni_en_uso", "Ese DNI ya tiene una cuenta en PetCare.");
    console.error("createUser", errAlta?.message);
    if (m.includes("password") || m.includes("weak")) {
      return rechazo("password", "El servidor rechazó la contraseña temporal: " + (errAlta?.message ?? ""), 500);
    }
    return rechazo("servidor", "No pudimos crear la cuenta: " + (errAlta?.message ?? "error desconocido"), 500);
  }
  const duenoId = creado.user.id;

  const deshacer = async (mascotasCreadas: string[]) => {
    if (mascotasCreadas.length) await admin.from("mascotas").delete().in("id", mascotasCreadas);
    await admin.auth.admin.deleteUser(duenoId);
  };

  // 7. Mascotas nuevas: nacen a nombre del veterinario (la base le da el acceso)
  const creadas: { id: string; nombre: string }[] = [];
  if (nuevas.length > 0) {
    const filas = nuevas.map((m) => ({
      ...m,
      creada_por: vetId,
      dueno_id: null,
      propietario_nombre: nombre,
      propietario_dni: dni,
      propietario_telefono: telefono,
      propietario_email: email,
      propietario_direccion: direccion,
    }));
    const { data: insertadas, error: errMascotas } = await admin.from("mascotas").insert(filas).select("id, nombre");
    if (errMascotas || !insertadas) {
      console.error("mascotas", errMascotas?.message);
      await deshacer([]);
      return rechazo("mascota", "No pudimos guardar la mascota: " + (errMascotas?.message ?? ""), 500);
    }
    creadas.push(...insertadas);
  }

  // 7b. Marca la cuenta como temporal y pasa todas las mascotas al dueño, en una sola operación de la base
  // (se hace con una función de la base porque el rol de servicio no puede disparar los triggers de `private`)
  const todas = [...creadas.map((m) => m.id), ...existentes];
  const { error: errVinculo } = await admin.rpc("vincular_cuenta_dueno", {
    p_dueno: duenoId,
    p_veterinario: vetId,
    p_mascotas: todas,
  });
  if (errVinculo) {
    console.error("vinculo", errVinculo.message);
    await deshacer(creadas.map((m) => m.id));
    return rechazo("servidor", "No pudimos asignar la mascota al dueño: " + errVinculo.message, 500);
  }

  // 8. Constancia para el administrador (si falla no importa: la cuenta ya está creada)
  await admin
    .from("actividad_admin")
    .insert({ tipo: "registro", texto: `${vet.nombre} creó la cuenta del dueño ${nombre}`, actor_id: vetId, objetivo_id: duenoId });

  const vinculadas = existentes.length
    ? ((await admin.from("mascotas").select("id, nombre").in("id", existentes)).data ?? [])
    : [];

  return responder(200, {
    ok: true,
    usuario_id: duenoId,
    email,
    password_temporal: password,
    mascotas: [...creadas, ...vinculadas],
  });
});
