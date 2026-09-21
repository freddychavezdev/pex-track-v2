package bo.pextrack.mobile.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "offline_operations")
data class OfflineOperation(
  @PrimaryKey val id: String = UUID.randomUUID().toString(),
  val operationType: String,
  val payload: String,
  val createdAt: Long = System.currentTimeMillis(),
  val attempts: Int = 0
)
