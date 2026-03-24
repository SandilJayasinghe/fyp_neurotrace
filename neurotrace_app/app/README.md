# NeuroTrace App (Frontend)

## Backend URL Configuration

This app reads the backend base URL from Vite environment files.

- Development: `.env.development` → `VITE_API_URL=http://localhost:8000`
- Production: `.env.production` → `VITE_API_URL=https://api.tremora.app`

All frontend API requests use `src/config/api.js`, so switching between environments is automatic.

## Run

- `npm run dev` uses `.env.development`
- `npm run build` uses `.env.production`
