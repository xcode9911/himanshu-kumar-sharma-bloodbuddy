export const sanitizeErrorText = (
  message: unknown,
  fallback = "Something went wrong. Please try again.",
): string => {
  if (typeof message !== "string") {
    return fallback;
  }

  const cleaned = message
    .replace(/^Error:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return fallback;
  }

  if (/network request failed|failed to fetch|network error/i.test(cleaned)) {
    return "Network issue detected. Please check your connection and try again.";
  }

  if (/server error:\s*\d+/i.test(cleaned)) {
    return fallback;
  }

  return cleaned;
};

export const getUserFriendlyError = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string => {
  if (typeof error === "string") {
    return sanitizeErrorText(error, fallback);
  }

  if (error && typeof error === "object" && "message" in error) {
    return sanitizeErrorText(
      (error as { message?: unknown }).message,
      fallback,
    );
  }

  return fallback;
};
