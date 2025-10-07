// Intro.js
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { database, ref, set } from "./firebaseConfig";

export default function Intro() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [serial, setSerial] = useState("");

  const handleContinue = async () => {
    if (!name || !email || !serial) {
      alert("Please enter name, email, and device serial");
      return;
    }

    // Check if serial is exactly 12 characters
    if (serial.length !== 12) {
      alert("Device serial must be exactly 12 characters long.");
      return;
    }

    try {
      // Save locally
      await AsyncStorage.setItem("userName", name);
      await AsyncStorage.setItem("userEmail", email);
      await AsyncStorage.setItem("deviceSerial", serial);

      // Log serial in Firebase (no check)
      const deviceRef = ref(database, `devices/${serial}`);
      await set(deviceRef, {
        name,
        email,
        registeredAt: Date.now(),
      });

      // Notify App.js
      setIsLoggedIn(true);
      console.log("Registered serial:", serial);

    } catch (err) {
      console.error("Error saving data:", err);
      alert("Failed to save user info. Try again.");
    }
  };



  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>Please register to continue</Text>

      <TextInput
        style={styles.input}
        placeholder="Your Name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Your Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Device Serial"
        value={serial}
        onChangeText={setSerial}
      />
      <TouchableOpacity style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    color: "#666",
  },
  input: {
    width: "100%",
    padding: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007BFF",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
