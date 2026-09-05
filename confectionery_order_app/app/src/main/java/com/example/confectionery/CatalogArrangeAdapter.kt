package com.example.confectionery

import android.content.Context
import android.net.Uri
import android.view.Gravity
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.confectionery.data.ProductEntity
import java.util.Collections

class CatalogArrangeAdapter(
    private val context: Context,
    private val items: MutableList<ProductEntity>
) : RecyclerView.Adapter<CatalogArrangeAdapter.Holder>() {

    class Holder(val box: LinearLayout, val image: ImageView, val title: TextView) : RecyclerView.ViewHolder(box)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val density = context.resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()
        val box = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(8), dp(8), dp(8), dp(8))
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        val image = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            adjustViewBounds = true
            minimumHeight = dp(140)
        }
        val title = TextView(context).apply {
            textSize = 15f
            gravity = Gravity.CENTER
            setPadding(0, dp(6), 0, dp(4))
        }
        box.addView(image, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(150)))
        box.addView(title, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        return Holder(box, image, title)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val item = items[position]
        holder.title.text = "☰  ${item.name}\n${item.category}"
        if (item.photoUri.isNullOrBlank()) {
            holder.image.setImageResource(R.drawable.ic_orderbook_logo)
        } else {
            runCatching { holder.image.setImageURI(Uri.parse(item.photoUri)) }
                .onFailure { holder.image.setImageResource(R.drawable.ic_orderbook_logo) }
        }
    }

    fun move(from: Int, to: Int) {
        if (from !in items.indices || to !in items.indices || from == to) return
        Collections.swap(items, from, to)
        notifyItemMoved(from, to)
    }

    fun currentOrder(): List<ProductEntity> = items.toList()
}
