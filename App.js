import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
  TextInput,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { database, ref, onValue } from "./firebaseConfig";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const OPENWEATHER_API_KEY = "1d3b708e9925761fed68f314687e5637";


export default function App() {
  // --- User profile state ---
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [temperature, setTemperature] = useState(null);
  const [logs, setLogs] = useState([]);
  const [smoothLogs, setSmoothLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(null);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState(null);
  const [forecastTemp, setForecastTemp] = useState(null);
  const [rssi, setRssi] = useState(null);

  const [activeTab, setActiveTab] = useState("Home");

  // **Added for sliding settings panel**
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const settingsSlideAnim = useRef(
    new Animated.Value(Dimensions.get("window").width)
  ).current;
    // --- Load profile from AsyncStorage ---
  const [deviceSerial, setDeviceSerial] = useState("");

  const loadProfile = async () => {
    try {
      const name = await AsyncStorage.getItem("userName");
      const email = await AsyncStorage.getItem("userEmail");
      const serial = await AsyncStorage.getItem("deviceSerial");
      if (name) setUserName(name);
      if (email) setUserEmail(email);
      if (serial) setDeviceSerial(serial);
    } catch (err) {
      console.log("Error loading profile:", err);
    }
  };

  const [settingsText, setSettingsText] = useState(
    `                  🗄️ PCB Overview
    • Central hub connecting sensors, 
      power circuits & comms modules.
    • Handles data collection from all 
      components.
    • Routes signals between sensors, 
      MCU & wireless modules.
    • Designed for stability, efficiency & 
      low noise.

    -----------------------------------------------------------------
    ⚙ Component Boundaries

            Microcontroller (ESP32)
    • Max Voltage: 3.6 V
    • Overvoltage → Regulator burn, chip 
      damage.
    • Temp Limit: ~125 °C → Shutdown/
      failure.

              WiFi Module
    • Safe RSSI: 0 to -70 dBm.
    • Low RSSI → Slow or dropped 
      connection.
    • Overheat >85 °C → Shutdown/
      instability.

    Temp & Humidity Sensor (LM35)
    • Temp Range: -40 °C to 80 °C.
    • Condensation → Corrosion/shorts.

    Power Supply / Voltage Regulator
    • Input: 5v →12v (example).
    • Overvoltage → Overheat, burnt 
      traces.
    • Undervoltage → Reset, crash, bad 
      data.

    -----------------------------------------------------------------
                  📊 App UI Guide
    • Temp (°C/°F) live from device.
    • Internet status, time & date.
    • Graph of live & logged temp.
    • Weather today & forecast.
    • WiFi RSSI:
      0 to -50 dBm 🟢 Excellent
      -51 to -70 dBm 🟡 Good
      -71 to -85 dBm 🟠 Weak
      < -85 dBm 🔴 Poor`
  );

  const smoothData = (oldData, newData) => {
    if (!oldData.length) return newData;
    return oldData.map((oldVal, i) => {
      const target = newData[i] ?? oldVal;
      return oldVal + (target - oldVal) * 0.2;
    });
  };

  useEffect(() => {
    const tempRef = ref(database, "/Temperature_C");
    onValue(tempRef, (snapshot) => setTemperature(snapshot.val()));

    const logsRef = ref(database, "/Tlogs");
    onValue(logsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const values = Object.values(data)
        .map((log) => {
          if (typeof log.Temperature_C === "number") {
            return log.Temperature_C;
          }
          return NaN;
        })
        .filter((v) => !Number.isNaN(v));
      const recentValues = values.slice(-10); // last 10 logs
      setLogs(recentValues);
      setSmoothLogs((prev) => smoothData(prev, recentValues));
    });


    const rssiRef = ref(database, "/rssi_logs");
    onValue(rssiRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const keys = Object.keys(data);
        const latestKey = keys[keys.length - 1];
        const latestRssiLog = data[latestKey];
        if (latestRssiLog && typeof latestRssiLog.WiFi_RSSI === "number") {
          setRssi(latestRssiLog.WiFi_RSSI);
        }
      }
    });

    const unsubscribe = NetInfo.addEventListener((state) =>
      setIsConnected(state.isConnected)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    (async () => {
      if (!OPENWEATHER_API_KEY) {
        setWeatherError("No OpenWeather API key set.");
        setLoadingWeather(false);
        return;
      }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setWeatherError("Location permission denied.");
          setLoadingWeather(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        await fetchWeather(loc.coords.latitude, loc.coords.longitude);
        await fetchForecast(loc.coords.latitude, loc.coords.longitude);
      } catch (err) {
        setWeatherError("Failed to get weather: " + err.message);
        setLoadingWeather(false);
      }
    })();
  }, []);

  // **Animate settings sliding panel when toggled**
  useEffect(() => {
    if (showSettingsPanel) {
      Animated.timing(settingsSlideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(settingsSlideAnim, {
        toValue: Dimensions.get("window").width,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [showSettingsPanel]);
  useEffect(() => {
    if (activeTab === "Profile") {
      loadProfile();
    }
  }, [activeTab]);

  const fetchWeather = async (lat, lon) => {
    setLoadingWeather(true);
    setWeatherError(null);
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`OpenWeather error: ${res.status} ${txt}`);
      }
      const data = await res.json();
      setWeather({
        temp: data.main?.temp ?? null,
        description: data.weather?.[0]?.description || "",
        main: data.weather?.[0]?.main || "Clear",
        sunrise: data.sys?.sunrise,
        sunset: data.sys?.sunset,
      });
    } catch (err) {
      setWeatherError(err.message);
    } finally {
      setLoadingWeather(false);
    }
  };

  const fetchForecast = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
      );
      if (!res.ok) {
        throw new Error(`Forecast fetch error ${res.status}`);
      }
      const data = await res.json();
      if (data.list && data.list.length > 8) {
        setForecastTemp(data.list[8].main.temp);
      } else {
        setForecastTemp(null);
      }
    } catch {
      setForecastTemp(null);
    }
  };

  const tempFahrenheit =
    temperature !== null ? (temperature * 9) / 5 + 32 : null;

  const formattedDate = currentDateTime.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const formattedTime = currentDateTime.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const wifiIconName = isConnected ? "wifi-arrow-up-down" : "wifi-off";
  const wifiIconColor = isConnected ? "#4CAF50" : "#F44336";

  const getWeatherIconName = (main, isDay) => {
    const m = (main || "").toLowerCase();
    if (m.includes("clear")) return isDay ? "weather-sunny" : "weather-night";
    if (m.includes("cloud")) return "weather-cloudy";
    if (m.includes("rain")) return "weather-rainy";
    if (m.includes("drizzle")) return "weather-partly-rainy";
    if (m.includes("thunder")) return "weather-lightning";
    if (m.includes("snow")) return "weather-snowy";
    return "weather-partly-cloudy";
  };

  const getTimeOfDayLabel = (sunriseUnix, sunsetUnix) => {
    if (!sunriseUnix || !sunsetUnix) return "Day";
    const nowUnix = Math.floor(Date.now() / 1000);
    const dawnStart = sunriseUnix - 1800;
    const duskEnd = sunsetUnix + 1800;
    if (nowUnix >= dawnStart && nowUnix < sunriseUnix) return "Dawn";
    if (nowUnix >= sunriseUnix && nowUnix < sunsetUnix) return "Daytime";
    if (nowUnix >= sunsetUnix && nowUnix < duskEnd) return "Dusk";
    return "Night";
  };

  const getRssiQuality = (rssiValue) => {
    if (rssiValue >= -50) return { label: "Excellent", color: "#4caf50" };
    if (rssiValue >= -60) return { label: "Good", color: "#8bc34a" };
    if (rssiValue >= -70) return { label: "Fair", color: "#ffc107" };
    if (rssiValue >= -80) return { label: "Sufficient", color: "#ff5722" };
    return { label: " Poor", color: "#f44336" };
  };

  const chartWidth = Dimensions.get("window").width - 30;

  const handleTabPress = (tabName) => {
    setActiveTab(tabName);
    if (tabName === "Settings") {
      setShowSettingsPanel(true);
    } else {
      setShowSettingsPanel(false);
    }
  };

  return (
    <>
      {activeTab === "Profile" ? (
        <View
          style={{
            flex: 1,
            backgroundColor: "#bcc0ceff", // light turquoise, or "#f0f0f0" for grey
            justifyContent: "flex-start",
            alignItems: "center",
            paddingTop: 60,
          }}
        >
          {/* Profile Title */}
          <Text
            style={{
              fontSize: 28,
              fontWeight: "600",
              color: "#ffffffff",
              marginBottom: 20,
            }}
          >
            User Profile
          </Text>

          {/* Name Card */}
          <View
            style={{
              width: "90%",
              backgroundColor: "#fff",
              padding: 17,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Icon name="account" size={28} color="#4CAF50" style={{ marginRight: 15 }} />
            <View>
              <Text style={{ fontSize: 18, fontWeight: "600", color: "#000" }}>Name</Text>
              <Text style={{ fontSize: 16, color: "#333" }}>{userName || "Not set"}</Text>
            </View>
          </View>

          {/* Email Card */}
          <View
            style={{
              width: "90%",
              backgroundColor: "#fff",
              padding: 17,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Icon name="email" size={28} color="#4CAF50" style={{ marginRight: 15 }} />
            <View>
              <Text style={{ fontSize: 18, fontWeight: "600", color: "#000" }}>Email</Text>
              <Text style={{ fontSize: 16, color: "#333" }}>{userEmail || "Not set"}</Text>
            </View>
          </View>

          {/* Serial Card */}
          <View
            style={{
              width: "90%",
              backgroundColor: "#fff",
              padding: 17,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Icon name="chip" size={28} color="#4CAF50" style={{ marginRight: 15 }} />
            <View>
              <Text style={{ fontSize: 18, fontWeight: "600", color: "#000" }}>
                Device Serial
              </Text>
              <Text style={{ fontSize: 16, color: "#333" }}>
                {deviceSerial || "Not set"}
              </Text>
            </View>
          </View>
          </View>
          ) : (

        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          <View style={{ marginTop: 40 }}>
            <View style={styles.headerContainer}>
              <View style={styles.line} />
              <Text style={styles.title}>Dashboard</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.statusRow}>
              <View style={styles.deviceTempBox}>
                <Text style={styles.deviceTempText}>Device Temp</Text>
                <View style={styles.deviceTempRow}>
                  <Icon
                    name="chip"
                    size={24}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.temp}>
                    {temperature !== null && tempFahrenheit !== null
                      ? `${temperature.toFixed(1)} °C / ${tempFahrenheit.toFixed(1)} °F`
                      : "Loading..."}
                  </Text>
                </View>
              </View>
              <View style={styles.internetStatus}>
                <Icon name={wifiIconName} size={20} color={wifiIconColor} />
                <View style={styles.dateTimeContainer}>
                  <Text style={styles.dateText}>{formattedDate}</Text>
                  <Text style={styles.timeText}>{formattedTime}</Text>
                </View>
              </View>
            </View>

            {smoothLogs.length > 0 && (
              <LineChart
                data={{
                  labels: smoothLogs.map((_, i) => `${i + 1}`),
                  datasets: [{ data: smoothLogs }],
                }}
                width={chartWidth}
                height={230}
                yAxisSuffix="°C"
                fromZero
                segments={9}
                chartConfig={{
                  backgroundGradientFrom: "#071022",
                  backgroundGradientTo: "#2b2e2e",
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(255, 170, 132, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  propsForDots: { r: "3", strokeWidth: "1", stroke: "white", fill: "navy" },
                }}
                bezier
                style={{ marginVertical: 4, borderRadius: 10 }}
                yAxisMin={0}
                yAxisMax={16}
              />
            )}

            <View style={styles.weatherFullBubble}>
              {loadingWeather ? (
                <ActivityIndicator color="#fff" />
              ) : weather ? (
                <>
                  <View style={styles.weatherColumn}>
                    <Icon
                      name={getWeatherIconName(weather.main, true)}
                      size={28}
                      color="#ffffffff"
                      style={{ marginBottom: 2 }}
                    />
                    <Text style={styles.weatherTemp}>
                      {weather.temp !== null ? `${Math.round(weather.temp)}°C` : "--"}
                    </Text>
                    <Text style={styles.weatherDesc}>{weather.description}</Text>
                    <Text style={styles.weatherTimeSmall}>
                      {getTimeOfDayLabel(weather.sunrise, weather.sunset)}
                    </Text>
                  </View>
                  <View style={styles.weatherColumn}>
                    <Icon
                      name="weather-sunny"
                      size={32}
                      color="#ffffffff"
                      style={{ marginBottom: 4 }}
                    />
                    <Text style={styles.weatherTemp}>
                      {forecastTemp !== null ? `${Math.round(forecastTemp)}°C` : "--"}
                    </Text>
                    <Text style={styles.weatherSmall}>Forecast</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.weatherUnavailable}>
                  {weatherError || "Weather unavailable"}
                </Text>
              )}
            </View>

            {rssi !== null && (
              <View style={styles.rssiContainer}>
                <Text style={styles.rssiLabel}>WiFi Integrity RSSI: {rssi} dBm</Text>
                <View style={styles.rssiScale}>
                  {[-90, -80, -70, -60, -50, -40].map((level, idx, arr) => {
                    const { color } = getRssiQuality(level);
                    const nextLevel = arr[idx + 1] || -40;
                    const isActive = rssi >= level && rssi < nextLevel;
                    return (
                      <View
                        key={level}
                        style={[styles.rssiSegment, { backgroundColor: color }, isActive && styles.rssiSegmentActive]}
                      />
                    );
                  })}
                </View>
                <Text style={[styles.rssiQualityLabel, { color: getRssiQuality(rssi).color }]}>
                  {getRssiQuality(rssi).label}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Sliding Settings Panel */}
      <Animated.View
        style={[
          styles.slidingPanel,
          {
            transform: [{ translateX: settingsSlideAnim }],
            zIndex: showSettingsPanel ? 10 : -1,
          },
        ]}
      >
        <View style={styles.panelContent}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Menu Datasheet</Text>
            <TouchableOpacity onPress={() => setShowSettingsPanel(false)}>
              <Icon name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }}>
            <TextInput
              style={styles.settingsTextInput}
              multiline
              value={settingsText}
              editable={false}
              placeholderTextColor="#ccc"
            />
          </ScrollView>
        </View>
      </Animated.View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navButton} onPress={() => handleTabPress("Profile")}>
          <Icon name="account" size={28} color={activeTab === "Profile" ? "#4CAF50" : "#888"} />
          <Text style={[styles.navLabel, activeTab === "Profile" && styles.navLabelActive]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => handleTabPress("Home")}>
          <Icon name="home" size={28} color={activeTab === "Home" ? "#4CAF50" : "#888"} />
          <Text style={[styles.navLabel, activeTab === "Home" && styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => handleTabPress("Settings")}>
          <Icon name="menu" size={28} color={activeTab === "Settings" ? "#4CAF50" : "#888"} />
          <Text style={[styles.navLabel, activeTab === "Settings" && styles.navLabelActive]}>Menu</Text>
        </TouchableOpacity>
      </View>
    </>
  );
  }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#2b2e2e", padding: 15 },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#fff",
    marginHorizontal: 3,
    opacity: 0.25,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },

  deviceTempBox: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(13, 28, 58, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(45, 36, 36, 0.05)",
    minWidth: 120,
  },
  deviceTempText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 2,
  },
  deviceTempRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  temp: { fontSize: 19, fontWeight: "700", color: "#fff" },
  internetStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dateTimeContainer: { marginLeft: 8 },
  dateText: { color: "#dfeaf6", fontWeight: "600", fontSize: 12 },
  timeText: { color: "#b4c1ccff", fontWeight: "700", fontSize: 12 },

  weatherTemp: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffffff",
    textShadowRadius: 3,
  },
  weatherSmall: { fontWeight: "700", fontSize: 12, color: "#ddd" },
  weatherDesc: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff7f7ff",
  },
  weatherTimeSmall: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffffff",
    marginTop: 4,
    opacity: 0.6,
  },

  weatherFullBubble: {
    marginTop: 6,
    flexDirection: "row",
    backgroundColor: "rgba(111, 45, 203, 0.08)",
    borderRadius: 12,
    padding: 2,
    justifyContent: "space-around",
    alignItems: "center",
  },
  weatherColumn: { alignItems: "center" },
  weatherUnavailable: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // RSSI scale styles
  rssiContainer: {
    marginTop: 12,
    alignItems: "center",
  },
  rssiLabel: {
    color: "#fff",
    fontWeight: "700",
    marginBottom: 6,
  },
  rssiScale: {
    flexDirection: "row",
    width: "95%",
    height: 18,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "#444",
  },
  rssiSegment: {
    flex: 1,
    opacity: 0.5,
  },
  rssiSegmentActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: "#fff",
  },
  rssiQualityLabel: {
    marginTop: 6,
    fontWeight: "700",
    fontSize: 14,
  },

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#1d1f22",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopColor: "#2a2a2a",
    borderTopWidth: 1,
  },
  navButton: { alignItems: "center" },
  navLabel: {
    color: "#888",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  navLabelActive: { color: "#4caf50", fontWeight: "700" },

  // **Settings sliding panel styles**
  slidingPanel: {
    position: "absolute",
    top: 0,
    bottom: 60, // leave space for bottom nav
    right: 0,
    width: "80%",
    backgroundColor: "#222",
    padding: 15,
    borderLeftWidth: 1,
    borderColor: "#333",
  },
  panelContent: { flex: 1 },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "right",
    marginBottom: 10,
    marginTop: 15,
  },
  panelTitle: { fontSize: 20, fontWeight: "700", color: "#fff", marginLeft: 65, },
  settingsTextInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: 6,
    padding: 10,
    textAlignVertical: "top",
    minHeight: 200,
  },
});
