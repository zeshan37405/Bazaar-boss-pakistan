package com.example.confectionery

import android.Manifest
import android.app.Dialog
import android.content.Intent
import android.content.res.ColorStateList
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.view.Window
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.viewpager2.widget.ViewPager2
import androidx.work.*
import com.example.confectionery.backup.AutoBackupWorker
import com.example.confectionery.data.*
import com.example.confectionery.sync.SyncWorker
import com.example.confectionery.util.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {
    private val db by lazy { (application as OrderBookApp).db }
    private val prefs by lazy { AppPrefs(this) }
    private lateinit var root: LinearLayout
    private var photoCallback: ((Uri) -> Unit)? = null
    private val catalogSelected = linkedMapOf<Long, Int>()

    private data class CartLine(
        val product: ProductEntity,
        val unitPrice: ProductUnitPriceEntity,
        val qty: Double,
        val rate: Double,
        val tier: String,
        val tax: Double
    )

    private val unitSuggestions = listOf(
        "PIECE", "BOX", "CARTON", "DOZEN", "PACKET", "BOTTLE", "LITRE", "ML", "KG", "GRAM"
    )

    private val photoPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri ?: return@registerForActivityResult
        photoCallback?.invoke(uri)
        photoCallback = null
    }

    private val manualBackupCreator = registerForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri: Uri? ->
        uri ?: return@registerForActivityResult
        lifecycleScope.launch {
            runCatching { BackupManager.writeBackup(this@MainActivity, db, prefs, uri) }
                .onSuccess { s -> toast("Backup محفوظ: ${s.products} items, ${s.orders} orders"); showBackup() }
                .onFailure { toast("Backup failed: ${it.message ?: "Unknown error"}") }
        }
    }

    private val autoBackupCreator = registerForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri: Uri? ->
        uri ?: return@registerForActivityResult
        runCatching {
            contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
        }
        prefs.autoBackupUri = uri.toString()
        prefs.autoBackupEnabled = true
        lifecycleScope.launch {
            runCatching { BackupManager.writeBackup(this@MainActivity, db, prefs, uri) }
                .onSuccess { toast("Auto Backup فعال ہوگیا"); showBackup() }
                .onFailure { toast("Auto Backup file نہیں لکھی جا سکی: ${it.message ?: "Error"}") }
        }
    }

    private val backupRestorer = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri ?: return@registerForActivityResult
        AlertDialog.Builder(this)
            .setTitle("Restore Full Backup")
            .setMessage("موجودہ local data backup کے data سے replace ہوگا۔ جاری رکھیں؟")
            .setPositiveButton("Restore") { _, _ ->
                lifecycleScope.launch {
                    runCatching { BackupManager.restoreBackup(this@MainActivity, db, prefs, uri) }
                        .onSuccess { s ->
                            toast("Restore مکمل: ${s.products} items, ${s.orders} orders")
                            showCompanyLogin()
                        }
                        .onFailure { toast("Restore failed: ${it.message ?: "Invalid backup"}") }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private val bluetoothPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) showPrinterSettings() else toast("Bluetooth printer permission درکار ہے")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(14), dp(14), dp(28))
            setBackgroundColor(ContextCompat.getColor(this@MainActivity, R.color.surface))
        }
        setContentView(ScrollView(this).apply { addView(root) })
        when {
            prefs.businessId.isBlank() -> showFirstStart()
            !prefs.companyLoggedIn -> showCompanyLogin()
            prefs.deviceBookerName.isBlank() || prefs.deviceAreaName.isBlank() -> showDeviceProfile()
            else -> showDashboard()
        }
    }

    private fun reset(title: String) {
        root.removeAllViews()
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(12))
        }
        if (prefs.businessLogoUri.isNotBlank()) {
            header.addView(image(prefs.businessLogoUri, 58), LinearLayout.LayoutParams(dp(58), dp(58)).apply { marginEnd = dp(10) })
        }
        header.addView(TextView(this).apply {
            text = title
            textSize = 24f
            setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_primary))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        root.addView(header)
    }

    private fun showFirstStart() {
        reset("Confectionery Order Book")
        info("Offline-first order booking. ایک Company ID کے تحت shared items/customers، جبکہ ہر Booker اور Area کے orders الگ رہیں گے۔")
        button("♻ Restore Full Backup File") { backupRestorer.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }
        button("Create New Business") { showCreateBusiness() }
        button("Join Existing Business / Cloud Restore") { showJoinBusiness() }
    }

    private fun showCreateBusiness() {
        reset("Create Business")
        back { showFirstStart() }
        val businessName = edit("Business / Company name")
        val businessId = edit("Company ID (same on all phones)")
        val password = edit("Company password", password = true)
        val phone = edit("Business phone")
        val address = edit("Business address")
        val booker = edit("This device: Owner / Booker name")
        val area = edit("This device: Area / Route")
        val pin = edit("Purchase Rate privacy PIN", numeric = true, password = true)
        button("Create & Open") {
            if (txt(businessName).isBlank() || txt(businessId).isBlank() || txt(password).length < 4 || txt(booker).isBlank() || txt(area).isBlank() || txt(pin).length < 4) {
                return@button toast("ضروری معلومات مکمل درج کریں")
            }
            lifecycleScope.launch {
                prefs.businessName = txt(businessName)
                prefs.businessId = txt(businessId)
                prefs.businessPasswordHash = Security.sha256(txt(password))
                prefs.businessPhone = txt(phone)
                prefs.businessAddress = txt(address)
                prefs.deviceBookerName = txt(booker)
                prefs.deviceAreaName = txt(area)
                prefs.privacyPinHash = Security.sha256(txt(pin))
                prefs.companyLoggedIn = true
                if (prefs.currentUserId == 0L) {
                    prefs.currentUserId = db.userDao().insert(UserEntity(
                        name = txt(booker), username = "owner-${prefs.deviceId.take(8)}",
                        passwordHash = prefs.businessPasswordHash, role = "OWNER"
                    ))
                }
                queueSync()
                showDashboard()
            }
        }
    }

    private fun showJoinBusiness() {
        reset("Join Existing Business / Cloud Restore")
        back { showFirstStart() }
        info("Company ID + password سے business join کریں۔ Cloud restore کے لیے وہی Sync Server URL اور token استعمال ہوں گے۔ Full file backup ہو تو پچھلی screen سے Restore کریں۔")
        val businessId = edit("Company ID")
        val password = edit("Company password", password = true)
        val syncUrl = edit("HTTPS Sync Server URL")
        val token = edit("Sync token", password = true)
        val booker = edit("Order Booker name")
        val area = edit("Area / Route")
        button("Join & Restore") {
            if (txt(businessId).isBlank() || txt(password).length < 4 || txt(booker).isBlank() || txt(area).isBlank()) {
                return@button toast("Company ID, password, Booker اور Area ضروری ہیں")
            }
            lifecycleScope.launch {
                prefs.businessId = txt(businessId)
                prefs.businessName = txt(businessId)
                prefs.businessPasswordHash = Security.sha256(txt(password))
                prefs.syncBaseUrl = txt(syncUrl)
                prefs.syncToken = txt(token)
                prefs.deviceBookerName = txt(booker)
                prefs.deviceAreaName = txt(area)
                prefs.companyLoggedIn = true
                if (prefs.currentUserId == 0L) {
                    prefs.currentUserId = db.userDao().insert(UserEntity(
                        name = txt(booker), username = "booker-${prefs.deviceId.take(8)}",
                        passwordHash = prefs.businessPasswordHash, role = "ORDER_BOOKER"
                    ))
                }
                queueSync()
                showDashboard()
            }
        }
    }

    private fun showCompanyLogin() {
        reset("Company Sign in")
        val id = edit("Company ID"); id.setText(prefs.businessId)
        val password = edit("Company password", password = true)
        button("Sign in") {
            if (txt(id) != prefs.businessId || Security.sha256(txt(password)) != prefs.businessPasswordHash) return@button toast("Company ID یا password غلط ہے")
            prefs.companyLoggedIn = true
            prefs.purchaseRatesUnlocked = false
            if (prefs.deviceBookerName.isBlank() || prefs.deviceAreaName.isBlank()) showDeviceProfile() else showDashboard()
        }
        button("♻ Restore Backup File") { backupRestorer.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }
    }

    private fun showDashboard() {
        reset(prefs.businessName.ifBlank { "Confectionery Order Book" })
        info("Company: ${prefs.businessId}\nBooker: ${prefs.deviceBookerName} • Area: ${prefs.deviceAreaName}")
        button("🖼 Customer Catalog — Offline") { showCatalog() }
        button("🛒 New Order Booking") { showNewOrder() }
        button("📍 Area-wise Billing") { showAreaBilling() }
        button("👥 Customers / Parties") { showCustomers() }
        button("📦 Products / Inventory") { showProducts() }
        button("🧾 Orders / Invoices") { showOrders() }
        button("📊 Reports & Profit") { showReports() }
        button("💸 Expenses") { showExpenses() }
        button("🖨 Printer / Thermal Printer") { showPrinterSettings() }
        button("💾 Backup & Restore") { showBackup() }
        button("☁ Online Sync / Restore") { showSync() }
        button("⚙ Settings & Privacy") { showSettings() }
        button("Sign out") {
            prefs.companyLoggedIn = false
            prefs.purchaseRatesUnlocked = false
            showCompanyLogin()
        }
    }

    private fun showDeviceProfile() {
        reset("This Device Profile")
        info("Company login مشترک ہے، مگر یہ Booker/Area اس فون کے orders پر tag ہوگا۔")
        val booker = edit("Order Booker name"); booker.setText(prefs.deviceBookerName)
        val area = edit("Area / Route"); area.setText(prefs.deviceAreaName)
        button("Save Device Profile") {
            if (txt(booker).isBlank() || txt(area).isBlank()) return@button toast("Booker اور Area ضروری ہیں")
            lifecycleScope.launch {
                prefs.deviceBookerName = txt(booker)
                prefs.deviceAreaName = txt(area)
                if (prefs.currentUserId == 0L) {
                    prefs.currentUserId = db.userDao().insert(UserEntity(
                        name = txt(booker), username = "booker-${prefs.deviceId.take(8)}",
                        passwordHash = prefs.businessPasswordHash, role = "ORDER_BOOKER"
                    ))
                }
                queueAutoBackup()
                showDashboard()
            }
        }
    }

    private fun showCatalog(category: String? = null) {
        reset("Customer Catalog — Offline")
        back()
        lifecycleScope.launch {
            val all = db.productDao().all()
            if (all.isEmpty()) return@launch info("Catalog خالی ہے۔ پہلے Products میں items اور تصاویر شامل کریں۔")
            val categories = listOf("ALL") + db.productDao().categories()
            val catSpinner = spinner("Category", categories)
            category?.let { wanted -> categories.indexOf(wanted).takeIf { it >= 0 }?.let(catSpinner::setSelection) }
            button("Open Category") { showCatalog(categories[catSpinner.selectedItemPosition].takeUnless { it == "ALL" }) }
            info("تصویر پر tap کریں → بڑی gallery کھلے گی۔ بڑی تصویر یا Add to Order دبانے سے item order cart میں شامل ہوگا۔ Internet ضروری نہیں۔")
            if (catalogSelected.isNotEmpty()) button("Open Order Cart (${catalogSelected.values.sum()})") { showNewOrder() }
            val products = if (category.isNullOrBlank()) all else all.filter { it.category == category }
            val grid = GridLayout(this@MainActivity).apply {
                columnCount = 2
                alignmentMode = GridLayout.ALIGN_BOUNDS
                useDefaultMargins = true
            }
            products.forEachIndexed { index, p ->
                val card = LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER_HORIZONTAL
                    setPadding(dp(6), dp(8), dp(6), dp(8))
                    setBackgroundColor(0xFFFFFFFF.toInt())
                }
                val pic = image(p.photoUri, 145).apply { setOnClickListener { openCatalogViewer(products, index) } }
                card.addView(pic)
                card.addView(TextView(this@MainActivity).apply {
                    text = p.name
                    textSize = 16f
                    gravity = Gravity.CENTER
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                })
                card.addView(TextView(this@MainActivity).apply {
                    text = "Rs ${money(p.saleRate)}"
                    textSize = 14f
                    gravity = Gravity.CENTER
                })
                val add = Button(this@MainActivity).apply {
                    text = "+ Order"
                    isAllCaps = false
                    setOnClickListener { addCatalogProduct(p) }
                }
                card.addView(add, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
                grid.addView(card, GridLayout.LayoutParams().apply {
                    width = 0
                    height = GridLayout.LayoutParams.WRAP_CONTENT
                    columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                    setMargins(dp(4), dp(4), dp(4), dp(4))
                })
            }
            root.addView(grid, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }
    }

    private fun openCatalogViewer(products: List<ProductEntity>, start: Int) {
        val dialog = Dialog(this, android.R.style.Theme_Material_Light_NoActionBar_Fullscreen)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(8), dp(8), dp(8), dp(8)) }
        val pager = ViewPager2(this).apply {
            adapter = CatalogPagerAdapter(products) { addCatalogProduct(it) }
            setCurrentItem(start, false)
        }
        box.addView(pager, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(Button(this).apply { text = "Close"; isAllCaps = false; setOnClickListener { dialog.dismiss() } }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        row.addView(Button(this).apply { text = "Order Cart"; isAllCaps = false; setOnClickListener { dialog.dismiss(); showNewOrder() } }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        box.addView(row)
        dialog.setContentView(box)
        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    }

    private fun addCatalogProduct(p: ProductEntity) {
        catalogSelected[p.id] = (catalogSelected[p.id] ?: 0) + 1
        toast("${p.name} order میں شامل ہوگیا")
    }

    private fun showCustomers() {
        reset("Customers / Parties")
        back()
        button("+ Add Customer") { showAddCustomer() }
        lifecycleScope.launch {
            val customers = db.customerDao().all()
            if (customers.isEmpty()) info("ابھی کوئی customer موجود نہیں۔")
            customers.forEach { c ->
                val row = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(8), 0, dp(8)) }
                row.addView(image(c.photoUri, 90))
                row.addView(TextView(this@MainActivity).apply {
                    text = "${c.name}\n${c.shopName}\nArea: ${c.areaName}\n${c.phone}\nBalance: Rs ${money(c.balance)}"
                    textSize = 16f; setPadding(dp(12), 0, 0, 0)
                })
                root.addView(row)
            }
        }
    }

    private fun showAddCustomer() {
        reset("Add Customer")
        back { showCustomers() }
        var photoUri: String? = null
        val photo = image(null, 180); root.addView(photo)
        button("Choose clear customer photo") {
            photoCallback = { uri ->
                runCatching { ImageStore.importImage(this, uri, "customer") }.onSuccess { stored -> photoUri = stored; photo.setImageURI(Uri.parse(stored)) }.onFailure { toast("Image save failed") }
            }
            photoPicker.launch(arrayOf("image/*"))
        }
        val name = edit("Customer name")
        val shop = edit("Shop / Business name")
        val phone = edit("Phone")
        val address = edit("Address")
        val area = edit("Area / Route"); area.setText(prefs.deviceAreaName)
        val credit = edit("Credit limit", numeric = true)
        button("Save Customer") {
            if (txt(name).isBlank()) return@button toast("Customer name ضروری ہے")
            lifecycleScope.launch {
                db.customerDao().insert(CustomerEntity(name = txt(name), shopName = txt(shop), phone = txt(phone), address = txt(address), areaName = txt(area), photoUri = photoUri, creditLimit = txt(credit).toDoubleOrNull() ?: 0.0))
                queueSync(); toast("Customer محفوظ ہوگیا"); showCustomers()
            }
        }
    }

    private fun showProducts() {
        reset("Products / Inventory")
        back()
        button("+ Add Item with Units & Rates") { showAddProduct() }
        lifecycleScope.launch {
            val lowIds = db.productDao().lowStock().map { it.id }.toSet()
            val products = db.productDao().all()
            if (products.isEmpty()) info("ابھی کوئی item موجود نہیں۔")
            products.forEach { p ->
                val units = db.productUnitPriceDao().forProduct(p.id)
                val row = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(8), 0, dp(8)) }
                row.addView(image(p.photoUri, 92))
                row.addView(TextView(this@MainActivity).apply {
                    val unitText = units.joinToString(" • ") { "${it.unitCode}: ${money(it.retailRate)}" }
                    val purchase = if (prefs.purchaseRatesUnlocked) "\nPurchase(base): Rs ${money(p.purchaseRate)}" else "\nPurchase: HIDDEN"
                    val low = if (p.id in lowIds) "\n⚠ LOW STOCK" else ""
                    val expiry = if (p.expiryDate.isNotBlank()) "\nExpiry: ${p.expiryDate}" else ""
                    text = "${p.name}\n$unitText$purchase\nStock(base ${p.unit}): ${p.stockQty}$expiry$low"
                    textSize = 15f; setPadding(dp(12), 0, 0, 0)
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                root.addView(row)
            }
        }
    }

    private fun showAddProduct() {
        reset("Add Product — Units & Suggested Rates")
        back { showProducts() }
        var photoUri: String? = null
        val photo = image(null, 190); root.addView(photo)
        button("Choose clear catalog photo") {
            photoCallback = { uri ->
                runCatching { ImageStore.importImage(this, uri, "product") }.onSuccess { stored -> photoUri = stored; photo.setImageURI(Uri.parse(stored)) }.onFailure { toast("Image save failed") }
            }
            photoPicker.launch(arrayOf("image/*"))
        }
        val name = edit("Item name")
        val sku = edit("SKU / Code")
        val barcode = edit("Barcode")
        val category = edit("Category e.g. Biscuits, Candy, Drinks")
        val primaryUnit = spinner("Primary / Stock Unit", unitSuggestions)
        val pPurchase = edit("Primary Purchase Rate", numeric = true)
        val pRetail = edit("Primary Retail Rate", numeric = true)
        val pWholesale = edit("Primary Wholesale Rate", numeric = true)
        val pSuper = edit("Primary Super Wholesale Rate", numeric = true)

        val secondaryUnit = spinner("Second Unit (required)", unitSuggestions)
        secondaryUnit.setSelection(1)
        val sConversion = edit("How many primary units in 1 second unit? e.g. 12", numeric = true)
        val sPurchase = edit("Second Unit Purchase Rate (optional)", numeric = true)
        val sRetail = edit("Second Unit Retail Rate", numeric = true)
        val sWholesale = edit("Second Unit Wholesale Rate", numeric = true)
        val sSuper = edit("Second Unit Super Wholesale Rate", numeric = true)

        val thirdUnit = spinner("Third Unit (optional)", listOf("NONE") + unitSuggestions)
        val tConversion = edit("Third Unit conversion to primary", numeric = true)
        val tPurchase = edit("Third Unit Purchase Rate", numeric = true)
        val tRetail = edit("Third Unit Retail Rate", numeric = true)
        val tWholesale = edit("Third Unit Wholesale Rate", numeric = true)
        val tSuper = edit("Third Unit Super Wholesale Rate", numeric = true)

        val stock = edit("Opening stock in PRIMARY unit", numeric = true)
        val minStock = edit("Low-stock alert in PRIMARY unit", numeric = true)
        val batch = edit("Batch No (optional)")
        val expiry = edit("Expiry date e.g. 2027-12-31")
        val tax = edit("Tax % (optional)", numeric = true)
        button("Save Item") {
            val pr = txt(pPurchase).toDoubleOrNull()
            val rr = txt(pRetail).toDoubleOrNull()
            val conv2 = txt(sConversion).toDoubleOrNull()
            val retail2 = txt(sRetail).toDoubleOrNull()
            if (txt(name).isBlank() || pr == null || rr == null || conv2 == null || conv2 <= 0 || retail2 == null) return@button toast("Item, primary rates اور second unit/conversion ضروری ہیں")
            val u1 = primaryUnit.selectedItem.toString()
            val u2 = secondaryUnit.selectedItem.toString()
            if (u1 == u2) return@button toast("Primary اور Second unit مختلف منتخب کریں")
            lifecycleScope.launch {
                val wholesale1 = txt(pWholesale).toDoubleOrNull() ?: 0.0
                val super1 = txt(pSuper).toDoubleOrNull() ?: 0.0
                val productId = db.productDao().insert(ProductEntity(
                    name = txt(name), sku = txt(sku), barcode = txt(barcode), category = txt(category), unit = u1,
                    photoUri = photoUri, purchaseRate = pr, saleRate = rr, wholesaleRate = wholesale1, superWholesaleRate = super1,
                    stockQty = txt(stock).toDoubleOrNull() ?: 0.0, minStockQty = txt(minStock).toDoubleOrNull() ?: 0.0,
                    batchNo = txt(batch), expiryDate = txt(expiry), taxPercent = txt(tax).toDoubleOrNull() ?: 0.0
                ))
                val units = mutableListOf(
                    ProductUnitPriceEntity(productId = productId, unitCode = u1, conversionToBase = 1.0, purchaseRate = pr, retailRate = rr, wholesaleRate = wholesale1, superWholesaleRate = super1),
                    ProductUnitPriceEntity(productId = productId, unitCode = u2, conversionToBase = conv2,
                        purchaseRate = txt(sPurchase).toDoubleOrNull() ?: pr * conv2, retailRate = retail2,
                        wholesaleRate = txt(sWholesale).toDoubleOrNull() ?: 0.0, superWholesaleRate = txt(sSuper).toDoubleOrNull() ?: 0.0)
                )
                val u3 = thirdUnit.selectedItem.toString()
                val conv3 = txt(tConversion).toDoubleOrNull()
                val retail3 = txt(tRetail).toDoubleOrNull()
                if (u3 != "NONE" && conv3 != null && conv3 > 0 && retail3 != null) {
                    units += ProductUnitPriceEntity(productId = productId, unitCode = u3, conversionToBase = conv3,
                        purchaseRate = txt(tPurchase).toDoubleOrNull() ?: pr * conv3, retailRate = retail3,
                        wholesaleRate = txt(tWholesale).toDoubleOrNull() ?: 0.0, superWholesaleRate = txt(tSuper).toDoubleOrNull() ?: 0.0)
                }
                db.productUnitPriceDao().insertAll(units)
                queueSync(); toast("Item + unit rates محفوظ ہوگئے"); showProducts()
            }
        }
    }

    private fun fallbackUnit(p: ProductEntity) = ProductUnitPriceEntity(
        productId = p.id, unitCode = p.unit, conversionToBase = 1.0, purchaseRate = p.purchaseRate,
        retailRate = p.saleRate, wholesaleRate = p.wholesaleRate, superWholesaleRate = p.superWholesaleRate
    )

    private fun rateFor(u: ProductUnitPriceEntity, tier: String): Double = when (tier) {
        "SUPER WHOLESALE" -> u.superWholesaleRate.takeIf { it > 0 } ?: u.wholesaleRate.takeIf { it > 0 } ?: u.retailRate
        "WHOLESALE" -> u.wholesaleRate.takeIf { it > 0 } ?: u.retailRate
        else -> u.retailRate
    }

    private fun showNewOrder() {
        reset("New Order Booking")
        back()
        lifecycleScope.launch {
            val customers = db.customerDao().all()
            val products = db.productDao().all()
            if (customers.isEmpty() || products.isEmpty()) return@launch info("آرڈر سے پہلے Customer اور Product شامل کریں۔")
            val unitMap = mutableMapOf<Long, List<ProductUnitPriceEntity>>()
            products.forEach { p -> unitMap[p.id] = db.productUnitPriceDao().forProduct(p.id).ifEmpty { listOf(fallbackUnit(p)) } }
            val cart = mutableListOf<CartLine>()
            catalogSelected.forEach { (productId, count) ->
                products.firstOrNull { it.id == productId }?.let { p ->
                    val u = unitMap[p.id]!!.first()
                    val rate = rateFor(u, "RETAIL")
                    cart += CartLine(p, u, count.toDouble(), rate, "RETAIL", rate * count * p.taxPercent / 100.0)
                }
            }

            val customerSpinner = spinner("Customer", customers.map { "${it.name} — ${it.shopName} — ${it.areaName}" })
            val productSpinner = spinner("Product", products.map { it.name })
            val unitSpinner = spinner("Unit", unitMap[products.first().id]!!.map { it.unitCode })
            productSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                    val units = unitMap[products[position].id]!!
                    unitSpinner.adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, units.map { it.unitCode })
                }
                override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
            }
            val priceTier = spinner("Suggested Price Tier", listOf("RETAIL", "WHOLESALE", "SUPER WHOLESALE"))
            val qty = edit("Quantity", numeric = true)
            val cartBox = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.VERTICAL }
            root.addView(cartBox)

            fun renderCart() {
                cartBox.removeAllViews()
                if (cart.isEmpty()) cartBox.addView(TextView(this@MainActivity).apply { text = "Cart empty"; textSize = 16f })
                cart.toList().forEachIndexed { index, c ->
                    val row = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
                    row.addView(TextView(this@MainActivity).apply {
                        text = "${c.product.name}\n${c.qty} ${c.unitPrice.unitCode} × ${money(c.rate)} (${c.tier}) = Rs ${money(c.rate * c.qty + c.tax)}"
                        textSize = 15f
                    }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    row.addView(Button(this@MainActivity).apply {
                        text = "Remove"; isAllCaps = false
                        setOnClickListener { if (index < cart.size) { cart.removeAt(index); renderCart() } }
                    })
                    cartBox.addView(row)
                }
                if (cart.isNotEmpty()) cartBox.addView(TextView(this@MainActivity).apply {
                    text = "Current Total: Rs ${money(cart.sumOf { it.rate * it.qty + it.tax })}"
                    textSize = 18f; setTypeface(typeface, android.graphics.Typeface.BOLD); setPadding(0, dp(8), 0, dp(8))
                })
            }
            renderCart()

            button("+ Add Item with Selected Unit/Rate") {
                val q = txt(qty).toDoubleOrNull()
                if (q == null || q <= 0) return@button toast("Quantity درست درج کریں")
                val p = products[productSpinner.selectedItemPosition]
                val units = unitMap[p.id]!!
                val u = units[unitSpinner.selectedItemPosition.coerceIn(0, units.lastIndex)]
                val tier = priceTier.selectedItem.toString()
                val rate = rateFor(u, tier)
                cart += CartLine(p, u, q, rate, tier, rate * q * p.taxPercent / 100.0)
                qty.setText(""); renderCart()
            }
            button("Clear Cart") { cart.clear(); catalogSelected.clear(); renderCart() }

            val discount = edit("Discount amount (optional)", numeric = true)
            val payment = spinner("Payment", listOf("CREDIT", "CASH", "ONLINE", "BANK"))
            val document = spinner("Document", listOf("ORDER", "QUOTATION", "INVOICE"))
            val notes = edit("Notes")
            button("Save Order") {
                if (cart.isEmpty()) return@button toast("کم از کم ایک item شامل کریں")
                val customer = customers[customerSpinner.selectedItemPosition]
                val base = cart.sumOf { it.rate * it.qty }
                val taxTotal = cart.sumOf { it.tax }
                val discountValue = (txt(discount).toDoubleOrNull() ?: 0.0).coerceAtLeast(0.0)
                val saleTotal = (base + taxTotal - discountValue).coerceAtLeast(0.0)
                val purchaseTotal = cart.sumOf { line ->
                    val unitPurchase = line.unitPrice.purchaseRate.takeIf { it > 0 } ?: line.product.purchaseRate * line.unitPrice.conversionToBase
                    unitPurchase * line.qty
                }
                val docType = document.selectedItem.toString()
                val prefix = when (docType) { "QUOTATION" -> "QT"; "INVOICE" -> "INV"; else -> "ORD" }
                val invoice = "$prefix-${System.currentTimeMillis()}"
                lifecycleScope.launch {
                    val order = OrderEntity(
                        invoiceNo = invoice, customerId = customer.id, customerSyncId = customer.syncId,
                        bookedByUserId = prefs.currentUserId, bookerName = prefs.deviceBookerName, areaName = prefs.deviceAreaName,
                        deviceId = prefs.deviceId, saleTotal = saleTotal, purchaseTotal = purchaseTotal, discount = discountValue,
                        taxTotal = taxTotal, paymentType = payment.selectedItem.toString(), notes = txt(notes), documentType = docType,
                        status = if (docType == "QUOTATION") "QUOTED" else "BOOKED"
                    )
                    val items = cart.map { c ->
                        val unitPurchase = c.unitPrice.purchaseRate.takeIf { it > 0 } ?: c.product.purchaseRate * c.unitPrice.conversionToBase
                        OrderItemEntity(
                            productId = c.product.id, productSyncId = c.product.syncId, productName = c.product.name,
                            qty = c.qty, baseQty = c.qty * c.unitPrice.conversionToBase, unit = c.unitPrice.unitCode,
                            purchaseRate = unitPurchase, saleRate = c.rate, priceTier = c.tier,
                            taxPercent = c.product.taxPercent, lineTotal = c.rate * c.qty + c.tax
                        )
                    }
                    val orderId = db.orderDao().insertOrderWithItems(order, items)
                    if (docType == "INVOICE") applyBilling(orderId)
                    catalogSelected.clear(); queueSync(); toast("$docType محفوظ ہوگیا"); showOrders()
                }
            }
        }
    }

    private fun showAreaBilling() {
        reset("Area-wise Billing"); back()
        lifecycleScope.launch {
            val areas = (db.orderDao().areas() + prefs.deviceAreaName).filter { it.isNotBlank() }.distinct().sorted()
            if (areas.isEmpty()) return@launch info("ابھی کوئی Area order موجود نہیں۔")
            val areaSpinner = spinner("Select Area", areas)
            button("Open Area Orders") { showAreaOrders(areas[areaSpinner.selectedItemPosition]) }
        }
    }

    private fun showAreaOrders(area: String) {
        reset("Billing — $area"); back { showAreaBilling() }
        lifecycleScope.launch {
            val orders = db.orderDao().byAreaAndStatus(area, "BOOKED")
            info("Unbilled orders: ${orders.size}\nArea total: Rs ${money(orders.sumOf { it.saleTotal })}")
            if (orders.isNotEmpty()) button("Print Area Order Sheet") { printAreaSheet(area) }
            orders.forEach { o ->
                val customer = db.customerDao().byId(o.customerId)
                info("${o.invoiceNo}\n${customer?.name ?: "Customer"} — Rs ${money(o.saleTotal)}\nBooker: ${o.bookerName}")
                button("Print ${o.invoiceNo}") { printOrder(o.id) }
                button("Mark Billed ${o.invoiceNo}") { lifecycleScope.launch { applyBilling(o.id); queueSync(); showAreaOrders(area) } }
            }
        }
    }

    private suspend fun applyBilling(orderId: Long) {
        val order = db.orderDao().byId(orderId) ?: return
        if (order.status == "BILLED") return
        db.orderDao().items(orderId).forEach { item ->
            if (item.productId > 0) db.productDao().adjustStock(item.productId, -(item.baseQty.takeIf { it > 0 } ?: item.qty))
        }
        if (order.paymentType == "CREDIT" && order.customerId > 0) db.customerDao().adjustBalance(order.customerId, order.saleTotal)
        db.orderDao().setStatus(orderId, "BILLED")
    }

    private fun printAreaSheet(area: String) {
        lifecycleScope.launch {
            val orders = db.orderDao().byAreaAndStatus(area, "BOOKED")
            val sb = StringBuilder().appendLine(prefs.businessName).appendLine("AREA ORDER SHEET: $area").appendLine("-".repeat(40))
            orders.forEachIndexed { index, o ->
                val c = db.customerDao().byId(o.customerId)
                sb.appendLine("${index + 1}. ${c?.name ?: "Customer"} | ${o.invoiceNo} | Rs ${money(o.saleTotal)} | ${o.bookerName}")
            }
            sb.appendLine("-".repeat(40)).appendLine("TOTAL: Rs ${money(orders.sumOf { it.saleTotal })}")
            printText("Area-$area", sb.toString())
        }
    }

    private fun showOrders() {
        reset("Orders / Invoices"); back()
        lifecycleScope.launch {
            val orders = db.orderDao().all()
            if (orders.isEmpty()) info("ابھی کوئی order موجود نہیں۔")
            orders.forEach { o ->
                val customer = db.customerDao().byId(o.customerId)
                info("${o.invoiceNo} • ${o.status}\n${customer?.name ?: "Customer"} • Rs ${money(o.saleTotal)}\nArea: ${o.areaName} • Booker: ${o.bookerName}\n${if (o.synced) "Synced" else "Offline / Pending Sync"}")
                button("Print ${o.invoiceNo}") { printOrder(o.id) }
                button("Share / Export ${o.invoiceNo}") { shareOrder(o.id) }
                if (o.status == "BOOKED") button("Mark Billed") { lifecycleScope.launch { applyBilling(o.id); queueSync(); showOrders() } }
            }
        }
    }

    private fun printOrder(orderId: Long) {
        lifecycleScope.launch { printText("Invoice-$orderId", PrinterUtil.invoiceText(db, orderId, prefs, prefs.thermalPaperChars)) }
    }

    private fun printText(jobName: String, text: String) {
        if (prefs.printerMode == "THERMAL") {
            if (prefs.thermalPrinterAddress.isBlank()) return toast("پہلے Thermal printer منتخب کریں")
            lifecycleScope.launch {
                val result = PrinterUtil.printThermal(this@MainActivity, prefs.thermalPrinterAddress, text, prefs.businessLogoUri)
                if (result.isSuccess) toast("Print sent") else toast("Printer error: ${result.exceptionOrNull()?.message ?: "Unknown"}")
            }
        } else PrinterUtil.printRegular(this, jobName, text, prefs.businessLogoUri)
    }

    private fun shareOrder(orderId: Long) {
        lifecycleScope.launch {
            val file = ExportUtil.orderCsv(this@MainActivity, db, orderId)
            val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
            startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                type = "text/csv"; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }, "Share invoice / billing app"))
        }
    }

    private fun showReports() {
        reset("Reports & Profit"); back()
        lifecycleScope.launch {
            val sales = db.orderDao().totalSales(); val gross = db.orderDao().grossProfit(); val expenses = db.expenseDao().total(); val receivable = db.customerDao().totalReceivable()
            info("Total Sales: Rs ${money(sales)}\nGross Profit: Rs ${money(gross)}\nExpenses: Rs ${money(expenses)}\nNet after Expenses: Rs ${money(gross - expenses)}\nCustomer Receivable: Rs ${money(receivable)}")
            db.orderDao().areas().forEach { area -> info("$area Sales: Rs ${money(db.orderDao().areaSales(area))}") }
            db.productDao().lowStock().forEach { p -> info("LOW STOCK • ${p.name}: ${p.stockQty} ${p.unit}") }
        }
    }

    private fun showExpenses() {
        reset("Expenses"); back(); button("+ Add Expense") { showAddExpense() }
        lifecycleScope.launch {
            val expenses = db.expenseDao().all(); info("Total Expenses: Rs ${money(expenses.sumOf { it.amount })}")
            expenses.forEach { e -> info("${e.title} — Rs ${money(e.amount)}\n${e.areaName} • ${e.bookerName} • ${e.paymentType}") }
        }
    }

    private fun showAddExpense() {
        reset("Add Expense"); back { showExpenses() }
        val title = edit("Expense title"); val amount = edit("Amount", numeric = true)
        val payment = spinner("Payment", listOf("CASH", "BANK", "ONLINE"))
        val area = edit("Area"); area.setText(prefs.deviceAreaName); val notes = edit("Notes")
        button("Save Expense") {
            val a = txt(amount).toDoubleOrNull()
            if (txt(title).isBlank() || a == null || a <= 0) return@button toast("Expense اور amount درست درج کریں")
            lifecycleScope.launch {
                db.expenseDao().insert(ExpenseEntity(title = txt(title), amount = a, paymentType = payment.selectedItem.toString(), areaName = txt(area), bookerName = prefs.deviceBookerName, notes = txt(notes)))
                queueSync(); showExpenses()
            }
        }
    }

    private fun showPrinterSettings() {
        reset("Printer Settings"); back()
        val mode = spinner("Printer type", listOf("REGULAR", "THERMAL")); mode.setSelection(if (prefs.printerMode == "THERMAL") 1 else 0)
        val paper = spinner("Thermal paper", listOf("58mm / 2 inch", "80mm / 3 inch")); paper.setSelection(if (prefs.thermalPaperChars >= 48) 1 else 0)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !PrinterUtil.hasBluetoothPermission(this)) {
            info("Thermal printer کے لیے Bluetooth permission دیں۔"); button("Allow Bluetooth Printer") { bluetoothPermission.launch(Manifest.permission.BLUETOOTH_CONNECT) }
        } else {
            val devices = PrinterUtil.pairedThermalDevices(this)
            if (devices.isEmpty()) info("کوئی paired Bluetooth printer نہیں ملا۔ پہلے Android Bluetooth settings میں pair کریں۔")
            val printer = spinner("Paired thermal printer", if (devices.isEmpty()) listOf("No paired printer") else devices.map { "${it.name} — ${it.address}" })
            devices.indexOfFirst { it.address == prefs.thermalPrinterAddress }.takeIf { it >= 0 }?.let(printer::setSelection)
            button("Save Printer Settings") {
                prefs.printerMode = mode.selectedItem.toString(); prefs.thermalPaperChars = if (paper.selectedItemPosition == 1) 48 else 32
                if (devices.isNotEmpty()) prefs.thermalPrinterAddress = devices[printer.selectedItemPosition].address
                queueAutoBackup(); toast("Printer settings saved"); showDashboard()
            }
            if (devices.isNotEmpty()) button("Thermal Test Print") {
                prefs.thermalPrinterAddress = devices[printer.selectedItemPosition].address
                lifecycleScope.launch {
                    val r = PrinterUtil.printThermal(this@MainActivity, prefs.thermalPrinterAddress, "${prefs.businessName}\nTHERMAL PRINTER TEST\nArea: ${prefs.deviceAreaName}\nBooker: ${prefs.deviceBookerName}\n\n", prefs.businessLogoUri)
                    toast(if (r.isSuccess) "Test print sent" else "Printer error")
                }
            }
        }
        info("Regular mode: Android A4/A5/Wi-Fi/installed printer service۔ Thermal mode: paired Bluetooth ESC/POS 58mm/80mm receipt۔")
    }

    private fun showBackup() {
        reset("Backup & Restore"); back()
        val last = if (prefs.lastBackupAt > 0) SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(prefs.lastBackupAt)) else "Never"
        info("Last backup: $last\nAuto Backup: ${if (prefs.autoBackupEnabled) "ON" else "OFF"}\nBackup میں Customers, Products, Unit Rates, Catalog/Customer Images, Orders, Balances, Expenses اور Business Settings شامل ہیں۔")
        button("💾 Create Full Backup Now") { manualBackupCreator.launch(BackupManager.suggestedFileName(prefs)) }
        button(if (prefs.autoBackupEnabled) "🔁 Change Auto Backup Location" else "🔁 Set Auto Backup Location") {
            autoBackupCreator.launch(BackupManager.suggestedFileName(prefs))
        }
        if (prefs.autoBackupEnabled && prefs.autoBackupUri.isNotBlank()) {
            button("⚡ Backup Now to Auto Location") {
                lifecycleScope.launch {
                    runCatching { BackupManager.writeBackup(this@MainActivity, db, prefs, Uri.parse(prefs.autoBackupUri)) }
                        .onSuccess { toast("Auto-location backup updated"); showBackup() }
                        .onFailure { toast("Backup location unavailable: ${it.message ?: "Error"}") }
                }
            }
            button("Turn Auto Backup OFF") {
                prefs.autoBackupEnabled = false
                showBackup()
            }
        }
        button("♻ Restore Full Backup File") { backupRestorer.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }
        info("Auto Backup internet کے بغیر بھی چلتا ہے۔ Google Drive کو Android file picker میں destination منتخب کریں تو backup وہاں بھی محفوظ کیا جا سکتا ہے۔ App uninstall کے بعد اسی .cobak file سے مکمل restore ہو سکتا ہے۔ صرف Company ID سے automatic cloud restore کے لیے central sync server کی online copy ضروری ہے۔")
    }

    private fun showSettings() {
        reset("Settings & Privacy"); back()
        info("Business: ${prefs.businessName}\nCompany ID: ${prefs.businessId}\nDevice: ${prefs.deviceId.take(8)}\nBooker: ${prefs.deviceBookerName}\nArea: ${prefs.deviceAreaName}")
        button(if (prefs.purchaseRatesUnlocked) "Hide Purchase Rates" else "Unlock Purchase Rates") {
            if (prefs.purchaseRatesUnlocked) { prefs.purchaseRatesUnlocked = false; showSettings() } else showPinDialog()
        }
        button("Change This Device Booker / Area") { showDeviceProfile() }
        button("Business Profile & Logo") { showBusinessProfile() }
        button("Backup & Restore") { showBackup() }
        info("DATA SAFETY: V4 keeps non-destructive Room migrations, stable APK signing and portable full backup/restore. Normal app updates keep the local database. Uninstall recovery is available through a saved full backup; ID-only cloud recovery requires a deployed central sync server.")
    }

    private fun showBusinessProfile() {
        reset("Business Profile & Logo"); back { showSettings() }
        var logoUri = prefs.businessLogoUri
        val logo = image(logoUri, 150); root.addView(logo)
        button("Choose / Change Business Logo") {
            photoCallback = { uri ->
                runCatching { ImageStore.importImage(this, uri, "logo") }.onSuccess { stored -> logoUri = stored; logo.setImageURI(Uri.parse(stored)) }.onFailure { toast("Logo save failed") }
            }
            photoPicker.launch(arrayOf("image/*"))
        }
        val name = edit("Business name"); name.setText(prefs.businessName)
        val phone = edit("Phone"); phone.setText(prefs.businessPhone)
        val address = edit("Address"); address.setText(prefs.businessAddress)
        button("Save Business Profile") {
            prefs.businessName = txt(name); prefs.businessPhone = txt(phone); prefs.businessAddress = txt(address); prefs.businessLogoUri = logoUri
            queueSync(); showSettings()
        }
    }

    private fun showPinDialog() {
        val input = EditText(this).apply { hint = "Privacy PIN"; inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD }
        AlertDialog.Builder(this).setTitle("Purchase Rate Privacy").setView(input)
            .setPositiveButton("Unlock") { _, _ ->
                if (Security.sha256(input.text.toString()) == prefs.privacyPinHash) { prefs.purchaseRatesUnlocked = true; showSettings() } else toast("PIN غلط ہے")
            }.setNegativeButton("Cancel", null).show()
    }

    private fun showSync() {
        reset("Online Sync / Restore"); back()
        val last = if (prefs.lastSyncAt > 0) SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(Date(prefs.lastSyncAt)) else "Never"
        info("Offline orders فوراً save ہوتے ہیں۔ Internet آنے پر pending data owner/server تک sync ہوگا۔ Last successful sync: $last")
        val url = edit("HTTPS Sync Server URL"); url.setText(prefs.syncBaseUrl)
        val token = edit("Sync token", password = true); token.setText(prefs.syncToken)
        button("Save & Sync / Restore Now") {
            prefs.syncBaseUrl = txt(url); prefs.syncToken = txt(token); queueSync(); toast("Sync queued")
        }
    }

    private fun queueSync() {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
        WorkManager.getInstance(this).enqueueUniqueWork("company-order-sync", ExistingWorkPolicy.REPLACE, request)
        queueAutoBackup()
    }

    private fun queueAutoBackup() {
        if (!prefs.autoBackupEnabled || prefs.autoBackupUri.isBlank()) return
        val request = OneTimeWorkRequestBuilder<AutoBackupWorker>().build()
        WorkManager.getInstance(this).enqueueUniqueWork("company-auto-backup", ExistingWorkPolicy.REPLACE, request)
    }

    private fun spinner(label: String, items: List<String>): Spinner {
        root.addView(TextView(this).apply { text = label; textSize = 15f; setPadding(0, dp(8), 0, 0); setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_primary)) })
        val s = Spinner(this); s.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, items)
        root.addView(s, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)); return s
    }

    private fun back(action: (() -> Unit)? = null) { button("← Back") { (action ?: { showDashboard() }).invoke() } }

    private fun button(label: String, action: () -> Unit): Button {
        val b = Button(this).apply {
            text = label; isAllCaps = false; textSize = 16f
            backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this@MainActivity, R.color.brand_primary))
            setTextColor(android.graphics.Color.WHITE); setOnClickListener { action() }
        }
        root.addView(b, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { setMargins(0, dp(5), 0, dp(5)) }); return b
    }

    private fun edit(hint: String, numeric: Boolean = false, password: Boolean = false): EditText {
        val e = EditText(this).apply {
            this.hint = hint; textSize = 16f
            inputType = when {
                numeric && password -> InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
                numeric -> InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
                password -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                else -> InputType.TYPE_CLASS_TEXT
            }
        }
        root.addView(e, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)); return e
    }

    private fun info(textValue: String) {
        root.addView(TextView(this).apply {
            text = textValue; textSize = 16f; setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_primary)); setPadding(dp(8), dp(10), dp(8), dp(10))
        })
    }

    private fun image(uri: String?, size: Int): ImageView = ImageView(this).apply {
        layoutParams = LinearLayout.LayoutParams(dp(size), dp(size)).apply { gravity = Gravity.CENTER_HORIZONTAL }
        scaleType = ImageView.ScaleType.CENTER_CROP
        if (uri.isNullOrBlank()) setImageResource(android.R.drawable.ic_menu_gallery)
        else runCatching { setImageURI(Uri.parse(uri)) }.onFailure { setImageResource(android.R.drawable.ic_menu_gallery) }
    }

    private fun txt(editText: EditText): String = editText.text?.toString()?.trim().orEmpty()
    private fun money(value: Double): String = String.format(Locale.US, "%,.2f", value)
    private fun toast(value: String) = Toast.makeText(this, value, Toast.LENGTH_SHORT).show()
    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
