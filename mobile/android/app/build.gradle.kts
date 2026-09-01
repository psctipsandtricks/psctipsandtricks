import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing lives outside the repo, in android/key.properties (gitignored).
// Without it the build still works — it falls back to the debug key — but the
// resulting APK must never be handed to a user: the debug keystore is
// machine-local and regenerated freely, so the next build from another machine
// has a different signature and every existing install refuses to update with
// "App not installed".
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
val keystoreProperties =
    Properties().apply {
        if (hasReleaseKeystore) {
            keystorePropertiesFile.inputStream().use { load(it) }
        }
    }

android {
    namespace = "com.psctipsandtricks.student"

    // Build against the newest platform Flutter ships support for (API 36 /
    // Android 16). compileSdk only affects what the code may call — it never
    // restricts which devices can install the app.
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        // flutter_local_notifications schedules against java.time, which only
        // exists below API 26 through desugaring.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.psctipsandtricks.student"

        // Android 7.0. Pinned to a literal rather than `flutter.minSdkVersion`
        // so that a Flutter upgrade raising its floor shows up as a deliberate
        // decision here instead of silently cutting devices off the install
        // list. 24 is Flutter's own floor as of 3.44 — the engine no longer
        // builds for API 21-23 — so this cannot go lower without downgrading
        // Flutter. Razorpay, flutter_secure_storage and just_audio all want 21+
        // anyway, so 24 is the binding constraint.
        minSdk = 24

        // Always the latest stable platform. This is not optional: Android 14
        // refuses to install apps targeting below API 23 and Android 15 refuses
        // below API 24, and Play requires a recent target. Lowering it to dodge
        // a behaviour change would cost compatibility, not buy it.
        targetSdk = flutter.targetSdkVersion

        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")

                // v2 is the scheme every device from API 24 up verifies, and v3
                // is what allows the signing key to be rotated later without
                // asking every student to uninstall and reinstall. v1 is left
                // to AGP, which enables it only when minSdk needs it.
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            signingConfig =
                if (hasReleaseKeystore) {
                    signingConfigs.getByName("release")
                } else {
                    logger.warn(
                        "\n" +
                            "WARNING: android/key.properties is missing, so this release build is\n" +
                            "signed with the local debug key. It will install, but it cannot be\n" +
                            "distributed: any rebuild elsewhere produces a different signature and\n" +
                            "existing installs will fail to update with \"App not installed\".\n" +
                            "See android/KEYSTORE_SETUP.md.\n",
                    )
                    signingConfigs.getByName("debug")
                }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
