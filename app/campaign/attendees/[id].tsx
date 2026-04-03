import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { API_ENDPOINTS } from "../../../config/api";
import { moderateScale, scale, verticalScale } from "../../../utils/responsive";

interface Attendee {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  bloodType: string;
  units: number;
  attendedAt: string;
}

interface CampaignReport {
  campaignId: string;
  title: string;
  organizationName: string;
  collaborationPartners: string[];
  attendees: Attendee[];
  totalAttendees: number;
  totalUnits: number;
  generatedAt: string;
}

const parseStringArray = (rawValue: unknown): string[] => {
  if (Array.isArray(rawValue)) {
    return rawValue.map((entry) => String(entry)).filter(Boolean);
  }

  if (!rawValue || typeof rawValue !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry)).filter(Boolean);
    }
    return [];
  } catch {
    return rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
};

const csvValue = (value: string | number) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const htmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export default function CampaignAttendeesScreen() {
  const router = useRouter();
  const { id, title, organizationName, collaborationPartners } =
    useLocalSearchParams();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const fallbackCollaborationPartners = parseStringArray(collaborationPartners);

  useEffect(() => {
    fetchAttendees();
  }, [id]);

  const fetchAttendees = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(API_ENDPOINTS.GET_ATTENDEES(id as string), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAttendees(data.attendees || []);
      }
    } catch (error) {
      console.log("Fetch attendees error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAttendees();
  };

  const buildFallbackReport = (): CampaignReport => {
    const totalUnits = attendees.reduce(
      (sum, attendee) => sum + (Number(attendee.units) || 0),
      0,
    );

    return {
      campaignId: String(id || ""),
      title: String(title || "Campaign"),
      organizationName: String(organizationName || "Organization"),
      collaborationPartners: fallbackCollaborationPartners,
      attendees,
      totalAttendees: attendees.length,
      totalUnits,
      generatedAt: new Date().toISOString(),
    };
  };

  const normalizeCollaborationPartners = (source: any): string[] => {
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map((entry: any) => {
        if (typeof entry === "string") {
          return entry;
        }
        return entry?.organizationName || entry?.name || "";
      })
      .filter(Boolean);
  };

  const getCampaignReport = async (): Promise<CampaignReport> => {
    const fallback = buildFallbackReport();

    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(
        API_ENDPOINTS.GET_CAMPAIGN_REPORT(id as string),
        {
          headers: {
            Authorization: `Bearer ${token || ""}`,
          },
        },
      );

      if (!response.ok) {
        return fallback;
      }

      const data = await response.json();
      const report = data?.report || data;
      const rawAttendees = Array.isArray(report?.attendees)
        ? report.attendees
        : fallback.attendees;

      const normalizedAttendees: Attendee[] = rawAttendees.map(
        (entry: any, index: number) => ({
          id: Number(entry.id || entry.attendeeId || index + 1),
          fullName: entry.fullName || entry.name || "Unknown Donor",
          email: entry.email || "",
          phone: entry.phone || "",
          bloodType: entry.bloodType || "N/A",
          units: Number(entry.units || 0),
          attendedAt:
            entry.attendedAt || entry.createdAt || new Date().toISOString(),
        }),
      );

      const partners = normalizeCollaborationPartners(
        report?.collaborationPartners,
      );

      return {
        campaignId: String(report?.campaignId || id || fallback.campaignId),
        title: String(report?.title || title || fallback.title),
        organizationName: String(
          report?.organizationName ||
            organizationName ||
            fallback.organizationName,
        ),
        collaborationPartners:
          partners.length > 0 ? partners : fallback.collaborationPartners,
        attendees: normalizedAttendees,
        totalAttendees: Number(
          report?.totalAttendees || normalizedAttendees.length,
        ),
        totalUnits: Number(
          report?.totalUnits ||
            normalizedAttendees.reduce(
              (sum, attendee) => sum + attendee.units,
              0,
            ),
        ),
        generatedAt: String(report?.generatedAt || new Date().toISOString()),
      };
    } catch (error) {
      console.log("Fetch campaign report failed:", error);
      return fallback;
    }
  };

  const exportToCSV = async () => {
    setExporting("csv");
    try {
      const report = await getCampaignReport();
      if (report.attendees.length === 0) {
        Alert.alert("No Data", "No attendee records available to export.");
        return;
      }

      const rows = report.attendees
        .map((attendee) =>
          [
            csvValue(attendee.fullName),
            csvValue(attendee.email),
            csvValue(attendee.phone),
            csvValue(attendee.bloodType),
            csvValue(attendee.units),
            csvValue(new Date(attendee.attendedAt).toLocaleString()),
          ].join(","),
        )
        .join("\n");

      const csvContent = [
        `Campaign Report,${csvValue(report.title)}`,
        `Organization,${csvValue(report.organizationName)}`,
        `Collaborative Partners,${csvValue(report.collaborationPartners.join(" | ") || "N/A")}`,
        `Total Attendees,${csvValue(report.totalAttendees)}`,
        `Total Units,${csvValue(report.totalUnits)}`,
        `Generated At,${csvValue(new Date(report.generatedAt).toLocaleString())}`,
        "",
        "Full Name,Email,Phone,Blood Type,Units,Attended At",
        rows,
      ].join("\n");

      const fileName = `campaign-report-${report.campaignId}-${Date.now()}.csv`;
      // @ts-ignore
      const fileUri = FileSystem.cacheDirectory + fileName;
      // @ts-ignore
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: "utf8",
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv" });
      } else {
        Alert.alert("Exported", `CSV created at ${fileUri}`);
      }
    } catch (error) {
      console.log("CSV export error:", error);
      Alert.alert("Export Failed", "Could not generate CSV report.");
    } finally {
      setExporting(null);
    }
  };

  const exportToPDF = async () => {
    setExporting("pdf");
    try {
      const report = await getCampaignReport();
      if (report.attendees.length === 0) {
        Alert.alert("No Data", "No attendee records available to export.");
        return;
      }

      const html = `
                <html>
                  <head>
                    <style>
                      body { font-family: Helvetica; padding: 20px; color: #111827; }
                      .title { font-size: 24px; font-weight: 700; color: #D11B31; margin-bottom: 4px; }
                      .subtitle { font-size: 14px; color: #6B7280; margin-bottom: 18px; }
                      .meta { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
                      .meta-row { margin-bottom: 6px; font-size: 13px; }
                      table { width: 100%; border-collapse: collapse; }
                      th { text-align: left; background: #D11B31; color: #FFF; padding: 10px; font-size: 12px; }
                      td { border: 1px solid #E5E7EB; padding: 10px; font-size: 12px; }
                      tr:nth-child(even) { background: #F9FAFB; }
                      .footer { margin-top: 16px; color: #9CA3AF; font-size: 11px; }
                    </style>
                  </head>
                  <body>
                    <div class="title">Campaign Attendance Report</div>
                    <div class="subtitle">${htmlEscape(report.title)}</div>
                    <div class="meta">
                      <div class="meta-row"><strong>Organization:</strong> ${htmlEscape(report.organizationName)}</div>
                      <div class="meta-row"><strong>Collaborative Partners:</strong> ${htmlEscape(report.collaborationPartners.join(", ") || "N/A")}</div>
                      <div class="meta-row"><strong>Total Attendees:</strong> ${report.totalAttendees}</div>
                      <div class="meta-row"><strong>Total Units Collected:</strong> ${report.totalUnits}</div>
                    </div>

                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Blood Type</th>
                          <th>Units</th>
                          <th>Attended At</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${report.attendees
                          .map(
                            (attendee) => `
                          <tr>
                            <td>${htmlEscape(attendee.fullName)}</td>
                            <td>${htmlEscape(attendee.email || "-")}</td>
                            <td>${htmlEscape(attendee.phone || "-")}</td>
                            <td>${htmlEscape(attendee.bloodType)}</td>
                            <td>${attendee.units}</td>
                            <td>${htmlEscape(new Date(attendee.attendedAt).toLocaleString())}</td>
                          </tr>
                        `,
                          )
                          .join("")}
                      </tbody>
                    </table>

                    <div class="footer">Generated on ${htmlEscape(new Date(report.generatedAt).toLocaleString())} via BloodBuddy</div>
                  </body>
                </html>
            `;

      const fileName = `campaign-report-${report.campaignId}-${Date.now()}.pdf`;
      const { uri } = await Print.printToFileAsync({ html });

      // @ts-ignore
      const fileUri = FileSystem.cacheDirectory + fileName;
      // @ts-ignore
      await FileSystem.moveAsync({ from: uri, to: fileUri });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          UTI: "public.adobe-pdf",
          mimeType: "application/pdf",
        });
      } else {
        Alert.alert("Exported", `PDF created at ${fileUri}`);
      }
    } catch (error) {
      console.log("PDF export error:", error);
      Alert.alert("Export Failed", "Could not generate PDF report.");
    } finally {
      setExporting(null);
    }
  };

  const renderItem = ({ item }: { item: Attendee }) => (
    <View style={styles.attendeeCard}>
      <View style={styles.attendeeHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.fullName.charAt(0)}</Text>
        </View>
        <View style={styles.attendeeMainInfo}>
          <Text style={styles.attendeeName}>{item.fullName}</Text>
          <Text style={styles.attendeeContact}>{item.phone || item.email}</Text>
        </View>
        <View style={styles.bloodBadge}>
          <Text style={styles.bloodTypeText}>{item.bloodType}</Text>
          <Text style={styles.unitsText}>{item.units} Unit</Text>
        </View>
      </View>
      <View style={styles.attendeeFooter}>
        <Ionicons name="time-outline" size={14} color="#9CA3AF" />
        <Text style={styles.attendedAt}>
          {new Date(item.attendedAt).toLocaleString()}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No Attendees Yet</Text>
      <Text style={styles.emptySubtitle}>
        People who scan your camp QR will appear here.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#D11B31" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Camp Attendees</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerActionButton,
              exporting === "csv" && styles.headerActionButtonDisabled,
            ]}
            onPress={exportToCSV}
            disabled={!!exporting || loading}
          >
            {exporting === "csv" ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="grid-outline" size={16} color="#FFF" />
            )}
            <Text style={styles.headerActionText}>CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerActionButton,
              styles.pdfActionButton,
              exporting === "pdf" && styles.headerActionButtonDisabled,
            ]}
            onPress={exportToPDF}
            disabled={!!exporting || loading}
          >
            {exporting === "pdf" ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="document-outline" size={16} color="#FFF" />
            )}
            <Text style={styles.headerActionText}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D11B31" />
        </View>
      ) : (
        <FlatList
          data={attendees}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#D11B31"]}
            />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(60),
    paddingBottom: verticalScale(16),
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    marginRight: scale(16),
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: "900",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    width: scale(145),
  },
  headerActions: {
    flexDirection: "row",
    gap: scale(8),
  },
  headerActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(4),
    backgroundColor: "#2563EB",
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(8),
    minWidth: scale(62),
  },
  pdfActionButton: {
    backgroundColor: "#DC2626",
  },
  headerActionButtonDisabled: {
    opacity: 0.8,
  },
  headerActionText: {
    fontSize: moderateScale(11),
    color: "#FFF",
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: scale(16),
  },
  attendeeCard: {
    backgroundColor: "#FFF",
    borderRadius: moderateScale(16),
    padding: scale(16),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  attendeeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(12),
  },
  avatar: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
  },
  avatarText: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#D11B31",
  },
  attendeeMainInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: "#111827",
  },
  attendeeContact: {
    fontSize: moderateScale(12),
    color: "#6B7280",
  },
  bloodBadge: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(8),
  },
  bloodTypeText: {
    fontSize: moderateScale(14),
    fontWeight: "800",
    color: "#D11B31",
  },
  unitsText: {
    fontSize: moderateScale(10),
    color: "#6B7280",
    fontWeight: "600",
  },
  attendeeFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: verticalScale(8),
  },
  attendedAt: {
    fontSize: moderateScale(12),
    color: "#9CA3AF",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: verticalScale(100),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: "600",
    color: "#374151",
    marginTop: verticalScale(16),
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: verticalScale(8),
  },
});
