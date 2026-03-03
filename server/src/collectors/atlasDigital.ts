import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import config from '../config';
import logger from '../services/logger';
import storage from '../services/storage';
import { DisasterRecord, CollectionStatus } from '../types';

// Atlas CSV column names (actual headers from the file)
interface AtlasCsvRecord {
    Protocolo_S2iD?: string;
    Nome_Municipio?: string;
    Sigla_UF?: string;
    regiao?: string;
    Data_Registro?: string;
    Data_Evento?: string;
    Cod_Cobrade?: string;
    tipologia?: string;
    descricao_tipologia?: string;
    grupo_de_desastre?: string;
    Status?: string;
    DH_MORTOS?: string;
    DH_FERIDOS?: string;
    DH_ENFERMOS?: string;
    DH_DESABRIGADOS?: string;
    DH_DESALOJADOS?: string;
    DH_DESAPARECIDOS?: string;
    'DH_AFETADOS_SECA_ESTIAGEM'?: string;
    DH_total_danos_humanos_diretos?: string;
    [key: string]: string | undefined;
}

// Generate unique ID for a record
function generateId(record: AtlasCsvRecord): string {
    const base = `${record.Sigla_UF}-${record.Nome_Municipio}-${record.Data_Evento}-${record.Cod_Cobrade || record.Protocolo_S2iD}`;
    return Buffer.from(base).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
}

// Parse date from Atlas format (DD/MM/YYYY or YYYY-MM-DD)
function parseDate(dateStr: string | undefined): string {
    if (!dateStr) return '';

    // Try DD/MM/YYYY format
    const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
        return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }

    // Already in ISO format
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
    }

    return dateStr;
}

// Map Atlas disaster type to simplified category
function mapDisasterType(record: AtlasCsvRecord): string {
    const descricao = (record.descricao_tipologia || '').toLowerCase();
    const tipologia = (record.tipologia || '').toLowerCase();
    const grupo = (record.grupo_de_desastre || '').toLowerCase();

    // Check descricao_tipologia first (more specific)
    if (descricao.includes('estiagem')) return 'Estiagem';
    if (descricao.includes('seca')) return 'Seca';
    if (descricao.includes('enxurrada')) return 'Enxurrada';
    if (descricao.includes('inundaç') || descricao.includes('inundac')) return 'Inundação';
    if (descricao.includes('alagamento')) return 'Alagamento';
    if (descricao.includes('vendaval') || descricao.includes('vento')) return 'Vendaval';
    if (descricao.includes('granizo')) return 'Granizo';
    if (descricao.includes('deslizamento') || descricao.includes('movimento de massa')) return 'Deslizamento';
    if (descricao.includes('incêndio') || descricao.includes('incendio') || descricao.includes('queimada')) return 'Incêndio Florestal';
    if (descricao.includes('tornado') || descricao.includes('ciclone')) return 'Ciclone/Tornado';
    if (descricao.includes('geada') || descricao.includes('frio')) return 'Geada';
    if (descricao.includes('onda de calor')) return 'Onda de Calor';

    // Try tipologia
    if (tipologia.includes('estiagem')) return 'Estiagem';
    if (tipologia.includes('seca')) return 'Seca';
    if (tipologia.includes('enxurrada')) return 'Enxurrada';
    if (tipologia.includes('inundaç') || tipologia.includes('inundac')) return 'Inundação';
    if (tipologia.includes('alagamento')) return 'Alagamento';
    if (tipologia.includes('vendaval')) return 'Vendaval';
    if (tipologia.includes('granizo')) return 'Granizo';
    if (tipologia.includes('deslizamento')) return 'Deslizamento';
    if (tipologia.includes('chuvas') || tipologia.includes('precipitaç')) return 'Chuvas Intensas';

    // Check grupo_de_desastre
    if (grupo.includes('climatológico') || grupo.includes('climatologico')) return 'Evento Climatológico';
    if (grupo.includes('hidrológico') || grupo.includes('hidrologico')) return 'Evento Hidrológico';
    if (grupo.includes('geológico') || grupo.includes('geologico')) return 'Evento Geológico';
    if (grupo.includes('meteorológico') || grupo.includes('meteorologico')) return 'Evento Meteorológico';

    // Return the original if we couldn't map
    return record.descricao_tipologia || record.tipologia || record.grupo_de_desastre || 'Outros';
}

// Parse number, handling Brazilian format with comma and dots
function parseNumber(value: string | undefined): number {
    if (!value) return 0;
    // Remove thousand separators (.) and convert decimal comma to dot
    const cleaned = value.replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num);
}

// Calculate total affected from all columns
function calculateAffected(record: AtlasCsvRecord): number {
    // Use DH_ prefixed columns from the actual CSV
    const fields = [
        'DH_MORTOS',
        'DH_FERIDOS',
        'DH_ENFERMOS',
        'DH_DESABRIGADOS',
        'DH_DESALOJADOS',
        'DH_DESAPARECIDOS',
        'DH_AFETADOS_SECA_ESTIAGEM',
        'DH_total_danos_humanos_diretos'
    ];

    let total = 0;
    for (const field of fields) {
        const value = parseNumber(record[field]);
        // Use the total if available, otherwise sum individual
        if (field === 'DH_total_danos_humanos_diretos' && value > 0) {
            return value; // Return total directly if available
        }
        if (field !== 'DH_total_danos_humanos_diretos') {
            total += value;
        }
    }

    return total;
}

// Transform Atlas raw record to DisasterRecord
function transformRecord(raw: AtlasCsvRecord): DisasterRecord | null {
    const municipality = raw.Nome_Municipio?.trim() || '';
    const uf = raw.Sigla_UF?.trim() || '';

    if (!municipality || !uf) {
        return null;
    }

    const date = parseDate(raw.Data_Evento);

    // Skip records without a date
    if (!date) {
        return null;
    }

    return {
        id: generateId(raw),
        municipality,
        uf,
        type: mapDisasterType(raw),
        date,
        status: raw.Status || 'Histórico (Atlas)',
        affected: calculateAffected(raw),
        source: 'atlas',
        reportType: 'base-completa',
        collectedAt: new Date().toISOString(),
    };
}

export async function downloadAtlasCSV(): Promise<string> {
    logger.info('Starting Atlas Digital CSV download...');

    const csvPath = path.join(config.atlasDataDir, 'atlas_data.csv');

    // Check if file already exists and is recent (less than 1 day old)
    if (fs.existsSync(csvPath)) {
        const stats = fs.statSync(csvPath);
        const ageMs = Date.now() - stats.mtime.getTime();
        const oneDay = 24 * 60 * 60 * 1000;

        if (ageMs < oneDay && stats.size > 1000000) {
            logger.info(`Using cached Atlas CSV (${(stats.size / 1024 / 1024).toFixed(1)}MB, age: ${Math.round(ageMs / 3600000)}h)`);
            return csvPath;
        }
    }

    try {
        const response = await axios({
            method: 'get',
            url: config.atlas.csvUrl,
            responseType: 'stream',
            timeout: 300000, // 5 minutes timeout for large file
        });

        const writer = fs.createWriteStream(csvPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                logger.info(`Atlas CSV downloaded to ${csvPath}`);
                resolve(csvPath);
            });
            writer.on('error', reject);
        });
    } catch (error) {
        logger.error('Failed to download Atlas CSV:', error);
        throw error;
    }
}

export async function parseAtlasCSV(filePath: string): Promise<DisasterRecord[]> {
    logger.info('Parsing Atlas CSV...');

    const content = fs.readFileSync(filePath, 'utf-8');

    // Parse CSV with semicolon delimiter (common in Brazilian CSVs)
    let records: AtlasCsvRecord[];
    try {
        records = parse(content, {
            columns: true,
            delimiter: ';',
            skip_empty_lines: true,
            relax_column_count: true,
            relaxQuotes: true,
        }) as AtlasCsvRecord[];
    } catch (parseError) {
        logger.error('CSV parse error:', parseError);
        throw parseError;
    }

    logger.info(`Parsed ${records.length} raw records from Atlas CSV`);

    // Log first record to debug column names
    if (records.length > 0) {
        const sample = records[0];
        logger.info(`Sample columns: ${Object.keys(sample).slice(0, 15).join(', ')}...`);
        logger.info(`Sample tipologia: "${sample.tipologia}", descricao: "${sample.descricao_tipologia}"`);
        logger.info(`Sample Data_Evento: "${sample.Data_Evento}"`);
    }

    // Transform to DisasterRecord format
    const disasters: DisasterRecord[] = [];
    let skipped = 0;

    for (const raw of records) {
        const transformed = transformRecord(raw);
        if (transformed) {
            disasters.push(transformed);
        } else {
            skipped++;
        }
    }

    logger.info(`Transformed ${disasters.length} valid disaster records (skipped ${skipped} without date/location)`);
    return disasters;
}

export async function collectAtlasData(): Promise<number> {
    const status: CollectionStatus = {
        source: 'atlas',
        reportType: 'base-completa',
        lastRun: new Date().toISOString(),
        lastSuccess: null,
        recordCount: 0,
        status: 'running',
    };

    storage.updateCollectionStatus(status);

    try {
        // Download CSV
        const csvPath = await downloadAtlasCSV();

        // Parse and transform
        const records = await parseAtlasCSV(csvPath);

        // Store in database
        const count = storage.insertDisasters(records);

        status.status = 'success';
        status.lastSuccess = new Date().toISOString();
        status.recordCount = count;
        storage.updateCollectionStatus(status);

        logger.info(`Atlas collection completed: ${count} records`);
        return count;
    } catch (error) {
        status.status = 'error';
        status.error = error instanceof Error ? error.message : 'Unknown error';
        storage.updateCollectionStatus(status);

        logger.error('Atlas collection failed:', error);
        throw error;
    }
}

export default {
    downloadAtlasCSV,
    parseAtlasCSV,
    collectAtlasData,
};
