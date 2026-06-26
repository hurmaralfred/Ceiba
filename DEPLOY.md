# Ceiba — Guía de Deploy (Gratis)

## Tiempo estimado: 30 minutos

---

## Paso 1: Supabase (Base de datos + Auth)

1. Ve a **https://supabase.com** → "Start for free" → crea cuenta con GitHub o Google.
2. Clic en **"New project"**.
   - Nombre: `ceiba`
   - Contraseña: genera una fuerte y guárdala
   - Region: elige la más cercana a tus usuarios (ej. `us-east-1`)
3. Espera ~2 minutos a que el proyecto arranque.
4. Ve a **SQL Editor** (menú izquierdo) → pega todo el contenido de `/supabase/schema.sql` → clic **Run**.
5. Ve a **Settings → API** y copia:
   - `Project URL` (la necesitas como `NEXT_PUBLIC_SUPABASE_URL`)
   - `anon public` key (la necesitas como `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

---

## Paso 2: Vercel (Hosting gratuito)

1. Ve a **https://vercel.com** → "Sign up" con GitHub.
2. Sube el código a GitHub primero:
   ```bash
   cd /ruta/a/Ceiba
   git init
   git add .
   git commit -m "initial commit - ceiba app"
   # Crea un repo en github.com, luego:
   git remote add origin https://github.com/TU_USUARIO/ceiba.git
   git push -u origin main
   ```
3. En Vercel → **"Add New Project"** → importa tu repo `ceiba`.
4. En **Environment Variables** agrega:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJxxx...
   ```
5. Clic **Deploy**. En ~2 minutos tendrás la URL de tu app (ej. `ceiba.vercel.app`).

---

## Paso 3: Configurar Auth en Supabase

1. En Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://ceiba.vercel.app` (tu URL de Vercel)
   - Redirect URLs: `https://ceiba.vercel.app/**`
2. En **Authentication → Email Templates** puedes personalizar los correos de bienvenida.

---

## Paso 4: Dominio propio (opcional, ~$12/año)

1. Compra un dominio en **Namecheap** o **Porkbun** (más baratos).
2. En Vercel → tu proyecto → **Settings → Domains** → agrega tu dominio.
3. Sigue las instrucciones de DNS que te da Vercel (es copiar 2 registros).

---

## Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Crear archivo de variables de entorno
cp .env.local.example .env.local
# Edita .env.local con tus credenciales de Supabase

# 3. Correr en desarrollo
npm run dev
# App disponible en http://localhost:3000
```

---

## Costo total

| Servicio | Costo |
|----------|-------|
| Supabase (Free tier) | $0 — hasta 500MB DB, 50k usuarios |
| Vercel (Hobby) | $0 — hasta 100GB bandwidth |
| Dominio (opcional) | ~$12/año |
| **Total para lanzar** | **$0** |

---

## Próximos pasos después de lanzar

1. **Emails de invitación automáticos** — Configura Supabase Edge Functions + Resend (gratis hasta 3,000 emails/mes)
2. **Árbol visual interactivo** — Integrar D3.js para visualizar el árbol gráficamente
3. **App móvil** — Una vez validada la idea, convertir a React Native con Expo
4. **Notificaciones push** — Para cuando un familiar se une
