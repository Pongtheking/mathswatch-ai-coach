# Deploy MathsWatch AI Coach on Vercel

1. Extract the ZIP on your computer. Upload the **contents** of the extracted folder to the root of your GitHub repository. Do not upload the ZIP itself and do not put the files inside an extra folder.
2. In Vercel, open the matching project and go to **Settings → Environment Variables**. Add these values for Production, Preview, and Development:

| Key | Value |
| --- | --- |
| `GEMINI_API_KEY` | Your current Google AI Studio Gemini API key |
| `BETTER_AUTH_URL` | Your exact production URL, such as `https://your-project.vercel.app` (no trailing `/`) |
| `BETTER_AUTH_SECRET` | A new private random secret, at least 32 characters long |
| `DATABASE_URL` | Your Neon Postgres connection string |
| `VITE_AUTH_ENABLED` | `true` |

3. Redeploy from Vercel’s Deployments page. Choose **Redeploy** and leave “Use existing Build Cache” unchecked.

## Important

- Never commit or upload API keys, database URLs, or authentication secrets into GitHub.
- Email/password sign-in is enabled. Google and X sign-in are intentionally not shown because they require separate OAuth apps and would otherwise fail on a standalone Vercel deployment.
- The `scripts` folder must be present in the repository root. It contains the build helper Vercel requires.
