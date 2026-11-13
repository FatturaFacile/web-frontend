export interface SystemBackup {
  id: string;
  filename: string;
  file_size_bytes: number | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface RestoreBackupResult {
  success: boolean;
  message: string;
}
