import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, MessageCircle, Trash2, Edit3, Upload, Eye, ChevronUp, ChevronDown } from 'lucide-react'
import { fetchClients, createClient, updateClient, softDeleteClient } from '../../services/clients.service'
import { fetchPosts, computePostStatus } from '../../services/posts.service'
import { Avatar } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import { CLIENT_COLORS, SEGMENTS, getSegmentColor, buildApprovalLink } from '../../utils/constants'
import { COUNTRIES, normalizeCity, fetchCitiesByState } from '../../utils/geography'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

// ── Phone mask ──
function maskPhone(v = '') {
  v = v.replace(/\D/g, '').slice(0, 11)
  if (v.length > 10) return `(${v.slice(0,2)}) ${v.slice(2,3)} ${v.slice(3,7)}-${v.slice(7)}`
  if (v.length > 6)  return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`
  if (v.length > 2)  return `(${v.slice(0,2)}) ${v.slice(2)}`
  return v
}

const DOC_MASK = {
  cpf:  v => { v=v.replace(/\D/g,'').slice(0,11); if(v.length>9)return v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6,9)+'-'+v.slice(9); if(v.length>6)return v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6); if(v.length>3)return v.slice(0,3)+'.'+v.slice(3); return v },
  cnpj: v => { v=v.replace(/\D/g,'').slice(0,14); if(v.length>12)return v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8,12)+'-'+v.slice(12); if(v.length>8)return v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8); if(v.length>5)return v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5); if(v.length>2)return v.slice(0,2)+'.'+v.slice(2); return v },
}

// ── Deadline Stepper ──
function DeadlineStepper({ value, onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-2">Prazo de aceite (dias)</label>
      <div className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        <button type="button" onClick={() => onChange(Math.max(1, value - 1))}
          className="px-3 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 transition-colors">
          <ChevronDown size={16}/>
        </button>
        <div className="flex-1 text-center text-sm font-semibold py-2.5 bg-white dark:bg-neutral-800 select-none">{value}</div>
        <button type="button" onClick={() => onChange(Math.min(30, value + 1))}
          className="px-3 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 transition-colors">
          <ChevronUp size={16}/>
        </button>
      </div>
    </div>
  )
}

// ── City Autocomplete ──
function CityInput({ value, onChange, country, state }) {
  const [suggestions, setSuggestions] = useState([])
  const [allCities,   setAllCities]   = useState([])
  const [open,        setOpen]        = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (country === 'BR' && state) {
      fetchCitiesByState(state).then(cities => setAllCities(cities))
    } else {
      setAllCities([])
    }
  }, [country, state])

  function handleChange(e) {
    const v = e.target.value
    onChange(v)
    if (v.length >= 2 && allCities.length) {
      const filtered = allCities.filter(c => c.toLowerCase().startsWith(v.toLowerCase())).slice(0, 8)
      setSuggestions(filtered)
      setOpen(filtered.length > 0)
    } else {
      setOpen(false)
    }
  }

  function handleBlur() {
    setTimeout(() => {
      setOpen(false)
      // Normalize city name on blur
      const normalized = normalizeCity(value)
      if (normalized !== value) onChange(normalized)
    }, 150)
  }

  function select(city) { onChange(city); setOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-2">Cidade</label>
      <input
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={country === 'BR' && state ? 'Digite o nome da cidade...' : 'Cidade'}
        className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 outline-none focus:border-mag-500"
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg mt-1 overflow-hidden">
          {suggestions.map(c => (
            <button key={c} type="button" onClick={() => select(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Client Card ──
function ClientCard({ client, posts, onEdit, onDelete }) {
  const navigate = useNavigate()
  const token = (client.tokens || []).find(t => !t.revoked_at)
  const link  = token ? buildApprovalLink(token.slug) : ''

  const cp  = posts.filter(p => p.client_id === client.id)
  const apv = cp.filter(p => computePostStatus(p.files||[]) === 'approved').length
  const pnd = cp.filter(p => ['pending','updated'].includes(computePostStatus(p.files||[]))).length
  const rjt = cp.filter(p => computePostStatus(p.files||[]) === 'rejected').length

  function openWA() {
    let phone = (client.whatsapp||'').replace(/\D/g,'')
    if (!phone || phone.length < 10) { toast.error('WhatsApp não cadastrado ou inválido.'); return }
    if (phone.length <= 11) phone = '55' + phone
    const msg = encodeURIComponent(`Olá ${client.name}! 📋 Você tem conteúdos aguardando aprovação. Acesse o link abaixo:\n\n${link}`)
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  function goTo(status) {
    navigate(`/admin/dashboard?client=${client.id}&status=${status}`)
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
              {cp.length} posts{client.segment ? ` · ${client.segment}` : ''}{client.city ? ` · ${client.city}` : ''}{client.state ? `/${client.state}` : ''}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(client)} className="p-1.5 rounded hover:bg-teal-50 dark:hover:bg-teal-900/30 text-neutral-400 hover:text-teal-500 transition-colors"><Edit3 size={14}/></button>
          <button onClick={() => onDelete(client.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
        </div>
      </div>

      {/* Clickable status badges */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => goTo('approved')} className="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-semibold hover:bg-green-100 transition-colors">{apv} aprov</button>
        <button onClick={() => goTo('pending')}  className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold hover:bg-amber-100 transition-colors">{pnd} pend</button>
        <button onClick={() => goTo('rejected')} className="text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold hover:bg-red-100 transition-colors">{rjt} reprov</button>
      </div>

      {/* Link + WhatsApp */}
      {link ? (
        <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg px-3 py-2 mb-3">
          <span className="text-xs text-neutral-400 flex-1 truncate font-mono">{link.replace('https://','')}</span>
          <button onClick={openWA}
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-[#25D366] text-white hover:bg-[#20ba5a] transition-colors flex-shrink-0">
            <MessageCircle size={11}/> WA
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-xs px-3 py-2 rounded-lg mb-3">
          ⚠️ Sem link gerado.
        </div>
      )}

      {/* Ver posts */}
      <button onClick={() => goTo('all')} className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-mag-400 hover:text-mag-500 transition-all flex items-center justify-center gap-1.5">
        <Eye size={12}/> Ver posts
      </button>
    </Card>
  )
}

// ── Client Form Modal ──
function ClientFormModal({ title, initial, open, onClose, onSave }) {
  const emptyForm = { name:'', email:'', password:'', whatsapp:'', document:'', documentType:'cpf', segment:'', country:'BR', state:'', city:'', deadlineDays:7, color: CLIENT_COLORS[0] }
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const countryObj = COUNTRIES.find(c => c.code === form.country) || COUNTRIES[0]

  useEffect(() => { if (open) setForm(initial || emptyForm) }, [open, initial])
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  function handleSegmentChange(seg) {
    set('segment', seg)
    if (seg) set('color', getSegmentColor(seg))
  }

  function handleCountryChange(code) {
    set('country', code)
    set('state', '')
    set('city', '')
  }

  async function handleSave() {
    if (!form.name || !form.email) { toast.error('Preencha nome e e-mail.'); return }
    if (!initial && !form.password) { toast.error('Informe a senha.'); return }
    const normalized = { ...form, city: normalizeCity(form.city) }
    setLoading(true)
    try { await onSave(normalized); onClose() }
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
          <Input label="WhatsApp" value={form.whatsapp||''} onChange={e=>set('whatsapp', maskPhone(e.target.value))} placeholder="(51) 9 9999-9999" maxLength={16} />
        </div>

        {/* Documento */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-2">Documento</label>
          <div className="flex rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 mb-2">
            {['cpf','cnpj'].map(t=>(
              <button key={t} type="button" onClick={()=>set('documentType',t)} className={`flex-1 py-2.5 text-sm font-semibold transition-all ${form.documentType===t?'bg-mag-500 text-white':'bg-white dark:bg-neutral-800 text-neutral-500'}`}>{t.toUpperCase()}</button>
            ))}
          </div>
          <Input value={form.document||''} onChange={e=>set('document',DOC_MASK[form.documentType](e.target.value))} placeholder={form.documentType==='cpf'?'000.000.000-00':'00.000.000/0000-00'} />
        </div>

        {/* Segmento + Prazo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-2">Segmento</label>
            <select value={form.segment||''} onChange={e=>handleSegmentChange(e.target.value)}
              className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 outline-none focus:border-mag-500">
              <option value="">Selecione...</option>
              {SEGMENTS.map(s=><option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
          </div>
          <DeadlineStepper value={form.deadlineDays||7} onChange={v=>set('deadlineDays',v)} />
        </div>

        {/* País + Estado + Cidade */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-2">País</label>
            <select value={form.country||'BR'} onChange={e=>handleCountryChange(e.target.value)}
              className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 outline-none focus:border-mag-500">
              {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-2">Estado</label>
            {countryObj.states.length > 0 ? (
              <select value={form.state||''} onChange={e=>{set('state',e.target.value); set('city','')}}
                className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 outline-none focus:border-mag-500">
                <option value="">Selecione...</option>
                {countryObj.states.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input value={form.state||''} onChange={e=>set('state',e.target.value)} placeholder="Estado"
                className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 outline-none focus:border-mag-500" />
            )}
          </div>
          <CityInput value={form.city||''} onChange={v=>set('city',v)} country={form.country} state={form.state} />
        </div>

        {/* Cor */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-1">
            Cor do avatar {form.segment && <span className="normal-case font-normal ml-1">(definida pelo segmento)</span>}
          </label>
          <div className="flex gap-2 flex-wrap items-center">
            {CLIENT_COLORS.map(c=>(
              <button key={c} type="button" onClick={()=>set('color',c)} style={{background:c}} className={`w-7 h-7 rounded-full transition-transform ${form.color===c?'ring-2 ring-offset-2 ring-mag-500 scale-110':''}`} />
            ))}
            {form.color && !CLIENT_COLORS.includes(form.color) && (
              <div style={{background:form.color}} className="w-7 h-7 rounded-full ring-2 ring-offset-2 ring-mag-500 scale-110" />
            )}
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

// ── CSV Import — supports First Name, Organization Name, Phone 1 - Value ──
function CSVImport({ open, onClose, onImport }) {
  const [rows,     setRows]    = useState([])
  const [editIdx,  setEditIdx] = useState(null) // index of row being edited
  const [editForm, setEditForm] = useState({})
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').filter(Boolean)
      if (!lines.length) return
      const sep = lines[0].includes(';') ? ';' : ','
      const rawHeader = lines[0].split(sep).map(c => c.trim().replace(/^"|"$/g,'').toLowerCase())

      // Detect column indexes
      const idx = {
        firstName:  rawHeader.findIndex(h => h.includes('first name') || h === 'nome' || h === 'name'),
        lastName:   rawHeader.findIndex(h => h.includes('last name') || h.includes('sobrenome')),
        org:        rawHeader.findIndex(h => h.includes('organization') || h.includes('empresa') || h.includes('company')),
        phone:      rawHeader.findIndex(h => h.includes('phone') || h.includes('telefone') || h.includes('whatsapp')),
        email:      rawHeader.findIndex(h => h === 'email' || h.includes('e-mail')),
        segment:    rawHeader.findIndex(h => h.includes('segment') || h.includes('segmento')),
        city:       rawHeader.findIndex(h => h.includes('city') || h.includes('cidade')),
        state:      rawHeader.findIndex(h => h.includes('state') || h.includes('estado')),
      }

      const dataLines = lines.slice(1)
      const parsed = dataLines.map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g,''))
        const firstName = idx.firstName >= 0 ? cols[idx.firstName] || '' : ''
        const lastName  = idx.lastName  >= 0 ? cols[idx.lastName]  || '' : ''
        const org       = idx.org       >= 0 ? cols[idx.org]       || '' : ''
        // Name: prefer Organization Name, fallback to First + Last
        const name = org || [firstName, lastName].filter(Boolean).join(' ') || ''
        const phone = idx.phone >= 0 ? cols[idx.phone] || '' : ''
        return {
          selected:  true,
          name:      name.trim(),
          email:     idx.email   >= 0 ? cols[idx.email]   || '' : '',
          whatsapp:  phone.replace(/\D/g,'').slice(0,11),
          segment:   idx.segment >= 0 ? cols[idx.segment] || '' : '',
          city:      idx.city    >= 0 ? cols[idx.city]    || '' : '',
          state:     idx.state   >= 0 ? cols[idx.state]   || '' : '',
          password:  '',
          color:     getSegmentColor(''),
          country:   'BR',
          deadlineDays: 7,
        }
      }).filter(r => r.name)
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  function updateRow(i, k, v) { setRows(prev => prev.map((r,idx) => idx===i ? {...r,[k]:v} : r)) }

  function openEdit(i) { setEditIdx(i); setEditForm({...rows[i]}) }
  function saveEdit() {
    setRows(prev => prev.map((r,i) => i===editIdx ? {...r,...editForm} : r))
    setEditIdx(null)
  }

  async function handleImport() {
    const sel = rows.filter(r=>r.selected)
    if (!sel.length) { toast.error('Selecione ao menos um contato.'); return }
    const missing = sel.filter(r=>!r.email||!r.password)
    if (missing.length) { toast.error(`Preencha e-mail e senha de todos (${missing.length} faltando).`); return }
    await onImport(sel)
    setRows([]); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="📋 Importar Clientes via CSV"
      subtitle="Suporte: First Name, Organization Name, Phone 1 - Value" size="lg">

      {editIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-full max-w-md mx-4 space-y-3">
            <h3 className="font-bold text-base">Completar dados — {rows[editIdx]?.name}</h3>
            <input className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none" placeholder="E-mail *" value={editForm.email||''} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))} />
            <input type="password" className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none" placeholder="Senha *" onChange={e=>setEditForm(f=>({...f,password:e.target.value}))} />
            <input className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none" placeholder="WhatsApp" value={editForm.whatsapp||''} onChange={e=>setEditForm(f=>({...f,whatsapp:maskPhone(e.target.value)}))} />
            <select className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none" value={editForm.segment||''} onChange={e=>setEditForm(f=>({...f,segment:e.target.value,color:getSegmentColor(e.target.value)}))}>
              <option value="">Segmento...</option>
              {SEGMENTS.map(s=><option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
            <input className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none" placeholder="Cidade" value={editForm.city||''} onChange={e=>setEditForm(f=>({...f,city:e.target.value}))} />
            <div className="flex gap-3 pt-1">
              <button onClick={saveEdit} className="flex-1 bg-mag-500 text-white rounded-xl py-2.5 text-sm font-bold">Salvar</button>
              <button onClick={()=>setEditIdx(null)} className="flex-1 border border-neutral-200 dark:border-neutral-700 rounded-xl py-2.5 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {!rows.length ? (
        <div>
          <div onClick={()=>fileRef.current?.click()}
            className="border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-10 text-center cursor-pointer hover:border-mag-400 transition-colors mb-3">
            <Upload size={32} className="text-neutral-300 mx-auto mb-3" />
            <p className="font-semibold text-sm">Clique para selecionar o arquivo CSV</p>
          </div>
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 text-xs text-neutral-500">
            <p className="font-semibold mb-1">Colunas detectadas automaticamente:</p>
            <p>First Name, Organization Name, Phone 1 - Value, Email, Segment, City, State</p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold mb-3">{rows.length} contato(s) — clique em ✏️ para completar dados</p>
          <div className="overflow-auto max-h-64 rounded-lg border border-neutral-200 dark:border-neutral-700 mb-4">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-800 sticky top-0">
                <tr>
                  {['✓','Nome','WhatsApp','E-mail *','Senha *','Editar'].map(h=>(
                    <th key={h} className="px-2 py-2 text-left font-semibold text-neutral-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i)=>(
                  <tr key={i} className={`border-t border-neutral-100 dark:border-neutral-800 ${!r.email||!r.password?'bg-amber-50/50 dark:bg-amber-950/10':''}`}>
                    <td className="px-2 py-1.5"><input type="checkbox" checked={r.selected} onChange={e=>updateRow(i,'selected',e.target.checked)} className="accent-mag-500" /></td>
                    <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.name}</td>
                    <td className="px-2 py-1.5 text-neutral-500">{r.whatsapp || '—'}</td>
                    <td className="px-2 py-1.5"><input className="border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 text-xs w-36 bg-white dark:bg-neutral-800 outline-none" placeholder="email@..." value={r.email} onChange={e=>updateRow(i,'email',e.target.value)} /></td>
                    <td className="px-2 py-1.5"><input type="password" className="border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 text-xs w-24 bg-white dark:bg-neutral-800 outline-none" placeholder="Senha" onChange={e=>updateRow(i,'password',e.target.value)} /></td>
                    <td className="px-2 py-1.5">
                      <button onClick={()=>openEdit(i)} className="text-mag-500 hover:text-mag-700 font-bold px-2 py-0.5 rounded border border-mag-200 hover:bg-mag-50 transition-colors">✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleImport} className="flex-1 justify-center">⬆ Importar selecionados</Button>
            <Button variant="secondary" onClick={()=>{setRows([]); onClose()}}>Cancelar</Button>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
    </Modal>
  )
}

// ── Main Page ──
export default function ClientsPage() {
  const [clients,    setClients]    = useState([])
  const [posts,      setPosts]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showNew,    setShowNew]    = useState(false)
  const [showCSV,    setShowCSV]    = useState(false)
  const [editClient, setEditClient] = useState(null)

  useEffect(() => {
    Promise.all([fetchClients(), fetchPosts()])
      .then(([c,p]) => { setClients(c); setPosts(p) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(form) {
    const color = form.color || getSegmentColor(form.segment) || CLIENT_COLORS[clients.length % CLIENT_COLORS.length]
    const client = await createClient({ ...form, color })
    setClients(c => [client, ...c])
    toast.success('Cliente criado!')
  }

  async function handleEdit(form) {
    const updates = { name: form.name, email: form.email, whatsapp: form.whatsapp, segment: form.segment, deadline_days: form.deadlineDays, color: form.color, city: form.city, state: form.state, country: form.country }
    if (form.password) updates.password_hash = form.password
    const updated = await updateClient(editClient.id, updates)
    setClients(c => c.map(x => x.id === editClient.id ? { ...x, ...updated } : x))
    toast.success('Cliente atualizado!')
  }

  async function handleCSVImport(rows) {
    const created = []
    for (const r of rows) {
      const color = r.color || getSegmentColor(r.segment) || CLIENT_COLORS[created.length % CLIENT_COLORS.length]
      const client = await createClient({ ...r, color })
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-bold">Clientes cadastrados <span className="text-neutral-400 font-normal text-base">({clients.length})</span></h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Upload size={14}/>} onClick={()=>setShowCSV(true)}>Importar CSV</Button>
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
              onEdit={setEditClient} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <ClientFormModal title="Novo Cliente" open={showNew} onClose={()=>setShowNew(false)} onSave={handleCreate} />
      <ClientFormModal title="Editar Cliente" initial={editClient ? {
        name: editClient.name, email: editClient.email, password:'',
        whatsapp: editClient.whatsapp||'', document: editClient.document||'',
        documentType: editClient.document_type||'cpf', segment: editClient.segment||'',
        city: editClient.city||'', state: editClient.state||'', country: editClient.country||'BR',
        deadlineDays: editClient.deadline_days||7, color: editClient.color
      } : null} open={!!editClient} onClose={()=>setEditClient(null)} onSave={handleEdit} />
      <CSVImport open={showCSV} onClose={()=>setShowCSV(false)} onImport={handleCSVImport} />
    </div>
  )
}
