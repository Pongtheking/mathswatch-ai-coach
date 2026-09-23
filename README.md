# MathsWatch AI Coach

GCSE Maths coaching app: capture questions, mark papers against an official mark scheme, track mastery, and practise toward Grade 9.

## Deploy on Vercel (one click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Pongtheking/mathswatch-ai-coach)

Or in Vercel:

1. **Add New… → Project**
2. Import **`Pongtheking/mathswatch-ai-coach`**
3. Framework: Vite (auto-detected)
4. Deploy

No Gemini key is required on the server. Each student pastes their own Google AI Studio key in **Settings**. Optional env vars:

| Name | Required | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | Recommended in production | Signs login sessions |
| `GEMINI_API_KEY` | No | Shared fallback key if you want one |

## Local

```bash
npm install
npm run dev
```
