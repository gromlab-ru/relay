/**
 * Разбирает относительные и абсолютные адреса, оставляя некорректные ссылки браузеру.
 */
export const readLinkTarget = (href: string | undefined, base: string): URL | null => {
  if (href === undefined || href === "") return null;
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
};
