import { InstancesClient } from '@google-cloud/compute';
import { PubSub } from '@google-cloud/pubsub';

export const pubsubClient = new PubSub();
export const computeInstancesClient = new InstancesClient();
