package social.tbone.ui.notes

import social.tbone.ui.theme.appBorder
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import social.tbone.backup.EncryptedBackupViewModel
import social.tbone.ui.theme.BonyColors
import social.tbone.ui.theme.BonyType
import java.time.LocalDate

/**
 * A neat, plain-language explanation of exactly how notes and checklists are
 * protected, plus your vault stats. Everything is on-device; nothing is
 * uploaded.
 */
@Composable
fun NotesInfoScreen(
    onBack: () -> Unit,
    viewModel: NotesViewModel = hiltViewModel(),
) {

    val encryptionVerified by viewModel.encryptionVerified.collectAsStateWithLifecycle()
    val hardwareBacked by viewModel.hardwareBacked.collectAsStateWithLifecycle()
    val stats by viewModel.stats.collectAsStateWithLifecycle()
    val backupViewModel: EncryptedBackupViewModel = hiltViewModel()
    val backupState by backupViewModel.uiState.collectAsStateWithLifecycle()
    var showExportPassphrase by remember { mutableStateOf(false) }
    var showImportPassphrase by remember { mutableStateOf(false) }
    var passphrase by remember { mutableStateOf("") }
    var passphraseConfirmation by remember { mutableStateOf("") }
    var selectedBackupUri by remember { mutableStateOf<Uri?>(null) }
    var exportPassphraseForPicker by remember { mutableStateOf<String?>(null) }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/octet-stream"),
    ) { uri ->
        val secret = exportPassphraseForPicker
        exportPassphraseForPicker = null
        if (uri != null && secret != null) backupViewModel.export(uri, secret)
    }
    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri != null) {
            selectedBackupUri = uri
            passphrase = ""
            showImportPassphrase = true
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BonyColors.Bg)
            .statusBarsPadding(),
    ) {
        // ── Top bar ───────────────────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "←",
                style = BonyType.body.copy(color = BonyColors.TextMute),
                modifier = Modifier.clickable { onBack() },
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "encryption",
                style = BonyType.body.copy(color = BonyColors.Text),
                modifier = Modifier.weight(1f),
            )
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(BonyColors.Rule))

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 14.dp, vertical = 12.dp),
        ) {
            InfoCard(title = "how it works") {
                Text(
                    text = "Notes and checklists are encrypted on this device " +
                        "before anything is written to storage. The database only " +
                        "holds ciphertext — the raw text never touches disk and " +
                        "nothing is ever uploaded.",
                    style = BonyType.meta.copy(color = BonyColors.TextDim),
                )
            }

            InfoCard(title = "cipher") {
                StatRow("algorithm", viewModel.cipherLabel)
                StatRow("key size", "256-bit AES")
                StatRow("authentication", "${viewModel.tagBits}-bit GCM tag")
                StatRow("random IV", "${viewModel.ivLength} bytes, fresh per save")
                StatRow("integrity", "tampering detected & rejected")
            }

            InfoCard(title = "key storage") {
                StatRow("where", "Android Keystore")
                StatRow("hardware-backed", if (hardwareBacked) "yes (secure chip)" else "no (software keystore)")
                StatRow("key leaves device", "never")
                StatRow("plaintext stored", "never")
            }

            InfoCard(title = "self-test") {
                StatRow(
                    "encrypt → decrypt round-trip",
                    if (encryptionVerified) "verified" else "failed",
                    ok = encryptionVerified,
                )
                Text(
                    text = "Runs at startup. The vault only reports itself " +
                        "encrypted when this passes.",
                    style = BonyType.metaDim.copy(color = BonyColors.TextMute),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }

            InfoCard(title = "your vault") {
                StatRow("notes", "${stats.noteCount}")
                StatRow("checklists", "${stats.checklistCount}")
                StatRow("ciphertext stored", formatBytes(stats.totalCiphertextBytes))
            }

            InfoCard(title = "encrypted backup") {
                Text(
                    text = "A portable, passphrase-encrypted backup of notes, checklists, attachments, folders and calendar events. Import replaces those datasets; it does not change accounts or other settings.",
                    style = BonyType.meta.copy(color = BonyColors.TextDim),
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Use a unique passphrase of at least 12 characters. It is not stored and cannot be recovered if forgotten.",
                    style = BonyType.metaDim.copy(color = BonyColors.TextMute),
                )
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    BackupActionButton(
                        label = "↑ EXPORT",
                        enabled = !backupState.busy,
                        modifier = Modifier.weight(1f),
                    ) { showExportPassphrase = true }
                    BackupActionButton(
                        label = "↓ IMPORT",
                        enabled = !backupState.busy,
                        modifier = Modifier.weight(1f),
                    ) { importLauncher.launch(arrayOf("application/octet-stream", "*/*")) }
                }
                if (backupState.busy) {
                    Row(
                        modifier = Modifier.padding(top = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(modifier = Modifier.height(18.dp).width(18.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                        Text("working…", style = BonyType.meta.copy(color = BonyColors.TextMute))
                    }
                }
                backupState.status?.let { status ->
                    Text(
                        text = status,
                        style = BonyType.meta.copy(
                            color = if (backupState.isError) BonyColors.Danger else BonyColors.Accent,
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { backupViewModel.clearStatus() }
                            .padding(top = 10.dp),
                    )
                }
            }

            Text(
                text = "all encryption happens on this device · nothing is uploaded",
                style = BonyType.caption.copy(color = BonyColors.TextMute),
                modifier = Modifier.padding(top = 16.dp, bottom = 24.dp),
            )
            Spacer(Modifier.height(48.dp))
        }
    }

    if (showExportPassphrase) {
        AlertDialog(
            onDismissRequest = {
                showExportPassphrase = false
                passphrase = ""
                passphraseConfirmation = ""
            },
            title = { Text("Protect the backup") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Choose a passphrase you can keep separately. Anyone with the file and this passphrase can read its contents.",
                        style = BonyType.meta.copy(color = BonyColors.TextDim),
                    )
                    BackupPassphraseField("Passphrase", passphrase) { passphrase = it }
                    BackupPassphraseField("Confirm passphrase", passphraseConfirmation) { passphraseConfirmation = it }
                    if (passphrase.isNotEmpty() && passphrase.length < 12) {
                        Text("Use at least 12 characters.", style = BonyType.meta.copy(color = BonyColors.Danger))
                    } else if (passphraseConfirmation.isNotEmpty() && passphrase != passphraseConfirmation) {
                        Text("Passphrases do not match.", style = BonyType.meta.copy(color = BonyColors.Danger))
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = passphrase.length >= 12 && passphrase == passphraseConfirmation && !backupState.busy,
                    onClick = {
                        exportPassphraseForPicker = passphrase
                        passphrase = ""
                        passphraseConfirmation = ""
                        showExportPassphrase = false
                        exportLauncher.launch("tbone-backup-${LocalDate.now()}.tbbackup")
                    },
                ) { Text("Choose file") }
            },
            dismissButton = {
                TextButton(onClick = {
                    showExportPassphrase = false
                    passphrase = ""
                    passphraseConfirmation = ""
                }) { Text("Cancel") }
            },
        )
    }

    if (showImportPassphrase && selectedBackupUri != null) {
        AlertDialog(
            onDismissRequest = {
                showImportPassphrase = false
                selectedBackupUri = null
                passphrase = ""
            },
            title = { Text("Restore backup?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "This replaces your current notes, checklists, attachments, folders and calendar events. Other app data is unchanged. If authentication or validation fails, the current vault is preserved.",
                        style = BonyType.meta.copy(color = BonyColors.TextDim),
                    )
                    BackupPassphraseField("Backup passphrase", passphrase) { passphrase = it }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = passphrase.isNotBlank() && !backupState.busy,
                    onClick = {
                        val uri = selectedBackupUri
                        if (uri != null) backupViewModel.restore(uri, passphrase)
                        passphrase = ""
                        selectedBackupUri = null
                        showImportPassphrase = false
                    },
                ) { Text("Restore and replace") }
            },
            dismissButton = {
                TextButton(onClick = {
                    showImportPassphrase = false
                    selectedBackupUri = null
                    passphrase = ""
                }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun BackupPassphraseField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Password,
            capitalization = KeyboardCapitalization.None,
            autoCorrectEnabled = false,
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun BackupActionButton(
    label: String,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier = modifier
            .appBorder(1.dp, if (enabled) BonyColors.AccentDim else BonyColors.Rule)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = BonyType.tag.copy(color = if (enabled) BonyColors.Accent else BonyColors.TextMute),
        )
    }
}

@Composable
private fun InfoCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp)
            .appBorder(1.dp, BonyColors.Rule)
            .background(BonyColors.Surface)
            .padding(14.dp),
    ) {
        Text(
            text = title,
            style = BonyType.caption.copy(color = BonyColors.Accent),
            modifier = Modifier.padding(bottom = 10.dp),
        )
        content()
    }
}

@Composable
private fun StatRow(label: String, value: String, ok: Boolean? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = BonyType.meta.copy(color = BonyColors.TextMute),
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            style = BonyType.meta.copy(
                color = when (ok) {
                    true -> BonyColors.Accent
                    false -> BonyColors.Danger
                    null -> BonyColors.Text
                },
            ),
        )
    }
}

private fun formatBytes(bytes: Long): String = when {
    bytes < 1_024 -> "$bytes B"
    bytes < 1_048_576 -> "%.1f KB".format(bytes / 1024.0)
    else -> "%.1f MB".format(bytes / 1_048_576.0)
}
