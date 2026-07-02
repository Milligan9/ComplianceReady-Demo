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
    tags: Array.isArray(t.tags) ? t.tags : [],
    renewal_cycle: t.renewal_cycle || '12 Months',
    default_hours: t.default_hours || 0,
    provider: t.provider || '',
    generate_cert: t.generate_cert || false,
    webinar_description: t.webinar_description || '',
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
    tags: updates.tags || [],
    renewal_cycle: updates.renewal_cycle || '12 Months',
    default_hours: updates.default_hours || 0,
    provider: updates.provider || '',
    webinar_description: updates.webinar_description || '',
  }
  const { error } = await supabase.from('training_library').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function addLibraryTraining(training) {
  const id = 't' + Date.now()
  const { error } = await supabase.from('training_library').insert([{
    id, name: training.name, ctype: training.ctype, link: training.link || '',
    doc_content: '', doc_name: '', quiz: [],
    tags: training.tags || [],
    renewal_cycle: training.renewal_cycle || '12 Months',
    default_hours: training.default_hours || 0,
    sort_order: 999,
    provider: training.provider || '',
    webinar_description: training.webinar_description || '',
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
      staff_type: e.staff_type || '',
      is_active: e.is_active !== false,
      cert_count: e.cert_count || 0,
      pipeline_stage: e.pipeline_stage || 1,
      pipeline_flags: e.pipeline_flags || {},
      fully_cleared_at: e.fully_cleared_at || '',
      fully_cleared_by: e.fully_cleared_by || '',
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
    staff_type: emp.staff_type || '',
  }]).select()
  if (error) throw new Error(error.message)
  return data[0].id
}

export async function updateEmployee(id, updates) {
  const { error } = await supabase.from('employees').update({
    name: updates.name, pos: updates.pos, type: updates.type,
    email: updates.email || '', phone: updates.phone || '', pin: updates.pin,
    staff_type: updates.staff_type || '',
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
  if (error) { console.error('assignTraining error:', JSON.stringify(error)); throw new Error(error.message) }
  return data
}

export async function saveCompletion(employeeId, trainingId, data, existingId = null) {
  if (existingId) {
    const { error } = await supabase.from('training_completions').update({
      completed: data.completed || null, due_date: data.dueDate || null,
      initials: data.initials || null, initials_date: data.initialsDate || null,
      hours_override: data.hours_override !== undefined ? data.hours_override : null,
      year_label: data.yearLabel || null, expiry_override: data.expiryOverride || null,
    }).eq('id', existingId)
    if (error) throw new Error(error.message)
    return existingId
  } else {
    const { data: result, error } = await supabase.from('training_completions').insert([{
      employee_id: employeeId, training_id: trainingId,
      completed: data.completed || null, due_date: data.dueDate || null,
      initials: data.initials || null, initials_date: data.initialsDate || null,
      hours_override: data.hours_override !== undefined ? data.hours_override : null,
      year_label: data.yearLabel || null,
    }]).select()
    if (error) throw new Error(error.message)
    return result[0].id
  }
}

export async function clearCompletion(completionId) {
  const { error } = await supabase.from('training_completions')
    .update({ completed: null, initials: null, initials_date: null }).eq('id', completionId)
  if (error) throw new Error(error.message)
}

export async function removeTrainingFromEmployee(employeeId, trainingId) {
  await supabase.from('training_completions').delete().eq('employee_id', employeeId).eq('training_id', trainingId)
  const { error } = await supabase.from('employee_trainings').delete().eq('employee_id', employeeId).eq('training_id', trainingId)
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
  const { error: uploadError } = await supabase.storage.from('certificates').upload(path, file, { upsert: true })
  if (uploadError) throw new Error(uploadError.message)
  const { error: dbError } = await supabase.from('certificates').upsert({
    employee_id: employeeId, training_id: trainingId, file_name: file.name,
    file_type: file.type, upload_date: new Date().toISOString().split('T')[0], storage_path: path,
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
    await supabase.from('employee_trainings').update({ due_date: updates.dueDate || '' })
      .eq('employee_id', empId).eq('training_id', trainingId)
  }
  if (updates.completed === null) {
    await supabase.from('training_completions')
      .update({ completed: null, initials: null, initials_date: null })
      .eq('employee_id', empId).eq('training_id', trainingId)
  }
}

export async function getInServiceSessions(trainingId) {
  const { data: sessions, error } = await supabase.from('in_service_sessions').select('*')
    .eq('training_id', trainingId).order('session_date', { ascending: false })
  if (error) throw error
  const result = await Promise.all((sessions || []).map(async s => {
    const { data: attendance } = await supabase.from('in_service_attendance').select('employee_id').eq('session_id', s.id)
    return { ...s, attendeeIds: (attendance || []).map(a => String(a.employee_id)) }
  }))
  return result
}

export async function getAllInServiceSessions() {
  const { data: sessions, error } = await supabase.from('in_service_sessions').select('*')
    .order('session_date', { ascending: false })
  if (error) throw error
  const result = await Promise.all((sessions || []).map(async s => {
    const { data: attendance } = await supabase.from('in_service_attendance').select('employee_id').eq('session_id', s.id)
    return { ...s, attendeeIds: (attendance || []).map(a => String(a.employee_id)) }
  }))
  return result
}

export async function saveInServiceSession(sessionData, attendeeIds) {
  const { data: session, error } = await supabase.from('in_service_sessions').insert([{
    training_id: sessionData.trainingId, session_date: sessionData.date,
    start_time: sessionData.startTime || '', end_time: sessionData.endTime || '',
    facilitator: sessionData.facilitator || '', facilitator_title: sessionData.facilitatorTitle || '',
    location: sessionData.location || 'Online', ce_hours: parseFloat(sessionData.ceHours) || 0,
    curriculum: sessionData.curriculum || '', citation: sessionData.citation || '',
  }]).select()
  if (error) throw new Error(error.message)
  const sessionId = session[0].id
  for (const empId of attendeeIds) {
    await supabase.from('in_service_attendance').insert([{
      session_id: sessionId, employee_id: parseInt(empId, 10), attended: true,
    }])
  }
  return sessionId
}

export async function deleteInServiceSession(sessionId) {
  const { error } = await supabase.from('in_service_sessions').delete().eq('id', sessionId)
  if (error) throw new Error(error.message)
}

export async function getTrainingGuides() {
  const { data, error } = await supabase.from('training_guides').select('*').order('sort_order')
  if (error) throw error
  return data || []
}

export async function saveTrainingGuide(guide) {
  if (guide.id) {
    const { error } = await supabase.from('training_guides').update({
      name: guide.name, description: guide.description || '',
      staff_types: guide.staff_types || [], training_ids: guide.training_ids || [],
    }).eq('id', guide.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('training_guides').insert([{
      name: guide.name, description: guide.description || '',
      staff_types: guide.staff_types || [], training_ids: guide.training_ids || [],
      is_prebuilt: guide.is_prebuilt || false, sort_order: guide.sort_order || 999,
    }])
    if (error) throw new Error(error.message)
  }
}

export async function deleteTrainingGuide(id) {
  const { error } = await supabase.from('training_guides').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const DEFAULT_HR_DOCS = [
  { doc_name: "Driver's License", sort_order: 1, category: "Identity & Background" },
  { doc_name: "Social Security Card", sort_order: 2, category: "Identity & Background" },
  { doc_name: "Resume / Application", sort_order: 3, category: "Identity & Background" },
  { doc_name: "Transcript or Diploma", sort_order: 4, category: "Identity & Background" },
  { doc_name: "References", sort_order: 5, category: "Identity & Background" },
  { doc_name: "Emergency Contact Form", sort_order: 6, category: "Identity & Background" },
  { doc_name: "TB Skin Test Results", sort_order: 7, category: "Identity & Background" },
  { doc_name: "DPS Driving Record", sort_order: 8, category: "Identity & Background" },
  { doc_name: "Background Check Consent Form", sort_order: 9, category: "Forms & Consents" },
  { doc_name: "Background Check Results", sort_order: 10, category: "Identity & Background" },
  { doc_name: "Fingerprinting Results", sort_order: 11, category: "Identity & Background" },
  { doc_name: "Drug Testing Consent Form", sort_order: 12, category: "Forms & Consents" },
  { doc_name: "Drug Test Results", sort_order: 13, category: "Identity & Background" },
  { doc_name: "Pre-Employment Screening", sort_order: 14, category: "Identity & Background" },
  { doc_name: "W-4 / I-9", sort_order: 15, category: "Forms & Consents" },
  { doc_name: "Form 2985 — Affidavit for Applicants", sort_order: 16, category: "Forms & Consents" },
  { doc_name: "Form 2919 — Pre-Employment Affidavit", sort_order: 17, category: "Forms & Consents" },
  { doc_name: "Offer Letter Signed", sort_order: 18, category: "Forms & Consents" },
]

export async function getHrDocuments(employeeId) {
  const { data, error } = await supabase.from('hr_documents').select('*')
    .eq('employee_id', employeeId).order('sort_order')
  if (error) throw error
  return data || []
}

export async function initHrDocuments(employeeId) {
  const { data: existing } = await supabase.from('hr_documents').select('id')
    .eq('employee_id', employeeId).limit(1)
  if (existing && existing.length > 0) return
  const rows = DEFAULT_HR_DOCS.map(d => ({
    employee_id: employeeId, doc_name: d.doc_name, sort_order: d.sort_order,
    category: d.category || 'Other', submitted: false, submitted_date: '', verified_by: '', notes: '',
  }))
  const { error } = await supabase.from('hr_documents').insert(rows)
  if (error) throw new Error(error.message)
}

export async function updateHrDocument(id, updates) {
  const { error } = await supabase.from('hr_documents').update({
    submitted: updates.submitted, submitted_date: updates.submitted_date || '',
    verified_by: updates.verified_by || '', notes: updates.notes || '',
  }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function addHrDocument(employeeId, docName, category = 'Other') {
  const { error } = await supabase.from('hr_documents').insert([{
    employee_id: employeeId, doc_name: docName, category: category,
    sort_order: 999, submitted: false, submitted_date: '', verified_by: '', notes: '',
  }])
  if (error) throw new Error(error.message)
}

export async function deleteHrDocument(id) {
  const { error } = await supabase.from('hr_documents').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updatePipelineStage(employeeId, stage, flags = {}) {
  const { error } = await supabase.from('employees').update({
    pipeline_stage: stage, pipeline_flags: flags,
  }).eq('id', employeeId)
  if (error) throw new Error(error.message)
}

export async function grantFullClearance(employeeId, clearedBy) {
  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase.from('employees').update({
    pipeline_stage: 4, fully_cleared_at: today, fully_cleared_by: clearedBy || '', cleared_at: today,
  }).eq('id', employeeId)
  if (error) throw new Error(error.message)
}

function generateCertId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = 'CERT-' + new Date().getFullYear() + '-'
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

export async function createGeneratedCertificate(data) {
  const certId = generateCertId()
  const empId = typeof data.employeeId === 'string' ? parseInt(data.employeeId, 10) : data.employeeId
  const { error } = await supabase.from('generated_certificates').insert([{
    cert_id: certId, employee_id: empId, training_id: data.trainingId,
    training_name: data.trainingName, employee_name: data.employeeName,
    organization: data.organization || 'Southall Heritage Youth Home',
    completion_date: data.completionDate, expiry_date: data.expiryDate || '',
    hours: data.hours || 0, cert_type: data.certType || 'training',
    session_id: data.sessionId || null, status: 'active',
  }])
  if (error) throw new Error(error.message)
  const { count } = await supabase.from('generated_certificates')
    .select('*', { count: 'exact', head: true }).eq('employee_id', empId)
  if (count !== null) {
    await supabase.from('employees').update({ cert_count: count }).eq('id', empId)
  }
  return certId
}

export async function getEmployeeCertificates(employeeId) {
  const empId = typeof employeeId === 'string' ? parseInt(employeeId, 10) : employeeId
  const { data, error } = await supabase.from('generated_certificates').select('*')
    .eq('employee_id', empId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function verifyCertificate(certId) {
  const { data, error } = await supabase.from('generated_certificates').select('*')
    .eq('cert_id', certId).single()
  if (error) return null
  return data
}

export async function updateLibraryGenerateCert(id, generateCert) {
  const { error } = await supabase.from('training_library').update({ generate_cert: generateCert }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getWriteUps(employeeId) {
  const { data, error } = await supabase.from('write_ups').select('*')
    .eq('employee_id', employeeId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getAllWriteUps() {
  const { data, error } = await supabase.from('write_ups').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveWriteUp(writeUp) {
  if (writeUp.id) {
    const { error } = await supabase.from('write_ups').update({
      tier: writeUp.tier, category: writeUp.category,
      incident_date: writeUp.incident_date, doc_date: writeUp.doc_date,
      description: writeUp.description, action_taken: writeUp.action_taken || '',
      coaching_notes: writeUp.coaching_notes || '',
      area_of_concern: writeUp.area_of_concern || '',
      improvement_plan: writeUp.improvement_plan || '', followup_date: writeUp.followup_date || '',
      created_by: writeUp.created_by || '', status: writeUp.status || 'draft',
      delivered_at: writeUp.delivered_at || '', acknowledged_at: writeUp.acknowledged_at || '',
      employee_response: writeUp.employee_response || '',
      reportable_event: writeUp.reportable_event || '',
      refused_to_sign: writeUp.refused_to_sign || false,
      refused_to_sign_at: writeUp.refused_to_sign_at || '',
      refused_to_sign_by: writeUp.refused_to_sign_by || '',
      attachment_name: writeUp.attachment_name || '',
      attachment_path: writeUp.attachment_path || '',
    }).eq('id', writeUp.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('write_ups').insert([{
      employee_id: writeUp.employee_id, tier: writeUp.tier, category: writeUp.category,
      incident_date: writeUp.incident_date, doc_date: writeUp.doc_date,
      description: writeUp.description, action_taken: writeUp.action_taken || '',
      coaching_notes: writeUp.coaching_notes || '',
      area_of_concern: writeUp.area_of_concern || '',
      improvement_plan: writeUp.improvement_plan || '', followup_date: writeUp.followup_date || '',
      created_by: writeUp.created_by || '', status: writeUp.status || 'draft',
      reportable_event: writeUp.reportable_event || '',
      refused_to_sign: writeUp.refused_to_sign || false,
      refused_to_sign_at: writeUp.refused_to_sign_at || '',
      refused_to_sign_by: writeUp.refused_to_sign_by || '',
      attachment_name: writeUp.attachment_name || '',
      attachment_path: writeUp.attachment_path || '',
    }])
    if (error) throw new Error(error.message)
  }
}

export async function deleteWriteUp(id) {
  const { error } = await supabase.from('write_ups').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function uploadWriteUpAttachment(writeUpId, employeeId, file) {
  const path = `writeups/${employeeId}/${writeUpId}/${file.name}`
  const { error: uploadError } = await supabase.storage.from('certificates').upload(path, file, { upsert: true })
  if (uploadError) throw new Error(uploadError.message)
  return { name: file.name, path }
}

export async function downloadWriteUpAttachment(storagePath, fileName) {
  const { data, error } = await supabase.storage.from('certificates').download(storagePath)
  if (error) throw new Error(error.message)
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url; a.download = fileName; a.click()
  URL.revokeObjectURL(url)
}

export async function viewWriteUpAttachment(storagePath) {
  const { data, error } = await supabase.storage.from('certificates').download(storagePath)
  if (error) throw new Error(error.message)
  const url = URL.createObjectURL(data)
  window.open(url, '_blank')
}

export async function setEmployeeActive(employeeId, isActive) {
  const { error } = await supabase.from('employees').update({ is_active: isActive }).eq('id', employeeId)
  if (error) throw new Error(error.message)
}

// ── EMPLOYEE FILES ────────────────────────────────────────────────────────────
export async function getEmployeeFiles(employeeId) {
  const { data, error } = await supabase.from('employee_files').select('*')
    .eq('employee_id', employeeId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function uploadEmployeeFile(employeeId, title, file, uploadedBy) {
  const path = `employee_files/${employeeId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('certificates').upload(path, file, { upsert: true })
  if (uploadError) throw new Error(uploadError.message)
  const { error: dbError } = await supabase.from('employee_files').insert([{
    employee_id: employeeId, title: title || file.name,
    file_name: file.name, file_path: path, uploaded_by: uploadedBy || '',
  }])
  if (dbError) throw new Error(dbError.message)
}

export async function deleteEmployeeFile(id, storagePath) {
  if (storagePath) await supabase.storage.from('certificates').remove([storagePath])
  const { error } = await supabase.from('employee_files').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function downloadEmployeeFile(storagePath, fileName) {
  const { data, error } = await supabase.storage.from('certificates').download(storagePath)
  if (error) throw new Error(error.message)
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url; a.download = fileName; a.click()
  URL.revokeObjectURL(url)
}

export async function viewEmployeeFile(storagePath) {
  const { data, error } = await supabase.storage.from('certificates').download(storagePath)
  if (error) throw new Error(error.message)
  const url = URL.createObjectURL(data)
  window.open(url, '_blank')
}

// ── AUDITOR SESSIONS ──────────────────────────────────────────────────────────
function generateAuditorCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'AUD-' + new Date().getFullYear() + '-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function createAuditorSession(data) {
  const code = generateAuditorCode()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + (data.days || 3))
  const { error } = await supabase.from('auditor_sessions').insert([{
    code,
    created_by: data.createdBy || '',
    expires_at: expiresAt.toISOString(),
    employee_ids: data.employeeIds || [],
    is_active: true,
    label: data.label || '',
  }])
  if (error) throw new Error(error.message)
  return code
}

export async function getAuditorSessions() {
  const { data, error } = await supabase.from('auditor_sessions').select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function verifyAuditorCode(code) {
  const { data, error } = await supabase.from('auditor_sessions').select('*')
    .eq('code', code.toUpperCase().trim()).eq('is_active', true).single()
  if (error || !data) return null
  if (new Date(data.expires_at) < new Date()) return null
  return data
}

export async function revokeAuditorSession(id) {
  const { error } = await supabase.from('auditor_sessions').update({ is_active: false }).eq('id', id)
  if (error) throw new Error(error.message)
}
