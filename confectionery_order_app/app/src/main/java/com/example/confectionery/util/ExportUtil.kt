package com.example.confectionery.util

import android.content.Context
import com.example.confectionery.data.AppDatabase
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

object ExportUtil {
    suspend fun orderCsv(context: Context, db: AppDatabase, orderId: Long): File {
        val order = db.orderDao().byId(orderId) ?: error("Order not found")
        val customer = db.customerDao().byId(order.customerId)
        val items = db.orderDao().items(orderId)
        val file = File(context.cacheDir, "${order.invoiceNo.replace('/', '-')}.csv")
        file.bufferedWriter().use { w ->
            w.appendLine("Invoice,Date,Document,Status,Area,Booker,Customer,Shop,Phone,Product,Qty,Unit,Sale Rate,Tax %,Line Total")
            val date = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(order.createdAt))
            fun esc(s: String) = "\"${s.replace("\"", "\"\"")}\""
            items.forEach { i ->
                val row = listOf(
                    order.invoiceNo, date, order.documentType, order.status, order.areaName, order.bookerName,
                    customer?.name.orEmpty(), customer?.shopName.orEmpty(), customer?.phone.orEmpty(),
                    i.productName, i.qty.toString(), i.unit, i.saleRate.toString(), i.taxPercent.toString(), i.lineTotal.toString()
                )
                w.appendLine(row.joinToString(",") { esc(it) })
            }
        }
        return file
    }
}
