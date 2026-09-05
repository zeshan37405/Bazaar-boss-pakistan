package com.example.confectionery

import android.app.Application
import androidx.room.Room
import com.example.confectionery.data.AppDatabase
import com.example.confectionery.data.DatabaseMigrations

class OrderBookApp : Application() {
    val db by lazy {
        Room.databaseBuilder(this, AppDatabase::class.java, "confectionery-orderbook.db")
            .addMigrations(
                DatabaseMigrations.MIGRATION_1_2,
                DatabaseMigrations.MIGRATION_2_3,
                DatabaseMigrations.MIGRATION_3_4,
                DatabaseMigrations.MIGRATION_4_5,
                DatabaseMigrations.MIGRATION_5_6
            )
            .build()
    }
}
