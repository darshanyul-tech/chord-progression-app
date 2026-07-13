# 07 — Deployment: Azure Static Web Apps

Binding runbook. Hosting = Azure SWA **Free plan**, static-only (no API), CI/CD via GitHub Actions. The app is a pure static bundle; nothing server-side exists.

---

## 1. One-time setup (human + CLI steps)

1. **GitHub repo:** create `ear-trainer` (private is fine), push the project. Default branch `main`.
2. **Create the SWA resource** (portal, or CLI below):
   ```bash
   az login
   az group create -n rg-ear-trainer -l eastasia
   az staticwebapp create -n ear-trainer -g rg-ear-trainer \
     --source https://github.com/<user>/ear-trainer -b main \
     --location eastasia --login-with-github \
     --app-location "/" --output-location "dist"
   ```
   (Portal path: Create resource → Static Web App → Free plan → connect GitHub repo/branch → Build presets: **Custom** → app location `/`, api location empty, output location `dist`.)
   Region note: pick the closest available SWA region (`eastasia` for Perth; SWA is fronted by a global CDN so region mainly affects management plane).
3. Azure auto-commits a workflow file to the repo and injects the `AZURE_STATIC_WEB_APPS_API_TOKEN_*` secret. From then on, **every push to `main` deploys**; PRs get staging environments automatically.

## 2. GitHub Actions workflow

Keep the Azure-generated workflow, adjusted to build explicitly with Node 20 (don't rely on Oryx defaults):

```yaml
name: Deploy to Azure Static Web Apps
on:
  push: { branches: [main] }
  pull_request: { types: [opened, synchronize, reopened, closed], branches: [main] }
jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test -- --run        # Vitest; failing tests block deploy
      - run: npm run build
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: upload
          app_location: dist          # pre-built output uploaded as-is
          skip_app_build: true
  close_pr:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: close
```

(Adjust the secret name to the one Azure generated.)

## 3. `staticwebapp.config.json` (repo root; Vite must copy it — place it in `public/` so it lands in `dist/`)

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/samples/*", "/assets/*", "*.{css,js,map,mp3,svg,png,ico,txt}"]
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "routes": [
    { "route": "/samples/*", "headers": { "Cache-Control": "public, max-age=31536000, immutable" } },
    { "route": "/assets/*",  "headers": { "Cache-Control": "public, max-age=31536000, immutable" } }
  ],
  "mimeTypes": { ".mp3": "audio/mpeg" }
}
```

- Piano samples and Vite's hashed `/assets/*` are immutable-cached; `index.html` stays default (no-cache revalidation) so deploys propagate immediately.
- No `Cross-Origin-*` isolation headers: not needed (no SharedArrayBuffer), and they can break loading of nothing we ship — omit.
- No auth config: the app is public.

## 4. Budget/limits sanity (Free plan)

App size limit 250 MB (we ship <10 MB incl. samples), bandwidth 100 GB/month, custom domains 2 — all comfortably sufficient. No cost.

## 5. Custom domain (optional, later)

Portal → Static Web App → Custom domains → Add → CNAME `www.<domain>` → validate. Free managed TLS is automatic. Not part of v1 acceptance.

## 6. Local dev & verification

- `npm run dev` (Vite) for development; `npm run preview` to check the production bundle.
- Optional fidelity check: `npx @azure/static-web-apps-cli start dist` emulates SWA routing/headers locally. Not required for day-to-day work.

## 7. Deployment acceptance criteria

- Visiting the production URL on desktop and a phone loads the app; audio initializes after a tap; a full practice question works on both.
- Deep link `https://<host>/#/topic/rhythm-dictation` opens directly to that topic.
- Second visit loads samples from cache (verify 200-from-cache / no re-download in devtools).
- A failing unit test blocks deployment (verify once by intentionally breaking a test on a branch PR).
