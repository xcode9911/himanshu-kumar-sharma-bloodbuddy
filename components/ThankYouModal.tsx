import { CheckCircle, Heart, Star } from 'lucide-react-native';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { moderateScale, scale, verticalScale } from '../utils/responsive';

interface ThankYouModalProps {
    visible: boolean;
    onClose: () => void;
    message?: string;
}

const ThankYouModal: React.FC<ThankYouModalProps> = ({ visible, onClose, message }) => {
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.iconWrapper}>
                        <Heart color="#D11B31" size={moderateScale(60)} fill="#D11B31" />
                    </View>

                    <Text style={styles.title}>Hero Unlocked!</Text>
                    <Text style={styles.message}>
                        {message || "Thank you for your generous contribution. Your blood donation is a gift of life for someone in need."}
                    </Text>

                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Star color="#F59E0B" size={moderateScale(24)} fill="#F59E0B" />
                            <Text style={styles.statText}>+50 Karma</Text>
                        </View>
                        <View style={styles.statItem}>
                            <CheckCircle color="#059669" size={moderateScale(24)} fill="#059669" />
                            <Text style={styles.statText}>Verified Hero</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Keep it up!</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(25),
        padding: scale(30),
        alignItems: 'center',
        width: '100%',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    iconWrapper: {
        width: scale(100),
        height: scale(100),
        borderRadius: scale(50),
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: verticalScale(20),
    },
    title: {
        fontSize: moderateScale(24),
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: verticalScale(10),
    },
    message: {
        fontSize: moderateScale(16),
        color: '#4B5563',
        textAlign: 'center',
        lineHeight: moderateScale(22),
        marginBottom: verticalScale(25),
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: verticalScale(30),
        backgroundColor: '#F9FAFB',
        padding: scale(15),
        borderRadius: scale(15),
    },
    statItem: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: scale(8),
    },
    statText: {
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#374151',
    },
    closeButton: {
        backgroundColor: '#D11B31',
        paddingVertical: verticalScale(12),
        paddingHorizontal: scale(40),
        borderRadius: scale(30),
        width: '100%',
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#FFFFFF',
        fontSize: moderateScale(16),
        fontWeight: 'bold',
    },
});

export default ThankYouModal;
