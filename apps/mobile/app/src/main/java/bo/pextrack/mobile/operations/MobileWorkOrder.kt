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
  val scheduled_for: String,
  val suspension_reason: String? = null
)
