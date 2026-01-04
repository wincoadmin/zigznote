/**
 * @ownership
 * @domain Authentication
 * @description Handles user sync between Clerk and database
 * @single-responsibility YES — user/org sync with Clerk
 * @last-reviewed 2026-01-04
 */

import { clerkClient } from '@clerk/express';
import { userRepository, organizationRepository } from '@zigznote/database';
import type { User } from '@zigznote/database';
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
   * Gets or creates a user from their Clerk ID
   * @param clerkId - Clerk user ID
   */
  async getUserFromClerk(clerkId: string): Promise<User | null> {
    // First try to find in our database
    let user = await userRepository.findByClerkId(clerkId);

    if (user) {
      return user;
    }

    // If not found, fetch from Clerk and create
    try {
      const clerkUser = await clerkClient.users.getUser(clerkId);

      if (!clerkUser) {
        return null;
      }

      // Get org memberships
      const orgMemberships = await clerkClient.users.getOrganizationMembershipList({
        userId: clerkId,
      });

      if (orgMemberships.data.length === 0) {
        logger.warn({ clerkId }, 'User has no organization memberships');
        return null;
      }

      // Use first org
      const firstMembership = orgMemberships.data[0];
      const clerkOrgId = firstMembership?.organization?.id;
      const clerkOrgName = firstMembership?.organization?.name || 'Unnamed Organization';

      if (!clerkOrgId) {
        logger.warn({ clerkId }, 'Invalid organization membership');
        return null;
      }

      // Find or create org
      let org = await organizationRepository.findByClerkId(clerkOrgId);
      if (!org) {
        org = await organizationRepository.create({
          name: clerkOrgName,
          clerkId: clerkOrgId,
        });
        logger.info({ orgId: org.id, clerkOrgId }, 'Created organization from Clerk');
      }

      // Create user
      const primaryEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      );

      const fullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
      user = await userRepository.create({
        organizationId: org.id,
        email: primaryEmail?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || '',
        name: fullName || undefined,
        clerkId: clerkId,
        avatarUrl: clerkUser.imageUrl || undefined,
        role: 'member',
      });

      logger.info({ userId: user.id, clerkId }, 'Created user from Clerk');
      return user;
    } catch (error) {
      logger.error({ error, clerkId }, 'Failed to fetch user from Clerk');
      return null;
    }
  }

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
   */
  private async handleMembershipCreated(
    data: OrganizationMembershipCreatedEvent['data']
  ): Promise<void> {
    const clerkUserId = data.public_user_data.user_id;
    const clerkOrgId = data.organization.id;

    // Find or create org
    let org = await organizationRepository.findByClerkId(clerkOrgId);
    if (!org) {
      org = await organizationRepository.create({
        name: data.organization.name,
        clerkId: clerkOrgId,
      });
      logger.info({ orgId: org.id, clerkOrgId }, 'Created organization from membership webhook');
    }

    // Check if user exists
    let user = await userRepository.findByClerkId(clerkUserId);
    if (user) {
      // User already exists - might need to update org
      if (user.organizationId !== org.id) {
        // User changed orgs - update
        await userRepository.update(user.id, {
          organizationId: org.id,
          role: data.role === 'admin' ? 'admin' : 'member',
        });
        logger.info({ userId: user.id, orgId: org.id }, 'Updated user organization');
      }
      return;
    }

    // Create user - fetch from Clerk for email/name
    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);

      const primaryEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      );

      const memberFullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
      user = await userRepository.create({
        organizationId: org.id,
        email: primaryEmail?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || '',
        name: memberFullName || undefined,
        clerkId: clerkUserId,
        avatarUrl: clerkUser.imageUrl || undefined,
        role: data.role === 'admin' ? 'admin' : 'member',
      });

      logger.info({ userId: user.id, orgId: org.id, clerkUserId }, 'Created user from membership webhook');
    } catch (error) {
      logger.error({ error, clerkUserId }, 'Failed to create user from membership webhook');
    }
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
