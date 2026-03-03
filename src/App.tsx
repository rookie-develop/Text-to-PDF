/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Copy, FileDown, Check, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [text, setText] = useState<string>(() => {
    // Load from localStorage on initial render
    return localStorage.getItem('zenwriter_content') || '';
  });
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('zenwriter_theme') as 'light' | 'dark') || 'light';
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem('zenwriter_content', text);
  }, [text]);

  // Save theme to localStorage
  useEffect(() => {
    localStorage.setItem('zenwriter_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Handle Copy to Clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Handle PDF Generation
  const handleDownloadPDF = async () => {
    if (!text.trim()) return;
    
    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - 2 * margin;
      const contentHeight = pageHeight - 2 * margin;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      // Split text into paragraphs first to preserve newlines
      const paragraphs = text.split('\n');
      let cursorY = margin;
      
      paragraphs.forEach((paragraph) => {
        // If paragraph is empty, just move cursor down (empty line)
        if (paragraph.trim() === '') {
          cursorY += 7;
          return;
        }

        const lines = doc.splitTextToSize(paragraph, contentWidth);
        
        lines.forEach((line: string) => {
          if (cursorY + 7 > pageHeight - margin) {
            doc.addPage();
            cursorY = margin;
          }
          doc.text(line, margin, cursorY);
          cursorY += 7; // Line height
        });
      });

      doc.save('zenwriter-document.pdf');
    } catch (err) {
      console.error('PDF generation failed: ', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0A0A0A] text-[#E5E5E5]' : 'bg-[#FDFDFB] text-[#1A1A1A]'} font-sans selection:bg-emerald-100 selection:text-emerald-900 dark:selection:bg-emerald-900/30 dark:selection:text-emerald-100`}>
      {/* Floating Toolbar */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 ${theme === 'dark' ? 'bg-zinc-900/80 border-white/5' : 'bg-white/80 border-black/5'} backdrop-blur-md border shadow-sm rounded-full px-2 py-1.5`}
        >
          <button
            onClick={handleCopy}
            title="Copy all text"
            className={`p-2 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'} rounded-full transition-colors relative group`}
          >
            {isCopied ? (
              <Check className={`w-4 h-4 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
            ) : (
              <Copy className={`w-4 h-4 ${theme === 'dark' ? 'text-zinc-400 group-hover:text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-900'}`} />
            )}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-zinc-900 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {isCopied ? 'Copied!' : 'Copy'}
            </span>
          </button>

          <div className={`w-px h-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />

          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating || text.length === 0}
            title="Download as PDF"
            className={`p-2 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'} rounded-full transition-colors relative group disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <FileDown className={`w-4 h-4 ${isGenerating ? (theme === 'dark' ? 'animate-pulse text-emerald-400' : 'animate-pulse text-emerald-600') : theme === 'dark' ? 'text-zinc-400 group-hover:text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-900'}`} />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-zinc-900 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {isGenerating ? 'Generating...' : text.length === 0 ? 'Write something' : 'PDF'}
            </span>
          </button>

          <div className={`w-px h-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />

          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            className={`p-2 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'} rounded-full transition-colors relative group`}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-900" />
            ) : (
              <Sun className="w-4 h-4 text-zinc-400 group-hover:text-zinc-100" />
            )}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-zinc-900 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {theme === 'light' ? 'Dark' : 'Light'}
            </span>
          </button>
        </motion.div>
      </div>

      {/* Editor Area */}
      <main className="max-w-3xl mx-auto px-6 pt-24 pb-32 min-h-screen flex flex-col">
        {/* Stylish Minimal Logo */}
        <div className="mb-20 flex justify-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 group cursor-default"
          >
            <div className="relative w-12 h-12">
              {/* Outer Ring */}
              <div className={`absolute inset-0 border ${theme === 'dark' ? 'border-zinc-800 group-hover:border-zinc-700' : 'border-zinc-100 group-hover:border-zinc-200'} rounded-full transition-colors duration-700`} />
              {/* Inner Mark */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-px h-6 ${theme === 'dark' ? 'bg-zinc-700 group-hover:bg-zinc-300' : 'bg-zinc-200 group-hover:bg-zinc-800'} transition-colors duration-700 transform -rotate-12`} />
                <div className="absolute w-1.5 h-1.5 bg-emerald-400 rounded-full blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 translate-x-2 translate-y-2" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <h1 className={`text-[10px] font-medium tracking-[0.5em] uppercase ${theme === 'dark' ? 'text-zinc-500 group-hover:text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-900'} transition-colors duration-700`}>
                ZenWriter
              </h1>
              <div className={`w-4 h-px ${theme === 'dark' ? 'bg-zinc-700 group-hover:bg-zinc-200' : 'bg-zinc-200 group-hover:bg-zinc-900'} group-hover:w-12 transition-all duration-700`} />
            </div>
          </motion.div>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start writing..."
          className={`flex-1 w-full bg-transparent border-none outline-none resize-none text-lg md:text-xl leading-relaxed ${theme === 'dark' ? 'placeholder:text-zinc-700' : 'placeholder:text-zinc-400'} focus:ring-0 p-0`}
          spellCheck="false"
          autoFocus
        />
      </main>

      {/* Footer / Word Count */}
      <footer className="fixed bottom-6 left-6 right-6 flex justify-between items-center pointer-events-none">
        <div className={`text-[10px] font-medium tracking-widest uppercase ${theme === 'dark' ? 'text-zinc-400 bg-zinc-900/50 border-white/10' : 'text-zinc-500 bg-white/50 border-black/5'} backdrop-blur-sm px-3 py-1 rounded-full border`}>
          {text.trim() === '' ? 'Empty' : `${text.trim().split(/\s+/).length} Words`}
        </div>
        <div className={`text-[10px] font-medium tracking-widest uppercase ${theme === 'dark' ? 'text-zinc-400 bg-zinc-900/50 border-white/10' : 'text-zinc-500 bg-white/50 border-black/5'} backdrop-blur-sm px-3 py-1 rounded-full border`}>
          {text.length} Characters
        </div>
      </footer>
    </div>
  );
}
