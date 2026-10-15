package social.tbone.ui.feed

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Code
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.OpenInBrowser
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.TextFields
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.ClipboardManager
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.PopupProperties
import kotlinx.serialization.json.Json
import social.tbone.nostr.Event
import social.tbone.nostr.Nip19
import social.tbone.ui.theme.BonyColors
import social.tbone.ui.theme.BonyType

private val PrettyEventJson: Json = Json {
    ignoreUnknownKeys = true
    prettyPrint = true
    prettyPrintIndent = "  "
}

/** Compact, anchored note/reply action menu, following Amethyst's 3-dot action pattern. */
@Composable
fun NoteActionsMenu(
    event: Event,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var expanded by remember(event.id) { mutableStateOf(false) }
    var rawJson by remember(event.id) { mutableStateOf<String?>(null) }
    var showRawJson by remember(event.id) { mutableStateOf(false) }

    val nevent = remember(event.id, event.pubkey, event.kind) {
        runCatching { Nip19.hexToNevent(event.id, event.pubkey, event.kind) }
            .getOrElse { Nip19.hexToNote(event.id) }
    }

    Box(modifier = modifier) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .clickable(role = Role.Button) { expanded = true },
            contentAlignment = Alignment.Center,
        ) {
            Canvas(
                modifier = Modifier
                    .size(18.dp)
                    .semantics { contentDescription = "More note actions" },
            ) {
                val radius = 1.45.dp.toPx()
                val centerX = size.width / 2f
                val centerY = size.height / 2f
                val sideOffset = size.width * 0.22f
                val verticalOffset = size.height * 0.20f
                drawCircle(BonyColors.TextMute, radius, Offset(centerX, centerY - verticalOffset))
                drawCircle(BonyColors.TextMute, radius, Offset(centerX - sideOffset, centerY + verticalOffset))
                drawCircle(BonyColors.TextMute, radius, Offset(centerX + sideOffset, centerY + verticalOffset))
            }
        }

        val menuScheme = MaterialTheme.colorScheme.copy(
            surfaceContainer = BonyColors.Surface,
            surfaceContainerHigh = BonyColors.Surface,
            surfaceContainerLow = BonyColors.Surface,
        )
        MaterialTheme(colorScheme = menuScheme) {
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                properties = PopupProperties(focusable = true),
            ) {
                NoteActionMenuItem(Icons.Outlined.Code, "View Raw JSON") {
                    expanded = false
                    rawJson = PrettyEventJson.encodeToString(Event.serializer(), event)
                    showRawJson = true
                }
                NoteActionMenuItem(Icons.Outlined.ContentCopy, "Copy JSON") {
                    expanded = false
                    copyText(context, clipboard, PrettyEventJson.encodeToString(Event.serializer(), event), "JSON")
                }
                NoteActionMenuItem(Icons.Outlined.TextFields, "Copy note text") {
                    expanded = false
                    copyText(context, clipboard, event.content, "Note text")
                }
                NoteActionMenuItem(Icons.Outlined.Share, "Share Nostr event (nevent)") {
                    expanded = false
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "nostr:$nevent")
                    }
                    context.startSafely(Intent.createChooser(send, "Share Nostr event"))
                }
                NoteActionMenuItem(Icons.Outlined.OpenInBrowser, "Open on Njump") {
                    expanded = false
                    context.startSafely(
                        Intent(Intent.ACTION_VIEW, Uri.parse("https://njump.me/$nevent")),
                    )
                }
                NoteActionMenuItem(Icons.Outlined.OpenInNew, "Open in another client") {
                    expanded = false
                    openInAnotherNostrClient(context, nevent)
                }
            }
        }
    }

    if (showRawJson) {
        val json = rawJson.orEmpty()
        AlertDialog(
            onDismissRequest = { showRawJson = false },
            containerColor = BonyColors.Surface,
            titleContentColor = BonyColors.Text,
            textContentColor = BonyColors.TextDim,
            title = {
                Column {
                    Text("Raw Nostr event", style = BonyType.body.copy(color = BonyColors.Text))
                    Text(
                        "kind ${event.kind} · ${event.id.take(12)}…",
                        style = BonyType.caption.copy(color = BonyColors.TextMute),
                    )
                }
            },
            text = {
                SelectionContainer {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 440.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(BonyColors.Bg)
                            .verticalScroll(rememberScrollState())
                            .padding(12.dp),
                    ) {
                        Text(
                            text = json,
                            style = BonyType.caption.copy(
                                color = BonyColors.Text,
                                fontFamily = FontFamily.Monospace,
                            ),
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    copyText(context, clipboard, json, "JSON")
                    showRawJson = false
                }) {
                    Text("COPY JSON", color = BonyColors.Accent)
                }
            },
            dismissButton = {
                TextButton(onClick = { showRawJson = false }) {
                    Text("CLOSE", color = BonyColors.TextMute)
                }
            },
        )
    }
}

@Composable
private fun NoteActionMenuItem(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        text = { Text(label, style = BonyType.tag.copy(color = BonyColors.Text)) },
        leadingIcon = {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = BonyColors.TextMute,
                modifier = Modifier.size(18.dp),
            )
        },
        onClick = onClick,
        modifier = Modifier.heightIn(min = 40.dp),
        contentPadding = PaddingValues(horizontal = 12.dp),
    )
}

private fun copyText(
    context: Context,
    clipboard: ClipboardManager,
    text: String,
    description: String,
) {
    clipboard.setText(AnnotatedString(text))
    Toast.makeText(context, "$description copied", Toast.LENGTH_SHORT).show()
}

private fun openInAnotherNostrClient(context: Context, nevent: String) {
    val nostrIntent = Intent(Intent.ACTION_VIEW, Uri.parse("nostr:$nevent"))
    val matches = runCatching {
        context.packageManager.queryIntentActivities(
            nostrIntent,
            PackageManager.MATCH_DEFAULT_ONLY,
        )
    }.getOrDefault(emptyList())
    val hasOtherClient = matches.any { info ->
        info.activityInfo?.packageName?.let { it != context.packageName } == true
    }
    if (!hasOtherClient) {
        Toast.makeText(context, "No other Nostr client found", Toast.LENGTH_SHORT).show()
        return
    }

    val chooser = Intent.createChooser(nostrIntent, "Open in another Nostr client")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        val ownActivities = matches.mapNotNull { info ->
            info.activityInfo
                ?.takeIf { it.packageName == context.packageName }
                ?.let { ComponentName(it.packageName, it.name) }
        }.toTypedArray()
        if (ownActivities.isNotEmpty()) {
            chooser.putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, ownActivities)
        }
    }
    context.startSafely(chooser)
}

private fun Context.startSafely(intent: Intent) {
    runCatching { startActivity(intent) }.onFailure {
        Toast.makeText(this, "No app could open this link", Toast.LENGTH_SHORT).show()
    }
}
