import { Request, Response, NextFunction } from 'express';
import {
  IResourceAuthorizationProvider,
  ResourceType,
  OperationScope,
  AllRole
} from '@ipr/shared';
import { AppError } from './error-handler.middleware.js';

export interface ResourceAuthorizationMiddlewareOptions {
  readonly resourceType: ResourceType;
  readonly getResourceId: (req: Request) => string;
  readonly provider?: IResourceAuthorizationProvider;
}

export function createResourceAuthorizationMiddleware(options: ResourceAuthorizationMiddlewareOptions) {
  const { resourceType, getResourceId, provider } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError({
          statusCode: 401,
          code: 'UNAUTHENTICATED_RESOURCE_ACCESS',
          title: 'Unauthenticated Request',
          detail: 'Cannot authorize resource access without a verified BFF actor context.'
        });
      }

      // Fail-closed guarantee: If no provider is configured, protected operations fail closed
      if (!provider) {
        throw new AppError({
          statusCode: 503,
          code: 'RESOURCE_AUTH_PROVIDER_MISSING',
          title: 'Authorization Provider Missing',
          detail: 'Protected resource operation failed closed: No resource authorization provider is configured.'
        });
      }

      const resourceId = getResourceId(req);
      if (!resourceId || resourceId.trim() === '') {
        throw new AppError({
          statusCode: 400,
          code: 'RESOURCE_ID_MISSING',
          title: 'Missing Resource Identifier',
          detail: 'Resource authorization requires a non-empty resource identifier.'
        });
      }

      const outcome = await provider.authorizeResourceAccess({
        actorId: req.actor.actorId,
        roles: req.actor.roles as readonly AllRole[],
        operationScope: req.actor.operationScope as OperationScope,
        resourceType,
        resourceId,
        metadata: (req as Request & { resourceMetadata?: Record<string, unknown> }).resourceMetadata
      });

      if (outcome.status === 'PROVIDER_UNAVAILABLE') {
        throw new AppError({
          statusCode: 503,
          code: 'RESOURCE_AUTH_PROVIDER_UNAVAILABLE',
          title: 'Authorization Service Unavailable',
          detail: outcome.error
        });
      }

      if (outcome.status === 'UNAUTHORIZED') {
        throw new AppError({
          statusCode: 403,
          code: outcome.code || 'RESOURCE_ACCESS_DENIED',
          title: 'Forbidden Resource Access',
          detail: outcome.reason
        });
      }

      // Access granted
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
