'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, User, MapPin, Loader2, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface Publisher {
  id: string;
  nome: string;
  congregacao?: string;
  circuito?: string;
  cidade?: string;
}

interface PublisherSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (publisher: Publisher) => void;
  placeholder?: string;
  className?: string;
}

export default function PublisherSearch({ 
  value, 
  onChange, 
  onSelect, 
  placeholder = "Buscar publicador...",
  className = ""
}: PublisherSearchProps) {
  const [suggestions, setSuggestions] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchPublishers = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      // Search in personal_data collection
      // Note: We search by prefix if possible, or just fetch and filter
      const q = query(
        collection(db, 'personal_data'),
        where('nome', '>=', searchTerm),
        where('nome', '<=', searchTerm + '\uf8ff'),
        limit(5)
      );

      const snapshot = await getDocs(q);
      const results: Publisher[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        results.push({
          id: doc.id,
          nome: data.nome,
          congregacao: data.congregacao,
          circuito: data.circuito,
          cidade: data.cidade
        });
      });

      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Error searching publishers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    searchPublishers(val);
  };

  const handleSelect = (pub: Publisher) => {
    onChange(pub.nome);
    setShowSuggestions(false);
    if (onSelect) {
      onSelect(pub);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative group">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => value.length >= 2 && setShowSuggestions(suggestions.length > 0)}
          placeholder={placeholder}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#37616b] outline-none transition-all pr-10"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading ? (
            <Loader2 size={16} className="animate-spin text-gray-400" />
          ) : (
            <Search size={16} className="text-gray-400" />
          )}
          {value && (
            <button 
              type="button"
              onClick={() => { onChange(''); setSuggestions([]); setShowSuggestions(false); }}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
          >
            {suggestions.map((pub) => (
              <button
                key={pub.id}
                type="button"
                onClick={() => handleSelect(pub)}
                className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center gap-3 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                  <User size={16} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{pub.nome}</p>
                  {(pub.congregacao || pub.circuito) && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium truncate">
                      <MapPin size={10} />
                      {pub.congregacao && <span>{pub.congregacao}</span>}
                      {pub.congregacao && pub.circuito && <span>•</span>}
                      {pub.circuito && <span>{pub.circuito}</span>}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
