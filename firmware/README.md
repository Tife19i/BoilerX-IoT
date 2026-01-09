* Firmware

This folder contains the Arduino firmware for the BoilerX-IoT project. The firmware is designed to read temperature data from the LM35 and LM335 sensors, process it, and upload it to Firebase. It also logs WiFi RSSI and other relevant data.

 Key Features
- **Sensor Integration**: Reads data from both LM35 and LM335 temperature sensors.
- **Firebase Communication**: Uploads temperature and RSSI data to Firebase Realtime Database.
- **Data Logging**: Maintains local logs of temperature and WiFi signal strength.

 File: `boilerx.ino`
- **Purpose**: Main code for sensor readings and data upload.
- **Functionality**: Handles ADC readings, converts sensor data, and pushes updates to Firebase.

 Usage
- Upload the `boilerx.ino` to your ESP32 board.
- Ensure the correct wiring of the sensors and WiFi credentials are set.

For more details you can see the comments in the code and the additional scripts in this folder.

