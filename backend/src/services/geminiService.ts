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

/**
 * Uses Gemini to generate a beautiful SVG cover page for PDF splitting.
 * The cover includes abstract modern art and onlineprintout.com in the footer.
 */
export const generateCoverImageSvg = async (
    title?: string,
): Promise<string> => {
    const displayTitle = title || 'Document';

    const prompt = `
Generate a single, self-contained SVG image that will be used as a cover page for a PDF document.

Requirements:
- Canvas size: exactly 595x842 (A4 portrait in points).
- Use a modern, premium gradient background (deep navy to dark purple or similar elegant dark palette).
- Add beautiful abstract geometric shapes (circles, lines, subtle polygons) with soft glows and transparency for a modern premium feel.
- Display the title "${displayTitle}" centered in the upper-middle area, white bold text, roughly 28px font, font-family 'Helvetica Neue, Arial, sans-serif'.
- At the very bottom center, add footer text "onlineprintout.com" in a muted light color (e.g., rgba(255,255,255,0.5)), font-size ~14px.
- The SVG must be valid, self-contained, and NOT reference any external resources.
- Do NOT include any markdown fences.  Return ONLY the raw SVG starting with <svg and ending with </svg>.
`.trim();

    if (!API_KEY) {
        // Return a static fallback SVG if no API key
        return getFallbackCoverSvg(displayTitle);
    }

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        // Extract the SVG from the response
        const svgStart = text.indexOf('<svg');
        const svgEnd = text.lastIndexOf('</svg>');
        if (svgStart >= 0 && svgEnd > svgStart) {
            return text.slice(svgStart, svgEnd + 6);
        }

        console.warn('Gemini did not return valid SVG, using fallback.');
        return getFallbackCoverSvg(displayTitle);
    } catch (error) {
        console.error('Gemini Cover Generation Error:', error);
        return getFallbackCoverSvg(displayTitle);
    }
};

/** High-quality static fallback SVG cover */
const getFallbackCoverSvg = (title: string): string => `
<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f0c29"/>
      <stop offset="50%" stop-color="#302b63"/>
      <stop offset="100%" stop-color="#24243e"/>
    </linearGradient>
    <radialGradient id="glow1" cx="30%" cy="40%" r="45%">
      <stop offset="0%" stop-color="rgba(120,80,255,0.25)"/>
      <stop offset="100%" stop-color="rgba(120,80,255,0)"/>
    </radialGradient>
    <radialGradient id="glow2" cx="75%" cy="65%" r="40%">
      <stop offset="0%" stop-color="rgba(0,200,180,0.2)"/>
      <stop offset="100%" stop-color="rgba(0,200,180,0)"/>
    </radialGradient>
  </defs>
  <rect width="595" height="842" fill="url(#bg)"/>
  <rect width="595" height="842" fill="url(#glow1)"/>
  <rect width="595" height="842" fill="url(#glow2)"/>
  <circle cx="150" cy="300" r="120" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
  <circle cx="450" cy="550" r="90" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1.5"/>
  <line x1="50" y1="200" x2="545" y2="200" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <line x1="50" y1="650" x2="545" y2="650" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <polygon points="297,100 370,220 224,220" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1.5"/>
  <text x="297.5" y="400" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff">${title}</text>
  <text x="297.5" y="810" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.5)">onlineprintout.com</text>
</svg>
`.trim();
