/** The owner's details printed on invoices and quotes. */
export const PARTY_SELECT = { name: true, email: true, logoUrl: true, bizPhone: true, bizAddress: true, payInfo: true } as const;
export type Party = { name: string | null; email: string; logoUrl?: string | null; bizPhone?: string; bizAddress?: string; payInfo?: string };
export const noParty: Party = { name: null, email: "" };
