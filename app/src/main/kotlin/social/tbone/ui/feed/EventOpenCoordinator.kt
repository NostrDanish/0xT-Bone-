package social.tbone.ui.feed

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import social.tbone.nostr.Event
import javax.inject.Inject
import javax.inject.Singleton

/** Transient in-process handoff for opening a resolved event in the main feed. */
@Singleton
class EventOpenCoordinator @Inject constructor() {
    private val mutableEvents = MutableSharedFlow<Event>(extraBufferCapacity = 4)
    val events = mutableEvents.asSharedFlow()

    fun openInMainFeed(event: Event) {
        mutableEvents.tryEmit(event)
    }
}
