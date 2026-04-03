import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { moderateScale, scale, verticalScale } from "../utils/responsive";
// Defensive import for react-native-view-shot to prevent crashes when native module is missing
let captureRef: any = null;
try {
  captureRef = require("react-native-view-shot").captureRef;
} catch (e) {
  captureRef = async () => {
    console.warn("RNViewShot not found. Capture functionality disabled.");
    throw new Error(
      "Capture functionality is not available in this environment.",
    );
  };
}

const { width } = Dimensions.get("window");

interface BannerCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onBannerCreated: (uri: string) => void;
  defaultTitle?: string;
}

const templates = [
  {
    id: "1",
    name: "Template 1",
    source: require("../assets/images/camp1.png"),
  },
  {
    id: "2",
    name: "Template 2",
    source: require("../assets/images/camp2.png"),
  },
  {
    id: "3",
    name: "Template 3",
    source: require("../assets/images/camp3.png"),
  },
  {
    id: "4",
    name: "Template 4",
    source: require("../assets/images/camp4.png"),
  },
];

export default function BannerCreationModal({
  visible,
  onClose,
  onBannerCreated,
  defaultTitle = "Annual Blood Drive",
}: BannerCreationModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [bannerText, setBannerText] = useState(defaultTitle);
  const [isCapturing, setIsCapturing] = useState(false);
  const viewShotRef = useRef<View>(null);

  const handleCapture = async () => {
    if (!viewShotRef.current) return;

    setIsCapturing(true);
    try {
      const uri = await captureRef(viewShotRef.current, {
        format: "jpg",
        quality: 0.9,
      });
      console.log("Banner captured:", uri);
      onBannerCreated(uri);
      onClose();
    } catch (error) {
      console.log("Failed to capture banner:", error);
      Alert.alert("Error", "Failed to generate banner. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Custom Banner</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <Text style={styles.sectionTitle}>1. Preview</Text>

            {/* Capture Area */}
            <View
              collapsable={false}
              ref={viewShotRef}
              style={styles.previewContainer}
            >
              <Image
                source={selectedTemplate.source}
                style={styles.previewImage}
              />
              <View style={styles.textOverlay}>
                <Text style={styles.bannerMainText} numberOfLines={2}>
                  {bannerText || "Your Campaign Title"}
                </Text>
                <Text style={styles.bannerSubText}>Join us and Save Lives</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>2. Edit Text</Text>
            <TextInput
              style={styles.textInput}
              value={bannerText}
              onChangeText={setBannerText}
              placeholder="Enter banner text..."
              maxLength={50}
            />

            <Text style={styles.sectionTitle}>3. Choose Template</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templatesHorizontalScroll}
            >
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateItem,
                    selectedTemplate.id === template.id &&
                      styles.selectedTemplate,
                  ]}
                  onPress={() => setSelectedTemplate(template)}
                >
                  <View style={styles.templateThumbFrame}>
                    <Image
                      source={template.source}
                      style={styles.templateThumb}
                    />
                  </View>
                  <Text style={styles.templateName}>{template.name}</Text>
                  {selectedTemplate.id === template.id && (
                    <View style={styles.checkBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#D11B31"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                isCapturing && styles.disabledButton,
              ]}
              onPress={handleCapture}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <Text style={styles.confirmButtonText}>Generating...</Text>
              ) : (
                <Text style={styles.confirmButtonText}>Use This Banner</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    height: "85%",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#000",
  },
  content: {
    padding: scale(20),
  },
  sectionTitle: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: "#666",
    marginBottom: verticalScale(10),
    marginTop: verticalScale(10),
  },
  previewContainer: {
    width: "100%",
    height: verticalScale(200),
    borderRadius: moderateScale(12),
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    position: "relative",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  textOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: scale(20),
  },
  bannerMainText: {
    color: "#FFF",
    fontSize: moderateScale(24),
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    marginBottom: verticalScale(4),
  },
  bannerSubText: {
    color: "#FFF",
    fontSize: moderateScale(14),
    fontWeight: "500",
    opacity: 0.9,
  },
  textInput: {
    backgroundColor: "#F3F4F6",
    borderRadius: moderateScale(12),
    padding: scale(15),
    fontSize: moderateScale(16),
    color: "#000",
    borderWidth: 1,
    borderColor: "#DDD",
  },
  templatesHorizontalScroll: {
    paddingHorizontal: scale(20),
    gap: scale(16),
    marginTop: verticalScale(10),
  },
  templateItem: {
    width: width * 0.62,
    borderRadius: moderateScale(12),
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#F9FAFB",
    padding: scale(4),
  },
  selectedTemplate: {
    borderColor: "#D11B31",
  },
  templateThumbFrame: {
    width: "100%",
    height: verticalScale(120),
    borderRadius: moderateScale(8),
    backgroundColor: "#EEF2F7",
    overflow: "hidden",
  },
  templateThumb: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  templateName: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginTop: verticalScale(8),
    marginBottom: verticalScale(4),
  },
  checkBadge: {
    position: "absolute",
    top: scale(6),
    right: scale(6),
    backgroundColor: "#FFF",
    borderRadius: 10,
  },
  footer: {
    padding: scale(20),
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  confirmButton: {
    backgroundColor: "#D11B31",
    paddingVertical: verticalScale(15),
    borderRadius: moderateScale(12),
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#FCA5A5",
  },
  confirmButtonText: {
    color: "#FFF",
    fontSize: moderateScale(16),
    fontWeight: "700",
  },
});
