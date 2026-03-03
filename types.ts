export interface DisasterDecree {
  id: string;
  municipality: string;
  uf: string;
  type: string;
  date: string;
  status: string;
  affected: number;
  severity?: 1 | 2 | 3 | 4 | 5;
  lat?: number;
  lng?: number;
}

export interface FilterState {
  uf: string;
  type: string;
  timeRange: TimeRange;
  severity: number[];
  searchQuery: string;
}

export type TimeRange = '1h' | '3h' | '6h' | '12h' | '24h' | '48h' | '7d' | 'all';

export type DisasterStats = {
  totalDecrees: number;
  totalAffected: number;
  byType: { name: string; value: number }[];
  byState: { name: string; value: number }[];
};

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  snippet: string;
  publishedAt: string;
  sentiment: 'negative' | 'neutral' | 'positive';
  relevanceScore: number;
}

export interface EconomicIndicator {
  id: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'stable';
  timestamp: string;
}

export interface ComexData {
  id: string;
  product: string;
  ncm: string;
  uf: string;
  exportValue: number;
  importValue: number;
  period: string;
  variation: number;
}

export interface ChatMessage {
  id: string;
  user: string;
  text: string;
  timestamp: string;
}