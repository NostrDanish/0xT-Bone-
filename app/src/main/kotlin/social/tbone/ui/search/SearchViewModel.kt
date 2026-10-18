package social.tbone.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.withTimeoutOrNull
import social.tbone.nostr.EventKind
import social.tbone.nostr.Filter
import social.tbone.nostr.Nip19
import social.tbone.nostr.Event
import social.tbone.nostr.ProfileContent
import social.tbone.nostr.relay.RelayMessage
import social.tbone.db.EventRepository
import social.tbone.notes.BookmarksRepository
import social.tbone.ui.feed.EventOpenCoordinator
import social.tbone.nostr.relay.RelayPool
import social.tbone.profile.ProfileRepository
import social.tbone.Tunables
import javax.inject.Inject

data class ProfileMatch(val pubkey: String, val profile: ProfileContent?)

sealed interface SearchUiState {
    data object Idle : SearchUiState
    data class EventInput(
        val eventId: String,
        val event: Event? = null,
        val loading: Boolean = true,
        val error: String? = null,
    ) : SearchUiState
    data class NpubInput(val pubkey: String, val profile: ProfileContent?) : SearchUiState
    data class HashtagInput(val tag: String) : SearchUiState
    data object Searching : SearchUiState
    data class Results(val profiles: List<ProfileMatch>) : SearchUiState
}

@OptIn(FlowPreview::class)
@HiltViewModel
class SearchViewModel @Inject constructor(
    private val pool: RelayPool,
    private val profileRepository: ProfileRepository,
    private val eventRepository: EventRepository,
    private val bookmarksRepository: BookmarksRepository,
    private val eventOpenCoordinator: EventOpenCoordinator,
) : ViewModel() {

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    private val _uiState = MutableStateFlow<SearchUiState>(SearchUiState.Idle)
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var searchRelayAdded = false
    private var eventLookupJob: Job? = null

    init {
        viewModelScope.launch {
            _query.debounce(300).collectLatest { q -> processQuery(q.trim()) }
        }
    }

    fun onQueryChange(q: String) = _query.update { q }

    private suspend fun processQuery(q: String) {
        eventLookupJob?.cancel()
        eventLookupJob = null
        if (q.isEmpty()) {
            _uiState.update { SearchUiState.Idle }
            return
        }

        // Accept bare note/nevent references, nostr: URIs, and raw 32-byte hex IDs.
        val clean = q.trim().removePrefix("nostr:").removePrefix("NOSTR:").trim()
        val normalized = clean.lowercase()
        val looksLikeEvent = normalized.startsWith("note1") || normalized.startsWith("nevent1") ||
            normalized.matches(Regex("[0-9a-f]{64}"))
        if (looksLikeEvent) {
            val eventId = when {
                normalized.matches(Regex("[0-9a-f]{64}")) -> normalized
                normalized.startsWith("nevent1") -> Nip19.neventToHex(normalized)
                else -> Nip19.noteToHex(normalized)
            }
            if (eventId == null) {
                _uiState.update {
                    SearchUiState.EventInput(clean, event = null, loading = false, error = "That note/nevent reference is invalid.")
                }
            } else {
                resolveEvent(eventId)
            }
            return
        }

        when {
            (normalized.startsWith("npub1") || normalized.startsWith("nprofile1")) && normalized.length > 20 -> {
                val hex = if (normalized.startsWith("npub1")) {
                    Nip19.npubToHex(normalized)
                } else {
                    Nip19.nprofileToHex(normalized)
                }
                if (hex != null) {
                    _uiState.update { SearchUiState.NpubInput(hex, profileRepository.getProfile(hex)) }
                    // Fetch the profile metadata from relays so a pasted npub of
                    // someone we've never seen still resolves to a real user.
                    fetchProfileForPubkey(hex)
                } else {
                    _uiState.update { SearchUiState.Idle }
                }
            }

            q.startsWith("#") && q.length > 1 -> {
                val tag = q.removePrefix("#").lowercase().trim()
                if (tag.isNotEmpty()) _uiState.update { SearchUiState.HashtagInput(tag) }
            }

            q.length >= 2 -> searchProfiles(q)

            else -> _uiState.update { SearchUiState.Idle }
        }
    }

    private fun resolveEvent(eventId: String) {
        _uiState.update { SearchUiState.EventInput(eventId = eventId, loading = true) }
        eventLookupJob = viewModelScope.launch {
            val local = runCatching { eventRepository.getById(eventId) }.getOrNull()
                ?: runCatching { bookmarksRepository.findEvent(eventId) }.getOrNull()
            if (local != null && local.verify()) {
                _uiState.update { SearchUiState.EventInput(eventId, event = local, loading = false) }
                return@launch
            }

            if (!searchRelayAdded) {
                pool.acquireRelay(Tunables.SEARCH_RELAY)
                searchRelayAdded = true
            }
            val subId = pool.subscribe(listOf(Filter(ids = listOf(eventId), limit = 1)), label = "search-event")
            try {
                val terminal = withTimeoutOrNull(Tunables.SEARCH_EOSE_TIMEOUT_MS) {
                    pool.messages.first { (_, message) ->
                        when (message) {
                            is RelayMessage.EventMessage -> message.subscriptionId == subId &&
                                message.event.id.equals(eventId, ignoreCase = true) && message.event.verify()
                            is RelayMessage.EndOfStoredEvents -> message.subscriptionId == subId
                            else -> false
                        }
                    }
                }
                val message = terminal?.message
                when (message) {
                    is RelayMessage.EventMessage ->
                        _uiState.update { SearchUiState.EventInput(eventId, event = message.event, loading = false) }
                    is RelayMessage.EndOfStoredEvents ->
                        _uiState.update { SearchUiState.EventInput(eventId, loading = false, error = "No matching event was returned by the search relay.") }
                    else ->
                        _uiState.update { SearchUiState.EventInput(eventId, loading = false, error = "Timed out while searching for this event.") }
                }
            } finally {
                pool.unsubscribe(subId)
            }
        }
    }

    fun openInMainFeed(event: Event) = eventOpenCoordinator.openInMainFeed(event)

    /**
     * Subscribes for a single kind-0 metadata event from the given pubkey on the
     * search relay, and refreshes the NpubInput state when it arrives. Times out
     * after [Tunables.SEARCH_EOSE_TIMEOUT_MS] so we never leak a subscription.
     */
    private fun fetchProfileForPubkey(hex: String) {
        if (!searchRelayAdded) {
            pool.acquireRelay(Tunables.SEARCH_RELAY)
            searchRelayAdded = true
        }
        val subId = pool.subscribe(listOf(
            Filter(kinds = listOf(EventKind.METADATA), authors = listOf(hex), limit = 1)
        ))
        viewModelScope.launch {
            try {
                withTimeoutOrNull(Tunables.SEARCH_EOSE_TIMEOUT_MS) {
                    pool.messages.collect { (_, msg) ->
                        when (msg) {
                            is RelayMessage.EventMessage -> {
                                if (msg.subscriptionId == subId && msg.event.verify() &&
                                    msg.event.pubkey == hex
                                ) {
                                    profileRepository.processEvent(msg.event)
                                    val fresh = profileRepository.getProfile(hex)
                                    _uiState.update { state ->
                                        if (state is SearchUiState.NpubInput && state.pubkey == hex) {
                                            state.copy(profile = fresh)
                                        } else state
                                    }
                                }
                            }
                            is RelayMessage.EndOfStoredEvents -> {
                                if (msg.subscriptionId == subId) {
                                    pool.unsubscribe(subId)
                                    currentCoroutineContext().cancel()
                                }
                            }
                            else -> Unit
                        }
                    }
                }
            } finally {
                pool.unsubscribe(subId)
            }
        }
    }

    private suspend fun searchProfiles(query: String) {
        // Seed with local cache matches immediately
        val local = profileRepository.profiles.value
            .filter { (_, p) ->
                p.bestName?.contains(query, ignoreCase = true) == true ||
                p.nip05?.contains(query, ignoreCase = true) == true
            }
            .map { (pubkey, p) -> ProfileMatch(pubkey, p) }
            .sortedBy { it.profile?.bestName }
            .take(20)

        _uiState.update { SearchUiState.Results(local) }

        // Connect to the search relay once per screen visit; released in onCleared.
        if (!searchRelayAdded) {
            pool.acquireRelay(Tunables.SEARCH_RELAY)
            searchRelayAdded = true
        }
        val subId = pool.subscribe(listOf(
            Filter(kinds = listOf(EventKind.METADATA), search = query, limit = 20)
        ))

        try {
            // EOSE timeout: unsubscribe after 10 s even if the relay never sends EOSE.
            withTimeoutOrNull(Tunables.SEARCH_EOSE_TIMEOUT_MS) {
                pool.messages.collect { (_, msg) ->
                    when (msg) {
                        is RelayMessage.EventMessage -> {
                            if (msg.subscriptionId == subId && msg.event.verify()) {
                                profileRepository.processEvent(msg.event)
                                val pubkey = msg.event.pubkey
                                val current = (_uiState.value as? SearchUiState.Results)?.profiles ?: local
                                if (current.none { it.pubkey == pubkey }) {
                                    val updated = (current + ProfileMatch(pubkey, profileRepository.getProfile(pubkey)))
                                        .sortedBy { it.profile?.bestName }
                                    _uiState.update { SearchUiState.Results(updated) }
                                }
                            }
                        }
                        is RelayMessage.EndOfStoredEvents -> {
                            if (msg.subscriptionId == subId) {
                                pool.unsubscribe(subId)
                                currentCoroutineContext().cancel()
                            }
                        }
                        else -> Unit
                    }
                }
            }
        } finally {
            pool.unsubscribe(subId)
        }
    }

    override fun onCleared() {
        eventLookupJob?.cancel()
        if (searchRelayAdded) {
            pool.releaseRelay(Tunables.SEARCH_RELAY)
            searchRelayAdded = false
        }
    }
}
