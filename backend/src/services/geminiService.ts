import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
    console.error('GOOGLE_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export interface ParsedAddress {
    name: string;
    phone: string;
    pincode: string;
    city: string;
    state: string;
    fullAddress: string;
}

export const parseAddressWithGemini = async (text: string): Promise<ParsedAddress> => {
    if (!API_KEY) throw new Error('Gemini API Key missing');

    const prompt = `
    Extract the following shipping address details from the text below into a JSON object.
    Fields:
    - name (person's name, if missing use empty string)
    - phone (10 digit mobile number, remove +91/0 prefix)
    - pincode (6 digit postal code)
    - city
    - state
    - fullAddress (clean, formatted complete address including name and phone)

    Text:
    "${text}"

    Return ONLY the JSON object.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textResponse = response.text();

        // Clean markdown code blocks if present
        const jsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr) as ParsedAddress;
    } catch (error) {
        console.error('Gemini Parse Error:', error);
        throw new Error('Failed to parse address with AI');
    }
};
