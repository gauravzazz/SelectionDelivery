import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Book, BookService } from '../api/bookApi';

export type BookVariant = 'color' | 'bw';

export interface CartItem {
    bookId: string;
    variant: BookVariant;
    quantity: number;
}

interface BookContextType {
    books: Book[];
    cart: CartItem[];
    loading: boolean;
    isAdmin: boolean;
    refreshBooks: () => Promise<void>;
    addToCart: (bookId: string, variant: BookVariant) => void;
    removeFromCart: (bookId: string, variant: BookVariant) => void;
    updateQuantity: (bookId: string, variant: BookVariant, delta: number) => void;
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

export const BookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [books, setBooks] = useState<Book[]>([]);
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const saved = localStorage.getItem('cart');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem('cart', JSON.stringify(cart));
        } catch (e) {
            console.error('Failed to save cart', e);
        }
    }, [cart]);

    const refreshBooks = async () => {
        try {
            setLoading(true);
            const data = await BookService.getAllBooks();
            setBooks(data);
        } catch (error) {
            console.error("Failed to fetch books:", error);
        } finally {
            setLoading(false);
        }
    };

    // Load items from local storage if available? 
    // For now, just load books on mount
    useEffect(() => {
        refreshBooks();
    }, []);

    // Cleanup cart: Remove items that reference deleted books
    useEffect(() => {
        if (books.length > 0) {
            setCart((prev) => {
                const validItems = prev.filter(item => books.some(b => b.id === item.bookId));
                // Only update if changes found to avoid loop
                return validItems.length !== prev.length ? validItems : prev;
            });
        }
    }, [books]);

    const addToCart = (bookId: string, variant: BookVariant) => {
        setCart((prev) => {
            const existing = prev.find((item) => item.bookId === bookId && item.variant === variant);
            if (existing) {
                return prev.map((item) =>
                    item.bookId === bookId && item.variant === variant
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { bookId, variant, quantity: 1 }];
        });
    };

    const removeFromCart = (bookId: string, variant: BookVariant) => {
        setCart((prev) => prev.filter((item) => !(item.bookId === bookId && item.variant === variant)));
    };

    const updateQuantity = (bookId: string, variant: BookVariant, delta: number) => {
        setCart((prev) => {
            return prev.map((item) => {
                if (item.bookId === bookId && item.variant === variant) {
                    const newQty = Math.max(0, item.quantity + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter((item) => item.quantity > 0);
        });
    };

    const clearCart = () => setCart([]);

    const toggleAdmin = () => setIsAdmin(!isAdmin);

    const getCartDetails = useMemo(() => {
        return () => {
            return cart.map((item) => {
                const book = books.find((b) => b.id === item.bookId);
                return book ? { book, variant: item.variant, quantity: item.quantity } : null;
            }).filter((item): item is { book: Book; variant: BookVariant; quantity: number } => item !== null);
        };
    }, [cart, books]);

    const totals = useMemo(() => {
        let price = 0;
        let pages = 0;
        let weight = 0;

        cart.forEach((item) => {
            const book = books.find((b) => b.id === item.bookId);
            if (book) {
                const unitPrice = item.variant === 'color' ? book.priceColor : book.priceBW;
                price += unitPrice * item.quantity;
                pages += book.pageCount * item.quantity;

                // Estimate weight: 
                // Color often implies slightly heavier paper/ink load, but generally same base weight
                // Using book.weightGrams or fallback (pages/2 * 5g for A4 75gsm)
                const itemWeight = book.weightGrams || (Math.ceil(book.pageCount / 2) * 5);
                weight += itemWeight * item.quantity;
            }
        });

        return { price, pages, weight };
    }, [cart, books]);

    const cartItemCount = useMemo(() => {
        return cart.reduce((acc, item) => acc + item.quantity, 0);
    }, [cart]);

    return (
        <BookContext.Provider
            value={{
                books,
                cart,
                loading,
                isAdmin,
                refreshBooks,
                addToCart,
                removeFromCart,
                updateQuantity,
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
        throw new Error("useBookContext must be used within a BookProvider");
    }
    return context;
};
