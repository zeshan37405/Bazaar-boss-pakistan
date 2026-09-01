package com.example.confectionery.data

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

object DatabaseMigrations {
    val MIGRATION_1_2 = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE customers ADD COLUMN areaName TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE customers ADD COLUMN syncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("UPDATE customers SET syncId='legacy-customer-' || id WHERE syncId='' ")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_customers_syncId ON customers(syncId)")

            db.execSQL("ALTER TABLE products ADD COLUMN wholesaleRate REAL NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE products ADD COLUMN barcode TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE products ADD COLUMN batchNo TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE products ADD COLUMN expiryDate TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE products ADD COLUMN taxPercent REAL NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE products ADD COLUMN syncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("UPDATE products SET syncId='legacy-product-' || id WHERE syncId='' ")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_products_syncId ON products(syncId)")

            db.execSQL("ALTER TABLE orders ADD COLUMN customerSyncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE orders ADD COLUMN bookerName TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE orders ADD COLUMN areaName TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE orders ADD COLUMN deviceId TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE orders ADD COLUMN syncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE orders ADD COLUMN discount REAL NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE orders ADD COLUMN taxTotal REAL NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE orders ADD COLUMN documentType TEXT NOT NULL DEFAULT 'ORDER'")
            db.execSQL("UPDATE orders SET syncId='legacy-order-' || id WHERE syncId='' ")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_orders_syncId ON orders(syncId)")

            db.execSQL("ALTER TABLE order_items ADD COLUMN productSyncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE order_items ADD COLUMN taxPercent REAL NOT NULL DEFAULT 0")

            db.execSQL("CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, title TEXT NOT NULL, amount REAL NOT NULL, paymentType TEXT NOT NULL DEFAULT 'CASH', areaName TEXT NOT NULL DEFAULT '', bookerName TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', createdAt INTEGER NOT NULL, syncId TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0)")
        }
    }

    val MIGRATION_2_3 = object : Migration(2, 3) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE products ADD COLUMN superWholesaleRate REAL NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE order_items ADD COLUMN baseQty REAL NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE order_items ADD COLUMN priceTier TEXT NOT NULL DEFAULT 'RETAIL'")
            db.execSQL("CREATE TABLE IF NOT EXISTS product_unit_prices (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, productId INTEGER NOT NULL, unitCode TEXT NOT NULL, conversionToBase REAL NOT NULL DEFAULT 1, purchaseRate REAL NOT NULL DEFAULT 0, retailRate REAL NOT NULL DEFAULT 0, wholesaleRate REAL NOT NULL DEFAULT 0, superWholesaleRate REAL NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1)")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_product_unit_prices_productId_unitCode ON product_unit_prices(productId, unitCode)")
            db.execSQL("INSERT OR IGNORE INTO product_unit_prices(productId, unitCode, conversionToBase, purchaseRate, retailRate, wholesaleRate, superWholesaleRate, enabled) SELECT id, CASE WHEN TRIM(unit)='' THEN 'PIECE' ELSE UPPER(unit) END, 1, purchaseRate, saleRate, wholesaleRate, 0, 1 FROM products")
            db.execSQL("UPDATE order_items SET baseQty=qty WHERE baseQty=0")
        }
    }

    val MIGRATION_3_4 = object : Migration(3, 4) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE users ADD COLUMN areaName TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE users ADD COLUMN syncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE users ADD COLUMN synced INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE users ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0")
            db.execSQL("UPDATE users SET syncId='legacy-user-' || id WHERE syncId='' ")
            db.execSQL("UPDATE users SET updatedAt=strftime('%s','now')*1000 WHERE updatedAt=0")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_users_syncId ON users(syncId)")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_users_username ON users(username)")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_users_email ON users(email)")
        }
    }

    val MIGRATION_4_5 = object : Migration(4, 5) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, customerId INTEGER NOT NULL, customerSyncId TEXT NOT NULL, amount REAL NOT NULL, direction TEXT NOT NULL, method TEXT NOT NULL, notes TEXT NOT NULL, areaName TEXT NOT NULL, bookerName TEXT NOT NULL, createdAt INTEGER NOT NULL, syncId TEXT NOT NULL, synced INTEGER NOT NULL)")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_payments_syncId ON payments(syncId)")
            db.execSQL("CREATE TABLE IF NOT EXISTS stock_movements (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, productId INTEGER NOT NULL, productSyncId TEXT NOT NULL, movementType TEXT NOT NULL, qtyBase REAL NOT NULL, unitLabel TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL, createdAt INTEGER NOT NULL, syncId TEXT NOT NULL, synced INTEGER NOT NULL)")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_stock_movements_syncId ON stock_movements(syncId)")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_expenses_syncId ON expenses(syncId)")
        }
    }
}
