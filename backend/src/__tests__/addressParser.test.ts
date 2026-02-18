import { parseAddressHeuristic } from '../services/geminiService';

describe('parseAddressHeuristic', () => {
    it('extracts phone and pincode from a simple multi-line address', () => {
        const parsed = parseAddressHeuristic(
            [
                'Rahul Sharma',
                '+91 98765 43210',
                'Flat 21, MG Road',
                'Kolkata, West Bengal - 700001',
            ].join('\n'),
        );

        expect(parsed.name).toBe('Rahul Sharma');
        expect(parsed.phone).toBe('9876543210');
        expect(parsed.pincode).toBe('700001');
        expect(parsed.city.toLowerCase()).toContain('kolkata');
        expect(parsed.state.toLowerCase()).toContain('west bengal');
        expect(parsed.fullAddress.length).toBeGreaterThan(10);
    });

    it('handles address text with labels', () => {
        const parsed = parseAddressHeuristic(
            'Name: Priya Singh, Phone: 9123456789, City: Pune, State: Maharashtra, PIN: 411030',
        );

        expect(parsed.phone).toBe('9123456789');
        expect(parsed.pincode).toBe('411030');
        expect(parsed.city.toLowerCase()).toContain('pune');
        expect(parsed.state.toLowerCase()).toContain('maharashtra');
    });
});

