import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import PageHeader from '../../components/ui/PageHeader'
import { usePlatformSettings, PLATFORM_SETTINGS_QUERY_KEY } from '../../hooks/usePlatformSettings'
import { FIELD_POLICY_OPTIONS } from '../../utils/fieldPolicies'
import { updatePlatformSettings } from '../../services/platformSettings.service'

const CLIENT_FIELDS = [
  ['whatsapp', 'WhatsApp'],
  ['segment', 'Segmento'],
  ['deadline_days', 'Prazo de aceite'],
  ['document', 'CPF/CNPJ'],
]

const POST_FIELDS = [
  ['description', 'Legenda / texto'],
  ['scheduled_date', 'Data prevista'],
]

const APPROVAL_MODES = [
  {
    value: 'content',
    label: 'Aprovar o conteúdo inteiro',
    description: 'O cliente navega livremente pelos arquivos e toma uma única decisão para o conteúdo completo.',
  },
  {
    value: 'item',
    label: 'Aprovar item por item',
    description: 'Cada arquivo recebe uma escolha editável e o resultado só é oficial após Concluir análise.',
  },
]

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <span>
        <span className="block text-sm font-bold">{label}</span>
        <span className="mt-1 block text-xs text-neutral-500">{description}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-1 h-5 w-5 accent-mag-600" />
    </label>
  )
}

function PolicyRow({ label, value, onChange }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border border-neutral-200 p-3 sm:flex-row sm:items-center dark:border-neutral-800">
      <span className="text-sm font-bold">{label}</span>
      <div className="inline-flex rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
        {FIELD_POLICY_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-bold ${value === option.value ? 'bg-mag-600 text-white' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SettingsSection({ title, description, children }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </Card>
  )
}

export default function PlatformSettingsPage() {
  const { settings, isLoading, isError } = usePlatformSettings()
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => setForm(settings), [settings])

  const setSection = (section, key, value) => setForm(current => ({
    ...current,
    [section]: { ...current[section], [key]: value },
  }))

  async function save() {
    setSaving(true)
    try {
      const saved = await updatePlatformSettings({
        retention: form.retention,
        features: form.features,
        client_fields: form.client_fields,
        post_fields: form.post_fields,
        portal: form.portal,
      })
      queryClient.setQueryData(PLATFORM_SETTINGS_QUERY_KEY, saved)
      toast.success('Configurações da plataforma salvas.')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível salvar as configurações.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div className="p-8 text-sm text-neutral-500">Carregando configurações...</div>
  if (isError) return <div role="alert" className="p-8 text-sm font-semibold text-red-600">Não foi possível carregar as configurações da plataforma.</div>

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-16">
      <PageHeader icon={Settings2} title="Configurações da plataforma" subtitle="Defina preferências operacionais globais desta instalação." />

      <SettingsSection title="Operação e retenção" description="O prazo começa somente quando a postagem é marcada como executada.">
        <Input
          label="Retenção de arquivos após execução (horas)"
          type="number"
          min="1"
          max="8760"
          value={form.retention.executed_attachment_hours}
          onChange={event => setSection('retention', 'executed_attachment_hours', Number(event.target.value))}
        />
      </SettingsSection>

      <SettingsSection title="Recursos" description="Recursos desativados deixam de aparecer e de bloquear os fluxos.">
        <Toggle checked={form.features.soundtrack} onChange={value => setSection('features', 'soundtrack', value)} label="Habilitar fundo sonoro" description="Exibe a configuração e a aprovação de fundo sonoro em novas operações." />
      </SettingsSection>

      <SettingsSection title="Cadastro de clientes" description="Nome, e-mail e senha permanecem obrigatórios para o funcionamento do sistema.">
        {CLIENT_FIELDS.map(([key, label]) => <PolicyRow key={key} label={label} value={form.client_fields[key]} onChange={value => setSection('client_fields', key, value)} />)}
      </SettingsSection>

      <SettingsSection title="Criação de postagens" description="Cliente, título e canais permanecem obrigatórios; anexos e preview seguem as regras de canal.">
        {POST_FIELDS.map(([key, label]) => <PolicyRow key={key} label={label} value={form.post_fields[key]} onChange={value => setSection('post_fields', key, value)} />)}
      </SettingsSection>

      <SettingsSection title="Portal do cliente" description="Clientes sem override explícito usam estes valores imediatamente.">
        <Toggle checked={form.portal.show_post_list} onChange={value => setSection('portal', 'show_post_list', value)} label="Mostrar lista de postagens" description="Permite visualizar o seletor de conteúdos no portal." />
        <Toggle checked={form.portal.show_supplementary_info} onChange={value => setSection('portal', 'show_supplementary_info', value)} label="Mostrar informações complementares" description="Exibe acompanhamento, histórico e demais painéis de apoio." />
        <Toggle checked={form.portal.sequential_approval} onChange={value => setSection('portal', 'sequential_approval', value)} label="Usar fluxo sequencial de aprovação" description="Mantém o primeiro conteúdo pendente como próxima decisão." />
      </SettingsSection>

      <SettingsSection title="Forma de aprovação do cliente" description="Defina como o cliente deverá analisar e aprovar conteúdos que possuem mais de um arquivo.">
        <div className="grid gap-3 sm:grid-cols-2">
          {APPROVAL_MODES.map(option => {
            const selected = form.portal.approval_mode === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setSection('portal', 'approval_mode', option.value)}
                className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mag-500 ${selected ? 'border-mag-500 bg-mag-50 ring-1 ring-mag-500 dark:bg-mag-950/30' : 'border-neutral-200 hover:border-mag-300 dark:border-neutral-800'}`}
              >
                <span className="block text-sm font-extrabold">{option.label}</span>
                <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-300">{option.description}</span>
              </button>
            )
          })}
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="button" onClick={save} loading={saving} disabled={saving}>Salvar configurações</Button>
      </div>
    </div>
  )
}
