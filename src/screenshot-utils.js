export function isRenderableImageUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    const lower = parsed.pathname.toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)(?:\?.*)?$/i.test(lower) || lower.includes('/screenshots/');
  } catch (error) {
    return false;
  }
}

export function normalizeScreenshotUrl(rawUrl) {
  const value = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!value) return '';

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.replace(/^www\./i, '');
    const pathname = parsed.pathname.replace(/\/+$/, '');

    if (host === 'gocharting.com') {
      const shareMatch = pathname.match(/^\/sh\/([^/?#]+)/i);
      if (shareMatch?.[1]) {
        return `https://gocharting.com/screenshots/${shareMatch[1]}.png`;
      }
    }

    if (host === 'tradingview.com' || host === 'www.tradingview.com') {
      const sharePattern = /^\/(?:x|chart)\//i;
      if (sharePattern.test(pathname)) {
        return parsed.toString();
      }
    }

    return parsed.toString();
  } catch (error) {
    return withProtocol;
  }
}
