import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    QuerySnapshot,
    DocumentData
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

export const BookService = {
    /**
     * Fetch all books from Firestore.
     * Offline interaction is handled automatically by Firestore SDK.
     */
    async getAllBooks(): Promise<Book[]> {
        const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(collection(db, COLLECTION_NAME));
        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Book[];
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
