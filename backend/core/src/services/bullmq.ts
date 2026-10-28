import { Queue, QueueEvents } from "bullmq";

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};
const QUEUE_NAME = 'analytics-refresh';

export const analyticsQueue = new Queue(QUEUE_NAME, { connection }) as unknown as Queue;

export let analyticsEvents: QueueEvents | undefined;

export function bullMQsetUp() {
    
    analyticsEvents = new QueueEvents(QUEUE_NAME, { connection });
    analyticsEvents.on('failed', ({ jobId, failedReason }) => {
        console.error(`Job ${jobId} failed : ${failedReason}`);
    });
}
