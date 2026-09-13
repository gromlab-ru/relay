/** Пользовательский текст не может управлять терминалом через ANSI/OSC-последовательности. */
export function safeText(value: string): string {
  return value.replace(
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
