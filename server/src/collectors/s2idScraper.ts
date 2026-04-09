import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import config from '../config';
import logger from '../services/logger';
import storage from '../services/storage';
import { DisasterRecord, ScraperOptions, CollectionStatus } from '../types';

// Report configurations with their accordion selectors
// Names must match exactly what's on the S2ID site (case-sensitive)
const REPORT_CONFIGS = {
    'danos-informados': {
        name: 'Relatório Gerencial - Danos informados',
        searchText: 'Danos informados',
        exportButtonText: 'Exportar CSV',
    },
    'reconhecimentos-vigentes': {
        name: 'Relatório Gerencial - Reconhecimentos vigentes',
        searchText: 'Reconhecimentos vigentes',
        exportButtonText: 'Exportar CSV',
    },
    'reconhecimentos-realizados': {
        name: 'Relatório Gerencial - Reconhecimentos realizados',
        searchText: 'Reconhecimentos realizados',
        exportButtonText: 'Exportar CSV',
    },
};

// Generate unique ID for S2ID record
function generateId(municipality: string, uf: string, date: string, type: string): string {
    const base = `s2id-${uf}-${municipality}-${date}-${type}`;
    return Buffer.from(base).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
}

// Parse date from S2ID format
function parseDate(dateStr: string): string {
    if (!dateStr) return '';

    // Try DD/MM/YYYY format
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

// Normalize key for flexible matching (remove accents, lowercase)
function normalizeKey(key: string): string {
    return key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Find value in record using flexible key matching
function getValue(record: Record<string, string>, possibleKeys: string[]): string {
    const recordKeys = Object.keys(record);
    const normalizedMap = recordKeys.reduce((acc, k) => {
        acc[normalizeKey(k)] = k;
        return acc;
    }, {} as Record<string, string>);

    for (const key of possibleKeys) {
        if (record[key] !== undefined) return record[key];
        const norm = normalizeKey(key);
        if (normalizedMap[norm]) return record[normalizedMap[norm]];
    }
    return '';
}

// Extract disaster type from COBRADE (e.g., "14110 - Estiagem")
function extractDisasterType(cobrade: string): string {
    if (!cobrade) return 'Outros';
    const match = cobrade.match(/^\d+\s*-\s*(.+)$/);
    if (match) return match[1].trim();
    const upper = cobrade.toUpperCase();
    if (upper.includes('ESTIAGEM')) return 'Estiagem';
    if (upper.includes('SECA')) return 'Seca';
    if (upper.includes('ENXURRADA')) return 'Enxurrada';
    if (upper.includes('INUNDA')) return 'Inundação';
    if (upper.includes('ALAGAMENTO')) return 'Alagamento';
    if (upper.includes('VENDAVAL') || upper.includes('VENTO')) return 'Vendaval';
    if (upper.includes('GRANIZO')) return 'Granizo';
    if (upper.includes('DESLIZAMENTO')) return 'Deslizamento';
    if (upper.includes('CHUVAS') || upper.includes('TEMPESTADE')) return 'Chuvas Intensas';
    return cobrade;
}

// Transform S2ID CSV record to DisasterRecord
function transformS2IDRecord(raw: Record<string, string>, reportType: string): DisasterRecord | null {
    const uf = getValue(raw, ['UF', 'Estado']);
    const municipality = getValue(raw, ['Município', 'Municipio']);
    const dateStr = getValue(raw, ['Registro', 'Data', 'Data do Desastre', 'Data Decreto']);
    const cobrade = getValue(raw, ['COBRADE', 'Tipologia', 'Tipo de Desastre']);
    const status = getValue(raw, ['Status', 'Situação', 'Situacao']);
    const population = getValue(raw, ['População', 'Populacao']);

    // Skip records with missing key fields
    if (!uf || !municipality || !dateStr) return null;

    const parsedDate = parseDate(dateStr);
    
    // VALIDATION: Prevent future dates
    const today = new Date().toISOString().split('T')[0];
    if (parsedDate > today) {
        logger.warn(`Skipping record with future date: ${parsedDate} (Municipality: ${municipality})`);
        return null;
    }

    const mortos = parseNumber(getValue(raw, ['DH_Mortos', 'Mortos']));
    const feridos = parseNumber(getValue(raw, ['DH_Feridos', 'Feridos']));
    const enfermos = parseNumber(getValue(raw, ['DH_Enfermos', 'Enfermos']));
    const desabrigados = parseNumber(getValue(raw, ['DH_Desabrigados', 'Desabrigados']));
    const desalojados = parseNumber(getValue(raw, ['DH_Desalojados', 'Desalojados']));
    const afetados = parseNumber(getValue(raw, ['DH_Afetados', 'Afetados', 'Total Afetados', 'População Afetada']));
    const totalAffected = mortos + feridos + enfermos + desabrigados + desalojados + afetados;

    return {
        id: generateId(municipality, uf, dateStr, cobrade),
        municipality,
        uf,
        type: extractDisasterType(cobrade),
        date: parsedDate,
        status,
        affected: totalAffected > 0 ? totalAffected : parseNumber(population),
        source: 's2id',
        reportType,
        collectedAt: new Date().toISOString(),
    };
}

// ── Local File Ingestion (Fallback for manual downloads) ──
export async function scanLocalRelatorios(): Promise<number> {
    // Current user path provided: analytics/data/mdr/01_bronze/relatorios/
    const localDir = path.join(__dirname, '..', '..', '..', 'analytics', 'data', 'mdr', '01_bronze', 'relatorios');
    
    if (!fs.existsSync(localDir)) {
        logger.warn(`Local reports directory not found: ${localDir}`);
        return 0;
    }

    logger.info(`Scanning local reports from: ${localDir}`);
    const files = fs.readdirSync(localDir);
    const csvFiles = files.filter(f => f.toLowerCase().endsWith('.csv'));
    
    let totalImported = 0;
    for (const file of csvFiles) {
        try {
            const filePath = path.join(localDir, file);
            const buffer = fs.readFileSync(filePath);
            // Try ISO-8859-1 first (standard S2ID), then fallback to UTF-8
            let content = '';
            try {
                content = new TextDecoder('iso-8859-1').decode(buffer);
            } catch {
                content = fs.readFileSync(filePath, 'utf-8');
            }

            const lines = content.split('\n');
            let headerLineIndex = -1;
            for (let i = 0; i < Math.min(20, lines.length); i++) {
                const line = lines[i].trim();
                // Match standard S2ID header OR line starting with state-initials (AC; AL; etc) if there's no header
                if (line.match(/^UF[;,]/i) || line.match(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)[;,]/i)) {
                    headerLineIndex = i;
                    break;
                }
            }

            if (headerLineIndex === -1) {
                logger.warn(`Could not find header or data start in ${file}. Skipping.`);
                continue;
            }

            // Check if the "header" line is actually a data line (no UF label)
            const firstDataLine = lines[headerLineIndex].trim();
            const hasHeader = firstDataLine.toLowerCase().startsWith('uf');

            let dataContent = '';
            let parseOptions: any = {
                delimiter: ';',
                skip_empty_lines: true,
                relax_column_count: true,
                relax_quotes: true,
            };

            if (hasHeader) {
                dataContent = lines.slice(headerLineIndex).join('\n');
                parseOptions.columns = true;
            } else {
                // Headerless "Relatório Gerencial" format. We assume standard column order:
                // UF; Município; Registro (Date); Processo; COBRADE; Status; População; ...
                dataContent = lines.slice(headerLineIndex).join('\n');
                parseOptions.columns = ['UF', 'Município', 'Registro', 'Processo', 'COBRADE', 'Status', 'População'];
            }

            const records = parse(dataContent, parseOptions) as Record<string, string>[];

            const transformed = records
                .map(r => transformS2IDRecord(r, 'danos-informados'))
                .filter((r): r is DisasterRecord => r !== null);

            if (transformed.length > 0) {
                const count = storage.insertDisasters(transformed);
                totalImported += count;
                logger.info(`Local Import: ${count} records from ${file}`);
            }
        } catch (err) {
            logger.error(`Error importing local file ${file}:`, err);
        }
    }
    return totalImported;
}

// Format date for S2ID input fields (DD/MM/YYYY)
function formatDateForS2ID(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Main scraper class
export class S2IDScraper {
    private browser: Browser | null = null;
    private downloadPath: string;

    constructor() {
        // Use user's Downloads folder since CDP download path doesn't always work
        this.downloadPath = process.env.USERPROFILE
            ? path.join(process.env.USERPROFILE, 'Downloads')
            : config.s2idDataDir;
    }

    async initialize(): Promise<void> {
        logger.info(`Initializing Puppeteer browser...`);
        logger.info(`Download path: ${this.downloadPath}`);

        this.browser = await puppeteer.launch({
            headless: config.puppeteer.headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
            ],
        });

        logger.info('Browser initialized');
    }

    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            logger.info('Browser closed');
        }
    }

    private async setupDownloadBehavior(page: Page): Promise<void> {
        // Ensure download directory exists
        if (!fs.existsSync(this.downloadPath)) {
            fs.mkdirSync(this.downloadPath, { recursive: true });
        }

        // Set download behavior
        const client = await page.createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: this.downloadPath,
        });
    }

    private async waitForDownload(page: Page, timeout: number = 60000): Promise<string | null> {
        logger.info('Waiting for download to complete...');

        // Watch both the download folder and intercept responses
        const startTime = Date.now();
        const existingFiles = new Set(fs.readdirSync(this.downloadPath));

        // Also check for CSV files that might appear with specific names
        const csvPatterns = ['Danos', 'Reconhecimento', 'S2ID', 'relatorio'];

        while (Date.now() - startTime < timeout) {
            try {
                const files = fs.readdirSync(this.downloadPath);

                // Find any file that was modified AFTER we started waiting
                // and matches our criteria (CSV or relevant patterns)
                const latestFiles = files
                    .map(f => {
                        try {
                            return {
                                name: f,
                                path: path.join(this.downloadPath, f),
                                stat: fs.statSync(path.join(this.downloadPath, f))
                            };
                        } catch (e) { return null; }
                    })
                    .filter(f => f !== null)
                    .filter(f => {
                        // Ignore partials
                        if (f.name.endsWith('.crdownload') || f.name.endsWith('.tmp')) return false;

                        // Check modification time (allow 1s buffer)
                        if (f.stat.mtime.getTime() < startTime - 1000) return false;

                        // Check extensions/patterns
                        if (f.name.toLowerCase().endsWith('.csv') || f.name.toLowerCase().endsWith('.xls')) return true;

                        return csvPatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase()));
                    })
                    .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

                if (latestFiles.length > 0) {
                    // Wait a bit more to ensure file is fully written
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const finalPath = latestFiles[0].path;
                    const finalStat = fs.statSync(finalPath);

                    // Double check size is stable? For now assume 2s wait is enough

                    logger.info(`Found downloaded file: ${latestFiles[0].name} (Size: ${finalStat.size})`);
                    return finalPath;
                }
            } catch (e) {
                // Ignore read errors
            }

            await new Promise(resolve => setTimeout(resolve, 1000));

            // Log progress every 10 seconds
            const elapsed = Date.now() - startTime;
            if (elapsed % 10000 < 1000) {
                try {
                    const allFiles = fs.readdirSync(this.downloadPath);
                    const recent = allFiles.slice(0, 5); // Just show top 5 to avoid spam
                    logger.info(`Still waiting for download... (${Math.round(elapsed / 1000)}s). Detected files in dir: ${allFiles.length} (Example: ${recent.join(', ')})`);
                } catch (e) {
                    logger.info(`Still waiting for download... (${Math.round(elapsed / 1000)}s)`);
                }
            }
        }

        return null;
    }

    async scrapeReport(options: ScraperOptions): Promise<DisasterRecord[]> {
        if (!this.browser) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        const reportConfig = REPORT_CONFIGS[options.reportId as keyof typeof REPORT_CONFIGS];
        if (!reportConfig) {
            throw new Error(`Unknown report type: ${options.reportId}`);
        }

        logger.info(`Scraping S2ID report: ${reportConfig.name}`);
        logger.info(`Date range: ${formatDateForS2ID(options.startDate)} - ${formatDateForS2ID(options.endDate)}`);

        const page = await this.browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await this.setupDownloadBehavior(page);

        try {
            // Navigate to reports page
            await page.goto(config.s2id.reportsUrl, {
                waitUntil: 'networkidle2',
                timeout: config.puppeteer.timeout,
            });

            logger.info('Loaded S2ID reports page');

            // Wait for page to fully load - increased timeout
            await page.waitForSelector('h3.ui-accordion-header', { timeout: config.puppeteer.timeout });
            // Extra wait for dynamic content
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Find and click the accordion for this report type
            const accordions = await page.$$('h3');
            let targetAccordion = null;

            for (const accordion of accordions) {
                const text = await accordion.evaluate(el => el.textContent || '');
                // Use searchText for matching, case-insensitive
                if (text.toLowerCase().includes(reportConfig.searchText.toLowerCase())) {
                    targetAccordion = accordion;
                    logger.info(`Found accordion: "${text.trim()}"`);
                    break;
                }
            }

            if (!targetAccordion) {
                throw new Error(`Could not find accordion for report: ${reportConfig.name}`);
            }

            // Click to expand
            await targetAccordion.click();
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for expansion

            logger.info('Expanded report accordion');

            const activePanel = await page.evaluateHandle((el) => el.nextElementSibling, targetAccordion);

            // Fill in date range - find inputs within the expanded accordion content
            // The S2ID form has date inputs that we need to fill
            const dateInputs = await activePanel.$$('input[type="text"]');
            logger.info(`Found ${dateInputs.length} text inputs`);

            if (dateInputs.length >= 2) {
                // Clear and fill start date using evaluate to bypass mask issues
                await page.evaluate((input: any, dateValue: string) => {
                    input.value = dateValue;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                }, dateInputs[0], formatDateForS2ID(options.startDate));

                // Wait a bit
                await new Promise(resolve => setTimeout(resolve, 500));

                // Clear and fill end date
                await page.evaluate((input: any, dateValue: string) => {
                    input.value = dateValue;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                }, dateInputs[1], formatDateForS2ID(options.endDate));

                // Verify values
                const startValue = await page.evaluate((el: any) => el.value, dateInputs[0]);
                const endValue = await page.evaluate((el: any) => el.value, dateInputs[1]);

                logger.info(`Filled date range: ${startValue} - ${endValue}`);

                if (startValue !== formatDateForS2ID(options.startDate) || endValue !== formatDateForS2ID(options.endDate)) {
                    logger.warn(`Date filling mismatch! Expected ${formatDateForS2ID(options.startDate)} - ${formatDateForS2ID(options.endDate)} but got ${startValue} - ${endValue}`);
                    // Fallback to typing if evaluate didn't work (e.g. strict mask)
                    await dateInputs[0].click({ clickCount: 3 });
                    await dateInputs[0].type(formatDateForS2ID(options.startDate));
                    await dateInputs[1].click({ clickCount: 3 });
                    await dateInputs[1].type(formatDateForS2ID(options.endDate));
                }
            }

            // Wait for form to update
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Select "Select All" checkboxes if not checked
            // Find visible checkboxes in the expanded accordion
            const checkboxes = await activePanel.$$('input[type="checkbox"]');
            
            for (const checkbox of checkboxes) {
                try {
                    const id = await checkbox.evaluate((el: any) => el.id || '');
                    const label = await page.evaluate((el: any) => {
                        const parent = el.closest('div, td');
                        return parent ? parent.textContent || '' : '';
                    }, checkbox);

                    // Check for "Selecione todos" or "Todas as tipologias" or "Todos os estados"
                    const shouldCheck = 
                        id.toLowerCase().includes('selecionar_todos') || 
                        label.includes('Todas as tipologias') || 
                        label.includes('Todos os estados') ||
                        label.includes('Selecionar Todos');

                    if (shouldCheck) {
                        const isVisible = await checkbox.evaluate((el: any) => el.offsetParent !== null);
                        if (isVisible) {
                            const isChecked = await checkbox.evaluate((el: any) => el.checked);
                            if (!isChecked) {
                                logger.info(`Checking checkbox: ${label.trim() || id}`);
                                await checkbox.click();
                                await new Promise(resolve => setTimeout(resolve, 3000));
                            }
                        }
                    }
                } catch (err) {
                    logger.warn('Error checking checkbox:', err);
                }
            }

            // Find and click CSV export button
            const buttons = await activePanel.$$('button, a');
            let exportButton = null;

            for (const button of buttons) {
                const text = await button.evaluate((el: any) => el.textContent || '');
                // Check visibility
                const visible = await button.evaluate((el: any) => el.offsetParent !== null);

                if (visible && text.includes('CSV')) {
                    exportButton = button;
                    break;
                }
            }

            if (!exportButton) {
                // Try finding by href or onclick
                exportButton = await activePanel.$('a[href*="csv"], button[onclick*="csv"]');
            }

            if (!exportButton) {
                throw new Error('Could not find CSV export button');
            }

            logger.info('Clicking export CSV button...');

            try {
                // Setup DOM monitoring before click if possible, but for simplicity we just click and check
                await exportButton.click();

                logger.info('Click executed, monitoring DOM for status...');

                // Wait for potential Ajax loading dialog (PrimeFaces)
                // The dialog usually has "Processando" text or an image
                try {
                    // Start monitoring for up to 5 seconds to see if dialog APPEARS
                    await page.waitForFunction(() => {
                        // Check for visible dialogs
                        const dialogs = Array.from(document.querySelectorAll('.ui-dialog'));
                        const visibleDialog = dialogs.find(d => {
                            const style = window.getComputedStyle(d);
                            return style.display !== 'none' && style.visibility !== 'hidden';
                        });
                        return !!visibleDialog;
                    }, { timeout: 5000 });
                    logger.info('Loading dialog detected, waiting for it to disappear...');

                    // Wait for it to disappear (longer timeout as export can take time)
                    await page.waitForFunction(() => {
                        const dialogs = Array.from(document.querySelectorAll('.ui-dialog'));
                        const visibleDialog = dialogs.find(d => {
                            const style = window.getComputedStyle(d);
                            return style.display !== 'none' && style.visibility !== 'hidden';
                        });
                        return !visibleDialog;
                    }, { timeout: config.puppeteer.downloadTimeout });
                    logger.info('Loading dialog disappeared');
                } catch (e) {
                    logger.info('No locking loading dialog detected or it closed too fast (or timed out waiting for it to appear)');
                }

                // Check for error messages (Growl)
                const errorMsg = await page.evaluate(() => {
                    const growl = document.querySelector('.ui-growl-item-container');
                    if (growl && window.getComputedStyle(growl).display !== 'none') {
                        return growl.textContent;
                    }
                    return null;
                });

                if (errorMsg) {
                    logger.warn(`S2ID Error Message detected: ${errorMsg}`);
                    // throw new Error(`S2ID Error: ${errorMsg}`); // Log warn but don't hard fail yet, maybe file still downloads
                }

            } catch (e) {
                logger.warn('Error during DOM monitoring/clicking:', e);
            }

            // Wait for download to complete
            const downloadedFile = await this.waitForDownload(page, config.puppeteer.downloadTimeout);

            if (!downloadedFile) {
                // Debug: Take screenshot on timeout
                await page.screenshot({ path: path.join(config.s2idDataDir, 'download_timeout.png'), fullPage: true });
                throw new Error('Download timeout - no file received');
            }

            logger.info(`Downloaded file: ${downloadedFile}`);

            // Parse the downloaded CSV — S2ID exports in Latin-1 with 4-line metadata header
            const buffer = fs.readFileSync(downloadedFile);
            const decoder = new TextDecoder('iso-8859-1');
            const rawContent = decoder.decode(buffer);

            // Skip metadata lines, find the actual header row or data start
            const lines = rawContent.split('\n');
            let headerLineIndex = -1;
            for (let i = 0; i < Math.min(20, lines.length); i++) {
                const line = lines[i].trim();
                if (line.match(/^UF[;,]/i) || line.match(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)[;,]/i)) {
                    headerLineIndex = i;
                    break;
                }
            }

            if (headerLineIndex === -1) {
                throw new Error(`Could not find CSV header or data start in downloaded file.`);
            }

            const firstDataLine = lines[headerLineIndex].trim();
            const hasHeader = firstDataLine.toLowerCase().startsWith('uf');
            const dataContent = lines.slice(headerLineIndex).join('\n');

            let parseOptions: any = {
                delimiter: ';',
                skip_empty_lines: true,
                relax_column_count: true,
                relaxQuotes: true,
            };

            if (hasHeader) {
                parseOptions.columns = true;
            } else {
                parseOptions.columns = ['UF', 'Município', 'Registro', 'Processo', 'COBRADE', 'Status', 'População'];
            }

            const records = parse(dataContent, parseOptions) as Record<string, string>[];

            logger.info(`Parsed ${records.length} records from CSV (Header detected: ${hasHeader})`);

            // Transform to DisasterRecord format
            const disasters = records
                .map(r => transformS2IDRecord(r, options.reportId))
                .filter((r): r is DisasterRecord => r !== null);

            logger.info(`Transformed ${disasters.length} valid disaster records`);

            return disasters;

        } catch (error) {
            logger.error(`Error scraping ${reportConfig.name}:`, error);
            throw error;
        } finally {
            await page.close();
        }
    }
}

// High-level collection function
export async function collectS2IDData(reportIds?: string[]): Promise<number> {
    const reportsToCollect = reportIds || Object.keys(REPORT_CONFIGS);
    let totalRecords = 0;

    // ── STEP 1: Always run local file scan FIRST (reliable, fast) ──
    logger.info('=== STEP 1: Local CSV file ingestion ===');
    try {
        const localCount = await scanLocalRelatorios();
        totalRecords += localCount;
        if (localCount > 0) {
            logger.info(`Local scan: Imported ${localCount} records from local CSV files`);
        } else {
            logger.info('Local scan: No new records found in local files');
        }
    } catch (localErr) {
        logger.error('Local file scan failed (non-blocking):', localErr);
    }

    // ── STEP 2: Attempt Puppeteer web scraping (supplementary) ──
    logger.info('=== STEP 2: Puppeteer web scraping ===');
    const scraper = new S2IDScraper();

    try {
        await scraper.initialize();

        // Calculate date range: last 90 days to today
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        logger.info(`Date range for collection: ${formatDateForS2ID(startDate)} - ${formatDateForS2ID(endDate)}`);

        for (const reportId of reportsToCollect) {
            const status: CollectionStatus = {
                source: 's2id',
                reportType: reportId,
                lastRun: new Date().toISOString(),
                lastSuccess: null,
                recordCount: 0,
                status: 'running',
            };

            storage.updateCollectionStatus(status);

            try {
                const records = await scraper.scrapeReport({
                    reportId,
                    startDate,
                    endDate,
                });

                const count = storage.insertDisasters(records);
                totalRecords += count;

                status.status = 'success';
                status.lastSuccess = new Date().toISOString();
                status.recordCount = count;
                storage.updateCollectionStatus(status);

                logger.info(`Collected ${count} records for ${reportId}`);

                // Wait between reports to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 5000));

            } catch (error) {
                status.status = 'error';
                status.error = error instanceof Error ? error.message : 'Unknown error';
                storage.updateCollectionStatus(status);
                logger.error(`Failed to collect ${reportId}:`, error);
            }
        }
    } catch (scraperErr) {
        logger.error('Puppeteer scraper initialization failed (local data was still imported):', scraperErr);
    } finally {
        await scraper.close();
    }

    logger.info(`S2ID collection completed: ${totalRecords} total records`);
    return totalRecords;
}

export default {
    S2IDScraper,
    collectS2IDData,
};
