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
import java.util.UUID

object AuthClient {
    data class LoginResult(val user: UserEntity, val online: Boolean)
    private val http by lazy { OkHttpClient.Builder().build() }

    suspend fun signupBooker(
        db: AppDatabase,
        prefs: AppPrefs,
        companyId: String,
        name: String,
        username: String,
        email: String,
        password: String,
        areaName: String
    ): Result<LoginResult> = withContext(Dispatchers.IO) {
        runCatching {
            val cleanCompany = companyId.trim()
            val cleanUser = username.trim()
            val cleanEmail = email.trim()
            require(cleanCompany.equals(AppPrefs.FIXED_COMPANY_ID, ignoreCase = true)) { "Invalid Company ID" }
            require(name.isNotBlank() && cleanUser.isNotBlank()) { "Name and username required" }
            require(password.length >= 4) { "Password must be at least 4 characters" }
            require(areaName.isNotBlank()) { "Area / Route required" }
            require(db.userDao().byLogin(cleanUser) == null) { "Username already exists on this phone" }
            if (cleanEmail.isNotBlank()) require(db.userDao().byLogin(cleanEmail) == null) { "Email already exists on this phone" }

            val clientHash = Security.sha256(password)
            val syncId = UUID.randomUUID().toString()

            if (prefs.syncBaseUrl.isNotBlank()) {
                val remote = runCatching {
                    val payload = JSONObject()
                        .put("business_id", AppPrefs.FIXED_COMPANY_ID)
                        .put("device_id", prefs.deviceId)
                        .put("user", JSONObject()
                            .put("sync_id", syncId)
                            .put("name", name.trim())
                            .put("username", cleanUser)
                            .put("email", cleanEmail)
                            .put("password_hash", clientHash)
                            .put("area_name", areaName.trim()))
                        .toString().toRequestBody("application/json".toMediaType())
                    val request = Request.Builder().url("${prefs.syncBaseUrl}/api/auth/signup").post(payload).build()
                    val text = http.newCall(request).execute().use { response ->
                        if (!response.isSuccessful) error(if (response.code == 409) "Username or email already exists" else "Sign up failed (${response.code})")
                        response.body?.string().orEmpty()
                    }
                    val root = JSONObject(text)
                    val uj = root.getJSONObject("user")
                    val business = root.optJSONObject("business") ?: JSONObject()
                    val user = UserEntity(
                        name = uj.optString("name", name.trim()),
                        username = uj.optString("username", cleanUser),
                        email = uj.optString("email", cleanEmail),
                        passwordHash = clientHash,
                        role = "ORDER_BOOKER",
                        areaName = uj.optString("area_name", areaName.trim()),
                        active = true,
                        syncId = uj.optString("sync_id", syncId),
                        synced = true,
                        updatedAt = uj.optLong("updated_at", System.currentTimeMillis())
                    )
                    val localId = db.userDao().insert(user)
                    prefs.businessId = AppPrefs.FIXED_COMPANY_ID
                    prefs.businessName = business.optString("name", "Confectionery Order Book")
                    prefs.businessPhone = business.optString("phone")
                    prefs.businessAddress = business.optString("address")
                    prefs.syncToken = root.optString("token")
                    applySession(prefs, user.copy(id = localId), cleanUser)
                    LoginResult(user.copy(id = localId), true)
                }
                if (remote.isSuccess) return@runCatching remote.getOrThrow()
            }

            val local = UserEntity(
                name = name.trim(), username = cleanUser, email = cleanEmail,
                passwordHash = clientHash, role = "ORDER_BOOKER", areaName = areaName.trim(),
                active = true, syncId = syncId, synced = false
            )
            val localId = db.userDao().insert(local)
            prefs.businessId = AppPrefs.FIXED_COMPANY_ID
            if (prefs.businessName.isBlank()) prefs.businessName = "Confectionery Order Book"
            applySession(prefs, local.copy(id = localId), cleanUser)
            LoginResult(local.copy(id = localId), false)
        }
    }

    suspend fun ensureOnlineSession(db: AppDatabase, prefs: AppPrefs): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            if (prefs.syncBaseUrl.isBlank()) return@runCatching false
            if (prefs.syncToken.isNotBlank()) return@runCatching true
            val user = db.userDao().byId(prefs.currentUserId) ?: return@runCatching false
            if (user.role != "ORDER_BOOKER") return@runCatching false
            val payload = JSONObject()
                .put("business_id", AppPrefs.FIXED_COMPANY_ID)
                .put("device_id", prefs.deviceId)
                .put("user", JSONObject()
                    .put("sync_id", user.syncId)
                    .put("name", user.name)
                    .put("username", user.username)
                    .put("email", user.email)
                    .put("password_hash", user.passwordHash)
                    .put("area_name", user.areaName))
                .toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url("${prefs.syncBaseUrl}/api/auth/signup").post(payload).build()
            val text = http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@runCatching false
                response.body?.string().orEmpty()
            }
            val root = JSONObject(text)
            prefs.syncToken = root.optString("token")
            if (prefs.syncToken.isBlank()) return@runCatching false
            db.userDao().update(user.copy(synced = true, updatedAt = System.currentTimeMillis()))
            true
        }
    }

    suspend fun registerBusiness(
        db: AppDatabase,
        prefs: AppPrefs,
        businessName: String,
        companyId: String,
        ownerName: String,
        username: String,
        email: String,
        password: String,
        areaName: String,
        phone: String,
        address: String
    ): Result<LoginResult> = withContext(Dispatchers.IO) {
        runCatching {
            val cleanCompany = companyId.trim()
            val cleanUser = username.trim()
            require(businessName.isNotBlank() && cleanCompany.isNotBlank()) { "Business name and Company ID required" }
            require(ownerName.isNotBlank() && cleanUser.isNotBlank() && password.length >= 4) { "Owner login details incomplete" }
            require(areaName.isNotBlank()) { "Owner Area/Route required" }
            val clientHash = Security.sha256(password)

            if (prefs.syncBaseUrl.isNotBlank()) {
                val online = runCatching {
                    val payload = JSONObject()
                        .put("business_id", cleanCompany)
                        .put("business_name", businessName.trim())
                        .put("business_phone", phone.trim())
                        .put("business_address", address.trim())
                        .put("device_id", prefs.deviceId)
                        .put("owner", JSONObject()
                            .put("name", ownerName.trim())
                            .put("username", cleanUser)
                            .put("email", email.trim())
                            .put("password_hash", clientHash)
                            .put("area_name", areaName.trim()))
                        .toString().toRequestBody("application/json".toMediaType())
                    val request = Request.Builder().url("${prefs.syncBaseUrl}/api/business/register").post(payload).build()
                    val text = http.newCall(request).execute().use { response ->
                        if (!response.isSuccessful) error("Business registration failed (${response.code})")
                        response.body?.string().orEmpty()
                    }
                    val root = JSONObject(text)
                    val uj = root.getJSONObject("user")
                    val user = UserEntity(
                        name = uj.optString("name", ownerName.trim()), username = uj.optString("username", cleanUser),
                        email = uj.optString("email", email.trim()), passwordHash = clientHash, role = "OWNER",
                        areaName = uj.optString("area_name", areaName.trim()), active = true,
                        syncId = uj.optString("sync_id").ifBlank { UUID.randomUUID().toString() }, synced = true,
                        updatedAt = uj.optLong("updated_at", System.currentTimeMillis())
                    )
                    val localId = db.userDao().insert(user)
                    prefs.businessId = cleanCompany
                    prefs.businessName = businessName.trim()
                    prefs.businessPhone = phone.trim()
                    prefs.businessAddress = address.trim()
                    prefs.businessPasswordHash = clientHash
                    prefs.syncToken = root.optString("token")
                    applySession(prefs, user.copy(id = localId), cleanUser)
                    LoginResult(user.copy(id = localId), true)
                }
                if (online.isSuccess) return@runCatching online.getOrThrow()
            }

            prefs.businessId = cleanCompany
            prefs.businessName = businessName.trim()
            prefs.businessPhone = phone.trim()
            prefs.businessAddress = address.trim()
            prefs.businessPasswordHash = clientHash
            val user = UserEntity(
                name = ownerName.trim(), username = cleanUser, email = email.trim(), passwordHash = clientHash,
                role = "OWNER", areaName = areaName.trim(), active = true, synced = false
            )
            val localId = db.userDao().insert(user)
            applySession(prefs, user.copy(id = localId), cleanUser)
            LoginResult(user.copy(id = localId), false)
        }
    }

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

            if (prefs.syncBaseUrl.isNotBlank()) {
                val remote = runCatching {
                    val payload = JSONObject()
                        .put("business_id", cleanCompany)
                        .put("login", cleanLogin)
                        .put("password_hash", clientHash)
                        .put("device_id", prefs.deviceId)
                        .toString()
                        .toRequestBody("application/json".toMediaType())
                    val request = Request.Builder().url("${prefs.syncBaseUrl}/api/auth/login").post(payload).build()
                    val text = http.newCall(request).execute().use { response ->
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
                        name = userJson.optString("name", cleanLogin), username = userJson.optString("username", cleanLogin),
                        email = userJson.optString("email"), passwordHash = clientHash,
                        role = userJson.optString("role", "ORDER_BOOKER"), areaName = userJson.optString("area_name"),
                        photoUri = existing?.photoUri, active = userJson.optBoolean("active", true), syncId = syncId,
                        synced = true, updatedAt = userJson.optLong("updated_at", System.currentTimeMillis())
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

            require(prefs.businessId.equals(cleanCompany, ignoreCase = true)) {
                "First login on this phone needs Cloud Sync or a restored backup"
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
