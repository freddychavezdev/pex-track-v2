package bo.pextrack.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import bo.pextrack.mobile.auth.MobileAuthRepository
import bo.pextrack.mobile.tracking.LocationTrackingService
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
  private lateinit var statusText: TextView
  private lateinit var loginButton: Button
  private lateinit var emailInput: EditText
  private lateinit var passwordInput: EditText
  private val authRepository by lazy { MobileAuthRepository(this) }

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
    loginButton = findViewById(R.id.loginButton)
    emailInput = findViewById(R.id.emailInput)
    passwordInput = findViewById(R.id.passwordInput)
    loginButton.setOnClickListener { signIn() }
    findViewById<Button>(R.id.signOutButton).setOnClickListener { signOut() }
    findViewById<Button>(R.id.startTrackingButton).setOnClickListener { requestPermissionsAndStart() }
    findViewById<Button>(R.id.stopTrackingButton).setOnClickListener {
      stopService(Intent(this, LocationTrackingService::class.java))
      showStatus("Seguimiento detenido")
    }
    refreshSessionStatus()
  }

  private fun signIn() {
    val email = emailInput.text.toString()
    val password = passwordInput.text.toString()
    if (email.isBlank() || password.isBlank()) {
      showStatus("Ingresa tu correo y contraseña institucionales")
      return
    }
    loginButton.isEnabled = false
    showStatus("Verificando usuario y cuadrilla…")
    lifecycleScope.launch {
      val error = authRepository.signIn(email, password)
      loginButton.isEnabled = true
      if (error != null) showStatus(error) else {
        passwordInput.setText("")
        showStatus("Sesión iniciada. Ya puedes activar el seguimiento de la cuadrilla.")
      }
    }
  }

  private fun signOut() {
    lifecycleScope.launch {
      stopService(Intent(this@MainActivity, LocationTrackingService::class.java))
      authRepository.signOut()
      showStatus("Sesión cerrada y seguimiento detenido")
    }
  }

  private fun refreshSessionStatus() {
    when {
      !authRepository.isConfigured() -> showStatus("Configura Supabase en local.properties para iniciar sesión")
      authRepository.hasSession() -> showStatus("Sesión recuperada. Inicia el seguimiento al comenzar la jornada.")
      else -> showStatus("Inicia sesión antes de activar el seguimiento")
    }
  }

  private fun requestPermissionsAndStart() {
    if (!authRepository.hasSession()) {
      showStatus("Inicia sesión antes de activar el seguimiento")
      return
    }
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
