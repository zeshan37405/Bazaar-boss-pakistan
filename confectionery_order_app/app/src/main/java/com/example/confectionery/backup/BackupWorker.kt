package com.example.confectionery.backup

import android.content.Context
import android.net.Uri
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.confectionery.OrderBookApp
import com.example.confectionery.util.AppPrefs
import com.example.confectionery.util.BackupUtil

class BackupWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val prefs = AppPrefs(applicationContext)
        if (!prefs.autoBackupEnabled || prefs.autoBackupUri.isBlank()) return Result.success()
        return try {
            val db = (applicationContext as OrderBookApp).db
            BackupUtil.createBackup(applicationContext, Uri.parse(prefs.autoBackupUri), db, prefs)
            Result.success()
        } catch (_: SecurityException) {
            prefs.autoBackupEnabled = false
            Result.failure()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}
