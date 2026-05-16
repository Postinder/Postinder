import { useState, useEffect, useRef } from 'react'
import { Plus, MessageCircle, Trash2, Edit3, Upload, Eye } from 'lucide-react'
import { fetchClients, createClient, updateClient, softDeleteClient, parseVCFText } from '../../services/clients.service'
import { fetchPosts, computePostStatus } from '../../services/posts.service'
import { Avatar } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import { CLIENT_COLORS } from '../../utils/constants'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const DOC_MASK = {
  cpf:  v => { v=v.replace(/\D/g,'').slice(0,11); if(v.length>9)return v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6,9)+'-'+v.slice(9); if(v.length>6)return v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6); if(v.length>3)return v.slice(0,3)+'.'+v.slice(3); return v },
  cnpj: v => { v=v.replace(/\D/g,'').slice(0,14); if(v.length>12)return v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8,12)+'-'+v.slice(12); if(v.length>8)return v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8); if(v.length>5)return v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5); if(v.length>2)return v.slice(0,2)+'.'+v.slice(2); return v },
}

function ClientCard({ client, posts, onEdit, onDelete, onViewPosts }) {
  const cp  = posts.filter(p => p.client_id === client.id)
  const apv = cp.filter(p => computePostStatus(p) === 'approved').length
  const pnd = cp.filter(p => computePostStatus(p) === 'pending_approval').length
  const rjt = cp.filter(p => computePostStatus(p) === 'rejected').length

  function openWA() {
    const digits = (client.whatsapp || '').replace(/\D/g, '')
    if (!digits) {
      toast.error('Cliente sem WhatsApp cadastrado.')
      return
    }
    const phone = digits.startsWith('55') ? digits : `55${digits}`
    window.open(`https://wa.me/${phone}`, '_blank')
  }

  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Avatar name={client.name} color={client.color} size="lg" />
          <div>
            <div className="font-bold text-neutral-900 dark:text-white">{client.name}</div>
            <div className="text-xs text-neutral-400">{client.email}</div>
            <div className="text-xs text-neutral-400 mt-0.5">
              {cp.length} posts{client.segment ? ` · ${client.segment}` : ''} · prazo: {client.deadline_days || 7}d
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(client)} className="p-1.5 rounded hover:bg-teal-50 dark:hover:bg-teal-900/30 text-neutral-400 hover:text-teal-500 transition-colors" title="Editar"><Edit3 size={14}/></button>
          <button onClick={() => onDelete(client.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={14}/></button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2 mb-3">
        <span className="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-semibold">{apv} aprov</span>
        <span className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">{pnd} pend</span>
        <span className="text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">{rjt} reprov</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={openWA} className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
          <MessageCircle size={12}/> WhatsApp
        </button>
        <button onClick={() => onViewPosts(client.id)} className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-mag-400 hover:text-mag-500 transition-all">
          <Eye size={12} className="inline mr-1"/> Ver posts
        </button>
      </div>
    </Card>
  )
}

function ClientFormModal({ title, initial, open, onClose, onSave }) {
  const [form, setForm] = useState(initial || { name:'', email:'', password:'', whatsapp:'', document:'', documentType:'cpf', segment:'', deadlineDays:7, color: CLIENT_COLORS[0] })
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (initial) setForm(initial) }, [initial])
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  async function handleSave() {
    if (!form.name || !form.email) { toast.error('Preencha nome e e-mail.'); return }
    setLoading(true)
    try { await onSave(form); onClose() }
    catch(e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nome *" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Nome ou empresa" />
          <Input label="E-mail *" type="email" value={form.email} onChange={e=>set('email',e.target.value)} />
          <Input label={initial ? 'Nova Senha (deixe vazio p/ manter)' : 'Senha *'} type="password" value={form.password||''} onChange={e=>set('password',e.target.value)} />
          <Input label="WhatsApp" value={form.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)} placeholder="(51) 9 9999-9999" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-2">Documento</label>
          <div className="flex rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 mb-2">
            {['cpf','cnpj'].map(t=>(
              <button key={t} onClick={()=>set('documentType',t)} className={`flex-1 py-2.5 text-sm font-semibold transition-all ${form.documentType===t?'bg-mag-500 text-white':'bg-white dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-50'}`}>{t.toUpperCase()}</button>
            ))}
          </div>
          <Input value={form.document||''} onChange={e=>set('document',DOC_MASK[form.documentType](e.target.value))} placeholder={form.documentType==='cpf'?'000.000.000-00':'00.000.000/0000-00'} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Segmento" value={form.segment||''} onChange={e=>set('segment',e.target.value)} placeholder="Ex: Restaurante" />
          <Input label="Prazo de aceite (dias)" type="number" min="1" max="30" value={form.deadlineDays||7} onChange={e=>set('deadlineDays',parseInt(e.target.value)||7)} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-2">Cor do avatar</label>
          <div className="flex gap-2 flex-wrap">
            {CLIENT_COLORS.map(c=>(
              <button key={c} onClick={()=>set('color',c)} style={{background:c}} className={`w-7 h-7 rounded-full transition-transform ${form.color===c?'ring-2 ring-offset-2 ring-mag-500 scale-110':''}`} />
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} loading={loading} className="flex-1 justify-center">{initial ? 'Salvar alterações' : 'Cadastrar cliente'}</Button>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}

function VCFImport({ open, onClose, onImport }) {
  const [contacts, setContacts] = useState([])
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => setContacts(parseVCFText(ev.target.result))
    reader.readAsText(file)
  }

  async function handleImport() {
    const sel = contacts.filter(c=>c.selected)
    if (!sel.length) { toast.error('Selecione ao menos um contato.'); return }
    const missing = sel.filter(c=>!c.email||!c.password)
    if (missing.length) { toast.error('Preencha e-mail e senha de todos os selecionados.'); return }
    await onImport(sel)
    setContacts([])
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar Clientes via VCF" subtitle="Nome e WhatsApp são preenchidos automaticamente do arquivo." size="lg">
      {!contacts.length ? (
        <div onClick={()=>fileRef.current?.click()} className="border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-10 text-center cursor-pointer hover:border-mag-400 transition-colors">
          <Upload size={32} className="text-neutral-300 mx-auto mb-3" />
          <p className="font-semibold text-sm">Clique para selecionar o arquivo VCF</p>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold mb-3">{contacts.length} contatos encontrados</p>
          <div className="overflow-auto max-h-72 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-800 sticky top-0">
                <tr>{['✓','Nome','WhatsApp','E-mail *','Senha *','Segmento'].map(h=><th key={h} className="px-3 py-2 text-left font-semibold text-neutral-500">{h}</th>)}</tr>
              </thead>
              <tbody>
                {contacts.map((c,i)=>(
                  <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-1.5"><input type="checkbox" checked={c.selected} onChange={e=>{const nc=[...contacts];nc[i].selected=e.target.checked;setContacts(nc)}} className="accent-mag-500" /></td>
                    <td className="px-3 py-1.5 font-medium">{c.name}</td>
                    <td className="px-3 py-1.5 text-neutral-500">{c.phone}</td>
                    <td className="px-3 py-1.5"><input className="border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 text-xs w-36 bg-white dark:bg-neutral-800 outline-none" placeholder="email@..." onChange={e=>{const nc=[...contacts];nc[i].email=e.target.value;setContacts(nc)}} /></td>
                    <td className="px-3 py-1.5"><input type="password" className="border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 text-xs w-28 bg-white dark:bg-neutral-800 outline-none" placeholder="Senha" onChange={e=>{const nc=[...contacts];nc[i].password=e.target.value;setContacts(nc)}} /></td>
                    <td className="px-3 py-1.5"><input className="border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 text-xs w-28 bg-white dark:bg-neutral-800 outline-none" placeholder="Segmento" onChange={e=>{const nc=[...contacts];nc[i].segment=e.target.value;setContacts(nc)}} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleImport} className="flex-1 justify-center">⬆ Importar selecionados</Button>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept=".vcf,.vcard" className="hidden" onChange={handleFile} />
    </Modal>
  )
}

export default function ClientsPage() {
  const navigate  = useNavigate()
  const [clients, setClients] = useState([])
  const [posts,   setPosts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [showVCF, setShowVCF] = useState(false)
  const [editClient, setEditClient] = useState(null)

  useEffect(() => {
    Promise.all([fetchClients(), fetchPosts()])
      .then(([c,p]) => { setClients(c); setPosts(p) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(form) {
    const client = await createClient({ ...form, color: form.color || CLIENT_COLORS[clients.length % CLIENT_COLORS.length] })
    setClients(c => [client, ...c])
    toast.success('Cliente criado!')
  }

  async function handleEdit(form) {
    const updates = { name: form.name, email: form.email, whatsapp: form.whatsapp, segment: form.segment, deadline_days: form.deadlineDays, color: form.color }
    if (form.password) updates.password_hash = form.password
    const updated = await updateClient(editClient.id, updates)
    setClients(c => c.map(x => x.id === editClient.id ? { ...x, ...updated } : x))
    toast.success('Cliente atualizado!')
  }

  async function handleVCFImport(contacts) {
    const created = []
    for (const c of contacts) {
      const client = await createClient({ name:c.name, email:c.email, password:c.password, whatsapp:c.phone, segment:c.segment, deadlineDays:7, color: CLIENT_COLORS[clients.length%CLIENT_COLORS.length] })
      created.push(client)
    }
    setClients(c => [...created, ...c])
    toast.success(`${created.length} cliente(s) importado(s)!`)
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este cliente e todos os seus posts?')) return
    await softDeleteClient(id)
    setClients(c => c.filter(x => x.id !== id))
    toast.success('Cliente excluído.')
  }

  function viewPosts(clientId) {
    navigate(`/admin/dashboard?client=${clientId}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-bold">Clientes cadastrados <span className="text-neutral-400 font-normal text-base">({clients.length})</span></h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Upload size={14}/>} onClick={()=>setShowVCF(true)}>Importar VCF</Button>
          <Button size="sm" icon={<Plus size={14}/>} onClick={()=>setShowNew(true)}>Novo Cliente</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-neutral-400">Carregando...</div>
      ) : clients.length === 0 ? (
        <Card className="p-12 text-center text-neutral-400">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-sm">Nenhum cliente cadastrado ainda.</p>
          <Button className="mt-4" onClick={()=>setShowNew(true)}>+ Novo Cliente</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(c => (
            <ClientCard key={c.id} client={c} posts={posts}
              onEdit={setEditClient} onDelete={handleDelete} onViewPosts={viewPosts} />
          ))}
        </div>
      )}

      <ClientFormModal title="Novo Cliente" open={showNew} onClose={()=>setShowNew(false)} onSave={handleCreate} />
      <ClientFormModal title="Editar Cliente" initial={editClient ? {
        name: editClient.name, email: editClient.email, password:'',
        whatsapp: editClient.whatsapp||'', document: editClient.document||'',
        documentType: editClient.document_type||'cpf', segment: editClient.segment||'',
        deadlineDays: editClient.deadline_days||7, color: editClient.color
      } : null} open={!!editClient} onClose={()=>setEditClient(null)} onSave={handleEdit} />
      <VCFImport open={showVCF} onClose={()=>setShowVCF(false)} onImport={handleVCFImport} />
    </div>
  )
}
