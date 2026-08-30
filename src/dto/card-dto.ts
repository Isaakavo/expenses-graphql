export type CardDTO = {
  id: string;
  bank: string;
  userId: string;
  alias: string;
  isDebit: boolean;
  isDigital: boolean;
  provider?: string | null;
  providerAccountId?: string | null;
  providerConnectionId?: string | null;
  providerStatus?: string | null;
  providerLinkedAt?: Date | null;
  providerLastSyncedAt?: Date | null;
}
