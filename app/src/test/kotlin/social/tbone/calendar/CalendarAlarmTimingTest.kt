package social.tbone.calendar

import org.junit.Assert.assertEquals
import org.junit.Test

class CalendarAlarmTimingTest {
    @Test
    fun `keeps the ten minute reminder time for events well in the future`() {
        val now = 1_000_000L
        val start = now + 60 * 60 * 1000L
        assertEquals(start - CalendarAlarmTiming.DEFAULT_LEAD_MILLIS, CalendarAlarmTiming.reminderFireAt(start, now))
    }

    @Test
    fun `does not drop an event whose reminder lead time has already passed`() {
        val now = 1_000_000L
        val start = now + 5 * 60 * 1000L
        assertEquals(now + 1_000L, CalendarAlarmTiming.reminderFireAt(start, now))
    }


    @Test
    fun `all day event uses its local midnight without an early lead`() {
        val now = 1_000_000L
        val midnight = now + 12 * 60 * 60 * 1000L
        assertEquals(midnight, CalendarAlarmTiming.reminderFireAt(midnight, now, leadMillis = 0L))
    }

    @Test
    fun `event starting now is scheduled with a small delay`() {
        val now = 1_000_000L
        assertEquals(now + 1_000L, CalendarAlarmTiming.reminderFireAt(now, now))
    }
}
