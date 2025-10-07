// index.js
import React, { useEffect, useState } from "react";
import { registerRootComponent } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Intro from "./Intro";
import App from "./App";

const Stack = createNativeStackNavigator();

function Main() {
  const [isRegistered, setIsRegistered] = useState(null);

  useEffect(() => {
    (async () => {
      const name = await AsyncStorage.getItem("userName");
      const email = await AsyncStorage.getItem("userEmail");
      const serial = await AsyncStorage.getItem("deviceSerial");
      setIsRegistered(!!(name && email && serial));
    })();
  }, []);


  if (isRegistered === null) return null; // Loading state

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isRegistered ? (
          <Stack.Screen name="MainApp" component={App} />
        ) : (
          <Stack.Screen name="Intro" component={Intro} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

registerRootComponent(Main);
