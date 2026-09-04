package com.example.confectionery.sync

import com.example.confectionery.util.AppPrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

object LocationClient {
    data class BookerLocation(
        val name: String,
        val username: String,
        val areaName: String,
        val latitude: Double,
        val longitude: Double,
        val accuracy: Double,
        val deviceId: String,
        val updatedAt: Long
    )

    private val client by lazy { OkHttpClient.Builder().build() }

    suspend fun sendLocation(
        prefs: AppPrefs,
        latitude: Double,
        longitude: Double,
        accuracy: Double,
        source: String = "ON_DUTY"
    ): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            require(prefs.syncBaseUrl.isNotBlank() && prefs.syncToken.isNotBlank()) { "Cloud session required" }
            val body = JSONObject()
                .put("business_id", prefs.businessId)
                .put("device_id", prefs.deviceId)
                .put("latitude", latitude)
                .put("longitude", longitude)
                .put("accuracy", accuracy)
                .put("area_name", prefs.deviceAreaName)
                .put("source", source)
                .put("captured_at", System.currentTimeMillis())
                .toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("${prefs.syncBaseUrl}/api/location/update")
                .header("Authorization", "Bearer ${prefs.syncToken}")
                .post(body)
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) error("Location upload failed (${response.code})")
            }
            prefs.lastLocationLat = latitude
            prefs.lastLocationLon = longitude
            prefs.lastLocationAccuracy = accuracy.toFloat()
            prefs.lastLocationAt = System.currentTimeMillis()
        }
    }

    suspend fun fetchBookerLocations(prefs: AppPrefs): Result<List<BookerLocation>> = withContext(Dispatchers.IO) {
        runCatching {
            require(prefs.syncBaseUrl.isNotBlank() && prefs.syncToken.isNotBlank()) { "Cloud session required" }
            val request = Request.Builder()
                .url("${prefs.syncBaseUrl}/api/location/bookers")
                .header("Authorization", "Bearer ${prefs.syncToken}")
                .get()
                .build()
            val text = client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) error("Location list failed (${response.code})")
                response.body?.string().orEmpty()
            }
            val root = JSONObject(text)
            val arr = root.optJSONArray("locations") ?: JSONArray()
            buildList {
                for (i in 0 until arr.length()) {
                    val j = arr.getJSONObject(i)
                    add(BookerLocation(
                        name = j.optString("name"),
                        username = j.optString("username"),
                        areaName = j.optString("area_name"),
                        latitude = j.optDouble("latitude"),
                        longitude = j.optDouble("longitude"),
                        accuracy = j.optDouble("accuracy"),
                        deviceId = j.optString("device_id"),
                        updatedAt = j.optLong("updated_at")
                    ))
                }
            }
        }
    }
}
