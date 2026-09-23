package bo.pextrack.mobile

import android.Manifest
import android.content.Intent
import android.content.Context
import android.content.res.ColorStateList
import android.app.Dialog
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.ColorDrawable
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.view.View
import android.view.Gravity
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.gms.location.LocationServices
import bo.pextrack.mobile.auth.MobileAuthRepository
import bo.pextrack.mobile.auth.SupabaseProvider
import bo.pextrack.mobile.auth.TeamSessionStore
import bo.pextrack.mobile.operations.MobileOperationsRepository
import bo.pextrack.mobile.operations.MobileWorkOrder
import bo.pextrack.mobile.tracking.LocationTrackingService
import bo.pextrack.mobile.data.PexTrackDatabase
import bo.pextrack.mobile.sync.OfflineSyncScheduler
import kotlinx.coroutines.launch
import io.github.jan.supabase.auth.auth
import java.util.Locale

class MainActivity : AppCompatActivity() {
  private lateinit var statusText: TextView
  private lateinit var pendingOperationsText: TextView
  private lateinit var loginButton: Button
  private lateinit var loginCard: LinearLayout
  private lateinit var landingIntro: LinearLayout
  private lateinit var teamMembershipText: TextView
  private lateinit var authenticatedOperations: LinearLayout
  private lateinit var signOutButton: Button
  private lateinit var trackingToggleButton: MaterialButton
  private lateinit var trackingActionHint: TextView
  private lateinit var refreshWorkOrdersButton: Button
  private lateinit var emailInput: EditText
  private lateinit var passwordInput: EditText
  private lateinit var workOrdersContainer: LinearLayout
  private lateinit var ordersTitle: TextView
  private lateinit var fusedLocationClient: com.google.android.gms.location.FusedLocationProviderClient
  private var speechRecognizer: SpeechRecognizer? = null
  private var activeTranscriptInput: EditText? = null
  private var activeDictationStatus: TextView? = null
  private var activeDictationPreview: TextView? = null
  private var activeStartDictationButton: MaterialButton? = null
  private var activeStopDictationButton: MaterialButton? = null
  private var dictationPrefix = ""
  private var isDictating = false
  private var awaitingLocationSettings = false
  private var awaitingBackgroundLocationSettings = false
  private var trackingActive = false
  private var currentWorkOrders: List<MobileWorkOrder> = emptyList()
  private lateinit var connectivityManager: ConnectivityManager
  private val networkCallback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) {
      OfflineSyncScheduler.enqueue(this@MainActivity)
      runOnUiThread {
        showStatus(
          if (authRepository.hasSession()) {
            "Conexión recuperada; sincronizando registros pendientes…"
          } else {
            "Con conexión. Inicia sesión para consultar tus órdenes asignadas."
          }
        )
      }
      refreshPendingOperations()
    }

    override fun onLost(network: Network) {
      runOnUiThread {
        showStatus(
          if (authRepository.hasSession()) {
            "Sin conexión: los cambios se guardarán localmente"
          } else {
            "Sin conexión. Conéctate para iniciar sesión."
          }
        )
      }
    }
  }
  private val authRepository by lazy { MobileAuthRepository(this) }
  private val operationsRepository by lazy { MobileOperationsRepository(this) }

  private val locationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { permissions ->
    val preciseGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (preciseGranted) requestNotificationPermissionThenStart() else showStatus("Se requiere ubicación precisa para iniciar el seguimiento")
  }

  private val notificationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
  ) {
    requestBackgroundLocationIfNeeded()
  }

  private val microphonePermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
  ) { granted ->
    if (granted) startDictation() else showStatus("Se necesita permiso de micrófono para transcribir la observación")
  }

  private val backgroundLocationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
  ) { granted ->
    if (granted) {
      startTracking()
    } else {
      // A foreground service can still start with foreground location access,
      // but Android may limit delivery after the app leaves the foreground.
      startTracking()
      showStatus("Seguimiento iniciado. Para máxima continuidad, habilita ‘Permitir siempre’ en permisos de ubicación.")
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    statusText = findViewById(R.id.statusText)
    pendingOperationsText = findViewById(R.id.pendingOperationsText)
    loginButton = findViewById(R.id.loginButton)
    loginCard = findViewById(R.id.loginCard)
    landingIntro = findViewById(R.id.landingIntro)
    teamMembershipText = findViewById(R.id.teamMembershipText)
    authenticatedOperations = findViewById(R.id.authenticatedOperations)
    signOutButton = findViewById(R.id.signOutButton)
    trackingToggleButton = findViewById(R.id.trackingToggleButton)
    trackingActionHint = findViewById(R.id.trackingActionHint)
    refreshWorkOrdersButton = findViewById(R.id.refreshWorkOrdersButton)
    emailInput = findViewById(R.id.emailInput)
    passwordInput = findViewById(R.id.passwordInput)
    workOrdersContainer = findViewById(R.id.workOrdersContainer)
    ordersTitle = findViewById(R.id.ordersTitle)
    fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
    connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    connectivityManager.registerDefaultNetworkCallback(networkCallback)
    loginButton.setOnClickListener { signIn() }
    signOutButton.setOnClickListener { signOut() }
    refreshWorkOrdersButton.setOnClickListener { loadWorkOrders() }
    trackingActive = getSharedPreferences("pex_track_ui", MODE_PRIVATE).getBoolean("tracking_active", false)
    updateTrackingButton()
    trackingToggleButton.setOnClickListener {
      if (trackingActive) stopTracking() else requestPermissionsAndStart()
    }
    speechRecognizer = if (SpeechRecognizer.isRecognitionAvailable(this)) {
      SpeechRecognizer.createSpeechRecognizer(this).also { recognizer ->
        recognizer.setRecognitionListener(createRecognitionListener())
      }
    } else null
    refreshSessionStatus()
    refreshPendingOperations()
  }

  override fun onResume() {
    super.onResume()
    if (awaitingLocationSettings) {
      awaitingLocationSettings = false
      if (isLocationEnabled()) {
        showStatus("Ubicación activada. Verificando permisos…")
        requestPermissionsAndStart()
      } else {
        showStatus("La ubicación sigue desactivada. Activa el GPS para iniciar el seguimiento.")
      }
    }
    if (awaitingBackgroundLocationSettings) {
      awaitingBackgroundLocationSettings = false
      val backgroundGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
      showStatus(
        if (backgroundGranted) "Seguimiento activo con ubicación en segundo plano autorizada"
        else "Seguimiento activo con acceso limitado: habilita ‘Permitir siempre’ para seguir con la pantalla bloqueada"
      )
    }
  }

  private fun signIn() {
    val email = emailInput.text.toString()
    val password = passwordInput.text.toString()
    if (email.isBlank() || password.isBlank()) {
      showStatus("Ingresa tu correo y contraseña institucionales")
      return
    }
    if (!hasValidatedInternet()) {
      showStatus("No hay conexión a Internet. Conéctate a una red e inténtalo nuevamente.")
      return
    }
    loginButton.isEnabled = false
    showStatus("Verificando usuario y cuadrilla…")
    lifecycleScope.launch {
      val error = authRepository.signIn(email, password)
      loginButton.isEnabled = true
      if (error != null) showStatus(error) else {
        passwordInput.setText("")
        updateSessionUi()
        showStatus("Sesión iniciada. Ya puedes activar el seguimiento de la cuadrilla.")
        loadWorkOrders()
      }
    }
  }

  private fun hasValidatedInternet(): Boolean {
    val network = connectivityManager.activeNetwork ?: return false
    val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
      capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
  }

  private fun signOut() {
    lifecycleScope.launch {
      stopTracking(showMessage = false)
      authRepository.signOut()
      workOrdersContainer.removeAllViews()
      updateSessionUi()
      showStatus("Sesión cerrada y seguimiento detenido")
    }
  }

  private fun refreshSessionStatus() {
    when {
      !authRepository.isConfigured() -> showStatus("Configura Supabase en local.properties para iniciar sesión")
      authRepository.hasSession() -> showStatus("Sesión recuperada. Inicia el seguimiento al comenzar la jornada.")
      else -> showStatus("Inicia sesión antes de activar el seguimiento")
    }
    updateSessionUi()
    if (authRepository.hasSession()) {
      lifecycleScope.launch {
        authRepository.refreshTeamCode()
        updateSessionUi()
        loadWorkOrders()
      }
    }
  }

  private fun updateSessionUi() {
    val authenticated = authRepository.hasSession()
    loginCard.visibility = if (authenticated) View.GONE else View.VISIBLE
    landingIntro.visibility = if (authenticated) View.GONE else View.VISIBLE
    authenticatedOperations.visibility = if (authenticated) View.VISIBLE else View.GONE
    pendingOperationsText.visibility = if (authenticated) View.VISIBLE else View.GONE
    val teamCode = authRepository.currentTeamCode()
    teamMembershipText.text = teamCode?.let { "Cuadrilla: $it" } ?: ""
    teamMembershipText.visibility = if (authenticated && !teamCode.isNullOrBlank()) View.VISIBLE else View.GONE
    if (!authenticated && trackingActive) setTrackingActive(false)
  }

  private fun requestPermissionsAndStart() {
    if (!authRepository.hasSession()) {
      showStatus("Inicia sesión antes de activar el seguimiento")
      return
    }
    if (!isLocationEnabled()) {
      awaitingLocationSettings = true
      showStatus("La ubicación está desactivada. Activa el GPS para iniciar el seguimiento.")
      startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
      return
    }
    val locationPermissions = buildList {
      if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
      }
    }
    if (locationPermissions.isEmpty()) requestNotificationPermissionThenStart()
    else locationPermissionLauncher.launch(locationPermissions.toTypedArray())
  }

  private fun isLocationEnabled(): Boolean {
    val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      locationManager.isLocationEnabled
    } else {
      runCatching {
        locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
          locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
      }.getOrDefault(false)
    }
  }

  private fun requestNotificationPermissionThenStart() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    } else {
      requestBackgroundLocationIfNeeded()
    }
  }

  private fun requestBackgroundLocationIfNeeded() {
    val backgroundGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q && !backgroundGranted) {
      showStatus("Autoriza ‘Permitir siempre’ para mantener la ubicación con la pantalla bloqueada")
      backgroundLocationPermissionLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !backgroundGranted) {
      startTracking()
      awaitingBackgroundLocationSettings = true
      showStatus("Abre Ajustes y habilita ‘Permitir siempre’ para continuar con la pantalla bloqueada")
      startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", packageName, null)
      })
    } else {
      startTracking()
    }
  }

  private fun startTracking() {
    ContextCompat.startForegroundService(this, Intent(this, LocationTrackingService::class.java))
    setTrackingActive(true)
    showStatus("Seguimiento activo: la notificación debe permanecer visible")
  }

  private fun stopTracking(showMessage: Boolean = true) {
    stopService(Intent(this, LocationTrackingService::class.java))
    setTrackingActive(false)
    if (showMessage) showStatus("Seguimiento detenido. Ya no se enviará tu ubicación.")
  }

  private fun setTrackingActive(active: Boolean) {
    trackingActive = active
    getSharedPreferences("pex_track_ui", MODE_PRIVATE).edit().putBoolean("tracking_active", active).apply()
    updateTrackingButton()
  }

  private fun updateTrackingButton() {
    if (!::trackingToggleButton.isInitialized) return
    val color = if (trackingActive) R.color.pex_tracking_stop else R.color.pex_tracking_start
    trackingToggleButton.text = if (trackingActive) "Detener seguimiento" else "Iniciar seguimiento"
    trackingToggleButton.contentDescription = if (trackingActive) "Detener seguimiento de ubicación" else "Iniciar seguimiento de ubicación"
    trackingToggleButton.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this, color))
    trackingActionHint.text = if (trackingActive) {
      "Seguimiento activo. Pulsa para detener el envío de ubicación."
    } else {
      "Inicia al comenzar la jornada para compartir la ubicación."
    }
    trackingActionHint.setTextColor(ContextCompat.getColor(this, if (trackingActive) R.color.pex_tracking_stop else R.color.pex_muted))
  }

  private fun showStatus(message: String) {
    statusText.text = message
  }

  private fun refreshPendingOperations() {
    lifecycleScope.launch {
      val userId = SupabaseProvider.client?.auth?.currentUserOrNull()?.id
      val teamId = TeamSessionStore(this@MainActivity).currentTeamId()
      val count = if (userId != null && teamId != null) {
        PexTrackDatabase.get(this@MainActivity).offlineOperationDao().pendingCount(userId, teamId)
      } else 0
      pendingOperationsText.text = if (count == 0) "Sin registros pendientes" else "$count registro(s) pendiente(s) de sincronización"
    }
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
          currentWorkOrders = orders
          val activeOrders = orders.filter { it.status !in setOf("completed", "suspended") }
          renderWorkOrders(activeOrders)
          showStatus(if (activeOrders.isEmpty()) "No tienes OTs activas asignadas" else "${activeOrders.size} OT(s) activa(s) asignada(s)")
        }
        .onFailure { error -> showStatus(error.message ?: "No se pudieron cargar las OTs") }
      refreshPendingOperations()
    }
  }

  private fun renderWorkOrders(orders: List<MobileWorkOrder>) {
    cancelActiveDictation()
    workOrdersContainer.removeAllViews()
    orders.forEach { order ->
      val statusColor = orderStatusColor(order.status)
      val routeLabel = order.route_sequence?.let { "Ruta #$it · " }.orEmpty()
      val row = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = workOrderCardBackground(statusColor)
        setPadding(dp(18), dp(18), dp(18), dp(18))
      }
      row.layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { bottomMargin = dp(14) }
      row.addView(TextView(this).apply {
        text = "${if (order.is_emergency) "⚡ " else ""}${order.code}"
        textSize = 21f
        letterSpacing = 0.015f
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(Color.parseColor("#182230"))
      })
      row.addView(TextView(this).apply {
        text = "$routeLabel${if (order.is_emergency) "Atención prioritaria · " else ""}Prioridad ${order.priority}"
        textSize = 13f
        setTextColor(statusColor)
        setTypeface(typeface, Typeface.BOLD)
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(3) })
      row.addView(TextView(this).apply {
        text = "${taskLabel(order.task_type)}\n${order.address}"
        textSize = 15f
        setTextColor(Color.parseColor("#5F7086"))
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(6) })
      row.addView(MaterialButton(this).apply {
        text = "⌖  Ver mapa de la OT"
        setTextSize(14f)
        setAllCaps(false)
        backgroundTintList = ColorStateList.valueOf(Color.parseColor("#E6FFFA"))
        setTextColor(Color.parseColor("#0F766E"))
        strokeColor = ColorStateList.valueOf(Color.parseColor("#5EEAD4"))
        strokeWidth = dp(1)
        cornerRadius = dp(14)
        contentDescription = "Ver mapa y ruta de ${order.code}"
        setOnClickListener { showOrderMap(order) }
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(12) })
      row.addView(statusBadge(statusLabel(order.status), statusColor), LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(10) })
      val transcriptInput = EditText(this).apply {
        hint = "Observación de atención o diagnóstico"
        inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
        setText(order.latest_note.orEmpty())
        setSelection(text.length)
      }
      row.addView(transcriptInput, LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(12) })

      val noteSyncStatus = TextView(this).apply {
        text = if (order.latest_note.isNullOrBlank()) {
          "Sin observación guardada todavía. El dictado se mantiene como borrador hasta pulsar Guardar observación."
        } else {
          "✓ Última observación sincronizada. Puedes editarla o dictar una nueva."
        }
        textSize = 13f
        setTextColor(Color.parseColor(if (order.latest_note.isNullOrBlank()) "#697B91" else "#16855D"))
      }
      row.addView(noteSyncStatus, LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(8) })

      val dictationStatus = TextView(this).apply {
        text = "Pulsa Iniciar dictado, habla con claridad y finaliza cuando termines. La nota no se guarda automáticamente."
        textSize = 13f
        setTextColor(Color.parseColor("#52637A"))
      }
      row.addView(dictationStatus, LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(8) })
      val dictationPreview = TextView(this).apply {
        visibility = View.GONE
        textSize = 14f
        setTextColor(Color.parseColor("#1D5DBA"))
        setBackgroundResource(R.drawable.bg_status_card)
      }
      row.addView(dictationPreview, LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(8) })
      val transcriptActions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
      val startDictationButton = MaterialButton(this).apply {
        text = "🎙  Dictar nota"
        setTextSize(14f)
        setAllCaps(false)
        backgroundTintList = ColorStateList.valueOf(Color.parseColor("#EAF2FF"))
        setTextColor(Color.parseColor("#1D5DBA"))
        strokeColor = ColorStateList.valueOf(Color.parseColor("#AFCBFF"))
        strokeWidth = dp(1)
        cornerRadius = dp(14)
        setOnClickListener {
          requestDictation(transcriptInput, dictationStatus, dictationPreview, this)
        }
      }
      transcriptActions.addView(startDictationButton, LinearLayout.LayoutParams(0, dp(48), 1f).apply { rightMargin = dp(8) })
      val stopDictationButton = MaterialButton(this).apply {
        text = "Finalizar"
        setTextSize(14f)
        setAllCaps(false)
        backgroundTintList = ColorStateList.valueOf(Color.parseColor("#FFF1F0"))
        setTextColor(Color.parseColor("#B84D4A"))
        strokeColor = ColorStateList.valueOf(Color.parseColor("#F1B4AE"))
        strokeWidth = dp(1)
        cornerRadius = dp(14)
        visibility = View.GONE
        setOnClickListener { finishDictationManually() }
      }
      transcriptActions.addView(stopDictationButton, LinearLayout.LayoutParams(0, dp(48), 1f))
      row.addView(transcriptActions, LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(10) })
      row.addView(MaterialButton(this).apply {
        text = "Guardar dictado / observación"
        setTextSize(14f)
        setAllCaps(false)
        backgroundTintList = ColorStateList.valueOf(Color.parseColor("#2D74DF"))
        setTextColor(Color.WHITE)
        cornerRadius = dp(14)
        setOnClickListener { saveNote(order, transcriptInput, noteSyncStatus) }
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(8) })
      // Las acciones se apilan para que el ícono y la etiqueta nunca queden
      // recortados en pantallas estrechas o con escalado de fuente alto.
      val actions = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
      allowedTransitions(order.status).forEach { nextStatus ->
        actions.addView(MaterialButton(this).apply {
          text = statusActionLabel(nextStatus)
          setTextSize(14f)
          setAllCaps(false)
          cornerRadius = dp(14)
          setIconResource(statusActionIcon(nextStatus))
          iconGravity = MaterialButton.ICON_GRAVITY_TEXT_START
          iconPadding = dp(9)
          iconTint = ColorStateList.valueOf(Color.WHITE)
          gravity = Gravity.CENTER
          isSingleLine = true
          val actionColor = orderActionColor(nextStatus)
          backgroundTintList = ColorStateList.valueOf(actionColor)
          setTextColor(Color.WHITE)
          contentDescription = "${statusActionLabel(nextStatus)} orden ${order.code}"
          setOnClickListener { requestStatusChange(order, nextStatus, this) }
        }, LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT, dp(52)
        ).apply { if (nextStatus != allowedTransitions(order.status).last()) bottomMargin = dp(8) })
      }
      if (actions.childCount > 0) {
        row.addView(actions, LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(12) })
      }
      workOrdersContainer.addView(row)
    }
  }

  private fun showOrderMap(order: MobileWorkOrder) {
    val hasPermission = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (!hasPermission) {
      showStatus("Activa el GPS para mostrar tu posición en el mapa")
      return
    }
    fusedLocationClient.lastLocation
      .addOnSuccessListener { location -> showOrderMapDialog(order, location) }
      .addOnFailureListener { showOrderMapDialog(order, null) }
  }

  private fun showOrderMapDialog(order: MobileWorkOrder, technicianLocation: Location?) {
    val locatedOrders = currentWorkOrders.filter { it.latitude != null && it.longitude != null }
    val nearestDistanceKm = technicianLocation?.let { location ->
      locatedOrders.map { assignedOrder ->
        val distance = FloatArray(1)
        Location.distanceBetween(location.latitude, location.longitude, assignedOrder.latitude!!, assignedOrder.longitude!!, distance)
        distance[0] / 1000.0
      }.minOrNull()
    }
    val etaMinutes = nearestDistanceKm?.let { maxOf(1, kotlin.math.ceil(it / 25.0 * 60.0).toInt()) }

    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(22), dp(20), dp(22), dp(16))
      setBackgroundColor(Color.WHITE)
    }
    content.addView(TextView(this).apply {
      text = "Mapa de ruta"
      textSize = 21f
      setTypeface(typeface, Typeface.BOLD)
      setTextColor(Color.parseColor("#182230"))
    })
    content.addView(TextView(this).apply {
      text = "${locatedOrders.size} OT(s) ubicadas · seleccionada ${order.code}"
      textSize = 13f
      setTextColor(Color.parseColor("#64748B"))
      setPadding(0, dp(5), 0, dp(12))
    })
    val routeMap = TechnicianRouteMapView(this, technicianLocation, currentWorkOrders, order.id)
    content.addView(routeMap, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT, dp(270)
    ))
    val mapControls = LinearLayout(this).apply {
      gravity = Gravity.CENTER
      orientation = LinearLayout.HORIZONTAL
    }
    mapControls.addView(MaterialButton(this).apply {
      setIconResource(R.drawable.ic_zoom_out)
      iconSize = dp(22)
      iconGravity = MaterialButton.ICON_GRAVITY_TEXT_START
      iconPadding = 0
      setAllCaps(false)
      contentDescription = "Reducir zoom del mapa"
      minWidth = dp(52)
      setOnClickListener { routeMap.zoomOut() }
    }, LinearLayout.LayoutParams(dp(52), dp(44)).apply { rightMargin = dp(8) })
    mapControls.addView(MaterialButton(this).apply {
      setIconResource(R.drawable.ic_zoom_in)
      iconSize = dp(22)
      iconGravity = MaterialButton.ICON_GRAVITY_TEXT_START
      iconPadding = 0
      setAllCaps(false)
      contentDescription = "Ampliar mapa"
      minWidth = dp(52)
      setOnClickListener { routeMap.zoomIn() }
    }, LinearLayout.LayoutParams(dp(52), dp(44)))
    content.addView(mapControls, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)))
    val metrics = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      setPadding(0, dp(14), 0, dp(5))
    }
    metrics.addView(mapMetric("OTs en mapa", locatedOrders.size.toString()), LinearLayout.LayoutParams(0, dp(62), 1f).apply { rightMargin = dp(8) })
    metrics.addView(mapMetric("Llegada estimada", etaMinutes?.let { "$it min" } ?: "Sin GPS"), LinearLayout.LayoutParams(0, dp(62), 1f))
    content.addView(metrics)
    content.addView(TextView(this).apply {
      text = when {
        locatedOrders.isEmpty() -> "Las OTs asignadas todavía no tienen coordenadas para mostrarse en el mapa."
        technicianLocation == null -> "No se pudo leer la última ubicación del dispositivo. Activa el GPS para mostrar tu posición."
        else -> "La ruta se ordena según la secuencia asignada. La distancia y el tiempo son referenciales y no consideran tráfico."
      }
      textSize = 12f
      setTextColor(Color.parseColor("#64748B"))
    })
    content.addView(MaterialButton(this).apply {
      text = "Cerrar mapa"
      setAllCaps(false)
      setTextSize(14f)
      backgroundTintList = ColorStateList.valueOf(Color.parseColor("#5EEAD4"))
      setTextColor(Color.parseColor("#07343A"))
      cornerRadius = dp(14)
      setOnClickListener { (tag as? Dialog)?.dismiss() }
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(16) })

    val dialog = Dialog(this)
    dialog.setContentView(content)
    content.getChildAt(content.childCount - 1).tag = dialog
    dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
    dialog.setOnShowListener {
      dialog.window?.setLayout((resources.displayMetrics.widthPixels * 0.92f).toInt(), ViewGroup.LayoutParams.WRAP_CONTENT)
    }
    dialog.show()
    dialog.window?.setLayout((resources.displayMetrics.widthPixels * 0.92f).toInt(), ViewGroup.LayoutParams.WRAP_CONTENT)
  }

  private fun mapMetric(label: String, value: String): TextView = TextView(this).apply {
    text = "$label\n$value"
    textSize = 14f
    setTextColor(Color.parseColor("#0F766E"))
    setTypeface(typeface, Typeface.BOLD)
    gravity = Gravity.CENTER
    background = GradientDrawable().apply {
      setColor(Color.parseColor("#E6FFFA"))
      cornerRadius = dp(12).toFloat()
    }
  }

  private fun requestDictation(
    input: EditText,
    dictationStatus: TextView,
    dictationPreview: TextView,
    startButton: MaterialButton
  ) {
    if (speechRecognizer == null) {
      showStatus("Este dispositivo no tiene un servicio de reconocimiento de voz disponible")
      return
    }
    cancelActiveDictation()
    activeTranscriptInput = input
    activeDictationStatus = dictationStatus
    activeDictationPreview = dictationPreview
    activeStartDictationButton = startButton
    activeStopDictationButton = (startButton.parent as? LinearLayout)?.getChildAt(1) as? MaterialButton
    dictationPrefix = input.text.toString().trim()
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
      startDictation()
    } else {
      microphonePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
    }
  }

  private fun startDictation() {
    val recognizer = speechRecognizer ?: return
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-BO")
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "es-BO")
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
    }
    isDictating = true
    activeStartDictationButton?.apply {
      text = "Escuchando"
      setTextSize(13f)
      isSingleLine = true
      isEnabled = false
      backgroundTintList = ColorStateList.valueOf(Color.parseColor("#DFF7EC"))
      setTextColor(Color.parseColor("#16855D"))
    }
    activeStopDictationButton?.visibility = View.VISIBLE
    activeDictationStatus?.text = "Preparando micrófono… espera la indicación y empieza a hablar."
    activeDictationPreview?.visibility = View.GONE
    showStatus("Dictado iniciado para esta OT")
    recognizer.startListening(intent)
  }

  private fun finishDictationManually() {
    if (!isDictating) return
    activeDictationStatus?.text = "Procesando tu voz…"
    activeStopDictationButton?.isEnabled = false
    speechRecognizer?.stopListening()
  }

  private fun cancelActiveDictation() {
    if (isDictating) speechRecognizer?.cancel()
    isDictating = false
    activeStartDictationButton?.apply { text = "🎙  Dictar nota"; isEnabled = true }
    activeStopDictationButton?.apply { visibility = View.GONE; isEnabled = true }
    activeTranscriptInput = null
    activeDictationStatus = null
    activeDictationPreview = null
    activeStartDictationButton = null
    activeStopDictationButton = null
  }

  private fun createRecognitionListener() = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) {
      activeDictationStatus?.text = "Micrófono listo. Habla ahora y pulsa Finalizar al terminar."
    }
    override fun onBeginningOfSpeech() {
      activeDictationStatus?.text = "● Escuchando… tu voz se mostrará como borrador."
    }
    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit
    override fun onEndOfSpeech() {
      activeDictationStatus?.text = "Procesando tu voz…"
    }
    override fun onPartialResults(partialResults: Bundle?) {
      val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
      if (!text.isNullOrBlank()) {
        activeDictationPreview?.apply {
          visibility = View.VISIBLE
          this.text = "Borrador: $text"
        }
      }
    }
    override fun onEvent(eventType: Int, params: Bundle?) = Unit
    override fun onResults(results: Bundle?) {
      val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
      if (!text.isNullOrBlank()) {
        val finalText = listOf(dictationPrefix, text).filter { it.isNotBlank() }.joinToString(" ")
        activeTranscriptInput?.setText(finalText)
        activeTranscriptInput?.setSelection(finalText.length)
        activeDictationStatus?.text = "Transcripción lista. Revísala antes de guardar la observación."
        activeDictationPreview?.apply { visibility = View.VISIBLE; this.text = "Transcripción: $text" }
        showStatus("Transcripción lista; revísala y guárdala en la OT")
      } else {
        activeDictationStatus?.text = "No se recibió una frase. Pulsa Iniciar dictado e inténtalo de nuevo."
        showStatus("No se pudo obtener una transcripción")
      }
      isDictating = false
      activeStartDictationButton?.apply { this.text = "🎙  Dictar nuevamente"; isEnabled = true }
      activeStopDictationButton?.apply { visibility = View.GONE; isEnabled = true }
    }
    override fun onError(error: Int) {
      val message = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "No se pudo acceder al micrófono"
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "No hay conexión para transcribir la voz"
        SpeechRecognizer.ERROR_NO_MATCH -> "No se reconoció una frase; inténtalo nuevamente"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "El reconocimiento de voz está ocupado"
        else -> "No se pudo transcribir la observación"
      }
      activeDictationStatus?.text = "$message Pulsa Iniciar dictado para reintentar."
      isDictating = false
      activeStartDictationButton?.apply { text = "🎙  Dictar nota"; isEnabled = true }
      activeStopDictationButton?.apply { visibility = View.GONE; isEnabled = true }
      showStatus(message)
    }
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  private fun saveNote(order: MobileWorkOrder, input: EditText, noteSyncStatus: TextView) {
    val transcript = input.text.toString().trim()
    if (transcript.isBlank()) {
      showStatus("Escribe o dicta una observación antes de guardarla")
      return
    }
    lifecycleScope.launch {
      noteSyncStatus.text = "Guardando observación…"
      noteSyncStatus.setTextColor(Color.parseColor("#1D5DBA"))
      showStatus("Guardando observación de ${order.code}…")
      val result = operationsRepository.addNote(order.id, transcript)
      val pending = result.contains("sin conexión", ignoreCase = true)
      val successful = result == "Observación guardada"
      noteSyncStatus.text = when {
        successful -> "✓ Observación guardada y sincronizada."
        pending -> "◷ Observación guardada localmente; pendiente de sincronización."
        else -> result
      }
      noteSyncStatus.setTextColor(Color.parseColor(if (successful) "#16855D" else if (pending) "#A86918" else "#B84D4A"))
      showStatus(result)
      loadWorkOrders()
    }
  }

  private fun requestStatusChange(order: MobileWorkOrder, nextStatus: String, actionButton: MaterialButton) {
    if (nextStatus == "suspended") {
      showSuspensionDialog(order, actionButton)
      return
    }
    val title = statusActionLabel(nextStatus)
    val message = when (nextStatus) {
      "in_progress" -> "La OT ${order.code} pasará a En progreso y quedará registrada como atención en curso."
      "completed" -> "La OT ${order.code} se marcará como completada. Verifica que la atención haya finalizado."
      "en_route" -> "La OT ${order.code} se marcará como En camino."
      else -> "Se actualizará el estado de la OT ${order.code}."
    }
    androidx.appcompat.app.AlertDialog.Builder(this)
      .setTitle(title)
      .setMessage(message)
      .setNegativeButton("Cancelar", null)
      .setPositiveButton("Confirmar") { _, _ -> changeWorkOrderStatus(order, nextStatus, null, actionButton) }
      .show()
  }

  private fun showSuspensionDialog(order: MobileWorkOrder, actionButton: MaterialButton) {
    val reasonInput = EditText(this).apply {
      hint = "Ej.: cliente ausente, riesgo o falta de acceso"
      inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
      minLines = 3
      maxLines = 5
      setPadding(dp(12), dp(10), dp(12), dp(10))
    }
    val container = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(22), 0, dp(22), 0)
      addView(TextView(this@MainActivity).apply {
        text = "Indica por qué se suspende ${order.code}. Este motivo quedará registrado en el historial."
        textSize = 14f
        setTextColor(Color.parseColor("#52637A"))
      })
      addView(reasonInput, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(14) })
    }
    val dialog = androidx.appcompat.app.AlertDialog.Builder(this)
      .setTitle("Suspender OT")
      .setView(container)
      .setNegativeButton("Cancelar", null)
      .setPositiveButton("Suspender", null)
      .create()
    dialog.setOnShowListener {
      val suspendButton = dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE)
      suspendButton.isEnabled = false
      reasonInput.addTextChangedListener(object : android.text.TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
          suspendButton.isEnabled = !s.isNullOrBlank()
        }
        override fun afterTextChanged(s: android.text.Editable?) = Unit
      })
      suspendButton.setOnClickListener {
        val reason = reasonInput.text.toString().trim()
        if (reason.isBlank()) return@setOnClickListener
        dialog.dismiss()
        changeWorkOrderStatus(order, "suspended", reason, actionButton)
      }
    }
    dialog.show()
  }

  private fun changeWorkOrderStatus(order: MobileWorkOrder, nextStatus: String, reason: String?, actionButton: MaterialButton) {
    actionButton.isEnabled = false
    lifecycleScope.launch {
      showStatus("Actualizando ${order.code}…")
      val result = operationsRepository.changeStatus(order.id, nextStatus, reason)
      showStatus(result ?: "${order.code}: ${statusLabel(nextStatus)}")
      actionButton.isEnabled = true
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
    "en_route" -> "Marcar en camino"
    "in_progress" -> "Iniciar atención"
    "completed" -> "Completar atención"
    "suspended" -> "Suspender OT"
    else -> status
  }

  private fun statusActionIcon(status: String): Int = when (status) {
    "en_route" -> R.drawable.ic_action_route
    "in_progress" -> R.drawable.ic_action_play
    "completed" -> R.drawable.ic_action_complete
    "suspended" -> R.drawable.ic_action_suspend
    else -> R.drawable.ic_action_route
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

  private fun orderStatusColor(status: String): Int = Color.parseColor(when (status) {
    "pending" -> "#B7791F"
    "en_route" -> "#2D74DF"
    "in_progress" -> "#7C4DCC"
    "completed" -> "#16855D"
    "suspended" -> "#C63C3C"
    else -> "#64748B"
  })

  private fun orderActionColor(status: String): Int = Color.parseColor(when (status) {
    "completed" -> "#16855D"
    "suspended" -> "#C63C3C"
    "in_progress" -> "#7C4DCC"
    else -> "#2D74DF"
  })

  private fun workOrderCardBackground(statusColor: Int): GradientDrawable = GradientDrawable().apply {
    setColor(Color.WHITE)
    cornerRadius = dp(20).toFloat()
    setStroke(dp(2), statusColor)
  }

  private fun statusBadge(label: String, statusColor: Int): TextView = TextView(this).apply {
    text = "  $label  "
    textSize = 12f
    setTypeface(typeface, Typeface.BOLD)
    setTextColor(statusColor)
    background = GradientDrawable().apply {
      setColor(Color.argb(25, Color.red(statusColor), Color.green(statusColor), Color.blue(statusColor)))
      cornerRadius = dp(12).toFloat()
      setStroke(dp(1), statusColor)
    }
    setPadding(dp(6), dp(4), dp(6), dp(4))
  }

  override fun onDestroy() {
    runCatching { connectivityManager.unregisterNetworkCallback(networkCallback) }
    speechRecognizer?.cancel()
    speechRecognizer?.destroy()
    speechRecognizer = null
    super.onDestroy()
  }
}
