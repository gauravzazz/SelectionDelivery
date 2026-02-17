import { useEffect, useState, useCallback, useMemo } from 'react';
import './App.css';
import ShippingForm, { FormData } from './components/ShippingForm';
import QuoteResults from './components/QuoteResults';
import {
    fetchDropdownOptions,
    fetchShippingQuote,
    DropdownOptions,
    QuoteResponse,
} from './api/shippingApi';
import { calculateWeight, WeightResult } from './engine/weightCalculator';

function App() {
    const [options, setOptions] = useState<DropdownOptions | null>(null);
    const [result, setResult] = useState<QuoteResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [optionsError, setOptionsError] = useState(false);

    // Current form values for live weight preview
    const [currentForm, setCurrentForm] = useState({
        pageCount: 10,
        printSide: 'double' as const,
        pageSize: 'A4',
        gsm: '80',
        bindingType: 'none',
        packagingType: 'standard',
    });

    // Load dropdown options + weight config from backend
    useEffect(() => {
        fetchDropdownOptions()
            .then(setOptions)
            .catch(() => setOptionsError(true));
    }, []);

    // Live weight calculation on the frontend
    const liveWeight: WeightResult | null = useMemo(() => {
        if (!options) return null;
        return calculateWeight(currentForm, {
            pageSizeBaseWeight: options.pageSizeBaseWeight,
            gsmMultiplier: options.gsmMultiplier,
            bindingWeight: options.bindingWeight,
            packagingWeight: options.packagingWeight,
        });
    }, [options, currentForm]);

    const handleFieldChange = useCallback(
        (field: string, value: string | number) => {
            setCurrentForm((prev) => ({ ...prev, [field]: value }));
        },
        [],
    );

    const handleSubmit = useCallback(
        async (data: FormData) => {
            if (!options) return;

            // Calculate weight on frontend
            const weight = calculateWeight(
                {
                    pageCount: data.pageCount,
                    printSide: data.printSide,
                    pageSize: data.pageSize,
                    gsm: data.gsm,
                    bindingType: data.bindingType,
                    packagingType: data.packagingType,
                },
                {
                    pageSizeBaseWeight: options.pageSizeBaseWeight,
                    gsmMultiplier: options.gsmMultiplier,
                    bindingWeight: options.bindingWeight,
                    packagingWeight: options.packagingWeight,
                },
            );

            setLoading(true);
            setError(null);
            setResult(null);

            try {
                const res = await fetchShippingQuote({
                    destinationPincode: data.destinationPincode,
                    weightGrams: weight.totalWeightGrams,
                    courierIds:
                        data.selectedCouriers.length > 0
                            ? data.selectedCouriers
                            : undefined,
                });
                setResult(res);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Something went wrong');
            } finally {
                setLoading(false);
            }
        },
        [options],
    );

    if (optionsError) {
        return (
            <div className="app-container">
                <div className="error-screen">
                    <div className="error-icon">⚠️</div>
                    <h2>Couldn't connect to server</h2>
                    <p>Make sure the backend is running on port 4000.</p>
                    <button className="retry-btn" onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!options) {
        return (
            <div className="app-container">
                <div className="loading-screen">
                    <div className="loader" />
                    <p>Loading configuration…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <main className="app-main">
                <ShippingForm
                    pageSizes={options.pageSizes}
                    gsmOptions={options.gsmOptions}
                    bindingTypes={options.bindingTypes}
                    packagingTypes={options.packagingTypes}
                    couriers={options.couriers}
                    weight={liveWeight}
                    loading={loading}
                    onSubmit={handleSubmit}
                    onFieldChange={handleFieldChange}
                />

                {error && (
                    <div className="error-banner">
                        <span>❌</span> {error}
                    </div>
                )}

                {result && (
                    <QuoteResults
                        cheapest={result.cheapest}
                        fastest={result.fastest}
                        allOptions={result.allOptions}
                        weightGrams={result.weightGrams}
                    />
                )}
            </main>

            <footer className="app-footer">
                PrintShip Engine · Courier-agnostic & multi-store
            </footer>
        </div>
    );
}

export default App;
