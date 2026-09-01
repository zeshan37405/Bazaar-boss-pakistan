from pathlib import Path
import re

main_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/MainActivity.kt')
backup_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/util/BackupManager.kt')
sync_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/sync/SyncWorker.kt')
server_path = Path('confectionery_sync_server/server.js')

text = main_path.read_text(encoding='utf-8')

def once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    text = text.replace(old, new, 1)

# Dashboard gains a compact business-menu entry while keeping the existing quick actions.
once('        button("🖼 Customer Catalog — Offline") { showCatalog() }',
     '        button("☰ Business Menu") { showBusinessMenu() }\n        button("🖼 Customer Catalog — Offline") { showCatalog() }',
     'dashboard business menu')

# Replace Parties list with searchable parties, party detail/statement and Take Payment.
pattern = r'    private fun showCustomers\(\) \{.*?\n    \}\n\n    private fun showAddCustomer'
replacement = r'''    private fun showCustomers(query: String = "") {
        reset("Parties")
        back()
        val search = edit("Search Party by name / shop / phone / area")
        search.setText(query)
        button("Search") { showCustomers(txt(search)) }
        button("+ New Party") { showAddCustomer() }
        button("Take Payment") { showTakePayment() }
        lifecycleScope.launch {
            val all = db.customerDao().all()
            val q = query.trim().lowercase()
            val parties = if (q.isBlank()) all else all.filter {
                it.name.lowercase().contains(q) || it.shopName.lowercase().contains(q) ||
                    it.phone.lowercase().contains(q) || it.areaName.lowercase().contains(q)
            }
            info("Parties: ${parties.size} • Total Receivable: Rs ${money(parties.sumOf { it.balance })}")
            if (parties.isEmpty()) info("کوئی matching party نہیں ملی۔")
            parties.forEach { c ->
                val row = LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(0, dp(8), 0, dp(8))
                    setOnClickListener { showPartyDetail(c.id) }
                }
                row.addView(image(c.photoUri, 76))
                row.addView(TextView(this@MainActivity).apply {
                    text = "${c.name}\n${c.shopName.ifBlank { c.areaName }}\n${c.phone}\nBalance: Rs ${money(c.balance)}"
                    textSize = 16f
                    setPadding(dp(12), 0, 0, 0)
                    setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_primary))
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                root.addView(row)
            }
        }
    }

    private fun showPartyDetail(customerId: Long) {
        reset("Party Details")
        back { showCustomers() }
        lifecycleScope.launch {
            val c = db.customerDao().byId(customerId) ?: return@launch showCustomers()
            if (!c.photoUri.isNullOrBlank()) root.addView(image(c.photoUri, 120))
            info("${c.name}\n${c.shopName}\n${c.phone}\n${c.address}\nArea: ${c.areaName}\nOutstanding: Rs ${money(c.balance)}\nCredit Limit: Rs ${money(c.creditLimit)}")
            button("Take Payment from ${c.name}") { showTakePayment(c.id) }
            button("Print Party Statement") {
                lifecycleScope.launch {
                    val orders = db.orderDao().byCustomer(c.id)
                    val payments = db.paymentDao().byCustomer(c.id)
                    val lines = mutableListOf<Pair<Long, String>>()
                    orders.forEach { o -> lines += o.createdAt to "${shortDate(o.createdAt)}  ${o.invoiceNo}  ${o.status}  Rs ${money(o.saleTotal)}" }
                    payments.forEach { p -> lines += p.createdAt to "${shortDate(p.createdAt)}  PAYMENT ${p.method}  -Rs ${money(p.amount)}" }
                    val body = buildString {
                        appendLine(prefs.businessName)
                        appendLine("PARTY STATEMENT")
                        appendLine(c.name)
                        appendLine(c.shopName)
                        appendLine("Area: ${c.areaName}")
                        appendLine("-".repeat(36))
                        lines.sortedBy { it.first }.forEach { appendLine(it.second) }
                        appendLine("-".repeat(36))
                        appendLine("OUTSTANDING: Rs ${money(c.balance)}")
                    }
                    printText("Party-${c.name}", body)
                }
            }
            sectionTitle("Statement / Transactions")
            val orders = db.orderDao().byCustomer(c.id)
            val payments = db.paymentDao().byCustomer(c.id)
            val lines = mutableListOf<Pair<Long, String>>()
            orders.forEach { o ->
                lines += o.createdAt to "${shortDate(o.createdAt)} • ${o.invoiceNo} • ${o.status}\nSale: Rs ${money(o.saleTotal)} • ${o.paymentType} • ${o.bookerName}"
            }
            payments.forEach { p ->
                lines += p.createdAt to "${shortDate(p.createdAt)} • PAYMENT RECEIVED\nRs ${money(p.amount)} • ${p.method} • ${p.bookerName}"
            }
            if (lines.isEmpty()) info("ابھی کوئی transaction نہیں۔")
            lines.sortedByDescending { it.first }.take(100).forEach { info(it.second) }
        }
    }

    private fun showTakePayment(preselectedCustomerId: Long? = null) {
        reset("Take Payment")
        back { if (preselectedCustomerId != null) showPartyDetail(preselectedCustomerId) else showCustomers() }
        lifecycleScope.launch {
            val customers = db.customerDao().all()
            if (customers.isEmpty()) return@launch info("پہلے Party شامل کریں۔")
            val partySpinner = spinner("Party", customers.map { "${it.name} — Balance Rs ${money(it.balance)}" })
            preselectedCustomerId?.let { id -> customers.indexOfFirst { it.id == id }.takeIf { it >= 0 }?.let(partySpinner::setSelection) }
            val amount = edit("Amount received", numeric = true)
            val method = spinner("Payment method", listOf("CASH", "BANK", "ONLINE"))
            val notes = edit("Notes / Reference")
            button("Save Payment") {
                val a = txt(amount).toDoubleOrNull()
                if (a == null || a <= 0) return@button toast("Amount درست درج کریں")
                val c = customers[partySpinner.selectedItemPosition]
                lifecycleScope.launch {
                    db.paymentDao().insert(PaymentEntity(
                        customerId = c.id, customerSyncId = c.syncId, amount = a,
                        direction = "RECEIVED", method = method.selectedItem.toString(), notes = txt(notes),
                        areaName = c.areaName.ifBlank { prefs.deviceAreaName }, bookerName = prefs.deviceBookerName
                    ))
                    db.customerDao().adjustBalance(c.id, -a)
                    queueSync()
                    toast("Payment محفوظ ہوگئی")
                    showPartyDetail(c.id)
                }
            }
        }
    }

    private fun showAddCustomer'''
text, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('parties replace failed')

# Replace Items list with Product / Category / Unit hub, detail and stock transactions.
pattern = r'    private fun showProducts\(\) \{.*?\n    \}\n\n    private fun showAddProduct'
replacement = r'''    private fun showProducts() {
        showItemHub("PRODUCTS")
    }

    private fun showItemHub(tab: String = "PRODUCTS", query: String = "") {
        reset("Items")
        back()
        tabRow(listOf("PRODUCTS", "CATEGORIES", "UNITS"), tab) { showItemHub(it) }
        if (tab == "PRODUCTS") {
            val search = edit("Search Items by Name / Code / Barcode")
            search.setText(query)
            button("Search Items") { showItemHub("PRODUCTS", txt(search)) }
            button("+ Add Product") { showAddProduct() }
        }
        lifecycleScope.launch {
            val products = db.productDao().all()
            when (tab) {
                "CATEGORIES" -> {
                    sectionTitle("Categories")
                    val groups = products.groupBy { it.category.ifBlank { "UNCATEGORIZED" } }.toSortedMap()
                    if (groups.isEmpty()) info("کوئی category موجود نہیں۔")
                    groups.forEach { (name, items) ->
                        button("$name  (${items.size})") { showItemHub("PRODUCTS", name) }
                    }
                }
                "UNITS" -> {
                    sectionTitle("Units in Use")
                    val units = db.productUnitPriceDao().all()
                    val counts = units.groupingBy { it.unitCode }.eachCount().toSortedMap()
                    unitSuggestions.filter { it !in counts }.forEach { code -> if (products.any { it.unit == code }) counts[code] = 1 }
                    if (counts.isEmpty()) info("Units ابھی استعمال نہیں ہوئے۔")
                    counts.forEach { (unit, count) -> info("$unit  •  $count item setup(s)") }
                    info("Available suggestions: ${unitSuggestions.joinToString(", ")}")
                }
                else -> {
                    val q = query.trim().lowercase()
                    val filtered = if (q.isBlank()) products else products.filter {
                        it.name.lowercase().contains(q) || it.sku.lowercase().contains(q) ||
                            it.barcode.lowercase().contains(q) || it.category.lowercase().contains(q)
                    }
                    val lowIds = db.productDao().lowStock().map { it.id }.toSet()
                    info("Products: ${filtered.size}")
                    if (filtered.isEmpty()) info("کوئی matching item نہیں ملا۔")
                    filtered.forEach { p ->
                        val units = db.productUnitPriceDao().forProduct(p.id)
                        val row = LinearLayout(this@MainActivity).apply {
                            orientation = LinearLayout.HORIZONTAL
                            gravity = Gravity.CENTER_VERTICAL
                            setPadding(0, dp(8), 0, dp(8))
                            setOnClickListener { showItemDetails(p.id) }
                        }
                        row.addView(image(p.photoUri, 82))
                        row.addView(TextView(this@MainActivity).apply {
                            val unitLine = units.take(3).joinToString(" • ") { "${it.unitCode} ${money(it.retailRate)}" }
                            val purchase = if (prefs.purchaseRatesUnlocked) "\nPurchase: Rs ${money(p.purchaseRate)}" else ""
                            val low = if (p.id in lowIds) "  ⚠ LOW" else ""
                            text = "${p.name}\n${p.category} • ${p.sku}\nSale: Rs ${money(p.saleRate)}$purchase\nStock: ${p.stockQty} ${p.unit}$low\n$unitLine"
                            textSize = 15f
                            setPadding(dp(12), 0, 0, 0)
                            setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_primary))
                        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                        root.addView(row)
                    }
                }
            }
        }
    }

    private fun showItemDetails(productId: Long) {
        reset("Item Details")
        back { showProducts() }
        lifecycleScope.launch {
            val p = db.productDao().byId(productId) ?: return@launch showProducts()
            if (!p.photoUri.isNullOrBlank()) root.addView(image(p.photoUri, 130))
            val purchase = if (prefs.purchaseRatesUnlocked) "Rs ${money(p.purchaseRate)}" else "HIDDEN"
            info("${p.name}\nCategory: ${p.category}\nCode: ${p.sku}\nBarcode: ${p.barcode}\nSale Price: Rs ${money(p.saleRate)}\nPurchase Price: $purchase\nIn Stock: ${p.stockQty} ${p.unit}\nStock Value (sale): Rs ${money(p.stockQty * p.saleRate)}")
            sectionTitle("Units & Prices")
            db.productUnitPriceDao().forProduct(p.id).forEach { u ->
                val pur = if (prefs.purchaseRatesUnlocked) " • Purchase ${money(u.purchaseRate)}" else ""
                info("1 ${u.unitCode} = ${u.conversionToBase} ${p.unit}\nRetail ${money(u.retailRate)} • Wholesale ${money(u.wholesaleRate)} • Super Wholesale ${money(u.superWholesaleRate)}$pur")
            }
            button("Adjust Stock") { showAdjustStock(p.id) }
            sectionTitle("Stock Transactions")
            val moves = db.stockMovementDao().forProduct(p.id)
            if (moves.isEmpty()) info("ابھی stock transaction history نہیں۔")
            moves.take(100).forEach { m ->
                info("${shortDate(m.createdAt)} • ${m.movementType}\n${if (m.qtyBase >= 0) "+" else ""}${m.qtyBase} ${p.unit} • ${m.reference}\n${m.notes}")
            }
        }
    }

    private fun showAdjustStock(productId: Long) {
        reset("Adjust Stock")
        back { showItemDetails(productId) }
        lifecycleScope.launch {
            val p = db.productDao().byId(productId) ?: return@launch showProducts()
            info("${p.name}\nCurrent stock: ${p.stockQty} ${p.unit}")
            val action = spinner("Action", listOf("ADD STOCK", "REMOVE STOCK", "SET STOCK"))
            val qty = edit("Quantity in ${p.unit}", numeric = true)
            val notes = edit("Reason / Notes")
            button("Save Stock Adjustment") {
                val value = txt(qty).toDoubleOrNull()
                if (value == null || value < 0) return@button toast("Quantity درست درج کریں")
                lifecycleScope.launch {
                    val delta = when (action.selectedItem.toString()) {
                        "REMOVE STOCK" -> -value
                        "SET STOCK" -> value - p.stockQty
                        else -> value
                    }
                    if (p.stockQty + delta < 0) return@launch toast("Stock صفر سے کم نہیں ہو سکتا")
                    db.productDao().adjustStock(p.id, delta)
                    db.stockMovementDao().insert(StockMovementEntity(
                        productId = p.id, productSyncId = p.syncId,
                        movementType = action.selectedItem.toString(), qtyBase = delta,
                        unitLabel = p.unit, reference = "MANUAL", notes = txt(notes)
                    ))
                    queueSync(); toast("Stock updated"); showItemDetails(p.id)
                }
            }
        }
    }

    private fun showAddProduct'''
text, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('items replace failed')

# Professional add-item flow with unit conversion presets and tiered prices.
pattern = r'    private fun showAddProduct\(\) \{.*?\n    \}\n\n    private fun fallbackUnit'
replacement = r'''    private fun showAddProduct() {
        reset("Add Item")
        back { showProducts() }
        var photoUri: String? = null
        val photo = image(null, 170); root.addView(photo)
        button("Choose Catalog Photo") {
            photoCallback = { uri ->
                runCatching { ImageStore.importImage(this, uri, "product") }
                    .onSuccess { stored -> photoUri = stored; photo.setImageURI(Uri.parse(stored)) }
                    .onFailure { toast("Image save failed") }
            }
            photoPicker.launch(arrayOf("image/*"))
        }
        sectionTitle("Item Information")
        val name = edit("Item Name *")
        val sku = edit("Item Code")
        val barcode = edit("Barcode / Scan Code")
        val category = edit("Item Category")

        sectionTitle("Units & Conversion")
        val primaryUnit = spinner("Primary / Stock Unit", unitSuggestions)
        val secondaryUnit = spinner("Secondary Unit", unitSuggestions)
        secondaryUnit.setSelection(1)
        val conversionPreset = spinner("Conversion Suggestion", listOf("CUSTOM", "6", "10", "12", "20", "24", "30", "36", "40", "48", "50", "60", "72", "75", "100", "120", "144", "150"))
        val secondaryConversion = edit("1 Secondary Unit = how many Primary Units?", numeric = true)
        conversionPreset.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                val v = conversionPreset.selectedItem.toString()
                if (v != "CUSTOM") secondaryConversion.setText(v)
            }
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
        }
        val thirdUnit = spinner("Third Unit (optional)", listOf("NONE") + unitSuggestions)
        val thirdConversion = edit("Third Unit conversion to Primary", numeric = true)

        sectionTitle("Pricing — Primary Unit")
        val pPurchase = edit("Purchase Price", numeric = true)
        val pRetail = edit("Sale / Retail Price", numeric = true)
        val pWholesale = edit("Wholesale Price", numeric = true)
        val pSuper = edit("Super Wholesale Price", numeric = true)

        sectionTitle("Pricing — Secondary Unit")
        val sPurchase = edit("Secondary Purchase Price", numeric = true)
        val sRetail = edit("Secondary Sale Price", numeric = true)
        val sWholesale = edit("Secondary Wholesale Price", numeric = true)
        val sSuper = edit("Secondary Super Wholesale Price", numeric = true)

        sectionTitle("Pricing — Third Unit (optional)")
        val tPurchase = edit("Third Purchase Price", numeric = true)
        val tRetail = edit("Third Sale Price", numeric = true)
        val tWholesale = edit("Third Wholesale Price", numeric = true)
        val tSuper = edit("Third Super Wholesale Price", numeric = true)

        sectionTitle("Stock")
        val stock = edit("Opening Stock in Primary Unit", numeric = true)
        val minStock = edit("Low Stock Alert", numeric = true)
        val batch = edit("Batch No (optional)")
        val expiry = edit("Expiry Date e.g. 2027-12-31")
        val tax = edit("Tax % (optional)", numeric = true)
        button("Save Item") {
            val pr = txt(pPurchase).toDoubleOrNull()
            val retail = txt(pRetail).toDoubleOrNull()
            val conv2 = txt(secondaryConversion).toDoubleOrNull()
            val retail2 = txt(sRetail).toDoubleOrNull()
            if (txt(name).isBlank() || pr == null || retail == null || conv2 == null || conv2 <= 0 || retail2 == null) {
                return@button toast("Item name, primary price اور secondary unit conversion/rate ضروری ہیں")
            }
            val u1 = primaryUnit.selectedItem.toString()
            val u2 = secondaryUnit.selectedItem.toString()
            if (u1 == u2) return@button toast("Primary اور Secondary unit مختلف ہونے چاہئیں")
            val opening = txt(stock).toDoubleOrNull() ?: 0.0
            lifecycleScope.launch {
                val wholesale1 = txt(pWholesale).toDoubleOrNull() ?: 0.0
                val super1 = txt(pSuper).toDoubleOrNull() ?: 0.0
                val productId = db.productDao().insert(ProductEntity(
                    name = txt(name), sku = txt(sku), barcode = txt(barcode), category = txt(category),
                    unit = u1, photoUri = photoUri, purchaseRate = pr, saleRate = retail,
                    wholesaleRate = wholesale1, superWholesaleRate = super1,
                    stockQty = opening, minStockQty = txt(minStock).toDoubleOrNull() ?: 0.0,
                    batchNo = txt(batch), expiryDate = txt(expiry), taxPercent = txt(tax).toDoubleOrNull() ?: 0.0
                ))
                val product = db.productDao().byId(productId) ?: return@launch
                val units = mutableListOf(
                    ProductUnitPriceEntity(productId = productId, unitCode = u1, conversionToBase = 1.0,
                        purchaseRate = pr, retailRate = retail, wholesaleRate = wholesale1, superWholesaleRate = super1),
                    ProductUnitPriceEntity(productId = productId, unitCode = u2, conversionToBase = conv2,
                        purchaseRate = txt(sPurchase).toDoubleOrNull() ?: pr * conv2,
                        retailRate = retail2, wholesaleRate = txt(sWholesale).toDoubleOrNull() ?: 0.0,
                        superWholesaleRate = txt(sSuper).toDoubleOrNull() ?: 0.0)
                )
                val u3 = thirdUnit.selectedItem.toString()
                val conv3 = txt(thirdConversion).toDoubleOrNull()
                val retail3 = txt(tRetail).toDoubleOrNull()
                if (u3 != "NONE" && conv3 != null && conv3 > 0 && retail3 != null && u3 != u1 && u3 != u2) {
                    units += ProductUnitPriceEntity(productId = productId, unitCode = u3, conversionToBase = conv3,
                        purchaseRate = txt(tPurchase).toDoubleOrNull() ?: pr * conv3,
                        retailRate = retail3, wholesaleRate = txt(tWholesale).toDoubleOrNull() ?: 0.0,
                        superWholesaleRate = txt(tSuper).toDoubleOrNull() ?: 0.0)
                }
                db.productUnitPriceDao().insertAll(units)
                if (opening != 0.0) db.stockMovementDao().insert(StockMovementEntity(
                    productId = productId, productSyncId = product.syncId, movementType = "OPENING STOCK",
                    qtyBase = opening, unitLabel = u1, reference = "OPENING", notes = "Opening stock"
                ))
                queueSync(); toast("Item محفوظ ہوگیا"); showItemDetails(productId)
            }
        }
    }

    private fun fallbackUnit'''
text, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('add product replace failed')

# Billing now records stock movements as well as updating stock quantity.
pattern = r'    private suspend fun applyBilling\(orderId: Long\) \{.*?\n    \}\n\n    private fun printAreaSheet'
replacement = r'''    private suspend fun applyBilling(orderId: Long) {
        val order = db.orderDao().byId(orderId) ?: return
        if (order.status == "BILLED") return
        db.orderDao().items(orderId).forEach { item ->
            if (item.productId > 0) {
                val base = item.baseQty.takeIf { it > 0 } ?: item.qty
                db.productDao().adjustStock(item.productId, -base)
                db.stockMovementDao().insert(StockMovementEntity(
                    productId = item.productId, productSyncId = item.productSyncId,
                    movementType = "SALE", qtyBase = -base, unitLabel = item.unit,
                    reference = order.invoiceNo, notes = "Billed to ${order.customerSyncId}"
                ))
            }
        }
        if (order.paymentType == "CREDIT" && order.customerId > 0) db.customerDao().adjustBalance(order.customerId, order.saleTotal)
        db.orderDao().setStatus(orderId, "BILLED")
    }

    private fun printAreaSheet'''
text, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('billing stock movement replace failed')

# Replace simple report summary with a structured report centre inspired by business-accounting workflows.
pattern = r'    private fun showReports\(\) \{.*?\n    \}\n\n    private fun showExpenses'
replacement = r'''    private fun showReports() {
        reset("Reports")
        back()
        sectionTitle("Transaction")
        button("Sale Report") { showReport("SALE") }
        button("Day Book") { showReport("DAYBOOK") }
        button("All Transactions") { showReport("ALL_TX") }
        button("Bill Wise Profit") { showReport("BILL_PROFIT") }
        button("Profit & Loss") { showReport("PROFIT_LOSS") }
        button("Cashflow") { showCashBank() }

        sectionTitle("Party Reports")
        button("Party Statement") { showReport("PARTY_STATEMENT") }
        button("Party Wise Profit & Loss") { showReport("PARTY_PROFIT") }
        button("All Parties Report") { showReport("ALL_PARTIES") }
        button("Party Report by Items") { showPartyItemReport() }
        button("Sale by Party") { showReport("SALE_BY_PARTY") }

        sectionTitle("Item / Stock Reports")
        button("Stock Summary Report") { showReport("STOCK_SUMMARY") }
        button("Item Wise Profit & Loss") { showReport("ITEM_PROFIT") }
        button("Low Stock Summary Report") { showReport("LOW_STOCK") }
        button("Item Detail Report") { showReport("ITEM_DETAIL") }
        button("Stock Detail Report") { showReport("STOCK_DETAIL") }
        button("Sale by Item Category") { showReport("CATEGORY_SALES") }
        button("Item Batch / Expiry Report") { showReport("BATCH") }
        button("Item Wise Discount") { showReport("DISCOUNT") }

        sectionTitle("Business Status")
        button("Cash & Bank") { showCashBank() }
        button("Discount Report") { showReport("DISCOUNT") }

        sectionTitle("Taxes")
        button("Tax Report") { showReport("TAX") }
        button("Tax Rate Report") { showReport("TAX_RATE") }

        sectionTitle("Expense Reports")
        button("Expense Summary") { showReport("EXPENSE") }
        button("Expense by Area") { showReport("EXPENSE_AREA") }
    }

    private fun showReport(code: String) {
        reset("Report")
        back { showReports() }
        lifecycleScope.launch {
            val orders = db.orderDao().all()
            val billed = orders.filter { it.status == "BILLED" }
            val customers = db.customerDao().all()
            val products = db.productDao().all()
            val items = db.orderDao().allItems()
            val payments = db.paymentDao().all()
            val expenses = db.expenseDao().all()
            when (code) {
                "SALE" -> {
                    sectionTitle("Sale Report")
                    info("Bills: ${billed.size}\nTotal Sales: Rs ${money(billed.sumOf { it.saleTotal })}\nTax: Rs ${money(billed.sumOf { it.taxTotal })}\nDiscount: Rs ${money(billed.sumOf { it.discount })}")
                    billed.take(100).forEach { o -> info("${shortDate(o.createdAt)} • ${o.invoiceNo} • ${o.areaName}\nRs ${money(o.saleTotal)} • ${o.bookerName}") }
                }
                "DAYBOOK", "ALL_TX" -> {
                    sectionTitle(if (code == "DAYBOOK") "Day Book" else "All Transactions")
                    val lines = mutableListOf<Pair<Long, String>>()
                    orders.forEach { o -> lines += o.createdAt to "SALE/ORDER • ${o.invoiceNo} • ${o.status} • Rs ${money(o.saleTotal)}" }
                    payments.forEach { p -> lines += p.createdAt to "PAYMENT RECEIVED • ${p.method} • Rs ${money(p.amount)}" }
                    expenses.forEach { e -> lines += e.createdAt to "EXPENSE • ${e.title} • Rs ${money(e.amount)}" }
                    lines.sortedByDescending { it.first }.take(if (code == "DAYBOOK") 50 else 200).forEach { info("${shortDate(it.first)}\n${it.second}") }
                }
                "BILL_PROFIT" -> {
                    sectionTitle("Bill Wise Profit")
                    billed.forEach { o ->
                        val profit = o.saleTotal - o.purchaseTotal - o.discount
                        info("${o.invoiceNo} • ${shortDate(o.createdAt)}\nSale Rs ${money(o.saleTotal)} • Cost Rs ${money(o.purchaseTotal)}\nProfit Rs ${money(profit)}")
                    }
                }
                "PROFIT_LOSS" -> {
                    sectionTitle("Profit & Loss")
                    val sales = billed.sumOf { it.saleTotal }
                    val cost = billed.sumOf { it.purchaseTotal }
                    val discounts = billed.sumOf { it.discount }
                    val exp = expenses.sumOf { it.amount }
                    info("Sales: Rs ${money(sales)}\nCost of Goods: Rs ${money(cost)}\nDiscounts: Rs ${money(discounts)}\nGross Profit: Rs ${money(sales - cost - discounts)}\nExpenses: Rs ${money(exp)}\nNet Profit: Rs ${money(sales - cost - discounts - exp)}")
                }
                "PARTY_STATEMENT" -> {
                    sectionTitle("Party Statement")
                    if (customers.isEmpty()) return@launch info("No parties")
                    val s = spinner("Select Party", customers.map { it.name })
                    button("Open Statement") { showPartyDetail(customers[s.selectedItemPosition].id) }
                }
                "PARTY_PROFIT", "SALE_BY_PARTY" -> {
                    sectionTitle(if (code == "PARTY_PROFIT") "Party Wise Profit & Loss" else "Sale by Party")
                    customers.forEach { c ->
                        val rows = billed.filter { it.customerId == c.id }
                        if (rows.isNotEmpty()) {
                            val sale = rows.sumOf { it.saleTotal }
                            val profit = rows.sumOf { it.saleTotal - it.purchaseTotal - it.discount }
                            info("${c.name}\nSales Rs ${money(sale)}${if (code == "PARTY_PROFIT") " • Profit Rs ${money(profit)}" else ""}")
                        }
                    }
                }
                "ALL_PARTIES" -> {
                    sectionTitle("All Parties Report")
                    info("Total Receivable: Rs ${money(customers.sumOf { it.balance })}")
                    customers.forEach { c -> info("${c.name} • ${c.areaName}\nBalance Rs ${money(c.balance)} • Credit Limit Rs ${money(c.creditLimit)}") }
                }
                "STOCK_SUMMARY" -> {
                    sectionTitle("Stock Summary Report")
                    val purchaseValue = products.sumOf { it.stockQty * it.purchaseRate }
                    val saleValue = products.sumOf { it.stockQty * it.saleRate }
                    info("Products: ${products.size}\nStock Purchase Value: Rs ${money(purchaseValue)}\nStock Sale Value: Rs ${money(saleValue)}")
                    products.forEach { p -> info("${p.name}\n${p.stockQty} ${p.unit} • Sale Value Rs ${money(p.stockQty * p.saleRate)}") }
                }
                "ITEM_PROFIT" -> {
                    sectionTitle("Item Wise Profit & Loss")
                    val billedIds = billed.map { it.id }.toSet()
                    items.filter { it.orderId in billedIds }.groupBy { it.productName }.toSortedMap().forEach { (name, rows) ->
                        val revenue = rows.sumOf { it.saleRate * it.qty }
                        val cost = rows.sumOf { it.purchaseRate * it.qty }
                        info("$name\nSales Rs ${money(revenue)} • Cost Rs ${money(cost)} • Profit Rs ${money(revenue - cost)}")
                    }
                }
                "LOW_STOCK" -> {
                    sectionTitle("Low Stock Summary")
                    val low = db.productDao().lowStock()
                    if (low.isEmpty()) info("Low-stock item نہیں۔")
                    low.forEach { p -> info("${p.name}\nStock ${p.stockQty} ${p.unit} • Alert ${p.minStockQty}") }
                }
                "ITEM_DETAIL" -> {
                    sectionTitle("Item Detail Report")
                    if (products.isEmpty()) return@launch info("No items")
                    val s = spinner("Select Item", products.map { it.name })
                    button("Open Item Details") { showItemDetails(products[s.selectedItemPosition].id) }
                }
                "STOCK_DETAIL" -> {
                    sectionTitle("Stock Detail Report")
                    val productMap = products.associateBy { it.id }
                    val moves = db.stockMovementDao().all()
                    if (moves.isEmpty()) info("No stock movements")
                    moves.take(200).forEach { m -> info("${shortDate(m.createdAt)} • ${productMap[m.productId]?.name ?: "Item"}\n${m.movementType} • ${if (m.qtyBase >= 0) "+" else ""}${m.qtyBase} • ${m.reference}") }
                }
                "CATEGORY_SALES" -> {
                    sectionTitle("Sale by Item Category")
                    val billedIds = billed.map { it.id }.toSet()
                    val productMap = products.associateBy { it.id }
                    items.filter { it.orderId in billedIds }.groupBy { productMap[it.productId]?.category?.ifBlank { "UNCATEGORIZED" } ?: "UNCATEGORIZED" }
                        .toSortedMap().forEach { (cat, rows) -> info("$cat\nSales Rs ${money(rows.sumOf { it.lineTotal })} • Lines ${rows.size}") }
                }
                "BATCH" -> {
                    sectionTitle("Item Batch / Expiry Report")
                    val rows = products.filter { it.batchNo.isNotBlank() || it.expiryDate.isNotBlank() }
                    if (rows.isEmpty()) info("Batch/expiry data موجود نہیں۔")
                    rows.forEach { p -> info("${p.name}\nBatch: ${p.batchNo.ifBlank { "-" }} • Expiry: ${p.expiryDate.ifBlank { "-" }} • Stock ${p.stockQty}") }
                }
                "DISCOUNT" -> {
                    sectionTitle("Discount Report")
                    val rows = orders.filter { it.discount > 0 }
                    info("Total Discount: Rs ${money(rows.sumOf { it.discount })}")
                    rows.forEach { o -> info("${o.invoiceNo} • ${shortDate(o.createdAt)} • Discount Rs ${money(o.discount)}") }
                }
                "TAX" -> {
                    sectionTitle("Tax Report")
                    info("Tax collected on billed invoices: Rs ${money(billed.sumOf { it.taxTotal })}")
                    billed.filter { it.taxTotal > 0 }.forEach { o -> info("${o.invoiceNo} • Tax Rs ${money(o.taxTotal)} • Sale Rs ${money(o.saleTotal)}") }
                }
                "TAX_RATE" -> {
                    sectionTitle("Tax Rate Report")
                    products.groupBy { it.taxPercent }.toSortedMap().forEach { (rate, rows) -> info("${money(rate)}% • ${rows.size} item(s)") }
                }
                "EXPENSE" -> {
                    sectionTitle("Expense Summary")
                    info("Total Expenses: Rs ${money(expenses.sumOf { it.amount })}")
                    expenses.take(100).forEach { e -> info("${shortDate(e.createdAt)} • ${e.title}\nRs ${money(e.amount)} • ${e.paymentType} • ${e.areaName}") }
                }
                "EXPENSE_AREA" -> {
                    sectionTitle("Expense by Area")
                    expenses.groupBy { it.areaName.ifBlank { "NO AREA" } }.toSortedMap().forEach { (area, rows) -> info("$area\nRs ${money(rows.sumOf { it.amount })} • ${rows.size} entries") }
                }
            }
        }
    }

    private fun showPartyItemReport() {
        reset("Party Report by Items")
        back { showReports() }
        lifecycleScope.launch {
            val customers = db.customerDao().all()
            if (customers.isEmpty()) return@launch info("No parties")
            val s = spinner("Party", customers.map { it.name })
            button("Generate") {
                val c = customers[s.selectedItemPosition]
                lifecycleScope.launch {
                    reset("Items — ${c.name}")
                    back { showPartyItemReport() }
                    val orders = db.orderDao().byCustomer(c.id)
                    val ids = orders.map { it.id }.toSet()
                    val rows = db.orderDao().allItems().filter { it.orderId in ids }
                    if (rows.isEmpty()) info("No item history")
                    rows.groupBy { it.productName }.toSortedMap().forEach { (name, values) ->
                        info("$name\nQty ${money(values.sumOf { it.qty })} • Sales Rs ${money(values.sumOf { it.lineTotal })}")
                    }
                }
            }
        }
    }

    private fun showCashBank() {
        reset("Cash & Bank")
        back { showReports() }
        lifecycleScope.launch {
            val billed = db.orderDao().all().filter { it.status == "BILLED" }
            val payments = db.paymentDao().all()
            val expenses = db.expenseDao().all()
            fun sales(method: String) = billed.filter { it.paymentType == method }.sumOf { it.saleTotal }
            fun receipts(method: String) = payments.filter { it.direction == "RECEIVED" && it.method == method }.sumOf { it.amount }
            fun out(method: String) = expenses.filter { it.paymentType == method }.sumOf { it.amount }
            listOf("CASH", "BANK", "ONLINE").forEach { method ->
                val incoming = sales(method) + receipts(method)
                val outgoing = out(method)
                sectionTitle(method)
                info("Sales/Receipts: Rs ${money(incoming)}\nExpenses: Rs ${money(outgoing)}\nNet Movement: Rs ${money(incoming - outgoing)}")
            }
        }
    }

    private fun showBusinessMenu() {
        reset("Business Menu")
        back()
        sectionTitle("Master Data")
        button("👥 Parties") { showCustomers() }
        button("📦 Items") { showProducts() }
        button("🖼 Customer Catalog") { showCatalog() }
        sectionTitle("Sales")
        button("🛒 New Order / Sale") { showNewOrder() }
        button("📍 Area-wise Billing") { showAreaBilling() }
        button("🧾 Orders / Invoices") { showOrders() }
        button("💳 Take Payment") { showTakePayment() }
        sectionTitle("Business")
        button("📊 Reports") { showReports() }
        button("💸 Expense") { showExpenses() }
        button("🏦 Cash & Bank") { showCashBank() }
        sectionTitle("System")
        button("☁ Sync & Share") { showSync() }
        button("💾 Backup / Restore") { showBackup() }
        button("🖨 Printer / Thermal Printer") { showPrinterSettings() }
        button("⚙ Settings") { showSettings() }
    }

    private fun showExpenses'''
text, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('reports replace failed')

# Add UI helpers near existing generic button helper.
anchor = '    private fun button(label: String, action: () -> Unit): Button {'
if anchor not in text:
    raise SystemExit('button helper anchor missing')
helpers = r'''    private fun sectionTitle(value: String) {
        root.addView(TextView(this).apply {
            text = value
            textSize = 20f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_primary))
            setPadding(dp(4), dp(18), dp(4), dp(8))
        })
    }

    private fun tabRow(labels: List<String>, active: String, onSelect: (String) -> Unit) {
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        labels.forEach { label ->
            val b = Button(this).apply {
                text = label
                isAllCaps = false
                textSize = 13f
                alpha = if (label == active) 1f else 0.70f
                backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this@MainActivity, if (label == active) R.color.brand_primary else R.color.surface))
                setTextColor(ContextCompat.getColor(this@MainActivity, if (label == active) android.R.color.white else R.color.text_primary))
                setOnClickListener { onSelect(label) }
            }
            row.addView(b, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        root.addView(row)
    }

    private fun shortDate(time: Long): String = SimpleDateFormat("dd-MM-yyyy", Locale.getDefault()).format(Date(time))

'''
text = text.replace(anchor, helpers + anchor, 1)
main_path.write_text(text, encoding='utf-8')

# Backup V6: include payments and stock movements in portable backups.
b = backup_path.read_text(encoding='utf-8')
if 'const val FORMAT_VERSION = 5' in b:
    b = b.replace('const val FORMAT_VERSION = 5', 'const val FORMAT_VERSION = 6', 1)
elif 'const val FORMAT_VERSION = 4' in b:
    b = b.replace('const val FORMAT_VERSION = 4', 'const val FORMAT_VERSION = 6', 1)
else:
    raise SystemExit('backup format anchor missing')

b = b.replace('        val expenses = db.expenseDao().all()\n        val createdAt = System.currentTimeMillis()',
              '        val expenses = db.expenseDao().all()\n        val payments = db.paymentDao().all()\n        val stockMovements = db.stockMovementDao().all()\n        val createdAt = System.currentTimeMillis()', 1)

expense_block = '''            root.put("expenses", JSONArray().apply {\n                expenses.forEach { e -> put(JSONObject()\n                    .put("id", e.id).put("title", e.title).put("amount", e.amount).put("payment_type", e.paymentType)\n                    .put("area_name", e.areaName).put("booker_name", e.bookerName).put("notes", e.notes)\n                    .put("created_at", e.createdAt).put("sync_id", e.syncId).put("synced", e.synced)) }\n            })\n'''
if expense_block not in b:
    raise SystemExit('backup expense block missing')
extra_backup = expense_block + '''\n            root.put("payments", JSONArray().apply {\n                payments.forEach { p -> put(JSONObject()\n                    .put("id", p.id).put("customer_id", p.customerId).put("customer_sync_id", p.customerSyncId)\n                    .put("amount", p.amount).put("direction", p.direction).put("method", p.method).put("notes", p.notes)\n                    .put("area_name", p.areaName).put("booker_name", p.bookerName).put("created_at", p.createdAt)\n                    .put("sync_id", p.syncId).put("synced", p.synced)) }\n            })\n\n            root.put("stock_movements", JSONArray().apply {\n                stockMovements.forEach { m -> put(JSONObject()\n                    .put("id", m.id).put("product_id", m.productId).put("product_sync_id", m.productSyncId)\n                    .put("movement_type", m.movementType).put("qty_base", m.qtyBase).put("unit_label", m.unitLabel)\n                    .put("reference", m.reference).put("notes", m.notes).put("created_at", m.createdAt)\n                    .put("sync_id", m.syncId).put("synced", m.synced)) }\n            })\n'''
b = b.replace(expense_block, extra_backup, 1)

b = b.replace('        val expensesJson = root.optJSONArray("expenses") ?: JSONArray()\n',
              '        val expensesJson = root.optJSONArray("expenses") ?: JSONArray()\n        val paymentsJson = root.optJSONArray("payments") ?: JSONArray()\n        val stockMovementsJson = root.optJSONArray("stock_movements") ?: JSONArray()\n', 1)

settings_anchor = '        val settings = root.optJSONObject("settings") ?: JSONObject()\n'
if settings_anchor not in b:
    raise SystemExit('backup restore settings anchor missing')
restore_extra = '''        val payments = buildList {\n            for (n in 0 until paymentsJson.length()) paymentsJson.getJSONObject(n).let { j -> add(PaymentEntity(\n                id = j.optLong("id"), customerId = j.optLong("customer_id"), customerSyncId = j.optString("customer_sync_id"),\n                amount = j.optDouble("amount", 0.0), direction = j.optString("direction", "RECEIVED"),\n                method = j.optString("method", "CASH"), notes = j.optString("notes"), areaName = j.optString("area_name"),\n                bookerName = j.optString("booker_name"), createdAt = j.optLong("created_at", System.currentTimeMillis()),\n                syncId = j.optString("sync_id"), synced = j.optBoolean("synced", false)\n            )) }\n        }\n        if (payments.isNotEmpty()) db.paymentDao().insertAll(payments)\n\n        val stockMovements = buildList {\n            for (n in 0 until stockMovementsJson.length()) stockMovementsJson.getJSONObject(n).let { j -> add(StockMovementEntity(\n                id = j.optLong("id"), productId = j.optLong("product_id"), productSyncId = j.optString("product_sync_id"),\n                movementType = j.optString("movement_type"), qtyBase = j.optDouble("qty_base", 0.0),\n                unitLabel = j.optString("unit_label"), reference = j.optString("reference"), notes = j.optString("notes"),\n                createdAt = j.optLong("created_at", System.currentTimeMillis()), syncId = j.optString("sync_id"),\n                synced = j.optBoolean("synced", false)\n            )) }\n        }\n        if (stockMovements.isNotEmpty()) db.stockMovementDao().insertAll(stockMovements)\n\n'''
b = b.replace(settings_anchor, restore_extra + settings_anchor, 1)
backup_path.write_text(b, encoding='utf-8')

# Sync V6: payments and stock movements travel with the same business exchange.
s = sync_path.read_text(encoding='utf-8')
s = s.replace('        val expenses = db.expenseDao().pending()\n',
              '        val expenses = db.expenseDao().pending()\n        val payments = db.paymentDao().pending()\n        val stockMovements = db.stockMovementDao().pending()\n', 1)

expense_arr = '''        val expenseArr = JSONArray().apply {\n            expenses.forEach { e -> put(JSONObject().put("sync_id", e.syncId).put("title", e.title)\n                .put("amount", e.amount).put("payment_type", e.paymentType).put("area_name", e.areaName)\n                .put("booker_name", e.bookerName).put("notes", e.notes).put("created_at", e.createdAt)) }\n        }\n'''
if expense_arr not in s:
    raise SystemExit('sync expense array anchor missing')
sync_extra = expense_arr + '''\n        val paymentArr = JSONArray().apply {\n            payments.forEach { p -> put(JSONObject().put("sync_id", p.syncId).put("customer_sync_id", p.customerSyncId)\n                .put("amount", p.amount).put("direction", p.direction).put("method", p.method).put("notes", p.notes)\n                .put("area_name", p.areaName).put("booker_name", p.bookerName).put("created_at", p.createdAt)) }\n        }\n\n        val stockMovementArr = JSONArray().apply {\n            stockMovements.forEach { m -> put(JSONObject().put("sync_id", m.syncId).put("product_sync_id", m.productSyncId)\n                .put("movement_type", m.movementType).put("qty_base", m.qtyBase).put("unit_label", m.unitLabel)\n                .put("reference", m.reference).put("notes", m.notes).put("created_at", m.createdAt)) }\n        }\n'''
s = s.replace(expense_arr, sync_extra, 1)
s = s.replace('                .put("orders", orderArr).put("expenses", expenseArr)\n',
              '                .put("orders", orderArr).put("expenses", expenseArr)\n                .put("payments", paymentArr).put("stock_movements", stockMovementArr)\n', 1)
s = s.replace('            if (expenses.isNotEmpty()) db.expenseDao().markSynced(expenses.map { it.id })\n',
              '            if (expenses.isNotEmpty()) db.expenseDao().markSynced(expenses.map { it.id })\n            if (payments.isNotEmpty()) db.paymentDao().markSynced(payments.map { it.id })\n            if (stockMovements.isNotEmpty()) db.stockMovementDao().markSynced(stockMovements.map { it.id })\n', 1)

apply_end = '''        val expenses = root.optJSONArray("expenses") ?: JSONArray()\n        for (n in 0 until expenses.length()) {\n            val j = expenses.getJSONObject(n); val syncId = j.optString("sync_id"); if (syncId.isBlank()) continue\n            val old = db.expenseDao().bySyncId(syncId)\n            val value = ExpenseEntity(id = old?.id ?: 0, title = j.optString("title"), amount = j.optDouble("amount", 0.0),\n                paymentType = j.optString("payment_type", "CASH"), areaName = j.optString("area_name"), bookerName = j.optString("booker_name"),\n                notes = j.optString("notes"), createdAt = j.optLong("created_at", System.currentTimeMillis()), syncId = syncId, synced = true)\n            if (old == null) db.expenseDao().insert(value) else db.expenseDao().update(value)\n        }\n'''
if apply_end not in s:
    raise SystemExit('sync apply expenses anchor missing')
apply_extra = apply_end + '''\n        val payments = root.optJSONArray("payments") ?: JSONArray()\n        for (n in 0 until payments.length()) {\n            val j = payments.getJSONObject(n); val syncId = j.optString("sync_id"); if (syncId.isBlank()) continue\n            val old = db.paymentDao().bySyncId(syncId)\n            val customerSyncId = j.optString("customer_sync_id")\n            val value = PaymentEntity(id = old?.id ?: 0, customerId = db.customerDao().bySyncId(customerSyncId)?.id ?: 0,\n                customerSyncId = customerSyncId, amount = j.optDouble("amount", 0.0), direction = j.optString("direction", "RECEIVED"),\n                method = j.optString("method", "CASH"), notes = j.optString("notes"), areaName = j.optString("area_name"),\n                bookerName = j.optString("booker_name"), createdAt = j.optLong("created_at", System.currentTimeMillis()), syncId = syncId, synced = true)\n            if (old == null) db.paymentDao().insert(value) else db.paymentDao().update(value)\n        }\n\n        val stockMovements = root.optJSONArray("stock_movements") ?: JSONArray()\n        for (n in 0 until stockMovements.length()) {\n            val j = stockMovements.getJSONObject(n); val syncId = j.optString("sync_id"); if (syncId.isBlank()) continue\n            val old = db.stockMovementDao().bySyncId(syncId)\n            val productSyncId = j.optString("product_sync_id")\n            val value = StockMovementEntity(id = old?.id ?: 0, productId = db.productDao().bySyncId(productSyncId)?.id ?: 0,\n                productSyncId = productSyncId, movementType = j.optString("movement_type"), qtyBase = j.optDouble("qty_base", 0.0),\n                unitLabel = j.optString("unit_label"), reference = j.optString("reference"), notes = j.optString("notes"),\n                createdAt = j.optLong("created_at", System.currentTimeMillis()), syncId = syncId, synced = true)\n            if (old == null) db.stockMovementDao().insert(value) else db.stockMovementDao().update(value)\n        }\n'''
s = s.replace(apply_end, apply_extra, 1)
sync_path.write_text(s, encoding='utf-8')

# Server exchange adds the two new generic payload collections.
server = server_path.read_text(encoding='utf-8')
server = server.replace("    await upsertPayloads(client, 'expenses', business.id, req.body.expenses, 'created_at');\n",
                        "    await upsertPayloads(client, 'expenses', business.id, req.body.expenses, 'created_at');\n    await upsertPayloads(client, 'payments', business.id, req.body.payments, 'created_at');\n    await upsertPayloads(client, 'stock_movements', business.id, req.body.stock_movements, 'created_at');\n", 1)
server = server.replace("      expenses: await readPayloads(client, 'expenses', business.id),\n      server_time: now()",
                        "      expenses: await readPayloads(client, 'expenses', business.id),\n      payments: await readPayloads(client, 'payments', business.id),\n      stock_movements: await readPayloads(client, 'stock_movements', business.id),\n      server_time: now()", 1)
server_path.write_text(server, encoding='utf-8')
