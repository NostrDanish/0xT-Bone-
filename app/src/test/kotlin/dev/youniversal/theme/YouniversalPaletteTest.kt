package dev.youniversal.theme

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class YouniversalPaletteTest {
    @Test
    fun `cream background matches the classic T-Bone cream background`() {
        val classicCream = Color(0xFFD9CEB0)
        val cream = youniversalCreamColorScheme()
        assertEquals(classicCream, cream.background)
        assertEquals(classicCream, youniversalColorScheme(YouniversalBackgroundStyle.Cream).background)
        assertEquals(classicCream, YouniversalTonalPalette
            .colorScheme(Color(0xFF3E63DD), isDark = false, vividAccents = true)
            .withCreamNeutrals().background)
    }

    @Test
    fun `light and cream accent colors retain strong text contrast`() {
        val light = youniversalLightColorScheme()
        val cream = youniversalCreamColorScheme()
        assertTrue(light.primary.youniversalContrastAgainst(light.background) >= 4.5f)
        assertTrue(light.secondary.youniversalContrastAgainst(light.background) >= 4.5f)
        assertTrue(light.tertiary.youniversalContrastAgainst(light.background) >= 4.5f)
        assertEquals(light.primary, light.surfaceTint)
        assertTrue(cream.primary.youniversalContrastAgainst(cream.background) >= 4.5f)
        assertTrue(cream.secondary.youniversalContrastAgainst(cream.background) >= 4.5f)
        assertTrue(cream.tertiary.youniversalContrastAgainst(cream.background) >= 4.5f)
        assertEquals(cream.primary, cream.surfaceTint)
    }
}
