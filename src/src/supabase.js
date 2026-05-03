import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)

export async function getLibrary() {
  const { data, error } = await supabase
    .from('training_library')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data.map(t => ({
    id: t.id,
    name: t.name,
    ctype: t.ctype,
    link: t.link || '',
    docContent: t.doc_content || '',
    docName: t.doc_name || '',
    quiz: Array.isArray(t.quiz) ? t.quiz : [],
    category: t.category || 'Training',
    tags: Array.isArray(t.tags) ? t.tags : [],
    renewal_cycle: t.renewal_cycle || '12 Months',
    default_hours: t.default_hours || 0,
    provider: t.provider || '',
  }))
}

export async function updateLibraryTraining(id, updates) {
  const payload = {
    name: updates.name || '',
    ctype: updates.ctype || 'Read and Acknowledge',
    link: updates.link || '',
    doc_content: updates.docContent || '',
    doc_name: updates.docName || '',
    quiz: updates.quiz || [],
    category: updates.category || 'Training',
    tags: updates.tags || [],
    renewal_cycle: updates.renewal_cycle || '12 Months',
    default_hours: updates.default_hours || 0,
    provider: updates.provider || '',
  }
  const { error } = await supabase.from('training_library').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function addLibraryTraining(training) {
  const id = 't' + Date.now()
  const { error } = await supabase.from('training_library').insert([{
    id, name: training.name, ctype: training.ctype, link: training.link || '',
    doc_content: '', doc_name: '', quiz: [],
    category: training.category || 'Training',
    tags: training.tags || [],
    renewal_cycle: training.renewal_cycle || '12 Months',
    default_hours: training.default_hours || 0,
    sort_order: 999,
    provider: training.provider || '',
  }])
  if (error) throw new Error(error.message)
  return id
}

export async function deleteLibraryTraining(id) {
  const { error } = await supabase.from('training_library').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getEmployees() {
  const { data: emps, error: empErr } = await supabase
    .from('employees').select('*').order('name')
  if (empErr) throw empErr

  const results = await Promise.all(emps.map(async e => {
    const eid = e.id
    const [assignRes, compRes, certRes, bulkRes] = await Promise.all([
      supabase.from('employee_trainings').select('*').eq('employee_id', eid),
      supabase.from('training_completions').select('*').eq('employee_id', eid),
      supabase.from('certificates').select('*').eq('employee_id', eid),
      supabase.from('bulk_hours').select('*').eq('employee_id', eid),
    ])
    const empAssignments = assignRes.data || []
    const empCompletions = compRes.data || []
    const empCerts = certRes.data || []
    const empBulkHrs = bulkRes.data || []

    const trainings = {}
    empAssignments.forEach(a => {
      const cert = empCerts.find(c => c.training_id === a.training_id)
      const trCompletions = empCompletions
        .filter(c => c.training_id === a.training_id)
        .sort((x, y) => (y.completed || '').localeCompare(x.completed || ''))
      const current = trCompletions[0] || null
      const prior = trCompletions[1] || null
      trainings[a.training_id] = {
        completed: current?.completed || null,
        dueDate: current?.due_date || a.due_date || '',
        initials: current?.initials || null,
        initialsDate: current?.initials_date || null,
        hours_override
