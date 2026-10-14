package social.tbone.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.youniversal.theme.YouniversalTheme

/**
 * Shared shape bridge for the legacy T-Bone widgets.
 *
 * Classic mode deliberately stays square. In Youniversal mode the returned
 * shape comes from MaterialTheme, so the persisted corner-roundness control
 * changes real app surfaces instead of only changing unused Material defaults.
 */
@Composable
fun appCornerShape(
    youniversalShape: Shape = MaterialTheme.shapes.medium,
    classicShape: Shape = RectangleShape,
): Shape = if (YouniversalTheme.enabled) youniversalShape else classicShape

/** Clip a legacy component only when the Youniversal engine is active. */
@Composable
fun Modifier.appClip(shape: Shape = MaterialTheme.shapes.medium): Modifier =
    if (YouniversalTheme.enabled) clip(shape) else this

/** Apply an app surface background with a Youniversal shape; classic mode remains square. */
@Composable
fun Modifier.appBackground(
    color: Color,
    shape: Shape = MaterialTheme.shapes.medium,
): Modifier = if (YouniversalTheme.enabled) {
    clip(shape).background(color, shape)
} else {
    background(color)
}

/** Apply a border and matching clip using Youniversal's adjustable shape scale. */
@Composable
fun Modifier.appBorder(
    width: Dp = 1.dp,
    color: Color,
    youniversalShape: Shape = MaterialTheme.shapes.medium,
    classicShape: Shape = RectangleShape,
): Modifier = if (YouniversalTheme.enabled) {
    // Clip the fill and children too; a rounded outline around a square surface
    // would otherwise leave the corners visibly unrounded.
    this.clip(youniversalShape).border(width, color, youniversalShape)
} else {
    this.border(width, color, classicShape)
}
