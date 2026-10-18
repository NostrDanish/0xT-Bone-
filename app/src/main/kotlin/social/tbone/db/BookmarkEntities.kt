package social.tbone.db

import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

/** Folder metadata; the display name is AES-GCM encrypted before it reaches Room. */
@Entity(tableName = "bookmark_folders")
data class BookmarkFolderEntity(
    @PrimaryKey val id: String,
    val encryptedName: ByteArray,
    val iv: ByteArray,
    @ColumnInfo(defaultValue = "0") val sortOrder: Double = 0.0,
    val createdAt: Long,
    val updatedAt: Long,
)

/** A saved, serialized Nostr event encrypted with the local Notes Keystore key. */
@Entity(
    tableName = "bookmarks",
    foreignKeys = [
        ForeignKey(
            entity = BookmarkFolderEntity::class,
            parentColumns = ["id"],
            childColumns = ["folderId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index(value = ["folderId", "sortOrder"])],
)
data class BookmarkEntity(
    @PrimaryKey val id: String,
    val folderId: String,
    val ciphertext: ByteArray,
    val iv: ByteArray,
    @ColumnInfo(defaultValue = "0") val sortOrder: Double = 0.0,
    val createdAt: Long,
)

@Dao
interface BookmarkDao {
    @Query("SELECT * FROM bookmark_folders ORDER BY sortOrder ASC, createdAt ASC")
    fun observeFolders(): Flow<List<BookmarkFolderEntity>>

    @Query("SELECT * FROM bookmark_folders ORDER BY sortOrder ASC, createdAt ASC")
    suspend fun getFolders(): List<BookmarkFolderEntity>

    @Query("SELECT * FROM bookmark_folders WHERE id = :id")
    suspend fun getFolder(id: String): BookmarkFolderEntity?

    @Query("SELECT COUNT(*) FROM bookmark_folders")
    suspend fun folderCount(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertFolder(folder: BookmarkFolderEntity)

    @Query("DELETE FROM bookmark_folders WHERE id = :id")
    suspend fun deleteFolder(id: String)

    @Query("SELECT * FROM bookmarks WHERE folderId = :folderId ORDER BY sortOrder ASC, createdAt ASC")
    fun observeBookmarks(folderId: String): Flow<List<BookmarkEntity>>

    @Query("SELECT * FROM bookmarks WHERE folderId = :folderId ORDER BY sortOrder ASC, createdAt ASC")
    suspend fun getBookmarks(folderId: String): List<BookmarkEntity>

    @Query("SELECT * FROM bookmarks ORDER BY folderId ASC, sortOrder ASC, createdAt ASC")
    suspend fun getAllBookmarks(): List<BookmarkEntity>

    @Query("SELECT COALESCE(MAX(sortOrder), -1) FROM bookmarks WHERE folderId = :folderId")
    suspend fun maxBookmarkOrder(folderId: String): Double

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertBookmark(bookmark: BookmarkEntity)

    @Query("DELETE FROM bookmarks WHERE id = :id")
    suspend fun deleteBookmark(id: String)

    @Query("UPDATE bookmarks SET sortOrder = :sortOrder WHERE id = :id AND folderId = :folderId")
    suspend fun setBookmarkOrder(id: String, folderId: String, sortOrder: Double)

    @Transaction
    suspend fun reorderBookmarks(folderId: String, orderedIds: List<String>) {
        orderedIds.forEachIndexed { index, id ->
            setBookmarkOrder(id, folderId, index.toDouble())
        }
    }
}
