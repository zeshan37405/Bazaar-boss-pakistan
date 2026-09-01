package com.example.confectionery.data

import androidx.room.*

@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE username = :username AND active = 1 LIMIT 1") suspend fun byUsername(username: String): UserEntity?
    @Query("SELECT * FROM users WHERE id = :id LIMIT 1") suspend fun byId(id: Long): UserEntity?
    @Query("SELECT * FROM users ORDER BY id") suspend fun all(): List<UserEntity>
    @Query("SELECT COUNT(*) FROM users") suspend fun count(): Int
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insert(user: UserEntity): Long
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertAll(users: List<UserEntity>)
    @Query("DELETE FROM users") suspend fun deleteAll()
}

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers ORDER BY name") suspend fun all(): List<CustomerEntity>
    @Query("SELECT * FROM customers WHERE areaName=:area ORDER BY name") suspend fun byArea(area: String): List<CustomerEntity>
    @Query("SELECT * FROM customers WHERE id=:id LIMIT 1") suspend fun byId(id: Long): CustomerEntity?
    @Query("SELECT * FROM customers WHERE syncId=:syncId LIMIT 1") suspend fun bySyncId(syncId: String): CustomerEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insert(customer: CustomerEntity): Long
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertAll(customers: List<CustomerEntity>)
    @Update suspend fun update(customer: CustomerEntity)
    @Query("DELETE FROM customers") suspend fun deleteAll()
    @Query("UPDATE customers SET balance = balance + :amount, synced = 0, updatedAt = :now WHERE id=:id") suspend fun adjustBalance(id: Long, amount: Double, now: Long = System.currentTimeMillis())
    @Query("SELECT * FROM customers WHERE synced = 0") suspend fun pending(): List<CustomerEntity>
    @Query("UPDATE customers SET synced = 1 WHERE id IN (:ids)") suspend fun markSynced(ids: List<Long>)
    @Query("SELECT COALESCE(SUM(balance),0) FROM customers") suspend fun totalReceivable(): Double
}

@Dao
interface ProductDao {
    @Query("SELECT * FROM products ORDER BY category, name") suspend fun all(): List<ProductEntity>
    @Query("SELECT * FROM products WHERE category=:category ORDER BY name") suspend fun byCategory(category: String): List<ProductEntity>
    @Query("SELECT DISTINCT category FROM products WHERE category <> '' ORDER BY category") suspend fun categories(): List<String>
    @Query("SELECT * FROM products WHERE id=:id LIMIT 1") suspend fun byId(id: Long): ProductEntity?
    @Query("SELECT * FROM products WHERE syncId=:syncId LIMIT 1") suspend fun bySyncId(syncId: String): ProductEntity?
    @Query("SELECT * FROM products WHERE stockQty <= minStockQty AND minStockQty > 0 ORDER BY stockQty") suspend fun lowStock(): List<ProductEntity>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insert(product: ProductEntity): Long
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertAll(products: List<ProductEntity>)
    @Update suspend fun update(product: ProductEntity)
    @Query("DELETE FROM products") suspend fun deleteAll()
    @Query("UPDATE products SET stockQty = stockQty + :delta, synced = 0, updatedAt = :now WHERE id=:id") suspend fun adjustStock(id: Long, delta: Double, now: Long = System.currentTimeMillis())
    @Query("SELECT * FROM products WHERE synced = 0") suspend fun pending(): List<ProductEntity>
    @Query("UPDATE products SET synced = 1 WHERE id IN (:ids)") suspend fun markSynced(ids: List<Long>)
}

@Dao
interface ProductUnitPriceDao {
    @Query("SELECT * FROM product_unit_prices ORDER BY productId, conversionToBase") suspend fun all(): List<ProductUnitPriceEntity>
    @Query("SELECT * FROM product_unit_prices WHERE productId=:productId AND enabled=1 ORDER BY conversionToBase") suspend fun forProduct(productId: Long): List<ProductUnitPriceEntity>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insert(value: ProductUnitPriceEntity): Long
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertAll(values: List<ProductUnitPriceEntity>)
    @Update suspend fun update(value: ProductUnitPriceEntity)
    @Query("DELETE FROM product_unit_prices WHERE productId=:productId") suspend fun deleteForProduct(productId: Long)
    @Query("DELETE FROM product_unit_prices") suspend fun deleteAll()
}

@Dao
interface OrderDao {
    @Query("SELECT * FROM orders ORDER BY createdAt DESC") suspend fun all(): List<OrderEntity>
    @Query("SELECT * FROM order_items ORDER BY orderId, id") suspend fun allItems(): List<OrderItemEntity>
    @Query("SELECT * FROM orders WHERE areaName=:area ORDER BY createdAt DESC") suspend fun byArea(area: String): List<OrderEntity>
    @Query("SELECT * FROM orders WHERE bookerName=:booker ORDER BY createdAt DESC") suspend fun byBooker(booker: String): List<OrderEntity>
    @Query("SELECT * FROM orders WHERE areaName=:area AND status=:status ORDER BY createdAt DESC") suspend fun byAreaAndStatus(area: String, status: String): List<OrderEntity>
    @Query("SELECT DISTINCT areaName FROM orders WHERE areaName <> '' ORDER BY areaName") suspend fun areas(): List<String>
    @Query("SELECT DISTINCT bookerName FROM orders WHERE bookerName <> '' ORDER BY bookerName") suspend fun bookers(): List<String>
    @Query("SELECT * FROM orders WHERE id=:id LIMIT 1") suspend fun byId(id: Long): OrderEntity?
    @Query("SELECT * FROM orders WHERE syncId=:syncId LIMIT 1") suspend fun bySyncId(syncId: String): OrderEntity?
    @Query("SELECT * FROM order_items WHERE orderId=:orderId") suspend fun items(orderId: Long): List<OrderItemEntity>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insert(order: OrderEntity): Long
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertAll(orders: List<OrderEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertItems(items: List<OrderItemEntity>)
    @Update suspend fun update(order: OrderEntity)
    @Query("DELETE FROM order_items") suspend fun deleteAllItems()
    @Query("DELETE FROM orders") suspend fun deleteAllOrders()

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
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insert(expense: ExpenseEntity): Long
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertAll(expenses: List<ExpenseEntity>)
    @Update suspend fun update(expense: ExpenseEntity)
    @Query("DELETE FROM expenses") suspend fun deleteAll()
    @Query("SELECT COALESCE(SUM(amount),0) FROM expenses") suspend fun total(): Double
    @Query("SELECT * FROM expenses WHERE synced=0 ORDER BY createdAt") suspend fun pending(): List<ExpenseEntity>
    @Query("UPDATE expenses SET synced=1 WHERE id IN (:ids)") suspend fun markSynced(ids: List<Long>)
}
