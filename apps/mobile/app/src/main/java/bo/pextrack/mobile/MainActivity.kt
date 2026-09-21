package bo.pextrack.mobile

import android.Manifest
import android.content.Intent
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
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
import bo.pextrack.mobile.data.PexTrackDatabase
import bo.pextrack.mobile.sync.OfflineSyncScheduler
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
  private lateinit var statusText: TextView
  private lateinit var pendingOperationsText: TextView
  private lateinit var loginButton: Button
  private lateinit var emailInput: EditText
  private lateinit var passwordInput: EditText
  private lateinit var suspensionReasonInput: EditText
  private lateinit var workOrdersContainer: LinearLayout
  private var speechRecognizer: SpeechRecognizer? = null
  private var activeTranscriptInput: EditText? = null
  private lateinit var connectivityManager: ConnectivityManager
  private val networkCallback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) {
      OfflineSyncScheduler.enqueue(this@MainActivity)
      runOnUiThread { showStatus("Conexión recuperada; sincronizando registros pendientes…") }
      refreshPendingOperations()
    }

    override fun onLost(network: Network) {
      runOnUiThread { showStatus("Sin conexión: los cambios se guardarán localmente") }
    }
  }
  private val authRepository by lazy { MobileAuthRepository(this) }
  private val operationsRepository by lazy { MobileOperationsRepository(this) }

  private val locationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { permissions ->
    val preciseGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (preciseGranted) requestBackgroundLocationIfNeeded() else showStatus("Se requiere ubicación precisa para iniciar el seguimiento")
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
    emailInput = findViewById(R.id.emailInput)
    passwordInput = findViewById(R.id.passwordInput)
    suspensionReasonInput = findViewById(R.id.suspensionReasonInput)
    workOrdersContainer = findViewById(R.id.workOrdersContainer)
    connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    connectivityManager.registerDefaultNetworkCallback(networkCallback)
    loginButton.setOnClickListener { signIn() }
    findViewById<Button>(R.id.signOutButton).setOnClickListener { signOut() }
    findViewById<Button>(R.id.refreshWorkOrdersButton).setOnClickListener { loadWorkOrders() }
    findViewById<Button>(R.id.startTrackingButton).setOnClickListener { requestPermissionsAndStart() }
    findViewById<Button>(R.id.stopTrackingButton).setOnClickListener {
      stopService(Intent(this, LocationTrackingService::class.java))
      showStatus("Seguimiento detenido")
    }
    speechRecognizer = if (SpeechRecognizer.isRecognitionAvailable(this)) {
      SpeechRecognizer.createSpeechRecognizer(this).also { recognizer ->
        recognizer.setRecognitionListener(createRecognitionListener())
      }
    } else null
    refreshSessionStatus()
    refreshPendingOperations()
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
    val permissions = buildList {
      if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
      ) add(Manifest.permission.POST_NOTIFICATIONS)
    }
    if (permissions.isEmpty()) requestBackgroundLocationIfNeeded()
    else locationPermissionLauncher.launch(permissions.toTypedArray())
  }

  private fun requestBackgroundLocationIfNeeded() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED
    ) {
      showStatus("Autoriza ‘Permitir siempre’ para mantener la ubicación con la pantalla bloqueada")
      backgroundLocationPermissionLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    } else {
      startTracking()
    }
  }

  private fun startTracking() {
    ContextCompat.startForegroundService(this, Intent(this, LocationTrackingService::class.java))
    showStatus("Seguimiento activo: la notificación debe permanecer visible")
  }

  private fun showStatus(message: String) {
    statusText.text = message
  }

  private fun refreshPendingOperations() {
    lifecycleScope.launch {
      val count = PexTrackDatabase.get(this@MainActivity).offlineOperationDao().pendingCount()
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
          renderWorkOrders(orders)
          showStatus(if (orders.isEmpty()) "No tienes OTs activas asignadas" else "${orders.size} OT(s) activa(s) asignada(s)")
        }
        .onFailure { error -> showStatus(error.message ?: "No se pudieron cargar las OTs") }
      refreshPendingOperations()
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
        text = "${order.code} · ${if (order.is_emergency) "EMERGENCIA · " else ""}Prioridad ${order.priority}"
        textSize = 16f
        setTextColor(Color.parseColor("#182230"))
      })
      row.addView(TextView(this).apply {
        text = "${taskLabel(order.task_type)} · ${order.address}\nEstado: ${statusLabel(order.status)}"
        textSize = 14f
        setTextColor(Color.parseColor("#5F7086"))
      })
      val transcriptInput = EditText(this).apply {
        hint = "Observación de atención o diagnóstico"
        inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
        setText(order.latest_note.orEmpty())
        setSelection(text.length)
      }
      row.addView(transcriptInput)
      val transcriptActions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
      transcriptActions.addView(Button(this).apply {
        text = "Dictar"
        setOnClickListener { requestDictation(transcriptInput) }
      })
      transcriptActions.addView(Button(this).apply {
        text = "Guardar observación"
        setOnClickListener { saveNote(order, transcriptInput) }
      })
      row.addView(transcriptActions)
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

  private fun requestDictation(input: EditText) {
    if (speechRecognizer == null) {
      showStatus("Este dispositivo no tiene un servicio de reconocimiento de voz disponible")
      return
    }
    activeTranscriptInput = input
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
    showStatus("Escuchando la observación…")
    recognizer.startListening(intent)
  }

  private fun createRecognitionListener() = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) = Unit
    override fun onBeginningOfSpeech() = Unit
    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit
    override fun onEndOfSpeech() = Unit
    override fun onPartialResults(partialResults: Bundle?) {
      val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
      if (!text.isNullOrBlank()) activeTranscriptInput?.setText(text)
    }
    override fun onEvent(eventType: Int, params: Bundle?) = Unit
    override fun onResults(results: Bundle?) {
      val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
      if (!text.isNullOrBlank()) {
        activeTranscriptInput?.setText(text)
        activeTranscriptInput?.setSelection(text.length)
        showStatus("Transcripción lista; revísala y guárdala en la OT")
      } else {
        showStatus("No se pudo obtener una transcripción")
      }
    }
    override fun onError(error: Int) {
      val message = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "No se pudo acceder al micrófono"
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "No hay conexión para transcribir la voz"
        SpeechRecognizer.ERROR_NO_MATCH -> "No se reconoció una frase; inténtalo nuevamente"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "El reconocimiento de voz está ocupado"
        else -> "No se pudo transcribir la observación"
      }
      showStatus(message)
    }
  }

  private fun saveNote(order: MobileWorkOrder, input: EditText) {
    val transcript = input.text.toString().trim()
    if (transcript.isBlank()) {
      showStatus("Escribe o dicta una observación antes de guardarla")
      return
    }
    lifecycleScope.launch {
      showStatus("Guardando observación de ${order.code}…")
      showStatus(operationsRepository.addNote(order.id, transcript))
      loadWorkOrders()
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

  override fun onDestroy() {
    runCatching { connectivityManager.unregisterNetworkCallback(networkCallback) }
    speechRecognizer?.cancel()
    speechRecognizer?.destroy()
    speechRecognizer = null
    super.onDestroy()
  }
}
