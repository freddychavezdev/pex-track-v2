package bo.pextrack.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import bo.pextrack.mobile.auth.MobileAuthRepository
import bo.pextrack.mobile.operations.MobileOperationsRepository
import bo.pextrack.mobile.operations.MobileWorkOrder
import bo.pextrack.mobile.tracking.LocationTrackingService
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
  private lateinit var statusText: TextView
  private lateinit var loginButton: Button
  private lateinit var emailInput: EditText
  private lateinit var passwordInput: EditText
  private lateinit var suspensionReasonInput: EditText
  private lateinit var workOrdersContainer: LinearLayout
  private val authRepository by lazy { MobileAuthRepository(this) }
  private val operationsRepository by lazy { MobileOperationsRepository(this) }

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
    suspensionReasonInput = findViewById(R.id.suspensionReasonInput)
    workOrdersContainer = findViewById(R.id.workOrdersContainer)
    loginButton.setOnClickListener { signIn() }
    findViewById<Button>(R.id.signOutButton).setOnClickListener { signOut() }
    findViewById<Button>(R.id.refreshWorkOrdersButton).setOnClickListener { loadWorkOrders() }
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
        loadWorkOrders()
      }
    }
  }

  private fun signOut() {
    lifecycleScope.launch {
      stopService(Intent(this@MainActivity, LocationTrackingService::class.java))
      authRepository.signOut()
      workOrdersContainer.removeAllViews()
      showStatus("Sesión cerrada y seguimiento detenido")
    }
  }

  private fun refreshSessionStatus() {
    when {
      !authRepository.isConfigured() -> showStatus("Configura Supabase en local.properties para iniciar sesión")
      authRepository.hasSession() -> showStatus("Sesión recuperada. Inicia el seguimiento al comenzar la jornada.")
      else -> showStatus("Inicia sesión antes de activar el seguimiento")
    }
    if (authRepository.hasSession()) loadWorkOrders()
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

  private fun loadWorkOrders() {
    if (!authRepository.hasSession()) {
      showStatus("Inicia sesión para consultar tus OTs asignadas")
      return
    }
    showStatus("Cargando OTs asignadas…")
    lifecycleScope.launch {
      operationsRepository.assignedWorkOrders()
        .onSuccess { orders ->
          renderWorkOrders(orders)
          showStatus(if (orders.isEmpty()) "No tienes OTs activas asignadas" else "${orders.size} OT(s) activa(s) asignada(s)")
        }
        .onFailure { error -> showStatus(error.message ?: "No se pudieron cargar las OTs") }
    }
  }

  private fun renderWorkOrders(orders: List<MobileWorkOrder>) {
    workOrdersContainer.removeAllViews()
    orders.forEach { order ->
      val row = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(0, 16, 0, 16)
      }
      row.addView(TextView(this).apply {
        text = "${order.code} · Prioridad ${order.priority}"
        textSize = 16f
        setTextColor(Color.parseColor("#182230"))
      })
      row.addView(TextView(this).apply {
        text = "${taskLabel(order.task_type)} · ${order.address}\nEstado: ${statusLabel(order.status)}"
        textSize = 14f
        setTextColor(Color.parseColor("#5F7086"))
      })
      val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
      allowedTransitions(order.status).forEach { nextStatus ->
        actions.addView(Button(this).apply {
          text = statusActionLabel(nextStatus)
          setOnClickListener { changeWorkOrderStatus(order, nextStatus) }
        })
      }
      row.addView(actions)
      workOrdersContainer.addView(row)
    }
  }

  private fun changeWorkOrderStatus(order: MobileWorkOrder, nextStatus: String) {
    val reason = suspensionReasonInput.text.toString().trim()
    if (nextStatus == "suspended" && reason.isBlank()) {
      showStatus("Escribe el motivo antes de suspender una OT")
      return
    }
    lifecycleScope.launch {
      showStatus("Actualizando ${order.code}…")
      val result = operationsRepository.changeStatus(order.id, nextStatus, reason.ifBlank { null })
      showStatus(result ?: "${order.code}: ${statusLabel(nextStatus)}")
      if (nextStatus == "suspended") suspensionReasonInput.setText("")
      loadWorkOrders()
    }
  }

  private fun allowedTransitions(status: String): List<String> = when (status) {
    "pending" -> listOf("en_route", "suspended")
    "en_route" -> listOf("in_progress", "suspended")
    "in_progress" -> listOf("completed", "suspended")
    else -> emptyList()
  }

  private fun statusActionLabel(status: String): String = when (status) {
    "en_route" -> "En camino"
    "in_progress" -> "Iniciar"
    "completed" -> "Completar"
    "suspended" -> "Suspender"
    else -> status
  }

  private fun statusLabel(status: String): String = when (status) {
    "pending" -> "Pendiente"
    "en_route" -> "En camino"
    "in_progress" -> "En progreso"
    "completed" -> "Completada"
    "suspended" -> "Suspendida"
    else -> status
  }

  private fun taskLabel(taskType: String): String = when (taskType) {
    "technical_assistance" -> "Asistencia"
    "new_installation" -> "Instalación"
    "service_transfer" -> "Traslado"
    "network_maintenance" -> "Mantenimiento"
    else -> taskType
  }
}
