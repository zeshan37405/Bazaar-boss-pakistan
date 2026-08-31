package com.example.confectionery

import android.app.Application
import androidx.room.Room
import com.example.confectionery.data.AppDatabase

class OrderBookApp : Application() {
    val db by lazy {
        Room.databaseBuilder(this, AppDatabase::class.java, "confectionery-orderbook.db")
            .fallbackToDestructiveMigration()
            .build()
    }
}
