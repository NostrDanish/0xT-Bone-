package social.tbone.ui.feed

import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.add
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import social.tbone.nostr.Event

class ShareCardMediaParserTest {
    @Test
    fun recognizesExtensionUrlsAndNip92MediaWithoutAnExtension() {
        val event = Event(
            id = "event-id",
            pubkey = "author",
            createdAt = 1L,
            kind = 1,
            tags = listOf(
                buildJsonArray {
                    add("imeta")
                    add("url https://blossom.example/blob/abc123")
                    add("m video/mp4")
                },
            ),
            content = "A note with https://blossom.example/photo.webp?width=800 and an unextended video.",
            sig = "",
        )

        val media = ShareCardMediaParser.parse(event)

        assertEquals(2, media.size)
        assertEquals(ShareMediaKind.IMAGE, media[0].kind)
        assertEquals("https://blossom.example/photo.webp?width=800", media[0].url)
        assertEquals(ShareMediaKind.VIDEO, media[1].kind)
        assertEquals("https://blossom.example/blob/abc123", media[1].url)
        assertEquals("video/mp4", media[1].mimeType)
        assertTrue(ShareCardMediaParser.stripMediaUrls(event.content, media).contains("A note with"))
    }
}
