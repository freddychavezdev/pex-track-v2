package bo.pextrack.mobile.auth

import android.content.Context

class TeamSessionStore(context: Context) {
  private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  fun currentTeamId(): String? = preferences.getString(KEY_TEAM_ID, null)
  fun currentTeamCode(): String? = preferences.getString(KEY_TEAM_CODE, null)

  fun saveTeam(teamId: String, teamCode: String? = null) {
    preferences.edit().putString(KEY_TEAM_ID, teamId).apply {
      if (teamCode.isNullOrBlank()) remove(KEY_TEAM_CODE) else putString(KEY_TEAM_CODE, teamCode)
    }.apply()
  }

  fun clear() {
    preferences.edit().remove(KEY_TEAM_ID).remove(KEY_TEAM_CODE).apply()
  }

  private companion object {
    const val PREFERENCES_NAME = "pex-track-session"
    const val KEY_TEAM_ID = "active-team-id"
    const val KEY_TEAM_CODE = "active-team-code"
  }
}
