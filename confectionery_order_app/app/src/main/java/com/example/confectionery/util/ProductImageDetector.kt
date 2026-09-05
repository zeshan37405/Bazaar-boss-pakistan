package com.example.confectionery.util

import android.content.Context
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.Locale

object ProductImageDetector {
    data class Result(
        val suggestedName: String,
        val suggestedCategory: String,
        val recognizedText: String
    )

    fun detect(context: Context, uri: Uri, callback: (Result) -> Unit) {
        val image = runCatching { InputImage.fromFilePath(context, uri) }.getOrElse {
            callback(Result("", "GENERAL", "")); return
        }
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer.process(image)
            .addOnSuccessListener { text ->
                val raw = text.text.orEmpty()
                recognizer.close()
                detectLabels(image, raw, callback)
            }
            .addOnFailureListener {
                recognizer.close()
                detectLabels(image, "", callback)
            }
    }

    private fun detectLabels(image: InputImage, rawText: String, callback: (Result) -> Unit) {
        val labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
        labeler.process(image)
            .addOnSuccessListener { labels ->
                val labelText = labels.filter { it.confidence >= 0.55f }.joinToString(" ") { it.text }
                labeler.close()
                callback(Result(
                    suggestedName = chooseName(rawText),
                    suggestedCategory = chooseCategory(rawText, labelText),
                    recognizedText = rawText
                ))
            }
            .addOnFailureListener {
                labeler.close()
                callback(Result(chooseName(rawText), chooseCategory(rawText, ""), rawText))
            }
    }

    private fun chooseName(raw: String): String {
        val stop = listOf(
            "net wt", "net weight", "ingredients", "nutrition", "price", "m.r.p", "mrp",
            "manufactured", "expiry", "best before", "batch", "barcode", "customer care"
        )
        val candidates = raw.lineSequence()
            .map { it.replace(Regex("\\s+"), " ").trim(' ', '-', ':', '|') }
            .filter { line ->
                line.length in 3..45 &&
                    line.any { it.isLetter() } &&
                    line.count { it.isLetter() } >= 3 &&
                    stop.none { line.lowercase(Locale.ROOT).contains(it) }
            }
            .toList()
        if (candidates.isEmpty()) return ""
        return candidates.maxByOrNull { line ->
            var score = line.count { it.isLetter() }
            if (line.length in 4..24) score += 8
            if (line.count { it.isDigit() } <= 3) score += 4
            if (line == line.uppercase(Locale.ROOT)) score += 2
            score
        }.orEmpty()
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
