package social.tbone.calendar

/** Pure timing policy shared by local calendar alarm scheduling and its tests. */
internal object CalendarAlarmTiming {
    const val DEFAULT_LEAD_MILLIS: Long = 10L * 60L * 1000L
    private const val MIN_DELAY_MILLIS = 1_000L

    /**
     * Return the ten-minute reminder time, but never discard a soon-to-start
     * event merely because its reminder time has already passed. Such an event
     * is scheduled immediately (with a one-second safety margin).
     */
    fun reminderFireAt(
        startMillis: Long,
        nowMillis: Long,
        leadMillis: Long = DEFAULT_LEAD_MILLIS,
    ): Long = maxOf(startMillis - leadMillis, nowMillis + MIN_DELAY_MILLIS)
}
