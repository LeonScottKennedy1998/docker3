export const PHONE_COUNTRY_CODES = ['+7', '+375', '+380', '+1', '+44', '+49', '+33', '+90', '+86'];

export interface PhoneParts {
    countryCode: string;
    localNumber: string;
}

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const getMaxLocalPhoneLength = (countryCode: string) => {
    const codeLength = digitsOnly(countryCode).length;
    return Math.max(1, 15 - codeLength);
};

export const normalizePhoneParts = (rawPhone: string, fallbackCountryCode = '+7'): PhoneParts => {
    const digits = digitsOnly(rawPhone);

    if (!digits) {
        return { countryCode: fallbackCountryCode, localNumber: '' };
    }

    if (digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) {
        return { countryCode: '+7', localNumber: digits.slice(1, 11) };
    }

    const matchedCode = PHONE_COUNTRY_CODES
        .map((code) => digitsOnly(code))
        .sort((a, b) => b.length - a.length)
        .find((codeDigits) => digits.startsWith(codeDigits));

    if (matchedCode) {
        const countryCode = `+${matchedCode}`;
        return {
            countryCode,
            localNumber: digits.slice(matchedCode.length, matchedCode.length + getMaxLocalPhoneLength(countryCode))
        };
    }

    return {
        countryCode: fallbackCountryCode,
        localNumber: digits.slice(0, getMaxLocalPhoneLength(fallbackCountryCode))
    };
};

export const buildInternationalPhone = (countryCode: string, localNumber: string) => {
    const codeDigits = digitsOnly(countryCode);
    const localDigits = digitsOnly(localNumber).slice(0, getMaxLocalPhoneLength(countryCode));
    return codeDigits && localDigits ? `+${codeDigits}${localDigits}` : '';
};

export const isValidInternationalPhone = (countryCode: string, localNumber: string) => {
    const codeDigits = digitsOnly(countryCode);
    const fullDigits = digitsOnly(buildInternationalPhone(countryCode, localNumber));
    return codeDigits.length >= 1 && codeDigits.length <= 3 && fullDigits.length >= 10 && fullDigits.length <= 15;
};
