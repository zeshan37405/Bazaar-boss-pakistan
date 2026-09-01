CREATE TABLE IF NOT EXISTS businesses (
    id BIGSERIAL PRIMARY KEY,
    business_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    business_pk BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sync_id TEXT NOT NULL,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    credential_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ORDER_BOOKER',
    area_name TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at BIGINT NOT NULL,
    UNIQUE (business_pk, sync_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_business_unique ON users (business_pk, LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_business_unique ON users (business_pk, LOWER(email)) WHERE email <> '';

CREATE TABLE IF NOT EXISTS customers (
    business_pk BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sync_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (business_pk, sync_id)
);

CREATE TABLE IF NOT EXISTS products (
    business_pk BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sync_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (business_pk, sync_id)
);

CREATE TABLE IF NOT EXISTS orders (
    business_pk BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sync_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (business_pk, sync_id)
);

CREATE TABLE IF NOT EXISTS expenses (
    business_pk BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sync_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (business_pk, sync_id)
);

CREATE INDEX IF NOT EXISTS customers_business_updated ON customers (business_pk, updated_at);
CREATE INDEX IF NOT EXISTS products_business_updated ON products (business_pk, updated_at);
CREATE INDEX IF NOT EXISTS orders_business_updated ON orders (business_pk, updated_at);
CREATE INDEX IF NOT EXISTS expenses_business_updated ON expenses (business_pk, updated_at);
