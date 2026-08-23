# Razorpay's checkout SDK is reflection-driven; R8 strips the callback classes
# it looks up by name, which silently breaks payment results in release builds.
-keep class com.razorpay.** { *; }
-keepclassmembers class * {
    @com.razorpay.* <methods>;
}
-dontwarn com.razorpay.**

# proguard.annotation is referenced by Razorpay but not shipped with it.
-dontwarn proguard.annotation.**

# ExoPlayer (just_audio) resolves renderers reflectively.
-dontwarn com.google.android.exoplayer2.**
