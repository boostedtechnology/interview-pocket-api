import type { UrlMetadata } from '../types/index.js';

// In-memory cache for URL metadata
// NOTE: No eviction policy - memory grows unbounded (Issue #10)
const metadataCache = new Map<string, UrlMetadata>();

/**
 * Parses HTML content to extract title and description
 */
function parseHtml(html: string): UrlMetadata {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || '';

  // Extract meta description
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  );
  const description = descMatch?.[1]?.trim() || '';

  return { title, description };
}

/**
 * Fetches metadata from a URL
 * NOTE: This is called synchronously during bookmark creation (Issue #6)
 * NOTE: Errors are swallowed without logging (Issue #9)
 */
export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  // Check cache first
  const cached = metadataCache.get(url);
  if (cached) {
    return cached;
  }

  try {
    // Synchronous fetch - blocks while waiting for response
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BoostedPocket/1.0',
      },
    });

    if (!response.ok) {
      // Silent failure - just return URL as title
      return { title: url, description: '' };
    }

    const html = await response.text();
    const metadata = parseHtml(html);

    // Use URL as fallback title if parsing failed
    const result: UrlMetadata = {
      title: metadata.title || url,
      description: metadata.description,
    };

    // Cache forever - no TTL or eviction (Issue #10)
    metadataCache.set(url, result);

    return result;
  } catch {
    // Swallow all errors - no logging or indication of failure (Issue #9)
    return { title: url, description: '' };
  }
}

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
