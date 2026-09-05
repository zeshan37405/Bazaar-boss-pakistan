from pathlib import Path

path = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/util/ProductImageDetector.kt')
text = path.read_text(encoding='utf-8')
text = text.replace(
    '            recognizeOne(fallback) { text -> finish(fallback, text.text, candidatesFrom(text, 1, 1), callback) }',
    '''            recognizeOne(fallback) { text ->
                if (text == null) finish(fallback, "", emptyList(), callback)
                else finish(fallback, text.text, candidatesFrom(text, 1, 1), callback)
            }'''
)
text = text.replace(
    '''        recognizeOne(InputImage.fromBitmap(bitmap, 0)) { first ->
            rawParts += first.text.orEmpty()
            candidates += candidatesFrom(first, bitmap.width, bitmap.height)
            recognizeOne(InputImage.fromBitmap(enhanced, 0)) { second ->
                rawParts += second.text.orEmpty()
                candidates += candidatesFrom(second, enhanced.width, enhanced.height).map { it.copy(score = it.score + 4.0) }
                finish(InputImage.fromBitmap(bitmap, 0), rawParts.joinToString("\\n"), candidates, callback)
            }
        }''',
    '''        recognizeOne(InputImage.fromBitmap(bitmap, 0)) { first ->
            rawParts += first?.text.orEmpty()
            if (first != null) candidates += candidatesFrom(first, bitmap.width, bitmap.height)
            recognizeOne(InputImage.fromBitmap(enhanced, 0)) { second ->
                rawParts += second?.text.orEmpty()
                if (second != null) candidates += candidatesFrom(second, enhanced.width, enhanced.height).map { it.copy(score = it.score + 4.0) }
                finish(InputImage.fromBitmap(bitmap, 0), rawParts.joinToString("\\n"), candidates, callback)
            }
        }'''
)
text = text.replace('    private fun recognizeOne(image: InputImage, done: (Text) -> Unit) {', '    private fun recognizeOne(image: InputImage, done: (Text?) -> Unit) {')
text = text.replace('.addOnFailureListener { recognizer.close(); done(Text("", emptyList())) }', '.addOnFailureListener { recognizer.close(); done(null) }')
path.write_text(text, encoding='utf-8')
print('V14 OCR nullable callback fixed')
