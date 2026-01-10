/**
 * @ownership
 * @domain Authentication
 * @description Handles user sync between Clerk and database
 * @single-responsibility YES — user/org sync with Clerk
 * @last-reviewed 2026-01-04
 */

import { userRepository, organizationRepository, prisma } from '@zigznote/database';
import { logger } from '../utils/logger';

/**
 * Clerk webhook event types
 */
export type ClerkWebhookEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | OrganizationCreatedEvent
  | OrganizationUpdatedEvent
  | OrganizationDeletedEvent
  | OrganizationMembershipCreatedEvent
  | OrganizationMembershipDeletedEvent;

interface UserCreatedEvent {
  type: 'user.created';
  data: ClerkUserData;
}

interface UserUpdatedEvent {
  type: 'user.updated';
  data: ClerkUserData;
}

interface UserDeletedEvent {
  type: 'user.deleted';
  data: { id: string };
}

interface OrganizationCreatedEvent {
  type: 'organization.created';
  data: ClerkOrgData;
}

interface OrganizationUpdatedEvent {
  type: 'organization.updated';
  data: ClerkOrgData;
}

interface OrganizationDeletedEvent {
  type: 'organization.deleted';
  data: { id: string };
}

interface OrganizationMembershipCreatedEvent {
  type: 'organizationMembership.created';
  data: {
    id: string;
    organization: { id: string; name: string };
    public_user_data: { user_id: string };
    role: string;
  };
}

interface OrganizationMembershipDeletedEvent {
  type: 'organizationMembership.deleted';
  data: {
    id: string;
    organization: { id: string };
    public_user_data: { user_id: string };
  };
}

interface ClerkUserData {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  primary_email_address_id: string | null;
}

interface ClerkOrgData {
  id: string;
  name: string;
  slug: string | null;
}

/**
 * Service for authentication-related operations
 */
export class AuthService {
  /**
   * Syncs a user from a Clerk webhook event
   * @param event - Clerk webhook event
   */
  async syncUserFromWebhook(event: ClerkWebhookEvent): Promise<void> {
    logger.info({ eventType: event.type }, 'Processing Clerk webhook');

    switch (event.type) {
      case 'user.created':
        await this.handleUserCreated(event.data);
        break;

      case 'user.updated':
        await this.handleUserUpdated(event.data);
        break;

      case 'user.deleted':
        await this.handleUserDeleted(event.data.id);
        break;

      case 'organization.created':
        await this.handleOrgCreated(event.data);
        break;

      case 'organization.updated':
        await this.handleOrgUpdated(event.data);
        break;

      case 'organization.deleted':
        await this.handleOrgDeleted(event.data.id);
        break;

      case 'organizationMembership.created':
        await this.handleMembershipCreated(event.data);
        break;

      case 'organizationMembership.deleted':
        await this.handleMembershipDeleted(event.data);
        break;

      default:
        logger.warn({ eventType: (event as { type: string }).type }, 'Unknown webhook event type');
    }
  }

  /**
   * Handles user.created webhook
   */
  private async handleUserCreated(data: ClerkUserData): Promise<void> {
    // Check if user already exists (idempotency)
    const existing = await userRepository.findByClerkId(data.id);
    if (existing) {
      logger.debug({ clerkId: data.id }, 'User already exists, skipping creation');
      return;
    }

    // User needs an org - they will be added via membership webhook
    // For now, just log that we received the event
    logger.info({ clerkId: data.id }, 'Received user.created, waiting for membership');
  }

  /**
   * Handles user.updated webhook
   */
  private async handleUserUpdated(data: ClerkUserData): Promise<void> {
    const user = await userRepository.findByClerkId(data.id);

    if (!user) {
      logger.warn({ clerkId: data.id }, 'User not found for update');
      return;
    }

    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    );

    const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
    await userRepository.update(user.id, {
      email: primaryEmail?.email_address || user.email,
      name: fullName || user.name || undefined,
      avatarUrl: data.image_url || user.avatarUrl || undefined,
    });

    logger.info({ userId: user.id, clerkId: data.id }, 'Updated user from webhook');
  }

  /**
   * Handles user.deleted webhook
   */
  private async handleUserDeleted(clerkId: string): Promise<void> {
    const user = await userRepository.findByClerkId(clerkId);

    if (!user) {
      logger.debug({ clerkId }, 'User not found for deletion');
      return;
    }

    await userRepository.softDelete(user.id);
    logger.info({ userId: user.id, clerkId }, 'Soft deleted user from webhook');
  }

  /**
   * Handles organization.created webhook
   */
  private async handleOrgCreated(data: ClerkOrgData): Promise<void> {
    // Check if org already exists (idempotency)
    const existing = await organizationRepository.findByClerkId(data.id);
    if (existing) {
      logger.debug({ clerkId: data.id }, 'Organization already exists, skipping creation');
      return;
    }

    const org = await organizationRepository.create({
      name: data.name,
      clerkId: data.id,
    });

    logger.info({ orgId: org.id, clerkId: data.id }, 'Created organization from webhook');
  }

  /**
   * Handles organization.updated webhook
   */
  private async handleOrgUpdated(data: ClerkOrgData): Promise<void> {
    const org = await organizationRepository.findByClerkId(data.id);

    if (!org) {
      logger.warn({ clerkId: data.id }, 'Organization not found for update');
      return;
    }

    await organizationRepository.update(org.id, {
      name: data.name,
    });

    logger.info({ orgId: org.id, clerkId: data.id }, 'Updated organization from webhook');
  }

  /**
   * Handles organization.deleted webhook
   */
  private async handleOrgDeleted(clerkId: string): Promise<void> {
    const org = await organizationRepository.findByClerkId(clerkId);

    if (!org) {
      logger.debug({ clerkId }, 'Organization not found for deletion');
      return;
    }

    await organizationRepository.softDelete(org.id);
    logger.info({ orgId: org.id, clerkId }, 'Soft deleted organization from webhook');
  }

  /**
   * Handles organizationMembership.created webhook
   * Creates org if needed and updates user org membership if user exists
   * Note: User creation from membership webhooks is no longer supported (Clerk integration removed)
   */
  private async handleMembershipCreated(
    data: OrganizationMembershipCreatedEvent['data']
  ): Promise<void> {
    const clerkUserId = data.public_user_data.user_id;
    const clerkOrgId = data.organization.id;

    // Check if user and org already exist
    const existingUser = await userRepository.findByClerkId(clerkUserId);
    const existingOrg = await organizationRepository.findByClerkId(clerkOrgId);

    if (existingUser && existingOrg) {
      // Both exist - might need to update org membership
      if (existingUser.organizationId !== existingOrg.id) {
        await userRepository.update(existingUser.id, {
          organizationId: existingOrg.id,
          role: data.role === 'admin' ? 'admin' : 'member',
        });
        logger.info({ userId: existingUser.id, orgId: existingOrg.id }, 'Updated user organization');
      }
      return;
    }

    // Create org if it doesn't exist
    let org = existingOrg;
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: data.organization.name,
          clerkId: clerkOrgId,
          plan: 'free',
        },
      });
      logger.info({ orgId: org.id, clerkOrgId }, 'Created organization from membership webhook');
    }

    // If user exists (in a different org), update their org
    if (existingUser) {
      await userRepository.update(existingUser.id, {
        organizationId: org.id,
        role: data.role === 'admin' ? 'admin' : 'member',
      });
      logger.info({ userId: existingUser.id, orgId: org.id }, 'Updated user organization');
      return;
    }

    // User doesn't exist - cannot create without email data
    // User should be created via user.created webhook or direct registration
    logger.warn(
      { clerkUserId, clerkOrgId },
      'Cannot create user from membership webhook - user does not exist. User should be created via user.created webhook first.'
    );
  }

  /**
   * Handles organizationMembership.deleted webhook
   */
  private async handleMembershipDeleted(
    data: OrganizationMembershipDeletedEvent['data']
  ): Promise<void> {
    const clerkUserId = data.public_user_data.user_id;

    const user = await userRepository.findByClerkId(clerkUserId);
    if (!user) {
      logger.debug({ clerkUserId }, 'User not found for membership deletion');
      return;
    }

    // Soft delete user when removed from org
    await userRepository.softDelete(user.id);
    logger.info({ userId: user.id, clerkUserId }, 'Soft deleted user from membership deletion');
  }
}

// Export singleton instance
export const authService = new AuthService();
