package bo.pextrack.mobile.tracking

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.IBinder
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import bo.pextrack.mobile.R
import bo.pextrack.mobile.data.OfflineOperation
import bo.pextrack.mobile.data.PexTrackDatabase
import bo.pextrack.mobile.sync.OfflineSyncScheduler
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

class LocationTrackingService : Service() {
  private lateinit var fusedLocationClient: FusedLocationProviderClient
  private val ioScope = CoroutineScope(Dispatchers.IO)
  private val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 15_000)
    .setMinUpdateIntervalMillis(5_000)
    .setMinUpdateDistanceMeters(10f)
    .build()

  private val locationCallback = object : LocationCallback() {
    override fun onLocationResult(result: LocationResult) {
      result.lastLocation?.let(::queueLocation)
    }
  }

  override fun onCreate() {
    super.onCreate()
    fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
    createNotificationChannel()
    startForeground(NOTIFICATION_ID, buildNotification())
    requestLocationUpdates()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

  override fun onDestroy() {
    fusedLocationClient.removeLocationUpdates(locationCallback)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun requestLocationUpdates() {
    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
      stopSelf()
      return
    }
    fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, mainLooper)
  }

  private fun queueLocation(location: android.location.Location) {
    val payload = JSONObject()
      .put("latitude", location.latitude)
      .put("longitude", location.longitude)
      .put("accuracyMeters", location.accuracy)
      .put("headingDegrees", location.bearing)
      .put("speedMps", location.speed)
      .put("recordedAt", location.time)
      .toString()
    ioScope.launch {
      val dao = PexTrackDatabase.get(this@LocationTrackingService).offlineOperationDao()
      if (dao.pendingCount() < OfflineOperation.MAX_PENDING_OPERATIONS) {
        dao.insert(OfflineOperation(operationType = "team_location", payload = payload))
        OfflineSyncScheduler.enqueue(this@LocationTrackingService)
      }
    }
  }

  private fun createNotificationChannel() {
    val channel = NotificationChannel(CHANNEL_ID, getString(R.string.tracking_channel_name), NotificationManager.IMPORTANCE_LOW)
    NotificationManagerCompat.from(this).createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification = NotificationCompat.Builder(this, CHANNEL_ID)
    .setSmallIcon(android.R.drawable.ic_menu_mylocation)
    .setContentTitle(getString(R.string.tracking_notification_title))
    .setContentText(getString(R.string.tracking_notification_text))
    .setOngoing(true)
    .build()

  private companion object {
    const val CHANNEL_ID = "pex-track-location"
    const val NOTIFICATION_ID = 1001
  }
}
