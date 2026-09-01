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
        val customers = db.customerDao().pending()
        val products = db.productDao().pending()
        val orders = db.orderDao().pending()
        val expenses = db.expenseDao().pending()

        val customerArr = JSONArray()
        customers.forEach { c -> customerArr.put(JSONObject()
            .put("sync_id", c.syncId).put("name", c.name).put("phone", c.phone)
            .put("shop_name", c.shopName).put("address", c.address).put("area_name", c.areaName)
            .put("credit_limit", c.creditLimit).put("balance", c.balance).put("updated_at", c.updatedAt)) }

        val productArr = JSONArray()
        products.forEach { p -> productArr.put(JSONObject()
            .put("sync_id", p.syncId).put("name", p.name).put("sku", p.sku).put("category", p.category)
            .put("unit", p.unit).put("purchase_rate", p.purchaseRate).put("sale_rate", p.saleRate)
            .put("wholesale_rate", p.wholesaleRate).put("stock_qty", p.stockQty).put("min_stock_qty", p.minStockQty)
            .put("barcode", p.barcode).put("batch_no", p.batchNo).put("expiry_date", p.expiryDate)
            .put("tax_percent", p.taxPercent).put("updated_at", p.updatedAt)) }

        val orderArr = JSONArray()
        orders.forEach { order ->
            val items = db.orderDao().items(order.id)
            val jo = JSONObject().put("sync_id", order.syncId).put("invoice_no", order.invoiceNo)
                .put("customer_sync_id", order.customerSyncId).put("booker_name", order.bookerName)
                .put("area_name", order.areaName).put("device_id", order.deviceId)
                .put("sale_total", order.saleTotal).put("purchase_total", order.purchaseTotal)
                .put("discount", order.discount).put("tax_total", order.taxTotal)
                .put("payment_type", order.paymentType).put("notes", order.notes)
                .put("document_type", order.documentType).put("status", order.status).put("created_at", order.createdAt)
            val itemArr = JSONArray()
            items.forEach { i -> itemArr.put(JSONObject().put("product_sync_id", i.productSyncId).put("product_name", i.productName)
                .put("qty", i.qty).put("unit", i.unit).put("purchase_rate", i.purchaseRate)
                .put("sale_rate", i.saleRate).put("tax_percent", i.taxPercent).put("line_total", i.lineTotal)) }
            jo.put("items", itemArr)
            orderArr.put(jo)
        }

        val expenseArr = JSONArray()
        expenses.forEach { e -> expenseArr.put(JSONObject().put("sync_id", e.syncId).put("title", e.title)
            .put("amount", e.amount).put("payment_type", e.paymentType).put("area_name", e.areaName)
            .put("booker_name", e.bookerName).put("notes", e.notes).put("created_at", e.createdAt)) }

        return try {
            val bodyJson = JSONObject()
                .put("business_id", prefs.businessId)
                .put("business_password_hash", prefs.businessPasswordHash)
                .put("business_name", prefs.businessName)
                .put("business_phone", prefs.businessPhone)
                .put("business_address", prefs.businessAddress)
                .put("device_id", prefs.deviceId)
                .put("booker_name", prefs.deviceBookerName)
                .put("area_name", prefs.deviceAreaName)
                .put("customers", customerArr).put("products", productArr).put("orders", orderArr).put("expenses", expenseArr)
            val body = bodyJson.toString().toRequestBody("application/json".toMediaType())
            val req = Request.Builder().url("${prefs.syncBaseUrl}/api/sync/exchange")
                .header("Authorization", "Bearer ${prefs.syncToken}").post(body).build()
            val responseText = OkHttpClient().newCall(req).execute().use { r ->
                if (!r.isSuccessful) return Result.retry()
                r.body?.string().orEmpty()
            }

            if (customers.isNotEmpty()) db.customerDao().markSynced(customers.map { it.id })
            if (products.isNotEmpty()) db.productDao().markSynced(products.map { it.id })
            if (orders.isNotEmpty()) db.orderDao().markSynced(orders.map { it.id })
            if (expenses.isNotEmpty()) db.expenseDao().markSynced(expenses.map { it.id })

            if (responseText.isNotBlank()) applyRemote(db, prefs, JSONObject(responseText))
            Result.success()
        } catch (_: Exception) { Result.retry() }
    }

    private suspend fun applyRemote(db: AppDatabase, prefs: AppPrefs, root: JSONObject) {
        root.optJSONObject("business")?.let { b ->
            b.optString("name").takeIf { it.isNotBlank() }?.let { prefs.businessName = it }
            b.optString("phone").takeIf { it.isNotBlank() }?.let { prefs.businessPhone = it }
            b.optString("address").takeIf { it.isNotBlank() }?.let { prefs.businessAddress = it }
        }

        val customers = root.optJSONArray("customers") ?: JSONArray()
        for (n in 0 until customers.length()) {
            val j = customers.getJSONObject(n)
            val syncId = j.optString("sync_id")
            if (syncId.isBlank()) continue
            val old = db.customerDao().bySyncId(syncId)
            val value = CustomerEntity(
                id = old?.id ?: 0, name = j.optString("name"), phone = j.optString("phone"),
                shopName = j.optString("shop_name"), address = j.optString("address"),
                creditLimit = j.optDouble("credit_limit", 0.0), balance = j.optDouble("balance", 0.0),
                areaName = j.optString("area_name"), syncId = syncId, synced = true,
                updatedAt = j.optLong("updated_at", System.currentTimeMillis())
            )
            if (old == null) db.customerDao().insert(value) else db.customerDao().update(value)
        }

        val products = root.optJSONArray("products") ?: JSONArray()
        for (n in 0 until products.length()) {
            val j = products.getJSONObject(n)
            val syncId = j.optString("sync_id")
            if (syncId.isBlank()) continue
            val old = db.productDao().bySyncId(syncId)
            val value = ProductEntity(
                id = old?.id ?: 0, name = j.optString("name"), sku = j.optString("sku"), category = j.optString("category"),
                unit = j.optString("unit", "pcs"), purchaseRate = j.optDouble("purchase_rate", 0.0),
                saleRate = j.optDouble("sale_rate", 0.0), wholesaleRate = j.optDouble("wholesale_rate", 0.0),
                stockQty = j.optDouble("stock_qty", 0.0), minStockQty = j.optDouble("min_stock_qty", 0.0),
                barcode = j.optString("barcode"), batchNo = j.optString("batch_no"), expiryDate = j.optString("expiry_date"),
                taxPercent = j.optDouble("tax_percent", 0.0), syncId = syncId, synced = true,
                updatedAt = j.optLong("updated_at", System.currentTimeMillis())
            )
            if (old == null) db.productDao().insert(value) else db.productDao().update(value)
        }

        val orders = root.optJSONArray("orders") ?: JSONArray()
        for (n in 0 until orders.length()) {
            val j = orders.getJSONObject(n)
            val syncId = j.optString("sync_id")
            if (syncId.isBlank()) continue
            val existing = db.orderDao().bySyncId(syncId)
            val customerSyncId = j.optString("customer_sync_id")
            val customerId = db.customerDao().bySyncId(customerSyncId)?.id ?: 0
            val value = OrderEntity(
                id = existing?.id ?: 0, invoiceNo = j.optString("invoice_no"), customerId = customerId,
                customerSyncId = customerSyncId, bookedByUserId = existing?.bookedByUserId ?: 0,
                bookerName = j.optString("booker_name"), areaName = j.optString("area_name"), deviceId = j.optString("device_id"),
                syncId = syncId, saleTotal = j.optDouble("sale_total", 0.0), purchaseTotal = j.optDouble("purchase_total", 0.0),
                discount = j.optDouble("discount", 0.0), taxTotal = j.optDouble("tax_total", 0.0),
                paymentType = j.optString("payment_type", "CREDIT"), notes = j.optString("notes"),
                documentType = j.optString("document_type", "ORDER"), status = j.optString("status", "BOOKED"),
                createdAt = j.optLong("created_at", System.currentTimeMillis()), synced = true
            )
            if (existing == null) {
                val itemArr = j.optJSONArray("items") ?: JSONArray()
                val itemList = mutableListOf<OrderItemEntity>()
                for (i in 0 until itemArr.length()) {
                    val x = itemArr.getJSONObject(i)
                    val pSync = x.optString("product_sync_id")
                    val productId = db.productDao().bySyncId(pSync)?.id ?: 0
                    itemList += OrderItemEntity(
                        productId = productId, productSyncId = pSync, productName = x.optString("product_name"),
                        qty = x.optDouble("qty", 0.0), unit = x.optString("unit"), purchaseRate = x.optDouble("purchase_rate", 0.0),
                        saleRate = x.optDouble("sale_rate", 0.0), taxPercent = x.optDouble("tax_percent", 0.0),
                        lineTotal = x.optDouble("line_total", 0.0)
                    )
                }
                db.orderDao().insertOrderWithItems(value, itemList)
            } else db.orderDao().update(value)
        }

        val expenses = root.optJSONArray("expenses") ?: JSONArray()
        for (n in 0 until expenses.length()) {
            val j = expenses.getJSONObject(n)
            val syncId = j.optString("sync_id")
            if (syncId.isBlank()) continue
            val old = db.expenseDao().bySyncId(syncId)
            val value = ExpenseEntity(
                id = old?.id ?: 0, title = j.optString("title"), amount = j.optDouble("amount", 0.0),
                paymentType = j.optString("payment_type", "CASH"), areaName = j.optString("area_name"),
                bookerName = j.optString("booker_name"), notes = j.optString("notes"),
                createdAt = j.optLong("created_at", System.currentTimeMillis()), syncId = syncId, synced = true
            )
            if (old == null) db.expenseDao().insert(value) else db.expenseDao().update(value)
        }
    }
}
