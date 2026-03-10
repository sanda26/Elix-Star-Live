# Elix Star Live - ProGuard Configuration
# Optimized for React Native + Capacitor

# Keep React Native and Capacitor classes
-keep class com.capacitorjs.** { *; }
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
-keep class org.godotengine.godot.** { *; }

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }

# Keep WebRTC classes for live streaming
-keep class org.webrtc.** { *; }
-keep class org.chromium.** { *; }

# Keep OkHttp for networking
-keep class okhttp3.** { *; }
-keep class retrofit2.** { *; }

# Keep Gson for JSON parsing
-keep class com.google.gson.** { *; }
-keepattributes *Annotation*, Signature
-dontwarn sun.misc.**
-keep class com.google.gson.examples.android.model.** { *; }

# Keep model classes
-keep class com.elixstarlive.app.** { *; }
-keep class com.elixstarlive.** { *; }

# Keep JavaScript interface for WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep line numbers for crash reporting
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# Keep R class
-keepclassmembers class **.R$* {
    public static <fields>;
}

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
