from pathlib import Path
import re

path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/MainActivity.kt')
text = path.read_text(encoding='utf-8')
pattern = r'    private fun showSync\(\) \{.*?\n    \}\n\n    private fun queueSync'
replacement = '''    private fun showSync() {
        reset("Online Sync / Restore"); back()
        val last = if (prefs.lastSyncAt > 0) SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(prefs.lastSyncAt)) else "Never"
        val serverStatus = if (prefs.syncBaseUrl.isBlank()) "Not configured" else prefs.syncBaseUrl
        val sessionStatus = if (prefs.syncToken.isBlank()) "Offline / no server token" else "Authenticated"
        info("Offline orders فوراً save ہوتے ہیں۔ Internet آنے پر server سے two-way sync ہوگا۔\\nLast successful sync: $last\\nServer: $serverStatus\\nSession: $sessionStatus")
        button("Sync Now") { queueSync(); toast("Sync queued — internet available ہوتے ہی چلے گا") }
        if (prefs.currentUserRole == "OWNER") button("Server Setup") { showServerSetup() }
        info("Order Booker کو Sync token، Area یا server settings بار بار نہیں لکھنی چاہئیں۔ Online login کے بعد token خود ملتا ہے اور Area profile سے خود آتا ہے۔")
    }

    private fun queueSync'''
text, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('V5 showSync block not found')
path.write_text(text, encoding='utf-8')
print('V5 showSync Kotlin block repaired')
