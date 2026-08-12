# Cloudflare Pages deployment

BooLink's public website is a static React/Vite app hosted by Cloudflare Pages. It has no Pages
Functions, runtime bindings, environment variables, or hosted credential proxy.

## Cloudflare resources

| Resource                  | Value                                             |
| ------------------------- | ------------------------------------------------- |
| Pages project             | `boolink`                                         |
| Pages fallback            | `https://boolink.pages.dev`                       |
| Production branch         | `main`                                            |
| Build command             | `pnpm --filter @boolink/web build`                |
| Build output              | `apps/web/dist`                                   |
| Custom domains            | `boolink.dev`, `www.boolink.dev`                  |
| Cloudflare zone           | `boolink.dev`                                     |
| Authoritative nameservers | `bill.ns.cloudflare.com`, `eva.ns.cloudflare.com` |

The Namecheap registrar is configured to use those two authoritative nameservers. Both custom
domains point to `boolink.pages.dev` through proxied CNAME records. Cloudflare issues and renews
their TLS certificates after the zone and Pages domain validation complete.

## Local workflow

Requires Node.js 22+ and pnpm 11.

```bash
pnpm install
pnpm check
pnpm dev:web
```

Build the deployable site with:

```bash
pnpm --filter @boolink/web build
```

## Deploy

Authenticate Wrangler with the BooLink Cloudflare account, then run:

```bash
pnpm deploy:web
```

Wrangler uploads `apps/web/dist` to the existing `boolink` Pages project as a production
deployment. Never commit a Cloudflare API token or Wrangler credential. For CI, store a narrowly
scoped Pages API token as a protected repository secret.

## Verification

After deployment:

1. Confirm the newest production deployment has status `success` in Cloudflare Pages.
2. Open `https://boolink.pages.dev` and check the homepage, navigation, and integration search.
3. Confirm `boolink.dev` and `www.boolink.dev` show `active` under Pages custom domains.
4. Confirm HTTPS works and the response contains the security headers defined in
   `apps/web/public/_headers`.

DNS and certificate activation may briefly remain pending after a registrar nameserver change.
The Pages fallback stays available throughout propagation.
