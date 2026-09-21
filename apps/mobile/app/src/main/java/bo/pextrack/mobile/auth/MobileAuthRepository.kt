package bo.pextrack.mobile.auth

import android.content.Context
import bo.pextrack.mobile.sync.OfflineSyncScheduler
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.Json

class MobileAuthRepository(private val context: Context) {
  private val sessionStore = TeamSessionStore(context)

  fun isConfigured(): Boolean = SupabaseProvider.isConfigured

  fun hasSession(): Boolean = SupabaseProvider.client?.auth?.currentSessionOrNull() != null

  suspend fun signIn(email: String, password: String): String? = runCatching {
    val client = requireNotNull(SupabaseProvider.client) { "La aplicación no tiene configurado Supabase." }
    client.auth.signInWith(Email) {
      this.email = email.trim()
      this.password = password
    }
    val teamId = Json.decodeFromString<String?>(client.postgrest.rpc("current_team_id").data)
      ?: error("Este usuario no pertenece a una cuadrilla activa.")
    sessionStore.saveTeamId(teamId)
    OfflineSyncScheduler.enqueue(context)
    null
  }.getOrElse { error -> error.message ?: "No se pudo iniciar sesión." }

  suspend fun signOut() {
    SupabaseProvider.client?.auth?.signOut()
    sessionStore.clear()
  }
}
