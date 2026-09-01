from pathlib import Path

path = Path("confectionery_order_app/app/src/main/java/com/example/confectionery/MainActivity.kt")
s = path.read_text(encoding="utf-8")

anchor1 = '        button("Create New Business") { showCreateBusiness() }\n        button("Join Existing Business / Restore") { showJoinBusiness() }'
replace1 = '        button("Create New Business") { showCreateBusiness() }\n        button("♻ Restore Full Backup File") { startActivity(Intent(this, BackupActivity::class.java)) }\n        button("Join Existing Business / Restore") { showJoinBusiness() }'
if anchor1 not in s:
    raise SystemExit("first-start backup anchor not found")
s = s.replace(anchor1, replace1, 1)

anchor2 = '        button("☁ Online Sync / Restore") { showSync() }\n        button("⚙ Settings & Privacy") { showSettings() }'
replace2 = '        button("☁ Online Sync / Restore") { showSync() }\n        button("💾 Backup & Restore") { startActivity(Intent(this, BackupActivity::class.java)) }\n        button("⚙ Settings & Privacy") { showSettings() }'
if anchor2 not in s:
    raise SystemExit("dashboard backup anchor not found")
s = s.replace(anchor2, replace2, 1)

anchor3 = '        WorkManager.getInstance(this).enqueueUniqueWork("company-order-sync", ExistingWorkPolicy.REPLACE, request)'
replace3 = anchor3 + '\n        val backupRequest = OneTimeWorkRequestBuilder<com.example.confectionery.backup.BackupWorker>().build()\n        WorkManager.getInstance(this).enqueueUniqueWork("company-auto-backup", ExistingWorkPolicy.REPLACE, backupRequest)'
if anchor3 not in s:
    raise SystemExit("queueSync anchor not found")
s = s.replace(anchor3, replace3, 1)

path.write_text(s, encoding="utf-8")
print("V4 backup UI and auto-backup wiring applied")
