package social.tbone.backup

import javax.crypto.CipherInputStream
import javax.crypto.CipherOutputStream
import java.io.EOFException
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.SecureRandom
import java.util.Arrays
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Portable backup envelope, version 1:
 *
 *   8 bytes magic "TBBACKUP" | 1 byte version | 4-byte BE PBKDF2 rounds |
 *   16-byte salt | 12-byte GCM nonce | AES-256-GCM ciphertext + 16-byte tag
 *
 * The complete fixed-size header is GCM additional authenticated data. The key
 * is PBKDF2-HMAC-SHA256 over the UTF-8 passphrase (600,000 rounds by default).
 * The encrypted plaintext is a length-prefixed manifest followed by binary
 * attachment records. There are no device-specific keys in this format.
 */
internal object EncryptedBackupCrypto {
    private val MAGIC = "TBBACKUP".toByteArray(Charsets.US_ASCII)
    private const val VERSION = 1
    private const val SALT_BYTES = 16
    private const val NONCE_BYTES = 12
    private const val KEY_BYTES = 32
    private const val TAG_BITS = 128
    private const val HEADER_BYTES = 8 + 1 + 4 + SALT_BYTES + NONCE_BYTES
    const val DEFAULT_ITERATIONS = 600_000
    private const val MIN_ITERATIONS = 100_000
    private const val MAX_ITERATIONS = 2_000_000

    fun newEncryptingStream(output: OutputStream, passphrase: String): CipherOutputStream {
        require(passphrase.isNotEmpty()) { "A non-empty backup passphrase is required." }
        val salt = ByteArray(SALT_BYTES)
        val nonce = ByteArray(NONCE_BYTES)
        SecureRandom().also { random ->
            random.nextBytes(salt)
            random.nextBytes(nonce)
        }
        val header = ByteBuffer.allocate(HEADER_BYTES).order(ByteOrder.BIG_ENDIAN)
            .put(MAGIC)
            .put(VERSION.toByte())
            .putInt(DEFAULT_ITERATIONS)
            .put(salt)
            .put(nonce)
            .array()
        output.write(header)
        output.flush()
        return CipherOutputStream(output, cipher(Cipher.ENCRYPT_MODE, passphrase, header, salt, nonce, DEFAULT_ITERATIONS))
    }

    fun newDecryptingStream(input: InputStream, passphrase: String): CipherInputStream {
        require(passphrase.isNotEmpty()) { "Enter the backup passphrase." }
        val header = ByteArray(HEADER_BYTES)
        var offset = 0
        while (offset < header.size) {
            val read = input.read(header, offset, header.size - offset)
            if (read < 0) throw EOFException("The backup file is incomplete.")
            offset += read
        }

        val buffer = ByteBuffer.wrap(header).order(ByteOrder.BIG_ENDIAN)
        val magic = ByteArray(MAGIC.size)
        buffer.get(magic)
        require(magic.contentEquals(MAGIC)) { "This is not a T-Bone encrypted backup." }
        val version = buffer.get().toInt() and 0xff
        require(version == VERSION) { "This backup format version is not supported." }
        val iterations = buffer.int
        require(iterations in MIN_ITERATIONS..MAX_ITERATIONS) { "Invalid backup key-derivation parameters." }
        val salt = ByteArray(SALT_BYTES)
        buffer.get(salt)
        val nonce = ByteArray(NONCE_BYTES)
        buffer.get(nonce)
        return CipherInputStream(
            input,
            cipher(Cipher.DECRYPT_MODE, passphrase, header, salt, nonce, iterations),
        )
    }

    /** Exposed internally for the PBKDF2 known-answer unit test. */
    internal fun deriveKey(passphrase: String, salt: ByteArray, iterations: Int): ByteArray =
        pbkdf2HmacSha256(passphrase.toByteArray(Charsets.UTF_8), salt, iterations, KEY_BYTES)

    private fun cipher(
        mode: Int,
        passphrase: String,
        header: ByteArray,
        salt: ByteArray,
        nonce: ByteArray,
        iterations: Int,
    ): Cipher {
        val keyBytes = deriveKey(passphrase, salt, iterations)
        return try {
            Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(mode, SecretKeySpec(keyBytes, "AES"), GCMParameterSpec(TAG_BITS, nonce))
                updateAAD(header)
            }
        } finally {
            Arrays.fill(keyBytes, 0)
        }
    }

    /** PBKDF2 as specified by RFC 8018, using explicit UTF-8 password bytes. */
    private fun pbkdf2HmacSha256(
        password: ByteArray,
        salt: ByteArray,
        iterations: Int,
        outputLength: Int,
    ): ByteArray {
        require(iterations > 0)
        require(outputLength > 0)
        val mac = Mac.getInstance("HmacSHA256")
        val result = ByteArray(outputLength)
        val saltBlock = ByteArray(salt.size + 4)
        salt.copyInto(saltBlock)
        var outputOffset = 0

        try {
            mac.init(SecretKeySpec(password, "HmacSHA256"))
            val hLen = mac.macLength
            val blockCount = (outputLength + hLen - 1) / hLen
            for (blockIndex in 1..blockCount) {
                val indexOffset = salt.size
                saltBlock[indexOffset] = (blockIndex ushr 24).toByte()
                saltBlock[indexOffset + 1] = (blockIndex ushr 16).toByte()
                saltBlock[indexOffset + 2] = (blockIndex ushr 8).toByte()
                saltBlock[indexOffset + 3] = blockIndex.toByte()

                var u = mac.doFinal(saltBlock)
                val t = u.copyOf()
                repeat(iterations - 1) {
                    u = mac.doFinal(u)
                    for (i in t.indices) t[i] = (t[i].toInt() xor u[i].toInt()).toByte()
                }
                val copyCount = minOf(hLen, outputLength - outputOffset)
                t.copyInto(result, outputOffset, 0, copyCount)
                outputOffset += copyCount
                Arrays.fill(u, 0)
                Arrays.fill(t, 0)
            }
            return result
        } finally {
            Arrays.fill(password, 0)
            Arrays.fill(saltBlock, 0)
        }
    }
}
