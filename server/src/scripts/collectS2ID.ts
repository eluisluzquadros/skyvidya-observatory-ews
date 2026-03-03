/**
 * Script para coletar dados do S2ID manualmente via scraping
 * Execute: npm run collect:s2id
 */

import { collectS2IDData } from '../collectors/s2idScraper';
import logger from '../services/logger';
import storage from '../services/storage';

async function main() {
    logger.info('='.repeat(60));
    logger.info('S2ID DATA COLLECTION (SCRAPING)');
    logger.info('='.repeat(60));

    // Get report IDs from command line args, or collect all
    const args = process.argv.slice(2);
    const reportIds = args.length > 0 ? args : undefined;

    if (reportIds) {
        logger.info(`Collecting specific reports: ${reportIds.join(', ')}`);
    } else {
        logger.info('Collecting all reports: danos-informados, reconhecimentos-vigentes, reconhecimentos-realizados');
    }

    try {
        const startTime = Date.now();

        logger.info('Starting S2ID scraping...');
        logger.info('This may take a few minutes as it navigates the web interface.');
        logger.info('');

        const count = await collectS2IDData(reportIds);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        logger.info('');
        logger.info('='.repeat(60));
        logger.info(`✅ Collection completed successfully!`);
        logger.info(`   Records collected: ${count}`);
        logger.info(`   Duration: ${duration}s`);
        logger.info('='.repeat(60));

    } catch (error) {
        logger.error('❌ Collection failed:', error);
        process.exit(1);
    } finally {
        storage.close();
    }
}

main();
