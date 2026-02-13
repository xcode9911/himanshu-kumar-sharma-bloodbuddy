import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { API_ENDPOINTS } from '../config/api';

interface KhaltiPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    requestId: number;
    amount: number;
    productName: string;
}

const KhaltiPaymentModal: React.FC<KhaltiPaymentModalProps> = ({
    visible,
    onClose,
    onSuccess,
    requestId,
    amount,
    productName,
}) => {
    const [loading, setLoading] = useState(false);
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
    const [pidx, setPidx] = useState<string | null>(null);
    const [hasVerified, setHasVerified] = useState(false);

    useEffect(() => {
        if (visible) {
            setHasVerified(false);
            initiatePayment();
        } else {
            // Reset state when modal closes
            setPaymentUrl(null);
            setPidx(null);
            setHasVerified(false);
        }
    }, [visible]);

    const initiatePayment = async () => {
        setLoading(true);
        try {
            const authToken = await AsyncStorage.getItem("authToken");

            const response = await fetch(API_ENDPOINTS.INITIATE_KHALTI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    requestId,
                    amount,
                    productName
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setPaymentUrl(result.payment_url);
                setPidx(result.pidx);
                console.log("Payment initiated, pidx:", result.pidx);
            } else {
                Alert.alert("Error", result.message || "Failed to initiate payment");
                onClose();
            }
        } catch (error) {
            console.error("Payment Initiation Error:", error);
            Alert.alert("Error", "Network error during payment initiation");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleNavigationStateChange = (navState: any) => {
        console.log("Navigation URL:", navState.url);

        // Only verify once and only when we reach the callback URL
        if (hasVerified) {
            console.log("Already verified, skipping");
            return;
        }

        // Check if user was redirected to return_url (khalti-callback)
        // Must have BOTH /khalti-callback AND pidx= to be the actual callback
        if (navState.url.includes('/khalti-callback') && navState.url.includes('pidx=')) {
            console.log("Khalti callback detected!");
            setHasVerified(true);

            // Extract pidx from URL
            try {
                const url = new URL(navState.url);
                const urlPidx = url.searchParams.get('pidx');
                console.log("Extracted pidx from URL:", urlPidx);

                if (urlPidx) {
                    console.log("Calling verifyPayment with pidx:", urlPidx);
                    verifyPayment(urlPidx);
                } else if (pidx) {
                    console.log("Using stored pidx:", pidx);
                    verifyPayment(pidx);
                }
            } catch (error) {
                console.log("URL parsing error, using stored pidx:", pidx);
                if (pidx) {
                    verifyPayment(pidx);
                }
            }
        }
    };

    const verifyPayment = async (paymentPidx: string) => {
        setLoading(true);
        console.log("Verifying payment with pidx:", paymentPidx);
        try {
            const authToken = await AsyncStorage.getItem("authToken");

            const response = await fetch(API_ENDPOINTS.VERIFY_KHALTI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    pidx: paymentPidx,
                    requestId
                })
            });

            const result = await response.json();
            console.log("Verification response:", result);

            if (response.ok && result.success) {
                Alert.alert("Success", "Payment verified successfully!");
                onSuccess();
                onClose();
            } else {
                Alert.alert("Verification Failed", result.message || "Could not verify payment");
            }
        } catch (error) {
            console.error("Verification Error:", error);
            Alert.alert("Error", "Network error during verification");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Khalti Payment</Text>
                </View>

                {loading && !paymentUrl ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#D32F2F" />
                        <Text style={styles.loadingText}>Initiating payment...</Text>
                    </View>
                ) : paymentUrl ? (
                    <WebView
                        source={{ uri: paymentUrl }}
                        onNavigationStateChange={handleNavigationStateChange}
                        style={{ flex: 1 }}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                    />
                ) : null}

                {loading && paymentUrl && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#D32F2F" />
                        <Text style={styles.loadingText}>Verifying Payment...</Text>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        marginTop: 40
    },
    closeButton: {
        padding: 5,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 15,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingText: {
        marginTop: 10,
        color: '#D32F2F',
        fontWeight: '600'
    }
});

export default KhaltiPaymentModal;
