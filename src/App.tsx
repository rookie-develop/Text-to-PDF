/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, FileDown, Check, Sun, Moon, Trash2, AlertTriangle, ClipboardPaste } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Debounce helper for performance
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function App() {
  const [text, setText] = useState<string>(() => {
    try {
      return localStorage.getItem('zenwriter_content') || '';
    } catch (e) {
      return '';
    }
  });
  const [isCopied, setIsCopied] = useState(false);
  const [isPasted, setIsPasted] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('zenwriter_theme') as 'light' | 'dark') || 'light';
    } catch (e) {
      return 'light';
    }
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Debounced text for auto-save to reduce CPU load
  const debouncedText = useDebounce(text, 1000);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    try {
      localStorage.setItem('zenwriter_content', debouncedText);
    } catch (e) {
      console.warn('Storage quota exceeded or unavailable');
    }
  }, [debouncedText]);

  // Save theme to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('zenwriter_theme', theme);
    } catch (e) {}
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const handleClearAll = useCallback(() => {
    setText('');
    setIsClearConfirmOpen(false);
    // Use requestAnimationFrame for smoother focus transition on older devices
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    });
  }, []);

  // Handle Copy to Clipboard
  const handleCopy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }, [text]);

  // Handle Paste from Clipboard
  const handlePaste = useCallback(async () => {
    try {
      window.focus();

      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error('Clipboard API not supported');
      }

      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
          if (status.state === 'denied') {
            setPasteError('Access denied');
            setTimeout(() => setPasteError(null), 3000);
            return;
          }
        } catch (e) {}
      }

      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        setText(prev => prev + (prev ? '\n' : '') + clipboardText);
        setIsPasted(true);
        setTimeout(() => setIsPasted(false), 2000);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        });
      } else {
        setPasteError('Clipboard empty');
        setTimeout(() => setPasteError(null), 3000);
      }
    } catch (err: any) {
      console.error('Failed to paste: ', err);
      if (err.name === 'NotAllowedError' || err.message.includes('denied') || err.message.includes('blocked')) {
        setPasteError('Use Ctrl+V');
      } else {
        setPasteError('Failed');
      }
      setTimeout(() => setPasteError(null), 3000);
    }
  }, []);

  // Handle PDF Generation (Dynamic Import for performance)
  const handleDownloadPDF = useCallback(async () => {
    if (!text.trim()) return;
    
    setIsExportConfirmOpen(false);
    setIsGenerating(true);
    try {
      // Lazy load html2pdf to reduce initial load
      const { default: html2pdf } = await import('html2pdf.js');

      const opt = {
        margin: [20, 20, 20, 20] as [number, number, number, number],
        filename: 'zenwriter-document.pdf',
        image: { type: 'jpeg' as const, quality: 1.0 },
        html2canvas: { 
          scale: 2.5, // Balanced for quality vs memory on mobile
          useCORS: true,
          logging: false,
          letterRendering: false,
          scrollY: 0,
          windowWidth: 1000,
          backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as any }
      };

      const paragraphs = text.split('\n').map(p => 
        `<div style="page-break-inside: avoid; min-height: 1.2em;">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '&nbsp;'}</div>`
      ).join('');

      const pdfContent = `
        <div style="
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
          font-size: 13pt;
          line-height: 1.7;
          color: #000;
          white-space: normal;
          word-wrap: break-word;
          width: 100%;
          padding: 40px;
          margin: 0;
          box-sizing: border-box;
          background-color: #fff;
        ">${paragraphs}</div>
      `;

      await html2pdf().set(opt).from(pdfContent).save();
    } catch (err) {
      console.error('PDF generation failed: ', err);
    } finally {
      setIsGenerating(false);
    }
  }, [text]);

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0A0A0A] text-[#E5E5E5]' : 'bg-[#FDFDFB] text-[#1A1A1A]'} font-sans selection:bg-emerald-100 selection:text-emerald-900 dark:selection:bg-emerald-900/30 dark:selection:text-emerald-100 overflow-x-hidden`}>
      {/* Floating Toolbar - Responsive and Touch-Friendly */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2 sm:gap-3">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-1 sm:gap-2 ${theme === 'dark' ? 'bg-zinc-900/90 border-white/5' : 'bg-white/90 border-black/5'} backdrop-blur-md border shadow-lg rounded-full px-2 py-1.5`}
        >
          <button
            onClick={handleCopy}
            title="Copy all text"
            className={`p-3 sm:p-2 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'} rounded-full transition-colors relative group active:scale-95`}
          >
            {isCopied ? (
              <Check className={`w-4 h-4 sm:w-4 sm:h-4 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
            ) : (
              <Copy className={`w-4 h-4 sm:w-4 sm:h-4 ${theme === 'dark' ? 'text-zinc-400 group-hover:text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-900'}`} />
            )}
            <span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-zinc-900 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {isCopied ? 'Copied!' : 'Copy'}
            </span>
          </button>

          <button
            onClick={handlePaste}
            title="Paste from clipboard"
            className={`p-3 sm:p-2 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'} rounded-full transition-colors relative group active:scale-95`}
          >
            {isPasted ? (
              <Check className={`w-4 h-4 sm:w-4 sm:h-4 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
            ) : (
              <ClipboardPaste className={`w-4 h-4 sm:w-4 sm:h-4 ${pasteError ? 'text-red-400' : theme === 'dark' ? 'text-zinc-400 group-hover:text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-900'}`} />
            )}
            <span className={`hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-medium ${pasteError ? 'bg-red-500' : 'bg-zinc-900'} text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none`}>
              {pasteError || (isPasted ? 'Pasted!' : 'Paste')}
            </span>
          </button>

          <div className={`w-px h-4 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />

          <button
            onClick={() => setIsExportConfirmOpen(true)}
            disabled={isGenerating || text.length === 0}
            title="Download as PDF"
            className={`p-3 sm:p-2 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'} rounded-full transition-colors relative group disabled:opacity-30 disabled:cursor-not-allowed active:scale-95`}
          >
            <FileDown className={`w-4 h-4 sm:w-4 sm:h-4 ${isGenerating ? (theme === 'dark' ? 'animate-pulse text-emerald-400' : 'animate-pulse text-emerald-600') : theme === 'dark' ? 'text-zinc-400 group-hover:text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-900'}`} />
            <span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-zinc-900 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {isGenerating ? 'Generating...' : text.length === 0 ? 'Write something' : 'PDF'}
            </span>
          </button>

          <div className={`w-px h-4 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />

          <button
            onClick={() => setIsClearConfirmOpen(true)}
            disabled={text.length === 0}
            title="Clear all text"
            className={`p-3 sm:p-2 ${theme === 'dark' ? 'hover:bg-red-500/10' : 'hover:bg-red-50'} rounded-full transition-colors relative group disabled:opacity-30 disabled:cursor-not-allowed active:scale-95`}
          >
            <Trash2 className={`w-4 h-4 sm:w-4 sm:h-4 ${theme === 'dark' ? 'text-zinc-400 group-hover:text-red-400' : 'text-zinc-500 group-hover:text-red-500'}`} />
            <span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-zinc-900 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Clear
            </span>
          </button>

          <div className={`w-px h-4 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />

          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            className={`p-3 sm:p-2 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'} rounded-full transition-colors relative group active:scale-95`}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 sm:w-4 sm:h-4 text-zinc-500 group-hover:text-zinc-900" />
            ) : (
              <Sun className="w-4 h-4 sm:w-4 sm:h-4 text-zinc-400 group-hover:text-zinc-100" />
            )}
            <span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-zinc-900 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {theme === 'light' ? 'Dark' : 'Light'}
            </span>
          </button>
        </motion.div>
      </div>

      {/* Editor Area */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32 min-h-screen flex flex-col">
        {/* Stylish Minimal Logo */}
        <div className="mb-12 sm:mb-20 flex justify-center">
          <div className="flex flex-col items-center gap-4 cursor-default">
            <div className="relative w-10 h-10 sm:w-12 sm:h-12">
              {/* Outer Ring */}
              <div className={`absolute inset-0 border ${theme === 'dark' ? 'border-zinc-700' : 'border-zinc-200'} rounded-full transition-colors duration-700`} />
              {/* Inner Mark */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-px h-5 sm:h-6 ${theme === 'dark' ? 'bg-zinc-300' : 'bg-zinc-800'} transition-colors duration-700 transform -rotate-12`} />
                <div className="absolute w-1.5 h-1.5 bg-emerald-400 rounded-full blur-[1px] opacity-100 transition-opacity duration-700 translate-x-2 translate-y-2" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <h1 className={`text-[9px] sm:text-[10px] font-medium tracking-[0.5em] uppercase ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-900'} transition-colors duration-700`}>
                ZenWriter
              </h1>
              <div className={`w-10 sm:w-12 h-px ${theme === 'dark' ? 'bg-zinc-200' : 'bg-zinc-900'} transition-all duration-700`} />
            </div>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write here something..."
          className={`flex-1 w-full bg-transparent border-none outline-none resize-none text-base sm:text-lg md:text-xl leading-relaxed ${theme === 'dark' ? 'placeholder:text-zinc-800' : 'placeholder:text-zinc-300'} focus:ring-0 p-0 transition-all duration-300`}
          spellCheck="false"
          autoFocus
        />
      </main>

      {/* Footer / Word Count - Responsive */}
      <footer className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex justify-between items-center pointer-events-none gap-2">
        <div className={`text-[9px] sm:text-[10px] font-medium tracking-widest uppercase ${theme === 'dark' ? 'text-zinc-400 bg-zinc-900/80 border-white/10' : 'text-zinc-500 bg-white/80 border-black/5'} backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm`}>
          {text.trim() === '' ? 'Empty' : `${text.trim().split(/\s+/).length} Words`}
        </div>
        <div className={`text-[9px] sm:text-[10px] font-medium tracking-widest uppercase ${theme === 'dark' ? 'text-zinc-400 bg-zinc-900/80 border-white/10' : 'text-zinc-500 bg-white/80 border-black/5'} backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm`}>
          {text.length} Chars
        </div>
      </footer>

      {/* Confirmation Modals */}
      <AnimatePresence mode="wait">
        {/* Clear All Confirmation */}
        {isClearConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClearConfirmOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`relative w-full max-w-sm ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/5'} border shadow-2xl rounded-[2rem] p-6 sm:p-8 overflow-hidden`}
            >
              <div className="flex flex-col items-center text-center gap-6">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'}`}>
                  <AlertTriangle className={`w-7 h-7 sm:w-8 sm:h-8 ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`} />
                </div>
                
                <div className="flex flex-col gap-2">
                  <h2 className={`text-lg sm:text-xl font-semibold ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}>
                    Clear everything?
                  </h2>
                  <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    This action cannot be undone. All your current writing will be permanently deleted.
                  </p>
                </div>

                <div className="flex flex-col w-full gap-3">
                  <button
                    onClick={handleClearAll}
                    className="w-full py-3.5 sm:py-4 bg-red-500 hover:bg-red-600 active:scale-[0.98] text-white rounded-2xl font-semibold transition-all shadow-lg shadow-red-500/20"
                  >
                    Yes, clear all
                  </button>
                  <button
                    onClick={() => setIsClearConfirmOpen(false)}
                    className={`w-full py-3.5 sm:py-4 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'} active:scale-[0.98] rounded-2xl font-semibold transition-all`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Export PDF Confirmation */}
        {isExportConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportConfirmOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`relative w-full max-w-sm ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/5'} border shadow-2xl rounded-[2rem] p-6 sm:p-8 overflow-hidden`}
            >
              <div className="flex flex-col items-center text-center gap-6">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                  <FileDown className={`w-7 h-7 sm:w-8 sm:h-8 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'}`} />
                </div>
                
                <div className="flex flex-col gap-2">
                  <h2 className={`text-lg sm:text-xl font-semibold ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}>
                    Export to PDF?
                  </h2>
                  <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Your document will be saved as a high-quality PDF file.
                  </p>
                </div>

                <div className="flex flex-col w-full gap-3">
                  <button
                    onClick={handleDownloadPDF}
                    className="w-full py-3.5 sm:py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white rounded-2xl font-semibold transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={() => setIsExportConfirmOpen(false)}
                    className={`w-full py-3.5 sm:py-4 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'} active:scale-[0.98] rounded-2xl font-semibold transition-all`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
