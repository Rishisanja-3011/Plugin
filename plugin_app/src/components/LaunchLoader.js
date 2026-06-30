import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/theme';

export default function LaunchLoader() {
  const intro = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const current = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const currentLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(current, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(current, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    currentLoop.start();
    return () => currentLoop.stop();
  }, [current, intro, progress]);

  const contentStyle = {
    opacity: intro,
    transform: [
      {
        translateY: intro.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: intro.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1],
        }),
      },
    ],
  };

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['10%', '100%'],
  });

  const currentStyle = {
    opacity: current.interpolate({
      inputRange: [0, 0.2, 0.82, 1],
      outputRange: [0, 0.9, 0.9, 0],
    }),
    transform: [
      {
        translateX: current.interpolate({
          inputRange: [0, 1],
          outputRange: [-128, 128],
        }),
      },
    ],
  };

  return (
    <LinearGradient colors={['#1A1816', '#12110F', '#23201C']} style={styles.screen}>
      <Animated.View style={[styles.stage, contentStyle]}>
        <View style={styles.content}>
          <View style={styles.logoPlate}>
            <Image source={require('../../assets/brand-logo.png')} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={styles.loaderFrame}>
            <View style={styles.railCap} />
            <View style={styles.track}>
              <Animated.View style={[styles.fill, { width: fillWidth }]} />
              <Animated.View style={[styles.current, currentStyle]} />
            </View>
            <View style={styles.railCap} />
          </View>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#171614',
  },
  stage: {
    width: '100%',
    maxWidth: 354,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  logoPlate: {
    width: 318,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 38,
  },
  logo: {
    width: 310,
    height: 156,
    tintColor: colors.textInverse,
  },
  loaderFrame: {
    width: '82%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  railCap: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginHorizontal: 9,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  current: {
    position: 'absolute',
    top: 0,
    width: 46,
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
