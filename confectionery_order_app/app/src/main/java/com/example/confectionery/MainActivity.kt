package com.example.confectionery

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.work.*
import com.example.confectionery.data.*
import com.example.confectionery.sync.SyncWorker
import com.example.confectionery.util.AppPrefs
import com.example.confectionery.util.ExportUtil
import com.example.confectionery.util.PrinterUtil
import com.example.confectionery.util.Security
import kotlinx.coroutines.launch
import java.util.Locale

class MainActivity : AppCompatActivity() {
    private val db by lazy { (application as OrderBookApp).db }
    private val prefs by lazy { AppPrefs(this) }
    private lateinit var root: LinearLayout
    private var photoCallback: ((String) -> Unit)? = null

    private data class CartLine(val product: ProductEntity, val qty: Double, val rate: Double, val tax: Double)

    private val photoPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri ?: return@registerForActivityResult
        try { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: Exception) {}
        photoCallback?.invoke(uri.toString())
        photoCallback = null
    }

    private val bluetoothPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) showPrinterSettings() else toast("Bluetooth printer permission درکار ہے")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(14), dp(14), dp(28))
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
        root.addView(TextView(this).apply {
            text = title
            textSize = 24f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, dp(12))
        })
    }

    private fun showFirstStart() {
        reset("Confectionery Order Book")
        info("ایک Company ID کے تحت تمام Order Bookers ایک ہی Customers, Items اور Rates دیکھ سکتے ہیں۔ ہر موبائل کا Booker اور Area الگ tag ہوگا۔")
        button("Create New Business") { showCreateBusiness() }
        button("Join Existing Business") { showJoinBusiness() }
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
        reset("Join Existing Business")
        back { showFirstStart() }
        info("اسی Company ID اور password کو استعمال کریں جو پہلے فون پر بنایا گیا تھا۔ Online مشترکہ data کے لیے Sync Server URL اور token بھی ایک جیسے ہوں گے۔")
        val businessId = edit("Company ID")
        val password = edit("Company password", password = true)
        val syncUrl = edit("HTTPS Sync Server URL")
        val token = edit("Sync token", password = true)
        val booker = edit("Order Booker name")
        val area = edit("Area / Route")
        button("Join & Sync") {
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
                prefs.currentUserId = db.userDao().insert(UserEntity(
                    name = txt(booker), username = "booker-${prefs.deviceId.take(8)}",
                    passwordHash = prefs.businessPasswordHash, role = "ORDER_BOOKER"
                ))
                queueSync()
                showDashboard()
            }
        }
    }

    private fun showCompanyLogin() {
        reset("Company Sign in")
        info("Company ID سب devices پر ایک ہی رہے گی۔ Device کا Booker/Area الگ ہے۔")
        val id = edit("Company ID")
        id.setText(prefs.businessId)
        val password = edit("Company password", password = true)
        button("Sign in") {
            if (txt(id) != prefs.businessId || Security.sha256(txt(password)) != prefs.businessPasswordHash) {
                return@button toast("Company ID یا password غلط ہے")
            }
            prefs.companyLoggedIn = true
            prefs.purchaseRatesUnlocked = false
            showDashboard()
        }
    }

    private fun showDashboard() {
        reset(prefs.businessName.ifBlank { "Confectionery Order Book" })
        info("Company: ${prefs.businessId}\nBooker: ${prefs.deviceBookerName} • Area: ${prefs.deviceAreaName}")
        button("New Order Booking") { showNewOrder() }
        button("Area-wise Billing") { showAreaBilling() }
        button("Customers / Parties") { showCustomers() }
        button("Products / Inventory") { showProducts() }
        button("Orders / Invoices") { showOrders() }
        button("Reports & Profit") { showReports() }
        button("Expenses") { showExpenses() }
        button("Printer / Thermal Printer") { showPrinterSettings() }
        button("Online Sync") { showSync() }
        button("Settings & Privacy") { showSettings() }
        button("Sign out") {
            prefs.companyLoggedIn = false
            prefs.purchaseRatesUnlocked = false
            showCompanyLogin()
        }
    }

    private fun showDeviceProfile() {
        reset("This Device Profile")
        info("Company login مشترک ہے، لیکن یہ نام اور Area اس فون کے آرڈرز پر لگے گا۔")
        val booker = edit("Order Booker name")
        booker.setText(prefs.deviceBookerName)
        val area = edit("Area / Route")
        area.setText(prefs.deviceAreaName)
        button("Save Device Profile") {
            if (txt(booker).isBlank() || txt(area).isBlank()) return@button toast("Booker اور Area ضروری ہیں")
            prefs.deviceBookerName = txt(booker)
            prefs.deviceAreaName = txt(area)
            showDashboard()
        }
    }

    private fun showCustomers() {
        reset("Customers / Parties")
        back()
        button("+ Add Customer") { showAddCustomer() }
        lifecycleScope.launch {
            val customers = db.customerDao().all()
            if (customers.isEmpty()) info("ابھی کوئی customer موجود نہیں۔")
            customers.forEach { c ->
                val row = LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(0, dp(8), 0, dp(8))
                }
                row.addView(image(c.photoUri, 90))
                row.addView(TextView(this@MainActivity).apply {
                    text = "${c.name}\n${c.shopName}\nArea: ${c.areaName}\n${c.phone}\nBalance: Rs ${money(c.balance)}"
                    textSize = 16f
                    setPadding(dp(12), 0, 0, 0)
                })
                root.addView(row)
            }
        }
    }

    private fun showAddCustomer() {
        reset("Add Customer")
        back { showCustomers() }
        var photoUri: String? = null
        val photo = image(null, 180)
        root.addView(photo)
        button("Choose clear customer photo") {
            photoCallback = { photoUri = it; photo.setImageURI(Uri.parse(it)) }
            photoPicker.launch(arrayOf("image/*"))
        }
        val name = edit("Customer name")
        val shop = edit("Shop / Business name")
        val phone = edit("Phone")
        val address = edit("Address")
        val area = edit("Area / Route")
        area.setText(prefs.deviceAreaName)
        val credit = edit("Credit limit", numeric = true)
        button("Save Customer") {
            if (txt(name).isBlank()) return@button toast("Customer name ضروری ہے")
            lifecycleScope.launch {
                db.customerDao().insert(CustomerEntity(
                    name = txt(name), shopName = txt(shop), phone = txt(phone), address = txt(address),
                    areaName = txt(area), photoUri = photoUri, creditLimit = txt(credit).toDoubleOrNull() ?: 0.0
                ))
                queueSync()
                toast("Customer محفوظ ہوگیا")
                showCustomers()
            }
        }
    }

    private fun showProducts() {
        reset("Products / Inventory")
        back()
        button("+ Add Item") { showAddProduct() }
        lifecycleScope.launch {
            val showPurchase = prefs.purchaseRatesUnlocked
            val lowIds = db.productDao().lowStock().map { it.id }.toSet()
            val products = db.productDao().all()
            if (products.isEmpty()) info("ابھی کوئی item موجود نہیں۔")
            products.forEach { p ->
                val row = LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(0, dp(8), 0, dp(8))
                }
                row.addView(image(p.photoUri, 90))
                row.addView(TextView(this@MainActivity).apply {
                    val purchase = if (showPurchase) "\nPurchase: Rs ${money(p.purchaseRate)}" else "\nPurchase: HIDDEN"
                    val low = if (p.id in lowIds) "\n⚠ LOW STOCK" else ""
                    val expiry = if (p.expiryDate.isNotBlank()) "\nExpiry: ${p.expiryDate}" else ""
                    text = "${p.name}\nSale: Rs ${money(p.saleRate)}$purchase\nStock: ${p.stockQty} ${p.unit}$expiry$low"
                    textSize = 16f
                    setPadding(dp(12), 0, 0, 0)
                })
                root.addView(row)
            }
        }
    }

    private fun showAddProduct() {
        reset("Add Product")
        back { showProducts() }
        var photoUri: String? = null
        val photo = image(null, 180)
        root.addView(photo)
        button("Choose item photo") {
            photoCallback = { photoUri = it; photo.setImageURI(Uri.parse(it)) }
            photoPicker.launch(arrayOf("image/*"))
        }
        val name = edit("Item name")
        val sku = edit("SKU / Code")
        val barcode = edit("Barcode")
        val category = edit("Category")
        val unit = edit("Unit e.g. pcs, box, carton")
        val purchase = edit("Purchase rate", numeric = true)
        val sale = edit("Retail sale rate", numeric = true)
        val wholesale = edit("Wholesale rate (optional)", numeric = true)
        val stock = edit("Opening stock", numeric = true)
        val minStock = edit("Low-stock alert at", numeric = true)
        val batch = edit("Batch No (optional)")
        val expiry = edit("Expiry date e.g. 2027-12-31")
        val tax = edit("Tax % (optional)", numeric = true)
        button("Save Item") {
            val pr = txt(purchase).toDoubleOrNull()
            val sr = txt(sale).toDoubleOrNull()
            if (txt(name).isBlank() || pr == null || sr == null) return@button toast("Item, purchase rate اور sale rate ضروری ہیں")
            lifecycleScope.launch {
                db.productDao().insert(ProductEntity(
                    name = txt(name), sku = txt(sku), barcode = txt(barcode), category = txt(category),
                    unit = txt(unit).ifBlank { "pcs" }, photoUri = photoUri,
                    purchaseRate = pr, saleRate = sr, wholesaleRate = txt(wholesale).toDoubleOrNull() ?: 0.0,
                    stockQty = txt(stock).toDoubleOrNull() ?: 0.0, minStockQty = txt(minStock).toDoubleOrNull() ?: 0.0,
                    batchNo = txt(batch), expiryDate = txt(expiry), taxPercent = txt(tax).toDoubleOrNull() ?: 0.0
                ))
                queueSync()
                toast("Item محفوظ ہوگیا")
                showProducts()
            }
        }
    }

    private fun showNewOrder() {
        reset("New Order Booking")
        back()
        lifecycleScope.launch {
            val customers = db.customerDao().all()
            val products = db.productDao().all()
            if (customers.isEmpty() || products.isEmpty()) {
                info("آرڈر سے پہلے کم از کم ایک Customer اور ایک Product شامل کریں۔")
                return@launch
            }
            val customerSpinner = spinner("Customer", customers.map { "${it.name} — ${it.shopName} — ${it.areaName}" })
            val productSpinner = spinner("Product", products.map { "${it.name} — Rs ${money(it.saleRate)}" })
            val priceType = spinner("Price", listOf("RETAIL", "WHOLESALE"))
            val qty = edit("Quantity", numeric = true)
            val cart = mutableListOf<CartLine>()
            val cartView = TextView(this@MainActivity).apply { textSize = 16f; setPadding(dp(4), dp(10), dp(4), dp(10)) }
            root.addView(cartView)

            fun renderCart() {
                cartView.text = if (cart.isEmpty()) "Cart empty" else cart.mapIndexed { index, c ->
                    "${index + 1}. ${c.product.name} — ${c.qty} ${c.product.unit} × Rs ${money(c.rate)} = Rs ${money(c.rate * c.qty + c.tax)}"
                }.joinToString("\n")
            }
            renderCart()

            button("+ Add Item to Order") {
                val q = txt(qty).toDoubleOrNull()
                if (q == null || q <= 0) return@button toast("Quantity درست درج کریں")
                val p = products[productSpinner.selectedItemPosition]
                val useWholesale = priceType.selectedItem.toString() == "WHOLESALE" && p.wholesaleRate > 0
                val rate = if (useWholesale) p.wholesaleRate else p.saleRate
                val taxValue = rate * q * p.taxPercent / 100.0
                cart += CartLine(p, q, rate, taxValue)
                qty.setText("")
                renderCart()
            }
            button("Clear Cart") { cart.clear(); renderCart() }

            val discount = edit("Discount amount (optional)", numeric = true)
            val payment = spinner("Payment", listOf("CREDIT", "CASH", "ONLINE", "BANK"))
            val document = spinner("Document", listOf("ORDER", "QUOTATION", "INVOICE"))
            val notes = edit("Notes")

            button("Save") {
                if (cart.isEmpty()) return@button toast("کم از کم ایک item شامل کریں")
                val customer = customers[customerSpinner.selectedItemPosition]
                val base = cart.sumOf { it.rate * it.qty }
                val taxTotal = cart.sumOf { it.tax }
                val discountValue = (txt(discount).toDoubleOrNull() ?: 0.0).coerceAtLeast(0.0)
                val saleTotal = (base + taxTotal - discountValue).coerceAtLeast(0.0)
                val purchaseTotal = cart.sumOf { it.product.purchaseRate * it.qty }
                val docType = document.selectedItem.toString()
                val prefix = when (docType) { "QUOTATION" -> "QT"; "INVOICE" -> "INV"; else -> "ORD" }
                val invoice = "$prefix-${System.currentTimeMillis()}"
                val status = when (docType) { "INVOICE" -> "BILLED"; "QUOTATION" -> "QUOTED"; else -> "BOOKED" }
                lifecycleScope.launch {
                    val order = OrderEntity(
                        invoiceNo = invoice, customerId = customer.id, customerSyncId = customer.syncId,
                        bookedByUserId = prefs.currentUserId, bookerName = prefs.deviceBookerName,
                        areaName = prefs.deviceAreaName, deviceId = prefs.deviceId,
                        saleTotal = saleTotal, purchaseTotal = purchaseTotal, discount = discountValue,
                        taxTotal = taxTotal, paymentType = payment.selectedItem.toString(), notes = txt(notes),
                        documentType = docType, status = status
                    )
                    val items = cart.map { c -> OrderItemEntity(
                        productId = c.product.id, productSyncId = c.product.syncId, productName = c.product.name,
                        qty = c.qty, unit = c.product.unit, purchaseRate = c.product.purchaseRate,
                        saleRate = c.rate, taxPercent = c.product.taxPercent, lineTotal = c.rate * c.qty + c.tax
                    ) }
                    val orderId = db.orderDao().insertOrderWithItems(order, items)
                    if (docType == "INVOICE") applyBilling(orderId)
                    queueSync()
                    toast("$docType محفوظ ہوگیا")
                    showOrders()
                }
            }
        }
    }

    private fun showAreaBilling() {
        reset("Area-wise Billing")
        back()
        lifecycleScope.launch {
            val areas = (db.orderDao().areas() + prefs.deviceAreaName).filter { it.isNotBlank() }.distinct().sorted()
            if (areas.isEmpty()) return@launch info("ابھی کوئی Area order موجود نہیں۔")
            val areaSpinner = spinner("Select Area", areas)
            button("Open Area Orders") { showAreaOrders(areas[areaSpinner.selectedItemPosition]) }
        }
    }

    private fun showAreaOrders(area: String) {
        reset("Billing — $area")
        back { showAreaBilling() }
        lifecycleScope.launch {
            val orders = db.orderDao().byAreaAndStatus(area, "BOOKED")
            val total = orders.sumOf { it.saleTotal }
            info("Unbilled orders: ${orders.size}\nArea total: Rs ${money(total)}")
            if (orders.isNotEmpty()) button("Print Area Order Sheet") { printAreaSheet(area) }
            orders.forEach { o ->
                val customer = db.customerDao().byId(o.customerId)
                info("${o.invoiceNo}\n${customer?.name ?: "Customer"} — Rs ${money(o.saleTotal)}\nBooker: ${o.bookerName}")
                button("Print ${o.invoiceNo}") { printOrder(o.id) }
                button("Mark Billed ${o.invoiceNo}") {
                    lifecycleScope.launch {
                        applyBilling(o.id)
                        queueSync()
                        toast("Invoice billed")
                        showAreaOrders(area)
                    }
                }
            }
        }
    }

    private suspend fun applyBilling(orderId: Long) {
        val order = db.orderDao().byId(orderId) ?: return
        if (order.status == "BILLED") return
        val items = db.orderDao().items(orderId)
        items.forEach { if (it.productId > 0) db.productDao().adjustStock(it.productId, -it.qty) }
        if (order.paymentType == "CREDIT" && order.customerId > 0) db.customerDao().adjustBalance(order.customerId, order.saleTotal)
        db.orderDao().setStatus(orderId, "BILLED")
    }

    private fun printAreaSheet(area: String) {
        lifecycleScope.launch {
            val orders = db.orderDao().byAreaAndStatus(area, "BOOKED")
            val sb = StringBuilder()
            sb.appendLine(prefs.businessName)
            sb.appendLine("AREA ORDER SHEET: $area")
            sb.appendLine("-".repeat(40))
            orders.forEachIndexed { index, o ->
                val c = db.customerDao().byId(o.customerId)
                sb.appendLine("${index + 1}. ${c?.name ?: "Customer"} | ${o.invoiceNo} | Rs ${money(o.saleTotal)} | ${o.bookerName}")
            }
            sb.appendLine("-".repeat(40))
            sb.appendLine("TOTAL: Rs ${money(orders.sumOf { it.saleTotal })}")
            printText("Area-$area", sb.toString())
        }
    }

    private fun showOrders() {
        reset("Orders / Invoices")
        back()
        lifecycleScope.launch {
            val orders = db.orderDao().all()
            if (orders.isEmpty()) info("ابھی کوئی order موجود نہیں۔")
            orders.forEach { o ->
                val customer = db.customerDao().byId(o.customerId)
                info("${o.invoiceNo} • ${o.status}\n${customer?.name ?: "Customer"} • Rs ${money(o.saleTotal)}\nArea: ${o.areaName} • Booker: ${o.bookerName}\n${if (o.synced) "Synced" else "Offline / Pending Sync"}")
                button("Print ${o.invoiceNo}") { printOrder(o.id) }
                button("Share / Export ${o.invoiceNo}") { shareOrder(o.id) }
                if (o.status == "BOOKED") button("Mark Billed") {
                    lifecycleScope.launch { applyBilling(o.id); queueSync(); showOrders() }
                }
            }
        }
    }

    private fun printOrder(orderId: Long) {
        lifecycleScope.launch {
            val text = PrinterUtil.invoiceText(db, orderId, prefs, prefs.thermalPaperChars)
            printText("Invoice-$orderId", text)
        }
    }

    private fun printText(jobName: String, text: String) {
        if (prefs.printerMode == "THERMAL") {
            if (prefs.thermalPrinterAddress.isBlank()) return toast("پہلے Thermal printer منتخب کریں")
            lifecycleScope.launch {
                val result = PrinterUtil.printThermal(this@MainActivity, prefs.thermalPrinterAddress, text)
                if (result.isSuccess) toast("Print sent") else toast("Printer error: ${result.exceptionOrNull()?.message ?: "Unknown"}")
            }
        } else PrinterUtil.printRegular(this, jobName, text)
    }

    private fun shareOrder(orderId: Long) {
        lifecycleScope.launch {
            val file = ExportUtil.orderCsv(this@MainActivity, db, orderId)
            val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/csv"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(intent, "Share invoice / billing app"))
        }
    }

    private fun showReports() {
        reset("Reports & Profit")
        back()
        lifecycleScope.launch {
            val sales = db.orderDao().totalSales()
            val gross = db.orderDao().grossProfit()
            val expenses = db.expenseDao().total()
            val receivable = db.customerDao().totalReceivable()
            info("Total Sales: Rs ${money(sales)}\nGross Profit: Rs ${money(gross)}\nExpenses: Rs ${money(expenses)}\nNet after Expenses: Rs ${money(gross - expenses)}\nCustomer Receivable: Rs ${money(receivable)}")
            val areas = db.orderDao().areas()
            if (areas.isNotEmpty()) {
                info("AREA-WISE SALES")
                areas.forEach { area -> info("$area: Rs ${money(db.orderDao().areaSales(area))}") }
            }
            val low = db.productDao().lowStock()
            if (low.isNotEmpty()) {
                info("LOW STOCK")
                low.forEach { p -> info("${p.name}: ${p.stockQty} ${p.unit}") }
            }
        }
    }

    private fun showExpenses() {
        reset("Expenses")
        back()
        button("+ Add Expense") { showAddExpense() }
        lifecycleScope.launch {
            val expenses = db.expenseDao().all()
            info("Total Expenses: Rs ${money(expenses.sumOf { it.amount })}")
            expenses.forEach { e -> info("${e.title} — Rs ${money(e.amount)}\n${e.areaName} • ${e.bookerName} • ${e.paymentType}") }
        }
    }

    private fun showAddExpense() {
        reset("Add Expense")
        back { showExpenses() }
        val title = edit("Expense title")
        val amount = edit("Amount", numeric = true)
        val payment = spinner("Payment", listOf("CASH", "BANK", "ONLINE"))
        val area = edit("Area")
        area.setText(prefs.deviceAreaName)
        val notes = edit("Notes")
        button("Save Expense") {
            val a = txt(amount).toDoubleOrNull()
            if (txt(title).isBlank() || a == null || a <= 0) return@button toast("Expense اور amount درست درج کریں")
            lifecycleScope.launch {
                db.expenseDao().insert(ExpenseEntity(
                    title = txt(title), amount = a, paymentType = payment.selectedItem.toString(),
                    areaName = txt(area), bookerName = prefs.deviceBookerName, notes = txt(notes)
                ))
                queueSync()
                showExpenses()
            }
        }
    }

    private fun showPrinterSettings() {
        reset("Printer Settings")
        back()
        val mode = spinner("Printer type", listOf("REGULAR", "THERMAL"))
        mode.setSelection(if (prefs.printerMode == "THERMAL") 1 else 0)
        val paper = spinner("Thermal paper", listOf("58mm / 2 inch", "80mm / 3 inch"))
        paper.setSelection(if (prefs.thermalPaperChars >= 48) 1 else 0)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !PrinterUtil.hasBluetoothPermission(this)) {
            info("Thermal printer دیکھنے کے لیے Bluetooth permission دیں۔")
            button("Allow Bluetooth Printer") { bluetoothPermission.launch(Manifest.permission.BLUETOOTH_CONNECT) }
        } else {
            val devices = PrinterUtil.pairedThermalDevices(this)
            if (devices.isEmpty()) info("کوئی paired Bluetooth device نہیں ملا۔ پہلے Android Bluetooth settings میں thermal printer pair کریں۔")
            val labels = if (devices.isEmpty()) listOf("No paired printer") else devices.map { "${it.name} — ${it.address}" }
            val printer = spinner("Paired thermal printer", labels)
            if (devices.isNotEmpty()) {
                val oldIndex = devices.indexOfFirst { it.address == prefs.thermalPrinterAddress }
                if (oldIndex >= 0) printer.setSelection(oldIndex)
            }
            button("Save Printer Settings") {
                prefs.printerMode = mode.selectedItem.toString()
                prefs.thermalPaperChars = if (paper.selectedItemPosition == 1) 48 else 32
                if (devices.isNotEmpty()) prefs.thermalPrinterAddress = devices[printer.selectedItemPosition].address
                toast("Printer settings saved")
                showDashboard()
            }
            if (devices.isNotEmpty()) button("Thermal Test Print") {
                prefs.thermalPrinterAddress = devices[printer.selectedItemPosition].address
                lifecycleScope.launch {
                    val result = PrinterUtil.printThermal(this@MainActivity, prefs.thermalPrinterAddress, "${prefs.businessName}\nTHERMAL PRINTER TEST\nArea: ${prefs.deviceAreaName}\nBooker: ${prefs.deviceBookerName}\n\n")
                    if (result.isSuccess) toast("Test print sent") else toast("Printer error")
                }
            }
        }
        info("REGULAR mode Android print dialog کھولتا ہے؛ وہاں A4/A5, Wi-Fi یا installed printer service منتخب کی جا سکتی ہے۔ THERMAL mode paired Bluetooth ESC/POS printer کو direct receipt بھیجتا ہے۔")
    }

    private fun showSettings() {
        reset("Settings & Privacy")
        back()
        info("Business: ${prefs.businessName}\nCompany ID: ${prefs.businessId}\nDevice: ${prefs.deviceId.take(8)}\nBooker: ${prefs.deviceBookerName}\nArea: ${prefs.deviceAreaName}")
        button(if (prefs.purchaseRatesUnlocked) "Hide Purchase Rates" else "Unlock Purchase Rates") {
            if (prefs.purchaseRatesUnlocked) {
                prefs.purchaseRatesUnlocked = false
                toast("Purchase rates hidden")
                showSettings()
            } else showPinDialog()
        }
        button("Change This Device Booker / Area") { showDeviceProfile() }
        button("Business Profile") { showBusinessProfile() }
        info("Purchase rates PIN سے محفوظ ہیں۔ Order data Booker + Area + Device کے ساتھ محفوظ ہوتا ہے، جبکہ Customers/Products Company level پر shared رہتے ہیں۔")
    }

    private fun showBusinessProfile() {
        reset("Business Profile")
        back { showSettings() }
        val name = edit("Business name"); name.setText(prefs.businessName)
        val phone = edit("Phone"); phone.setText(prefs.businessPhone)
        val address = edit("Address"); address.setText(prefs.businessAddress)
        button("Save Business Profile") {
            prefs.businessName = txt(name)
            prefs.businessPhone = txt(phone)
            prefs.businessAddress = txt(address)
            queueSync()
            showSettings()
        }
    }

    private fun showPinDialog() {
        val input = EditText(this).apply {
            hint = "Privacy PIN"
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
        }
        AlertDialog.Builder(this)
            .setTitle("Purchase Rate Privacy")
            .setView(input)
            .setPositiveButton("Unlock") { _, _ ->
                if (Security.sha256(input.text.toString()) == prefs.privacyPinHash) {
                    prefs.purchaseRatesUnlocked = true
                    toast("Purchase rates unlocked")
                    showSettings()
                } else toast("PIN غلط ہے")
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showSync() {
        reset("Online Sync")
        back()
        info("تمام phones پر Company ID, Sync URL اور token ایک جیسے رکھیں۔ Offline entries device میں محفوظ رہیں گی اور internet آنے پر exchange sync ہوگا۔")
        val url = edit("HTTPS Sync Server URL")
        url.setText(prefs.syncBaseUrl)
        val token = edit("Sync token", password = true)
        token.setText(prefs.syncToken)
        button("Save & Sync Now") {
            prefs.syncBaseUrl = txt(url)
            prefs.syncToken = txt(token)
            queueSync()
            toast("Sync queued")
        }
    }

    private fun queueSync() {
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val request = OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(constraints).build()
        WorkManager.getInstance(this).enqueueUniqueWork("company-order-sync", ExistingWorkPolicy.REPLACE, request)
    }

    private fun spinner(label: String, items: List<String>): Spinner {
        root.addView(TextView(this).apply { text = label; textSize = 15f; setPadding(0, dp(8), 0, 0) })
        val s = Spinner(this)
        s.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, items)
        root.addView(s, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        return s
    }

    private fun back(action: (() -> Unit)? = null) {
        button("← Back") { (action ?: { showDashboard() }).invoke() }
    }

    private fun button(label: String, action: () -> Unit): Button {
        val b = Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 16f
            setOnClickListener { action() }
        }
        root.addView(b, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            setMargins(0, dp(5), 0, dp(5))
        })
        return b
    }

    private fun edit(hint: String, numeric: Boolean = false, password: Boolean = false): EditText {
        val e = EditText(this).apply {
            this.hint = hint
            textSize = 16f
            inputType = when {
                numeric && password -> InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
                numeric -> InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
                password -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                else -> InputType.TYPE_CLASS_TEXT
            }
        }
        root.addView(e, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        return e
    }

    private fun info(textValue: String) {
        root.addView(TextView(this).apply {
            text = textValue
            textSize = 16f
            setPadding(dp(6), dp(8), dp(6), dp(8))
        })
    }

    private fun image(uri: String?, size: Int): ImageView = ImageView(this).apply {
        layoutParams = LinearLayout.LayoutParams(dp(size), dp(size)).apply { gravity = Gravity.CENTER_HORIZONTAL }
        scaleType = ImageView.ScaleType.CENTER_CROP
        if (uri.isNullOrBlank()) setImageResource(android.R.drawable.ic_menu_gallery)
        else try { setImageURI(Uri.parse(uri)) } catch (_: Exception) { setImageResource(android.R.drawable.ic_menu_gallery) }
    }

    private fun txt(editText: EditText): String = editText.text?.toString()?.trim().orEmpty()
    private fun money(value: Double): String = String.format(Locale.US, "%,.2f", value)
    private fun toast(value: String) = Toast.makeText(this, value, Toast.LENGTH_SHORT).show()
    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
