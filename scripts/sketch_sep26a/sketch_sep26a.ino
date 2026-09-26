#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "EmonLib.h"

const char* ssid = "low2.4G.101pro_VKYZ";
const char* password = "YZNTLMMZ";

const char* serverUrl = "http://54.172.88.178:8000/api/telemetry/ingest";

const char* authToken = "optigrid-hw-63c8f039";

const char* buildingId = "4bd4a998-3ef9-476f-80af-7568a4b6cbf0";
const char* sensorId = "2bbac30a-d9af-40b1-a31c-cc4bbd31a758";
const float nominalVoltage = 230.0;
EnergyMonitor emon1;
const int sensorPin = 34; 

void setup() {
  Serial.begin(115200);
  
  emon1.current(sensorPin, 60.6);
  
  Serial.println("OptiGrid Sensor Initializing...");

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi network");
}

void loop() {
  double Irms = emon1.calcIrms(1480);
  
  float powerKW = (Irms * nominalVoltage) / 1000.0;
  
  Serial.print("Current Draw: ");
  Serial.print(Irms);
  Serial.print(" A, Power: ");
  Serial.print(powerKW);
  Serial.println(" kW");

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    
    http.addHeader("Content-Type", "application/json");
    if (strlen(authToken) > 0) {
      String authHeader = "Bearer ";
      authHeader += authToken;
      http.addHeader("Authorization", authHeader);
    }
    
    StaticJsonDocument<256> doc;
    doc["building_id"] = buildingId;
    doc["sensor_id"] = sensorId;
    doc["source_type"] = "PHYSICAL";
    doc["voltage_v"] = nominalVoltage;
    doc["current_a"] = Irms;
    doc["power_kw"] = powerKW;

    String requestBody;
    serializeJson(doc, requestBody);
  
    int httpResponseCode = http.POST(requestBody);
    
    if (httpResponseCode > 0) {
      Serial.print("HTTP Response code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("HTTP POST Error code: ");
      Serial.println(httpResponseCode);
      Serial.println(http.errorToString(httpResponseCode).c_str());
    }
    
    http.end();
  } else {
    Serial.println("WiFi Disconnected. Reconnecting...");
    WiFi.disconnect();
    WiFi.reconnect();
  }
  
  delay(2000);
}