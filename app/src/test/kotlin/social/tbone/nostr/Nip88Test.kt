package social.tbone.nostr

import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import org.junit.Assert.assertEquals
import org.junit.Test

class Nip88Test {
    @Test
    fun parsePollOptionsCapsIncomingPollsAtThirty() {
        val event = Event(
            id = "0".repeat(64),
            pubkey = "1".repeat(64),
            createdAt = 1L,
            kind = Nip88.KIND_POLL,
            tags = (0 until 35).map { index ->
                buildJsonArray {
                    add("option")
                    add("id-$index")
                    add("Option $index")
                }
            },
            content = "Pick one",
            sig = "",
        )

        val options = Nip88.parsePollOptions(event)

        assertEquals(30, options.size)
        assertEquals("id-29", options.last().id)
    }
}
