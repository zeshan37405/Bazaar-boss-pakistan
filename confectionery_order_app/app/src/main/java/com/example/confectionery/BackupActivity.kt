package com.example.confectionery

import android.content.Intent
import android.content.res.ColorStateList
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.confectionery.util.AppPrefs
import com.example.confectionery.util.BackupUtil
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class BackupActivity : AppCompatActivity() {
    private val db by lazy { (application as OrderBookApp).db }
    private val prefs by lazy { AppPrefs(this) }
    private lateinit var root: LinearLayout

    private val manualBackup = registerForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri ->
        uri ?: return@registerForActivityResult
        persist(uri, write = true)
        createBackup(uri, enableAuto = false)
    }

    private val autoBackup = registerForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri ->
        uri ?: return@registerForActivityResult
        persist(uri, write = true)
        prefs.autoBackupUri = uri.toString()
        prefs.autoBackupEnabled = true
        createBackup(uri, enableAuto = true)
    }

    private val restoreBackup = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@registerForActivityResult
        AlertDialog.Builder(this)
            .setTitle("Restore Full Backup?")
            .setMessage("موجودہ local data اس backup کے data سے replace ہوگا۔ Backup validate ہونے کے بعد ہی restore شروع ہوگا۔")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Restore") { _, _ -> doRestore(uri) }
            .show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(18), dp(16), dp(30))
            setBackgroundColor(ContextCompat.getColor(this@BackupActivity, R.color.surface))
        }
        setContentView(ScrollView(this).apply { addView(root) })
        render()
    }

    private fun render() {
        root.removeAllViews()
        title("Backup & Restore")
        val last = if (prefs.lastBackupAt > 0) {
            SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(prefs.lastBackupAt))
        } else "No backup created yet"
        info("Company: ${prefs.businessName.ifBlank { prefs.businessId.ifBlank { "Not configured" } }}\nLast backup: $last")
        info("Full backup میں Customers, Products, Piece/Box/Carton/Dozen/Litre/ML rates, Stock, Orders, Order Items, Balances, Expenses, Users, Business settings اور offline catalog/customer/logo images شامل ہوتے ہیں۔")

        button("💾 Create Full Backup Now") {
            manualBackup.launch(fileName("manual"))
        }
        button(if (prefs.autoBackupEnabled) "✅ Auto Backup File — Change" else "🔁 Enable Auto Backup") {
            autoBackup.launch(fileName("auto"))
        }
        if (prefs.autoBackupEnabled) {
            info("Auto Backup: ON\nجب order/customer/product/expense یا business data بدلے گا تو منتخب backup file تازہ کی جائے گی۔")
            button("Turn Auto Backup OFF") {
                prefs.autoBackupEnabled = false
                render()
            }
        } else {
            info("Auto Backup: OFF\nایک دفعہ backup file/location منتخب کریں۔ Google Drive document provider، phone storage یا supported cloud location منتخب کی جا سکتی ہے۔")
        }

        button("♻ Restore Full Backup File") {
            restoreBackup.launch(arrayOf("application/zip", "application/octet-stream", "*/*"))
        }
        button("📱 Android Backup Settings") {
            runCatching { startActivity(Intent(Settings.ACTION_SETTINGS)) }
        }
        button("← Open Order Book") {
            startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP))
            finish()
        }
        info("اہم: APK update پر V3+ کی stable signing اور non-destructive database migration data محفوظ رکھتے ہیں۔ Uninstall کے بعد manual/auto backup file سے مکمل restore ممکن ہے۔ صرف Company ID سے automatic cloud restore کے لیے central sync server الگ ضروری ہے۔")
    }

    private fun createBackup(uri: Uri, enableAuto: Boolean) {
        info("Backup بن رہا ہے…")
        lifecycleScope.launch {
            runCatching { BackupUtil.createBackup(this@BackupActivity, uri, db, prefs) }
                .onSuccess { s ->
                    toast("Backup complete: ${s.orders} orders, ${s.products} products")
                    if (enableAuto) prefs.autoBackupEnabled = true
                    render()
                }
                .onFailure {
                    if (enableAuto) prefs.autoBackupEnabled = false
                    AlertDialog.Builder(this@BackupActivity).setTitle("Backup failed").setMessage(it.message ?: "Unknown error").setPositiveButton("OK", null).show()
                }
        }
    }

    private fun doRestore(uri: Uri) {
        info("Backup validate اور restore ہو رہا ہے…")
        lifecycleScope.launch {
            runCatching { BackupUtil.restoreBackup(this@BackupActivity, uri, db, prefs) }
                .onSuccess { s ->
                    Toast.makeText(this@BackupActivity, "Restore complete: ${s.orders} orders, ${s.products} products", Toast.LENGTH_LONG).show()
                    startActivity(Intent(this@BackupActivity, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK))
                    finish()
                }
                .onFailure {
                    AlertDialog.Builder(this@BackupActivity).setTitle("Restore failed").setMessage(it.message ?: "Backup invalid or damaged").setPositiveButton("OK", null).show()
                }
        }
    }

    private fun persist(uri: Uri, write: Boolean) {
        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or if (write) Intent.FLAG_GRANT_WRITE_URI_PERMISSION else 0
        runCatching { contentResolver.takePersistableUriPermission(uri, flags) }
    }

    private fun fileName(kind: String): String {
        val safe = prefs.businessId.ifBlank { "business" }.replace(Regex("[^A-Za-z0-9_-]"), "_")
        val stamp = SimpleDateFormat("yyyyMMdd-HHmm", Locale.US).format(Date())
        return "Confectionery-$safe-$kind-$stamp.cobackup.zip"
    }

    private fun title(value: String) {
        root.addView(TextView(this).apply {
            text = value; textSize = 26f; gravity = Gravity.CENTER_VERTICAL
            setTextColor(ContextCompat.getColor(this@BackupActivity, R.color.text_primary))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, dp(12))
        })
    }

    private fun info(value: String) {
        root.addView(TextView(this).apply {
            text = value; textSize = 16f
            setTextColor(ContextCompat.getColor(this@BackupActivity, R.color.text_primary))
            setPadding(dp(6), dp(8), dp(6), dp(8))
        })
    }

    private fun button(label: String, action: () -> Unit) {
        root.addView(Button(this).apply {
            text = label; isAllCaps = false; textSize = 16f
            backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this@BackupActivity, R.color.brand_primary))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener { action() }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            setMargins(0, dp(5), 0, dp(5))
        })
    }

    private fun toast(value: String) = Toast.makeText(this, value, Toast.LENGTH_LONG).show()
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
