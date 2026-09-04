from pathlib import Path
import re

main_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/MainActivity.kt')
sync_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/sync/SyncWorker.kt')
server_path = Path('confectionery_sync_server/server.js')
schema_path = Path('confectionery_sync_server/schema.sql')

text = main_path.read_text(encoding='utf-8')

# Fixed company identity and location permission launcher.
anchor = '    private val prefs by lazy { AppPrefs(this) }\n'
if anchor not in text:
    raise SystemExit('prefs anchor missing')
text = text.replace(anchor, anchor + '    private val fixedCompanyId = AppPrefs.FIXED_COMPANY_ID\n', 1)

perm_anchor = '    private val bluetoothPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->\n        if (granted) showPrinterSettings() else toast("Bluetooth printer permission درکار ہے")\n    }\n'
if perm_anchor not in text:
    raise SystemExit('bluetooth permission anchor missing')
location_perm = perm_anchor + '''\n    private val locationPermission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->\n        val granted = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true || grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true\n        if (granted) startOnDutyLocationService() else toast("Location permission کے بغیر live Booker location share نہیں ہو سکتی")\n    }\n'''
text = text.replace(perm_anchor, location_perm, 1)

# Startup always uses fixed company; logged-out users see the signup/signin choice.
old = '''        when {\n            prefs.businessId.isBlank() -> showFirstStart()\n            !prefs.companyLoggedIn -> showCompanyLogin()\n            prefs.currentUserId == 0L -> showCompanyLogin()\n            else -> showDashboard()\n        }'''
new = '''        prefs.businessId = fixedCompanyId\n        when {\n            !prefs.companyLoggedIn || prefs.currentUserId == 0L -> showFirstStart()\n            else -> showDashboard()\n        }'''
if old not in text:
    raise SystemExit('startup when anchor missing')
text = text.replace(old, new, 1)

# First screen: fixed company + booker sign in/up + dedicated owner login.
pattern = r'    private fun showFirstStart\(\) \{.*?\n    \}\n\n    private fun showCreateBusiness'
replacement = '''    private fun showFirstStart() {\n        reset("Confectionery Order Book")\n        systemBackAction = { finish() }\n        info("Company ID: $fixedCompanyId\\n\\nہر Order Booker اپنی الگ ID بنائے گا۔ Catalog اور order booking offline چلتے رہیں گے۔")\n        button("Order Booker Sign In") { showCompanyLogin() }\n        button("New Order Booker — Sign Up") { showBookerSignUp() }\n        button("Owner Login") { showOwnerLogin() }\n        button("♻ Restore Full Backup File") { backupRestorer.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }\n    }\n\n    private fun showCreateBusiness'''
text, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('first screen replace failed')

# Public app no longer offers business creation; fixed company only.
pattern = r'    private fun showCreateBusiness\(\) \{.*?\n    \}\n\n    private fun showJoinBusiness'
replacement = '''    private fun showCreateBusiness() {\n        showFirstStart()\n    }\n\n    private fun showJoinBusiness'''
text, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('create business replace failed')

# Sign in only asks personal credentials; Company ID is locked.
pattern = r'    private fun showCompanyLogin\(\) \{.*?\n    \}\n\n    private fun showDashboard'
replacement = '''    private fun showCompanyLogin() {\n        reset("Order Booker Sign In")\n        back { showFirstStart() }\n        info("Company ID: $fixedCompanyId\\nاپنا Username یا Email اور Password درج کریں۔")\n        val login = edit("Username or Email")\n        val password = edit("Password", password = true)\n        button("Sign In") {\n            lifecycleScope.launch {\n                AuthClient.login(db, prefs, fixedCompanyId, txt(login), txt(password))\n                    .onSuccess { result ->\n                        if (result.user.role == "OWNER") {\n                            prefs.clearSession()\n                            toast("Owner account کے لیے Owner Login استعمال کریں")\n                            return@onSuccess\n                        }\n                        if (result.online) syncNow()\n                        toast(if (result.online) "Sign in successful — cloud profile loaded" else "Offline sign in successful")\n                        showDashboard()\n                    }\n                    .onFailure { e -> toast(e.message ?: "Sign in failed") }\n            }\n        }\n        button("Create New Order Booker ID") { showBookerSignUp() }\n        button("Owner Login") { showOwnerLogin() }\n        button("♻ Restore Backup File") { backupRestorer.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }\n    }\n\n    private fun showBookerSignUp() {\n        reset("Order Booker Sign Up")\n        back { showFirstStart() }\n        info("Company ID: $fixedCompanyId\\nیہ معلومات صرف پہلی دفعہ دیں۔ بعد میں Username/Email + Password سے login ہوگا۔")\n        val name = edit("Full Name")\n        val username = edit("Unique Username")\n        val email = edit("Email (optional)")\n        val password = edit("Password", password = true)\n        val area = edit("Area / Route")\n        button("Create My Account") {\n            lifecycleScope.launch {\n                AuthClient.signupBooker(db, prefs, fixedCompanyId, txt(name), txt(username), txt(email), txt(password), txt(area))\n                    .onSuccess { result ->\n                        toast(if (result.online) "Account created and connected" else "Account offline بن گیا — internet پر Sync & Share دبائیں")\n                        showDashboard()\n                    }\n                    .onFailure { e -> toast(e.message ?: "Sign up failed") }\n            }\n        }\n    }\n\n    private fun showOwnerLogin() {\n        reset("Owner Login")\n        back { showFirstStart() }\n        info("Company ID: $fixedCompanyId\\nیہ login صرف business Owner کے لیے ہے۔")\n        val login = edit("Owner Username or Email")\n        val password = edit("Owner Password", password = true)\n        button("Owner Sign In") {\n            lifecycleScope.launch {\n                AuthClient.login(db, prefs, fixedCompanyId, txt(login), txt(password))\n                    .onSuccess { result ->\n                        if (result.user.role != "OWNER") {\n                            prefs.clearSession()\n                            toast("یہ Owner account نہیں ہے")\n                        } else {\n                            if (result.online) syncNow()\n                            toast("Owner login successful")\n                            showDashboard()\n                        }\n                    }\n                    .onFailure { e -> toast(e.message ?: "Owner login failed") }\n            }\n        }\n    }\n\n    private fun showDashboard'''
text, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('login replace failed')

# Dashboard: explicit manual sync and role-specific location controls.
needle = '        button("☁ Online Sync / Restore") { showSync() }\n'
if needle not in text:
    raise SystemExit('dashboard sync button missing')
role_buttons = '''        button("🔄 Sync & Share Orders Now") { syncNow() }\n        if (prefs.currentUserRole == "OWNER") {\n            button("📍 Booker Locations") { showBookerLocations() }\n        } else {\n            button(if (prefs.locationSharingEnabled) "📍 On Duty Location: ON" else "📍 Start On Duty Location") { showLocationSharing() }\n        }\n'''
text = text.replace(needle, role_buttons + needle, 1)
text = text.replace('            showCompanyLogin()\n        }', '            showFirstStart()\n        }', 1)

# Add location UI before Settings.
anchor = '    private fun showSettings() {'
if anchor not in text:
    raise SystemExit('settings anchor missing')
location_funcs = '''    private fun hasLocationPermission(): Boolean =\n        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED ||\n            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED\n\n    private fun startOnDutyLocationService() {\n        if (prefs.currentUserRole == "OWNER") return\n        if (!hasLocationPermission()) {\n            locationPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))\n            return\n        }\n        val intent = Intent(this, BookerLocationService::class.java).setAction(BookerLocationService.ACTION_START)\n        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ContextCompat.startForegroundService(this, intent) else startService(intent)\n        prefs.locationSharingEnabled = true\n        toast("On Duty location sharing started")\n        showLocationSharing()\n    }\n\n    private fun stopOnDutyLocationService() {\n        startService(Intent(this, BookerLocationService::class.java).setAction(BookerLocationService.ACTION_STOP))\n        prefs.locationSharingEnabled = false\n        toast("Location sharing stopped")\n        showLocationSharing()\n    }\n\n    private fun showLocationSharing() {\n        reset("On Duty Location")\n        back()\n        val last = if (prefs.lastLocationAt > 0) SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(prefs.lastLocationAt)) else "No location yet"\n        info("Location sharing واضح طور پر ON کرنے پر ہی چلے گی۔ ON ہونے کے دوران Android notification مسلسل نظر آئے گی۔\\n\\nStatus: ${if (prefs.locationSharingEnabled) "ON" else "OFF"}\\nLast location: $last")\n        if (prefs.locationSharingEnabled) button("Stop Sharing Location") { stopOnDutyLocationService() }\n        else button("Start On Duty Location Sharing") { startOnDutyLocationService() }\n        info("Internet نہ ہو تو GPS location فون میں محفوظ رہتی ہے؛ server پر latest location internet دستیاب ہونے پر update ہوگی۔")\n    }\n\n    private fun showBookerLocations() {\n        if (prefs.currentUserRole != "OWNER") return showDashboard()\n        reset("Booker Locations")\n        back()\n        info("یہاں صرف ان Bookers کی latest shared location دکھتی ہے جنہوں نے On Duty Location Sharing فعال کی ہو۔")\n        button("Refresh Locations") { showBookerLocations() }\n        lifecycleScope.launch {\n            LocationClient.fetchBookerLocations(prefs)\n                .onSuccess { rows ->\n                    if (rows.isEmpty()) info("ابھی کوئی Booker location server پر موجود نہیں۔")\n                    rows.forEach { loc ->\n                        val whenText = if (loc.updatedAt > 0) SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(loc.updatedAt)) else "Unknown"\n                        info("${loc.name} • ${loc.username}\\nArea: ${loc.areaName}\\nLast update: $whenText\\nAccuracy: ${money(loc.accuracy)} m")\n                        button("Open ${loc.name} in Maps") {\n                            val geo = Uri.parse("geo:${loc.latitude},${loc.longitude}?q=${loc.latitude},${loc.longitude}(${Uri.encode(loc.name)})")\n                            runCatching { startActivity(Intent(Intent.ACTION_VIEW, geo)) }.onFailure { toast("Maps app available نہیں") }\n                        }\n                    }\n                }\n                .onFailure { e -> info("Locations load نہیں ہو سکیں: ${e.message ?: "Cloud connection required"}") }\n        }\n    }\n\n'''
text = text.replace(anchor, location_funcs + anchor, 1)

# Sync screen is manual and clear about offline behavior.
pattern = r'    private fun showSync\(\) \{.*?\n    \}\n\n    private fun queueSync'
replacement = '''    private fun showSync() {\n        reset("Sync & Share"); back()\n        val last = if (prefs.lastSyncAt > 0) SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(prefs.lastSyncAt)) else "Never"\n        info("Orders, catalog اور customer data offline استعمال ہوتے رہیں گے۔\\n\\nجب آپ Sync & Share دبائیں گے تو pending data internet کے ذریعے central business data میں جائے گا اور shared updates واپس فون میں آئیں گی۔\\nLast successful sync: $last")\n        button("🔄 Sync & Share Orders Now") { syncNow() }\n        if (prefs.currentUserRole == "OWNER") button("Cloud Sync Settings") { showServerSetup() }\n    }\n\n    private fun queueSync'''
text, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('sync screen replace failed')

# Normal saves stay offline; only explicit syncNow starts network exchange.
pattern = r'    private fun queueSync\(\) \{.*?\n    \}\n\n    private fun queueAutoBackup'
replacement = '''    private fun queueSync() {\n        queueAutoBackup()\n    }\n\n    private fun syncNow() {\n        if (prefs.syncBaseUrl.isBlank()) {\n            toast("Cloud server ابھی configure نہیں ہے — data فون میں محفوظ ہے")\n            return\n        }\n        val request = OneTimeWorkRequestBuilder<SyncWorker>()\n            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()\n        WorkManager.getInstance(this).enqueueUniqueWork("company-order-sync", ExistingWorkPolicy.REPLACE, request)\n        toast("Sync & Share queued")\n    }\n\n    private fun queueAutoBackup'''
text, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('queue sync replace failed')

main_path.write_text(text, encoding='utf-8')

# SyncWorker: a locally-created Booker account registers itself on first manual sync.
s = sync_path.read_text(encoding='utf-8')
old = '''        val prefs = AppPrefs(applicationContext)\n        if (prefs.syncBaseUrl.isBlank() || prefs.syncToken.isBlank() || prefs.businessId.isBlank()) return Result.success()\n        val db = (applicationContext as OrderBookApp).db'''
new = '''        val prefs = AppPrefs(applicationContext)\n        if (prefs.syncBaseUrl.isBlank() || prefs.businessId.isBlank()) return Result.success()\n        val db = (applicationContext as OrderBookApp).db\n        if (prefs.syncToken.isBlank()) {\n            val ready = AuthClient.ensureOnlineSession(db, prefs).getOrDefault(false)\n            if (!ready || prefs.syncToken.isBlank()) return Result.retry()\n        }'''
if old not in s:
    raise SystemExit('SyncWorker auth anchor missing')
s = s.replace(old, new, 1)
sync_path.write_text(s, encoding='utf-8')

# Server: fixed company bootstrap, Booker self-signup and transparent location endpoints.
server = server_path.read_text(encoding='utf-8')
if "FIXED_COMPANY_ID" not in server:
    server = server.replace("const DATABASE_SSL = String(process.env.DATABASE_SSL || 'true').toLowerCase() !== 'false';",
        "const DATABASE_SSL = String(process.env.DATABASE_SSL || 'true').toLowerCase() !== 'false';\\nconst FIXED_COMPANY_ID = String(process.env.FIXED_COMPANY_ID || 'Z37-405').trim();\\nconst FIXED_COMPANY_NAME = String(process.env.FIXED_COMPANY_NAME || 'Confectionery Order Book').trim();\\nconst OWNER_USERNAME = String(process.env.OWNER_USERNAME || '').trim();\\nconst OWNER_PASSWORD = String(process.env.OWNER_PASSWORD || '');\\nconst OWNER_NAME = String(process.env.OWNER_NAME || 'Owner').trim();\\nconst OWNER_AREA = String(process.env.OWNER_AREA || 'OWNER').trim();")

bootstrap_anchor = "function publicUser(row) {"
if "async function ensureFixedBusiness" not in server:
    bootstrap = '''async function ensureFixedBusiness() {\n  const client = await pool.connect();\n  try {\n    let business = await findBusinessById(client, FIXED_COMPANY_ID);\n    if (!business) {\n      const t = now();\n      const b = await client.query(\n        `INSERT INTO businesses(business_id,name,phone,address,created_at,updated_at) VALUES($1,$2,'','',$3,$3) RETURNING *`,\n        [FIXED_COMPANY_ID, FIXED_COMPANY_NAME, t]\n      );\n      business = b.rows[0];\n    }\n    if (OWNER_USERNAME && OWNER_PASSWORD) {\n      const existing = await findUserByLogin(client, business.id, OWNER_USERNAME);\n      if (!existing) {\n        const crypto = require('crypto');\n        const clientHash = crypto.createHash('sha256').update(OWNER_PASSWORD).digest('hex');\n        const credentialHash = await bcrypt.hash(clientHash, 12);\n        await client.query(\n          `INSERT INTO users(business_pk,sync_id,name,username,email,credential_hash,role,area_name,active,updated_at)\n           VALUES($1,$2,$3,$4,'',$5,'OWNER',$6,TRUE,$7)`,\n          [business.id, crypto.randomUUID(), OWNER_NAME, OWNER_USERNAME, credentialHash, OWNER_AREA, now()]\n        );\n      }\n    }\n  } finally { client.release(); }\n}\n\n'''
    server = server.replace(bootstrap_anchor, bootstrap + bootstrap_anchor, 1)

login_anchor = "app.post('/api/auth/login', async (req, res) => {"
if "app.post('/api/auth/signup'" not in server:
    signup = '''app.post('/api/auth/signup', async (req, res) => {\n  const businessId = clean(req.body.business_id);\n  const raw = req.body.user || {};\n  const name = clean(raw.name);\n  const username = clean(raw.username);\n  const email = clean(raw.email);\n  const passwordHash = clean(raw.password_hash);\n  const areaName = clean(raw.area_name);\n  const requestedSyncId = clean(raw.sync_id);\n  if (businessId.toLowerCase() !== FIXED_COMPANY_ID.toLowerCase() || !name || !username || passwordHash.length < 32 || !areaName) {\n    return res.status(400).json({ error: 'invalid signup request' });\n  }\n  const client = await pool.connect();\n  try {\n    const business = await findBusinessById(client, FIXED_COMPANY_ID);\n    if (!business) return res.status(503).json({ error: 'business unavailable' });\n    const existingByLogin = await findUserByLogin(client, business.id, username);\n    if (existingByLogin) {\n      if (existingByLogin.role === 'ORDER_BOOKER' && await bcrypt.compare(passwordHash, existingByLogin.credential_hash)) {\n        return res.json({ token: tokenFor(business, existingByLogin), business: publicBusiness(business), user: publicUser(existingByLogin) });\n      }\n      return res.status(409).json({ error: 'username already exists' });\n    }\n    if (email) {\n      const e = await findUserByLogin(client, business.id, email);\n      if (e) return res.status(409).json({ error: 'email already exists' });\n    }\n    const credentialHash = await bcrypt.hash(passwordHash, 12);\n    const syncId = requestedSyncId || require('crypto').randomUUID();\n    const t = now();\n    const q = await client.query(\n      `INSERT INTO users(business_pk,sync_id,name,username,email,credential_hash,role,area_name,active,updated_at)\n       VALUES($1,$2,$3,$4,$5,$6,'ORDER_BOOKER',$7,TRUE,$8) RETURNING *`,\n      [business.id, syncId, name, username, email, credentialHash, areaName, t]\n    );\n    const user = q.rows[0];\n    res.status(201).json({ token: tokenFor(business, user), business: publicBusiness(business), user: publicUser(user) });\n  } catch (e) {\n    console.error(e);\n    res.status(500).json({ error: 'signup failed' });\n  } finally { client.release(); }\n});\n\n'''
    server = server.replace(login_anchor, signup + login_anchor, 1)

error_anchor = "app.use((err, _req, res, _next) => {"
if "app.post('/api/location/update'" not in server:
    location_api = '''app.post('/api/location/update', auth, async (req, res) => {\n  const businessPk = Number(req.auth.business_pk);\n  const userSyncId = clean(req.auth.user_sync_id);\n  const lat = Number(req.body.latitude);\n  const lon = Number(req.body.longitude);\n  const accuracy = Number(req.body.accuracy || 0);\n  if (!businessPk || !userSyncId || !Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'invalid location' });\n  try {\n    await pool.query(\n      `INSERT INTO booker_locations(business_pk,user_sync_id,device_id,latitude,longitude,accuracy,area_name,source,updated_at)\n       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)\n       ON CONFLICT (business_pk,user_sync_id) DO UPDATE SET device_id=EXCLUDED.device_id,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,accuracy=EXCLUDED.accuracy,area_name=EXCLUDED.area_name,source=EXCLUDED.source,updated_at=EXCLUDED.updated_at`,\n      [businessPk, userSyncId, clean(req.body.device_id), lat, lon, accuracy, clean(req.body.area_name), clean(req.body.source), now()]\n    );\n    res.json({ ok: true });\n  } catch (e) { console.error(e); res.status(500).json({ error: 'location update failed' }); }\n});\n\napp.get('/api/location/bookers', auth, async (req, res) => {\n  if (req.auth.role !== 'OWNER') return res.status(403).json({ error: 'owner only' });\n  try {\n    const q = await pool.query(\n      `SELECT u.name,u.username,u.area_name,l.device_id,l.latitude,l.longitude,l.accuracy,l.updated_at\n       FROM users u JOIN booker_locations l ON l.business_pk=u.business_pk AND l.user_sync_id=u.sync_id\n       WHERE u.business_pk=$1 AND u.role='ORDER_BOOKER' AND u.active=TRUE\n       ORDER BY l.updated_at DESC`,\n      [Number(req.auth.business_pk)]\n    );\n    res.json({ locations: q.rows.map(r => ({ ...r, latitude:Number(r.latitude), longitude:Number(r.longitude), accuracy:Number(r.accuracy), updated_at:Number(r.updated_at) })) });\n  } catch (e) { console.error(e); res.status(500).json({ error: 'location list failed' }); }\n});\n\n'''
    server = server.replace(error_anchor, location_api + error_anchor, 1)

server = server.replace("initDb()\n  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`sync server listening on ${PORT}`)))",
                        "initDb()\n  .then(() => ensureFixedBusiness())\n  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`sync server listening on ${PORT}`)))")
server_path.write_text(server, encoding='utf-8')

schema = schema_path.read_text(encoding='utf-8')
if 'CREATE TABLE IF NOT EXISTS booker_locations' not in schema:
    schema += '''\nCREATE TABLE IF NOT EXISTS booker_locations (\n    business_pk BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,\n    user_sync_id TEXT NOT NULL,\n    device_id TEXT NOT NULL DEFAULT '',\n    latitude DOUBLE PRECISION NOT NULL,\n    longitude DOUBLE PRECISION NOT NULL,\n    accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,\n    area_name TEXT NOT NULL DEFAULT '',\n    source TEXT NOT NULL DEFAULT '',\n    updated_at BIGINT NOT NULL,\n    PRIMARY KEY (business_pk, user_sync_id)\n);\nCREATE INDEX IF NOT EXISTS booker_locations_business_updated ON booker_locations (business_pk, updated_at DESC);\n'''
schema_path.write_text(schema, encoding='utf-8')

print('V9 signup, manual sync and transparent Booker location patch applied')
