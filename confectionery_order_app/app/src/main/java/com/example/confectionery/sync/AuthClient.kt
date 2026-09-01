package com.example.confectionery.sync

import com.example.confectionery.data.AppDatabase
import com.example.confectionery.data.UserEntity
import com.example.confectionery.util.AppPrefs
import com.example.confectionery.util.Security
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

object AuthClient {
    data class LoginResult(val user: UserEntity, val online: Boolean)

    suspend fun login(
        db: AppDatabase,
        prefs: AppPrefs,
        companyId: String,
        login: String,
        password: String
    ): Result<LoginResult> = withContext(Dispatchers.IO) {
        runCatching {
            val cleanCompany = companyId.trim()
            val cleanLogin = login.trim()
            require(cleanCompany.isNotBlank()) { "Company ID required" }
            require(cleanLogin.isNotBlank()) { "Username or email required" }
            require(password.isNotBlank()) { "Password required" }
            val clientHash = Security.sha256(password)

            // Prefer server authentication. This is what enables a new/reinstalled phone
            // to recover the booker's saved profile without asking for Area/Route again.
            if (prefs.syncBaseUrl.isNotBlank()) {
                val remote = runCatching {
                    val payload = JSONObject()
                        .put("business_id", cleanCompany)
                        .put("login", cleanLogin)
                        .put("password_hash", clientHash)
                        .put("device_id", prefs.deviceId)
                        .toString()
                        .toRequestBody("application/json".toMediaType())
                    val request = Request.Builder()
                        .url("${prefs.syncBaseUrl}/api/auth/login")
                        .post(payload)
                        .build()
                    val text = OkHttpClient.Builder().build().newCall(request).execute().use { response ->
                        if (!response.isSuccessful) error("Online login failed (${response.code})")
                        response.body?.string().orEmpty()
                    }
                    val root = JSONObject(text)
                    val userJson = root.getJSONObject("user")
                    val business = root.optJSONObject("business") ?: JSONObject()
                    val syncId = userJson.optString("sync_id").ifBlank { "remote-${cleanLogin.lowercase()}" }
                    val existing = db.userDao().bySyncId(syncId) ?: db.userDao().byLogin(cleanLogin)
                    val user = UserEntity(
                        id = existing?.id ?: 0L,
                        name = userJson.optString("name", cleanLogin),
                        username = userJson.optString("username", cleanLogin),
                        email = userJson.optString("email"),
                        passwordHash = clientHash,
                        role = userJson.optString("role", "ORDER_BOOKER"),
                        areaName = userJson.optString("area_name"),
                        photoUri = existing?.photoUri,
                        active = userJson.optBoolean("active", true),
                        syncId = syncId,
                        synced = true,
                        updatedAt = userJson.optLong("updated_at", System.currentTimeMillis())
                    )
                    val localId = if (existing == null) db.userDao().insert(user) else {
                        db.userDao().update(user.copy(id = existing.id)); existing.id
                    }
                    prefs.businessId = cleanCompany
                    prefs.businessName = business.optString("name", cleanCompany)
                    prefs.businessPhone = business.optString("phone")
                    prefs.businessAddress = business.optString("address")
                    prefs.syncToken = root.optString("token")
                    applySession(prefs, user.copy(id = localId), cleanLogin)
                    LoginResult(user.copy(id = localId), true)
                }
                if (remote.isSuccess) return@runCatching remote.getOrThrow()
            }

            // Offline fallback is allowed only for a previously authenticated/cached user
            // belonging to the same company on this device.
            require(prefs.businessId.equals(cleanCompany, ignoreCase = true)) {
                "Online server required on this device for first login"
            }
            val cached = db.userDao().byLogin(cleanLogin) ?: error("User not available offline")
            require(cached.active && cached.passwordHash == clientHash) { "Invalid username/email or password" }
            applySession(prefs, cached, cleanLogin)
            LoginResult(cached, false)
        }
    }

    private fun applySession(prefs: AppPrefs, user: UserEntity, login: String) {
        prefs.currentUserId = user.id
        prefs.currentUserSyncId = user.syncId
        prefs.currentUserLogin = login
        prefs.currentUserRole = user.role
        prefs.deviceBookerName = user.name
        prefs.deviceAreaName = user.areaName
        prefs.companyLoggedIn = true
        prefs.purchaseRatesUnlocked = false
    }
}
