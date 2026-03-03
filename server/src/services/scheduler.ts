import cron from 'node-cron';
import config from '../config';
import logger from './logger';
import { collectAtlasData } from '../collectors/atlasDigital';
import { collectS2IDData } from '../collectors/s2idScraper';

export interface SchedulerStatus {
    atlasWeekly: {
        schedule: string;
        nextRun: string | null;
        enabled: boolean;
    };
    s2idDaily: {
        schedule: string;
        nextRun: string | null;
        enabled: boolean;
    };
}

class SchedulerService {
    private atlasJob: cron.ScheduledTask | null = null;
    private s2idJob: cron.ScheduledTask | null = null;
    private isRunning = false;

    // Start all scheduled jobs
    start(): void {
        if (this.isRunning) {
            logger.warn('Scheduler already running');
            return;
        }

        logger.info('Starting scheduler service...');

        // Weekly Atlas collection (Sunday 3 AM)
        this.atlasJob = cron.schedule(config.schedule.atlasWeekly, async () => {
            logger.info('Running scheduled Atlas collection...');
            try {
                await collectAtlasData();
            } catch (error) {
                logger.error('Scheduled Atlas collection failed:', error);
            }
        }, {
            timezone: 'America/Sao_Paulo',
        });

        // Daily S2ID collection (6 AM)
        this.s2idJob = cron.schedule(config.schedule.s2idDaily, async () => {
            logger.info('Running scheduled S2ID collection...');
            try {
                await collectS2IDData();
            } catch (error) {
                logger.error('Scheduled S2ID collection failed:', error);
            }
        }, {
            timezone: 'America/Sao_Paulo',
        });

        this.isRunning = true;
        logger.info('Scheduler service started');
        logger.info(`Atlas collection: ${config.schedule.atlasWeekly} (America/Sao_Paulo)`);
        logger.info(`S2ID collection: ${config.schedule.s2idDaily} (America/Sao_Paulo)`);
    }

    // Stop all scheduled jobs
    stop(): void {
        if (this.atlasJob) {
            this.atlasJob.stop();
            this.atlasJob = null;
        }

        if (this.s2idJob) {
            this.s2idJob.stop();
            this.s2idJob = null;
        }

        this.isRunning = false;
        logger.info('Scheduler service stopped');
    }

    // Get scheduler status
    getStatus(): SchedulerStatus {
        return {
            atlasWeekly: {
                schedule: config.schedule.atlasWeekly,
                nextRun: this.getNextRunTime(config.schedule.atlasWeekly),
                enabled: this.atlasJob !== null,
            },
            s2idDaily: {
                schedule: config.schedule.s2idDaily,
                nextRun: this.getNextRunTime(config.schedule.s2idDaily),
                enabled: this.s2idJob !== null,
            },
        };
    }

    // Calculate next run time for a cron expression
    private getNextRunTime(cronExpression: string): string | null {
        try {
            // Parse cron expression to get next occurrence
            const parts = cronExpression.split(' ');
            if (parts.length < 5) return null;

            const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

            const now = new Date();
            const next = new Date();

            // Set time
            next.setHours(parseInt(hour, 10) || 0);
            next.setMinutes(parseInt(minute, 10) || 0);
            next.setSeconds(0);
            next.setMilliseconds(0);

            // If we're past that time today, move to next occurrence
            if (next <= now) {
                if (dayOfWeek !== '*') {
                    // Weekly job - add days until correct day
                    const targetDay = parseInt(dayOfWeek, 10);
                    const currentDay = next.getDay();
                    const daysToAdd = (targetDay - currentDay + 7) % 7 || 7;
                    next.setDate(next.getDate() + daysToAdd);
                } else {
                    // Daily job - move to tomorrow
                    next.setDate(next.getDate() + 1);
                }
            }

            return next.toISOString();
        } catch {
            return null;
        }
    }

    // Manually trigger collections
    async triggerAtlasCollection(): Promise<number> {
        logger.info('Manually triggered Atlas collection');
        return collectAtlasData();
    }

    async triggerS2IDCollection(reportIds?: string[]): Promise<number> {
        logger.info('Manually triggered S2ID collection');
        return collectS2IDData(reportIds);
    }

    async triggerAllCollections(): Promise<{ atlas: number; s2id: number }> {
        logger.info('Manually triggered all collections');

        const atlas = await this.triggerAtlasCollection();
        const s2id = await this.triggerS2IDCollection();

        return { atlas, s2id };
    }
}

export const scheduler = new SchedulerService();
export default scheduler;
