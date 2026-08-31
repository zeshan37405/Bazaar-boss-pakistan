package com.example.confectionery.util

import android.content.Context

class AppPrefs(context: Context) {
    private val p = context.getSharedPreferences("orderbook_prefs", Context.MODE_PRIVATE)
    var currentUserId: Long
        get() = p.getLong("user_id", 0)
        set(v) = p.edit().putLong("user_id", v).apply()
    var purchaseRatesUnlocked: Boolean
        get() = p.getBoolean("purchase_unlocked", false)
        set(v) = p.edit().putBoolean("purchase_unlocked", v).apply()
    var privacyPinHash: String
        get() = p.getString("privacy_pin", Security.sha256("7860")) ?: Security.sha256("7860")
        set(v) = p.edit().putString("privacy_pin", v).apply()
    var syncBaseUrl: String
        get() = p.getString("sync_url", "") ?: ""
        set(v) = p.edit().putString("sync_url", v.trimEnd('/')).apply()
    var syncToken: String
        get() = p.getString("sync_token", "") ?: ""
        set(v) = p.edit().putString("sync_token", v).apply()
}
