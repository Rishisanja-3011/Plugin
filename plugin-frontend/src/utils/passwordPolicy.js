export const PASSWORD_HINT = 'Use 12+ characters with uppercase, lowercase, a number and a special character (maximum 72 UTF-8 bytes).';

export function isStrongPassword(value) {
  if (typeof value !== 'string' || Array.from(value).length < 12) return false;
  const bytes = Array.from(value).reduce((total, char) => {
    const point = char.codePointAt(0);
    return total + (point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4);
  }, 0);
  return bytes <= 72 && /\p{Ll}/u.test(value) && /\p{Lu}/u.test(value)
    && /\p{Nd}/u.test(value) && /[^\p{L}\p{N}\s]/u.test(value);
}

