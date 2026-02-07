// SVGR config for TypeScript/React Native SVG imports
/// <reference types="react-native-svg" />
declare module "*.svg" {
  import * as React from "react";
    import { SvgProps } from "react-native-svg";
  const content: React.FC<SvgProps>;
  export default content;
}
