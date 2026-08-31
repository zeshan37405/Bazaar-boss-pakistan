package com.example.confectionery

import android.content.Intent
import android.net.Uri
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
import com.example.confectionery.util.Security
import kotlinx.coroutines.launch
import java.util.Locale

class MainActivity : AppCompatActivity() {
    private val db by lazy { (application as OrderBookApp).db }
    private val prefs by lazy { AppPrefs(this) }
    private lateinit var root: LinearLayout
    private var photoCallback: ((String) -> Unit)? = null

    private val photoPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri ?: return@registerForActivityResult
        try { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: Exception) {}
        photoCallback?.invoke(uri.toString())
        photoCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(14), dp(14), dp(24))
        }
        setContentView(ScrollView(this).apply { addView(root) })
        lifecycleScope.launch {
            when {
                db.userDao().count() == 0 -> showOwnerSetup()
                prefs.currentUserId == 0L -> showLogin()
                else -> showDashboard()
            }
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

    private fun showOwnerSetup() {
        reset("Confectionery Order Book")
        info("پہلی بار Owner اکاؤنٹ بنائیں۔ Purchase Rate صرف مجاز user PIN کے بعد دیکھ سکے گا۔")
        val name = edit("Owner name")
        val username = edit("Username")
        val password = edit("Password", password = true)
        val pin = edit("Purchase Rate PIN", numeric = true, password = true)
        button("Create Owner") {
            if (txt(name).isBlank() || txt(username).isBlank() || txt(password).length < 4 || txt(pin).length < 4) {
                toast("تمام معلومات درست درج کریں")
                return@button
            }
            lifecycleScope.launch {
                val id = db.userDao().insert(UserEntity(name = txt(name), username = txt(username), passwordHash = Security.sha256(txt(password)), role = "OWNER"))
                prefs.currentUserId = id
                prefs.privacyPinHash = Security.sha256(txt(pin))
                showDashboard()
            }
        }
    }

    private fun showLogin() {
        reset("Sign in")
        info("یہ sign-in آفلائن بھی کام کرتا ہے۔")
        val username = edit("Username")
        val password = edit("Password", password = true)
        button("Sign in") {
            lifecycleScope.launch {
                val user = db.userDao().byUsername(txt(username))
                if (user == null || user.passwordHash != Security.sha256(txt(password))) {
                    toast("Username یا password غلط ہے")
                } else {
                    prefs.currentUserId = user.id
                    prefs.purchaseRatesUnlocked = false
                    showDashboard()
                }
            }
        }
    }

    private fun showDashboard() {
        reset("Confectionery Order Book")
        lifecycleScope.launch {
            val user = db.userDao().byId(prefs.currentUserId)
            info("Signed in: ${user?.name ?: "User"} • ${user?.role ?: ""}")
        }
        button("Customers") { showCustomers() }
        button("Products / Items") { showProducts() }
        button("New Order") { showNewOrder() }
        button("Orders / Invoices") { showOrders() }
        button("Settings & Privacy") { showSettings() }
        button("Online Sync") { showSync() }
        button("Sign out") {
            prefs.currentUserId = 0
            prefs.purchaseRatesUnlocked = false
            showLogin()
        }
    }

    private fun showCustomers() {
        reset("Customers")
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
                row.addView(image(c.photoUri, 96))
                row.addView(TextView(this@MainActivity).apply {
                    text = "${c.name}\n${c.shopName}\n${c.phone}\nBalance: Rs ${money(c.balance)}"
                    textSize = 17f
                    setPadding(dp(14), 0, 0, 0)
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
        val phone = edit("Phone", numeric = true)
        val address = edit("Address")
        val credit = edit("Credit limit", numeric = true)
        button("Save Customer") {
            if (txt(name).isBlank()) return@button toast("Customer name ضروری ہے")
            lifecycleScope.launch {
                db.customerDao().insert(CustomerEntity(name = txt(name), shopName = txt(shop), phone = txt(phone), address = txt(address), photoUri = photoUri, creditLimit = txt(credit).toDoubleOrNull() ?: 0.0))
                toast("Customer محفوظ ہوگیا")
                showCustomers()
            }
        }
    }

    private fun showProducts() {
        reset("Products / Items")
        back()
        button("+ Add Item") { showAddProduct() }
        lifecycleScope.launch {
            val user = db.userDao().byId(prefs.currentUserId)
            val showPurchase = (user?.role == "OWNER" || user?.role == "ORDER_BOOKER") && prefs.purchaseRatesUnlocked
            val products = db.productDao().all()
            if (products.isEmpty()) info("ابھی کوئی item موجود نہیں۔")
            products.forEach { p ->
                val row = LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(0, dp(8), 0, dp(8))
                }
                row.addView(image(p.photoUri, 96))
                row.addView(TextView(this@MainActivity).apply {
                    val purchase = if (showPurchase) "\nPurchase: Rs ${money(p.purchaseRate)}" else "\nPurchase: HIDDEN"
                    text = "${p.name}\nSale: Rs ${money(p.saleRate)}$purchase\nStock: ${p.stockQty} ${p.unit}"
                    textSize = 17f
                    setPadding(dp(14), 0, 0, 0)
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
        val category = edit("Category")
        val unit = edit("Unit e.g. pcs, box, carton")
        val purchase = edit("Purchase rate", numeric = true)
        val sale = edit("Sale rate", numeric = true)
        val stock = edit("Opening stock", numeric = true)
        button("Save Item") {
            val pr = txt(purchase).toDoubleOrNull()
            val sr = txt(sale).toDoubleOrNull()
            if (txt(name).isBlank() || pr == null || sr == null) return@button toast("Item, purchase rate اور sale rate ضروری ہیں")
            lifecycleScope.launch {
                db.productDao().insert(ProductEntity(name = txt(name), sku = txt(sku), category = txt(category), unit = txt(unit).ifBlank { "pcs" }, photoUri = photoUri, purchaseRate = pr, saleRate = sr, stockQty = txt(stock).toDoubleOrNull() ?: 0.0))
                toast("Item محفوظ ہوگیا")
                showProducts()
            }
        }
    }

    private fun showNewOrder() {
        reset("New Order")
        back()
        lifecycleScope.launch {
            val customers = db.customerDao().all()
            val products = db.productDao().all()
            if (customers.isEmpty() || products.isEmpty()) {
                info("آرڈر سے پہلے کم از کم ایک Customer اور ایک Product شامل کریں۔")
                return@launch
            }
            root.addView(TextView(this@MainActivity).apply { text = "Customer"; textSize = 16f })
            val customerSpinner = Spinner(this@MainActivity)
            customerSpinner.adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, customers.map { "${it.name} — ${it.shopName}" })
            root.addView(customerSpinner)

            root.addView(TextView(this@MainActivity).apply { text = "Product"; textSize = 16f })
            val productSpinner = Spinner(this@MainActivity)
            productSpinner.adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, products.map { "${it.name} — Rs ${money(it.saleRate)}" })
            root.addView(productSpinner)

            val qty = edit("Quantity", numeric = true)
            root.addView(TextView(this@MainActivity).apply { text = "Payment"; textSize = 16f })
            val payment = Spinner(this@MainActivity)
            payment.adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, listOf("CREDIT", "CASH", "ONLINE"))
            root.addView(payment)
            val notes = edit("Notes")

            button("Save Order") {
                val q = txt(qty).toDoubleOrNull()
                if (q == null || q <= 0) return@button toast("Quantity درست درج کریں")
                val customer = customers[customerSpinner.selectedItemPosition]
                val product = products[productSpinner.selectedItemPosition]
                val saleTotal = product.saleRate * q
                val purchaseTotal = product.purchaseRate * q
                val invoice = "ORD-${System.currentTimeMillis()}"
                val paymentType = payment.selectedItem.toString()
                lifecycleScope.launch {
                    val order = OrderEntity(invoiceNo = invoice, customerId = customer.id, bookedByUserId = prefs.currentUserId, saleTotal = saleTotal, purchaseTotal = purchaseTotal, paymentType = paymentType, notes = txt(notes))
                    val item = OrderItemEntity(orderId = 0, productId = product.id, productName = product.name, qty = q, unit = product.unit, purchaseRate = product.purchaseRate, saleRate = product.saleRate, lineTotal = saleTotal)
                    db.orderDao().insertOrderWithItems(order, listOf(item))
                    db.productDao().adjustStock(product.id, -q)
                    if (paymentType == "CREDIT") db.customerDao().adjustBalance(customer.id, saleTotal)
                    queueSync()
                    toast("Order محفوظ ہوگیا")
                    showOrders()
                }
            }
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
                info("${o.invoiceNo}\n${customer?.name ?: "Customer"} • Rs ${money(o.saleTotal)}\n${if (o.synced) "Synced" else "Offline / Pending Sync"}")
                button("Share Invoice ${o.invoiceNo}") { shareOrder(o.id) }
            }
        }
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

    private fun showSettings() {
        reset("Settings & Privacy")
        back()
        lifecycleScope.launch {
            val user = db.userDao().byId(prefs.currentUserId)
            info("Current role: ${user?.role ?: ""}")
            button(if (prefs.purchaseRatesUnlocked) "Hide Purchase Rates" else "Unlock Purchase Rates") {
                if (user?.role != "OWNER" && user?.role != "ORDER_BOOKER") return@button toast("اجازت نہیں ہے")
                if (prefs.purchaseRatesUnlocked) {
                    prefs.purchaseRatesUnlocked = false
                    toast("Purchase rates hidden")
                    showSettings()
                } else showPinDialog()
            }
            if (user?.role == "OWNER") button("Add Order Booker") { showAddOrderBooker() }
            info("Invoice CSV کو Vyapar یا دوسری billing app میں Share/Import کیا جا سکتا ہے۔ Direct API connector API access ملنے پر شامل کیا جا سکتا ہے۔")
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

    private fun showAddOrderBooker() {
        reset("Add Order Booker")
        back { showSettings() }
        var photoUri: String? = null
        val photo = image(null, 180)
        root.addView(photo)
        button("Choose Order Booker photo") {
            photoCallback = { photoUri = it; photo.setImageURI(Uri.parse(it)) }
            photoPicker.launch(arrayOf("image/*"))
        }
        val name = edit("Full name")
        val username = edit("Username")
        val password = edit("Password", password = true)
        button("Create Order Booker") {
            if (txt(name).isBlank() || txt(username).isBlank() || txt(password).length < 4) return@button toast("تمام معلومات درست درج کریں")
            lifecycleScope.launch {
                if (db.userDao().byUsername(txt(username)) != null) return@launch toast("Username پہلے سے موجود ہے")
                db.userDao().insert(UserEntity(name = txt(name), username = txt(username), passwordHash = Security.sha256(txt(password)), role = "ORDER_BOOKER", photoUri = photoUri))
                toast("Order Booker account بن گیا")
                showSettings()
            }
        }
    }

    private fun showSync() {
        reset("Online Sync")
        back()
        info("آف لائن data device میں محفوظ رہتا ہے۔ HTTPS server URL اور token دینے پر pending data sync ہوگا۔")
        val url = edit("HTTPS Sync Server URL")
        url.setText(prefs.syncBaseUrl)
        val token = edit("Sync token", password = true)
        token.setText(prefs.syncToken)
        button("Save & Sync") {
            prefs.syncBaseUrl = txt(url)
            prefs.syncToken = txt(token)
            queueSync()
            toast("Sync settings محفوظ")
        }
    }

    private fun queueSync() {
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val request = OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(constraints).build()
        WorkManager.getInstance(this).enqueueUniqueWork("order-sync", ExistingWorkPolicy.REPLACE, request)
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
