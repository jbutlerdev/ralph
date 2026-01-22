/**
 * Plan Registry
 *
 * Manages a registry of plans from multiple working directories.
 * Allows a single Ralph server to manage plans from different projects.
 *
 * Registry file location: ~/.ralph/registry.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type {
  PlanRegistry,
  RegisteredPlan,
  RegisterPlanOptions,
} from './types/index.js';

/**
 * Default registry location
 */
const REGISTRY_DIR = path.join(os.homedir(), '.ralph');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json');
const REGISTRY_VERSION = 1;

/**
 * Plan Registry class
 */
export class PlanRegistryManager {
  private registryPath: string;
  private registry: PlanRegistry | null = null;

  constructor(registryPath?: string) {
    this.registryPath = registryPath || REGISTRY_FILE;
  }

  /**
   * Initialize the registry file if it doesn't exist
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(REGISTRY_DIR, { recursive: true });

      try {
        await fs.access(this.registryPath);
      } catch {
        // Registry file doesn't exist, create it
        await this.save({
          version: REGISTRY_VERSION,
          plans: {},
        });
      }

      await this.load();
    } catch (error) {
      throw new Error(`Failed to initialize registry: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load the registry from disk
   */
  async load(): Promise<PlanRegistry> {
    try {
      const content = await fs.readFile(this.registryPath, 'utf-8');
      this.registry = JSON.parse(content);

      // Validate registry structure
      if (!this.registry || typeof this.registry !== 'object') {
        throw new Error('Invalid registry format');
      }

      if (this.registry.version !== REGISTRY_VERSION) {
        throw new Error(`Unsupported registry version: ${this.registry.version}`);
      }

      if (!this.registry.plans || typeof this.registry.plans !== 'object') {
        throw new Error('Invalid plans in registry');
      }

      return this.registry;
    } catch (error) {
      throw new Error(`Failed to load registry: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save the registry to disk
   */
  async save(registry?: PlanRegistry): Promise<void> {
    const toSave = registry || this.registry;

    if (!toSave) {
      throw new Error('No registry to save');
    }

    try {
      await fs.mkdir(REGISTRY_DIR, { recursive: true });
      await fs.writeFile(
        this.registryPath,
        JSON.stringify(toSave, null, 2),
        'utf-8'
      );
      this.registry = toSave;
    } catch (error) {
      throw new Error(`Failed to save registry: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Register a plan
   */
  async registerPlan(
    planId: string,
    projectRoot: string,
    planPath: string,
    options?: RegisterPlanOptions
  ): Promise<RegisteredPlan> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      throw new Error('Registry not loaded');
    }

    // Check if plan already exists
    if (this.registry.plans[planId] && !options?.overwrite) {
      throw new Error(`Plan ${planId} is already registered. Use --force to overwrite.`);
    }

    // Resolve absolute paths
    const resolvedProjectRoot = path.resolve(projectRoot);
    const resolvedPlanPath = path.isAbsolute(planPath)
      ? planPath
      : path.resolve(resolvedProjectRoot, planPath);

    // Verify the plan file exists
    try {
      await fs.access(resolvedPlanPath);
    } catch {
      throw new Error(`Plan file not found: ${resolvedPlanPath}`);
    }

    // Create registered plan entry
    const registeredPlan: RegisteredPlan = {
      planId,
      projectRoot: resolvedProjectRoot,
      planPath: resolvedPlanPath,
      registeredAt: this.registry.plans[planId]?.registeredAt || new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      metadata: options?.metadata,
    };

    // Try to read plan metadata
    try {
      const { planFromMarkdown } = await import('./plan-generator.js');
      const planContent = await fs.readFile(resolvedPlanPath, 'utf-8');
      const plan = planFromMarkdown(planContent, resolvedProjectRoot);
      registeredPlan.title = plan.projectName;
      registeredPlan.totalTasks = plan.totalTasks;
    } catch {
      // Plan file exists but couldn't be parsed - that's ok, just skip metadata
    }

    // Save to registry
    this.registry.plans[planId] = registeredPlan;
    await this.save();

    return registeredPlan;
  }

  /**
   * Unregister a plan
   */
  async unregisterPlan(planId: string): Promise<void> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      throw new Error('Registry not loaded');
    }

    if (!this.registry.plans[planId]) {
      throw new Error(`Plan ${planId} is not registered`);
    }

    delete this.registry.plans[planId];
    await this.save();
  }

  /**
   * Get a registered plan by ID
   */
  async getPlan(planId: string): Promise<RegisteredPlan | null> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      return null;
    }

    const plan = this.registry.plans[planId];

    if (plan) {
      // Update last accessed timestamp
      plan.lastAccessed = new Date().toISOString();
      await this.save();
    }

    return plan || null;
  }

  /**
   * List all registered plans
   */
  async listPlans(): Promise<RegisteredPlan[]> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      return [];
    }

    return Object.values(this.registry.plans);
  }

  /**
   * Check if a plan is registered
   */
  async isRegistered(planId: string): Promise<boolean> {
    const plan = await this.getPlan(planId);
    return plan !== null;
  }

  /**
   * Update plan metadata (e.g., after execution to update task counts)
   */
  async updatePlan(
    planId: string,
    updates: Partial<Pick<RegisteredPlan, 'title' | 'totalTasks' | 'metadata'>>
  ): Promise<void> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      throw new Error('Registry not loaded');
    }

    if (!this.registry.plans[planId]) {
      throw new Error(`Plan ${planId} is not registered`);
    }

    const plan = this.registry.plans[planId];

    if (updates.title !== undefined) {
      plan.title = updates.title;
    }

    if (updates.totalTasks !== undefined) {
      plan.totalTasks = updates.totalTasks;
    }

    if (updates.metadata !== undefined) {
      plan.metadata = { ...plan.metadata, ...updates.metadata };
    }

    plan.lastAccessed = new Date().toISOString();
    await this.save();
  }

  /**
   * Get the project root for a plan
   */
  async getProjectRoot(planId: string): Promise<string | null> {
    const plan = await this.getPlan(planId);
    return plan ? plan.projectRoot : null;
  }

  /**
   * Get the plan path for a plan
   */
  async getPlanPath(planId: string): Promise<string | null> {
    const plan = await this.getPlan(planId);
    return plan ? plan.planPath : null;
  }

  /**
   * Resolve a plan ID to its full registry entry
   * Throws if plan is not registered
   */
  async resolvePlan(planId: string): Promise<RegisteredPlan> {
    const plan = await this.getPlan(planId);

    if (!plan) {
      throw new Error(`Plan ${planId} is not registered. Use 'ralph register' to add it.`);
    }

    return plan;
  }

  /**
   * Clear all plans from the registry
   */
  async clear(): Promise<void> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      throw new Error('Registry not loaded');
    }

    this.registry.plans = {};
    await this.save();
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<{
    totalPlans: number;
    totalProjects: number;
    registryPath: string;
  }> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      return {
        totalPlans: 0,
        totalProjects: 0,
        registryPath: this.registryPath,
      };
    }

    const plans = Object.values(this.registry.plans);
    const uniqueProjects = new Set(plans.map((p) => p.projectRoot));

    return {
      totalPlans: plans.length,
      totalProjects: uniqueProjects.size,
      registryPath: this.registryPath,
    };
  }
}

/**
 * Singleton instance for convenience
 */
let defaultRegistry: PlanRegistryManager | null = null;

/**
 * Get the default registry instance
 */
export function getRegistry(): PlanRegistryManager {
  if (!defaultRegistry) {
    defaultRegistry = new PlanRegistryManager();
  }

  return defaultRegistry;
}

/**
 * Initialize the default registry
 */
export async function initRegistry(): Promise<PlanRegistryManager> {
  const registry = getRegistry();
  await registry.init();
  return registry;
}
