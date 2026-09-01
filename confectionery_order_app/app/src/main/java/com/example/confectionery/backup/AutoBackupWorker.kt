package com.example.confectionery.backup

import android.content.Context
import android.net.Uri
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.confectionery.OrderBookApp
import com.example.confectionery.util.AppPrefs
import com.example.confectionery.util.BackupManager

class AutoBackupWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val prefs = AppPrefs(applicationContext)
        if (!prefs.autoBackupEnabled || prefs.autoBackupUri.isBlank()) return Result.success()
        val db = (applicationContext as OrderBookApp).db
        return runCatching {
            BackupManager.writeBackup(applicationContext, db, prefs, Uri.parse(prefs.autoBackupUri))
            Result.success()
        }.getOrElse { Result.retry() }
    }
}
