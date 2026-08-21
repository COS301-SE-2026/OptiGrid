import { Queue, QueueEvents } from "bullmq";
import { broadcastEvent } from "./websocket";

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};
const QUEUE_NAME = 'analytics-refresh';

export const analyticsQueue = (process.env.NODE_ENV === "test" ? { add: async () => {}, getJob: async () => null }
    : new Queue(QUEUE_NAME, { connection })) as unknown as Queue;

export function bullMQsetUp() {
    if (process.env.NODE_ENV === 'test') return;
    
    const events = new QueueEvents(QUEUE_NAME, { connection });
    events.on('completed', ({ jobId, returnvalue }) => {
        analyticsQueue.getJob(jobId).then(job => {
            if (job && job.data && job.data.building_id) {
                broadcastEvent("FORECAST_READY", { 
                    building_id: job.data.building_id 
                });
            } else {
                broadcastEvent("FORECAST_READY", { 
                    jobId 
                });
            }
        }).catch(err => console.error("Error fetching job data:", err));
    });
    
    events.on('failed', ({ jobId, failedReason }) => {
        console.error(`Job ${jobId} failed : ${failedReason}`);
    });
}
