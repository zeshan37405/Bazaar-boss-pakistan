import express from 'express';
import helmet from 'helmet';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 8080);
const databaseUrl = process.env.DATABASE_URL;
const syncToken = process.env.SYNC_TOKEN;

if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!syncToken || syncToken.length < 16) throw new Error('SYNC_TOKEN (16+ chars) is required');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
});

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '8mb' }));

function bearer(req, res, next) {
  const header = req.get('authorization') || '';
  if (header !== `Bearer ${syncToken}`) return res.status(401).json({ error: 'unauthorized' });
  next();
}

function cleanId(value, max = 160) {
  const s = String(value || '').trim();
  if (!s || s.length > max) return null;
  return s;
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      business_id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_records (
      business_id TEXT NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('customers','products','orders','expenses')),
      sync_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      device_id TEXT NOT NULL DEFAULT '',
      booker_name TEXT NOT NULL DEFAULT '',
      area_name TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (business_id, kind, sync_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sync_records_business_kind ON sync_records(business_id, kind);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sync_records_area ON sync_records(business_id, area_name);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sync_records_booker ON sync_records(business_id, booker_name);`);
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'confectionery-order-sync' }));

app.post('/api/sync/exchange', bearer, async (req, res) => {
  const businessId = cleanId(req.body?.business_id, 100);
  const passwordHash = cleanId(req.body?.business_password_hash, 128);
  const deviceId = cleanId(req.body?.device_id, 160) || '';
  const bookerName = String(req.body?.booker_name || '').trim().slice(0, 160);
  const areaName = String(req.body?.area_name || '').trim().slice(0, 160);
  if (!businessId || !passwordHash) return res.status(400).json({ error: 'business_id and password hash are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM businesses WHERE business_id=$1 FOR UPDATE', [businessId]);
    if (existing.rowCount === 0) {
      await client.query(
        `INSERT INTO businesses(business_id,password_hash,name,phone,address) VALUES($1,$2,$3,$4,$5)`,
        [businessId, passwordHash, String(req.body?.business_name || '').slice(0, 200), String(req.body?.business_phone || '').slice(0, 100), String(req.body?.business_address || '').slice(0, 500)]
      );
    } else if (existing.rows[0].password_hash !== passwordHash) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'invalid company credentials' });
    } else {
      await client.query(
        `UPDATE businesses SET name=COALESCE(NULLIF($2,''),name), phone=COALESCE(NULLIF($3,''),phone), address=COALESCE(NULLIF($4,''),address), updated_at=NOW() WHERE business_id=$1`,
        [businessId, String(req.body?.business_name || '').slice(0, 200), String(req.body?.business_phone || '').slice(0, 100), String(req.body?.business_address || '').slice(0, 500)]
      );
    }

    for (const kind of ['customers', 'products', 'orders', 'expenses']) {
      const records = Array.isArray(req.body?.[kind]) ? req.body[kind] : [];
      if (records.length > 5000) throw new Error(`too many ${kind}`);
      for (const record of records) {
        const syncId = cleanId(record?.sync_id, 180);
        if (!syncId) continue;
        const rowArea = String(record?.area_name || areaName || '').slice(0, 160);
        const rowBooker = String(record?.booker_name || bookerName || '').slice(0, 160);
        await client.query(
          `INSERT INTO sync_records(business_id,kind,sync_id,payload,device_id,booker_name,area_name,updated_at)
           VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,NOW())
           ON CONFLICT(business_id,kind,sync_id) DO UPDATE SET
             payload=EXCLUDED.payload,
             device_id=CASE WHEN EXCLUDED.device_id<>'' THEN EXCLUDED.device_id ELSE sync_records.device_id END,
             booker_name=CASE WHEN EXCLUDED.booker_name<>'' THEN EXCLUDED.booker_name ELSE sync_records.booker_name END,
             area_name=CASE WHEN EXCLUDED.area_name<>'' THEN EXCLUDED.area_name ELSE sync_records.area_name END,
             updated_at=NOW()`,
          [businessId, kind, syncId, JSON.stringify(record), deviceId, rowBooker, rowArea]
        );
      }
    }

    const business = await client.query('SELECT name,phone,address FROM businesses WHERE business_id=$1', [businessId]);
    const all = await client.query(
      `SELECT kind,payload FROM sync_records WHERE business_id=$1 ORDER BY kind,updated_at`,
      [businessId]
    );
    await client.query('COMMIT');

    const result = {
      business: business.rows[0] || {},
      customers: [], products: [], orders: [], expenses: []
    };
    for (const row of all.rows) result[row.kind].push(row.payload);
    res.json(result);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error(err);
    res.status(500).json({ error: 'sync failed' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/summary/:businessId', bearer, async (req, res) => {
  const businessId = cleanId(req.params.businessId, 100);
  if (!businessId) return res.status(400).json({ error: 'invalid business id' });
  const rows = await pool.query(
    `SELECT kind, area_name, booker_name, COUNT(*)::int AS records
     FROM sync_records WHERE business_id=$1
     GROUP BY kind,area_name,booker_name ORDER BY kind,area_name,booker_name`,
    [businessId]
  );
  res.json({ business_id: businessId, groups: rows.rows });
});

await init();
app.listen(port, '0.0.0.0', () => console.log(`Confectionery sync server listening on ${port}`));
