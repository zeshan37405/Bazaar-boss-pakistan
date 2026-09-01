from pathlib import Path
import re

main_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/MainActivity.kt')
backup_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/util/BackupManager.kt')
text = main_path.read_text(encoding='utf-8')

def once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    text = text.replace(old, new, 1)

once('import androidx.activity.result.contract.ActivityResultContracts\n',
     'import androidx.activity.OnBackPressedCallback\nimport androidx.activity.result.contract.ActivityResultContracts\n', 'back import')
once('import com.example.confectionery.sync.SyncWorker\n',
     'import com.example.confectionery.sync.AuthClient\nimport com.example.confectionery.sync.SyncWorker\n', 'auth import')
once('    private var photoCallback: ((Uri) -> Unit)? = null\n',
     '    private var photoCallback: ((Uri) -> Unit)? = null\n    private var systemBackAction: (() -> Unit)? = null\n', 'back field')
once('        super.onCreate(savedInstanceState)\n        root = LinearLayout(this).apply {',
     '''        super.onCreate(savedInstanceState)\n        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {\n            override fun handleOnBackPressed() {\n                (systemBackAction ?: { finish() }).invoke()\n            }\n        })\n        root = LinearLayout(this).apply {''', 'back callback')

# Do not force a Booker/Area form after authenticated login. Auth/profile restore owns those fields.
once('            prefs.deviceBookerName.isBlank() || prefs.deviceAreaName.isBlank() -> showDeviceProfile()\n            else -> showDashboard()',
     '            prefs.currentUserId == 0L -> showCompanyLogin()\n            else -> showDashboard()', 'startup profile')

# First screen.
pattern = r'    private fun showFirstStart\(\) \{.*?\n    \}\n\n    private fun showCreateBusiness'
replacement = '''    private fun showFirstStart() {\n        reset("Confectionery Order Book")\n        systemBackAction = { finish() }\n        info("Offline-first order booking. Company ID کے تحت shared business data، جبکہ ہر Order Booker کا اپنا login اور assigned Area ہوگا۔")\n        button("Sign In to Existing Business") { showCompanyLogin() }\n        button("Create New Business") { showCreateBusiness() }\n        button("♻ Restore Full Backup File") { backupRestorer.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }\n    }\n\n    private fun showCreateBusiness'''
text, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
if n != 1: raise SystemExit('showFirstStart replace failed')

# Business creation now creates a real owner login profile.
pattern = r'    private fun showCreateBusiness\(\) \{.*?\n    \}\n\n    private fun showJoinBusiness'
replacement = '''    private fun showCreateBusiness() {\n        reset("Create Business")\n        back { showFirstStart() }\n        info("Owner account بھی اسی Company ID کے اندر ایک مستقل user ہوگا۔ بعد میں Order Bookers کے الگ accounts بنائیں۔")\n        val businessName = edit("Business / Company name")\n        val businessId = edit("Company ID")\n        val ownerName = edit("Owner full name")\n        val username = edit("Owner username")\n        val email = edit("Owner email (optional)")\n        val password = edit("Owner password", password = true)\n        val phone = edit("Business phone")\n        val address = edit("Business address")\n        val area = edit("Owner Area / Route")\n        val pin = edit("Purchase Rate privacy PIN", numeric = true, password = true)\n        button("Create & Open") {\n            if (txt(businessName).isBlank() || txt(businessId).isBlank() || txt(ownerName).isBlank() ||\n                txt(username).isBlank() || txt(password).length < 4 || txt(area).isBlank() || txt(pin).length < 4) {\n                return@button toast("ضروری معلومات مکمل درج کریں")\n            }\n            prefs.privacyPinHash = Security.sha256(txt(pin))\n            lifecycleScope.launch {\n                AuthClient.registerBusiness(\n                    db, prefs, txt(businessName), txt(businessId), txt(ownerName), txt(username), txt(email),\n                    txt(password), txt(area), txt(phone), txt(address)\n                ).onSuccess { result ->\n                    queueSync(); queueAutoBackup()\n                    toast(if (result.online) "Business online registered" else "Business offline created — server connect ہونے پر sync ہوگا")\n                    showDashboard()\n                }.onFailure { toast(it.message ?: "Business create failed") }\n            }\n        }\n    }\n\n    private fun showJoinBusiness'''
text, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
if n != 1: raise SystemExit('showCreateBusiness replace failed')

# Existing business login requires only company + personal credential.
pattern = r'    private fun showJoinBusiness\(\) \{.*?\n    \}\n\n    private fun showCompanyLogin'
replacement = '''    private fun showJoinBusiness() {\n        showCompanyLogin()\n    }\n\n    private fun showCompanyLogin'''
text, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
if n != 1: raise SystemExit('showJoinBusiness replace failed')

pattern = r'    private fun showCompanyLogin\(\) \{.*?\n    \}\n\n    private fun showDashboard'
replacement = '''    private fun showCompanyLogin() {\n        reset("Order Booker Sign In")\n        systemBackAction = { if (prefs.businessId.isBlank()) showFirstStart() else finish() }\n        info("صرف Company ID اور اپنا Username/Email + Password درج کریں۔ Area/Route آپ کے محفوظ profile سے خود آئے گا۔")\n        val id = edit("Company ID"); id.setText(prefs.businessId)\n        val login = edit("Username or Email")\n        val password = edit("Password", password = true)\n        button("Sign In & Restore") {\n            lifecycleScope.launch {\n                AuthClient.login(db, prefs, txt(id), txt(login), txt(password))\n                    .onSuccess { result ->\n                        queueSync()\n                        toast(if (result.online) "Online login — profile restored" else "Offline cached login")\n                        showDashboard()\n                    }\n                    .onFailure { toast(it.message ?: "Login failed") }\n            }\n        }\n        if (prefs.syncBaseUrl.isBlank()) {\n            info("اس test build میں central server URL ابھی embedded نہیں ہے۔ نئی/reinstalled device کی پہلی online login کے لیے Owner کو server configure کرنا ہوگا۔")\n            button("Advanced: Set Sync Server URL") { showServerSetup() }\n        }\n        button("♻ Restore Backup File") { backupRestorer.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }\n    }\n\n    private fun showDashboard'''
text, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
if n != 1: raise SystemExit('showCompanyLogin replace failed')

# Dashboard session and admin controls.
once('        reset(prefs.businessName.ifBlank { "Confectionery Order Book" })\n        info("Company: ${prefs.businessId}\\nBooker: ${prefs.deviceBookerName} • Area: ${prefs.deviceAreaName}")',
     '''        reset(prefs.businessName.ifBlank { "Confectionery Order Book" })\n        systemBackAction = { finish() }\n        info("Company: ${prefs.businessId}\\nUser: ${prefs.deviceBookerName} • ${prefs.currentUserRole}\\nLogin: ${prefs.currentUserLogin}\\nArea: ${prefs.deviceAreaName}")''', 'dashboard header')
once('        button("💾 Backup & Restore") { showBackup() }\n        button("☁ Online Sync / Restore") { showSync() }',
     '''        button("💾 Backup & Restore") { showBackup() }\n        if (prefs.currentUserRole == "OWNER") button("👤 Order Booker Accounts") { showBookerAccounts() }\n        button("☁ Online Sync / Restore") { showSync() }''', 'dashboard accounts')
once('        button("Sign out") {\n            prefs.companyLoggedIn = false\n            prefs.purchaseRatesUnlocked = false\n            showCompanyLogin()\n        }',
     '''        button("Sign out") {\n            prefs.clearSession()\n            showCompanyLogin()\n        }''', 'signout')

# Add admin account management before catalog.
anchor = '    private fun showCatalog(category: String? = null) {'
if anchor not in text: raise SystemExit('catalog insert anchor missing')
new_funcs = '''    private fun showBookerAccounts() {\n        if (prefs.currentUserRole != "OWNER") return showDashboard()\n        reset("Order Booker Accounts")\n        back()\n        info("ہر Booker کا username/email، password اور Area ایک بار Owner set کرے گا۔ Booker کو login کے بعد Area دوبارہ لکھنے کی ضرورت نہیں۔")\n        button("+ Add Order Booker") { showAddBooker() }\n        lifecycleScope.launch {\n            val users = db.userDao().all()\n            users.forEach { u ->\n                info("${u.name} • ${u.role}\\nUsername: ${u.username}${if (u.email.isNotBlank()) " • ${u.email}" else ""}\\nArea: ${u.areaName}\\n${if (u.synced) "Synced" else "Pending Sync"}")\n            }\n        }\n    }\n\n    private fun showAddBooker() {\n        if (prefs.currentUserRole != "OWNER") return showDashboard()\n        reset("Add Order Booker")\n        back { showBookerAccounts() }\n        val name = edit("Full name")\n        val username = edit("Unique username")\n        val email = edit("Email (optional)")\n        val password = edit("Password", password = true)\n        val area = edit("Assigned Area / Route")\n        button("Save Booker") {\n            if (txt(name).isBlank() || txt(username).isBlank() || txt(password).length < 4 || txt(area).isBlank())\n                return@button toast("Name, username, password اور Area ضروری ہیں")\n            lifecycleScope.launch {\n                val sameUser = db.userDao().byLogin(txt(username))\n                val sameEmail = txt(email).takeIf { it.isNotBlank() }?.let { db.userDao().byLogin(it) }\n                if (sameUser != null || sameEmail != null) return@launch toast("Username/Email پہلے سے موجود ہے")\n                db.userDao().insert(UserEntity(\n                    name = txt(name), username = txt(username), email = txt(email),\n                    passwordHash = Security.sha256(txt(password)), role = "ORDER_BOOKER",\n                    areaName = txt(area), active = true, synced = false\n                ))\n                queueSync(); queueAutoBackup(); toast("Order Booker account saved"); showBookerAccounts()\n            }\n        }\n    }\n\n    private fun showServerSetup() {\n        reset("Sync Server Setup")\n        back { if (prefs.companyLoggedIn) showSync() else showCompanyLogin() }\n        info("یہ Owner/technical setup ہے۔ Production build میں URL app کے اندر embedded ہوگا، Order Bookers اسے نہیں لکھیں گے۔")\n        val url = edit("HTTPS Sync Server URL"); url.setText(prefs.syncBaseUrl)\n        button("Save Server URL") {\n            val value = txt(url)\n            if (!value.startsWith("https://")) return@button toast("HTTPS URL ضروری ہے")\n            prefs.syncBaseUrl = value\n            toast("Server URL saved")\n            if (prefs.companyLoggedIn) showSync() else showCompanyLogin()\n        }\n    }\n\n'''
text = text.replace(anchor, new_funcs + anchor, 1)

# Settings: profile assignment is controlled by owner account, not typed on each Booker phone.
once('        button("Change This Device Booker / Area") { showDeviceProfile() }\n        button("Business Profile & Logo") { showBusinessProfile() }',
     '''        if (prefs.currentUserRole == "OWNER") {\n            button("Order Booker Accounts / Areas") { showBookerAccounts() }\n            button("Business Profile & Logo") { showBusinessProfile() }\n        } else {\n            info("Assigned profile: ${prefs.deviceBookerName} • Area: ${prefs.deviceAreaName}\\nArea changes Owner account سے ہوں گی۔")\n        }''', 'settings profile')
once('DATA SAFETY: V4 keeps non-destructive Room migrations, stable APK signing and portable full backup/restore.',
     'DATA SAFETY: V5 keeps non-destructive Room migrations, stable APK signing, portable backup/restore and persistent Booker profiles.', 'settings version')

# Sync screen: token is session-generated, not typed by bookers.
pattern = r'    private fun showSync\(\) \{.*?\n    \}\n\n    private fun queueSync'
replacement = '''    private fun showSync() {\n        reset("Online Sync / Restore"); back()\n        val last = if (prefs.lastSyncAt > 0) SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(prefs.lastSyncAt)) else "Never"\n        info("Offline orders فوراً save ہوتے ہیں۔ Internet آنے پر server سے two-way sync ہوگا۔\\nLast successful sync: $last\\nServer: ${if (prefs.syncBaseUrl.isBlank()) "Not configured" else prefs.syncBaseUrl}\\nSession: ${if (prefs.syncToken.isBlank()) "Offline / no server token" else "Authenticated"}")\n        button("Sync Now") { queueSync(); toast("Sync queued — internet available ہوتے ہی چلے گا") }\n        if (prefs.currentUserRole == "OWNER") button("Server Setup") { showServerSetup() }\n        info("Order Booker کو Sync token، Area یا server settings بار بار نہیں لکھنی چاہئیں۔ Online login کے بعد token خود ملتا ہے اور Area profile سے خود آتا ہے۔")\n    }\n\n    private fun queueSync'''
text, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
if n != 1: raise SystemExit('showSync replace failed')

# Back button and Android system Back share one target.
once('    private fun back(action: (() -> Unit)? = null) { button("← Back") { (action ?: { showDashboard() }).invoke() } }',
     '''    private fun back(action: (() -> Unit)? = null) {\n        val target: () -> Unit = action ?: { showDashboard() }\n        systemBackAction = target\n        button("← Back") { target.invoke() }\n    }''', 'back helper')

main_path.write_text(text, encoding='utf-8')

# Upgrade backup user profile payload so username/email/area survives file restore.
b = backup_path.read_text(encoding='utf-8')
b = b.replace('const val FORMAT_VERSION = 4', 'const val FORMAT_VERSION = 5', 1)
old = '''.put("id", u.id).put("name", u.name).put("username", u.username)\n                    .put("password_hash", u.passwordHash).put("role", u.role).put("active", u.active)\n                    .put("photo_backup", addMedia(u.photoUri, "user-${u.id}")))'''
new = '''.put("id", u.id).put("name", u.name).put("username", u.username).put("email", u.email)\n                    .put("password_hash", u.passwordHash).put("role", u.role).put("area_name", u.areaName)\n                    .put("active", u.active).put("sync_id", u.syncId).put("synced", u.synced).put("updated_at", u.updatedAt)\n                    .put("photo_backup", addMedia(u.photoUri, "user-${u.id}")))'''
if old not in b: raise SystemExit('backup user write anchor missing')
b = b.replace(old, new, 1)
old = '''id = j.optLong("id"), name = j.optString("name"), username = j.optString("username"),\n                passwordHash = j.optString("password_hash"), role = j.optString("role", "ORDER_BOOKER"),\n                photoUri = restoredMedia[j.optString("photo_backup")], active = j.optBoolean("active", true)'''
new = '''id = j.optLong("id"), name = j.optString("name"), username = j.optString("username"), email = j.optString("email"),\n                passwordHash = j.optString("password_hash"), role = j.optString("role", "ORDER_BOOKER"), areaName = j.optString("area_name"),\n                photoUri = restoredMedia[j.optString("photo_backup")], active = j.optBoolean("active", true),\n                syncId = j.optString("sync_id").ifBlank { "restored-user-${j.optLong(\"id\")}" }, synced = j.optBoolean("synced", false),\n                updatedAt = j.optLong("updated_at", System.currentTimeMillis())'''
if old not in b: raise SystemExit('backup user restore anchor missing')
b = b.replace(old, new, 1)
backup_path.write_text(b, encoding='utf-8')
print('V5 UI/navigation/login/backup patch applied')
