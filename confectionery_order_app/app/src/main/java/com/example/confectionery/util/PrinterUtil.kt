package com.example.confectionery.util

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.ContextCompat
import com.example.confectionery.data.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

object PrinterUtil {
    data class ThermalDevice(val name: String, val address: String)

    fun hasBluetoothPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    fun pairedThermalDevices(context: Context): List<ThermalDevice> {
        if (!hasBluetoothPermission(context)) return emptyList()
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return emptyList()
        return adapter.bondedDevices.orEmpty()
            .map { ThermalDevice(it.name ?: "Bluetooth printer", it.address) }
            .sortedBy { it.name.lowercase(Locale.getDefault()) }
    }

    suspend fun invoiceText(db: AppDatabase, orderId: Long, prefs: AppPrefs, width: Int = 32): String {
        val order = db.orderDao().byId(orderId) ?: error("Order not found")
        val customer = db.customerDao().byId(order.customerId)
        val items = db.orderDao().items(orderId)
        val line = "-".repeat(width.coerceIn(24, 64))
        fun fit(s: String) = if (s.length <= width) s else s.take(width)
        val sb = StringBuilder()
        sb.appendLine(fit(prefs.businessName.ifBlank { "Confectionery Order Book" }))
        if (prefs.businessPhone.isNotBlank()) sb.appendLine(fit(prefs.businessPhone))
        if (prefs.businessAddress.isNotBlank()) sb.appendLine(fit(prefs.businessAddress))
        sb.appendLine(line)
        sb.appendLine("Invoice: ${order.invoiceNo}")
        sb.appendLine(SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(order.createdAt)))
        sb.appendLine("Area: ${order.areaName}")
        sb.appendLine("Booker: ${order.bookerName}")
        sb.appendLine("Customer: ${customer?.name.orEmpty()}")
        if (!customer?.shopName.isNullOrBlank()) sb.appendLine("Shop: ${customer?.shopName}")
        sb.appendLine(line)
        items.forEach { i ->
            sb.appendLine(fit(i.productName))
            sb.appendLine("${i.qty} ${i.unit} x ${money(i.saleRate)} = ${money(i.lineTotal)}")
        }
        sb.appendLine(line)
        if (order.discount > 0) sb.appendLine("Discount: ${money(order.discount)}")
        if (order.taxTotal > 0) sb.appendLine("Tax: ${money(order.taxTotal)}")
        sb.appendLine("TOTAL: Rs ${money(order.saleTotal)}")
        sb.appendLine("Payment: ${order.paymentType}")
        sb.appendLine("Status: ${order.status}")
        sb.appendLine(line)
        sb.appendLine("Thank you")
        return sb.toString()
    }

    fun printRegular(activity: Activity, jobName: String, text: String) {
        val escaped = text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        val html = """
            <html><head><meta charset="utf-8"><style>
            body{font-family:sans-serif;padding:24px;color:#111} pre{white-space:pre-wrap;font-size:13px;line-height:1.5}
            </style></head><body><pre>$escaped</pre></body></html>
        """.trimIndent()
        val webView = WebView(activity)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                val manager = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
                manager.print(jobName, view.createPrintDocumentAdapter(jobName), null)
            }
        }
        webView.loadDataWithBaseURL(null, html, "text/HTML", "UTF-8", null)
    }

    @SuppressLint("MissingPermission")
    suspend fun printThermal(context: Context, address: String, text: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            require(address.isNotBlank()) { "Thermal printer not selected" }
            require(hasBluetoothPermission(context)) { "Bluetooth permission required" }
            val adapter = BluetoothAdapter.getDefaultAdapter() ?: error("Bluetooth not available")
            val device = adapter.getRemoteDevice(address)
            val socket = device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"))
            try {
                adapter.cancelDiscovery()
                socket.connect()
                val out = socket.outputStream
                out.write(byteArrayOf(0x1B, 0x40))
                out.write(text.toByteArray(Charsets.UTF_8))
                out.write(byteArrayOf(0x0A, 0x0A, 0x0A))
                out.flush()
            } finally {
                try { socket.close() } catch (_: Exception) {}
            }
        }
    }

    private fun money(v: Double) = String.format(Locale.US, "%.2f", v)
}
