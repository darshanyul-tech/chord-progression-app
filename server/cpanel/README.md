# TryTone cPanel backend (PHP + MySQL)

This folder is the **ready-to-upload** backend for stats + optional accounts.
Until you deploy it and point the app at it, the app runs entirely on the
browser's `localStorage` — nothing here is used. See
`../../docs/17-stats-and-profiles.md` for the architecture.

Files:

| File | Purpose |
|------|---------|
| `schema.sql` | MySQL tables (`profiles`, `tokens`, `stats`, `usage_stats`) |
| `config.sample.php` | Template for your DB credentials + admin key → copy to `config.php` |
| `db.php` | Shared DB/CORS/auth helpers |
| `auth.php` | `register` / `login` / `list` / `delete` (issues bearer tokens) |
| `stats.php` | `GET` / `PUT` the signed-in profile's stats blob |
| `telemetry.php` | Anonymous usage ingestion (every device, guests included) |
| `admin.php` | **Owner analytics** — HTML dashboard + JSON, key-protected |
| `.htaccess` | Blocks `config.php`, `db.php`, `*.sql` from being served |

## Deploy steps

1. **Create the database** — cPanel → *MySQL Databases*: make a database and a
   user, add the user to the database with **All Privileges**. Note the
   (prefixed) names, e.g. `cpaneluser_trytone`.
2. **Import the schema** — cPanel → *phpMyAdmin* → select the DB → *Import* →
   upload `schema.sql`.
3. **Upload the PHP** — put `auth.php`, `stats.php`, `db.php`, `.htaccess` into
   `public_html/api/` (via *File Manager* or FTP).
4. **Upload the analytics endpoints too** — `telemetry.php` and `admin.php`
   go in the same `api/` folder.
5. **Configure** — copy `config.sample.php` to `config.php` **in the same
   `api/` folder**, fill in the DB name/user/password, and set a long random
   `admin_key`. If the app is served from the same domain as the API
   (recommended), leave `cors_origin` as `''`.
6. **Point the app at it** — set the build-time env var and redeploy the
   frontend:
   ```
   VITE_API_BASE_URL=https://trytone.com.au/api
   ```
   (Create a `.env` / `.env.production` in the project root, or set it in your
   CI/Azure build. No code changes anywhere.)

That's it. Named profiles register server-side and sync across devices; and
**every** device (guests included) reports anonymous usage totals so you can see
overall reach.

## Owner analytics

Open the dashboard in a browser (replace the key with your `admin_key`):

```
https://trytone.com.au/api/admin.php?key=YOUR_ADMIN_KEY
```

It shows: number of people (distinct devices), registered accounts, total
attempts + accuracy, active-in-last-7/30-days, a "what they're using" table
(attempts per topic), and any named accounts. Add `&format=json` for the raw
JSON to script against.

### What gets sent (privacy)

Each device posts, to `telemetry.php`, only: an anonymous random device id, the
**aggregate** per-topic tallies already stored locally, and — *only if the user
signed into a named profile* — the display name they chose. No raw
question-by-question log, no emails, no fingerprinting. Nothing is sent at all
until `VITE_API_BASE_URL` is configured. Consider adding a short privacy note to
your site.

## Quick smoke test

```bash
# Register a profile
curl -s -X POST "https://trytone.com.au/api/auth.php?action=register" \
  -H "Content-Type: application/json" -d '{"name":"Test"}'
# -> {"profile":{...},"token":"abc..."}

# Save + read stats with that token
curl -s -X PUT "https://trytone.com.au/api/stats.php" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"version":1,"topics":{},"updatedAt":0}'
curl -s "https://trytone.com.au/api/stats.php" -H "Authorization: Bearer <token>"
```

## Security notes

- PINs are hashed with PHP `password_hash` (bcrypt). Tokens are 32 random bytes.
- Serve the API over **HTTPS** only (cPanel's AutoSSL covers this).
- `config.php` is git-ignored — never commit real credentials.
- This is a lightweight personal-progress store, not a high-security identity
  system: there is no email/recovery and no rate-limiting. Add those if you
  ever store anything sensitive.
