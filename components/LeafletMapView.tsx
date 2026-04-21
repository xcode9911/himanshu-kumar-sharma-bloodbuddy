import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type CameraPosition = {
  coordinates: Partial<Coordinates>;
  zoom?: number;
  duration?: number;
};

type MapMarker = {
  id?: string;
  title?: string;
  coordinates?: Partial<Coordinates>;
  color?: any;
  tintColor?: any;
  zIndex?: number;
};

type MapPolyline = {
  id?: string;
  coordinates?: Array<Partial<Coordinates>>;
  color?: any;
  width?: any;
};

type MapEvent = {
  coordinates: Coordinates;
};

export type LeafletMapHandle = {
  setCameraPosition: (cameraPosition: CameraPosition) => void;
};

type LeafletMapViewProps = {
  style?: any;
  cameraPosition?: CameraPosition;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  uiSettings?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  onMapClick?: (event: MapEvent) => void;
  onMapLongClick?: (event: MapEvent) => void;
  onMarkerClick?: (event: { id: string }) => void;
};

type WebPayload = {
  cameraPosition?: CameraPosition;
  markers: MapMarker[];
  polylines: MapPolyline[];
};

const DEFAULT_COORDINATES = {
  latitude: 27.7172,
  longitude: 85.324,
};

const normalizeCoordinates = (
  coordinates?: Partial<Coordinates>,
): Coordinates | null => {
  const latitude = Number(coordinates?.latitude);
  const longitude = Number(coordinates?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const leafletHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <style>
      html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
      body { background: #f8fafc; }
      .marker-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        border: 3px solid rgba(255,255,255,0.95);
        box-shadow: 0 4px 12px rgba(0,0,0,0.18);
        color: #ffffff;
        font-size: 18px;
        font-weight: 700;
      }
      .marker-pin {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        border: 3px solid white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.18);
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      const DEFAULT_COORDINATES = ${JSON.stringify(DEFAULT_COORDINATES)};
      const normalizeCoordinates = (coordinates) => {
        if (!coordinates) {
          return null;
        }

        const latitude = Number(coordinates.latitude);
        const longitude = Number(coordinates.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return { latitude, longitude };
      };

      const map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
      }).setView([DEFAULT_COORDINATES.latitude, DEFAULT_COORDINATES.longitude], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const markerLayer = L.layerGroup().addTo(map);
      const routeLayer = L.layerGroup().addTo(map);
      let hasCentered = false;
      let longPressTimer = null;
      let longPressTriggered = false;

      const makeMarkerIcon = (marker) => {
        const color = marker.color || marker.tintColor || '#D11B31';
        return L.divIcon({
          className: '',
            html: '<div class="marker-wrap" style="background:' + color + ';">•</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
      };

      const postMessage = (payload) => {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      };

      const invalidateMapSize = () => {
        window.requestAnimationFrame(() => {
          map.invalidateSize({ animate: false });
        });
      };

      const renderPayload = (payload) => {
        const nextMarkers = Array.isArray(payload?.markers) ? payload.markers : [];
        const nextPolylines = Array.isArray(payload?.polylines) ? payload.polylines : [];

        markerLayer.clearLayers();
        routeLayer.clearLayers();

        const cameraCoordinates = normalizeCoordinates(
          payload?.cameraPosition?.coordinates,
        );

        if (cameraCoordinates) {
          const { latitude, longitude } = cameraCoordinates;
          const zoom = payload.cameraPosition.zoom || 13;
          if (!hasCentered) {
            map.setView([latitude, longitude], zoom, { animate: false });
            hasCentered = true;
          } else {
            map.setView([latitude, longitude], zoom, { animate: false });
          }
        }

        nextPolylines.forEach((polyline) => {
          const points = Array.isArray(polyline.coordinates)
            ? polyline.coordinates
                .filter((point) => point && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)))
                .map((point) => [Number(point.latitude), Number(point.longitude)])
            : [];

          if (points.length >= 2) {
            L.polyline(points, {
              color: polyline.color || '#2563EB',
              weight: polyline.width || 6,
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(routeLayer);
          }
        });

        nextMarkers.forEach((marker) => {
          if (!marker || !marker.coordinates) {
            return;
          }

          const latitude = Number(marker.coordinates.latitude);
          const longitude = Number(marker.coordinates.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return;
          }

          const leafletMarker = L.marker([latitude, longitude], {
            icon: makeMarkerIcon(marker),
            zIndexOffset: marker.zIndex ? marker.zIndex * 100 : 0,
          }).addTo(markerLayer);

          if (marker.title) {
            leafletMarker.bindTooltip(marker.title, {
              direction: 'top',
              offset: [0, -12],
              opacity: 0.95,
            });
          }

          leafletMarker.on('click', () => {
            postMessage({ type: 'markerClick', id: marker.id || '' });
          });
        });

        if (nextMarkers.length > 0 && !cameraCoordinates) {
          const bounds = L.latLngBounds(
            nextMarkers
              .map((marker) => normalizeCoordinates(marker.coordinates))
              .filter(Boolean)
              .map((coordinates) => [coordinates!.latitude, coordinates!.longitude]),
          );
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40] });
          }
        } else if (nextPolylines.length > 0) {
          const routeBounds = L.latLngBounds(
            nextPolylines.flatMap((polyline) =>
              (polyline.coordinates || [])
                .filter((point) => point && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)))
                .map((point) => [Number(point.latitude), Number(point.longitude)]),
            ),
          );
          if (routeBounds.isValid()) {
            map.fitBounds(routeBounds, { padding: [36, 36] });
          }
        }

        invalidateMapSize();
      };

      window.__BUDDY_MAP__ = {
        update: renderPayload,
      };

      map.on('click', (event) => {
        if (longPressTriggered) {
          longPressTriggered = false;
          return;
        }

        postMessage({
          type: 'mapClick',
          coordinates: {
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          },
        });
      });

      map.on('contextmenu', (event) => {
        postMessage({
          type: 'mapLongClick',
          coordinates: {
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          },
        });
      });

      map.on('touchstart', (event) => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
        }

        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
          longPressTriggered = true;
          postMessage({
            type: 'mapLongClick',
            coordinates: {
              latitude: event.latlng.lat,
              longitude: event.latlng.lng,
            },
          });
        }, 500);
      });

      const clearLongPressTimer = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };

      map.on('touchend', clearLongPressTimer);
      map.on('touchcancel', clearLongPressTimer);
      map.on('touchmove', clearLongPressTimer);

      window.addEventListener('load', invalidateMapSize);
      window.addEventListener('resize', invalidateMapSize);

      setTimeout(() => {
        invalidateMapSize();
        postMessage({ type: 'ready' });
      }, 0);
    </script>
  </body>
</html>
`;

const serializePayload = (payload: WebPayload) => {
  return JSON.stringify(payload).replace(/</g, "\\u003c");
};

const LeafletMapView = forwardRef<LeafletMapHandle, LeafletMapViewProps>(
  (
    {
      style,
      cameraPosition,
      markers = [],
      polylines = [],
      onMapClick,
      onMapLongClick,
      onMarkerClick,
    },
    ref,
  ) => {
    const webViewRef = useRef<WebView | null>(null);
    const [isReady, setIsReady] = useState(false);
    const pendingCameraRef = useRef<CameraPosition | undefined>(cameraPosition);

    const payload = useMemo<WebPayload>(
      () => ({
        cameraPosition,
        markers,
        polylines,
      }),
      [cameraPosition, markers, polylines],
    );

    const pushPayload = () => {
      const payloadJson = serializePayload(payload);
      webViewRef.current?.injectJavaScript(
        `window.__BUDDY_MAP__ && window.__BUDDY_MAP__.update(${payloadJson}); true;`,
      );
    };

    useImperativeHandle(ref, () => ({
      setCameraPosition: (nextCameraPosition: CameraPosition) => {
        pendingCameraRef.current = nextCameraPosition;
        webViewRef.current?.injectJavaScript(
          `window.__BUDDY_MAP__ && window.__BUDDY_MAP__.update(${serializePayload(
            {
              ...payload,
              cameraPosition: nextCameraPosition,
            },
          )}); true;`,
        );
      },
    }));

    useEffect(() => {
      if (Platform.OS !== "android" || !isReady) {
        return;
      }

      pushPayload();
    }, [isReady, payload]);

    useEffect(() => {
      if (!cameraPosition) {
        return;
      }

      pendingCameraRef.current = cameraPosition;
    }, [cameraPosition]);

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={(instance) => {
            webViewRef.current = instance;
          }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mixedContentMode="always"
          source={{ html: leafletHtml, baseUrl: "https://localhost" } as any}
          onLoadEnd={() => {
            setIsReady(true);
            pushPayload();
          }}
          onError={(event) => {
            console.warn("Leaflet WebView failed to load:", event.nativeEvent);
          }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data?.type === "ready") {
                setIsReady(true);
                pushPayload();
                return;
              }

              if (data?.type === "mapClick" && data.coordinates) {
                onMapClick?.({ coordinates: data.coordinates });
                return;
              }

              if (data?.type === "mapLongClick" && data.coordinates) {
                onMapLongClick?.({ coordinates: data.coordinates });
                return;
              }

              if (data?.type === "markerClick" && data.id) {
                onMarkerClick?.({ id: data.id });
              }
            } catch (error) {
              console.warn("Leaflet map message parse failed:", error);
            }
          }}
          style={styles.webView}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
});

export default LeafletMapView;
