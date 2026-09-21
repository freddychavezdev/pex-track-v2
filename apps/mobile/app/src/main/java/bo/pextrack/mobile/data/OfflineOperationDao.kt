package bo.pextrack.mobile.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface OfflineOperationDao {
  @Insert(onConflict = OnConflictStrategy.IGNORE)
  suspend fun insert(operation: OfflineOperation)

  @Query("SELECT * FROM offline_operations ORDER BY createdAt LIMIT :limit")
  suspend fun nextBatch(limit: Int): List<OfflineOperation>

  @Query("SELECT COUNT(*) FROM offline_operations")
  suspend fun pendingCount(): Int

  @Query("DELETE FROM offline_operations WHERE id IN (:ids)")
  suspend fun deleteByIds(ids: List<String>)
}
