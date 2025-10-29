// Type definitions for better code clarity
export interface UserProcessingResult {
  sentEmail: boolean;
  motivation: { success?: boolean; failure?: boolean; error?: string } | null;
  suspension: { success?: boolean; failure?: boolean; error?: string } | null;
}