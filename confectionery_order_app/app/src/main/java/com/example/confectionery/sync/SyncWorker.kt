package com.example.confectionery.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.confectionery.OrderBookApp
import com.example.confectionery.data.*
import com.example.confectionery.util.AppPrefs
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val prefs = AppPrefs(applicationContext)
        if (prefs.syncBaseUrl.isBlank() || prefs.syncToken.isBlank() || prefs.businessId.isBlank()) return Result.success()
        val db = (applicationContext as OrderBookApp).db
        val users = db.userDao().pending()
        val customers = db.customerDao().pending()
        val products = db.productDao().pending()
        val orders = db.orderDao().pending()
        val expenses = db.expenseDao().pending()

        val userArr = JSONArray().apply {
            users.forEach { u -> put(JSONObject()
                .put("sync_id", u.syncId).put("name", u.name).put("username", u.username)
                .put("email", u.email).put("password_hash", u.passwordHash).put("role", u.role)
                .put("area_name", u.areaName).put("active", u.active).put("updated_at", u.updatedAt)) }
        }

        val customerArr = JSONArray().apply {
            customers.forEach { c -> put(JSONObject()
                .put("sync_id", c.syncId).put("name", c.name).put("phone", c.phone)
                .put("shop_name", c.shopName).put("address", c.address).put("area_name", c.areaName)
                .put("credit_limit", c.creditLimit).put("balance", c.balance).put("updated_at", c.updatedAt)) }
        }

        val productArr = JSONArray()
        products.forEach { p ->
            val unitArr = JSONArray()
            db.productUnitPriceDao().forProduct(p.id).forEach { u ->
                unitArr.put(JSONObject().put("unit_code", u.unitCode).put("conversion_to_base", u.conversionToBase)
                    .put("purchase_rate", u.purchaseRate).put("retail_rate", u.retailRate)
                    .put("wholesale_rate", u.wholesaleRate).put("super_wholesale_rate", u.superWholesaleRate))
            }
            productArr.put(JSONObject()
                .put("sync_id", p.syncId).put("name", p.name).put("sku", p.sku).put("category", p.category)
                .put("unit", p.unit).put("purchase_rate", p.purchaseRate).put("sale_rate", p.saleRate)
                .put("wholesale_rate", p.wholesaleRate).put("super_wholesale_rate", p.superWholesaleRate)
                .put("stock_qty", p.stockQty).put("min_stock_qty", p.minStockQty)
                .put("barcode", p.barcode).put("batch_no", p.batchNo).put("expiry_date", p.expiryDate)
                .put("tax_percent", p.taxPercent).put("updated_at", p.updatedAt).put("unit_prices", unitArr))
        }

        val orderArr = JSONArray()
        orders.forEach { order ->
            val itemArr = JSONArray()
            db.orderDao().items(order.id).forEach { i ->
                itemArr.put(JSONObject().put("product_sync_id", i.productSyncId).put("product_name", i.productName)
                    .put("qty", i.qty).put("base_qty", i.baseQty).put("unit", i.unit)
                    .put("purchase_rate", i.purchaseRate).put("sale_rate", i.saleRate).put("price_tier", i.priceTier)
                    .put("tax_percent", i.taxPercent).put("line_total", i.lineTotal))
            }
            orderArr.put(JSONObject().put("sync_id", order.syncId).put("invoice_no", order.invoiceNo)
                .put("customer_sync_id", order.customerSyncId).put("booker_name", order.bookerName)
                .put("area_name", order.areaName).put("device_id", order.deviceId)
                .put("booked_by_user_sync_id", prefs.currentUserSyncId)
                .put("sale_total", order.saleTotal).put("purchase_total", order.purchaseTotal)
                .put("discount", order.discount).put("tax_total", order.taxTotal)
                .put("payment_type", order.paymentType).put("notes", order.notes)
                .put("document_type", order.documentType).put("status", order.status).put("created_at", order.createdAt)
                .put("items", itemArr))
        }

        val expenseArr = JSONArray().apply {
            expenses.forEach { e -> put(JSONObject().put("sync_id", e.syncId).put("title", e.title)
                .put("amount", e.amount).put("payment_type", e.paymentType).put("area_name", e.areaName)
                .put("booker_name", e.bookerName).put("notes", e.notes).put("created_at", e.createdAt)) }
        }

        return try {
            val body = JSONObject()
                .put("business_id", prefs.businessId)
                .put("business_name", prefs.businessName).put("business_phone", prefs.businessPhone)
                .put("business_address", prefs.businessAddress).put("device_id", prefs.deviceId)
                .put("current_user_sync_id", prefs.currentUserSyncId)
                .put("users", userArr).put("customers", customerArr).put("products", productArr)
                .put("orders", orderArr).put("expenses", expenseArr)
                .toString().toRequestBody("application/json".toMediaType())
            val req = Request.Builder().url("${prefs.syncBaseUrl}/api/sync/exchange")
                .header("Authorization", "Bearer ${prefs.syncToken}").post(body).build()
            val responseText = OkHttpClient.Builder().build().newCall(req).execute().use { r ->
                if (!r.isSuccessful) return if (r.code in 401..403) Result.failure() else Result.retry()
                r.body?.string().orEmpty()
            }
            if (users.isNotEmpty()) db.userDao().markSynced(users.map { it.id })
            if (customers.isNotEmpty()) db.customerDao().markSynced(customers.map { it.id })
            if (products.isNotEmpty()) db.productDao().markSynced(products.map { it.id })
            if (orders.isNotEmpty()) db.orderDao().markSynced(orders.map { it.id })
            if (expenses.isNotEmpty()) db.expenseDao().markSynced(expenses.map { it.id })
            if (responseText.isNotBlank()) applyRemote(db, prefs, JSONObject(responseText))
            prefs.lastSyncAt = System.currentTimeMillis()
            Result.success()
        } catch (_: Exception) { Result.retry() }
    }

    private suspend fun applyRemote(db: AppDatabase, prefs: AppPrefs, root: JSONObject) {
        root.optJSONObject("business")?.let { b ->
            b.optString("name").takeIf { it.isNotBlank() }?.let { prefs.businessName = it }
            b.optString("phone").takeIf { it.isNotBlank() }?.let { prefs.businessPhone = it }
            b.optString("address").takeIf { it.isNotBlank() }?.let { prefs.businessAddress = it }
        }

        val remoteUsers = root.optJSONArray("users") ?: JSONArray()
        for (n in 0 until remoteUsers.length()) {
            val j = remoteUsers.getJSONObject(n)
            val syncId = j.optString("sync_id")
            if (syncId.isBlank()) continue
            val old = db.userDao().bySyncId(syncId)
            val value = UserEntity(
                id = old?.id ?: 0,
                name = j.optString("name"),
                username = j.optString("username"),
                email = j.optString("email"),
                passwordHash = old?.passwordHash.orEmpty(),
                role = j.optString("role", "ORDER_BOOKER"),
                areaName = j.optString("area_name"),
                photoUri = old?.photoUri,
                active = j.optBoolean("active", true),
                syncId = syncId,
                synced = true,
                updatedAt = j.optLong("updated_at", System.currentTimeMillis())
            )
            val localId = if (old == null) db.userDao().insert(value) else { db.userDao().update(value); old.id }
            if (syncId == prefs.currentUserSyncId) {
                prefs.currentUserId = localId
                prefs.currentUserRole = value.role
                prefs.deviceBookerName = value.name
                prefs.deviceAreaName = value.areaName
            }
        }

        val customers = root.optJSONArray("customers") ?: JSONArray()
        for (n in 0 until customers.length()) {
            val j = customers.getJSONObject(n); val syncId = j.optString("sync_id"); if (syncId.isBlank()) continue
            val old = db.customerDao().bySyncId(syncId)
            val value = CustomerEntity(id = old?.id ?: 0, name = j.optString("name"), phone = j.optString("phone"),
                shopName = j.optString("shop_name"), address = j.optString("address"), photoUri = old?.photoUri,
                creditLimit = j.optDouble("credit_limit", 0.0), balance = j.optDouble("balance", 0.0),
                areaName = j.optString("area_name"), syncId = syncId, synced = true,
                updatedAt = j.optLong("updated_at", System.currentTimeMillis()))
            if (old == null) db.customerDao().insert(value) else db.customerDao().update(value)
        }

        val products = root.optJSONArray("products") ?: JSONArray()
        for (n in 0 until products.length()) {
            val j = products.getJSONObject(n); val syncId = j.optString("sync_id"); if (syncId.isBlank()) continue
            val old = db.productDao().bySyncId(syncId)
            val value = ProductEntity(id = old?.id ?: 0, name = j.optString("name"), sku = j.optString("sku"), category = j.optString("category"),
                unit = j.optString("unit", "PIECE"), photoUri = old?.photoUri,
                purchaseRate = j.optDouble("purchase_rate", 0.0), saleRate = j.optDouble("sale_rate", 0.0),
                wholesaleRate = j.optDouble("wholesale_rate", 0.0), superWholesaleRate = j.optDouble("super_wholesale_rate", 0.0),
                stockQty = j.optDouble("stock_qty", 0.0), minStockQty = j.optDouble("min_stock_qty", 0.0), barcode = j.optString("barcode"),
                batchNo = j.optString("batch_no"), expiryDate = j.optString("expiry_date"), taxPercent = j.optDouble("tax_percent", 0.0),
                syncId = syncId, synced = true, updatedAt = j.optLong("updated_at", System.currentTimeMillis()))
            val localId = if (old == null) db.productDao().insert(value) else { db.productDao().update(value); old.id }
            val units = j.optJSONArray("unit_prices") ?: JSONArray()
            if (units.length() > 0) {
                db.productUnitPriceDao().deleteForProduct(localId)
                val list = mutableListOf<ProductUnitPriceEntity>()
                for (u in 0 until units.length()) {
                    val x = units.getJSONObject(u)
                    list += ProductUnitPriceEntity(productId = localId, unitCode = x.optString("unit_code", "PIECE"),
                        conversionToBase = x.optDouble("conversion_to_base", 1.0), purchaseRate = x.optDouble("purchase_rate", 0.0),
                        retailRate = x.optDouble("retail_rate", 0.0), wholesaleRate = x.optDouble("wholesale_rate", 0.0),
                        superWholesaleRate = x.optDouble("super_wholesale_rate", 0.0))
                }
                db.productUnitPriceDao().insertAll(list)
            }
        }

        val orders = root.optJSONArray("orders") ?: JSONArray()
        for (n in 0 until orders.length()) {
            val j = orders.getJSONObject(n); val syncId = j.optString("sync_id"); if (syncId.isBlank()) continue
            val existing = db.orderDao().bySyncId(syncId)
            val customerSyncId = j.optString("customer_sync_id")
            val userSyncId = j.optString("booked_by_user_sync_id")
            val value = OrderEntity(id = existing?.id ?: 0, invoiceNo = j.optString("invoice_no"),
                customerId = db.customerDao().bySyncId(customerSyncId)?.id ?: 0, customerSyncId = customerSyncId,
                bookedByUserId = db.userDao().bySyncId(userSyncId)?.id ?: existing?.bookedByUserId ?: 0,
                bookerName = j.optString("booker_name"), areaName = j.optString("area_name"),
                deviceId = j.optString("device_id"), syncId = syncId, saleTotal = j.optDouble("sale_total", 0.0),
                purchaseTotal = j.optDouble("purchase_total", 0.0), discount = j.optDouble("discount", 0.0), taxTotal = j.optDouble("tax_total", 0.0),
                paymentType = j.optString("payment_type", "CREDIT"), notes = j.optString("notes"), documentType = j.optString("document_type", "ORDER"),
                status = j.optString("status", "BOOKED"), createdAt = j.optLong("created_at", System.currentTimeMillis()), synced = true)
            if (existing == null) {
                val itemArr = j.optJSONArray("items") ?: JSONArray(); val itemList = mutableListOf<OrderItemEntity>()
                for (i in 0 until itemArr.length()) {
                    val x = itemArr.getJSONObject(i); val pSync = x.optString("product_sync_id")
                    itemList += OrderItemEntity(productId = db.productDao().bySyncId(pSync)?.id ?: 0, productSyncId = pSync,
                        productName = x.optString("product_name"), qty = x.optDouble("qty", 0.0), baseQty = x.optDouble("base_qty", x.optDouble("qty", 0.0)),
                        unit = x.optString("unit"), purchaseRate = x.optDouble("purchase_rate", 0.0), saleRate = x.optDouble("sale_rate", 0.0),
                        priceTier = x.optString("price_tier", "RETAIL"), taxPercent = x.optDouble("tax_percent", 0.0), lineTotal = x.optDouble("line_total", 0.0))
                }
                db.orderDao().insertOrderWithItems(value, itemList)
            } else db.orderDao().update(value)
        }

        val expenses = root.optJSONArray("expenses") ?: JSONArray()
        for (n in 0 until expenses.length()) {
            val j = expenses.getJSONObject(n); val syncId = j.optString("sync_id"); if (syncId.isBlank()) continue
            val old = db.expenseDao().bySyncId(syncId)
            val value = ExpenseEntity(id = old?.id ?: 0, title = j.optString("title"), amount = j.optDouble("amount", 0.0),
                paymentType = j.optString("payment_type", "CASH"), areaName = j.optString("area_name"), bookerName = j.optString("booker_name"),
                notes = j.optString("notes"), createdAt = j.optLong("created_at", System.currentTimeMillis()), syncId = syncId, synced = true)
            if (old == null) db.expenseDao().insert(value) else db.expenseDao().update(value)
        }
    }
}
