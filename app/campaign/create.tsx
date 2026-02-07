import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import DateTimePicker from "@react-native-community/datetimepicker"
import * as ImagePicker from "expo-image-picker"
import { useLocalSearchParams, useRouter } from "expo-router"
import React, { useState } from "react"
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native"
import { API_ENDPOINTS } from "../../config/api"
import { moderateScale, scale, verticalScale } from "../../utils/responsive"

export default function CreateCampaignScreen() {
    const router = useRouter()
    const params = useLocalSearchParams()
    const isEditing = !!params.id
    const [loading, setLoading] = useState(false)

    // Form State
    const [title, setTitle] = useState(params.title as string || "")
    const [description, setDescription] = useState(params.description as string || "")
    const [location, setLocation] = useState(params.location as string || "")

    const [startDate, setStartDate] = useState(params.startDate ? new Date(params.startDate as string) : new Date())
    const [startTime, setStartTime] = useState(params.startDate ? new Date(params.startDate as string) : new Date())
    const [endDate, setEndDate] = useState(params.endDate ? new Date(params.endDate as string) : new Date())
    const [endTime, setEndTime] = useState(params.endDate ? new Date(params.endDate as string) : new Date())
    const [imageUri, setImageUri] = useState<string | null>(params.posterUrl as string || null)

    // Picker visibility
    const [showStartDate, setShowStartDate] = useState(false)
    const [showStartTime, setShowStartTime] = useState(false)
    const [showEndDate, setShowEndDate] = useState(false)
    const [showEndTime, setShowEndTime] = useState(false)

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant permission to access your gallery to upload a poster.')
            return
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        })

        if (!result.canceled) {
            setImageUri(result.assets[0].uri)
        }
    }

    const handleSubmit = async () => {
        if (!title.trim() || !description.trim() || !location.trim()) {
            Alert.alert("Error", "Please fill all required fields.")
            return
        }

        if (!isEditing && !imageUri) {
            Alert.alert("Error", "Please upload a poster.")
            return
        }

        setLoading(true)
        try {
            const token = await AsyncStorage.getItem("authToken")
            if (!token) throw new Error("Not authenticated")

            const startDateTime = new Date(startDate)
            startDateTime.setHours(startTime.getHours())
            startDateTime.setMinutes(startTime.getMinutes())

            const endDateTime = new Date(endDate)
            endDateTime.setHours(endTime.getHours())
            endDateTime.setMinutes(endTime.getMinutes())

            if (endDateTime <= startDateTime) {
                Alert.alert("Error", "End time must be after start time")
                setLoading(false)
                return
            }

            const formData = new FormData()
            formData.append("title", title)
            formData.append("description", description)
            formData.append("location", location)
            formData.append("startDate", startDateTime.toISOString())
            formData.append("endDate", endDateTime.toISOString())

            if (imageUri && !imageUri.startsWith('http')) {
                const filename = imageUri.split('/').pop()
                const match = /\.(\w+)$/.exec(filename || '')
                const type = match ? `image/${match[1]}` : `image`

                formData.append("poster", {
                    uri: imageUri,
                    name: filename || 'poster.jpg',
                    type
                } as any)
            }

            let url = API_ENDPOINTS.CREATE_CAMPAIGN;
            let method = "POST";

            if (isEditing) {
                url = API_ENDPOINTS.UPDATE_CAMPAIGN(params.id as string);
                method = "PUT";
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
                body: formData,
            })

            const data = await response.json()

            if (response.ok) {
                Alert.alert("Success", `Campaign ${isEditing ? 'updated' : 'created'} successfully!`, [
                    { text: "OK", onPress: () => router.back() }
                ])
            } else {
                throw new Error(data.message || `Failed to ${isEditing ? 'update' : 'create'} campaign`)
            }
        } catch (error: any) {
            console.error("Campaign submit error:", error)
            Alert.alert("Error", error.message || "Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Helper for cross-platform date picking
    const showPicker = (mode: 'date' | 'time', current: Date, setDate: (d: Date) => void, setShow: (v: boolean) => void) => {
        if (Platform.OS === 'android') {
            return (
                <DateTimePicker
                    value={current}
                    mode={mode}
                    onChange={(event, date) => {
                        setShow(false)
                        if (date) setDate(date)
                    }}
                />
            )
        }

        // iOS Modal Picker
        return (
            <Modal transparent animationType="slide" visible={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShow(false)}>
                                <Text style={styles.modalButton}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select {mode === 'date' ? 'Date' : 'Time'}</Text>
                            <TouchableOpacity onPress={() => setShow(false)}>
                                <Text style={[styles.modalButton, styles.doneButton]}>Done</Text>
                            </TouchableOpacity>
                        </View>
                        <DateTimePicker
                            value={current}
                            mode={mode}
                            display="spinner"
                            onChange={(event, date) => {
                                if (date) setDate(date)
                            }}
                            textColor="#000"
                        />
                    </View>
                </View>
            </Modal>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isEditing ? 'Edit Campaign' : 'Create Campaign'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                {/* Poster Upload */}
                <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
                    ) : (
                        <View style={styles.uploadPlaceholder}>
                            <Ionicons name="image-outline" size={40} color="#9CA3AF" />
                            <Text style={styles.uploadText}>{isEditing ? 'Change Poster' : 'Upload Campaign Poster'}</Text>
                            <Text style={styles.uploadSubText}>{isEditing ? '(Tap to update)' : '(16:9 aspect ratio recommended)'}</Text>
                        </View>
                    )}
                    {imageUri && (
                        <View style={styles.editImageOverlay}>
                            <Ionicons name="camera" size={20} color="#FFF" />
                        </View>
                    )}
                </TouchableOpacity>

                <Text style={styles.label}>Campaign Title</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Annual Blood Drive 2024"
                    value={title}
                    onChangeText={setTitle}
                    placeholderTextColor="#9CA3AF"
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe the campaign, goals, and requirements..."
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    placeholderTextColor="#9CA3AF"
                />

                <Text style={styles.label}>Location</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Venue address or location name"
                    value={location}
                    onChangeText={setLocation}
                    placeholderTextColor="#9CA3AF"
                />

                <View style={styles.row}>
                    <View style={styles.halfWidth}>
                        <Text style={styles.label}>Start Date</Text>
                        <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartDate(true)}>
                            <Text style={styles.dateText}>{formatDate(startDate)}</Text>
                            <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.halfWidth}>
                        <Text style={styles.label}>Start Time</Text>
                        <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartTime(true)}>
                            <Text style={styles.dateText}>{formatTime(startTime)}</Text>
                            <Ionicons name="time-outline" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={styles.halfWidth}>
                        <Text style={styles.label}>End Date</Text>
                        <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndDate(true)}>
                            <Text style={styles.dateText}>{formatDate(endDate)}</Text>
                            <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.halfWidth}>
                        <Text style={styles.label}>End Time</Text>
                        <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndTime(true)}>
                            <Text style={styles.dateText}>{formatTime(endTime)}</Text>
                            <Ionicons name="time-outline" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Render Pickers */}
                {showStartDate && showPicker('date', startDate, setStartDate, setShowStartDate)}
                {showStartTime && showPicker('time', startTime, setStartTime, setShowStartTime)}
                {showEndDate && showPicker('date', endDate, setEndDate, setShowEndDate)}
                {showEndTime && showPicker('time', endTime, setEndTime, setShowEndTime)}

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.buttonText}>{isEditing ? 'Update Campaign' : 'Create Campaign'}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9FAFB",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: scale(16),
        paddingTop: verticalScale(60),
        paddingBottom: verticalScale(16),
        backgroundColor: "#FFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    headerTitle: {
        fontSize: moderateScale(18),
        fontWeight: "600",
        color: "#111827",
    },
    backButton: {
        padding: scale(4),
    },
    content: {
        padding: scale(20),
        paddingBottom: verticalScale(100),
    },
    imageUpload: {
        height: verticalScale(200),
        backgroundColor: "#F3F4F6",
        borderRadius: moderateScale(12),
        borderWidth: 2,
        borderColor: "#E5E7EB",
        borderStyle: "dashed",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: verticalScale(24),
        overflow: 'hidden',
    },
    uploadedImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    uploadPlaceholder: {
        alignItems: "center",
        gap: verticalScale(8),
    },
    uploadText: {
        fontSize: moderateScale(16),
        fontWeight: "500",
        color: "#4B5563",
    },
    uploadSubText: {
        fontSize: moderateScale(12),
        color: "#9CA3AF",
    },
    editImageOverlay: {
        position: 'absolute',
        bottom: scale(10),
        right: scale(10),
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: scale(8),
        borderRadius: moderateScale(20),
    },
    label: {
        fontSize: moderateScale(14),
        fontWeight: "500",
        color: "#374151",
        marginBottom: verticalScale(6),
    },
    input: {
        backgroundColor: "#FFF",
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: moderateScale(8),
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(10),
        fontSize: moderateScale(15),
        color: "#1F2937",
        marginBottom: verticalScale(16),
    },
    textArea: {
        height: verticalScale(100),
    },
    row: {
        flexDirection: "row",
        gap: scale(16),
        marginBottom: verticalScale(16),
    },
    halfWidth: {
        flex: 1,
    },
    dateInput: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFF",
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: moderateScale(8),
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(10),
    },
    dateText: {
        fontSize: moderateScale(15),
        color: "#1F2937",
    },
    footer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: scale(20),
        backgroundColor: "#FFF",
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
    },
    button: {
        backgroundColor: "#D11B31",
        paddingVertical: verticalScale(14),
        borderRadius: moderateScale(8),
        alignItems: "center",
        justifyContent: "center",
    },
    buttonDisabled: {
        backgroundColor: "#FCA5A5",
    },
    buttonText: {
        color: "#FFF",
        fontSize: moderateScale(16),
        fontWeight: "600",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#FFF",
        borderTopLeftRadius: moderateScale(20),
        borderTopRightRadius: moderateScale(20),
        paddingBottom: verticalScale(20),
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: scale(16),
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    modalTitle: {
        fontSize: moderateScale(16),
        fontWeight: "600",
        color: "#111827",
    },
    modalButton: {
        fontSize: moderateScale(16),
        color: "#6B7280",
    },
    doneButton: {
        color: "#D11B31",
        fontWeight: "600",
    },
})
