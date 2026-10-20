/*
 * ======================================================================================
 * PROYEK AKHIR IoT: Smart Greenhouse Mini Berbasis ESP32 & Dashboard Website
 * ======================================================================================
 * Deskripsi:
 * Firmware ESP32 untuk pemantauan dan kontrol otonom iklim mikro tanaman.
 * - Sensor Suhu & Kelembapan Udara : DHT22 (GPIO 32)
 * - Sensor Kelembaban Tanah         : Capacitive Soil Moisture v1.2 (GPIO 34 - ADC1)
 * - Aktuator Ventilasi             : Servo SG90 360 Continuous (GPIO 14)
 * - Aktuator Penyiraman            : Pompa Mini via Modul Relay SRD-05VDC (GPIO 33)
 * - Komunikasi                     : WiFi Station Mode (Hotspot HP) + HTTP REST API (JSON & CORS)
 * 
 * Library yang dibutuhkan (Install via Arduino IDE -> Library Manager):
 * 1. "DHT sensor library" by Adafruit (termasuk "Adafruit Unified Sensor")
 * 2. "ESP32Servo" by Kevin Harrington
 * 3. "WebServer" & "WiFi" (bawaan board package ESP32)
 * ======================================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <ESP32Servo.h>

// ======================================================================================
// 1. KONFIGURASI PEMETAAN PIN (GPIO)
// ======================================================================================
#define PIN_DHT          32   // Pin DATA sensor DHT22
#define PIN_SOIL_ADC     34   // Pin AOUT sensor Soil Moisture Kapasitif (ADC1, Input-Only)
#define PIN_SERVO        14   // Pin Sinyal PWM Servo SG90 (Ventilasi)
#define PIN_RELAY_POMPA  33   // Pin IN modul relay SRD-05VDC (Pompa Air)

#define DHTTYPE          DHT22

// ======================================================================================
// 2. KONFIGURASI KREDENSIAL WIFI (HOTSPOT HP)
// ======================================================================================
const char* WIFI_SSID     = "Reonnn";
const char* WIFI_PASSWORD = "kopiireng";

// ======================================================================================
// 3. PENGATURAN PARAMETER LOGIKA & AMBANG BATAS (THRESHOLD)
// ======================================================================================

// Tipe Pemicu Modul Relay SRD-05VDC:
// - Set 'false' jika modul relay Active-HIGH (pompa ON saat GPIO bernilai HIGH / 3.3V)
// - Set 'true' jika modul relay Active-LOW  (pompa ON saat GPIO bernilai LOW / 0V)
const bool RELAY_ACTIVE_LOW = false; 

// Kalibrasi Nilai Mentah ADC Sensor Kapasitif (12-bit: 0 - 4095)
// Logika terbalik: Udara terbuka = ADC tinggi; Dalam air = ADC rendah
const int ADC_KALIBRASI_KERING = 3200; // Nilai saat di udara terbuka (0% kelembaban tanah)
const int ADC_KALIBRASI_BASAH  = 1400; // Nilai saat lempeng tercelup air (100% kelembaban)

// Ambang Batas Suhu & Ventilasi (Kondisi 1 Sesuai Dokumen)
const float THRESHOLD_SUHU_PANAS   = 30.0; // Buka ventilasi jika suhu > 30.0 °C
const float THRESHOLD_SUHU_NORMAL  = 29.0; // Tutup ventilasi jika suhu <= 29.0 °C (Histeresis 1°C)

// Konfigurasi Kontrol untuk Servo 360 Continuous:
const int GERAK_BUKA   = 0;     // Putar ke arah buka (kecepatan penuh)
const int GERAK_TUTUP  = 180;   // Putar ke arah tutup (arah sebaliknya)
const int SERVO_STOP   = 90;    // Nilai titik tengah untuk henti putaran (biasanya 88 - 92)
const int DURASI_PUTAR = 350;   // Lama waktu putar dalam milidetik (sesuai bukaan pintu)

// Ambang Batas Kelembaban Tanah & Penyiraman (Kondisi 2 Sesuai Dokumen)
const int THRESHOLD_ADC_KERING     = 2700; // Pompa ON jika ADC > 2700 (Tanah Kering)
const int THRESHOLD_ADC_LEMBAP     = 2300; // Pompa OFF jika ADC <= 2300 (Tanah Cukup Basah)

// Batas Durasi Penyiraman Maksimal (Safety Timeout) & Jeda Resap Air
// Melindungi tanaman dari kebanjiran dan memberi waktu air meresap ke lempeng sensor
const unsigned long MAKS_DURASI_POMPA = 5000;  // Maksimal menyiram 5000 ms (5 detik)
const unsigned long JEDA_RESAP_TANAH  = 10000; // Jeda 10 detik setelah menyiram sebelum boleh menyiram lagi

// Interval Pembacaan Sensor
const unsigned long INTERVAL_BACA_SENSOR = 2000; // Baca setiap 2000 ms (2 detik)

// ======================================================================================
// 4. INSTANSIASI OBJEK & VARIABEL GLOBAL
// ======================================================================================
WebServer server(80);
DHT dht(PIN_DHT, DHTTYPE);
Servo servoVentilasi;

// Variabel Data Sensor
float suhu = 0.0;
float kelembapanUdara = 0.0;
int adcTanah = 0;
int kelembabanTanahPersen = 0;

// Variabel Status Aktuator
bool statusVentilasi = false; // false = TERTUTUP, true = TERBUKA
bool statusPompa     = false; // false = MATI (OFF), true = MENYALA (ON)

unsigned long waktuMulaiPompa   = 0;
unsigned long waktuSelesaiPompa = 0;
unsigned long waktuTerakhirBaca = 0;

// ======================================================================================
// 5. FUNGSI KENDALI AKTUATOR
// ======================================================================================

// Mengatur status saklar relay pompa dengan memperhitungkan Active-HIGH / Active-LOW
void kontrolPompa(bool nyalakan) {
  if (nyalakan) {
    digitalWrite(PIN_RELAY_POMPA, RELAY_ACTIVE_LOW ? LOW : HIGH);
    statusPompa = true;
  } else {
    digitalWrite(PIN_RELAY_POMPA, RELAY_ACTIVE_LOW ? HIGH : LOW);
    statusPompa = false;
  }
}

// Fungsi bantu untuk menggerakkan servo 360 derajat sebentar lalu berhenti
void gerakkanVentilasi(int arah, int durasiMs) {
  servoVentilasi.attach(PIN_SERVO);
  servoVentilasi.write(arah);
  delay(durasiMs);                  // Putar selama beberapa milidetik
  servoVentilasi.write(SERVO_STOP); // Hentikan putaran
  delay(50);
  servoVentilasi.detach();          // Lepas sinyal PWM agar servo benar-benar diam & tidak mendengung
}

// ======================================================================================
// 6. HANDLER REST API & WEB SERVER
// ======================================================================================

// Mengirim response data sensor dan status aktuator dalam format JSON lengkap dengan CORS
void handleGetSensorData() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");

  // Format JSON persis sesuai spesifikasi Bab 2 Dokumen:
  // {"suhu": 31.2, "kelembapan_udara": 68.5, "kelembaban_tanah": 35, "adc_tanah": 2850, "ventilasi": "TERBUKA", "pompa": "ON"}
  String payload = "{";
  payload += "\"suhu\":" + String(suhu, 1) + ",";
  payload += "\"kelembapan_udara\":" + String(kelembapanUdara, 1) + ",";
  payload += "\"kelembaban_tanah\":" + String(kelembabanTanahPersen) + ",";
  payload += "\"adc_tanah\":" + String(adcTanah) + ",";
  payload += "\"ventilasi\":\"" + String(statusVentilasi ? "TERBUKA" : "TERTUTUP") + "\",";
  payload += "\"pompa\":\"" + String(statusPompa ? "ON" : "OFF") + "\"";
  payload += "}";

  server.send(200, "application/json", payload);
}

// Menangani permintaan Pre-flight OPTIONS dari browser
void handleCORSPreflight() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(204);
}

// Halaman landing sederhana jika IP ESP32 diakses langsung lewat browser
void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Smart Greenhouse ESP32</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{font-family:sans-serif;background:#f0f4f8;padding:20px;text-align:center;}";
  html += ".card{background:#fff;max-width:400px;margin:auto;padding:20px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);}";
  html += "h2{color:#2d3748;}p{font-size:16px;color:#4a5568;margin:8px 0;}";
  html += ".btn{display:inline-block;margin-top:15px;padding:10px 20px;background:#3182ce;color:#fff;text-decoration:none;border-radius:8px;}</style></head><body>";
  html += "<div class='card'><h2>Mini Smart Greenhouse</h2>";
  html += "<p>🌡️ Suhu: <b>" + String(suhu, 1) + " &deg;C</b></p>";
  html += "<p>💧 Kelembapan Udara: <b>" + String(kelembapanUdara, 1) + " %</b></p>";
  html += "<p>🌱 Kelembaban Tanah: <b>" + String(kelembabanTanahPersen) + " %</b> (ADC: " + String(adcTanah) + ")</p>";
  html += "<p>🪟 Ventilasi: <b>" + String(statusVentilasi ? "TERBUKA" : "TERTUTUP") + "</b></p>";
  html += "<p>🚿 Pompa Air: <b>" + String(statusPompa ? "MENYIRAM (ON)" : "STANDBY (OFF)") + "</b></p>";
  html += "<a class='btn' href='/api/data'>Lihat Endpoint JSON (/api/data)</a></div></body></html>";

  server.send(200, "text/html", html);
}

// ======================================================================================
// 7. SETUP PROGRAM
// ======================================================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==================================================");
  Serial.println("  SISTEM SMART GREENHOUSE MINI ESP32 DIMULAI      ");
  Serial.println("==================================================");

  // Inisialisasi Pin Relay Pompa
  pinMode(PIN_RELAY_POMPA, OUTPUT);
  kontrolPompa(false); // Pastikan saklar pompa mati saat baru dinyalakan

  // Inisialisasi Servo 360 Continuous (Posisi Awal STOP)
  ESP32PWM::allocateTimer(0);
  servoVentilasi.setPeriodHertz(50);
  servoVentilasi.attach(PIN_SERVO);
  servoVentilasi.write(SERVO_STOP);
  delay(100);
  servoVentilasi.detach();

  // Inisialisasi Sensor DHT22 & ADC
  dht.begin();
  analogReadResolution(12); // Resolusi 12-bit (Rentang 0 - 4095)

  // Inisialisasi WiFi (Station Mode ke Hotspot HP)
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Menghubungkan ke Hotspot: %s ", WIFI_SSID);

  int wifiRetry = 0;
  while (WiFi.status() != WL_CONNECTED && wifiRetry < 20) {
    delay(500);
    Serial.print(".");
    wifiRetry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Berhasil Terhubung!");
    Serial.print("[WiFi] IP Address ESP32: http://");
    Serial.println(WiFi.localIP());
    Serial.print("[API] Endpoint Data: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/api/data");
  } else {
    Serial.println("\n[WiFi] Gagal terhubung (Timeout).");
    Serial.println("[INFO] Sistem akan tetap beroperasi secara OTONOM tanpa WiFi!");
  }

  // Daftarkan Routing Web Server
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/data", HTTP_GET, handleGetSensorData);
  server.on("/api/data", HTTP_OPTIONS, handleCORSPreflight);
  server.begin();
  Serial.println("[HTTP] REST API Server aktif di port 80.");
  Serial.println("==================================================\n");
}

// ======================================================================================
// 8. LOOP UTAMA (NON-BLOCKING OTONOM)
// ======================================================================================
void loop() {
  // A. Layani permintaan HTTP dari Dashboard React (Non-blocking)
  server.handleClient();

  unsigned long waktuSekarang = millis();

  // B. Siklus Pembacaan Sensor & Evaluasi Logika Otonom (Setiap 2 Detik)
  if (waktuSekarang - waktuTerakhirBaca >= INTERVAL_BACA_SENSOR) {
    waktuTerakhirBaca = waktuSekarang;

    // 1. Membaca Sensor Suhu & Kelembapan Udara (DHT22)
    float bacaSuhu = dht.readTemperature();
    float bacaKelembapanUdara = dht.readHumidity();

    if (!isnan(bacaSuhu) && !isnan(bacaKelembapanUdara)) {
      suhu = bacaSuhu;
      kelembapanUdara = bacaKelembapanUdara;
    } else {
      Serial.println("[PERINGATAN] Gagal membaca data dari sensor DHT22!");
    }

    // 2. Membaca Sensor Kelembaban Tanah Kapasitif
    adcTanah = analogRead(PIN_SOIL_ADC);

    // Konversi nilai ADC mentah ke persentase kelembaban (0 - 100%)
    // Logika terbalik: ADC mendekati ADC_KALIBRASI_BASAH = 100%, ADC mendekati ADC_KALIBRASI_KERING = 0%
    int hitungPersen = map(adcTanah, ADC_KALIBRASI_KERING, ADC_KALIBRASI_BASAH, 0, 100);
    kelembabanTanahPersen = constrain(hitungPersen, 0, 100);

    // 3. Evaluasi Kondisi 1: Suhu & Ventilasi (Servo 360 Continuous)
    if (suhu > THRESHOLD_SUHU_PANAS && !statusVentilasi) {
      Serial.println(">>> [AKSI VENTILASI] Suhu Panas (> 30°C) -> Membuka Katup Ventilasi...");
      gerakkanVentilasi(GERAK_BUKA, DURASI_PUTAR);
      statusVentilasi = true;
    } 
    else if (suhu <= THRESHOLD_SUHU_NORMAL && statusVentilasi) {
      Serial.println(">>> [AKSI VENTILASI] Suhu Normal (<= 29°C) -> Menutup Katup Ventilasi...");
      gerakkanVentilasi(GERAK_TUTUP, DURASI_PUTAR);
      statusVentilasi = false;
    }

    // 4. Evaluasi Kondisi 2: Kelembaban Tanah & Pompa (Relay)
    bool jedaResapSelesai = (waktuSekarang - waktuSelesaiPompa >= JEDA_RESAP_TANAH);
    if (adcTanah > THRESHOLD_ADC_KERING && !statusPompa && jedaResapSelesai) {
      kontrolPompa(true);
      waktuMulaiPompa = waktuSekarang;
      Serial.println("[AKSI PENYIRAMAN] Tanah Kering Terdeteksi -> Pompa Air MENYALA");
    }

    // 5. Cetak Payload Log JSON ke Serial Monitor
    Serial.printf(
      "{\"suhu\":%.1f,\"kelembapan_udara\":%.1f,\"kelembaban_tanah\":%d,\"adc_tanah\":%d,\"ventilasi\":\"%s\",\"pompa\":\"%s\"}\n",
      suhu,
      kelembapanUdara,
      kelembabanTanahPersen,
      adcTanah,
      statusVentilasi ? "TERBUKA" : "TERTUTUP",
      statusPompa ? "ON" : "OFF"
    );
  }

  // C. Evaluasi Pemutus Pompa Air (Histeresis Tanah & Safety Timeout)
  if (statusPompa) {
    bool tanahSudahBasah = (adcTanah <= THRESHOLD_ADC_LEMBAP);
    bool durasiMaksHabis = (waktuSekarang - waktuMulaiPompa >= MAKS_DURASI_POMPA);

    if (tanahSudahBasah || durasiMaksHabis) {
      kontrolPompa(false);
      waktuSelesaiPompa = millis(); // Rekam waktu selesai agar air sempat meresap
      if (tanahSudahBasah) {
        Serial.println("[AKSI PENYIRAMAN] Tanah Sudah Cukup Lembap -> Pompa Air DIMATIKAN");
      } else {
        Serial.println("[AKSI PENYIRAMAN] Batas Maksimal 5 Detik Tercapai (Timeout) -> Pompa Air DIMATIKAN (Jeda resap 10s...)");
      }
    }
  }
}
