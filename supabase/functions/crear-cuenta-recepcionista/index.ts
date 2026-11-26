// Reemplazada por crear-cuenta-miembro (las cuentas del equipo las crea la veterinaria). Queda solo para responder
// a versiones viejas de la app sin crear nada.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  return new Response(
    JSON.stringify({ ok: false, error: "obsoleta", mensaje: "Actualizá la app: ahora las cuentas del equipo se crean desde Mis veterinarias." }),
    { status: 410, headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
