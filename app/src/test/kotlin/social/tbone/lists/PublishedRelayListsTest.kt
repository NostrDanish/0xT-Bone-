package social.tbone.lists

import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.add
import org.junit.Assert.assertEquals
import org.junit.Test
import social.tbone.nostr.Event
import social.tbone.nostr.EventKind

class PublishedRelayListsTest {
    @Test
    fun `blossom list normalizes and deduplicates server tags`() {
        val event = event(
            EventKind.BLOSSOM_SERVER_LIST,
            listOf(
                listOf("server", "https://CDN.example.com/"),
                listOf("server", "cdn.example.com"),
                listOf("server", "not a server"),
                listOf("r", "wss://ignored.example"),
            ),
        )

        assertEquals(
            listOf("https://cdn.example.com"),
            PublishedRelayLists.blossomServers(event),
        )
    }

    @Test
    fun `preferred relay list includes read and unmarked but not write-only relays`() {
        val event = event(
            EventKind.RELAY_LIST,
            listOf(
                listOf("r", "wss://read.example/", "read"),
                listOf("r", "wss://both.example"),
                listOf("r", "wss://write.example", "write"),
                listOf("r", "https://not-a-relay.example", "read"),
                listOf("r", "wss://read.example", "read"),
            ),
        )

        assertEquals(
            listOf("wss://read.example", "wss://both.example"),
            PublishedRelayLists.preferredRelays(event),
        )
    }

    private fun event(kind: Int, tags: List<List<String>>): Event = Event(
        id = "test",
        pubkey = "pubkey",
        createdAt = 1,
        kind = kind,
        tags = tags.map { values -> buildJsonArray { values.forEach { add(it) } } },
        content = "",
        sig = "",
    )
}
