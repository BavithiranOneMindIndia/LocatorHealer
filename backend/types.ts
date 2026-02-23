export type AuthMode = 'auth' | 'non-auth';
export type RunMode = 'dev' | 'ci';

export interface ProjectConfig {
  baseUrl: string;
  authMode: AuthMode;
  credentials?: {
    username: string;
    password: string;
  };
  storageStatePath: string;
  mode: RunMode;
}

export interface LocatorMetadata {
  tag?: string;
  text?: string;
  role?: string;
  label?: string;
  attrs?: Record<string, string>;
}

export interface LocatorEntry {
  primary: string;
  metadata: LocatorMetadata;
  history: string[];
}

export type LocatorRegistry = Record<string, LocatorEntry>;

export interface HealProposal {
  elementKey: string;
  oldLocator: string;
  proposedLocator: string;
  similarity: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  validated: boolean;
  approved: boolean;
  reason?: string;
}
