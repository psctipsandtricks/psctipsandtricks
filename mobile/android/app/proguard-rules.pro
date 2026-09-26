# Razorpay's checkout SDK is reflection-driven; R8 strips the callback classes
# it looks up by name, which silently breaks payment results in release builds.
-keep class com.razorpay.** { *; }
-keepclassmembers class * {
    @com.razorpay.* <methods>;
}
-dontwarn com.razorpay.**
-keepattributes *Annotation*
-keep class **.R$* { *; }

# proguard.annotation is referenced by Razorpay but not shipped with it.
-dontwarn proguard.annotation.**

# ExoPlayer (just_audio) resolves renderers reflectively.
-dontwarn com.google.android.exoplayer2.**

# Flutter embedding and plugins (prevent obfuscation that breaks bootstrap)
-keep class io.flutter.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.app.** { *; }
-dontwarn io.flutter.**

# Google Play Services / Sign-In (used by google_sign_in and firebase)
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Kotlin coroutines (common across plugins)
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# AndroidX WebKit / FileProvider paths referenced via manifest meta-data
-keep class androidx.webkit.** { *; }
-keep class androidx.core.content.FileProvider { *; }
