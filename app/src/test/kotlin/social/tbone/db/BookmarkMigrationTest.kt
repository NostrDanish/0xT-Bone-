package social.tbone.db

import androidx.sqlite.db.SupportSQLiteDatabase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Proxy

class BookmarkMigrationTest {
    @Test
    fun migration14To15CreatesEncryptedBookmarkTablesAndCascadeIndex() {
        val statements = mutableListOf<String>()
        val database = Proxy.newProxyInstance(
            SupportSQLiteDatabase::class.java.classLoader,
            arrayOf(SupportSQLiteDatabase::class.java),
        ) { _, method, args ->
            if (method.name == "execSQL") statements += args!![0] as String
            null
        } as SupportSQLiteDatabase

        AppDatabase.MIGRATION_14_15.migrate(database)

        assertEquals(3, statements.size)
        assertTrue(statements[0].contains("CREATE TABLE IF NOT EXISTS `bookmark_folders`"))
        assertTrue(statements[0].contains("`encryptedName` BLOB NOT NULL"))
        assertTrue(statements[0].contains("`iv` BLOB NOT NULL"))
        assertTrue(statements[1].contains("CREATE TABLE IF NOT EXISTS `bookmarks`"))
        assertTrue(statements[1].contains("`ciphertext` BLOB NOT NULL"))
        assertTrue(statements[1].contains("FOREIGN KEY(`folderId`) REFERENCES `bookmark_folders`(`id`)"))
        assertTrue(statements[1].contains("ON DELETE CASCADE"))
        assertTrue(statements[2].contains("index_bookmarks_folderId_sortOrder"))
        assertTrue(statements[2].contains("(`folderId`, `sortOrder`)"))
    }
}
