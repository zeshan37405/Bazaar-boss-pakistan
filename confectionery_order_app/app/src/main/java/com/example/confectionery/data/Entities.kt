package com.example.confectionery.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(
    tableName = "users",
    indices = [
        Index(value = ["syncId"], unique = true),
        Index(value = ["username"]),
        Index(value = ["email"])
    ]
)
data class UserEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val username: String,
    @ColumnInfo(defaultValue = "''") val email: String = "",
    val passwordHash: String,
    val role: String = "ORDER_BOOKER",
    @ColumnInfo(defaultValue = "''") val areaName: String = "",
    val photoUri: String? = null,
    val active: Boolean = true,
    @ColumnInfo(defaultValue = "''") val syncId: String = UUID.randomUUID().toString(),
    @ColumnInfo(defaultValue = "0") val synced: Boolean = false,
    @ColumnInfo(defaultValue = "0") val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "customers", indices = [Index(value = ["syncId"], unique = true)])
data class CustomerEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val phone: String = "",
    val shopName: String = "",
    val address: String = "",
    val photoUri: String? = null,
    val creditLimit: Double = 0.0,
    val balance: Double = 0.0,
    val areaName: String = "",
    val syncId: String = UUID.randomUUID().toString(),
    val synced: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "products", indices = [Index(value = ["syncId"], unique = true)])
data class ProductEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val sku: String = "",
    val category: String = "",
    val unit: String = "PIECE",
    val photoUri: String? = null,
    val purchaseRate: Double,
    val saleRate: Double,
    val wholesaleRate: Double = 0.0,
    @ColumnInfo(defaultValue = "0") val superWholesaleRate: Double = 0.0,
    val stockQty: Double = 0.0,
    val minStockQty: Double = 0.0,
    val barcode: String = "",
    val batchNo: String = "",
    val expiryDate: String = "",
    val taxPercent: Double = 0.0,
    val syncId: String = UUID.randomUUID().toString(),
    val synced: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "product_unit_prices", indices = [Index(value = ["productId", "unitCode"], unique = true)])
data class ProductUnitPriceEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val productId: Long,
    val unitCode: String,
    @ColumnInfo(defaultValue = "1") val conversionToBase: Double = 1.0,
    @ColumnInfo(defaultValue = "0") val purchaseRate: Double = 0.0,
    @ColumnInfo(defaultValue = "0") val retailRate: Double = 0.0,
    @ColumnInfo(defaultValue = "0") val wholesaleRate: Double = 0.0,
    @ColumnInfo(defaultValue = "0") val superWholesaleRate: Double = 0.0,
    @ColumnInfo(defaultValue = "1") val enabled: Boolean = true
)

@Entity(tableName = "orders", indices = [Index(value = ["syncId"], unique = true)])
data class OrderEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val invoiceNo: String,
    val customerId: Long,
    val customerSyncId: String = "",
    val bookedByUserId: Long,
    val bookerName: String = "",
    val areaName: String = "",
    val deviceId: String = "",
    val syncId: String = UUID.randomUUID().toString(),
    val saleTotal: Double,
    val purchaseTotal: Double,
    val discount: Double = 0.0,
    val taxTotal: Double = 0.0,
    val paymentType: String = "CREDIT",
    val notes: String = "",
    val documentType: String = "ORDER",
    val status: String = "BOOKED",
    val createdAt: Long = System.currentTimeMillis(),
    val synced: Boolean = false
)

@Entity(tableName = "order_items")
data class OrderItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val orderId: Long = 0,
    val productId: Long,
    val productSyncId: String = "",
    val productName: String,
    val qty: Double,
    @ColumnInfo(defaultValue = "0") val baseQty: Double = 0.0,
    val unit: String,
    val purchaseRate: Double,
    val saleRate: Double,
    @ColumnInfo(defaultValue = "'RETAIL'") val priceTier: String = "RETAIL",
    val taxPercent: Double = 0.0,
    val lineTotal: Double
)

@Entity(tableName = "expenses")
data class ExpenseEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val amount: Double,
    val paymentType: String = "CASH",
    val areaName: String = "",
    val bookerName: String = "",
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val syncId: String = UUID.randomUUID().toString(),
    val synced: Boolean = false
)
