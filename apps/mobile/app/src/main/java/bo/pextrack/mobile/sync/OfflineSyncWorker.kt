package bo.pextrack.mobile.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import bo.pextrack.mobile.auth.SupabaseProvider
import bo.pextrack.mobile.auth.TeamSessionStore
import bo.pextrack.mobile.data.PexTrackDatabase
import bo.pextrack.mobile.operations.MobileOperationsRepository
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.json.JSONObject
import java.time.Instant

class OfflineSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    val database = PexTrackDatabase.get(applicationContext)
    val pending = database.offlineOperationDao().nextBatch(50)
    if (pending.isEmpty()) return Result.success()

    val client = SupabaseProvider.client ?: return Result.failure()
    if (client.auth.currentSessionOrNull() == null) return Result.failure()
    val teamId = TeamSessionStore(applicationContext).currentTeamId()

    return runCatching {
      pending.forEach { operation ->
        when (operation.operationType) {
          "team_location" -> {
            if (teamId == null) return Result.failure()
            val payload = JSONObject(operation.payload)
            client.postgrest.rpc(
              "submit_team_location",
              buildJsonObject {
                put("p_team_id", teamId)
                put("p_latitude", payload.getDouble("latitude"))
                put("p_longitude", payload.getDouble("longitude"))
                put("p_accuracy_meters", payload.getDouble("accuracyMeters"))
                put("p_heading_degrees", payload.getDouble("headingDegrees"))
                put("p_speed_mps", payload.getDouble("speedMps"))
                put("p_recorded_at", Instant.ofEpochMilli(payload.getLong("recordedAt")).toString())
                put("p_client_event_id", operation.id)
              }
            )
          }
          "work_order_status" -> MobileOperationsRepository(applicationContext).submitStatus(operation)
          else -> return Result.failure()
        }
        database.offlineOperationDao().deleteByIds(listOf(operation.id))
      }
      Result.success()
    }.getOrElse { Result.retry() }
  }
}
