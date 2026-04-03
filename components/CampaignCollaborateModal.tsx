import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { moderateScale, scale, verticalScale } from "../utils/responsive";

export interface CollaborateOrganization {
  id: string;
  name: string;
}

interface CampaignCollaborateModalProps {
  visible: boolean;
  onClose: () => void;
  organizations: CollaborateOrganization[];
  selectedIds: string[];
  onToggleOrganization: (organizationId: string) => void;
  loading?: boolean;
  onReload?: () => void;
}

export default function CampaignCollaborateModal({
  visible,
  onClose,
  organizations,
  selectedIds,
  onToggleOrganization,
  loading = false,
  onReload,
}: CampaignCollaborateModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
    }
  }, [visible]);

  const filteredOrganizations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return organizations;
    }

    return organizations.filter((organization) =>
      organization.name.toLowerCase().includes(query),
    );
  }, [organizations, searchQuery]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHandle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Select Collaborating Organizations</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Choose organizations to invite for this campaign.
          </Text>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search organizations"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {onReload ? (
              <TouchableOpacity onPress={onReload} hitSlop={8}>
                <Ionicons name="refresh" size={18} color="#D11B31" />
              </TouchableOpacity>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="small" color="#D11B31" />
              <Text style={styles.centerStateText}>
                Loading organizations...
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrganizations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const selected = selectedIds.includes(item.id);

                return (
                  <TouchableOpacity
                    style={[styles.orgRow, selected && styles.orgRowSelected]}
                    activeOpacity={0.8}
                    onPress={() => onToggleOrganization(item.id)}
                  >
                    <Text
                      style={[
                        styles.orgName,
                        selected && styles.orgNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={selected ? "#D11B31" : "#9CA3AF"}
                    />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <Text style={styles.centerStateText}>
                    No organizations found.
                  </Text>
                </View>
              }
            />
          )}

          <View style={styles.footer}>
            <Text style={styles.selectedCount}>
              {selectedIds.length} selected
            </Text>
            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>Done</Text>
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
    backgroundColor: "rgba(17,24,39,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(16),
    maxHeight: "78%",
  },
  modalHandle: {
    width: scale(50),
    height: verticalScale(5),
    borderRadius: moderateScale(999),
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: verticalScale(12),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: scale(12),
  },
  title: {
    flex: 1,
    fontSize: moderateScale(17),
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: verticalScale(4),
    marginBottom: verticalScale(10),
    fontSize: moderateScale(12),
    color: "#6B7280",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: moderateScale(10),
    backgroundColor: "#F9FAFB",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(8),
    marginBottom: verticalScale(10),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(14),
    color: "#111827",
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: verticalScale(8),
  },
  orgRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: moderateScale(10),
    backgroundColor: "#FFFFFF",
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(12),
    marginBottom: verticalScale(8),
  },
  orgRowSelected: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  orgName: {
    flex: 1,
    marginRight: scale(8),
    fontSize: moderateScale(14),
    color: "#1F2937",
    fontWeight: "600",
  },
  orgNameSelected: {
    color: "#B91C1C",
  },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(24),
  },
  centerStateText: {
    marginTop: verticalScale(8),
    color: "#6B7280",
    fontSize: moderateScale(13),
  },
  footer: {
    marginTop: verticalScale(6),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedCount: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    fontWeight: "600",
  },
  doneButton: {
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(10),
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: moderateScale(14),
    fontWeight: "700",
  },
});
