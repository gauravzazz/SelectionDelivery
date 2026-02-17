import React, { useState, useEffect } from 'react';
import { MessageTemplate, MessageService } from '../api/messageApi';
import './MessageManager.css';

interface MessageManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

const MessageManager: React.FC<MessageManagerProps> = ({ isOpen, onClose }) => {
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', text: '' });
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
        }
    }, [isOpen]);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await MessageService.getAll();
            if (data.length === 0) {
                await MessageService.initializeDefaults();
                setTemplates(await MessageService.getAll());
            } else {
                setTemplates(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editForm.title || !editForm.text) return;
        setLoading(true);
        try {
            if (isAdding) {
                await MessageService.add(editForm.title, editForm.text);
            } else if (editingId) {
                await MessageService.save({ id: editingId, ...editForm });
            }
            await loadTemplates();
            resetForm();
        } catch (err) {
            alert('Failed to save template');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        try {
            await MessageService.delete(id);
            loadTemplates();
        } catch (err) {
            alert('Failed to delete');
        }
    };

    const startEdit = (t: MessageTemplate) => {
        setEditingId(t.id);
        setEditForm({ title: t.title, text: t.text });
        setIsAdding(false);
    };

    const startAdd = () => {
        setEditingId(null);
        setEditForm({ title: '', text: '' });
        setIsAdding(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setIsAdding(false);
        setEditForm({ title: '', text: '' });
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content message-manager-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>💬 Message Templates</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="manager-body">
                    <div className="template-list">
                        <button className="btn-add-template" onClick={startAdd}>+ New Template</button>

                        {loading ? <div className="loading">Loading...</div> : (
                            templates.map(t => (
                                <div key={t.id} className={`template-item ${editingId === t.id ? 'active' : ''}`} onClick={() => startEdit(t)}>
                                    <span className="t-title">{t.title}</span>
                                    <span className="t-preview">{t.text.substring(0, 30)}...</span>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="editor-pane">
                        {(editingId || isAdding) ? (
                            <div className="editor-form">
                                <h4>{isAdding ? 'New Template' : 'Edit Template'}</h4>
                                <input
                                    className="input-title"
                                    placeholder="Template Title (e.g. 'Shipping Delay')"
                                    value={editForm.title}
                                    onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                />
                                <textarea
                                    className="input-text"
                                    placeholder="Message content..."
                                    rows={8}
                                    value={editForm.text}
                                    onChange={e => setEditForm(prev => ({ ...prev, text: e.target.value }))}
                                />
                                <div className="editor-actions">
                                    <button className="btn-cancel" onClick={resetForm}>Cancel</button>
                                    <button className="btn-save" onClick={handleSave} disabled={loading}>
                                        {loading ? 'Saving...' : 'Save Template'}
                                    </button>
                                </div>
                                {!isAdding && (
                                    <button className="btn-delete-template" onClick={() => handleDelete(editingId!)}>
                                        Delete Template
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="empty-selection">
                                <p>Select a template to edit or create a new one.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageManager;
