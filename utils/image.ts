import { API_BASE_URL } from "../config/api";

const INVALID_IMAGE_STRINGS = new Set([
  "",
  "null",
  "undefined",
  "[object Object]",
]);

const LOCAL_URL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

const LOCAL_NETWORK_IP_REGEX =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeUrlString = (url: string): string => {
  const sanitized = url.replace(/\\/g, "/");
  return encodeURI(sanitized);
};

const isLikelyLocalHost = (hostname: string): boolean => {
  const lowerHost = hostname.toLowerCase();
  return (
    LOCAL_URL_HOSTS.has(lowerHost) || LOCAL_NETWORK_IP_REGEX.test(lowerHost)
  );
};

const extractUploadsRelativePath = (rawPath: string): string | null => {
  const normalized = rawPath.replace(/\\/g, "/").trim();
  if (!normalized) return null;

  const directMatch = normalized.match(/^(?:\.\/)?(?:public\/)?uploads\/.+/i);
  if (directMatch?.[0]) {
    return directMatch[0]
      .replace(/^(?:\.\/)?/, "")
      .replace(/^public\//i, "")
      .replace(/^\/+/, "");
  }

  const embeddedMatch = normalized.match(
    /(?:^|\/)(?:public\/)?(uploads\/.+)$/i,
  );
  if (embeddedMatch?.[1]) {
    return embeddedMatch[1];
  }

  return null;
};

const buildAbsoluteImageUrl = (rawPath: string): string => {
  const candidatePath = extractUploadsRelativePath(rawPath) || rawPath;

  const normalizedPath = candidatePath
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

  const suffixStart = normalizedPath.search(/[?#]/);
  const pathOnly =
    suffixStart >= 0 ? normalizedPath.slice(0, suffixStart) : normalizedPath;
  const suffix = suffixStart >= 0 ? normalizedPath.slice(suffixStart) : "";

  const base = API_BASE_URL.replace(/\/+$/, "");
  const encodedPath = pathOnly
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(safeDecode(segment)))
    .join("/");

  return `${base}/${encodedPath}${suffix}`;
};

const remapUnreachableAbsoluteUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (!isLikelyLocalHost(parsed.hostname)) {
      return null;
    }

    const extractedPath =
      extractUploadsRelativePath(parsed.pathname) || parsed.pathname;

    return buildAbsoluteImageUrl(
      `${extractedPath}${parsed.search || ""}${parsed.hash || ""}`,
    );
  } catch {
    return null;
  }
};

const extractPathFromObject = (value: any): string | null => {
  if (!value || typeof value !== "object") return null;

  if (typeof value.path === "string") return value.path;
  if (typeof value.url === "string") return value.url;
  if (typeof value.secure_url === "string") return value.secure_url;
  if (typeof value.Location === "string") return value.Location;

  return null;
};

/**
 * Ensures an image source (URL or path) is converted to a full URL that React Native can render.
 * Handles:
 * 1. Full URLs (http/https)
 * 2. Relative paths (uploads/...)
 * 3. Stringified JSON objects containing a path (legacy)
 * 4. Image objects with a path property
 */
export const getCleanImageUrl = (imageSource: any): string | null => {
  if (!imageSource) return null;

  // If it's already a full URL
  if (typeof imageSource === "string") {
    const trimmed = imageSource.trim();
    if (INVALID_IMAGE_STRINGS.has(trimmed.toLowerCase())) {
      return null;
    }

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const remapped = remapUnreachableAbsoluteUrl(trimmed);
      if (remapped) {
        return remapped;
      }
      return normalizeUrlString(trimmed);
    }

    if (trimmed.startsWith("file://") || trimmed.startsWith("data:image/")) {
      return trimmed;
    }
  }

  // Handle stringified JSON (legacy)
  if (
    typeof imageSource === "string" &&
    (imageSource.startsWith("{") || imageSource.includes('"path":'))
  ) {
    try {
      const parsed = JSON.parse(imageSource);
      const parsedPath = extractPathFromObject(parsed);
      if (parsedPath) {
        if (
          parsedPath.startsWith("http://") ||
          parsedPath.startsWith("https://")
        ) {
          const remapped = remapUnreachableAbsoluteUrl(parsedPath);
          if (remapped) {
            return remapped;
          }
          return normalizeUrlString(parsedPath);
        }
        return buildAbsoluteImageUrl(parsedPath);
      }
    } catch (e) {
      // Fall through to treat as a regular string path
    }
  }

  // Handle object with path property
  if (typeof imageSource === "object") {
    const pathFromObject = extractPathFromObject(imageSource);
    if (pathFromObject) {
      if (
        pathFromObject.startsWith("http://") ||
        pathFromObject.startsWith("https://")
      ) {
        const remapped = remapUnreachableAbsoluteUrl(pathFromObject);
        if (remapped) {
          return remapped;
        }
        return normalizeUrlString(pathFromObject);
      }
      return buildAbsoluteImageUrl(pathFromObject);
    }
  }

  // Handle relative path string
  if (typeof imageSource === "string") {
    return buildAbsoluteImageUrl(imageSource.trim());
  }

  return null;
};
