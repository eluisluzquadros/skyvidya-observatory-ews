/**
 * Script para coletar dados de todas as fontes
 * Execute: npm run collect:all
 */

import { collectAtlasData } from '../collectors/atlasDigital';
import { collectS2IDData } from '../collectors/s2idScraper';
import logger from '../services/logger';
import storage from '../services/storage';

async function main() {
    logger.info('='.repeat(60));
    logger.info('FULL DATA COLLECTION (ATLAS + S2ID)');
    logger.info('='.repeat(60));

    const results = {
        atlas: 0,
        s2id: 0,
        errors: [] as string[],
    };

    const startTime = Date.now();

    // Collect Atlas Digital data
    logger.info('');
    logger.info('📦 Step 1/2: Collecting Atlas Digital data...');
    try {
        results.atlas = await collectAtlasData();
        logger.info(`   ✅ Atlas: ${results.atlas} records`);
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Atlas: ${msg}`);
        logger.error(`   ❌ Atlas failed: ${msg}`);
    }

    // Collect S2ID data
    logger.info('');
    logger.info('🌐 Step 2/2: Collecting S2ID data (scraping)...');
    logger.info('   This may take several minutes...');
    try {
        results.s2id = await collectS2IDData();
        logger.info(`   ✅ S2ID: ${results.s2id} records`);
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`S2ID: ${msg}`);
        logger.error(`   ❌ S2ID failed: ${msg}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Summary
    logger.info('');
    logger.info('='.repeat(60));
    logger.info('COLLECTION SUMMARY');
    logger.info('='.repeat(60));
    logger.info(`  Atlas Digital:  ${results.atlas} records`);
    logger.info(`  S2ID Scraping:  ${results.s2id} records`);
    logger.info(`  Total:          ${results.atlas + results.s2id} records`);
    logger.info(`  Duration:       ${duration}s`);

    if (results.errors.length > 0) {
        logger.info('');
        logger.warn('Errors encountered:');
        results.errors.forEach(e => logger.warn(`  - ${e}`));
    }

    logger.info('='.repeat(60));

    storage.close();

    if (results.errors.length > 0) {
        process.exit(1);
    }
}

main();
