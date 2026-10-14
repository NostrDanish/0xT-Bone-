// SPDX-License-Identifier: MIT
package dev.youniversal.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import social.tbone.R

/** App-wide typefaces available while Youniversal is active. */
public enum class YouniversalFontOption(
    public val label: String,
    public val description: String,
    public val fontFamily: FontFamily,
) {
    /** Familiar sans-serif system face; the default for a polished, readable UI. */
    STANDARD(
        label = "Standard",
        description = "Clean system sans-serif",
        fontFamily = FontFamily.SansSerif,
    ),

    /** A warmer, softly rounded sans-serif (Nunito Sans, SIL Open Font License). */
    SOFT_ROUNDED(
        label = "Soft",
        description = "Rounded, relaxed letterforms",
        fontFamily = YouniversalFonts.NunitoSans,
    )
}

/** Private resource-backed fonts used by this Android app's Youniversal options. */
private object YouniversalFonts {
    val NunitoSans: FontFamily = FontFamily(
        Font(R.font.nunito_sans_variable, weight = FontWeight.ExtraLight),
        Font(R.font.nunito_sans_variable, weight = FontWeight.Light),
        Font(R.font.nunito_sans_variable, weight = FontWeight.Normal),
        Font(R.font.nunito_sans_variable, weight = FontWeight.Medium),
        Font(R.font.nunito_sans_variable, weight = FontWeight.SemiBold),
        Font(R.font.nunito_sans_variable, weight = FontWeight.Bold),
        Font(R.font.nunito_sans_variable, weight = FontWeight.ExtraBold),
        Font(R.font.nunito_sans_variable, weight = FontWeight.Black),
    )
}
