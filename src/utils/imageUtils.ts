/**
 * Consistent image URL construction for the application.
 * Preference order:
 * 1. Full URLs (starting with http/https)
 * 2. Relative paths prefixed with API_URL environment variable
 * 3. Fallback to a sensible default if API_URL is missing
 */
export const getFullImageUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  
  // If it's already a full URL, return it as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Normalize the path (replace double slashes and ensure leading slash isn't doubled)
  let normalizedPath = path.replace(/\\/g, '/');
  if (normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.substring(1);
  }
  
  // Use API_URL from env or fallback to a sensible default.
  // Note: Render will have API_URL set by the user once they follow instructions.
  const baseUrl = process.env.API_URL || "http://192.168.1.65:8000";
  
  // Ensure base URL doesn't end with a slash to avoid double slashes
  const trimmedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  return `${trimmedBaseUrl}/${normalizedPath}`;
};
