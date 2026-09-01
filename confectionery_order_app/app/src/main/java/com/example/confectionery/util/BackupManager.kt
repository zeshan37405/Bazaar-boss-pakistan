package com.example.confectionery.util

import android.content.Context
import android.net.Uri
import com.example.confectionery.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

object BackupManager {
    const val FORMAT_VERSION = 4

    data class BackupSummary(
        val customers: Int,
        val products: Int,
        val orders: Int,
        val expenses: Int,
        val mediaFiles: Int,
        val createdAt: Long
    )

    suspend fun writeBackup(
        context: Context,
        db: AppDatabase,
        prefs: AppPrefs,
        destination: Uri
    ): BackupSummary = withContext(Dispatchers.IO) {
        val users = db.userDao().all()
        val customers = db.customerDao().all()
        val products = db.productDao().all()
        val unitPrices = db.productUnitPriceDao().all()
        val orders = db.orderDao().all()
        val orderItems = db.orderDao().allItems()
        val expenses = db.expenseDao().all()
        val createdAt = System.currentTimeMillis()
        var mediaCount = 0

        val output = requireNotNull(context.contentResolver.openOutputStream(destination, "wt")) { "Backup destination cannot be opened" }
        ZipOutputStream(output.buffered()).use { zip ->
            fun addMedia(uriString: String?, prefix: String): String {
                if (uriString.isNullOrBlank()) return ""
                val input = openMedia(context, uriString) ?: return ""
                val path = "media/${prefix}-${UUID.randomUUID()}.img"
                zip.putNextEntry(ZipEntry(path))
                input.use { it.copyTo(zip) }
                zip.closeEntry()
                mediaCount++
                return path
            }

            val root = JSONObject()
                .put("format", "confectionery-order-book")
                .put("format_version", FORMAT_VERSION)
                .put("created_at", createdAt)

            val settings = JSONObject()
                .put("business_id", prefs.businessId)
                .put("business_name", prefs.businessName)
                .put("business_phone", prefs.businessPhone)
                .put("business_address", prefs.businessAddress)
                .put("business_password_hash", prefs.businessPasswordHash)
                .put("privacy_pin_hash", prefs.privacyPinHash)
                .put("business_logo_backup", addMedia(prefs.businessLogoUri, "logo"))
                .put("sync_url", prefs.syncBaseUrl)
                .put("sync_token", prefs.syncToken)
                .put("last_sync_at", prefs.lastSyncAt)
                .put("thermal_paper_chars", prefs.thermalPaperChars)
            root.put("settings", settings)

            root.put("users", JSONArray().apply {
                users.forEach { u -> put(JSONObject()
                    .put("id", u.id).put("name", u.name).put("username", u.username)
                    .put("password_hash", u.passwordHash).put("role", u.role).put("active", u.active)
                    .put("photo_backup", addMedia(u.photoUri, "user-${u.id}"))) }
            })

            root.put("customers", JSONArray().apply {
                customers.forEach { c -> put(JSONObject()
                    .put("id", c.id).put("name", c.name).put("phone", c.phone).put("shop_name", c.shopName)
                    .put("address", c.address).put("credit_limit", c.creditLimit).put("balance", c.balance)
                    .put("area_name", c.areaName).put("sync_id", c.syncId).put("synced", c.synced)
                    .put("updated_at", c.updatedAt).put("photo_backup", addMedia(c.photoUri, "customer-${c.id}"))) }
            })

            root.put("products", JSONArray().apply {
                products.forEach { p -> put(JSONObject()
                    .put("id", p.id).put("name", p.name).put("sku", p.sku).put("category", p.category)
                    .put("unit", p.unit).put("purchase_rate", p.purchaseRate).put("sale_rate", p.saleRate)
                    .put("wholesale_rate", p.wholesaleRate).put("super_wholesale_rate", p.superWholesaleRate)
                    .put("stock_qty", p.stockQty).put("min_stock_qty", p.minStockQty).put("barcode", p.barcode)
                    .put("batch_no", p.batchNo).put("expiry_date", p.expiryDate).put("tax_percent", p.taxPercent)
                    .put("sync_id", p.syncId).put("synced", p.synced).put("updated_at", p.updatedAt)
                    .put("photo_backup", addMedia(p.photoUri, "product-${p.id}"))) }
            })

            root.put("unit_prices", JSONArray().apply {
                unitPrices.forEach { u -> put(JSONObject()
                    .put("id", u.id).put("product_id", u.productId).put("unit_code", u.unitCode)
                    .put("conversion", u.conversionToBase).put("purchase_rate", u.purchaseRate)
                    .put("retail_rate", u.retailRate).put("wholesale_rate", u.wholesaleRate)
                    .put("super_wholesale_rate", u.superWholesaleRate).put("enabled", u.enabled)) }
            })

            root.put("orders", JSONArray().apply {
                orders.forEach { o -> put(JSONObject()
                    .put("id", o.id).put("invoice_no", o.invoiceNo).put("customer_id", o.customerId)
                    .put("customer_sync_id", o.customerSyncId).put("booked_by_user_id", o.bookedByUserId)
                    .put("booker_name", o.bookerName).put("area_name", o.areaName).put("device_id", o.deviceId)
                    .put("sync_id", o.syncId).put("sale_total", o.saleTotal).put("purchase_total", o.purchaseTotal)
                    .put("discount", o.discount).put("tax_total", o.taxTotal).put("payment_type", o.paymentType)
                    .put("notes", o.notes).put("document_type", o.documentType).put("status", o.status)
                    .put("created_at", o.createdAt).put("synced", o.synced)) }
            })

            root.put("order_items", JSONArray().apply {
                orderItems.forEach { i -> put(JSONObject()
                    .put("id", i.id).put("order_id", i.orderId).put("product_id", i.productId)
                    .put("product_sync_id", i.productSyncId).put("product_name", i.productName)
                    .put("qty", i.qty).put("base_qty", i.baseQty).put("unit", i.unit)
                    .put("purchase_rate", i.purchaseRate).put("sale_rate", i.saleRate).put("price_tier", i.priceTier)
                    .put("tax_percent", i.taxPercent).put("line_total", i.lineTotal)) }
            })

            root.put("expenses", JSONArray().apply {
                expenses.forEach { e -> put(JSONObject()
                    .put("id", e.id).put("title", e.title).put("amount", e.amount).put("payment_type", e.paymentType)
                    .put("area_name", e.areaName).put("booker_name", e.bookerName).put("notes", e.notes)
                    .put("created_at", e.createdAt).put("sync_id", e.syncId).put("synced", e.synced)) }
            })

            zip.putNextEntry(ZipEntry("backup.json"))
            zip.write(root.toString().toByteArray(Charsets.UTF_8))
            zip.closeEntry()
        }

        prefs.lastBackupAt = createdAt
        BackupSummary(customers.size, products.size, orders.size, expenses.size, mediaCount, createdAt)
    }

    suspend fun restoreBackup(
        context: Context,
        db: AppDatabase,
        prefs: AppPrefs,
        source: Uri
    ): BackupSummary = withContext(Dispatchers.IO) {
        val restoreDir = File(context.filesDir, "offline_images").apply { mkdirs() }
        val restoredMedia = mutableMapOf<String, String>()
        var backupJson: String? = null

        val input = requireNotNull(context.contentResolver.openInputStream(source)) { "Backup file cannot be opened" }
        ZipInputStream(input.buffered()).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                val safeName = entry.name.replace("..", "").trimStart('/')
                when {
                    safeName == "backup.json" -> backupJson = zip.readBytes().toString(Charsets.UTF_8)
                    safeName.startsWith("media/") && !entry.isDirectory -> {
                        val target = File(restoreDir, "restored-${UUID.randomUUID()}.img")
                        target.outputStream().use { zip.copyTo(it) }
                        restoredMedia[safeName] = Uri.fromFile(target).toString()
                    }
                }
                zip.closeEntry()
                entry = zip.nextEntry
            }
        }

        val root = JSONObject(requireNotNull(backupJson) { "Invalid backup: backup.json missing" })
        require(root.optString("format") == "confectionery-order-book") { "Unsupported backup file" }
        require(root.optInt("format_version", 0) in 3..FORMAT_VERSION) { "Backup version is not supported" }

        val usersJson = root.optJSONArray("users") ?: JSONArray()
        val customersJson = root.optJSONArray("customers") ?: JSONArray()
        val productsJson = root.optJSONArray("products") ?: JSONArray()
        val unitsJson = root.optJSONArray("unit_prices") ?: JSONArray()
        val ordersJson = root.optJSONArray("orders") ?: JSONArray()
        val itemsJson = root.optJSONArray("order_items") ?: JSONArray()
        val expensesJson = root.optJSONArray("expenses") ?: JSONArray()

        db.clearAllTables()

        val users = buildList {
            for (n in 0 until usersJson.length()) usersJson.getJSONObject(n).let { j -> add(UserEntity(
                id = j.optLong("id"), name = j.optString("name"), username = j.optString("username"),
                passwordHash = j.optString("password_hash"), role = j.optString("role", "ORDER_BOOKER"),
                photoUri = restoredMedia[j.optString("photo_backup")], active = j.optBoolean("active", true)
            )) }
        }
        if (users.isNotEmpty()) db.userDao().insertAll(users)

        val customers = buildList {
            for (n in 0 until customersJson.length()) customersJson.getJSONObject(n).let { j -> add(CustomerEntity(
                id = j.optLong("id"), name = j.optString("name"), phone = j.optString("phone"),
                shopName = j.optString("shop_name"), address = j.optString("address"),
                photoUri = restoredMedia[j.optString("photo_backup")], creditLimit = j.optDouble("credit_limit", 0.0),
                balance = j.optDouble("balance", 0.0), areaName = j.optString("area_name"),
                syncId = j.optString("sync_id"), synced = j.optBoolean("synced", false),
                updatedAt = j.optLong("updated_at", System.currentTimeMillis())
            )) }
        }
        if (customers.isNotEmpty()) db.customerDao().insertAll(customers)

        val products = buildList {
            for (n in 0 until productsJson.length()) productsJson.getJSONObject(n).let { j -> add(ProductEntity(
                id = j.optLong("id"), name = j.optString("name"), sku = j.optString("sku"), category = j.optString("category"),
                unit = j.optString("unit", "PIECE"), photoUri = restoredMedia[j.optString("photo_backup")],
                purchaseRate = j.optDouble("purchase_rate", 0.0), saleRate = j.optDouble("sale_rate", 0.0),
                wholesaleRate = j.optDouble("wholesale_rate", 0.0), superWholesaleRate = j.optDouble("super_wholesale_rate", 0.0),
                stockQty = j.optDouble("stock_qty", 0.0), minStockQty = j.optDouble("min_stock_qty", 0.0),
                barcode = j.optString("barcode"), batchNo = j.optString("batch_no"), expiryDate = j.optString("expiry_date"),
                taxPercent = j.optDouble("tax_percent", 0.0), syncId = j.optString("sync_id"),
                synced = j.optBoolean("synced", false), updatedAt = j.optLong("updated_at", System.currentTimeMillis())
            )) }
        }
        if (products.isNotEmpty()) db.productDao().insertAll(products)

        val unitPrices = buildList {
            for (n in 0 until unitsJson.length()) unitsJson.getJSONObject(n).let { j -> add(ProductUnitPriceEntity(
                id = j.optLong("id"), productId = j.optLong("product_id"), unitCode = j.optString("unit_code"),
                conversionToBase = j.optDouble("conversion", 1.0), purchaseRate = j.optDouble("purchase_rate", 0.0),
                retailRate = j.optDouble("retail_rate", 0.0), wholesaleRate = j.optDouble("wholesale_rate", 0.0),
                superWholesaleRate = j.optDouble("super_wholesale_rate", 0.0), enabled = j.optBoolean("enabled", true)
            )) }
        }
        if (unitPrices.isNotEmpty()) db.productUnitPriceDao().insertAll(unitPrices)

        val orders = buildList {
            for (n in 0 until ordersJson.length()) ordersJson.getJSONObject(n).let { j -> add(OrderEntity(
                id = j.optLong("id"), invoiceNo = j.optString("invoice_no"), customerId = j.optLong("customer_id"),
                customerSyncId = j.optString("customer_sync_id"), bookedByUserId = j.optLong("booked_by_user_id"),
                bookerName = j.optString("booker_name"), areaName = j.optString("area_name"), deviceId = j.optString("device_id"),
                syncId = j.optString("sync_id"), saleTotal = j.optDouble("sale_total", 0.0),
                purchaseTotal = j.optDouble("purchase_total", 0.0), discount = j.optDouble("discount", 0.0),
                taxTotal = j.optDouble("tax_total", 0.0), paymentType = j.optString("payment_type", "CREDIT"),
                notes = j.optString("notes"), documentType = j.optString("document_type", "ORDER"),
                status = j.optString("status", "BOOKED"), createdAt = j.optLong("created_at", System.currentTimeMillis()),
                synced = j.optBoolean("synced", false)
            )) }
        }
        if (orders.isNotEmpty()) db.orderDao().insertAll(orders)

        val orderItems = buildList {
            for (n in 0 until itemsJson.length()) itemsJson.getJSONObject(n).let { j -> add(OrderItemEntity(
                id = j.optLong("id"), orderId = j.optLong("order_id"), productId = j.optLong("product_id"),
                productSyncId = j.optString("product_sync_id"), productName = j.optString("product_name"),
                qty = j.optDouble("qty", 0.0), baseQty = j.optDouble("base_qty", 0.0), unit = j.optString("unit"),
                purchaseRate = j.optDouble("purchase_rate", 0.0), saleRate = j.optDouble("sale_rate", 0.0),
                priceTier = j.optString("price_tier", "RETAIL"), taxPercent = j.optDouble("tax_percent", 0.0),
                lineTotal = j.optDouble("line_total", 0.0)
            )) }
        }
        if (orderItems.isNotEmpty()) db.orderDao().insertItems(orderItems)

        val expenses = buildList {
            for (n in 0 until expensesJson.length()) expensesJson.getJSONObject(n).let { j -> add(ExpenseEntity(
                id = j.optLong("id"), title = j.optString("title"), amount = j.optDouble("amount", 0.0),
                paymentType = j.optString("payment_type", "CASH"), areaName = j.optString("area_name"),
                bookerName = j.optString("booker_name"), notes = j.optString("notes"),
                createdAt = j.optLong("created_at", System.currentTimeMillis()), syncId = j.optString("sync_id"),
                synced = j.optBoolean("synced", false)
            )) }
        }
        if (expenses.isNotEmpty()) db.expenseDao().insertAll(expenses)

        val settings = root.optJSONObject("settings") ?: JSONObject()
        prefs.businessId = settings.optString("business_id")
        prefs.businessName = settings.optString("business_name")
        prefs.businessPhone = settings.optString("business_phone")
        prefs.businessAddress = settings.optString("business_address")
        prefs.businessPasswordHash = settings.optString("business_password_hash")
        prefs.privacyPinHash = settings.optString("privacy_pin_hash", prefs.privacyPinHash)
        prefs.businessLogoUri = restoredMedia[settings.optString("business_logo_backup")].orEmpty()
        prefs.syncBaseUrl = settings.optString("sync_url")
        prefs.syncToken = settings.optString("sync_token")
        prefs.lastSyncAt = settings.optLong("last_sync_at", 0L)
        prefs.thermalPaperChars = settings.optInt("thermal_paper_chars", 32)
        prefs.companyLoggedIn = false
        prefs.purchaseRatesUnlocked = false
        prefs.currentUserId = 0L
        prefs.deviceBookerName = ""
        prefs.deviceAreaName = ""
        prefs.lastBackupAt = System.currentTimeMillis()

        BackupSummary(customers.size, products.size, orders.size, expenses.size, restoredMedia.size, root.optLong("created_at", 0L))
    }

    fun suggestedFileName(prefs: AppPrefs): String {
        val id = prefs.businessId.ifBlank { "business" }.replace(Regex("[^A-Za-z0-9_-]"), "-")
        return "Confectionery-$id-Backup.cobak"
    }

    private fun openMedia(context: Context, uriString: String) = runCatching {
        val uri = Uri.parse(uriString)
        if (uri.scheme == "file") FileInputStream(requireNotNull(uri.path))
        else context.contentResolver.openInputStream(uri)
    }.getOrNull()
}
