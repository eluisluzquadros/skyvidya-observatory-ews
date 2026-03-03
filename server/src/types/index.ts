// Disaster record structure matching frontend types
export interface DisasterRecord {
    id: string;
    municipality: string;
    uf: string;
    type: string;
    date: string;
    status: string;
    affected: number;
    source: 'atlas' | 's2id';
    reportType?: string;
    collectedAt: string;
}

// Collection status
export interface CollectionStatus {
    source: 'atlas' | 's2id';
    reportType?: string;
    lastRun: string | null;
    lastSuccess: string | null;
    recordCount: number;
    status: 'idle' | 'running' | 'success' | 'error';
    error?: string;
}

// API filter options
export interface FilterOptions {
    uf?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    source?: 'atlas' | 's2id' | 'all';
    limit?: number;
    offset?: number;
}

// S2ID Scraper options
export interface ScraperOptions {
    reportId: string;
    startDate: Date;
    endDate: Date;
    states?: string[];
    disasterTypes?: string[];
}

// Atlas Digital raw record (from CSV)
export interface AtlasRawRecord {
    UF: string;
    MUNICIPIO: string;
    COBRADE: string;
    GRUPO_DESASTRE: string;
    SUBGRUPO_DESASTRE: string;
    TIPO_DESASTRE: string;
    SUBTIPO_DESASTRE: string;
    DATA_DESASTRE: string;
    MORTOS: string;
    FERIDOS: string;
    ENFERMOS: string;
    DESABRIGADOS: string;
    DESALOJADOS: string;
    DESAPARECIDOS: string;
    AFETADOS: string;
    [key: string]: string;
}

// S2ID export record structure
export interface S2IDExportRecord {
    'UF'?: string;
    'Município'?: string;
    'Tipo de Desastre'?: string;
    'Data'?: string;
    'Status'?: string;
    'População Afetada'?: string;
    [key: string]: string | undefined;
}
