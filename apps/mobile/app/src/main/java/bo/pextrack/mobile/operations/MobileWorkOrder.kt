package bo.pextrack.mobile.operations

import kotlinx.serialization.Serializable

@Serializable
data class MobileWorkOrder(
  val id: String,
  val code: String,
  val address: String,
  val task_type: String,
  val status: String,
  val priority: Int,
  val is_emergency: Boolean = false,
  val route_sequence: Int? = null,
  val scheduled_for: String,
  val suspension_reason: String? = null,
  val latest_note: String? = null,
  val latest_note_at: String? = null,
  val latitude: Double? = null,
  val longitude: Double? = null
)
