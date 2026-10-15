package social.tbone.media

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MimeTypesTest {

    @Test
    fun `maps common image video and audio types`() {
        assertEquals("jpg", MimeTypes.extensionFor("image/jpeg"))
        assertEquals("mp4", MimeTypes.extensionFor("video/mp4"))
        assertEquals("webm", MimeTypes.extensionFor("video/webm"))
        assertEquals("avi", MimeTypes.extensionFor("video/x-msvideo"))
        assertEquals("mpeg", MimeTypes.extensionFor("video/mpeg"))
        assertEquals("h265", MimeTypes.extensionFor("video/h265"))
        assertEquals("m4a", MimeTypes.extensionFor("audio/mp4"))
        assertEquals("wav", MimeTypes.extensionFor("audio/x-wav"))
        assertEquals("heic", MimeTypes.extensionFor("image/heic"))
    }

    @Test
    fun `infers mime types from common video and audio extensions`() {
        assertEquals("video/x-matroska", MimeTypes.mimeForExtension("mkv"))
        assertEquals("video/x-msvideo", MimeTypes.mimeForExtension("avi"))
        assertEquals("video/mpeg", MimeTypes.mimeForExtension("vob"))
        assertEquals("video/h265", MimeTypes.mimeForExtension("hevc"))
        assertEquals("audio/opus", MimeTypes.mimeForExtension("opus"))
        assertEquals("audio/mp4", MimeTypes.mimeForExtension(".m4a"))
        assertTrue(MimeTypes.isAudio("audio/flac"))
        assertTrue(MimeTypes.isAudio("application/ogg"))
        assertTrue(MimeTypes.isVideo("video/quicktime"))
    }

    @Test
    fun `extracts extension from a display name`() {
        assertEquals("m4a", MimeTypes.extensionFromFileName("voice_1.m4a"))
        assertEquals("avi", MimeTypes.extensionFromFileName("/storage/clip.AVI"))
        assertEquals("", MimeTypes.extensionFromFileName("audio without extension"))
    }

    @Test
    fun `tolerates parameters, casing and whitespace`() {
        assertEquals("jpg", MimeTypes.extensionFor("IMAGE/JPEG"))
        assertEquals("jpg", MimeTypes.extensionFor("image/jpeg; charset=binary"))
        assertEquals("png", MimeTypes.extensionFor("  image/png  "))
    }

    @Test
    fun `unknown types yield an empty extension so the bare hash url is used`() {
        assertEquals("", MimeTypes.extensionFor("application/x-weird"))
        assertEquals("", MimeTypes.extensionFor(""))
    }

    @Test
    fun `detects video types`() {
        assertTrue(MimeTypes.isVideo("video/mp4"))
        assertFalse(MimeTypes.isVideo("image/gif"))
    }
}
