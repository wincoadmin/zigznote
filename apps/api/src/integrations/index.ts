/**
 * Integrations Module
 * Export all integration components
 */

// Base classes and types
export * from './base/types';
export { BaseIntegration } from './base/BaseIntegration';
export { OAuthIntegration } from './base/OAuthIntegration';

// Slack Integration
export { SlackIntegration, slackRoutes } from './slack';

// HubSpot Integration
export { HubSpotIntegration, hubspotRoutes } from './hubspot';

// Zoom Integration
export { ZoomIntegration, zoomRoutes } from './zoom';

// Microsoft Teams/365 Integration
export { MicrosoftIntegration, microsoftRoutes } from './microsoft';

// Salesforce Integration
export { SalesforceIntegration, salesforceRoutes } from './salesforce';

// Webhooks
export {
  WebhookService,
  WebhookDispatcher,
  webhookRoutes,
  WEBHOOK_EVENTS,
  MAX_RETRY_ATTEMPTS,
} from './webhooks';
export type { WebhookEvent, WebhookConfig, WebhookDelivery, WebhookJobData } from './webhooks';
