/**
 * PUENTE entre .env y Angular.
 *
 * Angular no lee .env directamente; usa environment.ts / environment.prod.ts.
 * Este script lee .env (o variables de Vercel) y regenera esos dos archivos.
 *
 * Uso: npm run env:generate
 */
const fs = require('fs'); // Módulo de Node para leer/escribir archivos
const path = require('path'); // Módulo para rutas de carpetas (funciona en Windows/Mac/Linux)

const root = path.join(__dirname, '..'); // Carpeta front-end/Proyecto (un nivel arriba de scripts/)
const envPath = path.join(root, '.env'); // Ruta completa al fichero .env

/** Lee un fichero .env y devuelve un objeto { CLAVE: valor }. */
function loadEnv(filePath) {
  const env = {}; // Objeto vacío donde guardaremos las variables
  if (!fs.existsSync(filePath)) {
    // Si no existe .env, avisamos y devolvemos objeto vacío
    console.warn(`⚠ No se encontró ${filePath}. Copia .env.example → .env`);
    return env;
  }
  // Leemos el fichero línea a línea
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim(); // Quitamos espacios al inicio/final
    if (!trimmed || trimmed.startsWith('#')) continue; // Saltamos líneas vacías y comentarios
    const idx = trimmed.indexOf('='); // Buscamos el = que separa clave y valor
    if (idx === -1) continue; // Si no hay =, ignoramos la línea
    const key = trimmed.slice(0, idx).trim(); // Parte izquierda: NG_APP_API_URL
    let value = trimmed.slice(idx + 1).trim(); // Parte derecha: http://...
    // Si el valor va entre comillas "..." o '...', las quitamos
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value; // Guardamos en el objeto: env['NG_APP_API_URL'] = 'http://...'
  }
  return env;
}

/** Lee variables del sistema (Vercel/CI las inyecta en process.env al hacer build). */
function pickProcessEnv(keys) {
  const env = {};
  for (const key of keys) {
    const value = process.env[key]; // process.env es donde Node guarda variables de entorno
    if (value !== undefined && value !== '') {
      env[key] = value; // Solo añadimos si existe y no está vacía
    }
  }
  return env;
}

// Mezclamos .env local + variables del sistema; process.env gana si hay conflicto (Vercel)
const env = {
  ...loadEnv(envPath),
  ...pickProcessEnv(['NG_APP_API_URL', 'NG_APP_API_URL_PROD']),
};

// URL para desarrollo (ng serve); si falta en .env, usamos localhost por defecto
const devApiUrl = env.NG_APP_API_URL ?? 'http://127.0.0.1:8000/api';
// URL para producción (ng build); si falta, usamos /api por defecto
const prodApiUrl = env.NG_APP_API_URL_PROD ?? '/api';

/** Escribe un fichero environment.ts con production y apiUrl. */
function writeEnv(relativePath, production, apiUrl) {
  // Plantilla TypeScript que Angular importará
  const contents = `// Generado desde .env — npm run env:generate
export const environment = {
  production: ${production},
  apiUrl: '${apiUrl.replace(/'/g, "\\'")}', // Escapamos comillas simples por si la URL las tiene
};
`;
  fs.writeFileSync(path.join(root, relativePath), contents, 'utf8'); // Guardamos el fichero
}

// Generamos environment.ts (desarrollo: production false)
writeEnv('src/environments/environment.ts', false, devApiUrl);
// Generamos environment.prod.ts (producción: production true)
writeEnv('src/environments/environment.prod.ts', true, prodApiUrl);

// Confirmación en consola
console.log('✓ environment.ts      →', devApiUrl);
console.log('✓ environment.prod.ts →', prodApiUrl);
