
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { usePharmacy } from '../../contexts/PharmacyContext';

interface Message {
    role: 'user' | 'model';
    content: string;
}

export const ChatAssistant = () => {
    const { selectedPharmacy } = usePharmacy();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: '¡Hola! 👋 Soy tu asistente PBM. ¿En qué puedo ayudarte?' }
    ]);

    // Load from SessionStorage on mount
    useEffect(() => {
        const saved = sessionStorage.getItem('chat_history');
        if (saved) {
            try {
                setMessages(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse chat history", e);
            }
        }
    }, []);

    // Save to SessionStorage whenever messages change
    useEffect(() => {
        sessionStorage.setItem('chat_history', JSON.stringify(messages));
    }, [messages]);

    // Clear history when Pharmacy changes
    useEffect(() => {
        const initial = [{ role: 'model', content: '¡Hola! 👋 Soy tu asistente PBM. ¿En qué puedo ayudarte?' }];
        // Only reset if we actually have messages and the pharmacy changed materially
        // We verify against current storage to avoid loops, but selectedPharmacy dep is key
        setMessages(initial as Message[]);
        // Explicitly clear buffer/storage now to sync
        sessionStorage.setItem('chat_history', JSON.stringify(initial));
    }, [selectedPharmacy?.code]);

    const clearChat = () => {
        const initial = [{ role: 'model', content: '¡Hola! 👋 Soy tu asistente PBM. ¿En qué puedo ayudarte?' }];
        setMessages(initial as Message[]);
        sessionStorage.setItem('chat_history', JSON.stringify(initial));
    };
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userMsg = inputValue.trim();
        setInputValue('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Filter out the initial greeting which is a 'model' message at index 0
                    history: messages.slice(1).map(m => ({ role: m.role, parts: [{ text: m.content }] })),
                    message: userMsg,
                    pharmacyDetails: selectedPharmacy ? { code: selectedPharmacy.code, name: selectedPharmacy.name } : null
                })
            });

            if (!response.ok) throw new Error('Failed to get response');

            const data = await response.json();
            setMessages(prev => [...prev, { role: 'model', content: data.text }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', content: 'Lo siento, tuve un problema al procesar tu consulta. Por favor intenta de nuevo.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Trigger Button */}
            <motion.button
                className="btn-primary"
                style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    zIndex: 9999,
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(6, 182, 212, 0.4)',
                    padding: 0 // Override btn-primary padding
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                animate={{
                    boxShadow: isOpen
                        ? '0 0 0 rgba(6, 182, 212, 0)'
                        : [
                            '0 8px 32px rgba(6, 182, 212, 0.4)',
                            '0 8px 40px rgba(6, 182, 212, 0.6)',
                            '0 8px 32px rgba(6, 182, 212, 0.4)'
                        ]
                }}
                transition={{
                    boxShadow: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <X size={32} /> : <MessageCircle size={32} />}
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="glass-panel"
                        style={{
                            position: 'fixed',
                            bottom: '7rem', // Above the button
                            right: '2rem',
                            zIndex: 9999,
                            width: '400px',
                            maxWidth: 'calc(100vw - 4rem)',
                            height: '600px',
                            maxHeight: 'calc(100vh - 150px)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)' // Slight more opacity for readability
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '1.25rem',
                            borderBottom: '1px solid var(--glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            background: 'linear-gradient(to right, rgba(6, 182, 212, 0.1), transparent)'
                        }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'var(--accent-color)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Bot size={24} />
                            </div>
                            <div style={{ flexGrow: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--primary-color)' }}>Asistente PBM</h3>
                                <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Experto en Medicamentos</div>
                            </div>
                            <button
                                onClick={clearChat}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginRight: '0.5rem' }}
                                title="Limpiar conversación"
                            >
                                <Trash2 size={18} />
                            </button>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}>
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        gap: '0.75rem',
                                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                                    }}
                                >
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        background: msg.role === 'user' ? 'var(--primary-color)' : 'var(--accent-color)',
                                        color: 'white'
                                    }}>
                                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div
                                        style={{
                                            padding: '0.85rem 1rem',
                                            maxWidth: '80%',
                                            borderRadius: '12px',
                                            fontSize: '0.9rem',
                                            lineHeight: '1.4',
                                            backgroundColor: msg.role === 'user' ? 'var(--primary-color)' : '#f3f4f6',
                                            color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                                            borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                                            borderTopLeftRadius: msg.role === 'user' ? '12px' : '2px',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                        }}
                                    >
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-color)',
                                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Bot size={16} />
                                    </div>
                                    <div style={{ padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '12px', borderTopLeftRadius: '2px' }}>
                                        <Loader2 className="animate-spin" size={16} style={{ color: 'var(--text-secondary)' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} style={{
                            padding: '1.25rem',
                            borderTop: '1px solid var(--glass-border)',
                            background: 'white'
                        }}>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Escribe tu consulta aquí..."
                                    className="glass-input" // Using index.css class
                                    style={{ flex: 1 }}
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isLoading}
                                    className="btn-primary"
                                    style={{
                                        padding: '0 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: (!inputValue.trim() || isLoading) ? 0.6 : 1
                                    }}
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
