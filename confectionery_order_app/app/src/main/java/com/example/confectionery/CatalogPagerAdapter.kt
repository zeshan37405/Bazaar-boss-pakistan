package com.example.confectionery

import android.net.Uri
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.confectionery.data.ProductEntity
import java.util.Locale

class CatalogPagerAdapter(
    private val products: List<ProductEntity>,
    private val onAdd: (ProductEntity) -> Unit
) : RecyclerView.Adapter<CatalogPagerAdapter.Holder>() {

    class Holder(val box: LinearLayout) : RecyclerView.ViewHolder(box)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val context = parent.context
        val box = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(24, 24, 24, 24)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        return Holder(box)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val p = products[position]
        val context = holder.box.context
        holder.box.removeAllViews()
        val image = ImageView(context).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
            scaleType = ImageView.ScaleType.FIT_CENTER
            if (p.photoUri.isNullOrBlank()) setImageResource(android.R.drawable.ic_menu_gallery)
            else runCatching { setImageURI(Uri.parse(p.photoUri)) }.onFailure { setImageResource(android.R.drawable.ic_menu_gallery) }
            setOnClickListener { onAdd(p) }
        }
        holder.box.addView(image)
        holder.box.addView(TextView(context).apply {
            text = p.name
            textSize = 24f
            gravity = Gravity.CENTER
            setPadding(8, 16, 8, 4)
        })
        holder.box.addView(TextView(context).apply {
            text = buildString {
                if (p.category.isNotBlank()) append(p.category).append("  •  ")
                append("From Rs ").append(String.format(Locale.US, "%,.2f", p.saleRate))
            }
            textSize = 17f
            gravity = Gravity.CENTER
            setPadding(8, 4, 8, 12)
        })
        holder.box.addView(Button(context).apply {
            text = "Add to Order"
            isAllCaps = false
            setOnClickListener { onAdd(p) }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    override fun getItemCount(): Int = products.size
}
