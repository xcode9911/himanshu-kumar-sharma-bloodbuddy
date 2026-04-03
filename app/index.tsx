import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { isDetoxTest } from '../utils/detox';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// Breakpoints
const isSmallDevice = width < 360;
const isTablet = width >= 768;

// Responsive scaling
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor *
  (isTablet ? 1.3 : isSmallDevice ? 0.8 : 1);

// Images
const images = [
  require('../assets/images/slide1.png'),
  require('../assets/images/slide2.png'),
  require('../assets/images/slide3.png'),
  require('../assets/images/slide4.png'),
  require('../assets/images/slide5.png'),
  require('../assets/images/slide6.png'),
];

function Welcome() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Skip animation if running in Detox to avoid synchronization issues
    if (isDetoxTest()) {
      return;
    }

    const animation = Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
        delay: 3000,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]);

    const loop = Animated.loop(animation);
    loop.start();

    // To update the index while looping:
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3500);

    return () => {
      loop.stop();
      clearInterval(interval);
    };
  }, []);

  const handleGetStarted = () => {
    router.push('/auth/login' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={Platform.OS === 'android' ? '#ffffff' : undefined}
      />

      <View style={styles.content}>

        {/* LOGO */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* TEXT */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Welcome to</Text>
          <Text style={styles.appTitle}>Bloodbuddy</Text>
          <Text style={styles.welcomeSubtitle}>
            Your easiest way to access blood donors and gainers
          </Text>
        </View>

        {/* SLIDER */}
        <View style={styles.imageContainer}>
          <Animated.View style={[styles.imageWrapper, { opacity: fadeAnim }]}>
            <Image
              source={images[currentIndex]}
              style={styles.slideImage}
              resizeMode="contain"
            />
          </Animated.View>

          {/* DOTS */}
          <View style={styles.dotsContainer}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  currentIndex === index ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        </View>

        {/* BUTTON */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            testID="getStartedButton"
            style={styles.getStartedButton}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.getStartedButtonText}>Get Started</Text>
              <Ionicons
                name="arrow-forward"
                size={moderateScale(20)}
                color="#fff"
                style={styles.arrowIcon}
              />
            </View>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Join thousands of donors & gainers using our services
          </Text>
        </View>

      </View>
    </View>
  );
}

// -----------------------------
// RESPONSIVE STYLES
// -----------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop:
      Platform.OS === 'android'
        ? (StatusBar.currentHeight || 0) + verticalScale(8)
        : verticalScale(24),
  },

  content: {
    flex: 1,
    paddingHorizontal: scale(isTablet ? 40 : 24),
    justifyContent: 'space-between',
    paddingBottom: verticalScale(10),
  },

  // LOGO (moved downward + increased size)
  logoContainer: {
    alignItems: 'center',
    marginTop: verticalScale(30), // pushed downward
  },
  logo: {
    width: scale(isTablet ? 180 : 120), // increased size
    height: verticalScale(isTablet ? 180 : 120),
  },

  // TEXT (moved up slightly by reducing gap)
  welcomeContainer: {
    alignItems: 'center',
    marginTop: verticalScale(0), // reduced gap
  },
  welcomeTitle: {
    fontSize: moderateScale(isTablet ? 34 : 26), // slightly increased
    color: '#4b5563',
    fontWeight: '300',
  },
  appTitle: {
    fontSize: moderateScale(isTablet ? 46 : 34), // slightly increased
    color: '#D11B31',
    fontWeight: '700',
    marginTop: verticalScale(4),
  },
  welcomeSubtitle: {
    fontSize: moderateScale(isTablet ? 20 : 16),
    color: '#6b7280',
    textAlign: 'center',
    marginTop: verticalScale(8),
    paddingHorizontal: scale(20),
  },

  // Slider
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(10),
  },
  imageWrapper: {
    width: width * 0.75,
    height: height * 0.3,
    maxHeight: verticalScale(330),
    justifyContent: 'center',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },

  dotsContainer: {
    flexDirection: 'row',
    marginTop: verticalScale(12),
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    marginHorizontal: scale(5),
  },
  activeDot: {
    width: scale(22),
    backgroundColor: '#D11B31',
  },
  inactiveDot: {
    backgroundColor: '#d1d5db',
  },

  // BUTTON
  buttonContainer: {
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  getStartedButton: {
    backgroundColor: '#D11B31',
    borderRadius: moderateScale(30),
    paddingVertical: verticalScale(isSmallDevice ? 12 : 16),
    paddingHorizontal: scale(isTablet ? 80 : 60),
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  getStartedButtonText: {
    color: '#fff',
    fontSize: moderateScale(isTablet ? 24 : 20),
    fontWeight: '600',
  },
  arrowIcon: {
    marginLeft: scale(6),
  },

  footerText: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(isTablet ? 18 : 14),
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default Welcome;
