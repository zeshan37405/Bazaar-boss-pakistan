package com.example.confectionery.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.confectionery.OrderBookApp
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
        if (prefs.syncBaseUrl.isBlank() || prefs.syncToken.isBlank()) return Result.success()
        val db = (applicationContext as OrderBookApp).db
        val customers = db.customerDao().pending()
        val products = db.productDao().pending()
        val orders = db.orderDao().pending()
        if (customers.isEmpty() && products.isEmpty() && orders.isEmpty()) return Result.success()

        val customerArr = JSONArray()
        customers.forEach { c -> customerArr.put(JSONObject()
            .put("local_id", c.id).put("name", c.name).put("phone", c.phone)
            .put("shop_name", c.shopName).put("address", c.address)
            .put("credit_limit", c.creditLimit).put("balance", c.balance).put("updated_at", c.updatedAt)) }

        val productArr = JSONArray()
        products.forEach { p -> productArr.put(JSONObject()
            .put("local_id", p.id).put("name", p.name).put("sku", p.sku).put("category", p.category)
            .put("unit", p.unit).put("purchase_rate", p.purchaseRate).put("sale_rate", p.saleRate)
            .put("stock_qty", p.stockQty).put("min_stock_qty", p.minStockQty).put("updated_at", p.updatedAt)) }

        val orderArr = JSONArray()
        orders.forEach { order ->
            val items = db.orderDao().items(order.id)
            val jo = JSONObject().put("local_id", order.id).put("invoice_no", order.invoiceNo)
                .put("customer_id", order.customerId).put("booked_by", order.bookedByUserId)
                .put("sale_total", order.saleTotal).put("purchase_total", order.purchaseTotal)
                .put("payment_type", order.paymentType).put("status", order.status).put("created_at", order.createdAt)
            val itemArr = JSONArray()
            items.forEach { i -> itemArr.put(JSONObject().put("product_id", i.productId).put("product_name", i.productName)
                .put("qty", i.qty).put("unit", i.unit).put("purchase_rate", i.purchaseRate)
                .put("sale_rate", i.saleRate).put("line_total", i.lineTotal)) }
            jo.put("items", itemArr); orderArr.put(jo)
        }

        return try {
            val body = JSONObject().put("customers", customerArr).put("products", productArr).put("orders", orderArr)
                .toString().toRequestBody("application/json".toMediaType())
            val req = Request.Builder().url("${prefs.syncBaseUrl}/api/sync/batch")
                .header("Authorization", "Bearer ${prefs.syncToken}").post(body).build()
            OkHttpClient().newCall(req).execute().use { r -> if (!r.isSuccessful) return Result.retry() }
            if(customers.isNotEmpty()) db.customerDao().markSynced(customers.map { it.id })
            if(products.isNotEmpty()) db.productDao().markSynced(products.map { it.id })
            if(orders.isNotEmpty()) db.orderDao().markSynced(orders.map { it.id })
            Result.success()
        } catch (_: Exception) { Result.retry() }
    }
}
