package bo.pextrack.mobile.operations

import android.content.Context
import bo.pextrack.mobile.auth.SupabaseProvider
import bo.pextrack.mobile.data.OfflineOperation
import bo.pextrack.mobile.data.PexTrackDatabase
import bo.pextrack.mobile.sync.OfflineSyncScheduler
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.json.JSONObject
import java.io.IOException
import java.util.UUID

class MobileOperationsRepository(private val context: Context) {
  suspend fun assignedWorkOrders(): Result<List<MobileWorkOrder>> = runCatching {
    val client = requireAuthenticatedClient()
    Json.decodeFromString<List<MobileWorkOrder>>(client.postgrest.rpc("my_assigned_work_orders").data)
  }

  suspend fun changeStatus(workOrderId: String, newStatus: String, reason: String?): String? {
    val operation = OfflineOperation(
      id = UUID.randomUUID().toString(),
      operationType = "work_order_status",
      payload = JSONObject()
        .put("workOrderId", workOrderId)
        .put("newStatus", newStatus)
        .put("reason", reason ?: "")
        .toString()
    )
    return try {
      submitStatus(operation)
      null
    } catch (_: IOException) {
      PexTrackDatabase.get(context).offlineOperationDao().insert(operation)
      OfflineSyncScheduler.enqueue(context)
      "Cambio guardado sin conexión; se enviará automáticamente al recuperar red."
    } catch (error: Throwable) {
      error.message ?: "No se pudo actualizar el estado de la OT."
    }
  }

  suspend fun submitStatus(operation: OfflineOperation) {
    val client = requireAuthenticatedClient()
    val payload = JSONObject(operation.payload)
    val reason = payload.optString("reason").trim().takeIf { it.isNotEmpty() }
    client.postgrest.rpc(
      "update_my_work_order_status",
      buildJsonObject {
        put("p_work_order_id", payload.getString("workOrderId"))
        put("p_new_status", payload.getString("newStatus"))
        if (reason == null) put("p_reason", JsonNull) else put("p_reason", reason)
        put("p_client_event_id", operation.id)
      }
    )
  }

  private fun requireAuthenticatedClient() = requireNotNull(SupabaseProvider.client) {
    "La aplicación no tiene configurado Supabase."
  }.also { client ->
    check(client.auth.currentSessionOrNull() != null) { "Inicia sesión antes de gestionar OTs." }
  }
}
