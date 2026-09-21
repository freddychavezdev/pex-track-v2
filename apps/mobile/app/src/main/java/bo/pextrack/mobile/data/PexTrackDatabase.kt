package bo.pextrack.mobile.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [OfflineOperation::class], version = 1, exportSchema = true)
abstract class PexTrackDatabase : RoomDatabase() {
  abstract fun offlineOperationDao(): OfflineOperationDao

  companion object {
    @Volatile private var instance: PexTrackDatabase? = null

    fun get(context: Context): PexTrackDatabase = instance ?: synchronized(this) {
      instance ?: Room.databaseBuilder(context.applicationContext, PexTrackDatabase::class.java, "pex-track.db").build().also { instance = it }
    }
  }
}
