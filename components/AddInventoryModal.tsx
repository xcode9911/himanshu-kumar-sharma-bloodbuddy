import AsyncStorage from "@react-native-async-storage/async-storage"
import React, { useEffect, useState } from "react"
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import { API_ENDPOINTS } from "../config/api"
import { moderateScale, scale, verticalScale } from "../utils/responsive"

const DEFAULT_BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const

type Props = {
  visible: boolean
  onClose: () => void
  onSuccess?: () => void
  bloodType?: string
  setBloodType?: (v: string) => void
  units?: string
  setUnits?: (v: string) => void
  bloodTypes?: readonly string[]
  title?: string
  submitButtonText?: string
  isEditMode?: boolean
  editingBloodType?: string
}

export default function AddInventoryModal({
  visible,
  onClose,
  onSuccess,
  bloodType: externalBloodType,
  setBloodType: externalSetBloodType,
  units: externalUnits,
  setUnits: externalSetUnits,
  bloodTypes = DEFAULT_BLOOD_TYPES,
  title = "Add Inventory",
  submitButtonText = "Add",
  isEditMode = false,
  editingBloodType,
}: Props) {
  const [internalBloodType, setInternalBloodType] = useState("AB+")
  const [internalUnits, setInternalUnits] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentUnits, setCurrentUnits] = useState<number | null>(null)
  const [isLoadingCurrentUnits, setIsLoadingCurrentUnits] = useState(false)

  const bloodType = externalBloodType ?? internalBloodType
  const setBloodType = externalSetBloodType ?? setInternalBloodType
  const units = externalUnits ?? internalUnits
  const setUnits = externalSetUnits ?? setInternalUnits

  // Fetch current units when blood type changes (only for add mode, not edit)
  useEffect(() => {
    if (visible && !isEditMode && !editingBloodType) {
      fetchCurrentUnits(bloodType)
    } else if (visible && isEditMode && editingBloodType) {
      // For edit mode, we might want to show current units too
      fetchCurrentUnits(editingBloodType)
    } else {
      setCurrentUnits(null)
    }
  }, [bloodType, visible, isEditMode, editingBloodType])

  const fetchCurrentUnits = async (bt: string) => {
    setIsLoadingCurrentUnits(true)
    try {
      const check = await checkBloodTypeExists(bt)
      setCurrentUnits(check.exists ? check.currentUnits ?? null : null)
    } catch {
      setCurrentUnits(null)
    } finally {
      setIsLoadingCurrentUnits(false)
    }
  }

  const checkBloodTypeExists = async (bt: string): Promise<{ exists: boolean; currentUnits?: number }> => {
    try {
      const token = await AsyncStorage.getItem("authToken")
      if (!token) return { exists: false }

      const response = await fetch(API_ENDPOINTS.CHECK_BLOOD_TYPE(bt), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) return { exists: false }
      const data = await response.json().catch(() => null)
      return {
        exists: data?.exists || false,
        currentUnits: data?.currentUnits || data?.units,
      }
    } catch {
      return { exists: false }
    }
  }

  const handleSubmit = async () => {
    const parsedUnits = Number(units)
    if (!units || isNaN(parsedUnits)) {
      Alert.alert("Error", "Please enter a valid number of units")
      return
    }

    if (parsedUnits === 0) {
      Alert.alert("Error", "Cannot add 0 units")
      return
    }

    if (parsedUnits < 0) {
      Alert.alert("Error", "Units cannot be negative")
      return
    }

    setIsSubmitting(true)
    try {
      const token = await AsyncStorage.getItem("authToken")
      if (!token) {
        Alert.alert("Error", "Please login again.")
        setIsSubmitting(false)
        return
      }

      // Check if blood type exists (only for new items, not edits)
      if (!isEditMode && !editingBloodType) {
        const check = await checkBloodTypeExists(bloodType)
        if (check.exists && check.currentUnits !== undefined) {
          Alert.alert(
            "Blood Type Exists",
            `Blood type ${bloodType} already exists with ${check.currentUnits} units. Add ${units} more units?`,
            [
              { text: "Cancel", style: "cancel", onPress: () => setIsSubmitting(false) },
              {
                text: "Add",
                onPress: async () => {
                  await proceedWithAddInventory(token)
                },
              },
            ]
          )
          return
        }
      }

      await proceedWithAddInventory(token)
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to add inventory")
      setIsSubmitting(false)
    }
  }

  const proceedWithAddInventory = async (token: string) => {
    try {
      if (isEditMode && editingBloodType) {
        // Update existing inventory
        const response = await fetch(API_ENDPOINTS.UPDATE_INVENTORY, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bloodType: editingBloodType,
            units: Number(units),
          }),
        })

        const data = await response.json().catch(() => null)
        if (!response.ok) {
          const msg = (data && (data.message || data.error)) || "Failed to update inventory"
          throw new Error(msg)
        }

        Alert.alert("Success", "Inventory updated successfully")
      } else {
        // Add new inventory
        const response = await fetch(API_ENDPOINTS.ADD_INVENTORY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bloodType,
            units: Number(units),
          }),
        })

        const data = await response.json().catch(() => null)
        if (!response.ok) {
          const msg = (data && (data.message || data.error)) || "Failed to add inventory"
          throw new Error(msg)
        }

        Alert.alert("Success", "Inventory added successfully")
      }

      // Reset form
      if (!externalSetBloodType) setInternalBloodType("AB+")
      if (!externalSetUnits) setInternalUnits("")
      onClose()
      onSuccess?.()
    } catch (e: any) {
      throw e
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.label}>Blood Type</Text>
          <View style={styles.chipsRow}>
            {bloodTypes.map((type) => (
              <TouchableOpacity
                key={type}
                testID={`bloodType_${type}`}
                style={[styles.chip, bloodType === type && styles.chipSelected]}
                activeOpacity={0.85}
                onPress={() => setBloodType(type)}
                disabled={isEditMode && editingBloodType !== type}
              >
                <Text style={[styles.chipText, bloodType === type && styles.chipTextSelected]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {currentUnits !== null && !isEditMode && (
            <View style={styles.currentUnitsContainer}>
              <Text style={styles.currentUnitsLabel}>Current Units:</Text>
              <Text style={styles.currentUnitsValue}>{currentUnits} units</Text>
            </View>
          )}

          {isEditMode && editingBloodType && currentUnits !== null && (
            <View style={styles.currentUnitsContainer}>
              <Text style={styles.currentUnitsLabel}>Current Units:</Text>
              <Text style={styles.currentUnitsValue}>{currentUnits} units</Text>
            </View>
          )}

          <Text style={styles.label}>Units</Text>
          <TextInput
            testID="inventoryUnitsInput"
            style={styles.input}
            keyboardType="numeric"
            value={units}
            onChangeText={setUnits}
            placeholder="Enter units"
            placeholderTextColor="#9B7B7F"
            editable={!isSubmitting}
          />

          <TouchableOpacity
            testID="addInventorySubmitButton"
            style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.primaryButtonText}>{isSubmitting ? "Processing..." : submitButtonText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={onClose}
            disabled={isSubmitting}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: moderateScale(26),
    borderTopRightRadius: moderateScale(26),
    paddingTop: verticalScale(10),
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(22),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(6) },
    shadowOpacity: 0.18,
    shadowRadius: moderateScale(16),
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: scale(44),
    height: verticalScale(5),
    borderRadius: moderateScale(99),
    backgroundColor: "#E5E7EB",
    marginBottom: verticalScale(10),
  },
  title: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: "#D11B31",
    textAlign: "center",
    marginBottom: verticalScale(14),
  },
  label: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#111827",
    marginTop: verticalScale(8),
    marginBottom: verticalScale(8),
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(8),
    marginBottom: verticalScale(10),
  },
  chip: {
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(20),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(14),
  },
  chipSelected: {
    backgroundColor: "#D11B31",
  },
  chipText: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: "#666666",
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  input: {
    width: "100%",
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(20),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(14),
    fontSize: moderateScale(15),
    color: "#333333",
    marginBottom: verticalScale(14),
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(26),
    paddingVertical: verticalScale(16),
    alignItems: "center",
    marginTop: verticalScale(4),
    marginBottom: verticalScale(10),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(4),
    elevation: 3,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: moderateScale(16),
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(20),
    paddingVertical: verticalScale(14),
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#666666",
    fontSize: moderateScale(15),
    fontWeight: "700",
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  currentUnitsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    marginBottom: verticalScale(12),
    marginTop: verticalScale(4),
  },
  currentUnitsLabel: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: "#6B7280",
  },
  currentUnitsValue: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: "#D11B31",
  },
})

