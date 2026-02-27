const cron = require('node-cron');
const { sequelize } = require('../models');
const { performDailyReconciliation } = require('./reconciliation');
const { cleanupOldAuditLogs } = require('./auditCleanup');
const { checkLowBalance } = require('./balanceMonitor');
const { detectUnusualAccess } = require('./securityMonitor');
const { retryFailedWebhooks } = require('./webhookRetry');
const { performAMLRescreen } = require('./amlRescreen');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting scheduler service...');
    this.isRunning = true;

    // Daily reconciliation at 02:00 UK time
    this.scheduleJob(
      'daily-reconciliation',
      '0 2 * * *', // At 02:00 every day
      async () => {
        logger.info('Starting daily reconciliation job...');
        try {
          await performDailyReconciliation();
          logger.info('Daily reconciliation completed successfully');
        } catch (error) {
          logger.error('Daily reconciliation failed:', error);
        }
      }
    );

    // Audit log cleanup (monthly - 1st of each month at 03:00 UK)
    this.scheduleJob(
      'audit-cleanup',
      '0 3 1 * *', // At 03:00 on 1st of every month
      async () => {
        logger.info('Starting audit log cleanup job...');
        try {
          await cleanupOldAuditLogs();
          logger.info('Audit log cleanup completed successfully');
        } catch (error) {
          logger.error('Audit log cleanup failed:', error);
        }
      }
    );

    // Low balance check (every hour)
    this.scheduleJob(
      'balance-check',
      '0 * * * *', // At minute 0 of every hour
      async () => {
        logger.info('Starting balance check job...');
        try {
          await checkLowBalance();
          logger.info('Balance check completed successfully');
        } catch (error) {
          logger.error('Balance check failed:', error);
        }
      }
    );

    // Unusual access detection (every 30 minutes)
    this.scheduleJob(
      'security-monitor',
      '*/30 * * * *', // Every 30 minutes
      async () => {
        logger.info('Starting security monitoring job...');
        try {
          await detectUnusualAccess();
          logger.info('Security monitoring completed successfully');
        } catch (error) {
          logger.error('Security monitoring failed:', error);
        }
      }
    );

    // Webhook retry (every 15 minutes)
    this.scheduleJob(
      'webhook-retry',
      '*/15 * * * *', // Every 15 minutes
      async () => {
        logger.info('Starting webhook retry job...');
        try {
          await retryFailedWebhooks();
          logger.info('Webhook retry completed successfully');
        } catch (error) {
          logger.error('Webhook retry failed:', error);
        }
      }
    );

    // AML rescreen for high-risk customers (weekly - Sunday at 04:00 UK)
    this.scheduleJob(
      'aml-rescreen',
      '0 4 * * 0', // At 04:00 on Sunday
      async () => {
        logger.info('Starting AML rescreen job...');
        try {
          await performAMLRescreen();
          logger.info('AML rescreen completed successfully');
        } catch (error) {
          logger.error('AML rescreen failed:', error);
        }
      }
    );

    logger.info(`Scheduler started with ${this.jobs.size} jobs`);
  }

  scheduleJob(name, cronExpression, task) {
    if (this.jobs.has(name)) {
      logger.warn(`Job ${name} already exists, skipping...`);
      return;
    }

    const job = cron.schedule(cronExpression, task, {
      scheduled: false,
      timezone: "Europe/London"
    });

    this.jobs.set(name, job);
    job.start();
    logger.info(`Scheduled job: ${name} with cron: ${cronExpression}`);
  }

  stopJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      logger.info(`Stopped job: ${name}`);
      return true;
    }
    return false;
  }

  startJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.start();
      logger.info(`Started job: ${name}`);
      return true;
    }
    return false;
  }

  stop() {
    if (!this.isRunning) {
      logger.warn('Scheduler is not running');
      return;
    }

    logger.info('Stopping scheduler service...');
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    });
    this.jobs.clear();
    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  getJobStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running || false,
        scheduled: job.scheduled || false,
        nextDate: job.nextDate()?.toISOString() || null,
        lastDate: job.lastDate()?.toISOString() || null
      };
    });
    return status;
  }

  // Manual job execution for testing
  async executeJob(name) {
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`Job ${name} not found`);
    }

    logger.info(`Manually executing job: ${name}`);
    try {
      await job.task();
      logger.info(`Manual execution of job ${name} completed successfully`);
    } catch (error) {
      logger.error(`Manual execution of job ${name} failed:`, error);
      throw error;
    }
  }
}

module.exports = new SchedulerService();
