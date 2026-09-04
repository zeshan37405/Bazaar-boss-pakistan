from pathlib import Path
import re

main_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/MainActivity.kt')
printer_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/util/PrinterUtil.kt')
text = main_path.read_text(encoding='utf-8')

# Persistent-in-activity drafts: each customer keeps a separate unsaved visual order.
anchor = '    private val catalogSelected = linkedMapOf<Long, Int>()\n'
if anchor not in text:
    raise SystemExit('catalogSelected anchor missing')
fields = r'''    private data class VisualOrderLine(
        val product: ProductEntity,
        val unitPrice: ProductUnitPriceEntity,
        var qty: Int,
        val rate: Double,
        val tier: String
    )

    private val visualOrderDrafts = mutableMapOf<Long, LinkedHashMap<String, VisualOrderLine>>()
    private var visualOrderLargeMode = true
    private var visualOrderTier = "DUKANDAAR RATE"

'''
text = text.replace(anchor, anchor + fields, 1)

# Customer list: tapping a party now opens that customer's visual rate-list/order screen.
pattern = r'    private fun showCustomers\(query: String = ""\) \{.*?\n    \}\n\n    private fun showPartyDetail'
replacement = r'''    private fun showCustomers(query: String = "") {
        reset("Customers / Parties")
        back()
        val search = edit("Search Party by name / shop / phone / area")
        search.setText(query)
        button("Search") { showCustomers(txt(search)) }
        button("+ New Party") { showAddCustomer() }
        button("Take Payment") { showTakePayment() }
        info("Customer کے نام پر tap کریں تو اسی customer کی تصویری Rate List + Order Booking کھلے گی۔")
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
                    setPadding(0, dp(9), 0, dp(9))
                    setBackgroundColor(android.graphics.Color.WHITE)
                    setOnClickListener { showCustomerVisualOrder(c.id) }
                }
                row.addView(image(c.photoUri, 82))
                row.addView(TextView(this@MainActivity).apply {
                    text = "${c.name}\n${c.shopName.ifBlank { c.areaName }}\n${c.phone}\nPrevious Balance: Rs ${money(c.balance)}"
                    textSize = 16f
                    setPadding(dp(12), 0, dp(8), 0)
                    setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_primary))
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                row.addView(Button(this@MainActivity).apply {
                    text = "Details"
                    isAllCaps = false
                    setOnClickListener { showPartyDetail(c.id) }
                })
                root.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    setMargins(0, dp(4), 0, dp(4))
                })
            }
        }
    }

    private fun showPartyDetail'''
text, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('V8 showCustomers replacement failed')

# Add a direct visual-order entry on Party Details too.
needle = '            button("Take Payment from ${c.name}") { showTakePayment(c.id) }\n'
if needle in text:
    text = text.replace(needle, '            button("Start Visual Order / Rate List") { showCustomerVisualOrder(c.id) }\n' + needle, 1)

# Visual catalog -> customer-specific order -> review -> prepared bill.
insert_anchor = '    private fun showTakePayment(preselectedCustomerId: Long? = null) {'
if insert_anchor not in text:
    raise SystemExit('showTakePayment anchor missing')
visual_funcs = r'''    private fun visualDraft(customerId: Long): LinkedHashMap<String, VisualOrderLine> =
        visualOrderDrafts.getOrPut(customerId) { linkedMapOf() }

    private fun visualKey(productId: Long, unit: String, tier: String): String = "$productId|$unit|$tier"

    private fun showCustomerVisualOrder(customerId: Long, category: String? = null, largeMode: Boolean = visualOrderLargeMode) {
        visualOrderLargeMode = largeMode
        reset("Visual Order Booking")
        val draft = visualDraft(customerId)
        back { if (draft.isEmpty()) showCustomers() else showVisualOrderReview(customerId) }
        lifecycleScope.launch {
            val customer = db.customerDao().byId(customerId) ?: return@launch showCustomers()
            val all = db.productDao().all()
            if (all.isEmpty()) return@launch info("Products موجود نہیں۔ پہلے Items میں products اور تصاویر شامل کریں۔")

            sectionTitle(customer.name)
            info("${customer.shopName}\nArea: ${customer.areaName}\nPrevious Balance: Rs ${money(customer.balance)}\n\nتصویر کو صرف tap کرنے سے order نہیں لگے گا۔ Order کے لیے تصویر کو تھوڑی دیر HOLD کریں۔ ہر successful hold = +1 quantity۔")

            val modeRow = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.HORIZONTAL }
            modeRow.addView(Button(this@MainActivity).apply {
                text = if (largeMode) "✓ Large Photos" else "Large Photos"
                isAllCaps = false
                setOnClickListener { showCustomerVisualOrder(customerId, category, true) }
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            modeRow.addView(Button(this@MainActivity).apply {
                text = if (!largeMode) "✓ Rate List" else "Compact Rate List"
                isAllCaps = false
                setOnClickListener { showCustomerVisualOrder(customerId, category, false) }
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            root.addView(modeRow)

            info("Rate Mode: ${if (visualOrderTier == "DUKANDAAR RATE") "دکاندار کا ریٹ" else "Super Wholesale Rate"}")
            button(if (visualOrderTier == "DUKANDAAR RATE") "Switch to Super Wholesale" else "Switch to دکاندار کا ریٹ") {
                visualOrderTier = if (visualOrderTier == "DUKANDAAR RATE") "SUPER WHOLESALE" else "DUKANDAAR RATE"
                showCustomerVisualOrder(customerId, category, largeMode)
            }

            val categories = listOf("ALL") + db.productDao().categories()
            val catSpinner = spinner("Category", categories)
            category?.let { wanted -> categories.indexOf(wanted).takeIf { it >= 0 }?.let(catSpinner::setSelection) }
            button("Open Category") {
                showCustomerVisualOrder(customerId, categories[catSpinner.selectedItemPosition].takeUnless { it == "ALL" }, largeMode)
            }

            val summaryBox = LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(10), dp(10), dp(10), dp(10))
                setBackgroundColor(0xFFEAF7F6.toInt())
            }
            root.addView(summaryBox)

            fun renderSummary() {
                summaryBox.removeAllViews()
                val lines = draft.values.toList()
                val current = lines.sumOf { it.rate * it.qty }
                val qtyTotal = lines.sumOf { it.qty }
                summaryBox.addView(TextView(this@MainActivity).apply {
                    text = "ORDER CART • ${lines.size} items • Qty $qtyTotal\nCurrent Order: Rs ${money(current)}\nPrevious Balance: Rs ${money(customer.balance)}\nTotal Payable: Rs ${money(customer.balance + current)}"
                    textSize = 18f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_primary))
                })
                if (lines.isNotEmpty()) {
                    val latest = lines.last()
                    summaryBox.addView(TextView(this@MainActivity).apply {
                        text = "Last added: ${latest.product.name} • ${latest.qty} ${latest.unitPrice.unitCode}"
                        textSize = 14f
                    })
                }
            }
            renderSummary()
            button("Review Bill / Order Details") { showVisualOrderReview(customerId) }

            val products = if (category.isNullOrBlank()) all else all.filter { it.category == category }
            val grid = GridLayout(this@MainActivity).apply {
                columnCount = if (largeMode) 1 else 2
                alignmentMode = GridLayout.ALIGN_BOUNDS
                useDefaultMargins = true
            }
            products.forEach { p ->
                val units = db.productUnitPriceDao().forProduct(p.id).ifEmpty { listOf(fallbackUnit(p)) }
                val card = LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER_HORIZONTAL
                    setPadding(dp(8), dp(10), dp(8), dp(10))
                    setBackgroundColor(android.graphics.Color.WHITE)
                }
                val pic = image(p.photoUri, if (largeMode) 270 else 120)
                card.addView(pic)
                card.addView(TextView(this@MainActivity).apply {
                    text = p.name
                    textSize = if (largeMode) 20f else 15f
                    gravity = Gravity.CENTER
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_primary))
                })
                if (!largeMode) {
                    card.addView(TextView(this@MainActivity).apply {
                        text = units.joinToString("\n") { u ->
                            val r = rateFor(u, visualOrderTier)
                            "${u.unitCode}: Rs ${money(r)}"
                        }
                        textSize = 13f
                        gravity = Gravity.CENTER
                    })
                }
                val unitSpinner = Spinner(this@MainActivity).apply {
                    adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, units.map { it.unitCode })
                }
                card.addView(unitSpinner, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
                val rateLabel = TextView(this@MainActivity).apply {
                    textSize = 16f
                    gravity = Gravity.CENTER
                    setTextColor(ContextCompat.getColor(this@MainActivity, R.color.brand_primary))
                }
                fun updateRateLabel() {
                    val u = units[unitSpinner.selectedItemPosition.coerceIn(0, units.lastIndex)]
                    rateLabel.text = "${if (visualOrderTier == "DUKANDAAR RATE") "دکاندار" else "Super Wholesale"}: Rs ${money(rateFor(u, visualOrderTier))} / ${u.unitCode}"
                }
                unitSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                    override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: android.view.View?, position: Int, id: Long) = updateRateLabel()
                    override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
                }
                updateRateLabel()
                card.addView(rateLabel)
                card.addView(TextView(this@MainActivity).apply {
                    text = "HOLD PHOTO TO ADD +1"
                    textSize = 12f
                    gravity = Gravity.CENTER
                    setPadding(0, dp(4), 0, dp(4))
                })
                pic.setOnClickListener { toast("Order کے لیے تصویر کو تھوڑی دیر Hold کریں") }
                pic.setOnLongClickListener {
                    val u = units[unitSpinner.selectedItemPosition.coerceIn(0, units.lastIndex)]
                    val tier = visualOrderTier
                    val rate = rateFor(u, tier)
                    val key = visualKey(p.id, u.unitCode, tier)
                    val line = draft[key]
                    if (line == null) draft[key] = VisualOrderLine(p, u, 1, rate, tier) else line.qty += 1
                    val nowQty = draft[key]?.qty ?: 1
                    pic.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
                    pic.animate()
                        .scaleX(0.55f).scaleY(0.55f)
                        .translationY(-dp(85).toFloat())
                        .translationX((root.width / 5f))
                        .rotationY(18f).alpha(0.22f)
                        .setDuration(240)
                        .withEndAction {
                            pic.animate().scaleX(1f).scaleY(1f).translationX(0f).translationY(0f).rotationY(0f).alpha(1f).setDuration(150).start()
                        }.start()
                    renderSummary()
                    toast("✓ ${p.name} • Qty $nowQty ${u.unitCode}")
                    true
                }
                grid.addView(card, GridLayout.LayoutParams().apply {
                    width = 0
                    height = GridLayout.LayoutParams.WRAP_CONTENT
                    columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                    setMargins(dp(5), dp(5), dp(5), dp(5))
                })
            }
            root.addView(grid, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }
    }

    private fun showVisualOrderReview(customerId: Long) {
        reset("Order Details / Bill Preview")
        back { showCustomerVisualOrder(customerId, largeMode = visualOrderLargeMode) }
        val draft = visualDraft(customerId)
        lifecycleScope.launch {
            val customer = db.customerDao().byId(customerId) ?: return@launch showCustomers()
            sectionTitle(customer.name)
            info("${customer.shopName}\nArea: ${customer.areaName}\nBooker: ${prefs.deviceBookerName}")
            if (draft.isEmpty()) {
                info("Order ابھی خالی ہے۔")
                button("Select Products") { showCustomerVisualOrder(customerId) }
                return@launch
            }
            draft.entries.toList().forEach { entry ->
                val key = entry.key
                val line = entry.value
                val row = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
                row.addView(TextView(this@MainActivity).apply {
                    text = "${line.product.name}\n${line.qty} ${line.unitPrice.unitCode} × Rs ${money(line.rate)} = Rs ${money(line.rate * line.qty)}\n${if (line.tier == "DUKANDAAR RATE") "دکاندار کا ریٹ" else "Super Wholesale Rate"}"
                    textSize = 15f
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                row.addView(Button(this@MainActivity).apply {
                    text = "−1"
                    isAllCaps = false
                    setOnClickListener {
                        val current = draft[key] ?: return@setOnClickListener
                        current.qty -= 1
                        if (current.qty <= 0) draft.remove(key)
                        showVisualOrderReview(customerId)
                    }
                })
                row.addView(Button(this@MainActivity).apply {
                    text = "Remove"
                    isAllCaps = false
                    setOnClickListener { draft.remove(key); showVisualOrderReview(customerId) }
                })
                root.addView(row)
            }
            val current = draft.values.sumOf { it.rate * it.qty }
            sectionTitle("Bill Summary")
            info("Current Order: Rs ${money(current)}\nPrevious Balance: Rs ${money(customer.balance)}\nTOTAL PAYABLE: Rs ${money(customer.balance + current)}")
            button("Continue Selecting Products") { showCustomerVisualOrder(customerId, largeMode = visualOrderLargeMode) }
            button("Save Order & Prepare Bill") { saveVisualOrder(customerId) }
            button("Clear This Draft") { visualOrderDrafts.remove(customerId); showCustomers() }
        }
    }

    private fun saveVisualOrder(customerId: Long) {
        val draft = visualDraft(customerId)
        if (draft.isEmpty()) return toast("Order خالی ہے")
        lifecycleScope.launch {
            val customer = db.customerDao().byId(customerId) ?: return@launch toast("Customer not found")
            val lines = draft.values.toList()
            val saleTotal = lines.sumOf { it.rate * it.qty }
            val purchaseTotal = lines.sumOf { line ->
                val purchase = line.unitPrice.purchaseRate.takeIf { it > 0 } ?: line.product.purchaseRate * line.unitPrice.conversionToBase
                purchase * line.qty
            }
            val order = OrderEntity(
                invoiceNo = "ORD-${System.currentTimeMillis()}",
                customerId = customer.id, customerSyncId = customer.syncId,
                bookedByUserId = prefs.currentUserId, bookerName = prefs.deviceBookerName,
                areaName = customer.areaName.ifBlank { prefs.deviceAreaName }, deviceId = prefs.deviceId,
                saleTotal = saleTotal, purchaseTotal = purchaseTotal, discount = 0.0, taxTotal = 0.0,
                paymentType = "CREDIT", notes = "Visual customer order", documentType = "ORDER", status = "BOOKED"
            )
            val items = lines.map { line ->
                val purchase = line.unitPrice.purchaseRate.takeIf { it > 0 } ?: line.product.purchaseRate * line.unitPrice.conversionToBase
                OrderItemEntity(
                    productId = line.product.id, productSyncId = line.product.syncId, productName = line.product.name,
                    qty = line.qty.toDouble(), baseQty = line.qty * line.unitPrice.conversionToBase,
                    unit = line.unitPrice.unitCode, purchaseRate = purchase, saleRate = line.rate,
                    priceTier = line.tier, taxPercent = 0.0, lineTotal = line.rate * line.qty
                )
            }
            val orderId = db.orderDao().insertOrderWithItems(order, items)
            visualOrderDrafts.remove(customerId)
            queueSync()
            toast("Order محفوظ ہوگیا — Bill تیار ہے")
            showPreparedBill(orderId)
        }
    }

    private fun showPreparedBill(orderId: Long) {
        reset("Prepared Bill")
        back { showOrders() }
        lifecycleScope.launch {
            val order = db.orderDao().byId(orderId) ?: return@launch showOrders()
            val customer = db.customerDao().byId(order.customerId)
            val items = db.orderDao().items(orderId)
            val currentBalance = customer?.balance ?: 0.0
            val previousBalance = if (order.status == "BILLED" && order.paymentType == "CREDIT") currentBalance - order.saleTotal else currentBalance
            sectionTitle(customer?.name ?: "Customer")
            info("${customer?.shopName.orEmpty()}\nArea: ${order.areaName}\nOrder Booker: ${order.bookerName}\nOrder: ${order.invoiceNo}")
            sectionTitle("Items")
            items.forEach { i ->
                info("${i.productName}\n${money(i.qty)} ${i.unit} × Rs ${money(i.saleRate)} = Rs ${money(i.lineTotal)}\n${if (i.priceTier == "DUKANDAAR RATE") "دکاندار کا ریٹ" else i.priceTier}")
            }
            sectionTitle("Bill Summary")
            info("Current Order: Rs ${money(order.saleTotal)}\nPrevious Balance: Rs ${money(previousBalance)}\nTOTAL PAYABLE: Rs ${money(previousBalance + order.saleTotal)}")
            button("🖨 Print Bill") { printOrder(order.id) }
            button("📤 Share / Export") { shareOrder(order.id) }
            if (order.status == "BOOKED") info("یہ order ابھی BOOKED ہے۔ Vyapar میں billing کے لیے یہی تیار detail استعمال کی جا سکتی ہے۔")
            button("Back to Customers") { showCustomers() }
        }
    }

'''
text = text.replace(insert_anchor, visual_funcs + insert_anchor, 1)

# Replace Add Item with the requested three-rate model. Legacy retailRate is mirrored to Dukandaar rate for compatibility.
pattern = r'    private fun showAddProduct\(\) \{.*?\n    \}\n\n    private fun fallbackUnit'
replacement = r'''    private fun showAddProduct() {
        reset("Add Item — Units & Rates")
        back { showProducts() }
        var photoUri: String? = null
        val photo = image(null, 190); root.addView(photo)
        button("Choose clear catalog photo") {
            photoCallback = { uri ->
                runCatching { ImageStore.importImage(this, uri, "product") }
                    .onSuccess { stored -> photoUri = stored; photo.setImageURI(Uri.parse(stored)) }
                    .onFailure { toast("Image save failed") }
            }
            photoPicker.launch(arrayOf("image/*"))
        }
        val name = edit("Item Name *")
        val sku = edit("Item Code / SKU")
        val barcode = edit("Barcode")
        val category = edit("Item Category")

        sectionTitle("Primary Unit")
        val primaryUnit = spinner("Primary / Stock Unit", unitSuggestions)
        val pPurchase = edit("خریداری کا ریٹ", numeric = true)
        val pDealer = edit("دکاندار کا ریٹ", numeric = true)
        val pSuper = edit("Super Wholesale Rate", numeric = true)

        sectionTitle("Secondary Unit")
        val secondaryUnit = spinner("Second Unit (required)", unitSuggestions); secondaryUnit.setSelection(1)
        val sConversion = edit("1 second unit = how many primary units?", numeric = true)
        val sPurchase = edit("Second Unit خریداری کا ریٹ (optional)", numeric = true)
        val sDealer = edit("Second Unit دکاندار کا ریٹ", numeric = true)
        val sSuper = edit("Second Unit Super Wholesale Rate", numeric = true)

        sectionTitle("Third Unit — Optional")
        val thirdUnit = spinner("Third Unit", listOf("NONE") + unitSuggestions)
        val tConversion = edit("Third Unit conversion to primary", numeric = true)
        val tPurchase = edit("Third Unit خریداری کا ریٹ", numeric = true)
        val tDealer = edit("Third Unit دکاندار کا ریٹ", numeric = true)
        val tSuper = edit("Third Unit Super Wholesale Rate", numeric = true)

        sectionTitle("Stock")
        val stock = edit("Opening stock in PRIMARY unit", numeric = true)
        val minStock = edit("Low-stock alert", numeric = true)
        val batch = edit("Batch No (optional)")
        val expiry = edit("Expiry date e.g. 2027-12-31")
        val tax = edit("Tax % (optional)", numeric = true)
        button("Save Item") {
            val pr = txt(pPurchase).toDoubleOrNull()
            val dealer1 = txt(pDealer).toDoubleOrNull()
            val conv2 = txt(sConversion).toDoubleOrNull()
            val dealer2 = txt(sDealer).toDoubleOrNull()
            if (txt(name).isBlank() || pr == null || dealer1 == null || conv2 == null || conv2 <= 0 || dealer2 == null)
                return@button toast("Item، خریداری/دکاندار rates اور second unit conversion ضروری ہیں")
            val u1 = primaryUnit.selectedItem.toString()
            val u2 = secondaryUnit.selectedItem.toString()
            if (u1 == u2) return@button toast("Primary اور Second unit مختلف منتخب کریں")
            lifecycleScope.launch {
                val super1 = txt(pSuper).toDoubleOrNull() ?: 0.0
                val productId = db.productDao().insert(ProductEntity(
                    name = txt(name), sku = txt(sku), barcode = txt(barcode), category = txt(category), unit = u1,
                    photoUri = photoUri, purchaseRate = pr, saleRate = dealer1, wholesaleRate = dealer1, superWholesaleRate = super1,
                    stockQty = txt(stock).toDoubleOrNull() ?: 0.0, minStockQty = txt(minStock).toDoubleOrNull() ?: 0.0,
                    batchNo = txt(batch), expiryDate = txt(expiry), taxPercent = txt(tax).toDoubleOrNull() ?: 0.0
                ))
                val units = mutableListOf(
                    ProductUnitPriceEntity(productId = productId, unitCode = u1, conversionToBase = 1.0,
                        purchaseRate = pr, retailRate = dealer1, wholesaleRate = dealer1, superWholesaleRate = super1),
                    ProductUnitPriceEntity(productId = productId, unitCode = u2, conversionToBase = conv2,
                        purchaseRate = txt(sPurchase).toDoubleOrNull() ?: pr * conv2,
                        retailRate = dealer2, wholesaleRate = dealer2, superWholesaleRate = txt(sSuper).toDoubleOrNull() ?: 0.0)
                )
                val u3 = thirdUnit.selectedItem.toString()
                val conv3 = txt(tConversion).toDoubleOrNull()
                val dealer3 = txt(tDealer).toDoubleOrNull()
                if (u3 != "NONE" && conv3 != null && conv3 > 0 && dealer3 != null) {
                    units += ProductUnitPriceEntity(productId = productId, unitCode = u3, conversionToBase = conv3,
                        purchaseRate = txt(tPurchase).toDoubleOrNull() ?: pr * conv3,
                        retailRate = dealer3, wholesaleRate = dealer3, superWholesaleRate = txt(tSuper).toDoubleOrNull() ?: 0.0)
                }
                db.productUnitPriceDao().insertAll(units)
                queueSync(); toast("Item + دکاندار/Super Wholesale rates محفوظ ہوگئے"); showProducts()
            }
        }
    }

    private fun fallbackUnit'''
text, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('V8 add product replacement failed')

# Internal compatibility: Dukandaar rate reads the existing wholesale field first, then the legacy retail field.
rate_pattern = r'    private fun rateFor\(u: ProductUnitPriceEntity, tier: String\): Double = when \(tier\) \{.*?\n    \}'
rate_replacement = r'''    private fun rateFor(u: ProductUnitPriceEntity, tier: String): Double = when (tier) {
        "SUPER WHOLESALE" -> u.superWholesaleRate.takeIf { it > 0 } ?: u.wholesaleRate.takeIf { it > 0 } ?: u.retailRate
        "DUKANDAAR RATE" -> u.wholesaleRate.takeIf { it > 0 } ?: u.retailRate
        else -> u.wholesaleRate.takeIf { it > 0 } ?: u.retailRate
    }'''
text, n = re.subn(rate_pattern, lambda m: rate_replacement, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('V8 rateFor replacement failed')

# Rename visible pricing language and use Dukandaar rate in the manual order flow too.
text = text.replace('listOf("RETAIL", "WHOLESALE", "SUPER WHOLESALE")', 'listOf("DUKANDAAR RATE", "SUPER WHOLESALE")')
text = text.replace('rateFor(u, "RETAIL")', 'rateFor(u, "DUKANDAAR RATE")')
text = text.replace('Retail ${money(u.retailRate)} • Wholesale ${money(u.wholesaleRate)} • Super Wholesale ${money(u.superWholesaleRate)}',
                    'Dukandaar Rate ${money(u.wholesaleRate.takeIf { it > 0 } ?: u.retailRate)} • Super Wholesale ${money(u.superWholesaleRate)}')
text = text.replace('val unitLine = units.take(3).joinToString(" • ") { "${it.unitCode} ${money(it.retailRate)}" }',
                    'val unitLine = units.take(3).joinToString(" • ") { "${it.unitCode}: Rs ${money(it.wholesaleRate.takeIf { r -> r > 0 } ?: it.retailRate)}" }')
text = text.replace('(RETAIL)', '(DUKANDAAR RATE)')

# Orders list gains a proper details/bill entry.
orders_needle = '                button("Print ${o.invoiceNo}") { printOrder(o.id) }\n'
if orders_needle in text:
    text = text.replace(orders_needle, '                button("Open Bill / Details") { showPreparedBill(o.id) }\n' + orders_needle, 1)

main_path.write_text(text, encoding='utf-8')

# Printer: show previous balance + current bill + combined payable; never expose purchase rates.
p = printer_path.read_text(encoding='utf-8')
calc_anchor = '        val items = db.orderDao().items(orderId)\n        val line = "-".repeat(width.coerceIn(24, 64))\n'
calc_replacement = '''        val items = db.orderDao().items(orderId)\n        val currentBalance = customer?.balance ?: 0.0\n        val previousBalance = if (order.status == "BILLED" && order.paymentType == "CREDIT") currentBalance - order.saleTotal else currentBalance\n        val combinedPayable = previousBalance + order.saleTotal\n        val line = "-".repeat(width.coerceIn(24, 64))\n'''
if calc_anchor not in p:
    raise SystemExit('Printer balance anchor missing')
p = p.replace(calc_anchor, calc_replacement, 1)
p = p.replace('            appendLine("TOTAL: Rs ${money(order.saleTotal)}")\n',
              '            appendLine("CURRENT BILL: Rs ${money(order.saleTotal)}")\n            appendLine("PREVIOUS BALANCE: Rs ${money(previousBalance)}")\n            appendLine("TOTAL PAYABLE: Rs ${money(combinedPayable)}")\n', 1)
p = p.replace('if (i.priceTier != "RETAIL") appendLine("Rate: ${i.priceTier}")',
              'if (i.priceTier.isNotBlank()) appendLine("Rate: ${if (i.priceTier == "DUKANDAAR RATE") "Dukandaar Rate" else i.priceTier}")', 1)
printer_path.write_text(p, encoding='utf-8')

print('V8 visual customer ordering + prepared billing patch applied')
