package com.example.confectionery.data

import androidx.room.*

@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE username = :username AND active = 1 LIMIT 1") suspend fun byUsername(username: String): UserEntity?
    @Query("SELECT * FROM users WHERE id = :id LIMIT 1") suspend fun byId(id: Long): UserEntity?
    @Query("SELECT COUNT(*) FROM users") suspend fun count(): Int
    @Insert suspend fun insert(user: UserEntity): Long
}

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers ORDER BY name") suspend fun all(): List<CustomerEntity>
    @Query("SELECT * FROM customers WHERE areaName=:area ORDER BY name") suspend fun byArea(area: String): List<CustomerEntity>
    @Query("SELECT * FROM customers WHERE id=:id LIMIT 1") suspend fun byId(id: Long): CustomerEntity?
    @Query("SELECT * FROM customers WHERE syncId=:syncId LIMIT 1") suspend fun bySyncId(syncId: String): CustomerEntity?
    @Insert suspend fun insert(customer: CustomerEntity): Long
    @Update suspend fun update(customer: CustomerEntity)
    @Query("UPDATE customers SET balance = balance + :amount, synced = 0, updatedAt = :now WHERE id=:id") suspend fun adjustBalance(id: Long, amount: Double, now: Long = System.currentTimeMillis())
    @Query("SELECT * FROM customers WHERE synced = 0") suspend fun pending(): List<CustomerEntity>
    @Query("UPDATE customers SET synced = 1 WHERE id IN (:ids)") suspend fun markSynced(ids: List<Long>)
    @Query("SELECT COALESCE(SUM(balance),0) FROM customers") suspend fun totalReceivable(): Double
}

@Dao
interface ProductDao {
    @Query("SELECT * FROM products ORDER BY name") suspend fun all(): List<ProductEntity>
    @Query("SELECT * FROM products WHERE id=:id LIMIT 1") suspend fun byId(id: Long): ProductEntity?
    @Query("SELECT * FROM products WHERE syncId=:syncId LIMIT 1") suspend fun bySyncId(syncId: String): ProductEntity?
    @Query("SELECT * FROM products WHERE stockQty <= minStockQty AND minStockQty > 0 ORDER BY stockQty") suspend fun lowStock(): List<ProductEntity>
    @Insert suspend fun insert(product: ProductEntity): Long
    @Update suspend fun update(product: ProductEntity)
    @Query("UPDATE products SET stockQty = stockQty + :delta, synced = 0, updatedAt = :now WHERE id=:id") suspend fun adjustStock(id: Long, delta: Double, now: Long = System.currentTimeMillis())
    @Query("SELECT * FROM products WHERE synced = 0") suspend fun pending(): List<ProductEntity>
    @Query("UPDATE products SET synced = 1 WHERE id IN (:ids)") suspend fun markSynced(ids: List<Long>)
}

@Dao
interface OrderDao {
    @Query("SELECT * FROM orders ORDER BY createdAt DESC") suspend fun all(): List<OrderEntity>
    @Query("SELECT * FROM orders WHERE areaName=:area ORDER BY createdAt DESC") suspend fun byArea(area: String): List<OrderEntity>
    @Query("SELECT * FROM orders WHERE bookerName=:booker ORDER BY createdAt DESC") suspend fun byBooker(booker: String): List<OrderEntity>
    @Query("SELECT * FROM orders WHERE areaName=:area AND status=:status ORDER BY createdAt DESC") suspend fun byAreaAndStatus(area: String, status: String): List<OrderEntity>
    @Query("SELECT DISTINCT areaName FROM orders WHERE areaName <> '' ORDER BY areaName") suspend fun areas(): List<String>
    @Query("SELECT DISTINCT bookerName FROM orders WHERE bookerName <> '' ORDER BY bookerName") suspend fun bookers(): List<String>
    @Query("SELECT * FROM orders WHERE id=:id LIMIT 1") suspend fun byId(id: Long): OrderEntity?
    @Query("SELECT * FROM orders WHERE syncId=:syncId LIMIT 1") suspend fun bySyncId(syncId: String): OrderEntity?
    @Query("SELECT * FROM order_items WHERE orderId=:orderId") suspend fun items(orderId: Long): List<OrderItemEntity>
    @Insert suspend fun insert(order: OrderEntity): Long
    @Insert suspend fun insertItems(items: List<OrderItemEntity>)
    @Update suspend fun update(order: OrderEntity)

    @Transaction
    suspend fun insertOrderWithItems(order: OrderEntity, items: List<OrderItemEntity>): Long {
        val id = insert(order)
        insertItems(items.map { it.copy(orderId = id) })
        return id
    }

    @Query("UPDATE orders SET status=:status, synced=0 WHERE id=:id") suspend fun setStatus(id: Long, status: String)
    @Query("SELECT * FROM orders WHERE synced = 0 ORDER BY createdAt") suspend fun pending(): List<OrderEntity>
    @Query("UPDATE orders SET synced = 1 WHERE id IN (:ids)") suspend fun markSynced(ids: List<Long>)
    @Query("SELECT COALESCE(SUM(saleTotal),0) FROM orders WHERE status = 'BILLED'") suspend fun totalSales(): Double
    @Query("SELECT COALESCE(SUM(saleTotal-purchaseTotal-discount),0) FROM orders WHERE status = 'BILLED'") suspend fun grossProfit(): Double
    @Query("SELECT COALESCE(SUM(saleTotal),0) FROM orders WHERE areaName=:area AND status = 'BILLED'") suspend fun areaSales(area: String): Double
}

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses ORDER BY createdAt DESC") suspend fun all(): List<ExpenseEntity>
    @Query("SELECT * FROM expenses WHERE areaName=:area ORDER BY createdAt DESC") suspend fun byArea(area: String): List<ExpenseEntity>
    @Query("SELECT * FROM expenses WHERE syncId=:syncId LIMIT 1") suspend fun bySyncId(syncId: String): ExpenseEntity?
    @Insert suspend fun insert(expense: ExpenseEntity): Long
    @Update suspend fun update(expense: ExpenseEntity)
    @Query("SELECT COALESCE(SUM(amount),0) FROM expenses") suspend fun total(): Double
    @Query("SELECT * FROM expenses WHERE synced=0 ORDER BY createdAt") suspend fun pending(): List<ExpenseEntity>
    @Query("UPDATE expenses SET synced=1 WHERE id IN (:ids)") suspend fun markSynced(ids: List<Long>)
}
