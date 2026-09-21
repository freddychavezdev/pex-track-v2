package bo.pextrack.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import bo.pextrack.mobile.tracking.LocationTrackingService

class MainActivity : AppCompatActivity() {
  private lateinit var statusText: TextView

  private val locationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { permissions ->
    val preciseGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
    if (preciseGranted) startTracking() else showStatus("Se requiere ubicación precisa para iniciar el seguimiento")
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    statusText = findViewById(R.id.statusText)
    findViewById<Button>(R.id.startTrackingButton).setOnClickListener { requestPermissionsAndStart() }
    findViewById<Button>(R.id.stopTrackingButton).setOnClickListener {
      stopService(Intent(this, LocationTrackingService::class.java))
      showStatus("Seguimiento detenido")
    }
  }

  private fun requestPermissionsAndStart() {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
      startTracking()
      return
    }
    val permissions = buildList {
      add(Manifest.permission.ACCESS_FINE_LOCATION)
      add(Manifest.permission.ACCESS_COARSE_LOCATION)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
    }
    locationPermissionLauncher.launch(permissions.toTypedArray())
  }

  private fun startTracking() {
    ContextCompat.startForegroundService(this, Intent(this, LocationTrackingService::class.java))
    showStatus("Seguimiento activo: la notificación debe permanecer visible")
  }

  private fun showStatus(message: String) {
    statusText.text = message
  }
}
