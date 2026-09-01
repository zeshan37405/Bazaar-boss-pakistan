package com.example.confectionery.data

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        UserEntity::class,
        CustomerEntity::class,
        ProductEntity::class,
        ProductUnitPriceEntity::class,
        OrderEntity::class,
        OrderItemEntity::class,
        ExpenseEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun customerDao(): CustomerDao
    abstract fun productDao(): ProductDao
    abstract fun productUnitPriceDao(): ProductUnitPriceDao
    abstract fun orderDao(): OrderDao
    abstract fun expenseDao(): ExpenseDao
}
