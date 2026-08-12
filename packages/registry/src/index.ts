import { integrationManifestSchema, type IntegrationManifest } from '@boolink-dev/core';
import * as z from 'zod/v4';

import catalogDocument from './catalog.json' with { type: 'json' };

export const registryDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.iso.datetime({ offset: true }),
    integrations: z.array(integrationManifestSchema),
  })
  .strict()
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    const packages = new Set<string>();

    for (const [index, integration] of registry.integrations.entries()) {
      if (ids.has(integration.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Integration IDs must be unique.',
          path: ['integrations', index, 'id'],
        });
      }
      if (packages.has(integration.packageName)) {
        context.addIssue({
          code: 'custom',
          message: 'Integration package names must be unique.',
          path: ['integrations', index, 'packageName'],
        });
      }
      ids.add(integration.id);
      packages.add(integration.packageName);
    }

    const sortedIds = [...ids].sort((left, right) => left.localeCompare(right));
    const actualIds = registry.integrations.map((integration) => integration.id);
    if (JSON.stringify(actualIds) !== JSON.stringify(sortedIds)) {
      context.addIssue({
        code: 'custom',
        message: 'Registry integrations must be sorted by ID.',
        path: ['integrations'],
      });
    }
  });

export type RegistryDocument = z.infer<typeof registryDocumentSchema>;

export function createRegistry(
  integrations: readonly IntegrationManifest[],
  generatedAt = new Date(),
): RegistryDocument {
  return registryDocumentSchema.parse({
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    integrations: [...integrations].sort((left, right) => left.id.localeCompare(right.id)),
  });
}

export function parseRegistry(input: unknown): RegistryDocument {
  return registryDocumentSchema.parse(input);
}

export function searchRegistry(
  registry: RegistryDocument,
  query: string,
): readonly IntegrationManifest[] {
  const terms = query.trim().toLocaleLowerCase('en-US').split(/\s+/u).filter(Boolean);

  if (terms.length === 0) {
    return registry.integrations;
  }

  return registry.integrations.filter((integration) => {
    const searchable = [
      integration.id,
      integration.name,
      integration.description,
      integration.provider,
      integration.category,
    ]
      .join(' ')
      .toLocaleLowerCase('en-US');

    return terms.every((term) => searchable.includes(term));
  });
}

export const bundledRegistry = parseRegistry(catalogDocument);
