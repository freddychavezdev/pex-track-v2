package bo.pextrack.mobile.auth

import android.content.Context
import bo.pextrack.mobile.sync.OfflineSyncScheduler
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.Json
import kotlinx.serialization.Serializable
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class MobileAuthRepository(private val context: Context) {
  private val sessionStore = TeamSessionStore(context)

  @Serializable
  private data class TeamSummary(val code: String)

  fun isConfigured(): Boolean = SupabaseProvider.isConfigured

  fun hasSession(): Boolean = SupabaseProvider.client?.auth?.currentSessionOrNull() != null

  suspend fun signIn(email: String, password: String): String? {
    val client = requireNotNull(SupabaseProvider.client) { "La aplicación no tiene configurado Supabase." }
    return try {
      client.auth.signInWith(Email) {
        this.email = email.trim()
        this.password = password
      }
      val teamId = Json.decodeFromString<String?>(client.postgrest.rpc("current_team_id").data)
        ?: error("Este usuario no pertenece a una cuadrilla activa.")
      // La cuenta ya quedó autenticada y vinculada a una cuadrilla mediante
      // current_team_id. El nombre es informativo; si su consulta falla no
      // debe impedir el acceso del técnico.
      val teamCode = runCatching {
        Json.decodeFromString<List<TeamSummary>>(
          client.postgrest.from("teams").select { filter { eq("id", teamId) } }.data
        ).firstOrNull()?.code
      }.getOrNull()
      sessionStore.saveTeam(teamId, teamCode)
      OfflineSyncScheduler.enqueue(context)
      null
    } catch (error: Throwable) {
      sessionStore.clear()
      runCatching { client.auth.signOut() }
      friendlyAuthError(error)
    }
  }

  fun currentTeamCode(): String? = sessionStore.currentTeamCode()

  suspend fun refreshTeamCode() {
    val client = SupabaseProvider.client ?: return
    val teamId = sessionStore.currentTeamId() ?: return
    runCatching {
      val teamCode = Json.decodeFromString<List<TeamSummary>>(
        client.postgrest.from("teams").select { filter { eq("id", teamId) } }.data
      ).firstOrNull()?.code ?: return
      sessionStore.saveTeam(teamId, teamCode)
    }
  }

  private fun friendlyAuthError(error: Throwable): String {
    val details = generateSequence(error) { it.cause }
      .mapNotNull { it.message }
      .joinToString(" ")
      .lowercase()

    return when {
      error.hasCause<UnknownHostException>() || error.hasCause<ConnectException>() ||
        error.hasCause<SocketTimeoutException>() || error.hasCause<IOException>() ||
        details.contains("unable to resolve host") || details.contains("failed to connect") ||
        details.contains("timeout") || details.contains("http request") ->
        "No hay conexión a Internet. Conéctate a una red e inténtalo nuevamente."
      details.contains("invalid login credentials") || details.contains("invalid credentials") ->
        "El correo o la contraseña son incorrectos. Verifica tus datos."
      details.contains("email not confirmed") ->
        "El correo aún no está confirmado. Solicita al supervisor que revise la cuenta."
      details.contains("too many requests") || details.contains("rate limit") ->
        "Se alcanzó el límite de intentos. Espera unos minutos e inténtalo nuevamente."
      details.contains("cuadrilla activa") ->
        "La cuenta no está vinculada a una cuadrilla activa. Contacta al supervisor."
      else -> "No se pudo iniciar sesión. Verifica tus datos e inténtalo nuevamente."
    }
  }

  private inline fun <reified T : Throwable> Throwable.hasCause(): Boolean =
    generateSequence(this) { it.cause }.any { it is T }

  suspend fun signOut() {
    SupabaseProvider.client?.auth?.signOut()
    sessionStore.clear()
  }
}
