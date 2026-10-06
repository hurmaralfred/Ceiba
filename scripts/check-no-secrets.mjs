// Falla si algún archivo versionado contiene un secreto de servidor.
// Motivo: una clave `service_role` escrita en scripts/ y en el volcado SQL quedó
// pública en el historial de GitHub. Las claves van en variables de entorno / Vault.
//
// Uso: node scripts/check-no-secrets.mjs   (también corre en `npm run verify:baseline`)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const JWT = /eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g;
const PATTERNS = [
  { name: "clave sb_secret_ de Supabase", re: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: "clave de Anthropic", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "clave secreta de Stripe", re: /sk_live_[A-Za-z0-9]{10,}/ },
  { name: "clave de Resend", re: /\bre_[A-Za-z0-9]{24,}\b/ },
  // Un bloque PEM real lleva cuerpo base64 detrás de la cabecera (el código que solo
  // quita la cabecera con .replace(/-----BEGIN.../) no coincide).
  { name: "clave privada PEM", re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----\s*[A-Za-z0-9+/=\r\n]{40,}/ },
];

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((f) => !/\.(png|jpe?g|gif|webp|ico|zip|woff2?|ttf|mp4|lock)$/i.test(f) && f !== "package-lock.json");

const problems = [];
for (const file of files) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }

  for (const m of text.matchAll(JWT)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
      if (payload.role === "service_role") problems.push(`${file}: JWT con rol service_role`);
    } catch { /* no era un JWT */ }
  }
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) problems.push(`${file}: ${name}`);
  }
}

if (problems.length) {
  console.error("Secretos encontrados en archivos versionados:\n  " + problems.join("\n  "));
  console.error("\nQuítalos, usa variables de entorno o Supabase Vault, y rota la clave si llegó a subirse.");
  process.exit(1);
}
console.log(`check-no-secrets: ${files.length} archivos revisados, sin secretos.`);
