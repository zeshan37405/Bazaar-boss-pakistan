const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 8080);
const DATABASE_URL = process.env.DATABASE_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const DATABASE_SSL = String(process.env.DATABASE_SSL || 'true').toLowerCase() !== 'false';

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (JWT_SECRET.length < 24) throw new Error('JWT_SECRET must be at least 24 characters');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10)
});

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: false }));
app.use(express.json({ limit: '8mb' }));
app.use(morgan('combined'));

const now = () => Date.now();
const clean = (v) => String(v ?? '').trim();
const normalizeLogin = (v) => clean(v).toLowerCase();

async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

function publicUser(row) {
  return {
    sync_id: row.sync_id,
    name: row.name,
    username: row.username,
    email: row.email || '',
    role: row.role,
    area_name: row.area_name || '',
    active: Boolean(row.active),
    updated_at: Number(row.updated_at || 0)
  };
}

function publicBusiness(row) {
  return {
    business_id: row.business_id,
    name: row.name,
    phone: row.phone || '',
    address: row.address || '',
    updated_at: Number(row.updated_at || 0)
  };
}

function tokenFor(business, user) {
  return jwt.sign(
    { business_pk: String(business.id), business_id: business.business_id, user_sync_id: user.sync_id, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d', issuer: 'confectionery-order-sync' }
  );
}

function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const raw = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    if (!raw) throw new Error('missing token');
    req.auth = jwt.verify(raw, JWT_SECRET, { issuer: 'confectionery-order-sync' });
    next();
  } catch (_) {
    res.status(401).json({ error: 'unauthorized' });
  }
}

async function findBusinessById(client, businessId) {
  const q = await client.query('SELECT * FROM businesses WHERE LOWER(business_id)=LOWER($1) LIMIT 1', [businessId]);
  return q.rows[0] || null;
}

async function findUserByLogin(client, businessPk, login) {
  const q = await client.query(
    `SELECT * FROM users
     WHERE business_pk=$1 AND active=TRUE
       AND (LOWER(username)=LOWER($2) OR (email<>'' AND LOWER(email)=LOWER($2)))
     LIMIT 1`,
    [businessPk, login]
  );
  return q.rows[0] || null;
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'confectionery-order-sync' });
  } catch (e) {
    res.status(503).json({ ok: false, error: 'database unavailable' });
  }
});

app.post('/api/business/register', async (req, res) => {
  const businessId = clean(req.body.business_id);
  const businessName = clean(req.body.business_name);
  const owner = req.body.owner || {};
  const ownerName = clean(owner.name);
  const username = clean(owner.username);
  const email = clean(owner.email);
  const passwordHash = clean(owner.password_hash);
  const areaName = clean(owner.area_name);

  if (!businessId || !businessName || !ownerName || !username || passwordHash.length < 32 || !areaName) {
    return res.status(400).json({ error: 'incomplete registration' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (await findBusinessById(client, businessId)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'business already exists' });
    }
    const t = now();
    const b = await client.query(
      `INSERT INTO businesses(business_id,name,phone,address,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$5) RETURNING *`,
      [businessId, businessName, clean(req.body.business_phone), clean(req.body.business_address), t]
    );
    const business = b.rows[0];
    const syncId = clean(owner.sync_id) || require('crypto').randomUUID();
    const credentialHash = await bcrypt.hash(passwordHash, 12);
    const u = await client.query(
      `INSERT INTO users(business_pk,sync_id,name,username,email,credential_hash,role,area_name,active,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,'OWNER',$7,TRUE,$8) RETURNING *`,
      [business.id, syncId, ownerName, username, email, credentialHash, areaName, t]
    );
    const user = u.rows[0];
    await client.query('COMMIT');
    res.status(201).json({ token: tokenFor(business, user), business: publicBusiness(business), user: publicUser(user) });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'registration failed' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  const businessId = clean(req.body.business_id);
  const login = normalizeLogin(req.body.login);
  const passwordHash = clean(req.body.password_hash);
  if (!businessId || !login || passwordHash.length < 32) return res.status(400).json({ error: 'invalid login request' });

  const client = await pool.connect();
  try {
    const business = await findBusinessById(client, businessId);
    if (!business) return res.status(401).json({ error: 'invalid credentials' });
    const user = await findUserByLogin(client, business.id, login);
    if (!user || !(await bcrypt.compare(passwordHash, user.credential_hash))) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    res.json({ token: tokenFor(business, user), business: publicBusiness(business), user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'login failed' });
  } finally {
    client.release();
  }
});

async function upsertPayloads(client, table, businessPk, items, timeField) {
  if (!Array.isArray(items)) return;
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const syncId = clean(raw.sync_id);
    if (!syncId) continue;
    const updatedAt = Number(raw[timeField] || raw.updated_at || raw.created_at || now());
    await client.query(
      `INSERT INTO ${table}(business_pk,sync_id,payload,updated_at)
       VALUES($1,$2,$3::jsonb,$4)
       ON CONFLICT (business_pk,sync_id) DO UPDATE
       SET payload=EXCLUDED.payload, updated_at=EXCLUDED.updated_at
       WHERE ${table}.updated_at <= EXCLUDED.updated_at`,
      [businessPk, syncId, JSON.stringify(raw), updatedAt]
    );
  }
}

async function syncUsers(client, businessPk, users, actorRole) {
  if (!Array.isArray(users) || actorRole !== 'OWNER') return;
  for (const raw of users) {
    const syncId = clean(raw?.sync_id);
    const username = clean(raw?.username);
    const name = clean(raw?.name);
    const passwordHash = clean(raw?.password_hash);
    if (!syncId || !username || !name) continue;
    const existing = await client.query('SELECT * FROM users WHERE business_pk=$1 AND sync_id=$2 LIMIT 1', [businessPk, syncId]);
    const t = Number(raw.updated_at || now());
    if (!existing.rows[0]) {
      if (passwordHash.length < 32) continue;
      const credentialHash = await bcrypt.hash(passwordHash, 12);
      await client.query(
        `INSERT INTO users(business_pk,sync_id,name,username,email,credential_hash,role,area_name,active,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [businessPk, syncId, name, username, clean(raw.email), credentialHash,
         clean(raw.role) || 'ORDER_BOOKER', clean(raw.area_name), raw.active !== false, t]
      );
    } else {
      const old = existing.rows[0];
      if (Number(old.updated_at || 0) > t) continue;
      let credentialHash = old.credential_hash;
      if (passwordHash.length >= 32 && !(await bcrypt.compare(passwordHash, old.credential_hash))) {
        credentialHash = await bcrypt.hash(passwordHash, 12);
      }
      await client.query(
        `UPDATE users SET name=$3,username=$4,email=$5,credential_hash=$6,role=$7,area_name=$8,active=$9,updated_at=$10
         WHERE business_pk=$1 AND sync_id=$2`,
        [businessPk, syncId, name, username, clean(raw.email), credentialHash,
         clean(raw.role) || 'ORDER_BOOKER', clean(raw.area_name), raw.active !== false, t]
      );
    }
  }
}

async function readPayloads(client, table, businessPk) {
  const q = await client.query(`SELECT payload FROM ${table} WHERE business_pk=$1 ORDER BY updated_at ASC`, [businessPk]);
  return q.rows.map(r => r.payload);
}

app.post('/api/sync/exchange', auth, async (req, res) => {
  const tokenBusinessPk = Number(req.auth.business_pk);
  const tokenBusinessId = clean(req.auth.business_id);
  if (!tokenBusinessPk || !tokenBusinessId || !clean(req.body.business_id).toLowerCase().startsWith(tokenBusinessId.toLowerCase())) {
    // exact check below also prevents a token being used for another company
  }
  if (clean(req.body.business_id).toLowerCase() !== tokenBusinessId.toLowerCase()) {
    return res.status(403).json({ error: 'business mismatch' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bq = await client.query('SELECT * FROM businesses WHERE id=$1 LIMIT 1', [tokenBusinessPk]);
    const business = bq.rows[0];
    if (!business) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'business missing' });
    }

    if (req.auth.role === 'OWNER') {
      const name = clean(req.body.business_name) || business.name;
      const phone = clean(req.body.business_phone);
      const address = clean(req.body.business_address);
      await client.query('UPDATE businesses SET name=$2,phone=$3,address=$4,updated_at=$5 WHERE id=$1',
        [business.id, name, phone, address, now()]);
    }

    await syncUsers(client, business.id, req.body.users, req.auth.role);
    await upsertPayloads(client, 'customers', business.id, req.body.customers, 'updated_at');
    await upsertPayloads(client, 'products', business.id, req.body.products, 'updated_at');
    await upsertPayloads(client, 'orders', business.id, req.body.orders, 'created_at');
    await upsertPayloads(client, 'expenses', business.id, req.body.expenses, 'created_at');

    const usersQ = await client.query(
      'SELECT * FROM users WHERE business_pk=$1 ORDER BY name', [business.id]
    );
    const latestBusinessQ = await client.query('SELECT * FROM businesses WHERE id=$1', [business.id]);
    const response = {
      business: publicBusiness(latestBusinessQ.rows[0]),
      users: usersQ.rows.map(publicUser),
      customers: await readPayloads(client, 'customers', business.id),
      products: await readPayloads(client, 'products', business.id),
      orders: await readPayloads(client, 'orders', business.id),
      expenses: await readPayloads(client, 'expenses', business.id),
      server_time: now()
    };
    await client.query('COMMIT');
    res.json(response);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'sync failed' });
  } finally {
    client.release();
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

initDb()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`sync server listening on ${PORT}`)))
  .catch(err => {
    console.error('database initialization failed', err);
    process.exit(1);
  });
