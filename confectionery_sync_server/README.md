# Confectionery Sync Server

Central HTTPS backend for Confectionery Order Book V5.

## What it provides
- Company-isolated data using `business_id`
- Owner + Order Booker accounts
- Login with Company ID + username/email + password hash
- JWT sessions; Booker never types a sync token manually
- Saved Booker profile including Area/Route and role
- Two-way users/customers/products/orders/expenses sync
- New-device/reinstall restore after successful online login and sync

## Required environment variables
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — long random secret, minimum 24 characters
- `DATABASE_SSL=false` only when the PostgreSQL service is local/non-SSL
- `PORT` optional; defaults to 8080

## Deploy
Deploy this directory to a Node/Docker host with persistent PostgreSQL. The service creates its schema automatically from `schema.sql`.

After deployment, set the APK `BuildConfig.SYNC_BASE_URL` to the HTTPS service URL and rebuild. In the final production build Order Bookers only enter Company ID + username/email + password; server URL and token are not user-entered fields.

## Security notes
- Client passwords are SHA-256 transformed locally; that value is then protected again using bcrypt on the server.
- Every sync request is authenticated by a signed JWT and scoped to one business.
- Only OWNER sessions may create/update other user accounts through sync.
- Use HTTPS only in production and rotate `JWT_SECRET` under controlled maintenance.

## Current media scope
Structured business data is synchronized by this server. Offline catalog/customer images remain protected by the app's full `.cobak` backup in this version. Production media synchronization should use persistent object storage or a dedicated media table/endpoint before relying on server-only restore for images.
