from pathlib import Path
import re

main_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/MainActivity.kt')
auth_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/sync/AuthClient.kt')
server_path = Path('confectionery_sync_server/server.js')

text = main_path.read_text(encoding='utf-8')

# Replace the complete V9 auth block with fixed-company sign-in/sign-up for both Booker and Owner.
pattern = r'    private fun showCompanyLogin\(\) \{.*?\n    private fun showDashboard'
replacement = '''    private fun lockedCompanyField(): EditText = edit("Company ID (Locked)").apply {\n        setText(fixedCompanyId)\n        isEnabled = false\n        isFocusable = false\n    }\n\n    private fun showCompanyLogin() {\n        reset("Order Booker Sign In")\n        back { showFirstStart() }\n        lockedCompanyField()\n        info("اپنا Username یا Email اور Password درج کریں۔")\n        val login = edit("Username or Email")\n        val password = edit("Password", password = true)\n        button("Sign In") {\n            lifecycleScope.launch {\n                AuthClient.login(db, prefs, fixedCompanyId, txt(login), txt(password))\n                    .onSuccess { result ->\n                        if (result.user.role == "OWNER") {\n                            prefs.clearSession()\n                            toast("Owner account کے لیے Owner Sign In استعمال کریں")\n                            return@onSuccess\n                        }\n                        if (result.online) syncNow()\n                        toast(if (result.online) "Sign in successful — cloud profile loaded" else "Offline sign in successful")\n                        showDashboard()\n                    }\n                    .onFailure { e -> toast(e.message ?: "Sign in failed") }\n            }\n        }\n        button("New Order Booker — Sign Up") { showBookerSignUp() }\n        button("Owner Sign In") { showOwnerLogin() }\n        button("Owner Sign Up") { showOwnerSignUp() }\n        button("♻ Restore Backup File") { backupRestorer.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }\n    }\n\n    private fun showBookerSignUp() {\n        reset("Order Booker Sign Up")\n        back { showFirstStart() }\n        lockedCompanyField()\n        info("Company ID ہر user کے لیے یہی رہے گی۔ یہ معلومات صرف پہلی دفعہ دیں۔")\n        val name = edit("Full Name")\n        val username = edit("Unique Username")\n        val email = edit("Email (optional)")\n        val password = edit("Password", password = true)\n        val confirm = edit("Confirm Password", password = true)\n        val area = edit("Area / Route")\n        button("Create Order Booker Account") {\n            if (txt(password) != txt(confirm)) return@button toast("Password اور Confirm Password ایک جیسے نہیں ہیں")\n            lifecycleScope.launch {\n                AuthClient.signupBooker(db, prefs, fixedCompanyId, txt(name), txt(username), txt(email), txt(password), txt(area))\n                    .onSuccess { result ->\n                        toast(if (result.online) "Order Booker account created" else "Account offline بن گیا — internet پر Sync & Share دبائیں")\n                        showDashboard()\n                    }\n                    .onFailure { e -> toast(e.message ?: "Sign up failed") }\n            }\n        }\n        button("Already have an account — Sign In") { showCompanyLogin() }\n    }\n\n    private fun showOwnerSignUp() {\n        reset("Owner Sign Up")\n        back { showFirstStart() }\n        lockedCompanyField()\n        info("یہ screen صرف business Owner کی پہلی account setup کے لیے ہے۔")\n        val businessName = edit("Business Name").apply { setText(prefs.businessName.ifBlank { "Confectionery Order Book" }) }\n        val ownerName = edit("Owner Full Name")\n        val username = edit("Owner Username")\n        val email = edit("Owner Email (optional)")\n        val password = edit("Password", password = true)\n        val confirm = edit("Confirm Password", password = true)\n        val phone = edit("Business Phone (optional)")\n        val address = edit("Business Address (optional)")\n        val area = edit("Owner Area / Route (optional)")\n        val pin = edit("Purchase Rate Privacy PIN (4+ digits)", numeric = true, password = true)\n        button("Create Owner Account") {\n            if (txt(ownerName).isBlank() || txt(username).isBlank()) return@button toast("Owner name اور username ضروری ہیں")\n            if (txt(password).length < 4 || txt(password) != txt(confirm)) return@button toast("Password کم از کم 4 characters اور دونوں جگہ ایک جیسا ہونا چاہیے")\n            if (txt(pin).length < 4) return@button toast("Purchase Rate privacy PIN کم از کم 4 digits رکھیں")\n            lifecycleScope.launch {\n                AuthClient.registerBusiness(\n                    db, prefs, txt(businessName).ifBlank { "Confectionery Order Book" }, fixedCompanyId,\n                    txt(ownerName), txt(username), txt(email), txt(password), txt(area).ifBlank { "OWNER" }, txt(phone), txt(address)\n                ).onSuccess { result ->\n                    prefs.privacyPinHash = Security.sha256(txt(pin))\n                    prefs.purchaseRatesUnlocked = false\n                    toast(if (result.online) "Owner account created and connected" else "Owner account created offline")\n                    showDashboard()\n                }.onFailure { e -> toast(e.message ?: "Owner sign up failed") }\n            }\n        }\n        button("Already Owner — Sign In") { showOwnerLogin() }\n    }\n\n    private fun showOwnerLogin() {\n        reset("Owner Sign In")\n        back { showFirstStart() }\n        lockedCompanyField()\n        info("اپنا Owner Username/Email اور Password درج کریں۔")\n        val login = edit("Owner Username or Email")\n        val password = edit("Owner Password", password = true)\n        button("Owner Sign In") {\n            lifecycleScope.launch {\n                AuthClient.login(db, prefs, fixedCompanyId, txt(login), txt(password))\n                    .onSuccess { result ->\n                        if (result.user.role != "OWNER") {\n                            prefs.clearSession()\n                            toast("یہ Owner account نہیں ہے")\n                        } else {\n                            if (result.online) syncNow()\n                            toast("Owner sign in successful")\n                            showDashboard()\n                        }\n                    }\n                    .onFailure { e -> toast(e.message ?: "Owner sign in failed") }\n            }\n        }\n        button("First time Owner — Sign Up") { showOwnerSignUp() }\n    }\n\n    private fun showDashboard'''
text, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('V10 auth block replace failed')

# First screen clearly exposes both signup paths and the fixed Company ID.
pattern = r'    private fun showFirstStart\(\) \{.*?\n    \}\n\n    private fun showCreateBusiness'
replacement = '''    private fun showFirstStart() {\n        reset("Confectionery Order Book")\n        systemBackAction = { finish() }\n        info("Company ID (Locked): $fixedCompanyId\\n\\nہر Order Booker اپنی الگ ID رکھے گا، اور Owner کی الگ محفوظ ID ہوگی۔ Catalog اور order booking offline چلتے رہیں گے۔")\n        button("Order Booker Sign In") { showCompanyLogin() }\n        button("Order Booker Sign Up") { showBookerSignUp() }\n        button("Owner Sign In") { showOwnerLogin() }\n        button("Owner Sign Up") { showOwnerSignUp() }\n        button("♻ Restore Full Backup File") { backupRestorer.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }\n    }\n\n    private fun showCreateBusiness'''
text, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('V10 first screen replace failed')

# Always enforce owner-only cost visibility, never merely PIN-unlocked for a Booker.
text = text.replace('if (prefs.purchaseRatesUnlocked)', 'if (prefs.currentUserRole == "OWNER" && prefs.purchaseRatesUnlocked)')

# Only Owner can add/edit cost-bearing product setup.
text = text.replace('            button("+ Add Product") { showAddProduct() }', '            if (prefs.currentUserRole == "OWNER") button("+ Add Product") { showAddProduct() }')
text = text.replace('    private fun showAddProduct() {\n        reset("Add Item")', '    private fun showAddProduct() {\n        if (prefs.currentUserRole != "OWNER") { toast("Product setup صرف Owner کر سکتا ہے"); return showProducts() }\n        reset("Add Item")', 1)

# Owner-only purchase rate controls in Settings.
old = '''        button(if (prefs.currentUserRole == "OWNER" && prefs.purchaseRatesUnlocked) "Hide Purchase Rates" else "Unlock Purchase Rates") {\n            if (prefs.currentUserRole == "OWNER" && prefs.purchaseRatesUnlocked) { prefs.purchaseRatesUnlocked = false; showSettings() } else showPinDialog()\n        }'''
if old in text:
    new = '''        if (prefs.currentUserRole == "OWNER") {\n            button(if (prefs.purchaseRatesUnlocked) "Hide Purchase Rates" else "Unlock Purchase Rates") {\n                if (prefs.purchaseRatesUnlocked) { prefs.purchaseRatesUnlocked = false; showSettings() } else showPinDialog()\n            }\n        } else {\n            info("Purchase Rate: Owner Only • Order Booker کو صرف دکاندار اور Super Wholesale rates نظر آئیں گے۔")\n        }'''
    text = text.replace(old, new, 1)
else:
    # fallback for source where the global condition replacement did not touch the button expression
    old2 = '''        button(if (prefs.purchaseRatesUnlocked) "Hide Purchase Rates" else "Unlock Purchase Rates") {\n            if (prefs.purchaseRatesUnlocked) { prefs.purchaseRatesUnlocked = false; showSettings() } else showPinDialog()\n        }'''
    if old2 not in text:
        raise SystemExit('purchase settings control anchor missing')
    text = text.replace(old2, '''        if (prefs.currentUserRole == "OWNER") {\n            button(if (prefs.purchaseRatesUnlocked) "Hide Purchase Rates" else "Unlock Purchase Rates") {\n                if (prefs.purchaseRatesUnlocked) { prefs.purchaseRatesUnlocked = false; showSettings() } else showPinDialog()\n            }\n        } else {\n            info("Purchase Rate: Owner Only • Order Booker کو صرف دکاندار اور Super Wholesale rates نظر آئیں گے۔")\n        }''', 1)

# Harden the PIN dialog itself.
text = text.replace('    private fun showPinDialog() {\n        val input = EditText(this)', '    private fun showPinDialog() {\n        if (prefs.currentUserRole != "OWNER") { toast("Purchase Rate صرف Owner کے لیے ہے"); return }\n        val input = EditText(this)', 1)

# Friendly rate labels for Booker/Owner item detail views.
text = text.replace('Retail ${money(u.retailRate)} • Wholesale ${money(u.wholesaleRate)} • Super Wholesale ${money(u.superWholesaleRate)}', 'Retail ${money(u.retailRate)} • دکاندار ${money(u.wholesaleRate.takeIf { it > 0 } ?: u.retailRate)} • Super Wholesale ${money(u.superWholesaleRate)}')
text = text.replace('Sale: Rs ${money(p.saleRate)}', 'دکاندار Rate: Rs ${money(p.wholesaleRate.takeIf { it > 0 } ?: p.saleRate)}')

# Non-owner report centre must not expose cost/profit values that reveal purchase rates.
marker = '    private fun showReports() {'
if marker not in text:
    raise SystemExit('reports marker missing')
text = text.replace(marker, '''    private fun showBookerSafeReports() {\n        reset("Sales & Stock Reports")\n        back()\n        info("Purchase Cost اور Profit reports صرف Owner کے لیے ہیں۔")\n        button("Sale Report") { showReport("SALE") }\n        button("Day Book") { showReport("DAYBOOK") }\n        button("All Transactions") { showReport("ALL_TX") }\n        button("Party Statement") { showReport("PARTY_STATEMENT") }\n        button("All Parties Report") { showReport("ALL_PARTIES") }\n        button("Sale by Party") { showReport("SALE_BY_PARTY") }\n        button("Low Stock Summary") { showReport("LOW_STOCK") }\n        button("Item Detail Report") { showReport("ITEM_DETAIL") }\n        button("Stock Detail Report") { showReport("STOCK_DETAIL") }\n        button("Sale by Item Category") { showReport("CATEGORY_SALES") }\n    }\n\n    private fun showReports() {\n        if (prefs.currentUserRole != "OWNER") return showBookerSafeReports()''', 1)

# Default in-app brand mark when the owner has not uploaded a business logo yet.
old_logo = '''        if (prefs.businessLogoUri.isNotBlank()) {\n            header.addView(image(prefs.businessLogoUri, 58), LinearLayout.LayoutParams(dp(58), dp(58)).apply { marginEnd = dp(10) })\n        }'''
if old_logo in text:
    text = text.replace(old_logo, '''        if (prefs.businessLogoUri.isNotBlank()) {\n            header.addView(image(prefs.businessLogoUri, 58), LinearLayout.LayoutParams(dp(58), dp(58)).apply { marginEnd = dp(10) })\n        } else {\n            header.addView(ImageView(this).apply { setImageResource(R.drawable.ic_orderbook_logo); scaleType = ImageView.ScaleType.FIT_CENTER },\n                LinearLayout.LayoutParams(dp(58), dp(58)).apply { marginEnd = dp(10) })\n        }''', 1)

main_path.write_text(text, encoding='utf-8')

# Auth: fixed company is mandatory for every login/signup, including Owner signup.
auth = auth_path.read_text(encoding='utf-8')
auth = auth.replace('require(businessName.isNotBlank() && cleanCompany.isNotBlank()) { "Business name and Company ID required" }',
                    'require(cleanCompany.equals(AppPrefs.FIXED_COMPANY_ID, ignoreCase = true)) { "Invalid Company ID" }\n            require(businessName.isNotBlank()) { "Business name required" }', 1)
auth = auth.replace('require(cleanCompany.isNotBlank()) { "Company ID required" }',
                    'require(cleanCompany.equals(AppPrefs.FIXED_COMPANY_ID, ignoreCase = true)) { "Invalid Company ID" }', 1)
auth_path.write_text(auth, encoding='utf-8')

# Server generated by V9 must use the corrected fixed company ID.
server = server_path.read_text(encoding='utf-8').replace("'Z37-405'", "'ZEE37405'").replace('"Z37-405"', '"ZEE37405"')
server_path.write_text(server, encoding='utf-8')

print('V10 owner signup, fixed company ID, rate privacy and branding patch applied')
