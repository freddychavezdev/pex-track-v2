package bo.pextrack.mobile.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import bo.pextrack.mobile.data.PexTrackDatabase

class OfflineSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    val pending = PexTrackDatabase.get(applicationContext).offlineOperationDao().nextBatch(50)
    if (pending.isEmpty()) return Result.success()

    // The Supabase authenticated client is injected after login is implemented.
    // Keep each event until the server acknowledges its client event ID; this makes
    // retries safe when the network fails after the request reaches the server.
    return Result.retry()
  }
}
