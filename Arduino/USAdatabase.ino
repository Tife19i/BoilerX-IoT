#include <WiFi.h>
#include <time.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// WiFi credentials
#define WIFI_SSID "WiFiIDhidden/private" 
#define WIFI_PASSWORD "WiFiPasswordhidden/private" 

// Firebase credentials
#define DATABASE_URL "https://Mydatabasehiddenprivate/"
#define DATABASE_SECRET "mydatabasesecrethiddenprivate" 

// Temperature sensor
#define TEMP_SENSOR_PIN 36  // GPIO36 = ADC1_CH0 = VP

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long previousTempLogMillis = 0;
unsigned long previousRssiLogMillis = 0;

String deviceID; // will store eFuse MAC

// Maintain last 7 RSSI and last 12 Temperature timestamps locally
#define MAX_RSSI_LOGS 5 //8
#define MAX_TEMP_LOGS 5 //12
String rssiTimestamps[MAX_RSSI_LOGS];
int rssiIndex = 0;
String tempTimestamps[MAX_TEMP_LOGS];
int tempIndex = 0;

void setup() {
  Serial.begin(9600);
  delay(1000);

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi connected");
  Serial.print("IP: "); Serial.println(WiFi.localIP());

  // Time sync for timestamps
  configTime(3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("⏳ Waiting for time sync");
  while (time(nullptr) < 100000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" ✅ Time synced!");

  // Firebase setup
  config.database_url = DATABASE_URL;
  config.signer.tokens.legacy_token = DATABASE_SECRET;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // --- Get device IDs ---
  WiFi.mode(WIFI_MODE_STA);
  String mac = WiFi.macAddress();
  uint64_t chipid = ESP.getEfuseMac();
  char efuseBuf[32];
  sprintf(efuseBuf, "%012llX", chipid);
  deviceID = efuseBuf;

  Serial.print("WiFi MAC: "); Serial.println(mac);
  Serial.print("eFuse MAC: "); Serial.println(deviceID);

  // --- Send device info to Firebase ---
  FirebaseJson deviceInfo;
  deviceInfo.set("WiFi_MAC", mac);
  deviceInfo.set("eFuse_MAC", deviceID);
  deviceInfo.set("lastActive", String(time(nullptr))); // timestamp

  String devicePath = "/devices/" + deviceID; // store under eFuse MAC
  if (Firebase.RTDB.setJSON(&fbdo, devicePath.c_str(), &deviceInfo)) {
    Serial.println("✅ Device info sent to Firebase");
  } else {
    Serial.print("❌ Failed to send device info: ");
    Serial.println(fbdo.errorReason());
  }
}

void loop() {
  unsigned long currentMillis = millis();

  // --- RSSI Logging (1 sec) ---
  if (currentMillis - previousRssiLogMillis >= 1000) {
    previousRssiLogMillis = currentMillis;
    int rssi = WiFi.RSSI();
    Serial.print("📶 WiFi RSSI: "); Serial.println(rssi);

    // Timestamp
    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);
    char timestamp[25];
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%d_%H-%M-%S", timeinfo);
    String tsStr = String(timestamp);

    // Push RSSI log
    FirebaseJson rssiLog;
    rssiLog.set("WiFi_RSSI", rssi);
    rssiLog.set("Timestamp", tsStr);

    String rssiPath = "/rssi_logs/" + tsStr;
    Firebase.RTDB.setJSON(&fbdo, rssiPath.c_str(), &rssiLog);

    // Update lastActive
  char lastActiveStr[25];
  strftime(lastActiveStr, sizeof(lastActiveStr), "%Y-%m-%d_%H-%M-%S", localtime(&now));
  Firebase.RTDB.setString(&fbdo, ("/devices/" + deviceID + "/lastActive").c_str(), lastActiveStr);


    // Maintain local FIFO for last 7 logs
    if (rssiIndex < MAX_RSSI_LOGS) {
      rssiTimestamps[rssiIndex++] = tsStr;
    } else {
      String oldPath = "/rssi_logs/" + rssiTimestamps[0];
      Firebase.RTDB.deleteNode(&fbdo, oldPath.c_str());
      for (int i = 1; i < MAX_RSSI_LOGS; i++) rssiTimestamps[i - 1] = rssiTimestamps[i];
      rssiTimestamps[MAX_RSSI_LOGS - 1] = tsStr;
    }
  }

  // --- Temperature Logging (4 sec) ---
  if (currentMillis - previousTempLogMillis >= 1800) {
    previousTempLogMillis = currentMillis;

    int raw = analogRead(TEMP_SENSOR_PIN);
    float voltage = (raw / 4095.0) * 3.3;
    float tempC = voltage * 100.0;
    float tempF = (tempC * 9.0 / 5.0) + 32.0;
    Serial.print("🌡️ Temp: "); Serial.println(tempC);

    // Timestamp
    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);
    char timestamp[25];
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%d_%H-%M-%S", timeinfo);
    String tsStr = String(timestamp);

    // Push Temperature log
    FirebaseJson log;
    log.set("Temperature_C", tempC);
    log.set("Temperature_F", tempF);
    log.set("Timestamp", tsStr);

    String tempPath = "/Tlogs/" + tsStr;
    Firebase.RTDB.setJSON(&fbdo, tempPath.c_str(), &log);

    // Update latest temperature
    Firebase.RTDB.setFloat(&fbdo, "/Temperature_C", tempC);

    // Maintain local FIFO for last 12 logs
    if (tempIndex < MAX_TEMP_LOGS) {
      tempTimestamps[tempIndex++] = tsStr;
    } else {
      String oldPath = "/Tlogs/" + tempTimestamps[0];
      Firebase.RTDB.deleteNode(&fbdo, oldPath.c_str());
      for (int i = 1; i < MAX_TEMP_LOGS; i++) tempTimestamps[i - 1] = tempTimestamps[i];
      tempTimestamps[MAX_TEMP_LOGS - 1] = tsStr;
    }
  }
}
