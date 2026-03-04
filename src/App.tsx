/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, FileDown, Check, Sun, Moon, Trash2, AlertTriangle, ClipboardPaste, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
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
  const [pdfMargin, setPdfMargin] = useState<number>(40);
  const [pdfFileName, setPdfFileName] = useState<string>(() => {
    return `zenwriter-${new Date().toISOString().slice(0, 10)}`;
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('zenwriter_theme') as 'light' | 'dark') || 'light';
    } catch (e) {
      return 'light';
    }
  });
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    alignJustify: false
  });
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSelection = useRef<Range | null>(null);

  // Update formatting state based on selection
  const updateFormatState = useCallback(() => {
    setFormatState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      alignLeft: document.queryCommandState('justifyLeft'),
      alignCenter: document.queryCommandState('justifyCenter'),
      alignRight: document.queryCommandState('justifyRight'),
      alignJustify: document.queryCommandState('justifyFull')
    });

    // Save selection for manual paste button
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      lastSelection.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      updateFormatState();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateFormatState]);

  // Helper to strip HTML for word count with better word separation
  const getPlainText = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // Add spaces before block elements to prevent words from sticking together
    const blocks = tmp.querySelectorAll('div, p, br, h1, h2, h3, h4, h5, h6, li');
    blocks.forEach(b => {
      b.insertAdjacentText('beforebegin', ' ');
    });
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  };

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

  // Sync editor content with state (only when not focused to avoid cursor jumps)
  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = text;
    }
  }, [text]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setText(e.currentTarget.innerHTML);
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    // Restore selection if lost (critical for mobile)
    if (lastSelection.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(lastSelection.current);
    }

    if (editorRef.current) {
      editorRef.current.focus();
    }

    const success = document.execCommand(command, false, value);
    
    // Fallback for Bold/Italic/Underline if execCommand fails on some mobile browsers
    if (!success && ['bold', 'italic', 'underline'].includes(command)) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (!range.collapsed) {
          const tag = command === 'bold' ? 'b' : command === 'italic' ? 'i' : 'u';
          const wrapper = document.createElement(tag);
          try {
            range.surroundContents(wrapper);
          } catch (e) {
            // If surroundContents fails (e.g. selection crosses nodes), use a more complex approach
            const content = range.extractContents();
            wrapper.appendChild(content);
            range.insertNode(wrapper);
          }
        }
      }
    }

    updateFormatState();
    if (editorRef.current) {
      // Sync state immediately so formatting reflects in PDF and auto-save
      setText(editorRef.current.innerHTML);
    }
  };

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
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setIsClearConfirmOpen(false);
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    });
  }, []);

  // Handle Copy to Clipboard
  const handleCopy = useCallback(async () => {
    const plainText = getPlainText(text);
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }, [text]);

  // Robust insertion method for mobile/desktop
  const insertAtCursor = useCallback((html: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    
    // Try execCommand first for undo history
    const success = document.execCommand('insertHTML', false, html);
    
    // Fallback for browsers where execCommand might fail or behave oddly
    if (!success) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const el = document.createElement('div');
        el.innerHTML = html;
        const frag = document.createDocumentFragment();
        let node;
        while ((node = el.firstChild)) {
          frag.appendChild(node);
        }
        range.insertNode(frag);
        // Move cursor to end
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    
    // Always sync state
    if (editorRef.current) {
      setText(editorRef.current.innerHTML);
    }
  }, []);

  // Helper to process and sanitize HTML paste while preserving B/I/U
  const sanitizeHtmlForPaste = useCallback((html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const clean = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '';
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const style = el.getAttribute('style') || '';
      const children = Array.from(el.childNodes).map(clean).join('');
      
      let result = children;
      
      // Extremely Broad Bold Detection (ChatGPT, Mobile Browsers, etc.)
      const isBold = ['b', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag) || 
                     /font-weight\s*:\s*(bold|[6-9]00)/i.test(style) ||
                     el.style.fontWeight === 'bold' ||
                     (el.style.fontWeight && parseInt(el.style.fontWeight) >= 600) ||
                     el.classList.contains('bold') ||
                     el.classList.contains('font-bold') ||
                     tag.startsWith('h');
      
      // Broad Italic Detection
      const isItalic = ['i', 'em'].includes(tag) || 
                       /font-style\s*:\s*italic/i.test(style) ||
                       el.style.fontStyle === 'italic' ||
                       el.classList.contains('italic');
      
      // Broad Underline Detection
      const isUnderline = ['u'].includes(tag) || 
                          /text-decoration\s*:\s*underline/i.test(style) ||
                          /text-decoration-line\s*:\s*underline/i.test(style) ||
                          el.style.textDecoration.includes('underline') ||
                          el.classList.contains('underline');

      // Preserve Line Height if present
      const lineHeightMatch = style.match(/line-height\s*:\s*([^;]+)/i);
      const preservedLineHeight = lineHeightMatch ? lineHeightMatch[1] : '';

      if (isBold) result = `<b>${result}</b>`;
      if (isItalic) result = `<i>${result}</i>`;
      if (isUnderline) result = `<u>${result}</u>`;
      
      // Wrap in span if line height needs to be preserved
      if (preservedLineHeight) {
        result = `<span style="line-height: ${preservedLineHeight}">${result}</span>`;
      }
      
      // Handle line breaks and block elements
      if (['div', 'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'article', 'section', 'header', 'footer'].includes(tag)) {
        // Avoid double breaks
        return `<br>${result}`;
      }
      
      return result;
    };

    const sanitized = Array.from(doc.body.childNodes).map(clean).join('');
    // Clean up multiple consecutive breaks and normalize
    return sanitized
      .replace(/(<br>){3,}/g, '<br><br>')
      .replace(/^(<br>)+/, '')
      .replace(/(<br>)+$/, '')
      .replace(/&nbsp;/g, ' ');
  }, []);

  // Handle Paste from Clipboard
  const handlePaste = useCallback(async (e?: React.ClipboardEvent) => {
    // If it's a manual paste button click
    if (!e) {
      try {
        // Restore selection if lost
        if (lastSelection.current) {
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(lastSelection.current);
        }

        window.focus();
        if (editorRef.current) editorRef.current.focus();

        // Try to use the newer Clipboard API to read rich text if possible
        if (navigator.clipboard && navigator.clipboard.read) {
          try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
              if (item.types.includes('text/html')) {
                const blob = await item.getType('text/html');
                const html = await blob.text();
                const sanitized = sanitizeHtmlForPaste(html);
                insertAtCursor(sanitized);
                setIsPasted(true);
                setTimeout(() => setIsPasted(false), 2000);
                return;
              }
            }
          } catch (readErr) {
            console.warn('Clipboard read failed, falling back to readText');
          }
        }
        
        // Fallback to plain text
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText) {
          const escaped = clipboardText.replace(/\n/g, '<br>');
          insertAtCursor(escaped);
          setIsPasted(true);
          setTimeout(() => setIsPasted(false), 2000);
        }
      } catch (err: any) {
        setPasteError('Long-press to paste');
        setTimeout(() => setPasteError(null), 3000);
      }
      return;
    }

    // If it's a native paste event
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');

    // CRITICAL FIX FOR MOBILE: If HTML is available, we handle it.
    // If NOT available (common on mobile context menu), we let the browser do its default paste
    // which usually preserves formatting better than plain text fallback.
    if (html) {
      e.preventDefault();
      const sanitized = sanitizeHtmlForPaste(html);
      insertAtCursor(sanitized);
    } else {
      // Let the browser handle the paste natively.
      // This is the most reliable way on mobile browsers to preserve formatting
      // when the JS API is restricted.
      setTimeout(() => {
        if (editorRef.current) {
          setText(editorRef.current.innerHTML);
        }
      }, 0);
    }
  }, [insertAtCursor, sanitizeHtmlForPaste, text]);

  // Handle PDF Generation (Dynamic Import for performance)
  const handleDownloadPDF = useCallback(async () => {
    const plainText = getPlainText(text);
    if (!plainText.trim()) return;
    
    setIsExportConfirmOpen(false);
    setIsGenerating(true);
    try {
      const { default: html2pdf } = await import('html2pdf.js');

      const wordCount = plainText.trim().split(/\s+/).length;
      let scale = 2.5; // Optimized scale for quality vs performance
      if (wordCount > 10000) scale = 1.2;
      else if (wordCount > 5000) scale = 1.8;

      const opt = {
        margin: [pdfMargin, pdfMargin, pdfMargin + 20, pdfMargin] as [number, number, number, number],
        filename: `${pdfFileName || 'zenwriter-document'}.pdf`,
        image: { type: 'jpeg' as const, quality: 1.0 },
        html2canvas: { 
          scale: scale,
          useCORS: true,
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollY: 0,
          windowWidth: 1200 // Fixed width for consistent rendering
        },
        jsPDF: { 
          unit: 'pt' as const, // Points are more precise for text
          format: 'a4' as const, 
          orientation: 'portrait' as const,
          compress: true
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      const pdfContent = `
        <div style="
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 11pt;
          color: #1a1a1a;
          width: 100%;
          padding: 0 0 40pt 0;
          margin: 0;
          background-color: #fff;
          line-height: 1.5;
        ">
          <style>
            b, strong { font-weight: bold !important; }
            i, em { font-style: italic !important; }
            u { text-decoration: underline !important; }
            p, div { margin-bottom: 0.6em; page-break-inside: avoid; }
            br { content: ""; display: block; margin-bottom: 0.3em; }
            span { page-break-inside: avoid; }
            * { box-sizing: border-box; }
          </style>
          <div style="border-bottom: 1px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 25px; display: flex; justify-content: space-between; font-size: 8pt; color: #a0a0a0; text-transform: uppercase; letter-spacing: 0.1em;">
            <span>${pdfFileName || 'ZenWriter Document'}</span>
            <span>${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div style="white-space: pre-wrap; word-wrap: break-word; text-align: left; width: 100%;">
            ${text}
          </div>
          <div style="margin-top: 40px; border-top: 1px solid #f0f0f0; padding-top: 15px; text-align: center; font-size: 7pt; color: #d0d0d0; letter-spacing: 0.05em;">
            Handcrafted in ZenWriter
          </div>
        </div>
      `;

      await html2pdf().from(pdfContent).set(opt).save();
      
    } catch (err) {
      console.error('PDF generation failed: ', err);
      alert('Export failed. Please try with less text or a different browser.');
    } finally {
      setIsGenerating(false);
    }
  }, [text, pdfMargin, pdfFileName]);

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0A0A0A] text-[#E5E5E5]' : 'bg-[#FDFDFB] text-[#1A1A1A]'} font-sans selection:bg-emerald-100 selection:text-emerald-900 dark:selection:bg-emerald-900/30 dark:selection:text-emerald-100 overflow-x-hidden`}>
      {/* Floating Toolbar - Responsive and Touch-Friendly */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:bottom-auto sm:top-6 sm:right-6 sm:left-auto z-50 w-[92%] sm:w-auto max-w-md sm:max-w-none">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-start gap-1 sm:gap-1.5 ${theme === 'dark' ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-black/10'} backdrop-blur-xl border shadow-2xl rounded-2xl sm:rounded-full px-2 py-2 sm:px-3 sm:py-2 overflow-x-auto no-scrollbar`}
        >
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={handleCopy}
              title="Copy all text"
              className={`p-2.5 sm:p-2 ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'} rounded-xl sm:rounded-full transition-colors active:scale-90 flex-shrink-0`}
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={() => handlePaste()}
              title="Paste from clipboard"
              className={`p-2.5 sm:p-2 ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'} rounded-xl sm:rounded-full transition-colors active:scale-90 flex-shrink-0`}
            >
              {isPasted ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <ClipboardPaste className={`w-4 h-4 ${pasteError ? 'text-red-400' : ''}`} />
              )}
            </button>
          </div>

          <div className={`w-px h-4 mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'} flex-shrink-0`} />

          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => execCommand('bold')}
              className={`p-2.5 sm:p-2 rounded-xl sm:rounded-full transition-all active:scale-90 flex-shrink-0 ${
                formatState.bold 
                  ? (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') 
                  : (theme === 'dark' ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-black/5 text-zinc-800')
              }`}
              title="Bold (Ctrl+B)"
            >
              <span className="font-bold text-sm">B</span>
            </button>
            <button
              onClick={() => execCommand('italic')}
              className={`p-2.5 sm:p-2 rounded-xl sm:rounded-full transition-all active:scale-90 flex-shrink-0 ${
                formatState.italic 
                  ? (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') 
                  : (theme === 'dark' ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-black/5 text-zinc-800')
              }`}
              title="Italic (Ctrl+I)"
            >
              <span className="italic text-sm">I</span>
            </button>
            <button
              onClick={() => execCommand('underline')}
              className={`p-2.5 sm:p-2 rounded-xl sm:rounded-full transition-all active:scale-90 flex-shrink-0 ${
                formatState.underline 
                  ? (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') 
                  : (theme === 'dark' ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-black/5 text-zinc-800')
              }`}
              title="Underline (Ctrl+U)"
            >
              <span className="underline text-sm">U</span>
            </button>
          </div>

          <div className={`w-px h-4 mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'} flex-shrink-0`} />

          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => execCommand('justifyLeft')}
              className={`p-2.5 sm:p-2 rounded-xl sm:rounded-full transition-all active:scale-90 flex-shrink-0 ${
                formatState.alignLeft 
                  ? (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') 
                  : (theme === 'dark' ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-black/5 text-zinc-800')
              }`}
              title="Align Left"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => execCommand('justifyCenter')}
              className={`p-2.5 sm:p-2 rounded-xl sm:rounded-full transition-all active:scale-90 flex-shrink-0 ${
                formatState.alignCenter 
                  ? (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') 
                  : (theme === 'dark' ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-black/5 text-zinc-800')
              }`}
              title="Align Center"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              onClick={() => execCommand('justifyRight')}
              className={`p-2.5 sm:p-2 rounded-xl sm:rounded-full transition-all active:scale-90 flex-shrink-0 ${
                formatState.alignRight 
                  ? (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') 
                  : (theme === 'dark' ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-black/5 text-zinc-800')
              }`}
              title="Align Right"
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => execCommand('justifyFull')}
              className={`p-2.5 sm:p-2 rounded-xl sm:rounded-full transition-all active:scale-90 flex-shrink-0 ${
                formatState.alignJustify 
                  ? (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') 
                  : (theme === 'dark' ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-black/5 text-zinc-800')
              }`}
              title="Justify"
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          <div className={`w-px h-4 mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'} flex-shrink-0`} />

          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => setIsExportConfirmOpen(true)}
              disabled={isGenerating || getPlainText(text).length === 0}
              title="Download as PDF"
              className={`p-2.5 sm:p-2 ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'} rounded-xl sm:rounded-full transition-colors disabled:opacity-30 active:scale-90 flex-shrink-0`}
            >
              <FileDown className={`w-4 h-4 ${isGenerating ? 'animate-pulse text-emerald-500' : ''}`} />
            </button>

            <button
              onClick={() => setIsClearConfirmOpen(true)}
              disabled={getPlainText(text).length === 0}
              title="Clear all text"
              className={`p-2.5 sm:p-2 ${theme === 'dark' ? 'hover:bg-red-500/10 text-zinc-400 hover:text-red-400' : 'hover:bg-red-50 text-zinc-500 hover:text-red-500'} rounded-xl sm:rounded-full transition-colors disabled:opacity-30 active:scale-90 flex-shrink-0`}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className={`p-2.5 sm:p-2 ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'} rounded-xl sm:rounded-full transition-colors active:scale-90 flex-shrink-0`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
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

        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          className={`flex-1 w-full bg-transparent border-none outline-none text-base sm:text-lg md:text-xl leading-relaxed ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-900'} focus:ring-0 p-0 transition-all duration-300 min-h-[50vh] relative before:content-[attr(data-placeholder)] before:absolute before:left-0 before:top-0 before:pointer-events-none ${getPlainText(text).trim() === '' ? (theme === 'dark' ? 'before:text-zinc-800' : 'before:text-zinc-300') : 'before:hidden'}`}
          data-placeholder="Write here something..."
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left' }}
        />
      </main>

      {/* Footer / Word Count - Responsive - Moved to top on mobile to avoid toolbar overlap */}
      <footer className="fixed top-4 left-4 right-4 sm:top-auto sm:bottom-6 sm:left-6 sm:right-6 flex justify-between items-center pointer-events-none gap-2 z-40">
        <div className={`text-[9px] sm:text-[10px] font-medium tracking-widest uppercase ${theme === 'dark' ? 'text-zinc-400 bg-zinc-900/80 border-white/10' : 'text-zinc-500 bg-white/80 border-black/5'} backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm transition-all duration-500`}>
          {getPlainText(text).trim() === '' ? 'Empty' : `${getPlainText(text).trim().split(/\s+/).length} Words`}
        </div>
        <div className={`text-[9px] sm:text-[10px] font-medium tracking-widest uppercase ${theme === 'dark' ? 'text-zinc-400 bg-zinc-900/80 border-white/10' : 'text-zinc-500 bg-white/80 border-black/5'} backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm transition-all duration-500`}>
          {getPlainText(text).length} Chars
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
              transition={{ duration: 0.2 }}
              onClick={() => setIsClearConfirmOpen(false)}
              className="absolute inset-0 bg-black/60"
              style={{ willChange: 'opacity' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`relative w-full max-w-sm ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/5'} border shadow-2xl rounded-[2rem] p-6 sm:p-8 overflow-hidden`}
              style={{ willChange: 'transform, opacity' }}
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
              transition={{ duration: 0.2 }}
              onClick={() => setIsExportConfirmOpen(false)}
              className="absolute inset-0 bg-black/60"
              style={{ willChange: 'opacity' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`relative w-full max-w-sm ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/5'} border shadow-2xl rounded-[2rem] p-6 sm:p-8 overflow-hidden`}
              style={{ willChange: 'transform, opacity' }}
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
                    Name your document and choose margins.
                  </p>
                </div>

                {/* Filename Input */}
                <div className="w-full flex flex-col gap-3">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    File Name
                  </label>
                  <input
                    type="text"
                    value={pdfFileName}
                    onChange={(e) => setPdfFileName(e.target.value)}
                    placeholder="Enter file name..."
                    className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-white/10 text-white focus:border-emerald-500/50' 
                        : 'bg-zinc-50 border-black/5 text-zinc-900 focus:border-emerald-500/50'
                    }`}
                  />
                </div>

                {/* Margin Control */}
                <div className="w-full flex flex-col gap-3">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Page Margins
                  </label>
                  <div className={`flex p-1 rounded-xl ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                    {[
                      { label: 'Narrow', value: 30 },
                      { label: 'Normal', value: 50 },
                      { label: 'Wide', value: 72 }
                    ].map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setPdfMargin(m.value)}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                          pdfMargin === m.value
                            ? (theme === 'dark' ? 'bg-zinc-700 text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm')
                            : (theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700')
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
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

        {/* Global Loading Overlay for PDF Generation - Optimized for Mobile */}
        {isGenerating && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <div
              className="absolute inset-0 bg-black/80"
              style={{ willChange: 'opacity' }}
            />
            <div
              className="relative flex flex-col items-center gap-6"
              style={{ willChange: 'transform, opacity' }}
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-emerald-500/10 rounded-full" />
                <div
                  className="absolute inset-0 w-16 h-16 border-4 border-t-emerald-500 rounded-full animate-spin"
                  style={{ willChange: 'transform' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileDown className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <h3 className="text-white font-medium text-base tracking-wide">Exporting PDF</h3>
                <p className="text-zinc-500 text-xs animate-pulse">Processing document...</p>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
