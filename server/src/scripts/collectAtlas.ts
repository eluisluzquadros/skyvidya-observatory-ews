/**
 * Script para coletar dados do Atlas Digital manualmente
 * Execute: npm run collect:atlas
 */

import { collectAtlasData } from '../collectors/atlasDigital';
import logger from '../services/logger';
import storage from '../services/storage';

async function main() {
    logger.info('='.repeat(60));
    logger.info('ATLAS DIGITAL DATA COLLECTION');
    logger.info('='.repeat(60));

    try {
        const startTime = Date.now();

        logger.info('Starting Atlas Digital data collection...');
        const count = await collectAtlasData();

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

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
