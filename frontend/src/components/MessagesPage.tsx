import React from 'react';
import './MessagesPage.css';

const MESSAGE_TEMPLATES = [
    {
        title: '👋 Greeting',
        text: "Hi! Welcome to OnlinePrintout.com. Please share your PDF files for printing via WhatsApp or email. Rates starting at ₹0.90/page."
    },
    {
        title: '💳 Payment',
        text: "Please make the payment to confirm your order.\n\nUPI: 9876543210@upi\n\nKindly share the screenshot once paid so we can start printing."
    },
    {
        title: '⏳ Processing',
        text: "Thanks for the payment! Your order is currently being printed and bound. We will share the tracking details once shipped."
    },
    {
        title: '🚚 Dispatch',
        text: "Good news! Your order has been dispatched. You will receive the tracking details in a separate message shortly."
    },
    {
        title: '⭐ Feedback',
        text: "Your order has been delivered! We hope you like the quality. If you have a moment, please leave us a review or share your feedback."
    }
];

const MessagesPage: React.FC = () => {
    const shareWhatsApp = (text: string) => {
        const msg = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    };

    const shareTelegram = (text: string) => {
        const msg = encodeURIComponent(text);
        window.open(`https://t.me/share/url?url=.&text=${msg}`, '_blank');
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    return (
        <div className="messages-page">
            <h3>💬 Quick Messages</h3>
            <div className="message-grid">
                {MESSAGE_TEMPLATES.map((tmpl, i) => (
                    <div key={i} className="message-card">
                        <div className="msg-header">{tmpl.title}</div>
                        <div className="msg-preview">{tmpl.text}</div>
                        <div className="msg-actions">
                            <button className="msg-btn copy" onClick={() => copyToClipboard(tmpl.text)}>Copy</button>
                            <button className="msg-btn whatsapp" onClick={() => shareWhatsApp(tmpl.text)}>WA</button>
                            <button className="msg-btn telegram" onClick={() => shareTelegram(tmpl.text)}>TG</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MessagesPage;
