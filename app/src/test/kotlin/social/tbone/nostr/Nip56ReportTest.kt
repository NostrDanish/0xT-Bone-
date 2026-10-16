package social.tbone.nostr

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.add
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class Nip56ReportTest {
    private fun tag(vararg values: String): JsonArray = buildJsonArray {
        values.forEach { add(JsonPrimitive(it)) }
    }

    private fun values(tag: JsonArray): List<String> =
        tag.map { (it as JsonPrimitive).content }

    private fun event(kind: Int, tags: List<JsonArray> = emptyList()) = Event(
        id = "b".repeat(64),
        pubkey = "a".repeat(64),
        createdAt = 123L,
        kind = kind,
        tags = tags,
        content = "reported content",
        sig = "c".repeat(128),
    )

    @Test
    fun `reports public notes with typed event and author tags`() {
        val target = event(EventKind.TEXT_NOTE)

        val report = Nip56Report.forNote(
            reporterPubkey = "d".repeat(64),
            target = target,
            reason = Nip56ReportReason.SPAM,
            comment = "  unwanted promotion  ",
            createdAtSeconds = 456L,
        )

        assertEquals(Nip56Report.KIND, report.kind)
        assertEquals(456L, report.createdAt)
        assertEquals("unwanted promotion", report.content)
        assertEquals(listOf("e", target.id, "spam"), values(report.tags[0]))
        assertEquals(listOf("p", target.pubkey, "spam"), values(report.tags[1]))
    }

    @Test
    fun `adds NIP-33 address tag to parameterized replaceable events`() {
        val target = event(30_023, listOf(tag("d", "article-slug")))

        val report = Nip56Report.forNote(
            reporterPubkey = "d".repeat(64),
            target = target,
            reason = Nip56ReportReason.IMPERSONATION,
        )

        assertEquals(
            listOf("a", "30023:${target.pubkey}:article-slug", "impersonation"),
            values(report.tags.last()),
        )
    }

    @Test
    fun `does not leak private message event ids`() {
        val target = event(EventKind.ENCRYPTED_DM)

        val report = Nip56Report.forNote(
            reporterPubkey = "d".repeat(64),
            target = target,
            reason = Nip56ReportReason.HARASSMENT,
        )

        assertEquals(1, report.tags.size)
        assertEquals(listOf("p", target.pubkey, "harassment"), values(report.tags.single()))
        assertFalse(report.tags.any { values(it).firstOrNull() == "e" })
    }

    @Test
    fun `uses event and author references for ordinary replaceable profiles but no address tag`() {
        val target = event(EventKind.METADATA)
        val report = Nip56Report.forNote(
            reporterPubkey = "d".repeat(64),
            target = target,
            reason = Nip56ReportReason.OTHER,
        )

        assertEquals(2, report.tags.size)
        assertTrue(report.tags.all { values(it).last() == "other" })
        assertFalse(report.tags.any { values(it).firstOrNull() == "a" })
    }
}
