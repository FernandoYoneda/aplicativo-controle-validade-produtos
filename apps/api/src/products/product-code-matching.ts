const EAN_13_PATTERN = /^\d{13}$/;

export function extractEmbeddedProductCodeFromEan13(
  value: string,
): string | null {
  const ean13 = value.trim();

  if (!EAN_13_PATTERN.test(ean13)) {
    return null;
  }

  const digits = [...ean13].map(Number);
  const weightedSum = digits
    .slice(0, 12)
    .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0);
  const expectedCheckDigit = (10 - (weightedSum % 10)) % 10;

  if (digits[12] !== expectedCheckDigit) {
    return null;
  }

  return ean13.slice(-6, -1);
}
