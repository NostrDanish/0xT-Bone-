package social.tbone.reactions

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import social.tbone.nostr.NostrJson
import javax.inject.Inject
import javax.inject.Singleton

/** A user's most recent local vote for one poll. */
@Serializable
data class PersistedPollVote(
    val createdAt: Long,
    val optionIds: List<String>,
)

/** Stores poll votes by account so choices survive leaving the feed and process restarts. */
@Singleton
class PollVoteStore @Inject constructor(
    private val dataStore: DataStore<Preferences>,
) {
    suspend fun getVotes(pubkey: String): Map<String, PersistedPollVote> {
        val raw = dataStore.data.first()[key(pubkey)] ?: return emptyMap()
        return runCatching { NostrJson.decodeFromString<Map<String, PersistedPollVote>>(raw) }
            .getOrDefault(emptyMap())
    }

    suspend fun saveVote(pubkey: String, pollId: String, vote: PersistedPollVote) {
        dataStore.edit { preferences ->
            val prefKey = key(pubkey)
            val current = preferences[prefKey]?.let {
                runCatching { NostrJson.decodeFromString<Map<String, PersistedPollVote>>(it) }
                    .getOrDefault(emptyMap())
            }.orEmpty().toMutableMap()
            val previous = current[pollId]
            if (previous == null || vote.createdAt > previous.createdAt) {
                current[pollId] = vote
                preferences[prefKey] = encode(current)
            }
        }
    }

    /** Restore the previous choice only if no newer local vote replaced [expectedCreatedAt]. */
    suspend fun restoreAfterFailure(
        pubkey: String,
        pollId: String,
        expectedCreatedAt: Long,
        previous: PersistedPollVote?,
    ) {
        dataStore.edit { preferences ->
            val prefKey = key(pubkey)
            val current = preferences[prefKey]?.let {
                runCatching { NostrJson.decodeFromString<Map<String, PersistedPollVote>>(it) }
                    .getOrDefault(emptyMap())
            }.orEmpty().toMutableMap()
            if (current[pollId]?.createdAt != expectedCreatedAt) return@edit
            if (previous == null) current.remove(pollId) else current[pollId] = previous
            if (current.isEmpty()) preferences.remove(prefKey) else preferences[prefKey] = encode(current)
        }
    }

    private fun encode(votes: Map<String, PersistedPollVote>): String = NostrJson.encodeToString(
        votes.entries
            .sortedByDescending { it.value.createdAt }
            .take(MAX_VOTES_PER_ACCOUNT)
            .associate { it.toPair() },
    )

    private fun key(pubkey: String) = stringPreferencesKey("poll_votes_v1_$pubkey")

    private companion object {
        const val MAX_VOTES_PER_ACCOUNT = 2_000
    }
}
