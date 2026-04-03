import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    CameraView,
    scanFromURLAsync,
    useCameraPermissions,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { API_ENDPOINTS } from "../../config/api";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

const BLOOD_TYPE_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function CampaignScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBloodTypeModal, setShowBloodTypeModal] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [bloodType, setBloodType] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    const userData = await AsyncStorage.getItem("userData");
    if (userData) {
      const parsed = JSON.parse(userData);
      setUserRole(parsed.role?.toLowerCase());
      const normalizedBloodType = String(parsed.bloodType || "").toUpperCase();
      if (BLOOD_TYPE_OPTIONS.includes(normalizedBloodType)) {
        setBloodType(normalizedBloodType);
      }
    }
  };

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const parsedData = JSON.parse(data);
      if (parsedData.type !== "CAMPAIGN_ATTENDANCE") {
        Alert.alert(
          "Invalid QR",
          "This QR code is not valid for blood buddy camp attendance.",
        );
        setScanned(false);
        return;
      }

      setScannedData(parsedData);

      // For donors, if we have their blood type, submit automatically
      if (userRole === "donor" && bloodType) {
        // Short timeout to let the user see it scanned
        setTimeout(() => {
          submitAttendanceLocal(parsedData.campaignId, bloodType);
        }, 500);
      } else {
        setShowBloodTypeModal(true);
      }
    } catch (e) {
      Alert.alert("Error", "Could not parse QR code data.");
      setScanned(false);
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "We need access to your photo library to pick an image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        try {
          const scannedResults = await scanFromURLAsync(result.assets[0].uri, [
            "qr",
          ]);
          if (scannedResults && scannedResults.length > 0) {
            handleBarCodeScanned({ data: scannedResults[0].data });
          } else {
            Alert.alert(
              "No QR Code",
              "We couldn't detect a QR code in the selected image.",
              [{ text: "OK", onPress: () => setScanned(false) }],
            );
          }
        } catch (error) {
          Alert.alert(
            "Scan Error",
            "Something went wrong while scanning the image.",
          );
          setScanned(false);
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.log("Error picking image:", error);
      setScanned(false);
    }
  };

  const submitAttendanceLocal = async (
    campId: string | number,
    bType: string,
  ) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(API_ENDPOINTS.RECORD_ATTENDANCE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignId: campId,
          bloodType: bType,
          units: 1,
        }),
      });

      const resData = await response.json();
      if (response.ok) {
        Alert.alert(
          "Success",
          "Attendance recorded successfully! Inventory updated.",
          [{ text: "OK", onPress: () => router.push("/campaign") }],
        );
      } else {
        Alert.alert("Error", resData.message || "Failed to record attendance");
        setScanned(false);
      }
    } catch (error) {
      Alert.alert("Error", "Network request failed");
      setScanned(false);
    } finally {
      setLoading(false);
      setShowBloodTypeModal(false);
    }
  };

  const submitAttendance = async () => {
    if (!bloodType) {
      Alert.alert("Required", "Please select blood type");
      return;
    }
    await submitAttendanceLocal(scannedData.campaignId, bloodType);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Camp QR</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={pickImage} style={styles.uploadButton}>
          <Ionicons name="image-outline" size={24} color="#D11B31" />
        </TouchableOpacity>
      </View>

      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={styles.scanner}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.unfocusedContainer}></View>
          <View style={styles.middleContainer}>
            <View style={styles.unfocusedSide}></View>
            <View style={styles.focusedContainer}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.unfocusedSide}></View>
          </View>
          <View style={styles.unfocusedContainer}>
            <Text style={styles.scanText}>
              Position the QR code within the frame
            </Text>
          </View>
        </View>
      </CameraView>

      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
          <ActivityIndicator size="large" color="#D11B31" />
        </View>
      )}

      <Modal
        visible={showBloodTypeModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Donation</Text>
            <Text style={styles.modalSubtitle}>
              Campaign: {scannedData?.title}
            </Text>

            <Text style={styles.label}>Blood Type</Text>
            <View style={styles.bloodTypeOptionsGrid}>
              {BLOOD_TYPE_OPTIONS.map((type) => {
                const isSelected = bloodType === type;

                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.bloodTypeOption,
                      isSelected && styles.bloodTypeOptionSelected,
                    ]}
                    onPress={() => setBloodType(type)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.bloodTypeOptionText,
                        isSelected && styles.bloodTypeOptionTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowBloodTypeModal(false);
                  setScanned(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={submitAttendance}
                disabled={loading}
              >
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(60),
    paddingBottom: verticalScale(16),
    backgroundColor: "#FFF",
    zIndex: 10,
  },
  backButton: {
    marginRight: scale(16),
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#111827",
  },
  uploadButton: {
    padding: scale(4),
  },
  scanner: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  message: {
    textAlign: "center",
    color: "#FFF",
    padding: 20,
  },
  permissionButton: {
    backgroundColor: "#D11B31",
    padding: 15,
    borderRadius: 10,
    alignSelf: "center",
  },
  permissionButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  unfocusedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  middleContainer: {
    flexDirection: "row",
    height: scale(250),
  },
  unfocusedSide: {
    flex: 1,
  },
  focusedContainer: {
    width: scale(250),
    height: scale(250),
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#D11B31",
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanText: {
    color: "#FFF",
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  loadingOverlay: {
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: scale(24),
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: moderateScale(24),
    padding: scale(24),
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: "#111827",
    marginBottom: verticalScale(8),
  },
  modalSubtitle: {
    fontSize: moderateScale(14),
    color: "#6B7280",
    marginBottom: verticalScale(20),
  },
  label: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: "#374151",
    marginBottom: verticalScale(6),
  },
  bloodTypeOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(10),
    marginBottom: verticalScale(24),
  },
  bloodTypeOption: {
    minWidth: scale(60),
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
    alignItems: "center",
    justifyContent: "center",
  },
  bloodTypeOptionSelected: {
    backgroundColor: "#FEE2E2",
    borderColor: "#D11B31",
  },
  bloodTypeOptionText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#4B5563",
  },
  bloodTypeOptionTextSelected: {
    color: "#D11B31",
  },
  modalActions: {
    flexDirection: "row",
    gap: scale(12),
  },
  modalBtn: {
    flex: 1,
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(12),
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#F3F4F6",
  },
  confirmBtn: {
    backgroundColor: "#D11B31",
  },
  cancelBtnText: {
    color: "#4B5563",
    fontWeight: "700",
  },
  confirmBtnText: {
    color: "#FFF",
    fontWeight: "700",
  },
});
