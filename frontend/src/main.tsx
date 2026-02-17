import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './firebase';
import App from './App';
import { BookProvider } from './context/BookContext';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BookProvider>
            <App />
        </BookProvider>
    </StrictMode>,
);
