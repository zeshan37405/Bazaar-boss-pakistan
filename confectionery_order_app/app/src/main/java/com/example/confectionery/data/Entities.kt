package com.example.confectionery.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val username: String,
    val passwordHash: String,
    val role: String = "OWNER",
    val photoUri: String? = null,
    val active: Boolean = true
)

@Entity(tableName = "customers")
data class CustomerEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val phone: String = "",
    val shopName: String = "",
    val address: String = "",
    val photoUri: String? = null,
    val creditLimit: Double = 0.0,
    val balance: Double = 0.0,
    val synced: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "products")
data class ProductEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val sku: String = "",
    val category: String = "",
    val unit: String = "pcs",
    val photoUri: String? = null,
    val purchaseRate: Double,
    val saleRate: Double,
    val stockQty: Double = 0.0,
    val minStockQty: Double = 0.0,
    val synced: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "orders")
data class OrderEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val invoiceNo: String,
    val customerId: Long,
    val bookedByUserId: Long,
    val saleTotal: Double,
    val purchaseTotal: Double,
    val paymentType: String = "CREDIT",
    val notes: String = "",
    val status: String = "BOOKED",
    val createdAt: Long = System.currentTimeMillis(),
    val synced: Boolean = false
)

@Entity(tableName = "order_items")
data class OrderItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val orderId: Long,
    val productId: Long,
    val productName: String,
    val qty: Double,
    val unit: String,
    val purchaseRate: Double,
    val saleRate: Double,
    val lineTotal: Double
)
