plugins {
    id("com.android.application")
}

android {
    namespace = "com.zeeshan.bazaarboss"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.zeeshan.bazaarboss"
        minSdk = 23
        targetSdk = 35
        versionCode = 10
        versionName = "10.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.13.0")
}
