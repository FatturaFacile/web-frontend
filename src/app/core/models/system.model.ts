export interface SystemBackup {
  id: string;
  filename: string;
  size_bytes: number;
  status: 'completed' | 'in_progress' | 'failed';
  created_at: string;
}

export interface RestoreBackupResult {
  success: boolean;
  message: string;
}
