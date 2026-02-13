import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { API_ENDPOINTS } from '../config/api';

interface EsewaPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    requestId: number;
    amount: number;
}

const EsewaPaymentModal: React.FC<EsewaPaymentModalProps> = ({
    visible,
    onClose,
    onSuccess,
    requestId,
    amount,
}) => {
    const [loading, setLoading] = useState(false);
    const [initiationData, setInitiationData] = useState<any>(null);
    const [hasVerified, setHasVerified] = useState(false);

    useEffect(() => {
        if (visible) {
            setHasVerified(false);
            initiatePayment();
        } else {
            setInitiationData(null);
            setHasVerified(false);
        }
    }, [visible]);

    const initiatePayment = async () => {
        setLoading(true);
        try {
            const authToken = await AsyncStorage.getItem("authToken");

            const response = await fetch(API_ENDPOINTS.INITIATE_ESEWA, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    requestId,
                    amount
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setInitiationData(result.initiation_data);
                console.log("eSewa Payment initiated:", result.initiation_data.transaction_uuid);
            } else {
                Alert.alert("Error", result.message || "Failed to initiate payment");
                onClose();
            }
        } catch (error) {
            console.error("eSewa Initiation Error:", error);
            Alert.alert("Error", "Network error during payment initiation");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleNavigationStateChange = (navState: any) => {
        console.log("Navigation URL:", navState.url);

        if (hasVerified) return;

        // eSewa success URL check
        if (navState.url.includes('esewa-success')) {
            console.log("eSewa success redirect detected!");
            setHasVerified(true);

            // Extract encoded data from URL
            try {
                const url = new URL(navState.url);
                const encodedData = url.searchParams.get('data');

                if (encodedData) {
                    verifyPayment(encodedData);
                } else {
                    Alert.alert("Error", "Payment confirmation data missing from URL");
                }
            } catch (error) {
                console.error("URL parsing error:", error);
                Alert.alert("Error", "Failed to parse payment confirmation");
            }
        } else if (navState.url.includes('esewa-failure')) {
            Alert.alert("Payment Failed", "The payment process was not successful.");
            onClose();
        }
    };

    const handleWebViewError = (syntheticEvent: any) => {
        const { nativeEvent } = syntheticEvent;
        console.warn('WebView error: ', nativeEvent);

        // Ignore "cancelled" navigation errors which often happen during redirects
        if (nativeEvent.code === -999 || nativeEvent.code === 'NSURLErrorCancelled') {
            return;
        }

        // Only show alert if we haven't already started the verification process
        if (!hasVerified) {
            Alert.alert(
                "Browser Error",
                `Failed to load eSewa: ${nativeEvent.description || 'Unknown error'} (${nativeEvent.code || 'N/A'})`
            );
        }
    };

    const verifyPayment = async (encodedData: string) => {
        setLoading(true);
        try {
            const authToken = await AsyncStorage.getItem("authToken");

            const response = await fetch(API_ENDPOINTS.VERIFY_ESEWA, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    encoded_data: encodedData,
                    requestId
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                Alert.alert("Success", "eSewa Payment verified successfully!");
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

    // eSewa requires a POST request to initiate. We use an auto-submitting HTML form in WebView.
    const getHtmlForm = () => {
        if (!initiationData) return '';

        return `
            <html>
                <body>
                    <form id="esewa-form" action="https://rc-epay.esewa.com.np/api/epay/main/v2/form" method="POST">
                        <input type="hidden" name="amount" value="${initiationData.amount}">
                        <input type="hidden" name="tax_amount" value="${initiationData.tax_amount}">
                        <input type="hidden" name="total_amount" value="${initiationData.total_amount}">
                        <input type="hidden" name="transaction_uuid" value="${initiationData.transaction_uuid}">
                        <input type="hidden" name="product_code" value="${initiationData.product_code}">
                        <input type="hidden" name="product_service_charge" value="${initiationData.product_service_charge}">
                        <input type="hidden" name="product_delivery_charge" value="${initiationData.product_delivery_charge}">
                        <input type="hidden" name="success_url" value="${initiationData.success_url}">
                        <input type="hidden" name="failure_url" value="${initiationData.failure_url}">
                        <input type="hidden" name="signed_field_names" value="${initiationData.signed_field_names}">
                        <input type="hidden" name="signature" value="${initiationData.signature}">
                    </form>
                    <script>
                        document.getElementById('esewa-form').submit();
                    </script>
                </body>
            </html>
        `;
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.title}>eSewa Payment</Text>
                </View>

                {loading && !initiationData ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#60bb46" />
                        <Text style={styles.loadingText}>Initiating payment...</Text>
                    </View>
                ) : initiationData ? (
                    <WebView
                        source={{ html: getHtmlForm() }}
                        onNavigationStateChange={handleNavigationStateChange}
                        onError={handleWebViewError}
                        onHttpError={handleWebViewError}
                        style={{ flex: 1 }}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                    />
                ) : null}

                {loading && initiationData && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#60bb46" />
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
        color: '#60bb46'
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
        color: '#60bb46',
        fontWeight: '600'
    }
});

export default EsewaPaymentModal;
