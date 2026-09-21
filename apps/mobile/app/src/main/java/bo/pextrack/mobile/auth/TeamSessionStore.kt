package bo.pextrack.mobile.auth

import android.content.Context

class TeamSessionStore(context: Context) {
  private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  fun currentTeamId(): String? = preferences.getString(KEY_TEAM_ID, null)

  fun saveTeamId(teamId: String) {
    preferences.edit().putString(KEY_TEAM_ID, teamId).apply()
  }

  fun clear() {
    preferences.edit().remove(KEY_TEAM_ID).apply()
  }

  private companion object {
    const val PREFERENCES_NAME = "pex-track-session"
    const val KEY_TEAM_ID = "active-team-id"
  }
}
