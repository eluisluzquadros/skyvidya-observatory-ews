import { S2IDScraper } from './src/collectors/s2idScraper';
import logger from './src/services/logger';

async function runTest() {
    logger.info('--- RUNNING S2ID SCRAPER TEST ---');
    const scraper = new S2IDScraper();
    
    try {
        await scraper.initialize();
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 3); // last 3 days for a quick test
        
        logger.info(`Requested period: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        
        const records = await scraper.scrapeReport({
            reportId: 'danos-informados',
            startDate,
            endDate,
        });

        logger.info(`SUCCESS: Scraped ${records.length} records!`);
        if (records.length > 0) {
            logger.info(`Example record: ${JSON.stringify(records[0], null, 2)}`);
        }
        
    } catch (err) {
        logger.error('TEST FAILED:', err);
    } finally {
        await scraper.close();
        process.exit(0);
    }
}

runTest();
