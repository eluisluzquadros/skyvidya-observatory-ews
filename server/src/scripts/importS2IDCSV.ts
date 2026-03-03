/**
 * Script para importar CSV baixado manualmente do S2ID
 * 
 * Uso: npm run import:s2id <caminho-do-csv> [tipo-relatorio]
 * 
 * Exemplo:
 *   npm run import:s2id "C:\Users\seu_user\Downloads\Danos_Informados.csv" danos-informados
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import logger from '../services/logger';
import storage from '../services/storage';
import { DisasterRecord } from '../types';

// Report type to source mapping
const REPORT_TYPES: Record<string, string> = {
    'danos': 'danos-informados',
    'danos-informados': 'danos-informados',
    'vigentes': 'reconhecimentos-vigentes',
    'reconhecimentos-vigentes': 'reconhecimentos-vigentes',
    'realizados': 'reconhecimentos-realizados',
    'reconhecimentos-realizados': 'reconhecimentos-realizados',
};

// Generate unique ID
function generateId(municipality: string, uf: string, date: string, cobrade: string): string {
    const base = `s2id-${uf}-${municipality}-${date}-${cobrade}`;
    return Buffer.from(base).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
}

// Parse date from S2ID format (DD/MM/YYYY)
function parseDate(dateStr: string): string {
    if (!dateStr) return '';
    const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
        return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }
    return dateStr;
}

// Parse number with Brazilian formatting
function parseNumber(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/\./g, '').replace(',', '.').trim();
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
}

// Extract disaster type from COBRADE (e.g., "14110 - Estiagem")
function extractDisasterType(cobrade: string): string {
    if (!cobrade) return 'Outros';

    // Try to extract type after the code and dash
    const match = cobrade.match(/^\d+\s*-\s*(.+)$/);
    if (match) {
        return match[1].trim();
    }

    // Check for common patterns
    const cobradeUpper = cobrade.toUpperCase();
    if (cobradeUpper.includes('ESTIAGEM')) return 'Estiagem';
    if (cobradeUpper.includes('SECA')) return 'Seca';
    if (cobradeUpper.includes('ENXURRADA')) return 'Enxurrada';
    if (cobradeUpper.includes('INUNDA')) return 'Inundação';
    if (cobradeUpper.includes('ALAGAMENTO')) return 'Alagamento';
    if (cobradeUpper.includes('VENDAVAL') || cobradeUpper.includes('VENTO')) return 'Vendaval';
    if (cobradeUpper.includes('GRANIZO')) return 'Granizo';
    if (cobradeUpper.includes('DESLIZAMENTO')) return 'Deslizamento';
    if (cobradeUpper.includes('CHUVAS')) return 'Chuvas Intensas';
    if (cobradeUpper.includes('TEMPESTADE')) return 'Chuvas Intensas';

    return cobrade;
}

// Helper to normalize text for key matching (remove accents, lowercase)
function normalizeKey(key: string): string {
    return key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Find value in record using flexible key matching
function getValue(record: Record<string, string>, possibleKeys: string[]): string {
    const recordKeys = Object.keys(record);
    const normalizedKeys = recordKeys.reduce((acc, k) => {
        acc[normalizeKey(k)] = k;
        return acc;
    }, {} as Record<string, string>);

    for (const key of possibleKeys) {
        // Try exact match
        if (record[key] !== undefined) return record[key];

        // Try normalized match
        const norm = normalizeKey(key);
        if (normalizedKeys[norm]) {
            return record[normalizedKeys[norm]];
        }
    }
    return '';
}

// Transform S2ID CSV record to DisasterRecord
// S2ID columns: UF;Município;Registro;Protocolo;COBRADE;Status;População;DH_Mortos;DH_Feridos;...
function transformRecord(raw: Record<string, string>, reportType: string): DisasterRecord | null {
    // Get values using flexible matching
    const uf = getValue(raw, ['UF', 'Estado']);
    const municipality = getValue(raw, ['Município', 'Municipio']);
    const dateStr = getValue(raw, ['Registro', 'Data', 'Data do Desastre']);
    const cobrade = getValue(raw, ['COBRADE', 'Tipologia', 'Tipo de Desastre']);
    const status = getValue(raw, ['Status', 'Situação']);
    const population = getValue(raw, ['População', 'Populacao']);

    // Get affected numbers
    const mortos = parseNumber(getValue(raw, ['DH_Mortos', 'Mortos']));
    const feridos = parseNumber(getValue(raw, ['DH_Feridos', 'Feridos']));
    const enfermos = parseNumber(getValue(raw, ['DH_Enfermos', 'Enfermos']));
    const desabrigados = parseNumber(getValue(raw, ['DH_Desabrigados', 'Desabrigados']));
    const desalojados = parseNumber(getValue(raw, ['DH_Desalojados', 'Desalojados']));
    const afetados = parseNumber(getValue(raw, ['DH_Afetados', 'Afetados', 'Total Afetados']));

    // Total affected
    const totalAffected = mortos + feridos + enfermos + desabrigados + desalojados + afetados;

    // Skip invalid records
    if (!uf || !municipality) {
        // Only log if it looks like a data row (has some content)
        if (Object.values(raw).some(v => v.length > 0)) {
            // console.log('Skipping invalid record:', JSON.stringify(raw));
        }
        return null;
    }

    return {
        id: generateId(municipality, uf, dateStr, cobrade),
        municipality,
        uf,
        type: extractDisasterType(cobrade),
        date: parseDate(dateStr),
        status,
        affected: totalAffected > 0 ? totalAffected : parseNumber(population),
        source: 's2id',
        reportType,
        collectedAt: new Date().toISOString(),
    };
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log(`
Uso: npm run import:s2id <caminho-do-csv> [tipo-relatorio]

Tipos de relatório disponíveis:
  - danos-informados (padrão)
  - reconhecimentos-vigentes
  - reconhecimentos-realizados

Exemplo:
  npm run import:s2id "C:\\Users\\seu_user\\Downloads\\Danos_Informados.csv"
  npm run import:s2id "C:\\Users\\seu_user\\Downloads\\Reconhecimentos_Vigentes.csv" vigentes
`);
        process.exit(1);
    }

    const csvPath = args[0];
    const reportTypeArg = args[1] || 'danos-informados';
    const reportType = REPORT_TYPES[reportTypeArg.toLowerCase()] || reportTypeArg;

    logger.info('='.repeat(60));
    logger.info('S2ID CSV IMPORT');
    logger.info('='.repeat(60));
    logger.info(`CSV File: ${csvPath}`);
    logger.info(`Report Type: ${reportType}`);

    // Verify file exists
    if (!fs.existsSync(csvPath)) {
        logger.error(`File not found: ${csvPath}`);
        process.exit(1);
    }

    try {
        const startTime = Date.now();

        // Read CSV file - S2ID exports in Latin-1/ISO-8859-1 encoding
        const buffer = fs.readFileSync(csvPath);

        // Try to detect encoding
        // S2ID uses Latin-1, but manual files might be UTF-8.
        let content: string;

        // Try UTF-8 first as it's stricter
        try {
            const utf8Content = buffer.toString('utf-8');
            // heuristic: if it contains 'Município' or 'População' correctly, it's likely UTF-8
            // or if it doesn't have replacement characters for common things
            if (utf8Content.includes('Município') || utf8Content.includes('População') || utf8Content.includes('Municipio')) {
                content = utf8Content;
                logger.info('Detected UTF-8 encoding');
            } else {
                throw new Error('Not UTF-8 likely');
            }
        } catch {
            const decoder = new TextDecoder('iso-8859-1');
            content = decoder.decode(buffer);
            logger.info('Detected Latin-1 encoding');
        }

        // Fallback: if UTF-8 check failed (threw or didn't contain keywords), we used Latin-1. 
        // Force Latin-1 if we are not sure? 
        // Actually, let's keep it simple: 
        // If the file was saved by a user, it's likely UTF-8. If downloaded from S2ID, Latin-1.
        // We will stick to the normalized key matching to solve most issues.

        if (!content) {
            const decoder = new TextDecoder('iso-8859-1');
            content = decoder.decode(buffer);
        }

        logger.info(`Read ${buffer.length} bytes from file`);

        // S2ID CSVs have 4 header lines before the actual data:
        // Line 1: Ministério...
        // Line 2: Secretaria...
        // Line 3: Relatório...
        // Line 4: Data Inicial...
        // Line 5: Column headers (UF;Município;...)
        // Line 6+: Data

        const lines = content.split('\n');

        // Find the header line (starts with "UF;")
        let headerLineIndex = 0;
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            if (lines[i].startsWith('UF;') || lines[i].startsWith('UF,')) {
                headerLineIndex = i;
                break;
            }
        }

        logger.info(`Found header at line ${headerLineIndex + 1}`);

        // Skip the metadata lines
        const dataContent = lines.slice(headerLineIndex).join('\n');

        // Parse CSV
        let records: Record<string, string>[];
        try {
            records = parse(dataContent, {
                columns: true,
                delimiter: ';',
                skip_empty_lines: true,
                relax_column_count: true,
                relaxQuotes: true,
            });
        } catch {
            // Try comma delimiter
            records = parse(dataContent, {
                columns: true,
                delimiter: ',',
                skip_empty_lines: true,
                relax_column_count: true,
                relaxQuotes: true,
            });
        }

        logger.info(`Parsed ${records.length} raw records`);

        // Show sample of columns found
        if (records.length > 0) {
            const cols = Object.keys(records[0]);
            logger.info(`Columns found (${cols.length}): ${cols.slice(0, 10).join(', ')}...`);

            // Show first record sample
            const sample = records[0];
            logger.info(`Sample - UF: "${sample['UF']}", Município: "${sample['Município']}", COBRADE: "${sample['COBRADE']}"`);
        }

        // Transform records
        const disasters: DisasterRecord[] = [];
        let skipped = 0;

        for (const raw of records) {
            const transformed = transformRecord(raw, reportType);
            if (transformed) {
                disasters.push(transformed);
            } else {
                skipped++;
            }
        }

        logger.info(`Transformed ${disasters.length} valid disaster records (skipped: ${skipped})`);

        if (disasters.length === 0) {
            logger.warn('No valid records found! Check if the CSV format is correct.');
            logger.warn('Expected columns: UF, Município, Registro, COBRADE, Status, DH_*');
            process.exit(1);
        }

        // Show sample of transformed data
        if (disasters.length > 0) {
            const sample = disasters[0];
            logger.info(`Sample transformed: ${sample.uf} - ${sample.municipality} - ${sample.type} (${sample.date})`);
        }

        // Store in database
        const count = storage.insertDisasters(disasters);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        logger.info('='.repeat(60));
        logger.info(`✅ Import completed successfully!`);
        logger.info(`   Records imported: ${count}`);
        logger.info(`   Duration: ${duration}s`);
        logger.info('='.repeat(60));

    } catch (error) {
        logger.error('❌ Import failed:', error);
        process.exit(1);
    } finally {
        storage.close();
    }
}

main();
