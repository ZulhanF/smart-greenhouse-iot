/*
  ========================================================================
  AURA BIOSPHERE - ESP32 SMART GREENHOUSE
  Module: Servo Roof Vent Actuator (Firebase Realtime Database Test)
  ========================================================================

  Required Libraries (Install via Arduino IDE Library Manager):
  1. "Firebase_ESP_Client" by Mobizt (v4.x.x)
  2. "ESP32Servo" by Kevin Harrington (v3.x.x)

  Hardware Wiring (Servo Motor SG90 / MG90S / MG996R):
  - Brown / Black Wire : GND (ESP32 GND)
  - Red Wire           : 5V / VIN (Gunakan 5V eksternal jika servo beban berat, sambungkan GND bersama)
  - Orange / Yellow    : GPIO 18 (PWM Signal)
  ========================================================================
*/

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <ESP32Servo.h>

// Token & RTDB helper dari library Firebase_ESP_Client
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ======================= 1. KONFIGURASI WIFI =======================
#define WIFI_SSID     "Avengers 2.4"       // Ganti dengan SSID WiFi / Hotspot HP
#define WIFI_PASSWORD "Laragon001"   // Ganti dengan Password WiFi

// ===================== 2. KONFIGURASI FIREBASE =====================
// Sesuai dengan konfigurasi src/firebase.js proyek Anda
#define API_KEY       "AIzaSyB1rXT7I1b6ol0Hlg0uJuFxzrNxAp8tVyo"
#define DATABASE_URL  "https://aura-sphere-iot-default-rtdb.asia-southeast1.firebasedatabase.app"

// Path node di Firebase Realtime Database
#define VENT_PATH     "/greenhouse/actuators/ventOpen"

// ====================== 3. KONFIGURASI SERVO ======================
#define SERVO_PIN         18    // GPIO 18 untuk pin sinyal servo
#define SERVO_CLOSE_POS   0     // Derajat saat ventilasi tertutup rapat (0 deg)
#define SERVO_OPEN_POS    90    // Derajat saat ventilasi terbuka (bisa disesuaikan ke 90 - 180 deg)
#define SERVO_STEP_DELAY  15    // Kecepatan gerak halus (ms per degree)

Servo ventServo;
FirebaseData fbdoStream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool currentVentState = false;
bool firebaseReady = false;

// Fungsi untuk menggerakkan servo secara halus (smooth transition)
void moveServoSmooth(int fromAngle, int toAngle) {
  if (fromAngle == toAngle) return;

  Serial.printf("[SERVO] Bergerak dari %d° ke %d°...\n", fromAngle, toAngle);
  if (fromAngle < toAngle) {
    for (int pos = fromAngle; pos <= toAngle; pos++) {
      ventServo.write(pos);
      delay(SERVO_STEP_DELAY);
    }
  } else {
    for (int pos = fromAngle; pos >= toAngle; pos--) {
      ventServo.write(pos);
      delay(SERVO_STEP_DELAY);
    }
  }
  Serial.printf("[SERVO] Posisi tercapai: %d°\n", toAngle);
}

// Callback otomatis saat data di Firebase berubah secara Realtime (Stream Callback)
void streamCallback(FirebaseStream data) {
  Serial.printf("[STREAM] Data event path: %s | Tipe: %s\n", data.streamPath().c_str(), data.dataType().c_str());

  if (data.dataType() == "boolean") {
    bool newVentState = data.boolData();
    Serial.printf("[FIREBASE EVENT] ventOpen = %s\n", newVentState ? "TRUE (TERBUKA)" : "FALSE (TERTUTUP)");
    
    if (newVentState != currentVentState) {
      if (newVentState) {
        Serial.println("[AKSI] Membuka ventilasi atap...");
        moveServoSmooth(SERVO_CLOSE_POS, SERVO_OPEN_POS);
      } else {
        Serial.println("[AKSI] Menutup ventilasi atap...");
        moveServoSmooth(SERVO_OPEN_POS, SERVO_CLOSE_POS);
      }
      currentVentState = newVentState;
    }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("[STREAM] Stream timeout, otomatis menyambung kembali...");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==================================================");
  Serial.println("  AURA BIOSPHERE - ESP32 SERVO VENTILASI TEST");
  Serial.println("==================================================");

  // 1. Inisialisasi Servo
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  ventServo.setPeriodHertz(50); // Standar servo 50Hz
  ventServo.attach(SERVO_PIN, 500, 2400); // Pulse width standar SG90/MG90S (500us - 2400us)

  // Set posisi awal: TERTUTUP (0 derajat)
  Serial.println("[INIT] Mengatur posisi awal servo ke 0° (Tertutup rapat)...");
  ventServo.write(SERVO_CLOSE_POS);
  currentVentState = false;
  delay(500);

  // 2. Hubungkan ke Wi-Fi
  Serial.printf("[WIFI] Menghubungkan ke %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 30) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Terhubung!");
    Serial.print("[WIFI] IP Address: ");
    Serial.println(WiFi.localIP());

    // 3. Inisialisasi Firebase
    Serial.println("[FIREBASE] Menginisialisasi koneksi...");
    config.api_key = API_KEY;
    config.database_url = DATABASE_URL;

    // Sign up anonymous untuk dev / tanpa login
    Firebase.signUp(&config, &auth, "", "");
    config.signer.test_mode = true;

    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);

    // Aktifkan streaming listener pada path ventOpen
    if (!Firebase.RTDB.beginStream(&fbdoStream, VENT_PATH)) {
      Serial.printf("[STREAM ERROR] Gagal memulai stream: %s\n", fbdoStream.errorReason().c_str());
    } else {
      Firebase.RTDB.setStreamCallback(&fbdoStream, streamCallback, streamTimeoutCallback);
      Serial.println("[FIREBASE] Stream listener AKTIF pada path: " VENT_PATH);
      firebaseReady = true;
    }

    // Baca nilai awal saat booting
    if (Firebase.RTDB.getBool(&fbdo, VENT_PATH)) {
      bool initialVal = fbdo.boolData();
      Serial.printf("[FIREBASE] Nilai awal di cloud: %s\n", initialVal ? "BUKA" : "TUTUP");
      if (initialVal != currentVentState) {
        currentVentState = initialVal;
        ventServo.write(currentVentState ? SERVO_OPEN_POS : SERVO_CLOSE_POS);
      }
    }
  } else {
    Serial.println("\n[WIFI GAGAL] Tidak dapat terhubung ke WiFi.");
    Serial.println("[TIPS] Anda tetap bisa tes servo manual via Serial Monitor:");
    Serial.println("       Ketik '1' atau 'buka' lalu Enter -> Servo buka");
    Serial.println("       Ketik '0' atau 'tutup' lalu Enter -> Servo tutup");
  }

  Serial.println("\n[READY] Sistem siap menerima perintah.");
  Serial.println("Petunjuk Serial Monitor:");
  Serial.println("- Ketik '1' atau 'buka'  -> Tes Servo BUKA (90°)");
  Serial.println("- Ketik '0' atau 'tutup' -> Tes Servo TUTUP (0°)");
}

void loop() {
  // A. Input Manual dari Serial Monitor untuk kemudahan pengetesan hardware
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    input.toLowerCase();

    if (input == "1" || input == "buka" || input == "open") {
      Serial.println("[MANUAL] Perintah BUKA diterima!");
      moveServoSmooth(currentVentState ? SERVO_OPEN_POS : SERVO_CLOSE_POS, SERVO_OPEN_POS);
      currentVentState = true;
      // Update juga ke Firebase jika online
      if (WiFi.status() == WL_CONNECTED) {
        Firebase.RTDB.setBool(&fbdo, VENT_PATH, true);
      }
    } else if (input == "0" || input == "tutup" || input == "close") {
      Serial.println("[MANUAL] Perintah TUTUP diterima!");
      moveServoSmooth(currentVentState ? SERVO_OPEN_POS : SERVO_CLOSE_POS, SERVO_CLOSE_POS);
      currentVentState = false;
      // Update juga ke Firebase jika online
      if (WiFi.status() == WL_CONNECTED) {
        Firebase.RTDB.setBool(&fbdo, VENT_PATH, false);
      }
    }
  }

  // B. Firebase Stream Background Processing
  if (firebaseReady) {
    // Stream callback ditangani secara asynchronous oleh library
  }

  delay(20);
}
