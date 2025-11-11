import React, { useRef, useEffect } from 'react';
import { Message } from '../types';
import { UserIcon, AssistantIcon, SendIcon, LoadingIcon, ClearIcon } from './Icons';

interface SidePanelProps {
  messages: Message[];
  prompt: string;
  setPrompt: (prompt: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: React.ReactNode | null;
  onShowModal: (content: 'about' | 'privacy' | 'safety') => void;
  onClearHistory: () => void;
}

const processMarkdown = (text: string) => {
    let processedText = text;
    // Links - must process before other markdown that might be in the link text
    processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>');
    // Bold
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    processedText = processedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    return processedText;
}

const renderContent = (content: string) => {
  const lines = content.split('\n');
  return lines.map((line, index) => {
    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-lg font-semibold text-gray-800 mt-4 mb-2" dangerouslySetInnerHTML={{ __html: processMarkdown(line.substring(4))}}></h3>;
    }
    if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-bold text-gray-900 mt-6 mb-3" dangerouslySetInnerHTML={{ __html: processMarkdown(line.substring(3))}}></h2>;
    }
    if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-extrabold text-blue-600 mt-8 mb-4" dangerouslySetInnerHTML={{ __html: processMarkdown(line.substring(2))}}></h1>;
    }
    if (line.startsWith('* ')) {
      return <li key={index} className="ml-5 list-disc text-gray-700" dangerouslySetInnerHTML={{ __html: processMarkdown(line.substring(2)) }}></li>;
    }
    if (line.startsWith('WAYPOINTS:') || line.startsWith('POIS:')) {
      return null;
    }
    
    return <p key={index} className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: processMarkdown(line) }} />;
  });
};


export const SidePanel: React.FC<SidePanelProps> = ({
  messages,
  prompt,
  setPrompt,
  handleSubmit,
  isLoading,
  error,
  onShowModal,
  onClearHistory,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <aside className="w-full md:w-[30%] lg:w-[25%] max-w-md h-full bg-white shadow-2xl flex flex-col z-10">
      <header className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">Taiwan Campervan AI Navigator</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && <div className="w-8 h-8 flex-shrink-0 bg-blue-500 rounded-full flex items-center justify-center text-white">{<AssistantIcon />}</div>}
            <div className={`max-w-xs md:max-w-sm rounded-lg p-3 ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
              <div className="prose prose-sm max-w-none">
                {renderContent(msg.content)}
              </div>
            </div>
            {msg.role === 'user' && <div className="w-8 h-8 flex-shrink-0 bg-gray-300 rounded-full flex items-center justify-center text-gray-600">{<UserIcon />}</div>}
          </div>
        ))}
        {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                <p className="font-bold">Error</p>
                <p>{error}</p>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your trip..."
            className="flex-1 p-2 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-gray-700 text-white placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="p-2 w-10 h-10 flex items-center justify-center bg-blue-500 text-white rounded-lg disabled:bg-gray-300 hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            aria-label="Generate Trip"
          >
            {isLoading ? <LoadingIcon /> : <SendIcon />}
          </button>
        </form>
        <div className="pt-3 flex justify-between items-center text-xs text-gray-400">
            <footer className="flex items-center gap-2">
                <button onClick={() => onShowModal('about')} className="hover:underline">About</button>
                <span>&bull;</span>
                <button onClick={() => onShowModal('privacy')} className="hover:underline">Privacy</button>
                <span>&bull;</span>
                <button onClick={() => onShowModal('safety')} className="hover:underline">Safety Tips</button>
            </footer>
            <button 
              onClick={onClearHistory} 
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Clear chat history"
            >
              <ClearIcon />
              Clear
            </button>
        </div>
      </div>
    </aside>
  );
};
