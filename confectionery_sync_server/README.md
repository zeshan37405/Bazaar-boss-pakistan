# Confectionery Order Book — Multi-device Sync Server

Central HTTPS sync service for one Company ID with many order-booker phones.

## What it does
- Keeps company-wide customers, products/rates, orders and expenses in PostgreSQL.
- Uses stable `sync_id` values so local Android numeric IDs never collide between phones.
- Preserves `booker_name`, `area_name` and `device_id` on orders so billing can be separated by area/booker.
- Supports offline-first phones: each phone uploads pending records and downloads the company dataset when internet is available.
- Company password hash must match on every device; a separate server `SYNC_TOKEN` protects the endpoint.

## Required environment variables
- `DATABASE_URL`: PostgreSQL connection URL.
- `SYNC_TOKEN`: long random secret, at least 16 characters. Put the same token in the app's Online Sync screen.
- `PORT`: optional, defaults to 8080.
- `PGSSL=disable`: optional only for a trusted local PostgreSQL server that does not use TLS.

## Run
```bash
npm install
DATABASE_URL='postgresql://...' SYNC_TOKEN='replace-with-long-random-secret' npm start
```

Or build the included Dockerfile.

## App setup on all phones
1. Install the same Confectionery Order Book V2 APK.
2. Use the same Company ID and Company password.
3. Give every phone its own Order Booker name and Area/Route.
4. In **Online Sync**, enter the same HTTPS server URL and `SYNC_TOKEN` on all phones.
5. Orders will remain tagged by Booker + Area + Device even though customers/products are shared company-wide.

## API
- `GET /health`
- `POST /api/sync/exchange` — used by Android app.
- `GET /api/admin/summary/:businessId` — token-protected grouping summary.

For production use, deploy behind HTTPS and use a managed PostgreSQL database with backups.
