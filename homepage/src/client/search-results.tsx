import React from 'react';
import type { SearchResult } from './search.js';

export function SearchResults({ results, selectedIndex, onSelect }: { results: SearchResult[]; selectedIndex: number; onSelect: (result: SearchResult) => void }) {
  if (results.length === 0) return null;
  return <div className="search-results" role="listbox" aria-label="Dashboard search results">{results.map((result, index) => <button type="button" role="option" aria-selected={selectedIndex === index} className={selectedIndex === index ? 'selected' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(result)} key={result.id}><span><strong>{result.label}</strong><small>{result.description}</small></span><kbd>{index < 8 ? index + 1 : '↵'}</kbd></button>)}</div>;
}
