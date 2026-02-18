import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Book, BookService } from '../api/bookApi';

export type BookVariant = 'color' | 'bw';

export interface CartItem {
    bookId: string;
    variant: BookVariant;
    quantity: number;
}

export interface CustomCartItem {
    id: string;
    title: string;
    quantity: number;
    pageCount: number;
    unitPrice: number;
    unitWeightGrams: number;
    printMode: 'color' | 'bw';
    pageSize: string;
    gsm: string;
    paperType: string;
    bindingType: string;
}

interface BookContextType {
    books: Book[];
    cart: CartItem[];
    customCart: CustomCartItem[];
    loading: boolean;
    isAdmin: boolean;
    hasMoreBooks: boolean;
    loadingMoreBooks: boolean;
    refreshBooks: () => Promise<void>;
    loadMoreBooks: () => Promise<void>;
    addToCart: (bookId: string, variant: BookVariant) => void;
    removeFromCart: (bookId: string, variant: BookVariant) => void;
    updateQuantity: (bookId: string, variant: BookVariant, delta: number) => void;
    addCustomToCart: (item: Omit<CustomCartItem, 'id'>) => string;
    updateCustomItem: (id: string, updates: Partial<Omit<CustomCartItem, 'id'>>) => void;
    updateCustomQuantity: (id: string, delta: number) => void;
    removeCustomFromCart: (id: string) => void;
    clearCart: () => void;
    toggleAdmin: () => void;
    getCartDetails: () => { book: Book; variant: BookVariant; quantity: number }[];
    totals: {
        price: number;
        pages: number;
        weight: number;
    };
    cartItemCount: number;
}

const BookContext = createContext<BookContextType | undefined>(undefined);

const BOOK_PAGE_SIZE = 250;
const CART_BOOK_CACHE_KEY = 'cartBookCache';

type BookMap = Record<string, Book>;

function mergeBooksToMap(prev: BookMap, books: Book[]): BookMap {
    const next: BookMap = { ...prev };
    for (const book of books) {
        next[book.id] = book;
    }
    return next;
}

export const BookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [books, setBooks] = useState<Book[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMoreBooks, setHasMoreBooks] = useState(true);
    const [loadingMoreBooks, setLoadingMoreBooks] = useState(false);

    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const saved = localStorage.getItem('cart');
            return saved ? JSON.parse(saved) : [];
        } catch (_error) {
            return [];
        }
    });
    const [customCart, setCustomCart] = useState<CustomCartItem[]>(() => {
        try {
            const saved = localStorage.getItem('customCart');
            return saved ? JSON.parse(saved) : [];
        } catch (_error) {
            return [];
        }
    });
    const [bookLookup, setBookLookup] = useState<BookMap>(() => {
        try {
            const saved = localStorage.getItem(CART_BOOK_CACHE_KEY);
            return saved ? (JSON.parse(saved) as BookMap) : {};
        } catch (_error) {
            return {};
        }
    });
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem('cart', JSON.stringify(cart));
        } catch (error) {
            console.error('Failed to save cart', error);
        }
    }, [cart]);

    useEffect(() => {
        try {
            localStorage.setItem('customCart', JSON.stringify(customCart));
        } catch (error) {
            console.error('Failed to save custom cart', error);
        }
    }, [customCart]);

    useEffect(() => {
        try {
            localStorage.setItem(CART_BOOK_CACHE_KEY, JSON.stringify(bookLookup));
        } catch (error) {
            console.error('Failed to save cart book cache', error);
        }
    }, [bookLookup]);

    const refreshBooks = async () => {
        try {
            setLoading(true);
            const page = await BookService.getBooksPage(BOOK_PAGE_SIZE);
            setBooks(page.books);
            setCursor(page.nextCursor);
            setHasMoreBooks(page.hasMore);
            setBookLookup((prev) => mergeBooksToMap(prev, page.books));
        } catch (error) {
            console.error('Failed to fetch books:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMoreBooks = async () => {
        if (loadingMoreBooks || loading || !hasMoreBooks) return;
        try {
            setLoadingMoreBooks(true);
            const page = await BookService.getBooksPage(BOOK_PAGE_SIZE, cursor);
            setBooks((prev) => {
                const seen = new Set(prev.map((book) => book.id));
                const uniqueAppend = page.books.filter((book) => !seen.has(book.id));
                return [...prev, ...uniqueAppend];
            });
            setCursor(page.nextCursor);
            setHasMoreBooks(page.hasMore);
            setBookLookup((prev) => mergeBooksToMap(prev, page.books));
        } catch (error) {
            console.error('Failed to load more books:', error);
        } finally {
            setLoadingMoreBooks(false);
        }
    };

    useEffect(() => {
        refreshBooks();
    }, []);

    useEffect(() => {
        const missingIds = Array.from(
            new Set(
                cart
                    .map((item) => item.bookId)
                    .filter((bookId) => Boolean(bookId) && !bookLookup[bookId]),
            ),
        );

        if (missingIds.length === 0) return;

        let cancelled = false;
        (async () => {
            try {
                const fetched = await BookService.getBooksByIds(missingIds);
                if (cancelled || fetched.length === 0) return;
                setBookLookup((prev) => mergeBooksToMap(prev, fetched));
            } catch (error) {
                console.error('Failed to hydrate missing cart books:', error);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [cart, bookLookup]);

    const addToCart = (bookId: string, variant: BookVariant) => {
        const selected = books.find((book) => book.id === bookId);
        if (selected) {
            setBookLookup((prev) => ({ ...prev, [selected.id]: selected }));
        }

        setCart((prev) => {
            const existing = prev.find((item) => item.bookId === bookId && item.variant === variant);
            if (existing) {
                return prev.map((item) =>
                    item.bookId === bookId && item.variant === variant
                        ? { ...item, quantity: item.quantity + 1 }
                        : item,
                );
            }
            return [...prev, { bookId, variant, quantity: 1 }];
        });
    };

    const removeFromCart = (bookId: string, variant: BookVariant) => {
        setCart((prev) => prev.filter((item) => !(item.bookId === bookId && item.variant === variant)));
    };

    const updateQuantity = (bookId: string, variant: BookVariant, delta: number) => {
        setCart((prev) =>
            prev
                .map((item) => {
                    if (item.bookId === bookId && item.variant === variant) {
                        const nextQty = Math.max(0, item.quantity + delta);
                        return { ...item, quantity: nextQty };
                    }
                    return item;
                })
                .filter((item) => item.quantity > 0),
        );
    };

    const addCustomToCart = (item: Omit<CustomCartItem, 'id'>): string => {
        const id = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        setCustomCart((prev) => [...prev, { id, ...item }]);
        return id;
    };

    const updateCustomItem = (id: string, updates: Partial<Omit<CustomCartItem, 'id'>>) => {
        setCustomCart((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        );
    };

    const updateCustomQuantity = (id: string, delta: number) => {
        setCustomCart((prev) =>
            prev
                .map((item) =>
                    item.id === id
                        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
                        : item,
                )
                .filter((item) => item.quantity > 0),
        );
    };

    const removeCustomFromCart = (id: string) => {
        setCustomCart((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCart = () => {
        setCart([]);
        setCustomCart([]);
    };

    const toggleAdmin = () => setIsAdmin((prev) => !prev);

    const getCartDetails = useMemo(
        () => () =>
            cart
                .map((item) => {
                    const book = bookLookup[item.bookId];
                    return book ? { book, variant: item.variant, quantity: item.quantity } : null;
                })
                .filter((item): item is { book: Book; variant: BookVariant; quantity: number } => item !== null),
        [cart, bookLookup],
    );

    const totals = useMemo(() => {
        let price = 0;
        let pages = 0;
        let weight = 0;

        cart.forEach((item) => {
            const book = bookLookup[item.bookId];
            if (!book) return;

            const unitPrice = item.variant === 'color' ? book.priceColor : book.priceBW;
            price += unitPrice * item.quantity;
            pages += book.pageCount * item.quantity;
            const itemWeight = book.weightGrams || Math.ceil(book.pageCount / 2) * 5;
            weight += itemWeight * item.quantity;
        });

        customCart.forEach((item) => {
            price += item.unitPrice * item.quantity;
            pages += item.pageCount * item.quantity;
            weight += item.unitWeightGrams * item.quantity;
        });

        return { price, pages, weight };
    }, [cart, customCart, bookLookup]);

    const cartItemCount = useMemo(() => {
        const catalogCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        const customCount = customCart.reduce((sum, item) => sum + item.quantity, 0);
        return catalogCount + customCount;
    }, [cart, customCart]);

    return (
        <BookContext.Provider
            value={{
                books,
                cart,
                customCart,
                loading,
                isAdmin,
                hasMoreBooks,
                loadingMoreBooks,
                refreshBooks,
                loadMoreBooks,
                addToCart,
                removeFromCart,
                updateQuantity,
                addCustomToCart,
                updateCustomItem,
                updateCustomQuantity,
                removeCustomFromCart,
                clearCart,
                toggleAdmin,
                getCartDetails,
                totals,
                cartItemCount,
            }}
        >
            {children}
        </BookContext.Provider>
    );
};

export const useBookContext = () => {
    const context = useContext(BookContext);
    if (!context) {
        throw new Error('useBookContext must be used within a BookProvider');
    }
    return context;
};

