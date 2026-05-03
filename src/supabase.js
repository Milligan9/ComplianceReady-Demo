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
        hours_override: current?.hours_override ?? null,
        completionId: current?.id || null,
        yearLabel: current?.year_label || null,
        priorCompleted: prior?.completed || null,
        priorDueDate: prior?.due_date || '',
        priorInitials: prior?.initials || null,
        priorHoursOverride: prior?.hours_override ?? null,
        priorCompletionId: prior?.id || null,
        priorYearLabel: prior?.year_label || null,
        certificate: cert ? {
          name: cert.file_name, type: cert.file_type,
          date: cert.upload_date, storagePath: cert.storage_path,
        } : null,
      }
    })
    return {
      id: e.id, name: e.name, pos: e.pos, type: e.type,
      hire: e.hire, email: e.email, phone: e.phone, pin: e.pin,
      cleared_at: e.cleared_at || null,
      trainings,
      bulkHours: empBulkHrs,
    }
  }))
  return results
}

export async function addEmployee(emp) {
  const { data, error } = await supabase.from('employees').insert([{
    name: emp.name, pos: emp.pos, type: emp.type, hire: emp.hire,
    email: emp.email || '', phone: emp.phone || '', pin: emp.pin,
  }]).select()
  if (error) throw new Error(error.message)
  return data[0].id
}

export async function updateEmployee(id, updates) {
  const { error } = await supabase.from('employees').update({
    name: updates.name, pos: updates.pos, type: updates.type,
    email: updates.email || '', phone: updates.phone || '', pin: updates.pin,
  }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteEmployee(id) {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function assignTraining(employeeId, trainingId, dueDate) {
  const empId = parseInt(employeeId, 10)
  if (isNaN(empId)) throw new Error(`Invalid employeeId: ${employeeId}`)
  const { data: existing } = await supabase
    .from('employee_trainings').select('id')
    .eq('employee_id', empId).eq('training_id', String(trainingId)).maybeSingle()
  if (existing) return
  const { error, data } = await supabase.from('employee_trainings').insert({
    employee_id: empId, training_id: String(trainingId), due_date: dueDate || '',
  }).select()
  if (error) throw new Error(error.message)
  return data
}

export async function saveCompletion(employeeId, trainingId, data, existingId = null) {
  if (existingId) {
    const { error } = await supabase.from('training_completions')
      .update({
        completed: data.completed || null,
        due_date: data.dueDate || null,
        initials: data.initials || null,
        initials_date: data.initialsDate || null,
        hours_override: data.hours_override !== undefined ? data.hours_override : null,
        year_label: data.yearLabel || null,
      }).eq('id', existingId)
    if (error) throw new Error(error.message)
    return existingId
  } else {
    const { data: result, error } = await supabase.from('training_completions')
      .insert([{
        employee_id: employeeId, training_id: trainingId,
        completed: data.completed || null,
        due_date: data.dueDate || null,
        initials: data.initials || null,
        initials_date: data.initialsDate || null,
        hours_override: data.hours_override !== undefined ? data.hours_override : null,
        year_label: data.yearLabel || null,
      }]).select()
    if (error) throw new Error(error.message)
    return result[0].id
  }
}

export async function clearCompletion(completionId) {
  const { error } = await supabase.from('training_completions')
    .update({ completed: null, initials: null, initials_date: null })
    .eq('id', completionId)
  if (error) throw new Error(error.message)
}

export async function removeTrainingFromEmployee(employeeId, trainingId) {
  await supabase.from('training_completions').delete()
    .eq('employee_id', employeeId).eq('training_id', trainingId)
  const { error } = await supabase.from('employee_trainings').delete()
    .eq('employee_id', employeeId).eq('training_id', trainingId)
  if (error) throw new Error(error.message)
}

export async function addBulkHours(employeeId, entry) {
  const { error } = await supabase.from('bulk_hours').insert([{
    employee_id: employeeId, hours: entry.hours, note: entry.note || '',
    period_label: entry.period_label || '',
    entry_date: entry.entry_date || new Date().toISOString().split('T')[0],
  }])
  if (error) throw new Error(error.message)
}

export async function deleteBulkHours(id) {
  const { error } = await supabase.from('bulk_hours').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function uploadCertificate(employeeId, trainingId, file) {
  const path = `${employeeId}/${trainingId}/${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('certificates').upload(path, file, { upsert: true })
  if (uploadError) throw new Error(uploadError.message)
  const { error: dbError } = await supabase.from('certificates').upsert({
    employee_id: employeeId, training_id: trainingId, file_name: file.name,
    file_type: file.type, upload_date: new Date().toISOString().split('T')[0],
    storage_path: path,
  })
  if (dbError) throw new Error(dbError.message)
}

export async function downloadCertificate(storagePath, fileName) {
  const { data, error } = await supabase.storage.from('certificates').download(storagePath)
  if (error) throw new Error(error.message)
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url; a.download = fileName; a.click()
  URL.revokeObjectURL(url)
}

export async function deleteCertificate(employeeId, trainingId, storagePath) {
  await supabase.storage.from('certificates').remove([storagePath])
  const { error } = await supabase.from('certificates').delete()
    .eq('employee_id', employeeId).eq('training_id', trainingId)
  if (error) throw new Error(error.message)
}

export async function updateTrainingRecord(employeeId, trainingId, updates) {
  const empId = parseInt(employeeId, 10)
  if (updates.dueDate !== undefined) {
    await supabase.from('employee_trainings')
      .update({ due_date: updates.dueDate || '' })
      .eq('employee_id', empId).eq('training_id', trainingId)
  }
  if (updates.completed === null) {
    await supabase.from('training_completions')
      .update({ completed: null, initials: null, initials_date: null })
      .eq('employee_id', empId).eq('training_id', trainingId)
  }
}

export async function getInServiceSessions(trainingId) {
  const { data: sessions, error } = await supabase
    .from('in_service_sessions').select('*')
    .eq('training_id', trainingId)
    .order('session_date', { ascending: false })
  if (error) throw error
  const result = await Promise.all((sessions || []).map(async s => {
    const { data: attendance } = await supabase
      .from('in_service_attendance').select('employee_id')
      .eq('session_id', s.id)
    return { ...s, attendeeIds: (attendance || []).map(a => String(a.employee_id)) }
  }))
  return result
}

export async function getAllInServiceSessions() {
  const { data: sessions, error } = await supabase
    .from('in_service_sessions').select('*')
    .order('session_date', { ascending: false })
  if (error) throw error
  const result = await Promise.all((sessions || []).map(async s => {
    const { data: attendance } = await supabase
      .from('in_service_attendance').select('employee_id')
      .eq('session_id', s.id)
    return { ...s, attendeeIds: (attendance || []).map(a => String(a.employee_id)) }
  }))
  return result
}

export async function saveInServiceSession(sessionData, attendeeIds) {
  const { data: session, error } = await supabase
    .from('in_service_sessions')
    .insert([{
      training_id: sessionData.trainingId,
      session_date: sessionData.date,
      start_time: sessionData.startTime || '',
      end_time: sessionData.endTime || '',
      facilitator: sessionData.facilitator || '',
      facilitator_title: sessionData.facilitatorTitle || '',
      location: sessionData.location || 'Online',
      ce_hours: parseFloat(sessionData.ceHours) || 0,
      curriculum: sessionData.curriculum || '',
      citation: sessionData.citation || '',
    }]).select()
  if (error) throw new Error(error.message)
  const sessionId = session[0].id
  for (const empId of attendeeIds) {
    await supabase.from('in_service_attendance').insert([{
      session_id: sessionId,
      employee_id: parseInt(empId, 10),
      attended: true,
    }])
  }
  return sessionId
}

export async function deleteInServiceSession(sessionId) {
  const { error } = await supabase
    .from('in_service_sessions').delete().eq('id', sessionId)
  if (error) throw new Error(error.message)
}
