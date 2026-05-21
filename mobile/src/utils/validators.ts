/** Не строже типичной проверки email в формах. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Как на бэкенде в AuthController для телефона. */
const PHONE_RE = /^[+]?[0-9\s\-()]{10,15}$/;

export function validateTrimmedPresence(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} обязательно`;
}

export function validateEmail(value: string): string | undefined {
  const t = value.trim();
  if (!t) return 'Укажите email';
  if (!EMAIL_RE.test(t)) return 'Некорректный формат email';
}

export function validatePassword(length: number, value: string): string | undefined {
  if (value.length < length) return `Пароль не короче ${length} символов`;
}

export function validatePhone(value: string): string | undefined {
  const t = value.trim();
  if (!t) return 'Укажите телефон';
  if (!PHONE_RE.test(t)) return 'Неверный формат телефона (10–15 цифр, можно +)';
}

export function validateDigitCode(value: string, len: number, label = 'Код'): string | undefined {
  const d = value.trim().replace(/\D/g, '');
  if (d.length !== len) return `${label}: введите ${len} цифр`;
}
