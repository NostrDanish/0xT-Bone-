package social.tbone.backup

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EncryptedBackupCryptoTest {
    @Test
    fun `PBKDF2 matches RFC 8018 HMAC-SHA256 vector`() {
        val key = EncryptedBackupCrypto.deriveKey("password", "salt".toByteArray(), 1)
        assertEquals(
            "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b",
            key.joinToString("") { "%02x".format(it.toInt() and 0xff) },
        )
    }

    @Test
    fun `encrypted stream round trips and rejects a wrong passphrase`() {
        val plaintext = "portable T-Bone backup data".toByteArray()
        val file = ByteArrayOutputStream()
        EncryptedBackupCrypto.newEncryptingStream(file, "correct horse battery staple").use { it.write(plaintext) }

        val decoded = EncryptedBackupCrypto.newDecryptingStream(
            ByteArrayInputStream(file.toByteArray()),
            "correct horse battery staple",
        ).use { it.readBytes() }
        assertArrayEquals(plaintext, decoded)

        val rejected = runCatching {
            EncryptedBackupCrypto.newDecryptingStream(
                ByteArrayInputStream(file.toByteArray()),
                "wrong passphrase",
            ).use { it.readBytes() }
        }.isFailure
        assertTrue("wrong passphrase must fail GCM authentication", rejected)
    }
}
