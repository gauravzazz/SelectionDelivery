import { useState, useRef, useCallback, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './PdfSplitter.css';

/* ── Constants ── */
const MAX_PAGES_PER_CHUNK = 400;
const SOFT_OVERFLOW = 50; // last chunk can be up to 450

/* ── Cover SVG Generator (runs entirely in-browser) ── */
const generateCoverSvg = (title: string, partNum: number, totalParts: number): string => `
<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f0c29"/>
      <stop offset="50%" stop-color="#302b63"/>
      <stop offset="100%" stop-color="#24243e"/>
    </linearGradient>
    <radialGradient id="g1" cx="30%" cy="35%" r="50%">
      <stop offset="0%" stop-color="rgba(120,80,255,0.22)"/>
      <stop offset="100%" stop-color="rgba(120,80,255,0)"/>
    </radialGradient>
    <radialGradient id="g2" cx="75%" cy="70%" r="45%">
      <stop offset="0%" stop-color="rgba(0,200,180,0.18)"/>
      <stop offset="100%" stop-color="rgba(0,200,180,0)"/>
    </radialGradient>
  </defs>
  <!-- Background -->
  <rect width="595" height="842" fill="url(#bg)"/>
  <rect width="595" height="842" fill="url(#g1)"/>
  <rect width="595" height="842" fill="url(#g2)"/>
  <!-- Decorative geometry -->
  <circle cx="140" cy="280" r="130" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.8"/>
  <circle cx="460" cy="560" r="100" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1.5"/>
  <circle cx="297" cy="420" r="200" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
  <line x1="40" y1="190" x2="555" y2="190" stroke="rgba(255,255,255,0.04)" stroke-width="0.8"/>
  <line x1="40" y1="660" x2="555" y2="660" stroke="rgba(255,255,255,0.04)" stroke-width="0.8"/>
  <polygon points="297,80 380,210 214,210" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.2"/>
  <polygon points="440,100 510,200 370,200" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <!-- Dots -->
  <circle cx="100" cy="700" r="3" fill="rgba(255,255,255,0.08)"/>
  <circle cx="500" cy="150" r="4" fill="rgba(255,255,255,0.06)"/>
  <circle cx="320" cy="750" r="2.5" fill="rgba(255,255,255,0.07)"/>
  <!-- Title -->
  <text x="297.5" y="380" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff" opacity="0.95">${escapeXml(title)}</text>
  <!-- Part indicator -->
  <text x="297.5" y="440" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.6)">Part ${partNum} of ${totalParts}</text>
  <!-- Footer -->
  <text x="297.5" y="812" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" fill="rgba(255,255,255,0.45)">onlineprintout.com</text>
</svg>`.trim();

function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Chunking logic ── */
function computeChunks(totalPages: number): number[] {
    if (totalPages <= MAX_PAGES_PER_CHUNK + SOFT_OVERFLOW) {
        return [totalPages];
    }
    const chunks: number[] = [];
    let remaining = totalPages;
    while (remaining > 0) {
        if (remaining <= MAX_PAGES_PER_CHUNK + SOFT_OVERFLOW) {
            chunks.push(remaining);
            remaining = 0;
        } else {
            chunks.push(MAX_PAGES_PER_CHUNK);
            remaining -= MAX_PAGES_PER_CHUNK;
        }
    }
    return chunks;
}

/* ── SVG to PNG via an off-screen Canvas ── */
async function svgToPngBytes(svgString: string, width = 595, height = 842): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;   // 2x for quality
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d')!;
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            canvas.toBlob((b) => {
                if (!b) return reject(new Error('Canvas toBlob failed'));
                b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
            }, 'image/png');
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to rasterize SVG'));
        };
        img.src = url;
    });
}

/* ── Component ── */
export default function PdfSplitter() {
    const [file, setFile] = useState<File | null>(null);
    const [pageCount, setPageCount] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ pct: 0, label: '' });
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const chunks = useMemo(() => (pageCount > 0 ? computeChunks(pageCount) : []), [pageCount]);

    /* Title derived from filename */
    const docTitle = useMemo(() => {
        if (!file) return 'Document';
        return file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
    }, [file]);

    /* Handle file selection */
    const handleFile = useCallback(async (f: File) => {
        setError(null);
        setDone(false);
        if (f.type !== 'application/pdf') {
            setError('Please upload a valid PDF file.');
            return;
        }
        try {
            const ab = await f.arrayBuffer();
            const doc = await PDFDocument.load(ab, { ignoreEncryption: true });
            setFile(f);
            setPageCount(doc.getPageCount());
        } catch {
            setError('Could not read this PDF. It may be corrupted or password-protected.');
        }
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    }, [handleFile]);

    const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleFile(e.target.files[0]);
    }, [handleFile]);

    const removeFile = useCallback(() => {
        setFile(null);
        setPageCount(0);
        setDone(false);
        setError(null);
        setProgress({ pct: 0, label: '' });
        if (inputRef.current) inputRef.current.value = '';
    }, []);

    /* ── Main split & download logic ── */
    const handleSplit = useCallback(async () => {
        if (!file || chunks.length === 0) return;
        setProcessing(true);
        setDone(false);
        setError(null);

        try {
            const srcBytes = new Uint8Array(await file.arrayBuffer());
            const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });

            const zip = new JSZip();
            const baseName = file.name.replace(/\.pdf$/i, '');

            let pageOffset = 0;
            for (let i = 0; i < chunks.length; i++) {
                const chunkSize = chunks[i];
                setProgress({
                    pct: Math.round(((i + 0.3) / chunks.length) * 100),
                    label: `Generating cover for part ${i + 1}…`,
                });

                // Create chunk PDF
                const chunkDoc = await PDFDocument.create();

                // Generate & embed cover page
                const coverSvg = generateCoverSvg(docTitle, i + 1, chunks.length);
                const coverPng = await svgToPngBytes(coverSvg);
                const coverImage = await chunkDoc.embedPng(coverPng);
                const coverPage = chunkDoc.addPage([595, 842]);
                coverPage.drawImage(coverImage, { x: 0, y: 0, width: 595, height: 842 });

                setProgress({
                    pct: Math.round(((i + 0.6) / chunks.length) * 100),
                    label: `Splitting part ${i + 1} of ${chunks.length} (${chunkSize} pages)…`,
                });

                // Copy pages from source
                const pageIndices = Array.from({ length: chunkSize }, (_, j) => pageOffset + j);
                const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
                copiedPages.forEach((p) => chunkDoc.addPage(p));

                const chunkBytes = await chunkDoc.save();
                const filename = chunks.length === 1
                    ? `${baseName}_with_cover.pdf`
                    : `${baseName}_part${i + 1}.pdf`;
                zip.file(filename, chunkBytes);

                pageOffset += chunkSize;
            }

            setProgress({ pct: 95, label: 'Zipping files…' });
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipName = chunks.length === 1
                ? `${baseName}_with_cover.zip`
                : `${baseName}_split_${chunks.length}parts.zip`;
            saveAs(zipBlob, zipName);

            setProgress({ pct: 100, label: 'Done!' });
            setDone(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
        } finally {
            setProcessing(false);
        }
    }, [file, chunks, docTitle]);

    /* ── Preview cover SVG ── */
    const previewSvg = useMemo(() => {
        if (!file) return '';
        return generateCoverSvg(docTitle, 1, chunks.length || 1);
    }, [file, docTitle, chunks.length]);

    return (
        <div className="pdf-splitter">
            <h1 className="pdf-splitter__title">✂️ PDF Splitter</h1>
            <p className="pdf-splitter__subtitle">
                Split large PDFs into chunks of {MAX_PAGES_PER_CHUNK} pages max (last chunk up to{' '}
                {MAX_PAGES_PER_CHUNK + SOFT_OVERFLOW}). Each part gets a beautiful cover page.
            </p>

            {/* Dropzone */}
            <div
                className={`pdf-splitter__dropzone ${dragActive ? 'pdf-splitter__dropzone--active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
            >
                <div className="pdf-splitter__dropzone-icon">📄</div>
                <div className="pdf-splitter__dropzone-text">
                    Drag & drop a PDF here, or <strong>click to browse</strong>
                </div>
                <div className="pdf-splitter__dropzone-hint">Only .pdf files accepted</div>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={onFileChange}
                />
            </div>

            {/* File Info */}
            {file && (
                <div className="pdf-splitter__file-info">
                    <span className="pdf-splitter__file-icon">📕</span>
                    <div className="pdf-splitter__file-details">
                        <div className="pdf-splitter__file-name">{file.name}</div>
                        <div className="pdf-splitter__file-meta">
                            {pageCount} pages · {(file.size / 1024 / 1024).toFixed(1)} MB
                            {chunks.length > 1
                                ? ` → will split into ${chunks.length} parts`
                                : ` → 1 file (cover + pages)`}
                        </div>
                    </div>
                    <button className="pdf-splitter__file-remove" onClick={removeFile} title="Remove">✕</button>
                </div>
            )}

            {/* Chunk Preview */}
            {file && chunks.length > 0 && (
                <div className="pdf-splitter__preview">
                    <div className="pdf-splitter__preview-title">Split Preview</div>
                    <div className="pdf-splitter__chunks">
                        {chunks.map((c, i) => (
                            <span className="pdf-splitter__chunk-badge" key={i}>
                                📄 Part {i + 1}: {c} pg
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Cover Preview */}
            {file && previewSvg && (
                <div className="pdf-splitter__cover-preview">
                    <div className="pdf-splitter__cover-preview-title">Cover Preview</div>
                    <div
                        className="pdf-splitter__cover-svg-wrapper"
                        dangerouslySetInnerHTML={{ __html: previewSvg }}
                    />
                </div>
            )}

            {/* Action Button */}
            {file && (
                <div className="pdf-splitter__actions">
                    <button
                        className={`pdf-splitter__btn ${processing ? 'pdf-splitter__btn--processing' : ''}`}
                        disabled={processing}
                        onClick={handleSplit}
                    >
                        {processing ? '⏳ Processing…' : `✂️ Split & Download${chunks.length > 1 ? ` (${chunks.length} parts)` : ''}`}
                    </button>
                </div>
            )}

            {/* Progress Bar */}
            {processing && (
                <div className="pdf-splitter__progress">
                    <div className="pdf-splitter__progress-bar-track">
                        <div
                            className="pdf-splitter__progress-bar-fill"
                            style={{ width: `${progress.pct}%` }}
                        />
                    </div>
                    <div className="pdf-splitter__progress-label">{progress.label}</div>
                </div>
            )}

            {/* Done */}
            {done && (
                <div className="pdf-splitter__done">✅ Download started! Check your downloads folder.</div>
            )}

            {/* Error */}
            {error && (
                <div className="pdf-splitter__error">❌ {error}</div>
            )}
        </div>
    );
}
