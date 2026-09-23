package bo.pextrack.mobile.operations

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import bo.pextrack.mobile.auth.SupabaseProvider
import bo.pextrack.mobile.auth.TeamSessionStore
import bo.pextrack.mobile.data.OfflineOperation
import bo.pextrack.mobile.data.PexTrackDatabase
import bo.pextrack.mobile.sync.OfflineSyncScheduler
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.json.JSONObject
import java.util.UUID

class MobileOperationsRepository(private val context: Context) {
  suspend fun assignedWorkOrders(): Result<List<MobileWorkOrder>> = runCatching {
    val client = requireAuthenticatedClient()
    val orders = Json.decodeFromString<List<MobileWorkOrder>>(client.postgrest.rpc("my_assigned_work_orders").data)
    val locations = runCatching { assignedWorkOrderLocations(client) }.getOrDefault(emptyMap())
    orders.map { order ->
      val location = locations[order.id]
      if (location == null || (order.latitude != null && order.longitude != null)) order
      else order.copy(latitude = location.first, longitude = location.second)
    }
  }

  private suspend fun assignedWorkOrderLocations(client: io.github.jan.supabase.SupabaseClient): Map<String, Pair<Double, Double>> {
    val raw = client.postgrest.from("work_orders")
      .select(columns = Columns.list("id", "location"))
      .data
    val rows = Json.parseToJsonElement(raw).jsonArray
    return rows.mapNotNull { row ->
      val objectRow = row.jsonObject
      val id = objectRow["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
      val coordinates = parseCoordinates(objectRow["location"] ?: return@mapNotNull null) ?: return@mapNotNull null
      id to coordinates
    }.toMap()
  }

  private fun parseCoordinates(element: JsonElement): Pair<Double, Double>? {
    if (element is JsonObject) {
      val coordinates = element["coordinates"]
      if (coordinates is JsonArray && coordinates.size >= 2) {
        val longitude = coordinates[0].jsonPrimitive.doubleOrNull
        val latitude = coordinates[1].jsonPrimitive.doubleOrNull
        if (longitude != null && latitude != null) return latitude to longitude
      }
    }
    if (element is JsonPrimitive) {
      val text = element.contentOrNull.orEmpty()
      val geoJson = runCatching { Json.parseToJsonElement(text) }.getOrNull()
      if (geoJson != null && geoJson !is JsonPrimitive) return parseCoordinates(geoJson)
      val match = Regex("POINT\\s*\\(\\s*(-?\\d+(?:\\.\\d+)?)\\s+(-?\\d+(?:\\.\\d+)?)\\s*\\)", RegexOption.IGNORE_CASE).find(text)
      if (match != null) {
        val latitude = match.groupValues[2].toDoubleOrNull()
        val longitude = match.groupValues[1].toDoubleOrNull()
        if (latitude != null && longitude != null) return latitude to longitude
      }
    }
    return null
  }

  suspend fun changeStatus(workOrderId: String, newStatus: String, reason: String?): String? {
    val operation = try {
      OfflineOperation(
        id = UUID.randomUUID().toString(),
        operationType = "work_order_status",
        ownerUserId = requireUserId(),
        teamId = requireTeamId(),
        payload = JSONObject()
          .put("workOrderId", workOrderId)
          .put("newStatus", newStatus)
          .put("reason", reason ?: "")
          .toString()
      )
    } catch (error: Throwable) {
      return error.message ?: "La sesión móvil ya no está disponible. Inicia sesión nuevamente."
    }
    return try {
      submitStatus(operation)
      null
    } catch (error: Throwable) {
      if (shouldQueueOffline(error)) {
        if (queueOffline(operation)) "Cambio guardado sin conexión; se enviará automáticamente al recuperar red."
        else "No se pudo guardar el cambio: la cola offline alcanzó el límite de ${OfflineOperation.MAX_PENDING_OPERATIONS} registros."
      } else error.message ?: "No se pudo actualizar el estado de la OT."
    }
  }

  suspend fun addNote(workOrderId: String, transcript: String): String {
    val normalizedTranscript = transcript.trim()
    if (normalizedTranscript.isBlank()) return "Escribe o dicta una observación antes de guardarla."

    val operation = try {
      OfflineOperation(
        id = UUID.randomUUID().toString(),
        operationType = "work_order_note",
        ownerUserId = requireUserId(),
        teamId = requireTeamId(),
        payload = JSONObject()
          .put("workOrderId", workOrderId)
          .put("transcript", normalizedTranscript)
          .toString()
      )
    } catch (error: Throwable) {
      return error.message ?: "La sesión móvil ya no está disponible. Inicia sesión nuevamente."
    }
    return try {
      submitNote(operation)
      "Observación guardada"
    } catch (error: Throwable) {
      if (shouldQueueOffline(error)) {
        if (queueOffline(operation)) "Observación guardada sin conexión; se enviará automáticamente al recuperar red."
        else "No se pudo guardar la observación: la cola offline alcanzó el límite de ${OfflineOperation.MAX_PENDING_OPERATIONS} registros."
      } else error.message ?: "No se pudo guardar la observación."
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

  suspend fun submitNote(operation: OfflineOperation) {
    val client = requireAuthenticatedClient()
    val payload = JSONObject(operation.payload)
    client.postgrest.rpc(
      "add_my_work_order_note",
      buildJsonObject {
        put("p_work_order_id", payload.getString("workOrderId"))
        put("p_transcript", payload.getString("transcript"))
        put("p_client_event_id", operation.id)
      }
    )
  }

  private fun requireAuthenticatedClient() = requireNotNull(SupabaseProvider.client) {
    "La aplicación no tiene configurado Supabase."
  }.also { client ->
    check(client.auth.currentSessionOrNull() != null) { "Inicia sesión antes de gestionar OTs." }
  }

  private fun requireUserId(): String = requireNotNull(SupabaseProvider.client?.auth?.currentUserOrNull()?.id) {
    "Inicia sesión antes de guardar operaciones sin conexión."
  }

  private fun requireTeamId(): String = requireNotNull(TeamSessionStore(context).currentTeamId()) {
    "No se encontró la cuadrilla activa."
  }

  private suspend fun queueOffline(operation: OfflineOperation): Boolean {
    val dao = PexTrackDatabase.get(context).offlineOperationDao()
    if (dao.pendingCount(operation.ownerUserId, operation.teamId) >= OfflineOperation.MAX_PENDING_OPERATIONS) return false
    dao.insert(operation)
    OfflineSyncScheduler.enqueue(context)
    return true
  }

  private fun shouldQueueOffline(error: Throwable): Boolean {
    if (!isNetworkAvailable()) return true
    return error is java.io.IOException || error.cause is java.io.IOException
  }

  private fun isNetworkAvailable(): Boolean {
    val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = manager.activeNetwork ?: return false
    val capabilities = manager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }
}
