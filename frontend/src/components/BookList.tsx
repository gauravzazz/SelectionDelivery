import React, { useState, useRef, useCallback } from 'react';
import { useBookContext, BookVariant } from '../context/BookContext';
import { Book, BookService } from '../api/bookApi';
import './BookList.css';

/** Shared JSON-to-books parser */
function parseBooksJSON(text: string): { added: Omit<Book, 'id'>[]; skipped: number } {
    const data = JSON.parse(text);
    const booksArray: any[] = Array.isArray(data) ? data : data.books;

    if (!Array.isArray(booksArray) || booksArray.length === 0) {
        throw new Error('Expected an array of books or { "books": [...] }');
    }

    const added: Omit<Book, 'id'>[] = [];
    let skipped = 0;

    for (const item of booksArray) {
        const title = item.title || item.name;
        const pageCount = Number(item.pageCount || item.pages || 0);
        const priceColor = Number(item.priceColor || item.colorPrice || item.price || 0);
        // Normalize priceBW from various potential input keys
        const priceBW = Number(item.priceBW || item.priceBw || item.bwPrice || item.blackWhitePrice || 0);

        if (!title || !pageCount) {
            skipped++;
            continue;
        }

        added.push({ title, pageCount, priceColor: priceColor || 0, priceBW: priceBW || 0 });
    }

    return { added, skipped };
}

const BookList: React.FC = () => {
    const { books, addToCart, isAdmin, toggleAdmin, refreshBooks, cartItemCount } = useBookContext();
    const [searchTerm, setSearchTerm] = useState('');

    // New Book Form State
    const [newBook, setNewBook] = useState<Partial<Book>>({
        title: '',
        priceColor: 0,
        priceBW: 0,
        pageCount: 0,
    });
    const [isAdding, setIsAdding] = useState(false);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Paste JSON modal
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteText, setPasteText] = useState('');

    // Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());

    // Filter Logic
    const filteredBooks = books.filter((book) =>
        book.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddBook = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!newBook.title || !newBook.priceColor || !newBook.priceBW || !newBook.pageCount) return;

            await BookService.addBook({
                title: newBook.title,
                priceColor: Number(newBook.priceColor),
                priceBW: Number(newBook.priceBW),
                pageCount: Number(newBook.pageCount),
            } as any);

            setNewBook({ title: '', priceColor: 0, priceBW: 0, pageCount: 0 });
            setIsAdding(false);
            refreshBooks();
        } catch (error) {
            console.error(error);
            alert('Failed to add book');
        }
    };

    const importBooks = async (text: string) => {
        setImporting(true);
        try {
            const { added, skipped } = parseBooksJSON(text);

            if (added.length === 0) {
                alert('No valid books found in the JSON.');
                return;
            }

            for (const book of added) {
                await BookService.addBook(book);
            }

            alert(`✅ Imported ${added.length} book(s)${skipped ? `, ${skipped} skipped (missing title/pages)` : ''}`);
            refreshBooks();
        } catch (err) {
            console.error('JSON Import Error:', err);
            alert('Failed to import. Check that the JSON is valid.');
        } finally {
            setImporting(false);
        }
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        await importBooks(text);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePasteImport = async () => {
        if (!pasteText.trim()) return;
        await importBooks(pasteText);
        setPasteText('');
        setShowPasteModal(false);
    };

    const handleDeleteBook = async (bookId: string, bookTitle: string) => {
        if (!confirm(`Delete "${bookTitle}" from catalog?`)) return;
        try {
            await BookService.deleteBook(bookId);
            refreshBooks();
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Failed to delete book');
        }
    };

    const toggleSelection = (bookId: string) => {
        const newSelected = new Set(selectedBooks);
        if (newSelected.has(bookId)) {
            newSelected.delete(bookId);
        } else {
            newSelected.add(bookId);
        }
        setSelectedBooks(newSelected);
    };

    const handleBulkDelete = async () => {
        if (selectedBooks.size === 0) return;
        if (!confirm(`Delete ${selectedBooks.size} selected books?`)) return;

        try {
            // Delete sequentially or parallel
            const promises = Array.from(selectedBooks).map(id => BookService.deleteBook(id));
            await Promise.all(promises);

            setSelectedBooks(new Set());
            setIsSelectionMode(false);
            refreshBooks();
            alert('Books deleted successfully');
        } catch (err) {
            console.error('Bulk delete failed:', err);
            alert('Failed to delete some books');
        }
    };

    return (
        <div className="book-list-container">
            <div className="book-list-header">
                <h3>📚 Literary Collection</h3>
                <div className="book-controls">
                    <button className="admin-toggle" onClick={toggleAdmin}>
                        {isAdmin ? 'Exit Admin' : '⚙️ Manage'}
                    </button>
                    {isAdmin && (
                        <>
                            {isSelectionMode ? (
                                <>
                                    <button className="add-btn delete-btn" onClick={handleBulkDelete} disabled={selectedBooks.size === 0}>
                                        🗑 Delete ({selectedBooks.size})
                                    </button>
                                    <button className="add-btn" onClick={() => {
                                        setIsSelectionMode(false);
                                        setSelectedBooks(new Set());
                                    }}>
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button className="add-btn" onClick={() => setIsSelectionMode(true)}>
                                    ✅ Select
                                </button>
                            )}

                            {!isSelectionMode && (
                                <button className="add-btn" onClick={() => setIsAdding(!isAdding)}>
                                    {isAdding ? 'Cancel' : '+ New Book'}
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                style={{ display: 'none' }}
                                onChange={handleFileImport}
                            />
                            <button
                                className="add-btn import-btn"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={importing}
                            >
                                {importing ? '⏳...' : '📁 File'}
                            </button>
                            <button
                                className="add-btn import-btn"
                                onClick={() => setShowPasteModal(true)}
                                disabled={importing}
                            >
                                📋 Paste
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Paste JSON Modal */}
            {showPasteModal && (
                <div className="paste-modal-overlay" onClick={() => !importing && setShowPasteModal(false)}>
                    <div className="paste-modal glass-panel" onClick={(e) => e.stopPropagation()}>
                        {importing ? (
                            <div className="paste-loading">
                                <div className="paste-spinner"></div>
                                <p>Importing books...</p>
                            </div>
                        ) : (
                            <>
                                <h4>Paste JSON</h4>
                                <textarea
                                    className="paste-textarea"
                                    placeholder={`[\n  { "title": "Book Name", "pageCount": 100, "priceColor": 250, "priceBW": 150 }\n]`}
                                    value={pasteText}
                                    onChange={(e) => setPasteText(e.target.value)}
                                    rows={8}
                                    autoFocus
                                />
                                <div className="paste-actions">
                                    <button className="add-btn" onClick={() => setShowPasteModal(false)}>Cancel</button>
                                    <button
                                        className="save-btn"
                                        onClick={handlePasteImport}
                                        disabled={!pasteText.trim()}
                                    >
                                        ✅ Import
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {isAdmin && isAdding && (
                <form className="add-book-form glass-panel" onSubmit={handleAddBook}>
                    <input
                        type="text"
                        placeholder="Book Title"
                        value={newBook.title}
                        onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                        required
                    />
                    <div className="form-row">
                        <input
                            type="number"
                            placeholder="Pages"
                            value={newBook.pageCount || ''}
                            onChange={(e) => setNewBook({ ...newBook, pageCount: Number(e.target.value) })}
                            required
                        />
                        <input
                            type="number"
                            placeholder="Color Price (₹)"
                            value={newBook.priceColor || ''}
                            onChange={(e) => setNewBook({ ...newBook, priceColor: Number(e.target.value) })}
                            required
                        />
                        <input
                            type="number"
                            placeholder="B&W Price (₹)"
                            value={newBook.priceBW || ''}
                            onChange={(e) => setNewBook({ ...newBook, priceBW: Number(e.target.value) })}
                            required
                        />
                    </div>
                    <button type="submit" className="save-btn">Save to Catalog</button>
                </form>
            )}

            <div className="filter-bar">
                <div className="search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search for books..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="books-grid">
                {filteredBooks.map((book) => (
                    <BookCard
                        key={book.id}
                        book={book}
                        onAdd={addToCart}
                        onDelete={handleDeleteBook}
                        selectionMode={isSelectionMode}
                        isSelected={selectedBooks.has(book.id)}
                        onToggleSelect={toggleSelection}
                    />
                ))}
                {filteredBooks.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">🌑</div>
                        <p>No books found in the library.</p>
                        {isAdmin && <p>As an admin, you can add one above!</p>}
                    </div>
                )}
            </div>

            {/* Floating Cart Button */}
            {cartItemCount > 0 && (
                <button className="floating-cart-btn" onClick={() => document.querySelector<HTMLElement>('.cart-btn')?.click()}>
                    🛒 <span className="float-badge">{cartItemCount}</span>
                </button>
            )}
        </div>
    );
};

interface BookCardProps {
    book: Book;
    onAdd: (id: string, variant: BookVariant) => void;
    onDelete: (id: string, title: string) => void;
    selectionMode: boolean;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
}

const BookCard: React.FC<BookCardProps> = ({
    book, onAdd, onDelete,
    selectionMode, isSelected, onToggleSelect
}) => {
    const [variant, setVariant] = useState<BookVariant>('color');
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isLongPressing, setIsLongPressing] = useState(false);

    const handleCardClick = () => {
        if (selectionMode) {
            onToggleSelect(book.id);
        }
    };

    const handleTouchStart = useCallback(() => {
        longPressTimer.current = setTimeout(() => {
            setIsLongPressing(true);
            // Vibrate if supported (mobile)
            if (navigator.vibrate) navigator.vibrate(50);
            onDelete(book.id, book.title);
            setIsLongPressing(false);
        }, 600); // 600ms long press
    }, [book.id, book.title, onDelete]);

    const handleTouchEnd = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        setIsLongPressing(false);
    }, []);

    return (
        <div
            className={`book-card glass-panel ${isLongPressing ? 'long-pressing' : ''} ${isSelected ? 'selected-card' : ''}`}
            onClick={handleCardClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
        >
            {selectionMode && (
                <div className={`checkbox-overlay ${isSelected ? 'checked' : ''}`}>
                    {isSelected ? '☑️' : '⬜'}
                </div>
            )}

            <div className="book-cover-placeholder">
                <span className="book-initial">{book.title.charAt(0)}</span>
            </div>
            <div className="book-info">
                <h4>{book.title}</h4>
                <p className="book-meta">{book.pageCount} Pages</p>

                {!selectionMode && (
                    <>
                        <div className="variant-selector">
                            <button
                                className={`variant-btn ${variant === 'color' ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setVariant('color'); }}
                            >
                                Color
                            </button>
                            <button
                                className={`variant-btn ${variant === 'bw' ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setVariant('bw'); }}
                            >
                                B&W
                            </button>
                        </div>

                        <div className="price-tag">
                            ₹{variant === 'color' ? book.priceColor : book.priceBW}
                        </div>

                        <button className="add-cart-btn" onClick={(e) => { e.stopPropagation(); onAdd(book.id, variant); }}>
                            Add to Cart
                        </button>
                    </>
                )}
            </div>
            {!selectionMode && <div className="long-press-hint">Hold to delete</div>}
        </div>
    );
};

export default BookList;
