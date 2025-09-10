export type DnsProvider = 'porkbun' | 'namecheap'

export interface DnsInstruction {
  type: 'TXT' | 'CNAME' | 'ALIAS'
  name: string
  value: string
  ttl?: number
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function upsertPorkbunRecord(_domain: string, _instruction: DnsInstruction) {
  if (!process.env.USE_PORKBUN_API || process.env.USE_PORKBUN_API.toLowerCase() !== 'true') {
    return { success: false, message: 'Porkbun API disabled' }
  }
  // TODO: Implement Porkbun API client
  return { success: false, message: 'Not implemented in Phase 3' }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function setNamecheapHosts(_domain: string, _instructions: DnsInstruction[]) {
  if (!process.env.USE_NAMECHEAP_API || process.env.USE_NAMECHEAP_API.toLowerCase() !== 'true') {
    return { success: false, message: 'Namecheap API disabled' }
  }
  // TODO: Implement Namecheap API client
  return { success: false, message: 'Not implemented in Phase 3' }
}

