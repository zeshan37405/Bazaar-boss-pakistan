from pathlib import Path
import re

main_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/MainActivity.kt')
text = main_path.read_text(encoding='utf-8')

# Professional sign-in screen: no test-build/server jargon for normal users.
text = text.replace('reset("Order Booker Sign In")', 'reset("Business Sign In")', 1)
text = text.replace('info("صرف Company ID اور اپنا Username/Email + Password درج کریں۔ Area/Route آپ کے محفوظ profile سے خود آئے گا۔")',
                    'info("Company ID اور اپنا Username/Email + Password درج کریں۔ آپ کا نام، Area/Route اور محفوظ business profile خود load ہو جائے گا۔")', 1)
text = text.replace('button("Sign In & Restore") {', 'button("Sign In") {', 1)
text = text.replace('toast(if (result.online) "Online login — profile restored" else "Offline cached login")',
                    'toast(if (result.online) "اکاؤنٹ اور business data بحال ہوگیا" else "Offline login successful")', 1)
text = text.replace('.onFailure { toast(it.message ?: "Login failed") }',
                    '.onFailure { e ->\n                        val msg = e.message.orEmpty()\n                        toast(if (msg.contains("first login", ignoreCase = true) || msg.contains("server required", ignoreCase = true))\n                            "اس فون پر پہلی بار لاگ اِن کے لیے Cloud Sync یا Backup Restore درکار ہے" else msg.ifBlank { "Login failed" })\n                    }', 1)

# Remove the technical block from the login page entirely.
text = re.sub(
    r'\n\s*if \(prefs\.syncBaseUrl\.isBlank\(\)\) \{\n\s*info\("اس test build میں central server URL ابھی embedded نہیں ہے۔ نئی/reinstalled device کی پہلی online login کے لیے Owner کو server configure کرنا ہوگا۔"\)\n\s*button\("Advanced: Set Sync Server URL"\) \{ showServerSetup\(\) \}\n\s*\}',
    '', text, count=1)

# Make owner cloud settings professional and keep them owner-only.
text = text.replace('reset("Sync Server Setup")', 'reset("Cloud Sync Setup")', 1)
text = text.replace('info("یہ Owner/technical setup ہے۔ Production build میں URL app کے اندر embedded ہوگا، Order Bookers اسے نہیں لکھیں گے۔")',
                    'info("یہ setting صرف Owner کے لیے ہے۔ Order Bookers کو server address یا sync token درج کرنے کی ضرورت نہیں۔")', 1)
text = text.replace('val url = edit("HTTPS Sync Server URL")', 'val url = edit("Secure Cloud Server URL (HTTPS)")', 1)
text = text.replace('button("Save Server URL") {', 'button("Save Cloud Server") {', 1)

# Simplify sync status screen for business users.
pattern = r'    private fun showSync\(\) \{.*?\n    \}\n\n    private fun queueSync'
replacement = '''    private fun showSync() {
        reset("Sync & Restore"); back()
        val last = if (prefs.lastSyncAt > 0) SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(prefs.lastSyncAt)) else "Never"
        val cloudState = when {
            prefs.syncBaseUrl.isBlank() -> "Not configured"
            prefs.syncToken.isBlank() -> "Sign in required"
            else -> "Ready"
        }
        info("Offline orders فوراً محفوظ ہوتے ہیں۔ Internet دستیاب ہوتے ہی shared company data sync ہو سکتا ہے۔\\nLast successful sync: $last\\nCloud status: $cloudState")
        button("Sync Now") { queueSync(); toast("Sync request queued") }
        if (prefs.currentUserRole == "OWNER") button("Cloud Sync Settings") { showServerSetup() }
        if (prefs.currentUserRole != "OWNER") info("آپ کا Area/Route اور account settings Owner profile سے خود آتے ہیں۔")
    }

    private fun queueSync'''
text, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('V7 showSync replacement failed')

# Remove old test/prototype wording where it may still surface.
text = text.replace('DATA SAFETY: V5 keeps non-destructive Room migrations, stable APK signing, portable backup/restore and persistent Booker profiles.',
                    'DATA SAFETY: Updates use non-destructive migrations, portable backup/restore and persistent Booker profiles.')
text = text.replace('test build', 'app build')
text = text.replace('prototype', 'app')

main_path.write_text(text, encoding='utf-8')
print('V7 final UX patch applied')
