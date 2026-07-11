package com.plugin.mobile

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.preference.PreferenceManager

/** Updates React Native's debug-server address without rebuilding the APK. */
class MetroHostReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val metroHost = intent.getStringExtra("metroHost")?.trim().orEmpty()
    if (intent.action != ACTION_SET_METRO_HOST || !HOST_PATTERN.matches(metroHost)) {
      resultCode = Activity.RESULT_CANCELED
      return
    }

    PreferenceManager.getDefaultSharedPreferences(context)
      .edit()
      .putString("debug_http_host", metroHost)
      .commit()
    resultCode = Activity.RESULT_OK
  }

  companion object {
    private const val ACTION_SET_METRO_HOST = "com.plugin.mobile.SET_METRO_HOST"
    private val HOST_PATTERN = Regex("^[A-Za-z0-9._:-]+:[0-9]{1,5}$")
  }
}
