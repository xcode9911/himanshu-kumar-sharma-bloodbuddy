import React, { useMemo } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { moderateScale, scale, verticalScale } from "../utils/responsive";

interface Location {
    lat: number;
    lng: number;
}

interface MapModalProps {
    visible: boolean;
    onClose: () => void;
    donorLocation: Location | null;
    gainerLocation: Location | null;
    donorName?: string;
    gainerName?: string;
}

export default function MapModal({
    visible,
    onClose,
    donorLocation,
    gainerLocation,
    donorName = "Donor",
    gainerName = "Gainer"
}: MapModalProps) {

    const mapHtml = useMemo(() => {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Live Tracking</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
    <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .custom-div-icon {
            background: none;
            border: none;
        }
        .marker-pin {
            width: 30px;
            height: 30px;
            border-radius: 50% 50% 50% 0;
            background: #D11B31;
            position: absolute;
            transform: rotate(-45deg);
            left: 50%;
            top: 50%;
            margin: -15px 0 0 -15px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
        .marker-pin::after {
            content: '';
            width: 20px;
            height: 20px;
            margin: 0;
            background: white;
            position: absolute;
            border-radius: 50%;
        }
        .marker-pin.gainer { background: #2563EB; }
        .marker-pin.donor { background: #D11B31; }
        .icon-text {
            transform: rotate(45deg);
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .gainer .icon-text { color: #2563EB; font-weight: bold; font-size: 10px; }
        .leaflet-routing-container { display: none !important; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        var map = L.map('map').setView([27.7172, 85.3240], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        setTimeout(function() { map.invalidateSize(); }, 500);
        window.addEventListener('resize', function() { map.invalidateSize(); });

        var donorMarker, gainerMarker, routingControl;
        var currentDonorLoc = null;
        var currentGainerLoc = null;

        function isValid(loc) {
            return loc && (loc.lat !== 0 || loc.lng !== 0) && loc.lat !== null && loc.lng !== null;
        }

        function updateMarkers(donorLoc, gainerLoc) {
            if (isValid(donorLoc)) currentDonorLoc = donorLoc;
            if (isValid(gainerLoc)) currentGainerLoc = gainerLoc;

            var markers = [];
            
            if (currentDonorLoc) {
                if (!donorMarker) {
                    var donorIcon = L.divIcon({
                        className: 'custom-div-icon',
                        html: "<div class='marker-pin donor'><span class='icon-text'><svg width='14' height='14' viewBox='0 0 24 24' fill='white'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' /></svg></span></div>",
                        iconSize: [30, 42],
                        iconAnchor: [15, 42]
                    });
                    donorMarker = L.marker([currentDonorLoc.lat, currentDonorLoc.lng], {icon: donorIcon}).addTo(map).bindPopup("<b>Donor:</b> ${donorName}");
                } else {
                    donorMarker.setLatLng([currentDonorLoc.lat, currentDonorLoc.lng]);
                }
                markers.push(donorMarker);
            }

            if (currentGainerLoc) {
                if (!gainerMarker) {
                    var gainerIcon = L.divIcon({
                        className: 'custom-div-icon',
                        html: "<div class='marker-pin gainer'><span class='icon-text'><svg width='14' height='14' viewBox='0 0 24 24' fill='white'><path d='M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'/></svg></span></div>",
                        iconSize: [30, 42],
                        iconAnchor: [15, 42]
                    });
                    gainerMarker = L.marker([currentGainerLoc.lat, currentGainerLoc.lng], {icon: gainerIcon}).addTo(map).bindPopup("<b>Gainer:</b> ${gainerName}");
                } else {
                    gainerMarker.setLatLng([currentGainerLoc.lat, currentGainerLoc.lng]);
                }
                markers.push(gainerMarker);
            }

            // Route Logic
            if (currentDonorLoc && currentGainerLoc && window.L && L.Routing) {
                try {
                    if (routingControl) {
                        routingControl.setWaypoints([
                            L.latLng(currentDonorLoc.lat, currentDonorLoc.lng),
                            L.latLng(currentGainerLoc.lat, currentGainerLoc.lng)
                        ]);
                    } else {
                        routingControl = L.Routing.control({
                            waypoints: [
                                L.latLng(currentDonorLoc.lat, currentDonorLoc.lng),
                                L.latLng(currentGainerLoc.lat, currentGainerLoc.lng)
                            ],
                            show: false,
                            addWaypoints: false,
                            draggableWaypoints: false,
                            fitSelectedRoutes: true,
                            lineOptions: {
                                styles: [{ color: '#D11B31', opacity: 0.6, weight: 6 }]
                            },
                            createMarker: function() { return null; }
                        }).addTo(map);
                    }
                } catch (e) {
                    console.log("Routing error:", e);
                }
            }

            if (markers.length > 0) {
                var group = new L.featureGroup(markers);
                map.fitBounds(group.getBounds().pad(0.3), { animate: true });
            }
        }

        window.addEventListener('message', function(event) {
            var data = JSON.parse(event.data);
            if (data.type === 'update') {
                updateMarkers(data.donorLocation, data.gainerLocation);
            }
        });

        // Initialize with initial data if available
        document.addEventListener("DOMContentLoaded", function() {
             var initialData = ${JSON.stringify({ donorLocation, gainerLocation })};
             if (isValid(initialData.donorLocation) || isValid(initialData.gainerLocation)) {
                 updateMarkers(initialData.donorLocation, initialData.gainerLocation);
             }
        });
    </script>
</body>
</html>
        `;
    }, [donorLocation, gainerLocation, donorName, gainerName]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <View style={styles.modalContent}>
                    <View style={styles.modalHandle} />
                    <Text style={styles.title}>Live Tracking</Text>
                    <Text style={styles.subtitle}>Real-time tracking of donor and gainer</Text>

                    <View style={styles.mapContainer}>
                        {!donorLocation && !gainerLocation ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#D11B31" />
                                <Text style={styles.loadingText}>Waiting for location signal...</Text>
                            </View>
                        ) : (
                            <WebView
                                originWhitelist={['*']}
                                source={{ html: mapHtml }}
                                style={styles.webview}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                            />
                        )}
                    </View>

                    <View style={styles.footer}>
                        <View style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: "#D11B31" }]} />
                            <Text style={styles.legendText}>Donor: {donorName}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.routeLine]} />
                            <Text style={styles.legendText}>Route</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: "#2563EB" }]} />
                            <Text style={styles.legendText}>Gainer: {gainerName}</Text>
                        </View>
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
        width: "100%",
        height: "85%",
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: moderateScale(26),
        borderTopRightRadius: moderateScale(26),
        overflow: "hidden",
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
        marginTop: verticalScale(10),
        marginBottom: verticalScale(10),
    },
    title: {
        fontSize: moderateScale(20),
        fontWeight: "800",
        color: "#D11B31",
        textAlign: "center",
    },
    subtitle: {
        fontSize: moderateScale(13),
        color: "#6B7280",
        textAlign: "center",
        marginBottom: verticalScale(12),
    },
    mapContainer: {
        flex: 1,
        backgroundColor: "#F3F4F6",
    },
    webview: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: verticalScale(12),
        fontSize: moderateScale(14),
        color: "#6B7280",
    },
    footer: {
        padding: scale(16),
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#F3F4F6",
        flexDirection: "row",
        justifyContent: "space-around",
        paddingBottom: verticalScale(24),
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    routeLine: {
        width: 24,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#D11B31",
        opacity: 0.6,
        marginRight: 8,
    },
    legendText: {
        fontSize: moderateScale(11),
        color: "#4B5563",
        fontWeight: "500",
    },
});
