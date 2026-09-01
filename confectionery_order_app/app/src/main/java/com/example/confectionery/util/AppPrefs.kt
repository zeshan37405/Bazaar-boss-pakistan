package com.example.confectionery.util

import android.content.Context
import com.example.confectionery.BuildConfig
import java.util.UUID

class AppPrefs(context: Context) {
    private val p = context.getSharedPreferences("orderbook_prefs", Context.MODE_PRIVATE)

    var currentUserId: Long
        get() = p.getLong("user_id", 0)
        set(v) = p.edit().putLong("user_id", v).apply()

    var currentUserSyncId: String
        get() = p.getString("user_sync_id", "") ?: ""
        set(v) = p.edit().putString("user_sync_id", v).apply()

    var currentUserLogin: String
        get() = p.getString("user_login", "") ?: ""
        set(v) = p.edit().putString("user_login", v.trim()).apply()

    var currentUserRole: String
        get() = p.getString("user_role", "") ?: ""
        set(v) = p.edit().putString("user_role", v).apply()

    var purchaseRatesUnlocked: Boolean
        get() = p.getBoolean("purchase_unlocked", false)
        set(v) = p.edit().putBoolean("purchase_unlocked", v).apply()

    var privacyPinHash: String
        get() = p.getString("privacy_pin", Security.sha256("7860")) ?: Security.sha256("7860")
        set(v) = p.edit().putString("privacy_pin", v).apply()

    var businessId: String
        get() = p.getString("business_id", "") ?: ""
        set(v) = p.edit().putString("business_id", v.trim()).apply()

    var businessName: String
        get() = p.getString("business_name", "") ?: ""
        set(v) = p.edit().putString("business_name", v.trim()).apply()

    var businessPhone: String
        get() = p.getString("business_phone", "") ?: ""
        set(v) = p.edit().putString("business_phone", v.trim()).apply()

    var businessAddress: String
        get() = p.getString("business_address", "") ?: ""
        set(v) = p.edit().putString("business_address", v.trim()).apply()

    var businessLogoUri: String
        get() = p.getString("business_logo_uri", "") ?: ""
        set(v) = p.edit().putString("business_logo_uri", v).apply()

    var businessPasswordHash: String
        get() = p.getString("business_password_hash", "") ?: ""
        set(v) = p.edit().putString("business_password_hash", v).apply()

    var companyLoggedIn: Boolean
        get() = p.getBoolean("company_logged_in", false)
        set(v) = p.edit().putBoolean("company_logged_in", v).apply()

    var deviceBookerName: String
        get() = p.getString("device_booker", "") ?: ""
        set(v) = p.edit().putString("device_booker", v.trim()).apply()

    var deviceAreaName: String
        get() = p.getString("device_area", "") ?: ""
        set(v) = p.edit().putString("device_area", v.trim()).apply()

    val deviceId: String
        get() {
            val existing = p.getString("device_id", "").orEmpty()
            if (existing.isNotBlank()) return existing
            val generated = UUID.randomUUID().toString()
            p.edit().putString("device_id", generated).apply()
            return generated
        }

    var syncBaseUrl: String
        get() = (p.getString("sync_url", "") ?: "").ifBlank { BuildConfig.SYNC_BASE_URL }.trimEnd('/')
        set(v) = p.edit().putString("sync_url", v.trim().trimEnd('/')).apply()

    var syncToken: String
        get() = p.getString("sync_token", "") ?: ""
        set(v) = p.edit().putString("sync_token", v.trim()).apply()

    var lastSyncAt: Long
        get() = p.getLong("last_sync_at", 0L)
        set(v) = p.edit().putLong("last_sync_at", v).apply()

    var printerMode: String
        get() = p.getString("printer_mode", "REGULAR") ?: "REGULAR"
        set(v) = p.edit().putString("printer_mode", v).apply()

    var thermalPrinterAddress: String
        get() = p.getString("thermal_address", "") ?: ""
        set(v) = p.edit().putString("thermal_address", v).apply()

    var thermalPaperChars: Int
        get() = p.getInt("thermal_chars", 32)
        set(v) = p.edit().putInt("thermal_chars", v).apply()

    var autoBackupEnabled: Boolean
        get() = p.getBoolean("auto_backup_enabled", false)
        set(v) = p.edit().putBoolean("auto_backup_enabled", v).apply()

    var autoBackupUri: String
        get() = p.getString("auto_backup_uri", "") ?: ""
        set(v) = p.edit().putString("auto_backup_uri", v).apply()

    var lastBackupAt: Long
        get() = p.getLong("last_backup_at", 0L)
        set(v) = p.edit().putLong("last_backup_at", v).apply()

    fun clearSession() {
        companyLoggedIn = false
        purchaseRatesUnlocked = false
        currentUserId = 0L
        currentUserSyncId = ""
        currentUserLogin = ""
        currentUserRole = ""
        deviceBookerName = ""
        deviceAreaName = ""
        syncToken = ""
    }
}
