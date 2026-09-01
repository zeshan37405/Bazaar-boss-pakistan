package com.example.confectionery.util

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.print.PrintManager
import android.util.Base64
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.ContextCompat
import com.example.confectionery.data.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
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
        return adapter.bondedDevices.orEmpty().map { ThermalDevice(it.name ?: "Bluetooth printer", it.address) }
            .sortedBy { it.name.lowercase(Locale.getDefault()) }
    }

    suspend fun invoiceText(db: AppDatabase, orderId: Long, prefs: AppPrefs, width: Int = 32): String {
        val order = db.orderDao().byId(orderId) ?: error("Order not found")
        val customer = db.customerDao().byId(order.customerId)
        val items = db.orderDao().items(orderId)
        val line = "-".repeat(width.coerceIn(24, 64))
        fun fit(s: String) = if (s.length <= width) s else s.take(width)
        return buildString {
            appendLine(fit(prefs.businessName.ifBlank { "Confectionery Order Book" }))
            if (prefs.businessPhone.isNotBlank()) appendLine(fit(prefs.businessPhone))
            if (prefs.businessAddress.isNotBlank()) appendLine(fit(prefs.businessAddress))
            appendLine(line)
            appendLine("Invoice: ${order.invoiceNo}")
            appendLine(SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(order.createdAt)))
            appendLine("Area: ${order.areaName}")
            appendLine("Booker: ${order.bookerName}")
            appendLine("Customer: ${customer?.name.orEmpty()}")
            if (!customer?.shopName.isNullOrBlank()) appendLine("Shop: ${customer?.shopName}")
            appendLine(line)
            items.forEach { i ->
                appendLine(fit(i.productName))
                appendLine("${i.qty} ${i.unit} x ${money(i.saleRate)} = ${money(i.lineTotal)}")
                if (i.priceTier != "RETAIL") appendLine("Rate: ${i.priceTier}")
            }
            appendLine(line)
            if (order.discount > 0) appendLine("Discount: ${money(order.discount)}")
            if (order.taxTotal > 0) appendLine("Tax: ${money(order.taxTotal)}")
            appendLine("TOTAL: Rs ${money(order.saleTotal)}")
            appendLine("Payment: ${order.paymentType}")
            appendLine("Status: ${order.status}")
            appendLine(line)
            appendLine("Thank you")
        }
    }

    fun printRegular(activity: Activity, jobName: String, text: String, logoUri: String = "") {
        val escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        val logo = logoDataUri(activity, logoUri)?.let { "<img src=\"$it\" style=\"max-height:100px;max-width:220px;display:block;margin:0 auto 14px auto\"/>" }.orEmpty()
        val html = """
            <html><head><meta charset="utf-8"><style>
            body{font-family:sans-serif;padding:24px;color:#111} pre{white-space:pre-wrap;font-size:13px;line-height:1.5}
            </style></head><body>$logo<pre>$escaped</pre></body></html>
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
    suspend fun printThermal(context: Context, address: String, text: String, logoUri: String = ""): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            require(address.isNotBlank()) { "Thermal printer not selected" }
            require(hasBluetoothPermission(context)) { "Bluetooth permission required" }
            val adapter = BluetoothAdapter.getDefaultAdapter() ?: error("Bluetooth not available")
            val device = adapter.getRemoteDevice(address)
            val socket = device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"))
            try {
                adapter.cancelDiscovery(); socket.connect()
                val out = socket.outputStream
                out.write(byteArrayOf(0x1B, 0x40))
                loadBitmap(context, logoUri)?.let { bitmap ->
                    out.write(byteArrayOf(0x1B, 0x61, 0x01))
                    out.write(toEscPosRaster(bitmap))
                    out.write(byteArrayOf(0x0A, 0x1B, 0x61, 0x00))
                }
                out.write(text.toByteArray(Charsets.UTF_8))
                out.write(byteArrayOf(0x0A, 0x0A, 0x0A)); out.flush()
            } finally { runCatching { socket.close() } }
        }
    }

    private fun loadBitmap(context: Context, uriText: String): Bitmap? {
        if (uriText.isBlank()) return null
        return runCatching {
            val uri = Uri.parse(uriText)
            val stream = if (uri.scheme == "file") File(uri.path!!).inputStream() else context.contentResolver.openInputStream(uri)
            stream.use { BitmapFactory.decodeStream(it) }
        }.getOrNull()
    }

    private fun logoDataUri(context: Context, uriText: String): String? {
        val bitmap = loadBitmap(context, uriText) ?: return null
        val out = ByteArrayOutputStream(); bitmap.compress(Bitmap.CompressFormat.PNG, 90, out)
        return "data:image/png;base64,${Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)}"
    }

    private fun toEscPosRaster(source: Bitmap): ByteArray {
        val maxWidth = 384
        val scale = if (source.width > maxWidth) maxWidth.toFloat() / source.width else 1f
        val width = (source.width * scale).toInt().coerceAtLeast(1)
        val height = (source.height * scale).toInt().coerceAtLeast(1)
        val bitmap = Bitmap.createScaledBitmap(source, width, height, true)
        val widthBytes = (width + 7) / 8
        val data = ByteArray(widthBytes * height)
        for (y in 0 until height) {
            for (x in 0 until width) {
                val c = bitmap.getPixel(x, y)
                val gray = (android.graphics.Color.red(c) * 30 + android.graphics.Color.green(c) * 59 + android.graphics.Color.blue(c) * 11) / 100
                if (gray < 160) {
                    val index = y * widthBytes + x / 8
                    data[index] = (data[index].toInt() or (0x80 shr (x % 8))).toByte()
                }
            }
        }
        return ByteArrayOutputStream().apply {
            write(byteArrayOf(0x1D, 0x76, 0x30, 0x00, (widthBytes and 0xFF).toByte(), ((widthBytes shr 8) and 0xFF).toByte(), (height and 0xFF).toByte(), ((height shr 8) and 0xFF).toByte()))
            write(data)
        }.toByteArray()
    }

    private fun money(v: Double) = String.format(Locale.US, "%.2f", v)
}
