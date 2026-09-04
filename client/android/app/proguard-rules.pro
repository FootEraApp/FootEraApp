# =========================================================
# FootEra - regras R8 / ProGuard
# =========================================================

# Mantém informações úteis para analisar stack traces
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*

# =========================================================
# Capacitor
# =========================================================

# Preserva plugins Capacitor registrados por annotation/reflection
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}

-keep public class * extends com.getcapacitor.Plugin {
    *;
}

# Compatibilidade com plugins Capacitor antigos
-keep @com.getcapacitor.NativePlugin public class * {
    @com.getcapacitor.PluginMethod public <methods>;
}

# =========================================================
# Cordova
# =========================================================

-keep public class * extends org.apache.cordova.* {
    public <methods>;
    public <fields>;
}