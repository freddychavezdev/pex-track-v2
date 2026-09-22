import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("org.jetbrains.kotlin.plugin.serialization")
  id("com.google.devtools.ksp")
  id("androidx.room")
}

val localProperties = Properties().apply {
  val localFile = rootProject.file("local.properties")
  if (localFile.exists()) localFile.inputStream().use(::load)
}

fun buildConfigValue(name: String): String {
  val value = localProperties.getProperty(name, "")
  return "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
}

android {
  namespace = "bo.pextrack.mobile"
  compileSdk = 36

  defaultConfig {
    applicationId = "bo.pextrack.mobile"
    minSdk = 28
    targetSdk = 36
    versionCode = 3
    versionName = "0.1.2"
    buildConfigField("String", "SUPABASE_URL", buildConfigValue("SUPABASE_URL"))
    buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", buildConfigValue("SUPABASE_PUBLISHABLE_KEY"))
  }

  buildFeatures {
    buildConfig = true
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

}

kotlin {
  compilerOptions {
    jvmTarget.set(JvmTarget.JVM_17)
  }
  jvmToolchain(21)
}

room {
  schemaDirectory("$projectDir/schemas")
}

dependencies {
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.activity:activity-ktx:1.10.1")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
  implementation("androidx.work:work-runtime-ktx:2.10.0")
  implementation("androidx.room:room-runtime:2.8.5")
  implementation("androidx.room:room-ktx:2.8.5")
  ksp("androidx.room:room-compiler:2.8.5")
  implementation("com.google.android.gms:play-services-location:21.3.0")
  implementation(platform("io.github.jan-tennert.supabase:bom:3.5.0"))
  implementation("io.github.jan-tennert.supabase:auth-kt")
  implementation("io.github.jan-tennert.supabase:postgrest-kt")
  implementation("io.ktor:ktor-client-android:3.0.3")
}
