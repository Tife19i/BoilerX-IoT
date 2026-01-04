/* Written by Boluwatife Olasupo
 * Temperature Reading with External LED Control
 * 2025 Project
 */

const int LEDPin = 2;        // D2 for external LED (GPIO2)
const int TEMP_SENSOR_PIN = 32; // GPIO32 for LM35

void setup() {
  Serial.begin(9600);             // Serial Monitor start
  pinMode(LEDPin, OUTPUT);        // Set LED pin as output
}

void loop() {
  int sampleValue = analogRead(TEMP_SENSOR_PIN);     // Read LM35 analog voltage
  float voltage = (sampleValue / 4095.0) * 3.3;       // Convert to voltage
  float temperatureC = voltage * 100.0;               // Convert to °C (10mV/°C)
  float temperatureF = CelsiusToFahrenheit(temperatureC); // To °F

  // Print values to Serial
  Serial.print("Voltage: ");
  Serial.print(voltage, 2);
  Serial.print(" V    | Temperature: ");
  Serial.print(temperatureC, 2);
  Serial.print(" °C\t");
  Serial.print(temperatureF, 2);
  Serial.println(" °F");

  // Optional: Turn on LED if temp > 30°C
  if (temperatureC > 30.0) {
    digitalWrite(LEDPin, HIGH);
  } else {
    digitalWrite(LEDPin, LOW);
  }

  delay(2000);  // Wait 2 seconds before next read
}

// Must be outside loop()
float CelsiusToFahrenheit(float tempC) {
  return (tempC * 9.0 / 5.0) + 32.0;
}
