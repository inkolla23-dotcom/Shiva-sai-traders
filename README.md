# Shiva Sai Traders — Inventory Management System

Full-stack inventory, sales, customer, and outstanding-payments management app.

- **Backend**: Node.js + Express + MySQL (`mysql2`), JWT email-based auth
- **Frontend**: React + Vite

---

## 1. Project Structure

```
backend/     Express API (Node, MySQL)
frontend/    React + Vite SPA
render.yaml  Render deployment blueprint (backend)
```

---

## 2. Authentication

- Login is **email + password only** (no usernames).
- JWT payload: `{ id, email, role }`.
- Every activity log entry stores the acting user's **email**.
- Default admin, seeded automatically the first time the backend connects to an
  empty `users` table:
  - Email: `shivasai26@gmail.com`
  - Password: `shivasai@2026`
- The admin can change their email and password from the **Settings** page.
  Changing the email updates the database (`users.email`) and a fresh JWT is
  issued immediately — all future logins must use the new email.
- If you point this backend at an **older/legacy database** where `users` rows
  have a `NULL`/blank email (from a previous username-only version), the
  backend automatically migrates on startup:
  - The first such account is assigned `shivasai26@gmail.com`.
  - Any additional legacy accounts get a unique placeholder email
    (`user<id>@shivasaitraders.local`) so the database is never left in a
    broken/duplicate state — you can then update it from Settings.

---

## 3. Local Development

### Backend

```bash
cd backend
cp .env.example .env     # then fill in your local MySQL credentials
npm install
npm run dev               # nodemon-style auto-restart via --watch
```

The server auto-creates every required table and seeds the admin user on
first successful connection. Visit `GET /api/db-status` to confirm the DB
connection state at any time.

### Frontend

```bash
cd frontend
cp .env.example .env      # set VITE_API_BASE=http://localhost:5000/api
npm install
npm run dev
```

---

## 4. Environment Variables

### Backend (`backend/.env`)

| Variable         | Description                                             |
|------------------|----------------------------------------------------------|
| `PORT`           | Port to listen on (Render sets this automatically)       |
| `DB_HOST`        | MySQL host (never `localhost` in production)              |
| `DB_PORT`        | MySQL port (usually `3306`)                                |
| `DB_USER`        | MySQL user                                                 |
| `DB_PASSWORD`    | MySQL password                                             |
| `DB_NAME`        | MySQL database name                                        |
| `JWT_SECRET`     | Long random secret used to sign JWTs                       |
| `ALLOWED_ORIGINS`| Comma-separated extra CORS origins (optional)               |

Localhost, any `*.vercel.app`, and any `*.onrender.com` origin are **always**
allowed for CORS automatically — you only need `ALLOWED_ORIGINS` for a custom
domain (e.g. `https://myshop.com`).

### Frontend (`frontend/.env`)

| Variable         | Description                                                        |
|------------------|---------------------------------------------------------------------|
| `VITE_API_BASE`  | Full backend API base URL, **including `/api`**, no trailing slash |

Example: `VITE_API_BASE=https://shiva-sai-traders-backend.onrender.com/api`

---

## 5. Deploying the Backend to Render

1. Push this repo to GitHub.
2. In Render, click **New + → Web Service**, connect the repo.
3. Render will pick up `render.yaml` automatically (or configure manually):
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add the environment variables listed above under the service's
   **Environment** tab (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`,
   `JWT_SECRET`, and optionally `ALLOWED_ORIGINS`). Use a managed MySQL
   provider (PlanetScale, Railway, Aiven, Render's own MySQL/Postgres add-ons
   via a compatible MySQL host, etc.) — do **not** use `localhost`.
5. Deploy. Render assigns `PORT` automatically; the app reads
   `process.env.PORT` so this works out of the box.
6. Confirm it's live: `https://<your-service>.onrender.com/api/db-status`
   should return `{"connected": true, ...}`.

---

## 6. Deploying the Frontend to Vercel

1. In Vercel, **Add New → Project**, import the same repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Vite** (Vercel auto-detects via `frontend/vercel.json`).
4. Build command: `npm run build` — Output directory: `dist` (already set in
   `vercel.json`).
5. Add environment variable:
   - `VITE_API_BASE` = `https://<your-backend>.onrender.com/api`
6. Deploy. Once live, add the Vercel URL (e.g.
   `https://your-app.vercel.app`) to the backend's `ALLOWED_ORIGINS` if you
   also want a **custom domain** to work (the `*.vercel.app` domain itself is
   already allowed automatically).

---

## 7. Verifying Everything Works

After both are deployed:

- [ ] Open the Vercel URL → login page loads (no blank screen / no CORS errors in console)
- [ ] Log in with `shivasai26@gmail.com` / `shivasai@2026`
- [ ] Dashboard stats load
- [ ] Products, Customers, Sales, Reports, Outstanding Payments, Replenishment, Business Details pages all load and can create/edit/delete records
- [ ] Settings → Activity Logs show entries with your email, not "undefined"
- [ ] Settings → change email → log out → log back in with the **new** email
- [ ] Open the same Vercel URL from a phone or another computer — same behavior
- [ ] Browser dev tools Network tab shows every request going to your Render
      URL (not `localhost`, not the old `mallikarjun-lodge-backend` URL)

---

## 8. Notes on the MySQL Database

The backend auto-creates every table it needs on first successful connection
and safely migrates older databases (adds missing columns, backfills missing
emails, tightens constraints) without dropping any data. You still need to
**provision the MySQL server itself** (Render does not include one) — any
managed MySQL host works as long as you put its credentials in the backend's
environment variables.
