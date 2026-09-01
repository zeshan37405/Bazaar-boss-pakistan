package com.example.confectionery

import android.app.Application
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.confectionery.data.AppDatabase

class OrderBookApp : Application() {
    private val migration1To2 = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE customers ADD COLUMN areaName TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE customers ADD COLUMN syncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("UPDATE customers SET syncId='legacy-c-' || id WHERE syncId='' ")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_customers_syncId ON customers(syncId)")

            db.execSQL("ALTER TABLE products ADD COLUMN wholesaleRate REAL NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE products ADD COLUMN barcode TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE products ADD COLUMN batchNo TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE products ADD COLUMN expiryDate TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE products ADD COLUMN taxPercent REAL NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE products ADD COLUMN syncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("UPDATE products SET syncId='legacy-p-' || id WHERE syncId='' ")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_products_syncId ON products(syncId)")

            db.execSQL("ALTER TABLE orders ADD COLUMN customerSyncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE orders ADD COLUMN bookerName TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE orders ADD COLUMN areaName TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE orders ADD COLUMN deviceId TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE orders ADD COLUMN syncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE orders ADD COLUMN discount REAL NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE orders ADD COLUMN taxTotal REAL NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE orders ADD COLUMN documentType TEXT NOT NULL DEFAULT 'ORDER'")
            db.execSQL("UPDATE orders SET syncId='legacy-o-' || id WHERE syncId='' ")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_orders_syncId ON orders(syncId)")

            db.execSQL("ALTER TABLE order_items ADD COLUMN productSyncId TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE order_items ADD COLUMN taxPercent REAL NOT NULL DEFAULT 0")

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS expenses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    title TEXT NOT NULL,
                    amount REAL NOT NULL,
                    paymentType TEXT NOT NULL,
                    areaName TEXT NOT NULL,
                    bookerName TEXT NOT NULL,
                    notes TEXT NOT NULL,
                    createdAt INTEGER NOT NULL,
                    syncId TEXT NOT NULL,
                    synced INTEGER NOT NULL
                )
            """.trimIndent())
        }
    }

    val db by lazy {
        Room.databaseBuilder(this, AppDatabase::class.java, "confectionery-orderbook.db")
            .addMigrations(migration1To2)
            .build()
    }
}
