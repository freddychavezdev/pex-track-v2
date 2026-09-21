package bo.pextrack.mobile.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [OfflineOperation::class], version = 2, exportSchema = true)
abstract class PexTrackDatabase : RoomDatabase() {
  abstract fun offlineOperationDao(): OfflineOperationDao

  companion object {
    @Volatile private var instance: PexTrackDatabase? = null

    fun get(context: Context): PexTrackDatabase = instance ?: synchronized(this) {
      instance ?: Room.databaseBuilder(context.applicationContext, PexTrackDatabase::class.java, "pex-track.db")
        .addMigrations(MIGRATION_1_2)
        .build().also { instance = it }
    }

    private val MIGRATION_1_2 = object : Migration(1, 2) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE offline_operations ADD COLUMN ownerUserId TEXT NOT NULL DEFAULT ''")
        db.execSQL("ALTER TABLE offline_operations ADD COLUMN teamId TEXT NOT NULL DEFAULT ''")
      }
    }
  }
}
