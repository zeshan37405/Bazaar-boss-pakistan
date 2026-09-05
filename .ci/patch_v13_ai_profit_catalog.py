from pathlib import Path
import re

main_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/MainActivity.kt')
auth_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/sync/AuthClient.kt')
sync_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/sync/SyncWorker.kt')
backup_path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/util/BackupManager.kt')

text = main_path.read_text(encoding='utf-8')

# Fixed business name on Owner signup.
text = text.replace(
    'val businessName = edit("Business Name").apply { setText(prefs.businessName.ifBlank { "Confectionery Order Book" }) }',
    'val businessName = edit("Business Name").apply { setText(AppPrefs.FIXED_BUSINESS_NAME); isEnabled = false; isFocusable = false }',
    1
)
text = text.replace(
    'db, prefs, txt(businessName).ifBlank { "Confectionery Order Book" }, fixedCompanyId,',
    'db, prefs, AppPrefs.FIXED_BUSINESS_NAME, fixedCompanyId,',
    1
)

# Auto-detect Product name/category immediately after a selected photo is stored.
old = '''        var photoUri: String? = null
        val photo = image(null, 170); root.addView(photo)
        button("Choose clear catalog photo") {
            photoCallback = { uri ->
                runCatching { ImageStore.importImage(this, uri, "product") }
                    .onSuccess { stored -> photoUri = stored; photo.setImageURI(Uri.parse(stored)) }
                    .onFailure { toast("Image save failed") }
            }
            photoPicker.launch(arrayOf("image/*"))
        }
'''
new = '''        var photoUri: String? = null
        var applyAutoDetection: ((String, String) -> Unit)? = null
        val photo = image(null, 170); root.addView(photo)
        button("Choose clear catalog photo") {
            photoCallback = { uri ->
                runCatching { ImageStore.importImage(this, uri, "product") }
                    .onSuccess { stored ->
                        photoUri = stored
                        photo.setImageURI(Uri.parse(stored))
                        toast("تصویر محفوظ ہوگئی — نام اور category detect ہو رہی ہے…")
                        com.example.confectionery.util.ProductImageDetector.detect(this, Uri.parse(stored)) { detected ->
                            runOnUiThread {
                                applyAutoDetection?.invoke(detected.suggestedName, detected.suggestedCategory)
                            }
                        }
                    }
                    .onFailure { toast("Image save failed") }
            }
            photoPicker.launch(arrayOf("image/*"))
        }
'''
if old not in text:
    raise SystemExit('V13 V12 photo block anchor missing')
text = text.replace(old, new, 1)

old = '''        val category = edit("Item Category")

        sectionTitle("Units")'''
new = '''        val category = edit("Item Category")
        applyAutoDetection = { detectedName, detectedCategory ->
            var changed = false
            if (txt(name).isBlank() && detectedName.isNotBlank()) { name.setText(detectedName); changed = true }
            if (txt(category).isBlank() && detectedCategory.isNotBlank()) { category.setText(detectedCategory); changed = true }
            if (changed) toast("✓ Product name / category auto-filled — Save سے پہلے review کر لیں")
            else toast("Auto detection مکمل — fields پہلے سے filled ہیں")
        }
        info("تصویر لگاتے ہی Product Name اور Category خود suggest ہوں گے۔ Detection غلط ہو تو دونوں fields manually edit کر سکتے ہیں۔")

        sectionTitle("Units")'''
if old not in text:
    raise SystemExit('V13 category anchor missing')
text = text.replace(old, new, 1)

# New products append to the end of the manually arranged catalog.
old = '''            lifecycleScope.launch {
                val productId = db.productDao().insert(ProductEntity(
                    name = itemName, sku = txt(sku), barcode = txt(barcode), category = txt(category),
                    unit = p, photoUri = photoUri, purchaseRate = purchase, saleRate = shopRate,
                    wholesaleRate = shopRate, superWholesaleRate = superRate,
                    stockQty = opening, minStockQty = txt(minStock).toDoubleOrNull() ?: 0.0,
                    batchNo = txt(batch), expiryDate = txt(expiry), taxPercent = txt(tax).toDoubleOrNull() ?: 0.0
                ))'''
new = '''            lifecycleScope.launch {
                val nextCatalogOrder = (db.productDao().all().maxOfOrNull { it.catalogOrder } ?: 0) + 1
                val productId = db.productDao().insert(ProductEntity(
                    name = itemName, sku = txt(sku), barcode = txt(barcode), category = txt(category),
                    unit = p, photoUri = photoUri, purchaseRate = purchase, saleRate = shopRate,
                    wholesaleRate = shopRate, superWholesaleRate = superRate,
                    stockQty = opening, minStockQty = txt(minStock).toDoubleOrNull() ?: 0.0,
                    batchNo = txt(batch), expiryDate = txt(expiry), taxPercent = txt(tax).toDoubleOrNull() ?: 0.0,
                    catalogOrder = nextCatalogOrder
                ))'''
if old not in text:
    raise SystemExit('V13 product insert anchor missing')
text = text.replace(old, new, 1)

# Wherever a visual product list loads, respect Owner-defined catalog order.
text = text.replace(
    'val all = db.productDao().all()',
    'val all = db.productDao().all().sortedWith(compareBy<ProductEntity> { it.catalogOrder }.thenBy { it.category }.thenBy { it.name })'
)

# Add Owner-only drag/drop catalog arrangement button.
anchor = '            if (prefs.currentUserRole == "OWNER") button("+ Add Product") { showAddProduct() }\n'
if anchor not in text:
    raise SystemExit('V13 add product button anchor missing')
text = text.replace(anchor, anchor + '            if (prefs.currentUserRole == "OWNER") button("↕ Arrange Catalog Photos — Drag & Drop") { showArrangeCatalog() }\n', 1)

insert_anchor = '    private fun showAddProduct() {'
if insert_anchor not in text:
    raise SystemExit('V13 showAddProduct insert anchor missing')
arrange_func = r'''    private fun showArrangeCatalog() {
        if (prefs.currentUserRole != "OWNER") { toast("Catalog arrangement صرف Owner کے لیے ہے"); return }
        lifecycleScope.launch {
            val products = db.productDao().all().sortedWith(compareBy<ProductEntity> { it.catalogOrder }.thenBy { it.category }.thenBy { it.name })
            if (products.isEmpty()) return@launch toast("Catalog خالی ہے")

            val dialog = Dialog(this@MainActivity, android.R.style.Theme_Material_Light_NoActionBar_Fullscreen)
            val container = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(10), dp(10), dp(10), dp(10)) }
            val title = TextView(this@MainActivity).apply {
                text = "Arrange Catalog Photos\nتصویر کو HOLD کرکے drag کریں اور ملتی جلتی مصنوعات کے ساتھ رکھیں۔"
                textSize = 19f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setPadding(dp(6), dp(8), dp(6), dp(8))
            }
            container.addView(title)
            val done = Button(this@MainActivity).apply { text = "✓ Save Order & Done"; isAllCaps = false }
            container.addView(done)
            val recycler = androidx.recyclerview.widget.RecyclerView(this@MainActivity).apply {
                layoutManager = androidx.recyclerview.widget.GridLayoutManager(this@MainActivity, 2)
                setHasFixedSize(false)
            }
            val adapter = CatalogArrangeAdapter(this@MainActivity, products.toMutableList())
            recycler.adapter = adapter
            container.addView(recycler, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
            dialog.setContentView(container)

            var dirty = false
            val helper = androidx.recyclerview.widget.ItemTouchHelper(object : androidx.recyclerview.widget.ItemTouchHelper.SimpleCallback(
                androidx.recyclerview.widget.ItemTouchHelper.UP or androidx.recyclerview.widget.ItemTouchHelper.DOWN or
                    androidx.recyclerview.widget.ItemTouchHelper.LEFT or androidx.recyclerview.widget.ItemTouchHelper.RIGHT, 0
            ) {
                override fun onMove(
                    rv: androidx.recyclerview.widget.RecyclerView,
                    source: androidx.recyclerview.widget.RecyclerView.ViewHolder,
                    target: androidx.recyclerview.widget.RecyclerView.ViewHolder
                ): Boolean {
                    adapter.move(source.bindingAdapterPosition, target.bindingAdapterPosition)
                    dirty = true
                    return true
                }
                override fun onSwiped(viewHolder: androidx.recyclerview.widget.RecyclerView.ViewHolder, direction: Int) = Unit
                override fun isLongPressDragEnabled(): Boolean = true
            })
            helper.attachToRecyclerView(recycler)

            fun saveOrder(after: () -> Unit) {
                lifecycleScope.launch {
                    val now = System.currentTimeMillis()
                    adapter.currentOrder().forEachIndexed { index, product ->
                        if (product.catalogOrder != index + 1) {
                            db.productDao().update(product.copy(catalogOrder = index + 1, synced = false, updatedAt = now))
                        }
                    }
                    if (dirty) { queueSync(); queueAutoBackup() }
                    after()
                }
            }
            done.setOnClickListener { saveOrder { dialog.dismiss(); showProducts() } }
            dialog.setOnCancelListener { saveOrder { showProducts() } }
            dialog.show()
        }
    }

'''
text = text.replace(insert_anchor, arrange_func + insert_anchor, 1)

# Clear labels and enforce Owner-only profit entry points.
text = text.replace('button("Bill Wise Profit") { showReport("BILL_PROFIT") }', 'button("Bill-wise Profit") { showReport("BILL_PROFIT") }')
text = text.replace('button("Item Wise Profit & Loss") { showReport("ITEM_PROFIT") }', 'button("Product-wise Profit") { showReport("ITEM_PROFIT") }')
text = text.replace('sectionTitle("Bill Wise Profit")', 'sectionTitle("Bill-wise Profit")')
text = text.replace('sectionTitle("Item Wise Profit & Loss")', 'sectionTitle("Product-wise Profit")')

report_anchor = '''    private fun showReport(code: String) {
        reset("Report")'''
report_new = '''    private fun showReport(code: String) {
        if (code in setOf("BILL_PROFIT", "ITEM_PROFIT", "PROFIT_LOSS", "PARTY_PROFIT") && prefs.currentUserRole != "OWNER") {
            toast("Profit reports صرف Owner کے لیے ہیں")
            return showReports()
        }
        reset("Report")'''
if report_anchor not in text:
    raise SystemExit('V13 report anchor missing')
text = text.replace(report_anchor, report_new, 1)

main_path.write_text(text, encoding='utf-8')

# Force business identity at the auth/network boundary too.
auth = auth_path.read_text(encoding='utf-8')
auth = auth.replace('.put("business_name", businessName.trim())', '.put("business_name", AppPrefs.FIXED_BUSINESS_NAME)')
auth = auth.replace('prefs.businessName = businessName.trim()', 'prefs.businessName = AppPrefs.FIXED_BUSINESS_NAME')
auth = auth.replace('prefs.businessName = business.optString("name", "Confectionery Order Book")', 'prefs.businessName = AppPrefs.FIXED_BUSINESS_NAME')
auth = auth.replace('if (prefs.businessName.isBlank()) prefs.businessName = "Confectionery Order Book"', 'prefs.businessName = AppPrefs.FIXED_BUSINESS_NAME')
auth = auth.replace('prefs.businessName = business.optString("name", cleanCompany)', 'prefs.businessName = AppPrefs.FIXED_BUSINESS_NAME')
auth_path.write_text(auth, encoding='utf-8')

# Sync catalog ordering across devices.
sync = sync_path.read_text(encoding='utf-8')
sync = sync.replace(
    '.put("tax_percent", p.taxPercent).put("updated_at", p.updatedAt).put("unit_prices", unitArr))',
    '.put("tax_percent", p.taxPercent).put("catalog_order", p.catalogOrder).put("updated_at", p.updatedAt).put("unit_prices", unitArr))'
)
sync = sync.replace(
    'batchNo = j.optString("batch_no"), expiryDate = j.optString("expiry_date"), taxPercent = j.optDouble("tax_percent", 0.0),\n                syncId = syncId, synced = true, updatedAt = j.optLong("updated_at", System.currentTimeMillis()))',
    'batchNo = j.optString("batch_no"), expiryDate = j.optString("expiry_date"), taxPercent = j.optDouble("tax_percent", 0.0),\n                catalogOrder = j.optInt("catalog_order", old?.catalogOrder ?: 0), syncId = syncId, synced = true,\n                updatedAt = j.optLong("updated_at", System.currentTimeMillis()))'
)
sync_path.write_text(sync, encoding='utf-8')

# Backup/restore catalog order so a full backup preserves manual arrangement.
backup = backup_path.read_text(encoding='utf-8')
backup = backup.replace(
    '.put("batch_no", p.batchNo).put("expiry_date", p.expiryDate).put("tax_percent", p.taxPercent)\n                    .put("sync_id", p.syncId)',
    '.put("batch_no", p.batchNo).put("expiry_date", p.expiryDate).put("tax_percent", p.taxPercent)\n                    .put("catalog_order", p.catalogOrder).put("sync_id", p.syncId)'
)
backup = backup.replace(
    'taxPercent = j.optDouble("tax_percent", 0.0), syncId = j.optString("sync_id"),',
    'taxPercent = j.optDouble("tax_percent", 0.0), catalogOrder = j.optInt("catalog_order", j.optLong("id").toInt()),\n                syncId = j.optString("sync_id"),'
)
backup_path.write_text(backup, encoding='utf-8')

print('V13 auto-detect, fixed branding, Owner profit and drag/drop catalog patch applied')
