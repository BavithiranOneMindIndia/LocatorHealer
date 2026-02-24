export type AuthMode = 'auth' | 'non-auth';
export type RunMode = 'dev' | 'ci';

export interface AuthConfig {
  username?: string;
  password?: string;
  otp?: string;
  qrEnabled?: boolean;
  loginUrl?: string;
  successUrlIncludes?: string;
  successSelector?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  otpSelector?: string;
  submitSelector?: string;
}

export interface ProjectConfig {
  baseUrl: string;
  authMode: AuthMode;
  mode: RunMode;
  auth?: AuthConfig;
  storageStatePath: string;
}

export interface HealProposal {
  elementKey: string;
  oldLocator: string;
  proposedLocator: string;
  similarity: number;
  risk: string;
  validated: boolean;
  approved: boolean;
}
