package social.tbone.ui.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import social.tbone.account.AccountRepository
import social.tbone.account.signer.NostrSignerFactory
import social.tbone.lists.MuteListRepository
import social.tbone.lists.MuteOutcome
import social.tbone.nostr.Event
import social.tbone.nostr.Nip56Report
import social.tbone.nostr.Nip56ReportReason
import social.tbone.notes.BookmarkFolderUi
import social.tbone.notes.BookmarkSaveResult
import social.tbone.notes.BookmarksRepository
import social.tbone.nostr.relay.RelayPool
import social.tbone.nostr.relay.RelayStatus
import social.tbone.settings.AppSettings
import javax.inject.Inject

@HiltViewModel
class NoteActionsViewModel @Inject constructor(
    appSettings: AppSettings,
    private val accountRepository: AccountRepository,
    private val muteListRepository: MuteListRepository,
    private val signerFactory: NostrSignerFactory,
    private val relayPool: RelayPool,
    private val bookmarksRepository: BookmarksRepository,
) : ViewModel() {
    val moderationActionsEnabled = appSettings.noteMenuModerationEnabled
    val bookmarkFolders: StateFlow<List<BookmarkFolderUi>> = bookmarksRepository.folders
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun saveBookmark(event: Event, folderId: String, onFinished: (String) -> Unit) {
        viewModelScope.launch {
            val message = runCatching { bookmarksRepository.addBookmark(event, folderId) }
                .fold(
                    onSuccess = { result ->
                        when (result) {
                            BookmarkSaveResult.SAVED -> "Saved to bookmarks"
                            BookmarkSaveResult.ALREADY_SAVED -> "Already saved in that folder"
                        }
                    },
                    onFailure = { it.message ?: "Could not save bookmark" },
                )
            onFinished(message)
        }
    }

    fun blockAuthor(pubkey: String, onFinished: (String) -> Unit) {
        viewModelScope.launch {
            val activePubkey = accountRepository.activeAccount.first()?.pubkey
            if (activePubkey == null) {
                onFinished("No active account")
                return@launch
            }
            if (activePubkey == pubkey) {
                onFinished("You can't block your active account")
                return@launch
            }
            val message = when (runCatching { muteListRepository.setMuted(pubkey, true) }
                .getOrElse { MuteOutcome.SIGN_FAILED }) {
                MuteOutcome.SAVED_LOCAL -> "Poster blocked on this device"
                MuteOutcome.PUBLISHED -> "Poster blocked"
                MuteOutcome.UNCHANGED -> "Poster is already blocked"
                MuteOutcome.NO_SIGNER -> "No signer available — poster was not blocked"
                MuteOutcome.RELAYS_UNREACHABLE -> "Couldn't reach relays — poster was not blocked"
                MuteOutcome.SIGN_FAILED -> "Block failed — poster was not blocked"
                MuteOutcome.NO_ACCOUNT -> "No active account"
                MuteOutcome.REJECTED -> "Can't block this account"
            }
            onFinished(message)
        }
    }

    fun reportNote(
        event: Event,
        reason: Nip56ReportReason,
        comment: String,
        onFinished: (String) -> Unit,
    ) {
        viewModelScope.launch {
            val signer = signerFactory.forActiveAccount()
            if (signer == null) {
                onFinished("No signer available — report was not sent")
                return@launch
            }
            val unsigned = Nip56Report.forNote(
                reporterPubkey = signer.pubkey,
                target = event,
                reason = reason,
                comment = comment,
            )
            signer.signEvent(unsigned)
                .onSuccess { signed ->
                    val connected = relayPool.relayStatuses.value.values.count { it == RelayStatus.CONNECTED }
                    relayPool.publish(signed)
                    onFinished(
                        if (connected > 0) "NIP-56 report sent to $connected connected relay(s)"
                        else "Report signed, but no relays are connected",
                    )
                }
                .onFailure { onFinished("Report signing failed") }
        }
    }
}
