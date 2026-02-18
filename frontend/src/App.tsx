import { useEffect, useState, useCallback, useMemo } from 'react';
import './App.css';
import ShippingForm, { FormData } from './components/ShippingForm';
import QuoteResults from './components/QuoteResults';
import BookList from './components/BookList';
import CartPage from './components/CartPage';
import OrderFlow from './components/OrderFlow';
import OrdersPage from './components/OrdersPage';
import MessageManager from './components/MessageManager';
import SettingsPage from './components/SettingsPage';
import { useBookContext } from './context/BookContext';
import {
    fetchDropdownOptions,
    fetchShippingQuote,
    DropdownOptions,
    QuoteResponse,
} from './api/shippingApi';
import { calculateWeight, WeightResult } from './engine/weightCalculator';
import { OrderItem, OrderAddress } from './api/orderApi';

function App() {
    // Hardcoded fallback options so Calculator loads instantly
    const FALLBACK_OPTIONS: DropdownOptions = {
        pageSizes: ['A4', 'A3', 'A5', 'Letter'],
        gsmOptions: ['70', '80', '100', '130'],
        bindingTypes: ['none', 'spiral', 'perfect', 'hardbound'],
        packagingTypes: ['standard', 'reinforced'],
        printSides: ['single', 'double'],
        pageSizeBaseWeight: { A4: 5, A3: 8, A5: 3, Letter: 5 },
        gsmMultiplier: { '70': 0.9, '80': 1.0, '100': 1.25, '130': 1.6 },
        bindingWeight: { none: 0, spiral: 120, perfect: 180, hardbound: 350 },
        packagingWeight: { standard: 150, reinforced: 300 },
        couriers: [],
    };

    const [options, setOptions] = useState<DropdownOptions>(FALLBACK_OPTIONS);
    const [result, setResult] = useState<QuoteResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [mode, setMode] = useState<'calculator' | 'catalog' | 'cart' | 'order-flow' | 'orders' | 'messages' | 'settings'>('catalog');
    const { cartItemCount } = useBookContext();

    // Order flow data passed from CartPage
    const [orderFlowData, setOrderFlowData] = useState<{
        items: OrderItem[];
        booksTotal: number;
        shippingCharge: number;
        courierName: string;
        selectedCourierId?: string;
        adjustment: number;
        adjustmentType: 'discount' | 'markup';
        grandTotal: number;
        weightGrams: number;
    } | null>(() => {
        try {
            const saved = localStorage.getItem('orderFlowData');
            return saved ? JSON.parse(saved) : null;
        } catch (_error) {
            return null;
        }
    });

    // Current form values for live weight preview
    const [currentForm, setCurrentForm] = useState({
        pageCount: 10,
        printSide: 'double' as const,
        pageSize: 'A4',
        gsm: '70',
        bindingType: 'spiral',
        packagingType: 'standard',
    });

    // Persisted OrderFlow state with LocalStorage fallback
    const [orderRawText, setOrderRawText] = useState(() => localStorage.getItem('orderRawText') || '');
    const [orderAddress, setOrderAddress] = useState<OrderAddress>(() => {
        const saved = localStorage.getItem('orderAddress');
        return saved ? JSON.parse(saved) : { name: '', phone: '', pincode: '', city: '', state: '', fullAddress: '' };
    });
    const [orderNotes, setOrderNotes] = useState(() => localStorage.getItem('orderNotes') || '');

    useEffect(() => {
        if (orderFlowData) {
            localStorage.setItem('orderFlowData', JSON.stringify(orderFlowData));
        } else {
            localStorage.removeItem('orderFlowData');
        }
    }, [orderFlowData]);
    useEffect(() => { localStorage.setItem('orderRawText', orderRawText); }, [orderRawText]);
    useEffect(() => { localStorage.setItem('orderAddress', JSON.stringify(orderAddress)); }, [orderAddress]);
    useEffect(() => { localStorage.setItem('orderNotes', orderNotes); }, [orderNotes]);

    // Try to load options from backend (enhances defaults with courier list)
    useEffect(() => {
        fetchDropdownOptions()
            .then(setOptions)
            .catch(() => { }); // Silently fall back to hardcoded defaults
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

    const handleCreateOrder = (data: typeof orderFlowData) => {
        setOrderFlowData(data);
        setMode('order-flow');
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="logo">OnlinePrintout.com</div>
                <nav className="app-nav">
                    <button
                        className={mode === 'calculator' ? 'active' : ''}
                        onClick={() => setMode('calculator')}
                    >
                        🧮
                    </button>
                    <button
                        className={mode === 'catalog' ? 'active' : ''}
                        onClick={() => setMode('catalog')}
                    >
                        📚
                    </button>
                    <button
                        className={`cart-btn ${mode === 'cart' ? 'active' : ''}`}
                        onClick={() => setMode('cart')}
                    >
                        🛒 <span className="cart-badge">{cartItemCount}</span>
                    </button>
                    {orderFlowData && (
                        <button
                            className={mode === 'order-flow' ? 'active' : ''}
                            onClick={() => setMode('order-flow')}
                        >
                            🧾
                        </button>
                    )}
                    <button
                        className={mode === 'orders' ? 'active' : ''}
                        onClick={() => setMode('orders')}
                    >
                        📋
                    </button>
                    <button
                        className={mode === 'messages' ? 'active' : ''}
                        onClick={() => setMode('messages')}
                    >
                        💬
                    </button>
                    <button
                        className={mode === 'settings' ? 'active' : ''}
                        onClick={() => setMode('settings')}
                    >
                        ⚙️
                    </button>
                </nav>
            </header>

            <main className="app-main">
                {mode === 'calculator' ? (
                    <>
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
                    </>
                ) : mode === 'catalog' ? (
                    <BookList />
                ) : mode === 'cart' ? (
                    <CartPage onCreateOrder={handleCreateOrder} />
                ) : mode === 'order-flow' && orderFlowData ? (
                    <OrderFlow
                        {...orderFlowData}
                        rawText={orderRawText}
                        setRawText={setOrderRawText}
                        address={orderAddress}
                        setAddress={setOrderAddress}
                        notes={orderNotes}
                        setNotes={setOrderNotes}
                        onComplete={() => {
                            setMode('orders');
                            setOrderFlowData(null);
                            setOrderRawText('');
                            setOrderAddress({ name: '', phone: '', pincode: '', city: '', state: '', fullAddress: '' });
                            setOrderNotes('');
                            localStorage.removeItem('orderFlowData');
                            localStorage.removeItem('orderRawText');
                            localStorage.removeItem('orderAddress');
                            localStorage.removeItem('orderNotes');
                        }}
                        onCancel={() => setMode('cart')}
                    />
                ) : mode === 'messages' ? (
                    <div className="messages-standalone-container" style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
                        <MessageManager />
                    </div>
                ) : mode === 'settings' ? (
                    <SettingsPage />
                ) : (
                    <OrdersPage />
                )}
            </main>
        </div>
    );
}

export default App;
