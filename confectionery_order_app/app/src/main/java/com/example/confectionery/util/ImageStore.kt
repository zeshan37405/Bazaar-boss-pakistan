package com.example.confectionery.util

import android.content.Context
import android.net.Uri
import java.io.File
import java.util.UUID

object ImageStore {
    fun importImage(context: Context, source: Uri, prefix: String): String {
        val dir = File(context.filesDir, "offline_images").apply { mkdirs() }
        val file = File(dir, "${prefix}-${UUID.randomUUID()}.jpg")
        context.contentResolver.openInputStream(source).use { input ->
            requireNotNull(input) { "Unable to open image" }
            file.outputStream().use { output -> input.copyTo(output) }
        }
        return Uri.fromFile(file).toString()
    }
}
