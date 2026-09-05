from pathlib import Path
import re

root = Path('confectionery_order_app/app/src/main/java/com/example/confectionery')
main_path = root / 'MainActivity.kt'
entities_path = root / 'data/Entities.kt'
daos_path = root / 'data/Daos.kt'
migrations_path = root / 'data/DatabaseMigrations.kt'
db_path = root / 'data/AppDatabase.kt'
app_path = root / 'OrderBookApp.kt'
sync_path = root / 'sync/SyncWorker.kt'
detector_path = root / 'util/ProductImageDetector.kt'
gradle_path = Path('confectionery_order_app/app/build.gradle.kts')

# --- MainActivity: portrait scanner, optional Carton rates, manual lower-unit override, delete product ---
text = main_path.read_text(encoding='utf-8')
text = text.replace('setOrientationLocked(false)', 'setOrientationLocked(true)')

for old, new in [
    ('val sPurchase = edit("BOX خریداری کا ریٹ — Auto", numeric = true).apply { isFocusable = false; isClickable = false }', 'val sPurchase = edit("BOX خریداری کا ریٹ — Auto / Manual", numeric = true)'),
    ('val sShop = edit("BOX دکاندار کا ریٹ — Auto", numeric = true).apply { isFocusable = false; isClickable = false }', 'val sShop = edit("BOX دکاندار کا ریٹ — Auto / Manual", numeric = true)'),
    ('val sSuper = edit("BOX Super Wholesale Rate — Auto", numeric = true).apply { isFocusable = false; isClickable = false }', 'val sSuper = edit("BOX Super Wholesale Rate — Auto / Manual", numeric = true)'),
    ('val tPurchase = edit("PIECE خریداری کا ریٹ — Auto", numeric = true).apply { isFocusable = false; isClickable = false }', 'val tPurchase = edit("PIECE خریداری کا ریٹ — Auto / Manual", numeric = true)'),
    ('val tShop = edit("PIECE دکاندار کا ریٹ — Auto", numeric = true).apply { isFocusable = false; isClickable = false }', 'val tShop = edit("PIECE دکاندار کا ریٹ — Auto / Manual", numeric = true)'),
    ('val tSuper = edit("PIECE Super Wholesale Rate — Auto", numeric = true).apply { isFocusable = false; isClickable = false }', 'val tSuper = edit("PIECE Super Wholesale Rate — Auto / Manual", numeric = true)'),
]:
    text = text.replace(old, new)

text = text.replace('val pPurchase = edit("CARTON خریداری کا ریٹ", numeric = true)', 'val pPurchase = edit("CARTON خریداری کا ریٹ (optional)", numeric = true)')
text = text.replace('val pShop = edit("CARTON دکاندار کا ریٹ", numeric = true)', 'val pShop = edit("CARTON دکاندار کا ریٹ (optional)", numeric = true)')
text = text.replace('val pSuper = edit("CARTON Super Wholesale Rate", numeric = true)', 'val pSuper = edit("CARTON Super Wholesale Rate (optional)", numeric = true)')

text = text.replace(
    '        val pSuper = edit("CARTON Super Wholesale Rate (optional)", numeric = true)\n',
    '        val pSuper = edit("CARTON Super Wholesale Rate (optional)", numeric = true)\n        info("Carton کے تمام rates optional ہیں۔ Carton rate دیں تو Box/Piece rates خود calculate ہوں گے؛ Carton rate نہ ہو تو Box/Piece rates manually درج کر سکتے ہیں۔")\n',
    1
)

text = text.replace('            val purchase = txt(pPurchase).toDoubleOrNull()\n            val shopRate = txt(pShop).toDoubleOrNull()\n            val superRate = txt(pSuper).toDoubleOrNull() ?: 0.0',
                    '            val purchase = txt(pPurchase).toDoubleOrNull() ?: 0.0\n            val shopRate = txt(pShop).toDoubleOrNull() ?: 0.0\n            val superRate = txt(pSuper).toDoubleOrNull() ?: 0.0', 1)
text = text.replace('            if (purchase == null || purchase < 0 || shopRate == null || shopRate <= 0) return@button toast("Primary Unit کے rates درست درج کریں")\n', '', 1)
text = text.replace('            val secondPurchase = purchase / secondCount\n            val secondShop = shopRate / secondCount\n            val secondSuper = superRate / secondCount\n            val thirdPurchase = thirdConversionToPrimary?.let { purchase * it }\n            val thirdShop = thirdConversionToPrimary?.let { shopRate * it }\n            val thirdSuper = thirdConversionToPrimary?.let { superRate * it }',
                    '            val secondPurchase = txt(sPurchase).toDoubleOrNull() ?: (purchase / secondCount)\n            val secondShop = txt(sShop).toDoubleOrNull() ?: (shopRate / secondCount)\n            val secondSuper = txt(sSuper).toDoubleOrNull() ?: (superRate / secondCount)\n            val thirdPurchase = txt(tPurchase).toDoubleOrNull() ?: thirdConversionToPrimary?.let { purchase * it }\n            val thirdShop = txt(tShop).toDoubleOrNull() ?: thirdConversionToPrimary?.let { shopRate * it }\n            val thirdSuper = txt(tSuper).toDoubleOrNull() ?: thirdConversionToPrimary?.let { superRate * it }', 1)

# Do not overwrite manual Box/Piece prices if the Carton price is blank/zero.
text = text.replace('                put(sPurchase, purchase?.div(countSecond))\n                put(sShop, shop?.div(countSecond))\n                put(sSuper, superRate?.div(countSecond))',
                    '                if (purchase != null && purchase > 0) put(sPurchase, purchase / countSecond)\n                if (shop != null && shop > 0) put(sShop, shop / countSecond)\n                if (superRate != null && superRate > 0) put(sSuper, superRate / countSecond)', 1)
text = text.replace('                    put(tPurchase, purchase?.div(divisor))\n                    put(tShop, shop?.div(divisor))\n                    put(tSuper, superRate?.div(divisor))',
                    '                    if (purchase != null && purchase > 0) put(tPurchase, purchase / divisor)\n                    if (shop != null && shop > 0) put(tShop, shop / divisor)\n                    if (superRate != null && superRate > 0) put(tSuper, superRate / divisor)', 1)

adjust_anchor = '            button("Adjust Stock") { showAdjustStock(p.id) }\n'
if adjust_anchor not in text:
    raise SystemExit('V14 item detail delete anchor missing')
delete_block = '''            button("Adjust Stock") { showAdjustStock(p.id) }\n            if (prefs.currentUserRole == "OWNER") {\n                button("🗑 Delete Product") {\n                    androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)\n                        .setTitle("Delete Product?")\n                        .setMessage("${p.name} catalog اور نئی order booking سے ہٹ جائے گا۔ پرانے bills/history محفوظ رہیں گے۔")\n                        .setNegativeButton("Cancel", null)\n                        .setPositiveButton("Delete") { _, _ ->\n                            lifecycleScope.launch {\n                                db.productDao().softDelete(p.id)\n                                visualOrderDrafts.values.forEach { draft ->\n                                    val keys = draft.filterValues { it.product.id == p.id }.keys.toList()\n                                    keys.forEach { draft.remove(it) }\n                                }\n                                queueSync(); queueAutoBackup()\n                                toast("Product delete ہوگیا")\n                                showProducts()\n                            }\n                        }.show()\n                }\n            }\n'''
text = text.replace(adjust_anchor, delete_block, 1)
main_path.write_text(text, encoding='utf-8')

# --- Product soft-delete schema/tombstone ---
entities = entities_path.read_text(encoding='utf-8')
entities = entities.replace('    @ColumnInfo(defaultValue = "0") val catalogOrder: Int = 0,\n    val syncId: String',
                            '    @ColumnInfo(defaultValue = "0") val catalogOrder: Int = 0,\n    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,\n    val syncId: String', 1)
entities_path.write_text(entities, encoding='utf-8')

daos = daos_path.read_text(encoding='utf-8')
daos = daos.replace('@Query("SELECT * FROM products ORDER BY category, name") suspend fun all(): List<ProductEntity>', '@Query("SELECT * FROM products WHERE deleted=0 ORDER BY category, name") suspend fun all(): List<ProductEntity>')
daos = daos.replace('@Query("SELECT * FROM products WHERE category=:category ORDER BY name") suspend fun byCategory(category: String): List<ProductEntity>', '@Query("SELECT * FROM products WHERE deleted=0 AND category=:category ORDER BY name") suspend fun byCategory(category: String): List<ProductEntity>')
daos = daos.replace('@Query("SELECT DISTINCT category FROM products WHERE category <> \'\' ORDER BY category") suspend fun categories(): List<String>', '@Query("SELECT DISTINCT category FROM products WHERE deleted=0 AND category <> \'\' ORDER BY category") suspend fun categories(): List<String>')
daos = daos.replace('@Query("SELECT * FROM products WHERE stockQty <= minStockQty AND minStockQty > 0 ORDER BY stockQty") suspend fun lowStock(): List<ProductEntity>', '@Query("SELECT * FROM products WHERE deleted=0 AND stockQty <= minStockQty AND minStockQty > 0 ORDER BY stockQty") suspend fun lowStock(): List<ProductEntity>')
anchor = '    @Query("UPDATE products SET stockQty = stockQty + :delta, synced = 0, updatedAt = :now WHERE id=:id") suspend fun adjustStock(id: Long, delta: Double, now: Long = System.currentTimeMillis())\n'
if anchor not in daos:
    raise SystemExit('V14 DAO anchor missing')
daos = daos.replace(anchor, anchor + '    @Query("UPDATE products SET deleted=1, synced=0, updatedAt=:now WHERE id=:id") suspend fun softDelete(id: Long, now: Long = System.currentTimeMillis())\n', 1)
daos_path.write_text(daos, encoding='utf-8')

migrations = migrations_path.read_text(encoding='utf-8')
if 'MIGRATION_6_7' not in migrations:
    migrations = migrations.replace('\n}\n', '''\n\n    val MIGRATION_6_7 = object : Migration(6, 7) {\n        override fun migrate(db: SupportSQLiteDatabase) {\n            db.execSQL("ALTER TABLE products ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0")\n        }\n    }\n}\n''', 1)
migrations_path.write_text(migrations, encoding='utf-8')

dbtext = db_path.read_text(encoding='utf-8').replace('    version = 6,', '    version = 7,', 1)
db_path.write_text(dbtext, encoding='utf-8')
apptext = app_path.read_text(encoding='utf-8').replace('                DatabaseMigrations.MIGRATION_5_6\n', '                DatabaseMigrations.MIGRATION_5_6,\n                DatabaseMigrations.MIGRATION_6_7\n', 1)
app_path.write_text(apptext, encoding='utf-8')

# --- Sync deleted tombstones ---
sync = sync_path.read_text(encoding='utf-8')
sync = sync.replace('.put("tax_percent", p.taxPercent).put("catalog_order", p.catalogOrder).put("updated_at", p.updatedAt)',
                    '.put("tax_percent", p.taxPercent).put("catalog_order", p.catalogOrder).put("deleted", p.deleted).put("updated_at", p.updatedAt)', 1)
sync = sync.replace('catalogOrder = j.optInt("catalog_order", old?.catalogOrder ?: 0), syncId = syncId, synced = true,',
                    'catalogOrder = j.optInt("catalog_order", old?.catalogOrder ?: 0), deleted = j.optBoolean("deleted", false), syncId = syncId, synced = true,', 1)
sync_path.write_text(sync, encoding='utf-8')

# --- Stronger product-name OCR: two-pass OCR, EXIF orientation, contrast enhancement, prominent-text scoring ---
detector_path.write_text(r'''package com.example.confectionery.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.Locale

object ProductImageDetector {
    data class Result(val suggestedName: String, val suggestedCategory: String, val recognizedText: String)
    private data class Candidate(val text: String, val score: Double)

    fun detect(context: Context, uri: Uri, callback: (Result) -> Unit) {
        val bitmap = loadBitmap(context, uri)
        if (bitmap == null) {
            val fallback = runCatching { InputImage.fromFilePath(context, uri) }.getOrNull()
            if (fallback == null) { callback(Result("", "GENERAL", "")); return }
            recognizeOne(fallback) { text -> finish(fallback, text.text, candidatesFrom(text, 1, 1), callback) }
            return
        }
        val enhanced = enhance(bitmap)
        val rawParts = mutableListOf<String>()
        val candidates = mutableListOf<Candidate>()
        recognizeOne(InputImage.fromBitmap(bitmap, 0)) { first ->
            rawParts += first.text.orEmpty()
            candidates += candidatesFrom(first, bitmap.width, bitmap.height)
            recognizeOne(InputImage.fromBitmap(enhanced, 0)) { second ->
                rawParts += second.text.orEmpty()
                candidates += candidatesFrom(second, enhanced.width, enhanced.height).map { it.copy(score = it.score + 4.0) }
                finish(InputImage.fromBitmap(bitmap, 0), rawParts.joinToString("\n"), candidates, callback)
            }
        }
    }

    private fun recognizeOne(image: InputImage, done: (Text) -> Unit) {
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer.process(image)
            .addOnSuccessListener { result -> recognizer.close(); done(result) }
            .addOnFailureListener { recognizer.close(); done(Text("", emptyList())) }
    }

    private fun candidatesFrom(text: Text, imageWidth: Int, imageHeight: Int): List<Candidate> {
        val stop = listOf("net wt", "net weight", "ingredients", "nutrition", "price", "m.r.p", "mrp", "manufactured", "expiry", "best before", "batch", "barcode", "customer care", "www.", "facebook", "instagram")
        return text.textBlocks.flatMap { it.lines }.mapNotNull { line ->
            val value = clean(line.text)
            if (value.length !in 2..50 || value.count { it.isLetter() } < 2) return@mapNotNull null
            val lower = value.lowercase(Locale.ROOT)
            if (stop.any { lower.contains(it) }) return@mapNotNull null
            val box = line.boundingBox
            val h = (box?.height() ?: 1).toDouble() / imageHeight.coerceAtLeast(1)
            val w = (box?.width() ?: 1).toDouble() / imageWidth.coerceAtLeast(1)
            val cy = (box?.centerY() ?: imageHeight / 2).toDouble() / imageHeight.coerceAtLeast(1)
            val letters = value.count { it.isLetter() }
            val digits = value.count { it.isDigit() }
            var score = h * 150.0 + w * 26.0 + letters * 0.55
            if (value.length in 3..24) score += 10.0
            if (digits <= 2) score += 5.0
            if (cy < 0.72) score += 7.0
            if (line.elements.size in 1..5) score += 4.0
            if (value == value.uppercase(Locale.ROOT) && letters >= 3) score += 3.0
            Candidate(value, score)
        }
    }

    private fun finish(image: InputImage, raw: String, candidates: List<Candidate>, callback: (Result) -> Unit) {
        val labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
        labeler.process(image)
            .addOnSuccessListener { labels ->
                val labelText = labels.filter { it.confidence >= 0.50f }.joinToString(" ") { it.text }
                labeler.close()
                callback(Result(chooseName(candidates, raw), chooseCategory(raw, labelText), raw))
            }
            .addOnFailureListener { labeler.close(); callback(Result(chooseName(candidates, raw), chooseCategory(raw, ""), raw)) }
    }

    private fun chooseName(candidates: List<Candidate>, raw: String): String {
        if (candidates.isNotEmpty()) {
            val grouped = candidates.groupBy { clean(it.text).lowercase(Locale.ROOT) }
            return grouped.values.maxByOrNull { group -> group.maxOf { it.score } + group.size * 8.0 }
                ?.maxByOrNull { it.score }?.text.orEmpty()
        }
        return raw.lineSequence().map(::clean).filter { it.length in 2..40 && it.count(Char::isLetter) >= 2 }
            .maxByOrNull { it.count(Char::isLetter) }.orEmpty()
    }

    private fun clean(value: String): String = value.replace(Regex("\\s+"), " ").trim(' ', '-', ':', '|', '_')

    private fun loadBitmap(context: Context, uri: Uri): Bitmap? = runCatching {
        val decoded = context.contentResolver.openInputStream(uri).use { input -> BitmapFactory.decodeStream(input) } ?: return@runCatching null
        val orientation = context.contentResolver.openInputStream(uri).use { input -> if (input != null) ExifInterface(input).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) else ExifInterface.ORIENTATION_NORMAL }
        val degrees = when (orientation) { ExifInterface.ORIENTATION_ROTATE_90 -> 90f; ExifInterface.ORIENTATION_ROTATE_180 -> 180f; ExifInterface.ORIENTATION_ROTATE_270 -> 270f; else -> 0f }
        val oriented = if (degrees != 0f) Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, Matrix().apply { postRotate(degrees) }, true) else decoded
        val maxSide = maxOf(oriented.width, oriented.height)
        if (maxSide <= 1800) oriented else {
            val scale = 1800f / maxSide
            Bitmap.createScaledBitmap(oriented, (oriented.width * scale).toInt().coerceAtLeast(1), (oriented.height * scale).toInt().coerceAtLeast(1), true)
        }
    }.getOrNull()

    private fun enhance(source: Bitmap): Bitmap {
        val out = Bitmap.createBitmap(source.width, source.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val gray = ColorMatrix().apply { setSaturation(0f) }
        val c = 1.7f
        val t = 128f * (1f - c)
        gray.postConcat(ColorMatrix(floatArrayOf(c,0f,0f,0f,t, 0f,c,0f,0f,t, 0f,0f,c,0f,t, 0f,0f,0f,1f,0f)))
        canvas.drawBitmap(source, 0f, 0f, Paint(Paint.ANTI_ALIAS_FLAG).apply { colorFilter = ColorMatrixColorFilter(gray) })
        return out
    }

    private fun chooseCategory(raw: String, labels: String): String {
        val hay = (raw + " " + labels).lowercase(Locale.ROOT)
        val rules = listOf(
            "BISCUITS / WAFERS" to listOf("biscuit", "cookie", "wafer", "cracker"),
            "CANDY / CHOCOLATE" to listOf("candy", "toffee", "chocolate", "lollipop", "gum"),
            "SNACKS" to listOf("chips", "snack", "nimko", "namkeen", "crisps", "popcorn"),
            "BEVERAGES" to listOf("juice", "drink", "beverage", "soda", "cola", "water", "coffee", "tea"),
            "DAIRY" to listOf("milk", "dairy", "cream", "yogurt", "cheese"),
            "SPICES" to listOf("spice", "masala", "pepper", "chilli", "turmeric", "cumin"),
            "OIL / GHEE" to listOf("ghee", "cooking oil", "vegetable oil", "sunflower oil"),
            "FLOUR / GRAINS" to listOf("flour", "atta", "maida", "rice", "grain"),
            "PERSONAL / HOME CARE" to listOf("soap", "shampoo", "detergent", "toothpaste", "cleaner", "wash")
        )
        return rules.firstOrNull { (_, words) -> words.any { hay.contains(it) } }?.first ?: "GENERAL"
    }
}
''', encoding='utf-8')

# Version bump.
gradle = gradle_path.read_text(encoding='utf-8').replace('versionCode = 13', 'versionCode = 14', 1).replace('versionName = "13.0.0"', 'versionName = "14.0.0"', 1)
gradle_path.write_text(gradle, encoding='utf-8')

print('V14 delete, optional Carton rates, portrait scanner and stronger OCR patch applied')
