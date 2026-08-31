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
            w.appendLine("Invoice,Date,Customer,Shop,Phone,Product,Qty,Unit,Sale Rate,Line Total")
            val date = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(order.createdAt))
            items.forEach { i ->
                fun esc(s:String) = "\"${s.replace("\"", "\"\"")}\""
                w.appendLine(listOf(order.invoiceNo,date,customer?.name.orEmpty(),customer?.shopName.orEmpty(),customer?.phone.orEmpty(),i.productName,i.qty.toString(),i.unit,i.saleRate.toString(),i.lineTotal.toString()).joinToString(",") { esc(it) })
            }
        }
        return file
    }
}
