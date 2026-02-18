import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY && process.env.NODE_ENV !== 'test') {
    console.error('GOOGLE_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(API_KEY || '');
const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
});

export interface ParsedAddress {
    name: string;
    phone: string;
    pincode: string;
    city: string;
    state: string;
    fullAddress: string;
}

const EMPTY_PARSED_ADDRESS: ParsedAddress = {
    name: '',
    phone: '',
    pincode: '',
    city: '',
    state: '',
    fullAddress: '',
};

const normalizeWhitespace = (value: string): string =>
    value.replace(/\s+/g, ' ').trim();

const sanitizeLine = (value: string): string =>
    normalizeWhitespace(value.replace(/[|]/g, ' ').replace(/\s*,\s*/g, ', '));

const extractPhone = (text: string): string => {
    const looseMatch = text.match(/(?:\+?91[\s-]*)?(?:0)?([6-9][\d\s-]{8,14}\d)/);
    if (looseMatch?.[1]) {
        const compact = looseMatch[1].replace(/\D/g, '');
        if (/^[6-9]\d{9}$/.test(compact)) return compact;
        if (compact.length >= 10) {
            const match10 = compact.match(/[6-9]\d{9}/);
            if (match10?.[0]) return match10[0];
        }
    }

    const digitsOnly = text.replace(/\D/g, '');
    const fallback = digitsOnly.match(/[6-9]\d{9}/);
    return fallback?.[0] || '';
};

const cleanPhone = (value: string, rawText: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
    if (digits.length === 11 && digits.startsWith('0')) {
        const sliced = digits.slice(1);
        if (/^[6-9]\d{9}$/.test(sliced)) return sliced;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
        const sliced = digits.slice(2);
        if (/^[6-9]\d{9}$/.test(sliced)) return sliced;
    }
    return extractPhone(rawText);
};

const extractPincode = (text: string): string => {
    const match = text.match(/\b(\d{6})\b/);
    return match?.[1] || '';
};

const cleanPincode = (value: string, rawText: string): string => {
    const pin = value.match(/\d{6}/)?.[0] || '';
    return pin || extractPincode(rawText);
};

const parseJsonFromModel = (responseText: string): Partial<ParsedAddress> | null => {
    const cleaned = responseText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

    try {
        return JSON.parse(cleaned) as Partial<ParsedAddress>;
    } catch (_error) {
        const first = cleaned.indexOf('{');
        const last = cleaned.lastIndexOf('}');
        if (first >= 0 && last > first) {
            try {
                return JSON.parse(cleaned.slice(first, last + 1)) as Partial<ParsedAddress>;
            } catch (_innerError) {
                return null;
            }
        }
        return null;
    }
};

const extractCityStateFromLabels = (rawText: string): { city: string; state: string } => {
    const cityMatch = rawText.match(/(?:city|district|dist)\s*[:\-]?\s*([A-Za-z][A-Za-z.\s]{1,40})/i);
    const stateMatch = rawText.match(/(?:state)\s*[:\-]?\s*([A-Za-z][A-Za-z.\s]{1,40})/i);

    return {
        city: cityMatch ? sanitizeLine(cityMatch[1]) : '',
        state: stateMatch ? sanitizeLine(stateMatch[1]) : '',
    };
};

const extractCityStateFromPincodeContext = (
    rawText: string,
    pincode: string,
): { city: string; state: string } => {
    if (!pincode) return { city: '', state: '' };

    const escapedPin = pincode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const commaPattern = new RegExp(
        `([A-Za-z][A-Za-z.\\s]{1,40}),\\s*([A-Za-z][A-Za-z.\\s]{1,40})\\s*[-,]?\\s*${escapedPin}`,
        'i',
    );
    const commaMatch = rawText.match(commaPattern);
    if (commaMatch) {
        return {
            city: sanitizeLine(commaMatch[1]),
            state: sanitizeLine(commaMatch[2]),
        };
    }

    const withPinPattern = new RegExp(`([A-Za-z][A-Za-z.\\s]{2,50})\\s+${escapedPin}`, 'i');
    const withPinMatch = rawText.match(withPinPattern);
    if (withPinMatch) {
        const words = sanitizeLine(withPinMatch[1]).split(' ').filter(Boolean);
        if (words.length >= 2) {
            const state = words[words.length - 1];
            const city = words.slice(Math.max(0, words.length - 3), words.length - 1).join(' ');
            return { city: sanitizeLine(city), state: sanitizeLine(state) };
        }
        return { city: sanitizeLine(withPinMatch[1]), state: '' };
    }

    return { city: '', state: '' };
};

const extractLikelyNameFromRaw = (rawText: string): string => {
    const lines = rawText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines) {
        if (line.length > 60) continue;
        if (/\d{3,}/.test(line)) continue;
        if (!/[A-Za-z]/.test(line)) continue;
        return sanitizeLine(line);
    }
    return '';
};

const normalizeFullAddress = (
    aiAddress: string,
    rawText: string,
    name: string,
    phone: string,
): string => {
    const source = (aiAddress || rawText || '').trim();
    const compact = source
        .replace(/\r/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(', ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/,\s*,/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (!compact) return '';

    let result = compact;
    if (name && !result.toLowerCase().includes(name.toLowerCase())) {
        result = `${name}, ${result}`;
    }
    if (phone && !result.includes(phone)) {
        result = `${result}, ${phone}`;
    }
    return sanitizeLine(result);
};

const normalizeParsedAddress = (
    rawParsed: Partial<ParsedAddress>,
    rawText: string,
): ParsedAddress => {
    const phone = cleanPhone(String(rawParsed.phone || ''), rawText);
    const pincode = cleanPincode(String(rawParsed.pincode || ''), rawText);
    const inferredFromLabels = extractCityStateFromLabels(rawText);
    const inferredFromPinContext = extractCityStateFromPincodeContext(rawText, pincode);

    const cityCandidate = sanitizeLine(String(rawParsed.city || ''));
    const stateCandidate = sanitizeLine(String(rawParsed.state || ''));

    const city = cityCandidate || inferredFromLabels.city || inferredFromPinContext.city || '';
    const state = stateCandidate || inferredFromLabels.state || inferredFromPinContext.state || '';

    const nameCandidate = sanitizeLine(String(rawParsed.name || ''));
    const name =
        nameCandidate && !/\d{3,}/.test(nameCandidate)
            ? nameCandidate
            : extractLikelyNameFromRaw(rawText);

    const fullAddress = normalizeFullAddress(
        sanitizeLine(String(rawParsed.fullAddress || '')),
        rawText,
        name,
        phone,
    );

    return {
        ...EMPTY_PARSED_ADDRESS,
        name,
        phone,
        pincode,
        city,
        state,
        fullAddress,
    };
};

export const parseAddressHeuristic = (text: string): ParsedAddress =>
    normalizeParsedAddress({}, text);

export const parseAddressWithGemini = async (text: string): Promise<ParsedAddress> => {
    const rawText = String(text || '').trim();
    if (!rawText) return EMPTY_PARSED_ADDRESS;

    if (!API_KEY) {
        return parseAddressHeuristic(rawText);
    }

    const prompt = `
Extract a valid Indian shipping address from the input text and return strict JSON only.
Return this exact schema:
{
  "name": "",
  "phone": "",
  "pincode": "",
  "city": "",
  "state": "",
  "fullAddress": ""
}

Rules:
- phone must be 10 digits only (remove +91, spaces, dashes).
- pincode must be a 6-digit Indian pincode.
- city and state must be plain text without extra punctuation.
- fullAddress should be complete and readable.
- If unknown, return empty string.
- Do not return markdown.

Input:
${rawText}
`.trim();

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textResponse = response.text();
        const parsed = parseJsonFromModel(textResponse) || {};
        return normalizeParsedAddress(parsed, rawText);
    } catch (error) {
        console.error('Gemini Parse Error, falling back to heuristic:', error);
        return parseAddressHeuristic(rawText);
    }
};
