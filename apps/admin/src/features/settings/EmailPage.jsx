import { useState, useEffect } from 'react'
import { Mail } from 'lucide-react'
import { supabase } from '../../services/supabase'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input, { Textarea, Select } from '../../components/ui/Input'
import { fetchClients } from '../../services/clients.service'
import toast from 'react-hot-toast'

export default function EmailPage() {
  const [cfg, setCfg] = useState({ sender_name:'20cinco comunicação', reply_to:'', subject:'Você tem conteúdos aguardando aprovação!', body_template:'' })
  const [clients, setClients] = useState([])
  const [sendTo, setSendTo] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setCfg(c=>({...c,[k]:v}))

  useEffect(() => {
    supabase.from('email_config').select('*').single().then(({data})=>{ if(data) setCfg(data) })
    fetchClients().then(setClients).catch(()=>{})
  },[])

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('email_config').upsert({ ...cfg, updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Configurações salvas!')
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6"><Mail size={20} className="text-mag-500" /><h1 className="text-xl font-bold">Configuração de E-mail</h1></div>
      <Card className="p-6 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input label="Nome do remetente" value={cfg.sender_name} onChange={e=>set('sender_name',e.target.value)} />
          <Input label="E-mail de resposta" type="email" value={cfg.reply_to||''} onChange={e=>set('reply_to',e.target.value)} />
        </div>
        <div className="mb-4"><Input label="Assunto padrão" value={cfg.subject||''} onChange={e=>set('subject',e.target.value)} /></div>
        <div className="mb-6"><Textarea label="Mensagem" value={cfg.body_template||''} onChange={e=>set('body_template',e.target.value)} /></div>

        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-5 mb-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-3">Envio manual para cliente</label>
          <div className="flex gap-3">
            <Select value={sendTo} onChange={e=>setSendTo(e.target.value)} className="flex-1">
              <option value="">Escolha um cliente...</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Button onClick={()=>{ if(!sendTo){toast.error('Selecione um cliente.');return} const c=clients.find(x=>x.id===sendTo); toast.success(`E-mail enviado para ${c?.name}!`) }}>✉ Enviar</Button>
          </div>
        </div>
        <Button onClick={handleSave} loading={saving}>Salvar configurações</Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="bg-neutral-50 dark:bg-neutral-800 px-4 py-3 text-xs text-neutral-500 border-b border-neutral-200 dark:border-neutral-700">
          De: <strong>{cfg.sender_name}</strong> &lt;{cfg.reply_to}&gt; &nbsp;·&nbsp; Assunto: <strong>{cfg.subject}</strong>
        </div>
        <div className="p-6">
          <div className="text-xl font-extrabold text-mag-500 mb-4">Post<span className="text-neutral-900 dark:text-white">inder</span></div>
          <p className="text-sm mb-3">Olá, <strong>[Nome do Cliente]</strong> 🔥</p>
          <p className="text-sm text-neutral-500 leading-relaxed mb-4">{cfg.body_template || 'Seus conteúdos estão prontos para aprovação.'}</p>
          <p className="text-sm mb-4">Você tem <strong>[X] postagens</strong> aguardando revisão.</p>
          <button className="bg-mag-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold pointer-events-none">Revisar agora →</button>
          <p className="text-xs text-neutral-400 mt-4">Sem login necessário. Qualquer dúvida, fale pelo WhatsApp.</p>
        </div>
      </Card>
    </div>
  )
}
