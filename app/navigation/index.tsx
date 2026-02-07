import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, View } from "react-native";

import Navigation, { TabKey } from "../../components/Navigation";
import ChatScreen from "../chat";
import ContactScreen from "../contacts";
import InventoryScreen from "../inventory";
import MapScreen from "../map";
import OrganizationScreen from "../organization";
// Import screens dynamically to avoid circular dependencies
const Home = require("../home").default;
const BookingsScreen = require("../bookings").default;


type UserType = "gainer" | "donor" | "organization";

export default function NavigationScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [userType, setUserType] = useState<UserType>("donor");

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const parsed = JSON.parse(userData);
        setUserType(parsed.role || "donor");
      }
    } catch (error) {
      console.log("Error loading user data:", error);
    }
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
  };

  const renderScreen = () => {
    switch (activeTab) {
      case "home":
        return <Home />;
      case "organization":
        return <OrganizationScreen hideNavigation />;
      case "chat":
        return <ChatScreen hideNavigation />;
      case "contact":
        return <ContactScreen hideNavigation />;
      case "map":
        return <MapScreen hideNavigation />;
      case "inventory":
        return <InventoryScreen />;
      case "bookings":
        return <BookingsScreen />;

      default:
        return <Home />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#D11B31" />
      <View style={styles.content}>
        {renderScreen()}
        <Navigation
          userType={userType}
          initialTab={activeTab}
          onTabChange={handleTabChange}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
});
