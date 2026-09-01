package com.example.confectionery.util

import android.content.Context
import android.net.Uri
import androidx.room.withTransaction
import com.example.confectionery.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

object BackupUtil {
    private const val FORMAT = "COB_BACKUP"
    private const val FORMAT_VERSION = 1

    data class BackupSummary(
        val customers: Int,
        val products: Int,
        val orders: Int,
        val expenses: Int,
        val images: Int
    )

    suspend fun createBackup(context: Context, uri: Uri, db: AppDatabase, prefs: AppPrefs): BackupSummary = withContext(Dispatchers.IO) {
        val users = db.userDao().all()
        val customers = db.customerDao().all()
        val products = db.productDao().all()
        val units = db.productUnitPriceDao().all()
        val orders = db.orderDao().all()
        val items = db.orderDao().allItems()
        val expenses = db.expenseDao().all()

        val root = JSONObject()
            .put("format", FORMAT)
            .put("format_version", FORMAT_VERSION)
            .put("created_at", System.currentTimeMillis())
            .put("app_version", "4.0.0")
            .put("business", JSONObject()
                .put("id", prefs.businessId)
                .put("name", prefs.businessName)
                .put("phone", prefs.businessPhone)
                .put("address", prefs.businessAddress)
                .put("logo", imageName(prefs.businessLogoUri))
                .put("password_hash", prefs.businessPasswordHash)
                .put("privacy_pin_hash", prefs.privacyPinHash)
                .put("booker", prefs.deviceBookerName)
                .put("area", prefs.deviceAreaName)
                .put("current_user_id", prefs.currentUserId)
                .put("sync_url", prefs.syncBaseUrl)
                .put("sync_token", prefs.syncToken)
                .put("printer_mode", prefs.printerMode)
                .put("thermal_address", prefs.thermalPrinterAddress)
                .put("thermal_chars", prefs.thermalPaperChars)
            )
            .put("users", JSONArray().apply { users.forEach { u -> put(JSONObject()
                .put("id", u.id).put("name", u.name).put("username", u.username).put("password_hash", u.passwordHash)
                .put("role", u.role).put("photo", imageName(u.photoUri)).put("active", u.active)) } })
            .put("customers", JSONArray().apply { customers.forEach { c -> put(JSONObject()
                .put("id", c.id).put("name", c.name).put("phone", c.phone).put("shop_name", c.shopName)
                .put("address", c.address).put("photo", imageName(c.photoUri)).put("credit_limit", c.creditLimit)
                .put("balance", c.balance).put("area_name", c.areaName).put("sync_id", c.syncId)
                .put("synced", c.synced).put("updated_at", c.updatedAt)) } })
            .put("products", JSONArray().apply { products.forEach { p -> put(JSONObject()
                .put("id", p.id).put("name", p.name).put("sku", p.sku).put("category", p.category)
                .put("unit", p.unit).put("photo", imageName(p.photoUri)).put("purchase_rate", p.purchaseRate)
                .put("sale_rate", p.saleRate).put("wholesale_rate", p.wholesaleRate).put("super_wholesale_rate", p.superWholesaleRate)
                .put("stock_qty", p.stockQty).put("min_stock_qty", p.minStockQty).put("barcode", p.barcode)
                .put("batch_no", p.batchNo).put("expiry_date", p.expiryDate).put("tax_percent", p.taxPercent)
                .put("sync_id", p.syncId).put("synced", p.synced).put("updated_at", p.updatedAt)) } })
            .put("unit_prices", JSONArray().apply { units.forEach { u -> put(JSONObject()
                .put("id", u.id).put("product_id", u.productId).put("unit_code", u.unitCode)
                .put("conversion", u.conversionToBase).put("purchase_rate", u.purchaseRate).put("retail_rate", u.retailRate)
                .put("wholesale_rate", u.wholesaleRate).put("super_wholesale_rate", u.superWholesaleRate).put("enabled", u.enabled)) } })
            .put("orders", JSONArray().apply { orders.forEach { o -> put(JSONObject()
                .put("id", o.id).put("invoice_no", o.invoiceNo).put("customer_id", o.customerId)
                .put("customer_sync_id", o.customerSyncId).put("booked_by", o.bookedByUserId).put("booker_name", o.bookerName)
                .put("area_name", o.areaName).put("device_id", o.deviceId).put("sync_id", o.syncId)
                .put("sale_total", o.saleTotal).put("purchase_total", o.purchaseTotal).put("discount", o.discount)
                .put("tax_total", o.taxTotal).put("payment_type", o.paymentType).put("notes", o.notes)
                .put("document_type", o.documentType).put("status", o.status).put("created_at", o.createdAt).put("synced", o.synced)) } })
            .put("order_items", JSONArray().apply { items.forEach { i -> put(JSONObject()
                .put("id", i.id).put("order_id", i.orderId).put("product_id", i.productId).put("product_sync_id", i.productSyncId)
                .put("product_name", i.productName).put("qty", i.qty).put("base_qty", i.baseQty).put("unit", i.unit)
                .put("purchase_rate", i.purchaseRate).put("sale_rate", i.saleRate).put("price_tier", i.priceTier)
                .put("tax_percent", i.taxPercent).put("line_total", i.lineTotal)) } })
            .put("expenses", JSONArray().apply { expenses.forEach { e -> put(JSONObject()
                .put("id", e.id).put("title", e.title).put("amount", e.amount).put("payment_type", e.paymentType)
                .put("area_name", e.areaName).put("booker_name", e.bookerName).put("notes", e.notes)
                .put("created_at", e.createdAt).put("sync_id", e.syncId).put("synced", e.synced)) } })

        val imageDir = File(context.filesDir, "offline_images")
        var imageCount = 0
        val output = requireNotNull(context.contentResolver.openOutputStream(uri, "wt")) { "Unable to open backup destination" }
        ZipOutputStream(output.buffered()).use { zip ->
            zip.putNextEntry(ZipEntry("backup.json"))
            zip.write(root.toString().toByteArray(Charsets.UTF_8))
            zip.closeEntry()
            imageDir.listFiles()?.filter { it.isFile }?.forEach { file ->
                zip.putNextEntry(ZipEntry("images/${file.name}"))
                file.inputStream().use { it.copyTo(zip) }
                zip.closeEntry()
                imageCount++
            }
        }
        prefs.lastBackupAt = System.currentTimeMillis()
        BackupSummary(customers.size, products.size, orders.size, expenses.size, imageCount)
    }

    suspend fun restoreBackup(context: Context, uri: Uri, db: AppDatabase, prefs: AppPrefs): BackupSummary = withContext(Dispatchers.IO) {
        val temp = File(context.cacheDir, "restore-${UUID.randomUUID()}").apply { mkdirs() }
        try {
            val input = requireNotNull(context.contentResolver.openInputStream(uri)) { "Unable to open backup" }
            ZipInputStream(input.buffered()).use { zip ->
                var entry = zip.nextEntry
                while (entry != null) {
                    val safeName = entry.name.replace('\\', '/')
                    require(!safeName.startsWith("/") && !safeName.contains("../")) { "Unsafe backup entry" }
                    val outFile = File(temp, safeName)
                    if (entry.isDirectory) outFile.mkdirs() else {
                        outFile.parentFile?.mkdirs()
                        outFile.outputStream().use { zip.copyTo(it) }
                    }
                    zip.closeEntry()
                    entry = zip.nextEntry
                }
            }
            val jsonFile = File(temp, "backup.json")
            require(jsonFile.exists()) { "backup.json missing" }
            val root = JSONObject(jsonFile.readText())
            require(root.optString("format") == FORMAT) { "Not a Confectionery Order Book backup" }
            require(root.optInt("format_version", 0) in 1..FORMAT_VERSION) { "Backup version is newer than this app" }

            val imageDir = File(context.filesDir, "offline_images")
            val stagedImages = File(temp, "images")
            imageDir.deleteRecursively()
            imageDir.mkdirs()
            stagedImages.listFiles()?.filter { it.isFile }?.forEach { src -> src.copyTo(File(imageDir, src.name), overwrite = true) }
            fun imageUri(name: String?): String? = name?.takeIf { it.isNotBlank() }?.let { Uri.fromFile(File(imageDir, it)).toString() }

            val usersJson = root.optJSONArray("users") ?: JSONArray()
            val customerJson = root.optJSONArray("customers") ?: JSONArray()
            val productJson = root.optJSONArray("products") ?: JSONArray()
            val unitsJson = root.optJSONArray("unit_prices") ?: JSONArray()
            val ordersJson = root.optJSONArray("orders") ?: JSONArray()
            val itemsJson = root.optJSONArray("order_items") ?: JSONArray()
            val expenseJson = root.optJSONArray("expenses") ?: JSONArray()

            val users = (0 until usersJson.length()).map { n -> usersJson.getJSONObject(n).let { j -> UserEntity(
                id = j.getLong("id"), name = j.optString("name"), username = j.optString("username"),
                passwordHash = j.optString("password_hash"), role = j.optString("role", "ORDER_BOOKER"),
                photoUri = imageUri(j.optString("photo")), active = j.optBoolean("active", true)
            ) } }
            val customers = (0 until customerJson.length()).map { n -> customerJson.getJSONObject(n).let { j -> CustomerEntity(
                id = j.getLong("id"), name = j.optString("name"), phone = j.optString("phone"), shopName = j.optString("shop_name"),
                address = j.optString("address"), photoUri = imageUri(j.optString("photo")), creditLimit = j.optDouble("credit_limit", 0.0),
                balance = j.optDouble("balance", 0.0), areaName = j.optString("area_name"), syncId = j.optString("sync_id"),
                synced = j.optBoolean("synced", false), updatedAt = j.optLong("updated_at", System.currentTimeMillis())
            ) } }
            val products = (0 until productJson.length()).map { n -> productJson.getJSONObject(n).let { j -> ProductEntity(
                id = j.getLong("id"), name = j.optString("name"), sku = j.optString("sku"), category = j.optString("category"),
                unit = j.optString("unit", "PIECE"), photoUri = imageUri(j.optString("photo")), purchaseRate = j.optDouble("purchase_rate", 0.0),
                saleRate = j.optDouble("sale_rate", 0.0), wholesaleRate = j.optDouble("wholesale_rate", 0.0),
                superWholesaleRate = j.optDouble("super_wholesale_rate", 0.0), stockQty = j.optDouble("stock_qty", 0.0),
                minStockQty = j.optDouble("min_stock_qty", 0.0), barcode = j.optString("barcode"), batchNo = j.optString("batch_no"),
                expiryDate = j.optString("expiry_date"), taxPercent = j.optDouble("tax_percent", 0.0), syncId = j.optString("sync_id"),
                synced = j.optBoolean("synced", false), updatedAt = j.optLong("updated_at", System.currentTimeMillis())
            ) } }
            val units = (0 until unitsJson.length()).map { n -> unitsJson.getJSONObject(n).let { j -> ProductUnitPriceEntity(
                id = j.getLong("id"), productId = j.getLong("product_id"), unitCode = j.optString("unit_code"),
                conversionToBase = j.optDouble("conversion", 1.0), purchaseRate = j.optDouble("purchase_rate", 0.0),
                retailRate = j.optDouble("retail_rate", 0.0), wholesaleRate = j.optDouble("wholesale_rate", 0.0),
                superWholesaleRate = j.optDouble("super_wholesale_rate", 0.0), enabled = j.optBoolean("enabled", true)
            ) } }
            val orders = (0 until ordersJson.length()).map { n -> ordersJson.getJSONObject(n).let { j -> OrderEntity(
                id = j.getLong("id"), invoiceNo = j.optString("invoice_no"), customerId = j.optLong("customer_id"),
                customerSyncId = j.optString("customer_sync_id"), bookedByUserId = j.optLong("booked_by"), bookerName = j.optString("booker_name"),
                areaName = j.optString("area_name"), deviceId = j.optString("device_id"), syncId = j.optString("sync_id"),
                saleTotal = j.optDouble("sale_total", 0.0), purchaseTotal = j.optDouble("purchase_total", 0.0),
                discount = j.optDouble("discount", 0.0), taxTotal = j.optDouble("tax_total", 0.0), paymentType = j.optString("payment_type", "CREDIT"),
                notes = j.optString("notes"), documentType = j.optString("document_type", "ORDER"), status = j.optString("status", "BOOKED"),
                createdAt = j.optLong("created_at", System.currentTimeMillis()), synced = j.optBoolean("synced", false)
            ) } }
            val items = (0 until itemsJson.length()).map { n -> itemsJson.getJSONObject(n).let { j -> OrderItemEntity(
                id = j.getLong("id"), orderId = j.getLong("order_id"), productId = j.optLong("product_id"), productSyncId = j.optString("product_sync_id"),
                productName = j.optString("product_name"), qty = j.optDouble("qty", 0.0), baseQty = j.optDouble("base_qty", 0.0),
                unit = j.optString("unit"), purchaseRate = j.optDouble("purchase_rate", 0.0), saleRate = j.optDouble("sale_rate", 0.0),
                priceTier = j.optString("price_tier", "RETAIL"), taxPercent = j.optDouble("tax_percent", 0.0), lineTotal = j.optDouble("line_total", 0.0)
            ) } }
            val expenses = (0 until expenseJson.length()).map { n -> expenseJson.getJSONObject(n).let { j -> ExpenseEntity(
                id = j.getLong("id"), title = j.optString("title"), amount = j.optDouble("amount", 0.0), paymentType = j.optString("payment_type", "CASH"),
                areaName = j.optString("area_name"), bookerName = j.optString("booker_name"), notes = j.optString("notes"),
                createdAt = j.optLong("created_at", System.currentTimeMillis()), syncId = j.optString("sync_id"), synced = j.optBoolean("synced", false)
            ) } }

            db.withTransaction {
                db.orderDao().deleteAllItems()
                db.orderDao().deleteAllOrders()
                db.productUnitPriceDao().deleteAll()
                db.expenseDao().deleteAll()
                db.customerDao().deleteAll()
                db.productDao().deleteAll()
                db.userDao().deleteAll()
                if (users.isNotEmpty()) db.userDao().insertAll(users)
                if (customers.isNotEmpty()) db.customerDao().insertAll(customers)
                if (products.isNotEmpty()) db.productDao().insertAll(products)
                if (units.isNotEmpty()) db.productUnitPriceDao().insertAll(units)
                if (orders.isNotEmpty()) db.orderDao().insertAll(orders)
                if (items.isNotEmpty()) db.orderDao().insertItems(items)
                if (expenses.isNotEmpty()) db.expenseDao().insertAll(expenses)
            }

            root.optJSONObject("business")?.let { b ->
                prefs.businessId = b.optString("id")
                prefs.businessName = b.optString("name")
                prefs.businessPhone = b.optString("phone")
                prefs.businessAddress = b.optString("address")
                prefs.businessLogoUri = imageUri(b.optString("logo")).orEmpty()
                prefs.businessPasswordHash = b.optString("password_hash")
                prefs.privacyPinHash = b.optString("privacy_pin_hash", prefs.privacyPinHash)
                prefs.deviceBookerName = b.optString("booker")
                prefs.deviceAreaName = b.optString("area")
                prefs.currentUserId = b.optLong("current_user_id", users.firstOrNull()?.id ?: 0L)
                prefs.syncBaseUrl = b.optString("sync_url")
                prefs.syncToken = b.optString("sync_token")
                prefs.printerMode = b.optString("printer_mode", "REGULAR")
                prefs.thermalPrinterAddress = b.optString("thermal_address")
                prefs.thermalPaperChars = b.optInt("thermal_chars", 32)
                prefs.companyLoggedIn = prefs.businessId.isNotBlank()
                prefs.purchaseRatesUnlocked = false
            }
            prefs.lastBackupAt = System.currentTimeMillis()
            BackupSummary(customers.size, products.size, orders.size, expenses.size, imageDir.listFiles()?.count { it.isFile } ?: 0)
        } finally {
            temp.deleteRecursively()
        }
    }

    private fun imageName(uri: String?): String? {
        if (uri.isNullOrBlank()) return null
        return runCatching { Uri.parse(uri).path?.let { File(it).name } }.getOrNull()
    }
}
