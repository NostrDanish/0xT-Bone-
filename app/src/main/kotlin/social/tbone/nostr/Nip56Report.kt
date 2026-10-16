package social.tbone.nostr

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.add

/** NIP-56 report categories used by the note action menu. */
enum class Nip56ReportReason(val code: String, val label: String) {
    SPAM("spam", "Spam"),
    PROFANITY("profanity", "Profanity"),
    IMPERSONATION("impersonation", "Impersonation"),
    NUDITY("nudity", "Nudity / sexual content"),
    ILLEGAL("illegal", "Illegal content"),
    MALWARE("malware", "Malware"),
    HARASSMENT("harassment", "Harassment"),
    VIOLENCE("violence", "Violence"),
    OTHER("other", "Other"),
}

/** Builds the same kind-1984 event and typed e/p/a tags as Amethyst's ReportEvent. */
object Nip56Report {
    const val KIND = 1984

    fun forNote(
        reporterPubkey: String,
        target: Event,
        reason: Nip56ReportReason,
        comment: String = "",
        createdAtSeconds: Long = System.currentTimeMillis() / 1000L,
    ): UnsignedEvent {
        val tags = buildList {
            // Private-message ids must never be leaked to public relays. As in
            // Amethyst's Account.report(Note), report only the author there.
            if (!EventKind.isPrivateMessaging(target.kind)) {
                add(tag("e", target.id, reason.code))
            }
            add(tag("p", target.pubkey, reason.code))
            addressOf(target)?.let { add(tag("a", it, reason.code)) }
        }
        return UnsignedEvent(
            pubkey = reporterPubkey,
            createdAt = createdAtSeconds,
            kind = KIND,
            tags = tags,
            content = comment.trim(),
        )
    }

    private fun addressOf(event: Event): String? {
        // Match Amethyst's AddressableEvent handling: an `a` tag is added for
        // parameterized replaceable events (NIP-33), not ordinary replaceable
        // profiles/contact lists. Those are already identified by their `e`/`p`
        // report tags.
        if (event.kind !in 30_000..39_999) return null
        val d = event.parsedTags.firstOrNull { it.name == "d" }?.value().orEmpty()
        return "${event.kind}:${event.pubkey}:$d"
    }

    private fun tag(vararg values: String): JsonArray = buildJsonArray {
        values.forEach { add(JsonPrimitive(it)) }
    }
}
