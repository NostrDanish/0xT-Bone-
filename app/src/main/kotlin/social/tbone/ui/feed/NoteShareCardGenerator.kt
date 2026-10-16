package social.tbone.ui.feed

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import social.tbone.nostr.Event
import java.io.File
import java.io.FileOutputStream
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.max

/** Renders a complete Nostr note as a branded, shareable PNG social card. */
object NoteShareCardGenerator {
    private const val WIDTH = 1080
    private const val MIN_HEIGHT = 1350
    private const val MAX_HEIGHT = 16_384
    private const val OUTER_MARGIN = 60f
    private const val CARD_TOP = 64f
    private const val CARD_RADIUS = 42f
    private const val CARD_PADDING = 58f

    fun render(
        context: Context,
        event: Event,
        authorName: String? = null,
    ): File {
        val body = event.content.ifBlank { "(empty note)" }
        val cardLeft = OUTER_MARGIN
        val cardRight = WIDTH - OUTER_MARGIN
        val cardWidth = cardRight - cardLeft
        val innerLeft = cardLeft + CARD_PADDING
        val innerWidth = (cardWidth - 2 * CARD_PADDING).toInt()

        val bodyPaint = textPaint(Color.rgb(235, 242, 241), 42f, "sans-serif")
        val bodyLayout = StaticLayout.Builder.obtain(body, 0, body.length, bodyPaint, innerWidth)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setIncludePad(false)
            .setLineSpacing(12f, 1.14f)
            .setBreakStrategy(Layout.BREAK_STRATEGY_HIGH_QUALITY)
            .setHyphenationFrequency(Layout.HYPHENATION_FREQUENCY_NORMAL)
            .build()

        val headerHeight = 86f
        val authorHeight = 128f
        val bodyTop = CARD_TOP + CARD_PADDING + headerHeight + authorHeight + 26f
        val footerTop = bodyTop + bodyLayout.height + 54f
        val cardBottom = footerTop + 112f
        val imageHeight = max(MIN_HEIGHT.toFloat(), cardBottom + CARD_TOP).toInt()
        require(imageHeight <= MAX_HEIGHT) { "This note is too long for a single share card" }

        val bitmap = Bitmap.createBitmap(WIDTH, imageHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawBackground(canvas, imageHeight)

        val card = RectF(cardLeft, CARD_TOP, cardRight, cardBottom)
        val cardPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(15, 24, 27)
            style = Paint.Style.FILL
        }
        canvas.drawRoundRect(card, CARD_RADIUS, CARD_RADIUS, cardPaint)
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(44, 69, 70)
            style = Paint.Style.STROKE
            strokeWidth = 2f
        }
        canvas.drawRoundRect(card, CARD_RADIUS, CARD_RADIUS, borderPaint)

        val accent = Color.rgb(112, 226, 185)
        val muted = Color.rgb(151, 173, 173)
        val rule = Color.rgb(43, 62, 64)
        val headerY = CARD_TOP + CARD_PADDING

        // Compact T-Bone mark and a restrained client signature.
        val markRect = RectF(innerLeft, headerY, innerLeft + 48f, headerY + 48f)
        val markPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = accent
            style = Paint.Style.FILL
        }
        canvas.drawRoundRect(markRect, 14f, 14f, markPaint)
        val markText = textPaint(Color.rgb(9, 24, 25), 30f, "sans-serif-bold").apply { textAlign = Paint.Align.CENTER }
        canvas.drawText("T", markRect.centerX(), markRect.centerY() + 11f, markText)

        val brandPaint = textPaint(Color.rgb(228, 240, 237), 25f, "sans-serif-bold")
        canvas.drawText("T-BONE", innerLeft + 64f, headerY + 32f, brandPaint)
        val microPaint = textPaint(muted, 18f, "sans-serif-medium").apply { textAlign = Paint.Align.RIGHT }
        canvas.drawText("NOSTR  ·  NOTE", cardRight - CARD_PADDING, headerY + 30f, microPaint)
        canvas.drawText("A thought worth sharing", cardRight - CARD_PADDING, headerY + 56f, microPaint)

        val dividerY = headerY + 76f
        canvas.drawLine(innerLeft, dividerY, cardRight - CARD_PADDING, dividerY, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = rule
            strokeWidth = 2f
        })

        val authorTop = dividerY + 28f
        val avatarCx = innerLeft + 38f
        val avatarCy = authorTop + 37f
        canvas.drawCircle(avatarCx, avatarCy, 37f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(27, 59, 56)
        })
        canvas.drawCircle(avatarCx, avatarCy, 36f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = accent
            style = Paint.Style.STROKE
            strokeWidth = 2f
        })
        val name = authorName?.trim()?.takeIf { it.isNotEmpty() } ?: "Nostr user"
        val initials = name.split(Regex("\\s+")).take(2).mapNotNull { it.firstOrNull() }
            .joinToString("").uppercase(Locale.ROOT).ifBlank { event.pubkey.take(2).uppercase(Locale.ROOT) }
        val initialsPaint = textPaint(accent, 23f, "sans-serif-bold").apply { textAlign = Paint.Align.CENTER }
        canvas.drawText(initials, avatarCx, avatarCy + 8f, initialsPaint)

        val namePaint = textPaint(Color.rgb(231, 241, 238), 29f, "sans-serif-medium")
        val visibleName = TextUtils.ellipsize(name, namePaint, innerWidth - 110f, TextUtils.TruncateAt.END).toString()
        canvas.drawText(visibleName, innerLeft + 94f, authorTop + 34f, namePaint)
        val handle = "@${event.pubkey.take(8)}…${event.pubkey.takeLast(6)}"
        val handlePaint = textPaint(muted, 20f, "sans-serif")
        canvas.drawText(handle, innerLeft + 94f, authorTop + 67f, handlePaint)

        // A short accent bar establishes the start of the note without hiding
        // any of its original text; StaticLayout wraps the whole body.
        val textTop = bodyTop
        canvas.drawRoundRect(
            RectF(innerLeft, textTop - 6f, innerLeft + 5f, textTop + bodyLayout.height + 6f),
            3f,
            3f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accent },
        )
        canvas.save()
        canvas.translate(innerLeft + 24f, textTop)
        bodyLayout.draw(canvas)
        canvas.restore()

        canvas.drawLine(innerLeft, footerTop, cardRight - CARD_PADDING, footerTop, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = rule
            strokeWidth = 2f
        })
        val date = Instant.ofEpochSecond(event.createdAt)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("MMM d, yyyy  ·  h:mm a", Locale.US))
        val datePaint = textPaint(muted, 20f, "sans-serif")
        canvas.drawText(date, innerLeft, footerTop + 43f, datePaint)
        val footerPaint = textPaint(accent, 19f, "sans-serif-medium").apply { textAlign = Paint.Align.RIGHT }
        canvas.drawText("SHARED WITH T-BONE", cardRight - CARD_PADDING, footerTop + 43f, footerPaint)
        val idPaint = textPaint(Color.rgb(105, 127, 129), 16f, "sans-serif")
        canvas.drawText("EVENT  ${event.id.take(16)}…", innerLeft, footerTop + 78f, idPaint)

        // Small accent stroke outside the card balances the generous negative space.
        canvas.drawRoundRect(
            RectF(OUTER_MARGIN, imageHeight - 30f, OUTER_MARGIN + 76f, imageHeight - 22f),
            4f,
            4f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accent }
        )

        val directory = File(context.cacheDir, "share_cards").apply { mkdirs() }
        val out = File(directory, "note-${event.id.take(20)}.png")
        FileOutputStream(out).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
        return out
    }

    private fun drawBackground(canvas: Canvas, height: Int) {
        val background = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(
                0f,
                0f,
                WIDTH.toFloat(),
                height.toFloat(),
                intArrayOf(Color.rgb(7, 16, 20), Color.rgb(13, 28, 32), Color.rgb(7, 13, 19)),
                null,
                Shader.TileMode.CLAMP,
            )
        }
        canvas.drawRect(0f, 0f, WIDTH.toFloat(), height.toFloat(), background)
        canvas.drawCircle(WIDTH - 40f, 40f, 260f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(12, 112, 226, 185)
        })
        canvas.drawCircle(20f, height - 20f, 240f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(9, 112, 226, 185)
        })
    }

    private fun textPaint(color: Int, sizePx: Float, family: String): TextPaint =
        TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            textSize = sizePx
            typeface = Typeface.create(family, Typeface.NORMAL)
        }
}
