package bo.pextrack.mobile.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "offline_operations")
data class OfflineOperation(
  @PrimaryKey val id: String = UUID.randomUUID().toString(),
  val operationType: String,
  val payload: String,
  val ownerUserId: String,
  val teamId: String,
  val createdAt: Long = System.currentTimeMillis(),
  val attempts: Int = 0
) {
  companion object {
    const val MAX_PENDING_OPERATIONS = 500
    const val RESERVED_OPERATION_CAPACITY = 100
  }
}
