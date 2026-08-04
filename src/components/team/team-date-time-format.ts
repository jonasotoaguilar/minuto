const TIME_INPUT_PATTERN = /^(\d{1,2}):(\d{2})$/;
const DATE_DISPLAY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function decimalToHHMM(decimal: number) {
  const totalMinutes = Math.max(0, Math.round(decimal * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseHHMMInput(value: string) {
  const normalized = formatTimeInputOnBlur(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(TIME_INPUT_PATTERN);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes >= 60 ||
    hours < 0 ||
    hours > 24 ||
    (hours === 24 && minutes > 0)
  ) {
    return null;
  }

  return hours + minutes / 60;
}

export function normalizeOptionalText(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function isValidStorageDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === value;
}

export function formatTimeInputOnBlur(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const digits = trimmed.replace(/\D/g, '');

  if (/^\d{3,4}$/.test(digits) && !trimmed.includes(':')) {
    const padded = digits.padStart(4, '0');
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);

  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2].padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return trimmed;
}

export function formatDateInputOnBlur(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 8 && !trimmed.includes('/')) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
  }

  return trimmed;
}

export function formatDateForStorageFromPicker(value: Date) {
  const year = String(value.getFullYear());
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getDatePickerValue(value: string) {
  const normalized = normalizeDateForStorage(value);

  if (!normalized) {
    return new Date();
  }

  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getTodayPickerMaximumDate() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

export function getTodayStorageDate() {
  return formatDateForStorageFromPicker(new Date());
}

export function formatDateForDisplay(value: string) {
  const normalized = value.trim();
  if (!normalized || !isValidStorageDateInput(normalized)) {
    return '';
  }

  const [year, month, day] = normalized.split('-');
  return `${day}/${month}/${year}`;
}

export function normalizeDateForStorage(value: string) {
  const normalized = formatDateInputOnBlur(value);
  if (!normalized) {
    return '';
  }

  const match = normalized.match(DATE_DISPLAY_PATTERN);
  if (!match) {
    return null;
  }

  const storageValue = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidStorageDateInput(storageValue) ? storageValue : null;
}
