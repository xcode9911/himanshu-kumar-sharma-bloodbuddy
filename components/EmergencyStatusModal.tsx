import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import DonationIcon from "../assets/images/donation.svg";
import { moderateScale, scale, verticalScale } from "../utils/responsive";

interface EmergencyStatusModalProps {
  visible: boolean;
  onClose: () => void;
  role: "gainer" | "donor";
  activeEmergency?: any;
  incomingEmergency?: any;
  onStop?: () => void;
  onAccept?: (requestId: number) => void;
  onCancel?: (requestId: number) => void;
  onTrackLocation?: () => void;
}

export default function EmergencyStatusModal({
  visible,
  onClose,
  role,
  activeEmergency,
  incomingEmergency,
  onStop,
  onAccept,
  onCancel,
  onTrackLocation,
}: EmergencyStatusModalProps) {
  const isGainer = role === "gainer";
  const hasActive = isGainer ? !!activeEmergency : !!incomingEmergency;
  const displayData = isGainer ? activeEmergency : incomingEmergency;
  const isAccepted =
    displayData?.status === "Accepted" || displayData?.Status === "Accepted";
  const requestId = displayData?.requestId || displayData?.RequestId;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>Emergency Status</Text>
          <Text style={styles.modalSubtitle}>
            {isGainer
              ? "Real-time status of your emergency blood request."
              : "Details of the incoming emergency request."}
          </Text>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {hasActive ? (
              <View style={styles.statusCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.bloodBadgeContainer}>
                    <Text style={styles.bloodBadgeText}>
                      {displayData?.bloodType || displayData?.BloodType}
                    </Text>
                  </View>

                  <View style={styles.mainInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.requesterName} numberOfLines={1}>
                        {isGainer
                          ? "Your Request"
                          : displayData?.gainerName || "Emergency Gainer"}
                      </Text>
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        {isAccepted && (
                          <TouchableOpacity
                            onPress={onTrackLocation}
                            style={styles.mapIconButton}
                          >
                            <Ionicons name="map" size={18} color="#D11B31" />
                          </TouchableOpacity>
                        )}
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: isAccepted
                                ? "#ECFDF5"
                                : "#FEF2F2",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: isAccepted ? "#059669" : "#D11B31" },
                            ]}
                          >
                            {isGainer
                              ? isAccepted
                                ? "ACCEPTED"
                                : "BROADCASTING"
                              : isAccepted
                                ? "ACCEPTED"
                                : "URGENT"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.subtext}>
                      {displayData?.units || displayData?.Units || 1} Unit
                      Required •{" "}
                      {new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>

                {isGainer && isAccepted && (
                  <View style={styles.acceptedInfo}>
                    <Text style={styles.helperLabel}>Donor Details:</Text>
                    <View style={styles.helperCard}>
                      <Ionicons
                        name="person-circle"
                        size={40}
                        color="#D11B31"
                      />
                      <View style={styles.helperDetails}>
                        <Text style={styles.helperName}>
                          {displayData?.donorName || "Potential Donor"}
                        </Text>
                        <Text style={styles.helperPhone}>
                          {displayData?.donorPhone || "Phone hidden"}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {!isGainer && (
                  <View style={styles.donorMessage}>
                    <Ionicons
                      name="location"
                      size={16}
                      color="#6B7280"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.donorMessageText}>
                      Requested in high priority area
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="notifications-off-outline"
                  size={moderateScale(48)}
                  color="#D1D5DB"
                />
                <Text style={styles.emptyText}>No active emergency found</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.actionRow}>
            {isGainer && hasActive && (
              <>
                {isAccepted && (
                  <TouchableOpacity
                    style={styles.trackButton}
                    onPress={onTrackLocation}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="map"
                      size={20}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.buttonText}>Track Map</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={onStop}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="stop-circle"
                    size={20}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.buttonText}>Stop Emergency</Text>
                </TouchableOpacity>
              </>
            )}

            {!isGainer && hasActive && (
              <>
                {isAccepted ? (
                  <>
                    <TouchableOpacity
                      style={styles.trackButton}
                      onPress={onTrackLocation}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="map"
                        size={20}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.buttonText}>Track Map</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelHelpButton}
                      onPress={() => onCancel && onCancel(requestId)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color="#6B7280"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.cancelHelpText}>Cancel Help</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={onClose}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.dismissText}>Dismiss</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() =>
                        onAccept && onAccept(displayData?.requestId)
                      }
                      activeOpacity={0.8}
                    >
                      <View style={styles.buttonIconWrapper}>
                        <DonationIcon
                          width={moderateScale(24)}
                          height={moderateScale(24)}
                          fill="#fff"
                        />
                      </View>
                      <Text style={styles.buttonText}>I Can Help</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {(!hasActive || (isGainer && !hasActive)) && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: moderateScale(26),
    borderTopRightRadius: moderateScale(26),
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(22),
    maxHeight: "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(6) },
    shadowOpacity: 0.18,
    shadowRadius: moderateScale(16),
    elevation: 12,
  },
  modalHandle: {
    alignSelf: "center",
    width: scale(44),
    height: verticalScale(5),
    borderRadius: moderateScale(99),
    backgroundColor: "#E5E7EB",
    marginBottom: verticalScale(10),
  },
  header: {
    marginBottom: verticalScale(20),
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(4),
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: "#D11B31",
    textAlign: "center",
    marginBottom: verticalScale(4),
  },
  modalSubtitle: {
    fontSize: moderateScale(14),
    color: "#6B7280",
    lineHeight: moderateScale(20),
    textAlign: "center",
    marginBottom: verticalScale(14),
  },
  scrollArea: {
    width: "100%",
  },
  scrollContent: {
    paddingBottom: verticalScale(20),
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(20),
    padding: scale(16),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  bloodBadgeContainer: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(15),
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    marginRight: scale(16),
  },
  bloodBadgeText: {
    fontSize: moderateScale(20),
    fontWeight: "900",
    color: "#D11B31",
  },
  mainInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(4),
  },
  requesterName: {
    fontSize: moderateScale(17),
    fontWeight: "800",
    color: "#111827",
  },
  statusBadge: {
    backgroundColor: "#FEF2F2",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(6),
  },
  mapIconButton: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(8),
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: "800",
    color: "#D11B31",
  },
  subtext: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    fontWeight: "500",
  },
  acceptedInfo: {
    marginTop: verticalScale(16),
    paddingTop: verticalScale(16),
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  helperLabel: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: verticalScale(12),
  },
  helperCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(16),
    padding: scale(12),
  },
  helperDetails: {
    marginLeft: scale(12),
  },
  helperName: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: "#111827",
  },
  helperPhone: {
    fontSize: moderateScale(14),
    color: "#D11B31",
    fontWeight: "600",
  },
  donorMessage: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: verticalScale(12),
  },
  donorMessageText: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    fontStyle: "italic",
  },
  emptyState: {
    paddingVertical: verticalScale(40),
    alignItems: "center",
  },
  emptyText: {
    marginTop: verticalScale(12),
    fontSize: moderateScale(15),
    color: "#9CA3AF",
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    gap: scale(12),
    marginTop: verticalScale(4),
  },
  stopButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: moderateScale(26),
    paddingVertical: verticalScale(16),
    alignItems: "center",
    justifyContent: "center",
  },
  trackButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(22),
    paddingVertical: verticalScale(16),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D11B31",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  acceptButton: {
    flex: 2.2,
    flexDirection: "row",
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(22),
    paddingVertical: verticalScale(16),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D11B31",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonIconWrapper: {
    marginRight: scale(10),
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: scale(6),
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  dismissButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(22),
    paddingVertical: verticalScale(16),
    alignItems: "center",
    justifyContent: "center",
  },
  cancelHelpButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: moderateScale(22),
    paddingVertical: verticalScale(16),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cancelHelpText: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: moderateScale(16),
  },
  closeButton: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: moderateScale(20),
    paddingVertical: verticalScale(16),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: moderateScale(16),
  },
  dismissText: {
    color: "#666666",
    fontWeight: "700",
    fontSize: moderateScale(16),
  },
});
