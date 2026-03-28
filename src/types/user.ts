export interface UserResponse {
  id: number;
  email: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface UserSettings {
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  from_name?: string;
  from_email?: string;
  reply_to_email?: string;
  tracking_domain?: string;
  unsubscribe_footer_text?: string;
}
