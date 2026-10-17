package social.tbone.backup

import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupManifestTest {
    private val json = Json {
        encodeDefaults = true
        explicitNulls = true
        ignoreUnknownKeys = false
    }

    @Test
    fun `older backup note defaults folder pin to false`() {
        val oldNote = """{"id":"n1","kind":"note","text":"hello","title":"","createdAt":1,"updatedAt":2,"pinned":false,"sortOrder":0.0,"folderId":null}"""
        val decoded = json.decodeFromString<BackupNote>(oldNote)
        assertFalse(decoded.folderPinned)
    }

    @Test
    fun `folder pin survives manifest serialization`() {
        val note = BackupNote(
            id = "n1",
            kind = "note",
            text = "hello",
            title = "",
            createdAt = 1,
            updatedAt = 2,
            pinned = false,
            sortOrder = 0.0,
            folderId = "f1",
            folderPinned = true,
        )
        val encoded = json.encodeToString(note)
        assertTrue(json.decodeFromString<BackupNote>(encoded).folderPinned)
    }
}
