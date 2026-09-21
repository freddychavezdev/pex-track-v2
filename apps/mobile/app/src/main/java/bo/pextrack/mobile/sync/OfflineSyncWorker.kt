package bo.pextrack.mobile.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import bo.pextrack.mobile.data.PexTrackDatabase

class OfflineSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    val pending = PexTrackDatabase.get(applicationContext).offlineOperationDao().nextBatch(50)
    if (pending.isEmpty()) return Result.success()

    // The Supabase authenticated client is injected here after login is implemented.
    // Keep the events until the server acknowledges their client event IDs.
    return Result.retry()
  }
}
