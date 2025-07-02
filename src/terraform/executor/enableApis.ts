import path from 'path';

export function shouldEnableApis(moduleName: string): boolean {
  // Skip API enablement for create-vm and create-sql modules
  return !['create-vm', 'create-sql'].includes(moduleName);
} 