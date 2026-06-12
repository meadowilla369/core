package com.entr.ticketplatform.plugins

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject

// Android equivalent of the iOS SecureStoragePlugin.
// Uses EncryptedSharedPreferences backed by Android Keystore (hardware-backed
// on devices with a secure element).
//
// Android limitation vs iOS: Android Keystore items are NOT synced via Google
// cloud backup because the keys are hardware-bound to the device. This means
// switching Android devices will require re-onboarding (new wallet). This is
// a known platform constraint — there is no safe cross-device key sync on
// Android without a server-side custodial component.
@CapacitorPlugin(name = "SecureStorage")
class SecureStoragePlugin : Plugin() {

    private val prefsName = "entr_secure_storage"

    private fun getPrefs() = EncryptedSharedPreferences.create(
        context,
        prefsName,
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    @PluginMethod
    fun get(call: PluginCall) {
        val key = call.getString("key") ?: run {
            call.reject("key is required")
            return
        }
        val value = getPrefs().getString(key, null)
        val result = JSObject()
        if (value != null) result.put("value", value) else result.put("value", JSObject.NULL)
        call.resolve(result)
    }

    @PluginMethod
    fun set(call: PluginCall) {
        val key = call.getString("key") ?: run { call.reject("key is required"); return }
        val value = call.getString("value") ?: run { call.reject("value is required"); return }
        getPrefs().edit().putString(key, value).apply()
        call.resolve()
    }

    @PluginMethod
    fun remove(call: PluginCall) {
        val key = call.getString("key") ?: run { call.reject("key is required"); return }
        getPrefs().edit().remove(key).apply()
        call.resolve()
    }
}
