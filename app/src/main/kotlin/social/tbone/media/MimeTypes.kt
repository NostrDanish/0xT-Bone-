package social.tbone.media

/**
 * MIME ↔ extension mapping used by Blossom uploads and inline media routing.
 * The MIME describes the bytes that are uploaded; the extension is used in
 * fallback Blossom URLs and in note bodies so clients can select a renderer.
 */
object MimeTypes {

    /** File extension for [mime] without the dot, or an empty string when unknown. */
    fun extensionFor(mime: String): String = when (mime.lowercase().substringBefore(';').trim()) {
        "image/jpeg", "image/jpg" -> "jpg"
        "image/png" -> "png"
        "image/gif" -> "gif"
        "image/webp" -> "webp"
        "image/heic", "image/heif" -> "heic"
        "image/avif" -> "avif"
        "image/tiff" -> "tif"
        "video/mp4" -> "mp4"
        "video/webm" -> "webm"
        "video/quicktime" -> "mov"
        "video/x-m4v" -> "m4v"
        "video/3gpp" -> "3gp"
        "video/3gpp2" -> "3g2"
        "video/x-matroska", "application/x-matroska" -> "mkv"
        "video/ogg" -> "ogv"
        "video/mpeg", "video/x-mpeg" -> "mpeg"
        "video/mp2t" -> "ts"
        "video/vnd.rn-realvideo" -> "rmvb"
        "video/x-f4v" -> "f4v"
        "video/dv" -> "dv"
        "video/h264" -> "h264"
        "video/h265" -> "h265"
        "video/x-msvideo", "video/avi", "application/x-msvideo" -> "avi"
        "video/x-flv" -> "flv"
        "video/x-ms-wmv" -> "wmv"
        "video/x-ms-asf", "application/vnd.ms-asf" -> "asf"
        "application/vnd.apple.mpegurl", "application/x-mpegurl" -> "m3u8"
        "video/mxf" -> "mxf"
        "audio/mpeg", "audio/mpga", "audio/x-mpeg", "audio/mpeg3", "audio/x-mpeg-3" -> "mp3"
        "audio/mp4", "audio/x-m4a" -> "m4a"
        "audio/aac", "audio/aacp" -> "aac"
        "audio/ogg", "application/ogg", "application/x-ogg" -> "ogg"
        "audio/opus" -> "opus"
        "audio/wav", "audio/x-wav", "audio/vnd.wave" -> "wav"
        "audio/flac", "audio/x-flac" -> "flac"
        "audio/webm" -> "weba"
        "audio/3gpp" -> "3gp"
        "audio/amr", "audio/amr-wb" -> "amr"
        "audio/x-ms-wma" -> "wma"
        "audio/midi", "audio/x-midi" -> "mid"
        "audio/aiff", "audio/x-aiff" -> "aiff"
        "audio/x-caf" -> "caf"
        "audio/x-matroska" -> "mka"
        else -> ""
    }

    /** A MIME type inferred from a file extension, or null when it is unknown. */
    fun mimeForExtension(extension: String): String? = when (extension.trim().trimStart('.').lowercase()) {
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "gif" -> "image/gif"
        "webp" -> "image/webp"
        "heic", "heif" -> "image/heic"
        "avif" -> "image/avif"
        "tif", "tiff" -> "image/tiff"
        "mp4" -> "video/mp4"
        "webm" -> "video/webm"
        "mov" -> "video/quicktime"
        "m4v" -> "video/x-m4v"
        "3gp" -> "video/3gpp"
        "3g2" -> "video/3gpp2"
        "mkv" -> "video/x-matroska"
        "ogv" -> "video/ogg"
        "ogg" -> "audio/ogg"
        "mpeg", "mpg", "mpe", "m2v", "vob" -> "video/mpeg"
        "ts", "mts", "m2ts", "m2t" -> "video/mp2t"
        "avi", "divx" -> "video/x-msvideo"
        "qt" -> "video/quicktime"
        "rm", "rmvb" -> "video/vnd.rn-realvideo"
        "f4v", "f4p" -> "video/x-f4v"
        "dv" -> "video/dv"
        "264", "h264" -> "video/h264"
        "265", "h265", "hevc" -> "video/h265"
        "flv" -> "video/x-flv"
        "wmv" -> "video/x-ms-wmv"
        "asf" -> "video/x-ms-asf"
        "m3u8" -> "application/vnd.apple.mpegurl"
        "mxf" -> "video/mxf"
        "mp3", "mpga", "mpeg3", "mpg3" -> "audio/mpeg"
        "m4a", "m4b", "m4p" -> "audio/mp4"
        "aac" -> "audio/aac"
        "wav" -> "audio/wav"
        "flac" -> "audio/flac"
        "oga" -> "audio/ogg"
        "opus" -> "audio/opus"
        "weba" -> "audio/webm"
        "amr" -> "audio/amr"
        "wma" -> "audio/x-ms-wma"
        "mid", "midi" -> "audio/midi"
        "aif", "aiff" -> "audio/aiff"
        "caf" -> "audio/x-caf"
        "mka" -> "audio/x-matroska"
        else -> null
    }

    /** Lowercase extension from a display name, or an empty string. */
    fun extensionFromFileName(fileName: String?): String =
        fileName
            ?.substringAfterLast('/')
            ?.substringAfterLast('\\')
            ?.substringAfterLast('.', "")
            ?.lowercase()
            ?.takeIf { it.length in 1..10 }
            .orEmpty()

    /** True when [mime] describes audio bytes. */
    fun isAudio(mime: String): Boolean {
        val type = mime.lowercase().substringBefore(';').trim()
        return type.startsWith("audio/") || type == "application/ogg" || type == "application/x-ogg"
    }

    /** True when [mime] describes video bytes or a video playlist. */
    fun isVideo(mime: String): Boolean {
        val type = mime.lowercase().substringBefore(';').trim()
        return type.startsWith("video/") ||
            type in setOf(
                "application/vnd.apple.mpegurl",
                "application/x-mpegurl",
                "application/vnd.ms-asf",
                "application/x-msvideo",
                "application/x-matroska",
            )
    }
}
