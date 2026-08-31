package com.example.confectionery.data

import androidx.room.*

@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE username = :username AND active = 1 LIMIT 1")
    suspend fun byUsername(username: String): UserEntity?
    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    suspend fun byId(id: Long): UserEntity?
    @Query("SELECT COUNT(*) FROM users") suspend fun count(): Int
    @Insert suspend fun insert(user: UserEntity): Long
}

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers ORDER BY name") suspend fun all(): List<CustomerEntity>
    @Query("SELECT * FROM customers WHERE id=:id LIMIT 1") suspend fun byId(id: Long): CustomerEntity?
    @Insert suspend fun insert(customer: CustomerEntity): Long
    @Update suspend fun update(customer: CustomerEntity)
    @Query("UPDATE customers SET balance = balance + :amount, synced = 0, updatedAt = :now WHERE id=:id") suspend fun adjustBalance(id: Long, amount: Double, now: Long = System.currentTimeMillis())
    @Query("SELECT * FROM customers WHERE synced = 0") suspend fun pending(): List<CustomerEntity>
    @Query("UPDATE customers SET synced = 1 WHERE id IN (:ids)") suspend fun markSynced(ids: List<Long>)
}

@Dao
interface ProductDao {
    @Query("SELECT * FROM products ORDER BY name") suspend fun all(): List<ProductEntity>
    @Query("SELECT * FROM products WHERE id=:id LIMIT 1") suspend fun byId(id: Long): ProductEntity?
    @Insert suspend fun insert(product: ProductEntity): Long
    @Update suspend fun update(product: ProductEntity)
    @Query("UPDATE products SET stockQty = stockQty + :delta, synced = 0, updatedAt = :now WHERE id=:id") suspend fun adjustStock(id: Long, delta: Double, now: Long = System.currentTimeMillis())
    @Query("SELECT * FROM products WHERE synced = 0") suspend fun pending(): List<ProductEntity>
    @Query("UPDATE products SET synced = 1 WHERE id IN (:ids)") suspend fun markSynced(ids: List<Long>)
}

@Dao
interface OrderDao {
    @Query("SELECT * FROM orders ORDER BY createdAt DESC") suspend fun all(): List<OrderEntity>
    @Query("SELECT * FROM orders WHERE id=:id LIMIT 1") suspend fun byId(id: Long): OrderEntity?
    @Query("SELECT * FROM order_items WHERE orderId=:orderId") suspend fun items(orderId: Long): List<OrderItemEntity>
    @Insert suspend fun insert(order: OrderEntity): Long
    @Insert suspend fun insertItems(items: List<OrderItemEntity>)

    @Transaction
    suspend fun insertOrderWithItems(order: OrderEntity, items: List<OrderItemEntity>): Long {
        val id = insert(order)
        insertItems(items.map { it.copy(orderId = id) })
        return id
    }

    @Query("SELECT * FROM orders WHERE synced = 0 ORDER BY createdAt") suspend fun pending(): List<OrderEntity>
    @Query("UPDATE orders SET synced = 1 WHERE id IN (:ids)") suspend fun markSynced(ids: List<Long>)
}
