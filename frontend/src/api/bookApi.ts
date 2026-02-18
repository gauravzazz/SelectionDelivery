import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    QuerySnapshot,
    DocumentData,
    query,
    orderBy,
    startAfter,
    limit,
    documentId,
    where
} from "firebase/firestore";
import { db } from "../firebase";

export interface Book {
    id: string;
    title: string;
    pageCount: number;
    priceColor: number;
    priceBW: number;
    weightGrams?: number; // Optional, can be calculated
}

const COLLECTION_NAME = "books";
const DEFAULT_PAGE_SIZE = 250;

export interface BookPageResult {
    books: Book[];
    nextCursor: string | null;
    hasMore: boolean;
}

function mapBookDocs(snapshot: QuerySnapshot<DocumentData>): Book[] {
    return snapshot.docs.map((docRef) => ({
        id: docRef.id,
        ...docRef.data(),
    })) as Book[];
}

export const BookService = {
    /**
     * Fetch all books from Firestore.
     * Offline interaction is handled automatically by Firestore SDK.
     */
    async getAllBooks(): Promise<Book[]> {
        const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(collection(db, COLLECTION_NAME));
        return mapBookDocs(querySnapshot);
    },

    async getBooksPage(pageSize: number = DEFAULT_PAGE_SIZE, cursorId?: string | null): Promise<BookPageResult> {
        const safeSize = Math.max(50, Math.min(500, pageSize));

        const q = cursorId
            ? query(
                collection(db, COLLECTION_NAME),
                orderBy(documentId()),
                startAfter(cursorId),
                limit(safeSize),
            )
            : query(
                collection(db, COLLECTION_NAME),
                orderBy(documentId()),
                limit(safeSize),
            );

        const snapshot = await getDocs(q);
        const books = mapBookDocs(snapshot);
        const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null;
        return {
            books,
            nextCursor,
            hasMore: snapshot.docs.length === safeSize,
        };
    },

    async getBooksByIds(ids: string[]): Promise<Book[]> {
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        if (uniqueIds.length === 0) return [];

        // Firestore "in" supports up to 10 values.
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += 10) {
            chunks.push(uniqueIds.slice(i, i + 10));
        }

        const snapshots = await Promise.all(
            chunks.map((idChunk) =>
                getDocs(
                    query(
                        collection(db, COLLECTION_NAME),
                        where(documentId(), 'in', idChunk),
                    ),
                ),
            ),
        );

        return snapshots.flatMap((snapshot) => mapBookDocs(snapshot));
    },

    /**
     * Add a new book to the catalog.
     */
    async addBook(book: Omit<Book, "id">): Promise<Book> {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), book);
        return { id: docRef.id, ...book };
    },

    /**
     * Remove a book from the catalog.
     */
    async deleteBook(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
};
