
import { S2IDScraper } from '../collectors/s2idScraper';
import logger from '../services/logger';
import config from '../config';

async function testScraper() {
    const scraper = new S2IDScraper();
    try {
        await scraper.initialize();

        // Test with a short range (last 2 days) to be quick
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 2);

        // Increase timeout for test
        // @ts-ignore
        if (config.puppeteer) config.puppeteer.downloadTimeout = 180000;

        logger.info(`Testing S2ID scraper for 'danos-informados' from ${startDate.toISOString()} to ${endDate.toISOString()}`);

        const records = await scraper.scrapeReport({
            reportId: 'danos-informados',
            startDate,
            endDate
        });

        logger.info(`Successfully scraped ${records.length} records`);

        if (records.length > 0) {
            logger.info('Sample record:', records[0]);
        }

    } catch (error) {
        logger.error('Scraper test failed:', error);
    } finally {
        await scraper.close();
    }
}

testScraper();
