package bo.pextrack.mobile.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface OfflineOperationDao {
  @Insert(onConflict = OnConflictStrategy.IGNORE)
  suspend fun insert(operation: OfflineOperation)

  @Query("SELECT * FROM offline_operations WHERE ownerUserId = :ownerUserId AND teamId = :teamId ORDER BY createdAt LIMIT :limit")
  suspend fun nextBatch(ownerUserId: String, teamId: String, limit: Int): List<OfflineOperation>

  @Query("SELECT COUNT(*) FROM offline_operations WHERE ownerUserId = :ownerUserId AND teamId = :teamId")
  suspend fun pendingCount(ownerUserId: String, teamId: String): Int

  @Query("SELECT COUNT(*) FROM offline_operations WHERE ownerUserId = :ownerUserId AND teamId = :teamId AND operationType = :operationType")
  suspend fun pendingCountByType(ownerUserId: String, teamId: String, operationType: String): Int

  @Query("DELETE FROM offline_operations WHERE id IN (SELECT id FROM offline_operations WHERE ownerUserId = :ownerUserId AND teamId = :teamId AND operationType = :operationType ORDER BY createdAt LIMIT :limit)")
  suspend fun deleteOldestByType(ownerUserId: String, teamId: String, operationType: String, limit: Int)

  @Query("DELETE FROM offline_operations WHERE id IN (:ids)")
  suspend fun deleteByIds(ids: List<String>)
}
