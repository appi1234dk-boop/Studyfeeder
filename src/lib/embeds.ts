export function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return m ? m[1] : null;
}

export function getInstagramEmbedUrl(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  return m ? `https://www.instagram.com/p/${m[1]}/embed/` : null;
}

export function getLinkedInEmbedUrl(url: string): string | null {
  const activityMatch = url.match(/linkedin\.com\/feed\/update\/(urn:li:(?:activity|share):\d+)/);
  if (activityMatch) return `https://www.linkedin.com/embed/feed/update/${activityMatch[1]}`;
  const postMatch = url.match(/linkedin\.com\/posts\/[^/]+-(activity|share|ugcPost)-(\d+)-/);
  if (postMatch) return `https://www.linkedin.com/embed/feed/update/urn:li:${postMatch[1]}:${postMatch[2]}`;
  return null;
}

export function hasVideoEmbed(url: string): boolean {
  return !!(getYouTubeId(url) || getInstagramEmbedUrl(url) || getLinkedInEmbedUrl(url));
}
