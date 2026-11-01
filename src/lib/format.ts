export function apenasDigitos(v: string) {
  return v.replace(/\D/g, '')
}

export function formatarCnpj(v: string) {
  const d = apenasDigitos(v).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function validarCnpj(v: string) {
  const c = apenasDigitos(v)
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const dv = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((a, d, i) => a + Number(d) * pesos[i], 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const p2 = [6, ...p1]
  return dv(c.slice(0, 12), p1) === Number(c[12]) && dv(c.slice(0, 13), p2) === Number(c[13])
}

export function formatarData(d?: string | null) {
  if (!d) return '—'
  return new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR')
}

export function formatarDataHora(d: string) {
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
