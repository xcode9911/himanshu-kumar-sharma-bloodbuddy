import { Dimensions } from "react-native"

const { width, height } = Dimensions.get("window")

export const isSmallDevice = width < 360
export const isTablet = width >= 768

export const scale = (size: number) => (width / 375) * size
export const verticalScale = (size: number) => (height / 812) * size
export const moderateScale = (size: number, factor = 0.5) => {
  const scaled = scale(size)
  const adjusted = size + (scaled - size) * factor * (isTablet ? 1.3 : isSmallDevice ? 0.8 : 1)
  return adjusted
}
