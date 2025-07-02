export interface TerraformConfig {
  terraformDir: string;
  tfVars: Record<string, any>;
  enableApis?: boolean;
  retryPolicy?: {
    maxAttempts: number;
    waitSeconds: number;
  };
}

export interface TerraformOutput {
  project_id: string;
  region?: string;
  zone?: string;
  vpc_name?: string;
  subnet_name?: string;
  vm_subnet_name?: string;
  psc_subnet_name?: string;
  instance_name?: string;
  port?: number;
  instance_group_name?: string;
  backend_service_name?: string;
  health_check_name?: string;
  forwarding_rule_name?: string;
  service_attachment_name?: string;
  service_attachment_uri?: string;
  allowed_consumer_project_ids?: string[];
  instance_connection_name?: string;
  private_ip_address?: string;
  database_name?: string;
  user_name?: string;
  vm_instance_name?: string;
  vm_internal_ip?: string;
  psc_ip_range?: string;
  psc_ip_range_name?: string;
  vpc_self_link?: string;
  subnet_self_link?: string;
  vm_subnet_self_link?: string;
  psc_subnet_self_link?: string;
}

export interface TerraformVariables {
  [key: string]: string | number | boolean | string[];
} 