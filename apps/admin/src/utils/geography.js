// ── Countries and States ──
export const COUNTRIES = [
  {
    code: 'BR', label: 'Brasil 🇧🇷',
    states: [
      'Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal',
      'Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul',
      'Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí',
      'Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia',
      'Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins'
    ]
  },
  {
    code: 'AR', label: 'Argentina 🇦🇷',
    states: [
      'Buenos Aires','Catamarca','Chaco','Chubut','Córdoba','Corrientes',
      'Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza',
      'Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis',
      'Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán'
    ]
  },
  {
    code: 'PT', label: 'Portugal 🇵🇹',
    states: [
      'Aveiro','Beja','Braga','Bragança','Castelo Branco','Coimbra','Évora',
      'Faro','Guarda','Leiria','Lisboa','Portalegre','Porto','Santarém',
      'Setúbal','Viana do Castelo','Vila Real','Viseu','Açores','Madeira'
    ]
  },
  {
    code: 'US', label: 'Estados Unidos 🇺🇸',
    states: [
      'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
      'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
      'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
      'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
      'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
      'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
      'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
      'Virginia','Washington','West Virginia','Wisconsin','Wyoming'
    ]
  },
  {
    code: 'OTHER', label: 'Outro país',
    states: []
  }
]

// ── City aliases to correct names (BR) ──
const CITY_ALIASES = {
  'poa': 'Porto Alegre',
  'porto alegre rs': 'Porto Alegre',
  'são leo': 'São Leopoldo',
  'sao leo': 'São Leopoldo',
  'são leopoldo': 'São Leopoldo',
  'bh': 'Belo Horizonte',
  'sampa': 'São Paulo',
  'sp': 'São Paulo',
  'rj': 'Rio de Janeiro',
  'rio': 'Rio de Janeiro',
  'cwb': 'Curitiba',
  'fortaleza ce': 'Fortaleza',
  'ssa': 'Salvador',
  'manaus am': 'Manaus',
  'belém pa': 'Belém',
  'natal rn': 'Natal',
  'maceió al': 'Maceió',
  'joao pessoa': 'João Pessoa',
  'recife pe': 'Recife',
}

export function normalizeCity(city = '') {
  const lower = city.toLowerCase().trim()
  return CITY_ALIASES[lower] || city
}

// ── Fetch cities from IBGE API (Brazil only) ──
export async function fetchCitiesByState(stateCode) {
  // Map state name to UF code
  const UF_MAP = {
    'Acre':'AC','Alagoas':'AL','Amapá':'AP','Amazonas':'AM','Bahia':'BA',
    'Ceará':'CE','Distrito Federal':'DF','Espírito Santo':'ES','Goiás':'GO',
    'Maranhão':'MA','Mato Grosso':'MT','Mato Grosso do Sul':'MS',
    'Minas Gerais':'MG','Pará':'PA','Paraíba':'PB','Paraná':'PR',
    'Pernambuco':'PE','Piauí':'PI','Rio de Janeiro':'RJ',
    'Rio Grande do Norte':'RN','Rio Grande do Sul':'RS','Rondônia':'RO',
    'Roraima':'RR','Santa Catarina':'SC','São Paulo':'SP','Sergipe':'SE',
    'Tocantins':'TO'
  }
  const uf = UF_MAP[stateCode]
  if (!uf) return []
  try {
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
    const data = await res.json()
    return data.map(c => c.nome)
  } catch {
    return []
  }
}
