# Deploying HostelPulse on Render

HostelPulse is pre-configured to deploy as a unified single-service web application on Render (or any Node.js hosting platform). The Express server serves both the REST API and the compiled React production bundle from a single port and URL.

---

## Service Configuration

- **Service Type**: Web Service
- **Runtime / Environment**: `Node`
- **Region**: Any (e.g., Oregon, Frankfurt, Singapore)
- **Branch**: `deploy`
- **Root Directory**: `Hostel-Pluse` (or root if repository root is the project folder)

---

## Commands

- **Build Command**:
  ```bash
  npm run build
  ```
  *(Installs server and client dependencies and builds the client into `client/dist`)*

- **Start Command**:
  ```bash
  npm start
  ```
  *(Starts the Express server on `process.env.PORT`)*

---

## Health Check Path

- **Health Check Path**:
  ```
  /api/health
  ```
  *(Returns HTTP 200 `{ "status": "ok" }`)*

---

## Environment Variables

| Variable | Recommended Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production mode and optimizations |
| `PORT` | *(Provided by Render)* | Automatically injected by Render (e.g. 10000) |
| `DATABASE_URL` | *(Optional)* `postgresql://...` | Connection string to PostgreSQL. **If left unset, HostelPulse operates zero-config via built-in `pg-mem` emulator with full pre-seeded demo data.** |
| `JWT_SECRET` | *(Optional)* `<random-32-char-string>` | JWT signing secret (has built-in fallback) |
| `REFRESH_TOKEN_SECRET`| *(Optional)* `<random-32-char-string>` | Refresh token signing secret (has built-in fallback) |

---

## Seeded Persona Accounts for Testing

Default password for all demo accounts: `Password@123`

- **Chief Warden / Admin**: `admin@hostelpulse.edu`
- **Boys Block Warden**: `warden.boys@hostelpulse.edu`
- **Girls Block Warden**: `warden.girls@hostelpulse.edu`
- **Active Boy Student**: `rahul.sharma@hostelpulse.edu` (College ID: `HID-BBA-001`)
- **Active Girl Student**: `ananya.reddy@hostelpulse.edu` (College ID: `HID-GBB-001`)
- **Maintenance Staff**: `maintenance@hostelpulse.edu`
- **Health Assistant**: `health@hostelpulse.edu`
- **Security Desk**: `security@hostelpulse.edu`
- **Mess Staff**: `mess@hostelpulse.edu`
