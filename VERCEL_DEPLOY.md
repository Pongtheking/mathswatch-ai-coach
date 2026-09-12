# Deploying MathsWatch AI Coach on Vercel

1. Create a new GitHub repository and upload this project, or import this folder
   into Vercel using the Vercel CLI.
2. In Vercel, select **Add New → Project**, import the repository, and keep the
   detected Vite build settings.
3. In **Settings → Environment Variables**, add these server-side values:

   - `GEMINI_API_KEY` — a Gemini API key from Google AI Studio.
   - `DATABASE_URL` — a Neon Postgres connection string for persistent student
     data. Omit it only for preview/demo use; the app then uses temporary PGLite
     data which resets when the server restarts.
   - `VITE_AUTH_ENABLED` — `true` for production sign-in.
   - `BETTER_AUTH_URL` — your exact production site address, for example
     `https://mathswatch-ai-coach-vercel-v1.vercel.app`. This must not have a
     trailing slash. It allows Better Auth to accept sign-in requests from the
     deployed Vercel domain instead of rejecting them as “Invalid origin”.
   - `BETTER_AUTH_SECRET` — a unique, private, randomly generated value at
     least 32 characters long. Keep it stable after the first deploy: changing
     it signs everybody out.

4. Deploy. Vercel runs the configured build, including database migrations.

Keep API keys out of source code, commits, screenshots, and chat messages. Add
or replace them only through Vercel's encrypted environment-variable screen.
