import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_ENDPOINTS } from "../config/api";
import { moderateScale, scale, verticalScale } from "../utils/responsive";

interface InventoryHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  organizationName: string;
}

const InventoryHistoryModal: React.FC<InventoryHistoryModalProps> = ({
  visible,
  onClose,
  organizationName,
}) => {
  const [inventoryHistory, setInventoryHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchInventoryHistory();
    }
  }, [visible]);

  const fetchInventoryHistory = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch(API_ENDPOINTS.GET_INVENTORY_HISTORY, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setInventoryHistory(data.history || []);
      }
    } catch (e) {
      console.log("Failed to fetch history:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = inventoryHistory.filter(item => {
    const itemDate = new Date(item.createdAt);
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    return itemDate >= start && itemDate <= end;
  });

  const exportToCSV = async () => {
    if (filteredHistory.length === 0) {
      Alert.alert("No Data", "There is no history data in the selected range to export.");
      return;
    }

    const header = "Date,Blood Type,Action,Units Changed,Previous Total,New Total\n";
    const rows = filteredHistory.map(item => {
      const date = new Date(item.createdAt).toLocaleString().replace(/,/g, '');
      return `${date},${item.bloodType},${item.actionType},${item.unitsChanged},${item.previousTotal},${item.newTotal}`;
    }).join("\n");

    const csvContent = header + rows;
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `${dateStr}_bloodbuddy_report.csv`;
    
    try {
      // @ts-ignore
      const fileUri = FileSystem.cacheDirectory + fileName;
      // @ts-ignore
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: 'utf8' });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv' });
    } catch (e) {
      Alert.alert("Error", "Failed to export CSV");
      console.log(e);
    }
  };

  const exportToPDF = async () => {
    if (filteredHistory.length === 0) {
      Alert.alert("No Data", "There is no history data in the selected range to export.");
      return;
    }

    let logoBase64 = "";
    try {
      // @ts-ignore
      const asset = Asset.fromModule(require("../assets/images/logo.png"));
      await asset.downloadAsync();
      const uri = asset.localUri || asset.uri;
      if (uri) {
        if (uri.startsWith('http')) {
          logoBase64 = uri; 
        } else {
          // @ts-ignore
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
          logoBase64 = `data:image/png;base64,${base64}`;
        }
      }
    } catch (e) {
      console.log("Logo load error:", e);
    }

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Helvetica; padding: 20px; color: #333; }
            .header { display: flex; flex-direction: row; align-items: center; border-bottom: 2px solid #D11B31; padding-bottom: 15px; margin-bottom: 20px; }
            .logo-img { width: 60px; height: 60px; margin-right: 15px; }
            .logo-text { font-size: 28px; font-weight: 800; color: #D11B31; flex: 1; }
            .org-info { text-align: right; }
            .title { color: #D11B31; font-size: 24px; margin: 20px 0; text-align: center; font-weight: 800; }
            .date-range { text-align: center; color: #666; margin-bottom: 30px; font-style: italic; }
            table { width: 100%; border-collapse: collapse; }
            th { background-color: #D11B31; color: white; padding: 12px; text-align: left; font-size: 14px; border: 1px solid #D11B31; }
            td { border: 1px solid #eee; padding: 12px; font-size: 13px; }
            tr:nth-child(even) { background-color: #FAFAFA; }
            .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" />` : ''}
            <div class="logo-text">BloodBuddy</div>
            <div class="org-info">
              <strong style="font-size: 18px;">${organizationName || 'Organization Report'}</strong><br/>
              Inventory Management System
            </div>
          </div>
          <div class="title">INVENTORY TRANSACTION REPORT</div>
          <div class="date-range">Report Range: ${fromDate.toLocaleDateString()} to ${toDate.toLocaleDateString()}</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Blood Type</th>
                <th>Action</th>
                <th>Units Change</th>
                <th>Final Units</th>
              </tr>
            </thead>
            <tbody>
              ${filteredHistory.map(item => `
                <tr>
                  <td>${new Date(item.createdAt).toLocaleString()}</td>
                  <td>${item.bloodType}</td>
                  <td>${item.actionType}</td>
                  <td style="color: ${item.unitsChanged > 0 ? '#10B981' : '#EF4444'}; font-weight: 600;">
                    ${item.unitsChanged > 0 ? '+' : ''}${item.unitsChanged}
                  </td>
                  <td style="font-weight: 700;">${item.newTotal}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleString()} by BloodBuddy. All rights reserved.
          </div>
        </body>
      </html>
    `;

    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `${dateStr}_bloodbuddy_report.pdf`;
      const { uri } = await Print.printToFileAsync({ html });
      
      // @ts-ignore
      const newUri = FileSystem.cacheDirectory + fileName;
      // @ts-ignore
      await FileSystem.moveAsync({
        from: uri,
        to: newUri
      });

      await Sharing.shareAsync(newUri, { UTI: 'public.adobe-pdf', mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert("Error", "Failed to export PDF");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.historyModalOverlay}>
        <View style={styles.historyModalContent}>
          <View style={styles.historyModalHeader}>
            <Text style={styles.historyModalTitle}>Inventory History</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.exportButtonsRow}>
            <TouchableOpacity style={styles.exportButton} onPress={exportToCSV}>
              <Ionicons name="grid-outline" size={18} color="#fff" />
              <Text style={styles.exportButtonText}>Excel (CSV)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportButton, { backgroundColor: '#FF3B30' }]} onPress={exportToPDF}>
              <Ionicons name="document-outline" size={18} color="#fff" />
              <Text style={styles.exportButtonText}>PDF</Text>
            </TouchableOpacity>
          </View>

          {/* Date Filters */}
          <View style={styles.dateFiltersOuterContainer}>
            <View style={styles.dateInputsRow}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>From:</Text>
                <TouchableOpacity
                  style={styles.dateSelector}
                  onPress={() => setShowFromPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#D11B31" />
                  <Text style={styles.dateValue}>{fromDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>To:</Text>
                <TouchableOpacity
                  style={styles.dateSelector}
                  onPress={() => setShowToPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#D11B31" />
                  <Text style={styles.dateValue}>{toDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {(showFromPicker || showToPicker) && (
              <DateTimePicker
                value={showFromPicker ? fromDate : toDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') {
                    setShowFromPicker(false);
                    setShowToPicker(false);
                  }
                  
                  if (event.type === 'set' && selectedDate) {
                    if (showFromPicker) {
                      setFromDate(selectedDate);
                    } else {
                      setToDate(selectedDate);
                    }
                  }
                  
                  if (Platform.OS === 'ios' && event.type === 'set') {
                     setShowFromPicker(false);
                     setShowToPicker(false);
                  }
                }}
              />
            )}

            <TouchableOpacity 
              style={styles.resetFilterButton}
              onPress={() => {
                setFromDate(new Date(new Date().setDate(new Date().getDate() - 30)));
                setToDate(new Date());
              }}
            >
              <Ionicons name="refresh-outline" size={14} color="#D11B31" />
              <Text style={styles.resetFilterText}>Reset Range</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#D11B31" />
            </View>
          ) : (
            <ScrollView style={styles.historyScrollView} horizontal={true}>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { width: 150 }]}>Date</Text>
                  <Text style={[styles.tableHeaderText, { width: 80 }]}>Type</Text>
                  <Text style={[styles.tableHeaderText, { width: 100 }]}>Action</Text>
                  <Text style={[styles.tableHeaderText, { width: 80 }]}>Units</Text>
                  <Text style={[styles.tableHeaderText, { width: 80 }]}>Total</Text>
                </View>
                {filteredHistory.length === 0 ? (
                  <Text style={styles.noHistoryText}>No records found in this range.</Text>
                ) : (
                  filteredHistory.map((item, index) => (
                    <View key={index} style={[styles.tableRow, index % 2 === 0 && { backgroundColor: '#F9FAFB' }]}>
                      <Text style={[styles.tableRowText, { width: 150 }]}>{new Date(item.createdAt).toLocaleString()}</Text>
                      <Text style={[styles.tableRowText, { width: 80, fontWeight: '700' }]}>{item.bloodType}</Text>
                      <Text style={[styles.tableRowText, { width: 100 }]}>{item.actionType}</Text>
                      <Text style={[styles.tableRowText, { width: 80, color: item.unitsChanged > 0 ? '#10B981' : '#EF4444' }]}>
                        {item.unitsChanged > 0 ? '+' : ''}{item.unitsChanged}
                      </Text>
                      <Text style={[styles.tableRowText, { width: 80, fontWeight: '600' }]}>{item.newTotal}</Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  historyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  historyModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: moderateScale(30),
    borderTopRightRadius: moderateScale(30),
    height: '80%',
    padding: scale(20),
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  historyModalTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: '#D11B31',
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginBottom: verticalScale(20),
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(15),
    borderRadius: moderateScale(10),
    gap: scale(5),
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  historyScrollView: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(8),
    marginBottom: verticalScale(8),
  },
  tableHeaderText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#374151',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: verticalScale(15),
    paddingHorizontal: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableRowText: {
    fontSize: moderateScale(13),
    color: '#4B5563',
  },
  noHistoryText: {
    textAlign: 'center',
    marginTop: verticalScale(40),
    color: '#9CA3AF',
    fontSize: moderateScale(16),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFiltersOuterContainer: {
    backgroundColor: '#FFF5F5',
    padding: scale(12),
    borderRadius: moderateScale(15),
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginBottom: verticalScale(20),
  },
  dateInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  dateInputGroup: {
    width: '48%',
  },
  dateLabel: {
    fontSize: moderateScale(11),
    color: '#666',
    marginBottom: verticalScale(4),
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(8),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: scale(4),
  },
  dateValue: {
    fontSize: moderateScale(13),
    color: '#333',
    fontWeight: '600',
  },
  resetFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(12),
    paddingTop: verticalScale(8),
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    width: '100%',
    gap: scale(5),
  },
  resetFilterText: {
    fontSize: moderateScale(12),
    color: '#D11B31',
    fontWeight: '700',
  },
});

export default InventoryHistoryModal;
