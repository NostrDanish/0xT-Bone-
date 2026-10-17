package social.tbone.ui.settings

/** Short-lived UI status for a manual relay-published list sync. */
data class PublishedListSyncState(
    val syncing: Boolean = false,
    val message: String? = null,
    val isError: Boolean = false,
)
