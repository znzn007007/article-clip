import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

const IMAGE_ATTRS = ['data-original', 'data-actualsrc', 'data-src', 'src'];

export function normalizeZhihuImageUrl(url: string): string {
  const normalized = url.startsWith('//') ? `https:${url}` : url;

  return normalized
    .replace(/_b\.(jpg|png|webp)/, '_r.$1')
    .replace(/\/\d+_\d+_\//, '/2000_2000/');
}

export function pickZhihuImageUrl(
  getAttr: (name: string) => string | undefined
): string | null {
  for (const attr of IMAGE_ATTRS) {
    const raw = getAttr(attr)?.trim();
    if (raw && isContentImageUrl(raw)) {
      return normalizeZhihuImageUrl(raw);
    }
  }

  return null;
}

export function extractZhihuImagesFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const images: string[] = [];
  const seen = new Set<string>();

  $('img').each((_, img) => {
    const url = pickZhihuImageUrl(attr => $(img).attr(attr));
    if (url && !seen.has(url)) {
      seen.add(url);
      images.push(url);
    }
  });

  return images;
}

export function pickZhihuImageUrlFromElement(
  $: CheerioAPI,
  node: Element
): string | null {
  return pickZhihuImageUrl(attr => $(node).attr(attr));
}

function isContentImageUrl(url: string): boolean {
  const lower = url.toLowerCase();

  if (lower.startsWith('data:')) return false;
  if (lower.includes('avatar')) return false;
  if (lower.includes('placeholder')) return false;
  if (/\.svg(?:[?#]|$)/.test(lower)) return false;

  return true;
}
