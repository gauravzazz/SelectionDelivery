import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import './ReviewCampaignPage.css';

export interface CampaignLead {
    phone: string;
    name: string;
    status: 'pending' | 'sent';
    importedAt: string;
}

const STORAGE_KEY = 'review_campaign_leads';

const ReviewCampaignPage: React.FC = () => {
    const [leads, setLeads] = useState<CampaignLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadLeads();
    }, []);

    const loadLeads = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Filter only pending leads for display
                const pending = parsed.filter((l: CampaignLead) => l.status === 'pending');
                setLeads(pending);
            } catch (e) {
                console.error("Failed to parse leads", e);
            }
        }
        setLoading(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setImporting(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const wb = XLSX.read(data, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = XLSX.utils.sheet_to_json(ws);

                // Process data
                const seenPhones = new Set();

                // Load existing to avoid duplicates if needed, or better, just merge
                const existingStored = localStorage.getItem(STORAGE_KEY);
                let allLeads: CampaignLead[] = existingStored ? JSON.parse(existingStored) : [];

                // Index existing
                allLeads.forEach(l => seenPhones.add(l.phone));

                let importedCount = 0;
                let duplicateCount = 0;

                jsonData.forEach((row: any) => {
                    const name = row['Customer'];
                    const rawPhone = row['Mobile'];

                    if (name && rawPhone) {
                        const phone = String(rawPhone).replace(/\D/g, '').slice(-10);
                        if (phone.length === 10) {
                            if (!seenPhones.has(phone)) {
                                allLeads.push({
                                    name,
                                    phone,
                                    status: 'pending',
                                    importedAt: new Date().toISOString()
                                });
                                seenPhones.add(phone);
                                importedCount++;
                            } else {
                                duplicateCount++;
                            }
                        }
                    }
                });

                localStorage.setItem(STORAGE_KEY, JSON.stringify(allLeads));
                loadLeads(); // Refresh view
                alert(`Successfully imported ${importedCount} new leads! (${duplicateCount} duplicates skipped)`);

            } catch (err) {
                console.error(err);
                alert("Failed to parse Excel file");
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSend = (lead: CampaignLead) => {
        const firstName = lead.name.split(' ')[0];
        const message = `Hi ${firstName},
You’ve been one of the customers who helped shape pdf2printout early on. As we expand, we’re selectively inviting a few past customers to share their experience—it genuinely influences how new customers decide to trust us.

If you can spare 30 seconds, your review here would mean a lot and directly support our growth:
https://g.page/r/CaF7zdF0ebjSEBM/review

Thank you for being part of our journey.`;
        const encoded = encodeURIComponent(message);
        const url = `https://wa.me/91${lead.phone}?text=${encoded}`;

        window.open(url, '_blank');

        // Update local storage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const allLeads: CampaignLead[] = JSON.parse(stored);
            const updated = allLeads.map(l => l.phone === lead.phone ? { ...l, status: 'sent' as const } : l);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            loadLeads();
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="campaign-page">
            <header className="campaign-header">
                <h3>Review Campaign (Local)</h3>
                <div className="actions">
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                    />
                    <button
                        className="btn-import glass-panel"
                        onClick={triggerFileInput}
                        disabled={importing}
                    >
                        {importing ? 'Importing...' : '📥 Import Excel'}
                    </button>
                    {leads.length > 0 && (
                        <button
                            className="btn-secondary glass-panel"
                            onClick={() => {
                                if (confirm('Clear all data?')) {
                                    localStorage.removeItem(STORAGE_KEY);
                                    loadLeads();
                                }
                            }}
                        >
                            Reset
                        </button>
                    )}
                </div>
            </header>

            {loading ? (
                <div className="campaign-loading">Loading customer leads...</div>
            ) : leads.length === 0 ? (
                <div className="campaign-empty glass-panel">
                    <span>✨</span>
                    <p>All caught up! No pending review requests.</p>
                    <button onClick={triggerFileInput} className="btn-secondary">Import Excel File</button>
                </div>
            ) : (
                <div className="leads-list">
                    <div className="leads-summary">
                        <span>{leads.length} pending review requests</span>
                    </div>
                    {leads.map(lead => (
                        <div key={lead.phone} className="lead-card glass-panel">
                            <div className="lead-info">
                                <span className="lead-name">{lead.name}</span>
                                <span className="lead-phone">📱 {lead.phone}</span>
                            </div>
                            <button className="btn-send-wa" onClick={() => handleSend(lead)}>
                                Send WhatsApp
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReviewCampaignPage;
