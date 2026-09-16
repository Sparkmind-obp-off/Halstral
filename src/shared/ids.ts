export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`
export const now = () => new Date().toISOString()
