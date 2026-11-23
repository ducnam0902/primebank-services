export const ACCOUNT_NUMBER_LENGTH = 13;

export function computeLuhnCheckDigit(payload: string): number {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    let digit = Number(payload[payload.length - 1 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}

export function withCheckDigit(payload: string): string {
  const checkDigit = computeLuhnCheckDigit(payload);
  return payload + checkDigit.toString();
}

export function isValidAccountNumber(value: string): boolean {
  if (!new RegExp(`^\\d{${ACCOUNT_NUMBER_LENGTH}}$`).test(value)) return false;
  const payload = value.slice(0, -1);
  return computeLuhnCheckDigit(payload) === Number(value[value.length - 1]);
}
