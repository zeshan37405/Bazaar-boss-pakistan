package com.example.confectionery

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.confectionery.sync.LocationClient
import com.example.confectionery.util.AppPrefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class BookerLocationService : Service(), LocationListener {
    companion object {
        const val ACTION_START = "com.example.confectionery.action.START_LOCATION"
        const val ACTION_STOP = "com.example.confectionery.action.STOP_LOCATION"
        private const val CHANNEL_ID = "booker_location_share"
        private const val NOTIFICATION_ID = 37405
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var prefs: AppPrefs
    private lateinit var locationManager: LocationManager

    override fun onCreate() {
        super.onCreate()
        prefs = AppPrefs(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            prefs.locationSharingEnabled = false
            stopLocationUpdates()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        startForeground(NOTIFICATION_ID, buildNotification())
        prefs.locationSharingEnabled = true
        startLocationUpdates()
        return START_STICKY
    }

    override fun onLocationChanged(location: Location) {
        prefs.lastLocationLat = location.latitude
        prefs.lastLocationLon = location.longitude
        prefs.lastLocationAccuracy = location.accuracy
        prefs.lastLocationAt = System.currentTimeMillis()
        if (prefs.syncBaseUrl.isBlank() || prefs.syncToken.isBlank()) return
        scope.launch {
            LocationClient.sendLocation(
                prefs = prefs,
                latitude = location.latitude,
                longitude = location.longitude,
                accuracy = location.accuracy.toDouble(),
                source = "ON_DUTY_FOREGROUND"
            )
        }
    }

    private fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @Suppress("MissingPermission")
    private fun startLocationUpdates() {
        if (!hasPermission()) {
            stopSelf()
            return
        }
        runCatching {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 60_000L, 25f, this, Looper.getMainLooper())
            }
        }
        runCatching {
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 60_000L, 50f, this, Looper.getMainLooper())
            }
        }
    }

    private fun stopLocationUpdates() {
        runCatching { locationManager.removeUpdates(this) }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(NotificationChannel(
                CHANNEL_ID,
                "Order Booker Location Sharing",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shown while the Order Booker is explicitly sharing on-duty location"
            })
        }
    }

    private fun buildNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
        .setContentTitle("On Duty • Location Sharing")
        .setContentText("Your location is being shared with the business owner")
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setContentIntent(PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        ))
        .build()

    override fun onDestroy() {
        stopLocationUpdates()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
