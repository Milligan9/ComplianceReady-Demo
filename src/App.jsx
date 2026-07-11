import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase, getLibrary, updateLibraryTraining, addLibraryTraining, deleteLibraryTraining, getEmployees, addEmployee, updateEmployee, deleteEmployee, assignTraining, saveCompletion, clearCompletion, removeTrainingFromEmployee, uploadCertificate, downloadCertificate, addBulkHours, deleteBulkHours, getInServiceSessions, getAllInServiceSessions, saveInServiceSession, deleteInServiceSession, getTrainingGuides, saveTrainingGuide, deleteTrainingGuide, getHrDocuments, initHrDocuments, updateHrDocument, addHrDocument, deleteHrDocument, updatePipelineStage, grantFullClearance, createGeneratedCertificate, getEmployeeCertificates, verifyCertificate, updateLibraryGenerateCert, getWriteUps, saveWriteUp, deleteWriteUp, setEmployeeActive, createAuditorSession, getAuditorSessions, verifyAuditorCode, revokeAuditorSession } from "./supabase.js";

// Inline updateTrainingRecord to avoid import dependency issues
async function updateTrainingRecord(employeeId, trainingId, updates) {
  const empId = parseInt(employeeId, 10);
  if (updates.dueDate !== undefined) {
    await supabase.from('employee_trainings').update({ due_date: updates.dueDate || '' }).eq('employee_id', empId).eq('training_id', trainingId);
  }
  if (updates.completed === null) {
    await supabase.from('training_completions').update({ completed: null, initials: null, initials_date: null }).eq('employee_id', empId).eq('training_id', trainingId);
  }
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e, info) { console.error("Caught error:", e, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:"100vh",background:"#f8fafc",color:"#1e293b",fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{maxWidth:400,width:"100%",background:"#ffffff",border:"1px solid #cbd5e1",borderRadius:12,padding:24,textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
            <h2 style={{margin:"0 0 8px",fontSize:18}}>Something went wrong</h2>
            <p style={{color:"#64748b",fontSize:13,margin:"0 0 20px",lineHeight:1.6}}>Your data is safe. Please refresh the page to continue.</p>
            <button style={{background:"#3b82f6",color:"white",border:"none",borderRadius:8,padding:"10px 24px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"}}
              onClick={()=>window.location.reload()}>🔄 Refresh Page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
const ADMIN_CODE = "demo2026";
const DEMO_MODE = true;
const CALENDLY_URL = "https://shorturl.at/2vqLa";
const HR_CODE = "hr2026";

// ── DEMO TOUR COMPONENT ────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    id: 1,
    icon: "🛡️",
    title: "Leadership Dashboard",
    desc: "You're in! This is what your admin sees every day — staff clearance, overdue trainings, hours, and compliance at a glance.",
    hint: "👇 Find Marcus Webb — he has overdue trainings and a Written Warning",
    color: "#3b82f6",
  },
  {
    id: 2,
    icon: "👤",
    title: "Employee Detail View",
    desc: "Click any employee card to see their full training record, clearance status, hours, certificates, and documentation.",
    hint: "👇 Look at the Write-Ups button — Devon has a coaching note on file",
    color: "#3b82f6",
  },
  {
    id: 3,
    icon: "📋",
    title: "HR Portal",
    desc: "The HR Portal has separate access for sensitive actions — write-ups, employee files, HR docs, and corrective actions.",
    hint: "Go back home → Enter code: hr2026",
    color: "#dc2626",
  },
  {
    id: 4,
    icon: "🔍",
    title: "Auditor / Licensing Access",
    desc: "Generate a temporary read-only code for DFPS inspectors. They see training records and compliance reports — nothing else.",
    hint: "Go back home → Auditor / Licensing Access",
    color: "#475569",
  },
  {
    id: 5,
    icon: "👤",
    title: "Employee Portal",
    desc: "Staff log in with just a PIN — no username needed. They see their own trainings, hours, clearance status, and write-ups.",
    hint: "Try PIN 8847 (Priya Nair) or 2291 (Marcus Webb)",
    color: "#2563eb",
  },
];

function DemoTourOverlay({step, onNext, onClose}){
  const s = TOUR_STEPS[step];
  if(!s) return null;
  const isLast = step === TOUR_STEPS.length - 1;
  return(
    <div style={{position:"fixed",bottom:20,right:20,zIndex:9999,maxWidth:320,width:"calc(100% - 40px)"}}>
      <div style={{background:"#1e293b",borderRadius:14,padding:18,boxShadow:"0 8px 40px rgba(0,0,0,0.4)",border:`2px solid ${s.color}44`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>{s.icon}</span>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:s.color,textTransform:"uppercase",letterSpacing:.5}}>Demo Tour · Step {step+1} of {TOUR_STEPS.length}</div>
              <div style={{fontSize:14,fontWeight:700,color:"#fff",marginTop:1}}>{s.title}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:18,cursor:"pointer",lineHeight:1,padding:"2px 4px"}}>✕</button>
        </div>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6,margin:"0 0 10px"}}>{s.desc}</p>
        <div style={{background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"8px 10px",marginBottom:12,fontSize:12,color:s.color,fontWeight:600}}>{s.hint}</div>
        <div style={{display:"flex",gap:8}}>
          {!isLast&&<button onClick={onNext} style={{flex:1,background:s.color,color:"#fff",border:"none",borderRadius:8,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>Next Tip →</button>}
          {isLast&&<button onClick={onClose} style={{flex:1,background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>✓ Got It!</button>}
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)",border:"none",borderRadius:8,padding:"9px 14px",fontSize:12,cursor:"pointer"}}>Skip</button>
        </div>
        {/* Progress dots */}
        <div style={{display:"flex",gap:4,justifyContent:"center",marginTop:10}}>
          {TOUR_STEPS.map((_,i)=><div key={i} style={{width:i===step?16:6,height:6,borderRadius:99,background:i===step?s.color:"rgba(255,255,255,0.2)",transition:"all 0.3s"}}/>)}
        </div>
      </div>
    </div>
  );
}

function DemoContextHelp({portal}){
  const [open,setOpen]=useState(false);
  const tips = {
    leadership:[
      {icon:"👀",text:"Click Marcus Webb — overdue trainings + Written Warning"},
      {icon:"👀",text:"Click Devon Castillo — coaching note on file, almost cleared"},
      {icon:"📊",text:"Try Group Reports to print a compliance summary"},
      {icon:"🔄",text:"Click Pipeline to see the hire-to-clearance tracker"},
      {icon:"🔍",text:"Try Auditor button to create a temporary inspector code"},
      {icon:"📚",text:"Try Library to see the full training catalog"},
    ],
    hr:[
      {icon:"📋",text:"Click Marcus Webb → Write-Ups to see his Written Warning"},
      {icon:"📋",text:"Click Devon Castillo → Write-Ups to see his Coaching Note"},
      {icon:"📁",text:"Click HR Docs on any employee to see the checklist"},
      {icon:"📁",text:"Marcus is missing 2 HR documents — Driver License + TB Test"},
      {icon:"➕",text:"Try creating a new Write-Up on any employee"},
    ],
    employee:[
      {icon:"✅",text:"Try PIN 8847 (Priya Nair) — fully cleared, all done"},
      {icon:"🚨",text:"Try PIN 2291 (Marcus Webb) — overdue trainings, has a write-up"},
      {icon:"🔶",text:"Try PIN 4429 (Devon Castillo) — provisionally cleared"},
      {icon:"📄",text:"Check the My Documents tab to see a delivered write-up"},
      {icon:"🎓",text:"Check Certificates tab — Priya has 3 generated certs"},
    ],
    auditor:[
      {icon:"👁️",text:"Click any employee to see their full training record"},
      {icon:"🖨️",text:"Use Print Record to generate a DFPS-ready report"},
      {icon:"✍️",text:"Use Print Ack to see signed acknowledgements"},
      {icon:"🎓",text:"Use Certs button to view generated certificates"},
    ],
  };
  const list = tips[portal]||[];
  return(
    <div style={{position:"fixed",bottom:20,right:20,zIndex:9000}}>
      {open&&<div style={{background:"#1e293b",borderRadius:14,padding:16,marginBottom:10,maxWidth:280,boxShadow:"0 8px 40px rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.1)"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#f59e0b",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Try These in {portal.charAt(0).toUpperCase()+portal.slice(1)}</div>
        {list.map((t,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"6px 0",borderBottom:i<list.length-1?"1px solid rgba(255,255,255,0.06)":"none"}}>
          <span style={{fontSize:13,flexShrink:0}}>{t.icon}</span>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.75)",lineHeight:1.5}}>{t.text}</span>
        </div>)}
        <a href={CALENDLY_URL} target="_blank" rel="noreferrer" style={{display:"block",marginTop:12,background:"#f59e0b",color:"#1e293b",borderRadius:8,padding:"8px 0",fontSize:12,fontWeight:700,textAlign:"center",textDecoration:"none"}}>📅 Book a Live Demo</a>
      </div>}
      <button onClick={()=>setOpen(p=>!p)} style={{width:48,height:48,borderRadius:50,background:open?"#1e293b":"#f59e0b",color:open?"#fff":"#1e293b",border:"none",fontSize:20,fontWeight:900,cursor:"pointer",boxShadow:"0 4px 16px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
        {open?"✕":"?"}
      </button>
    </div>
  );
}

// ── END DEMO COMPONENTS ────────────────────────────────────────────────────────

const PASS_SCORE = 70;
const CTYPES = ["Read and Acknowledge","Read and Quiz","Link","Certificate","Webinar"];
const ALL_TAGS = ["Pre-Service","Annual","Required for Clearance","Acknowledgement","In-Service"];
const RENEWAL_CYCLES = ["One Time","6 Months","12 Months","2 Years"];
const PIPELINE_STAGES = [
  { stage: 1, label: "Hired", color: "#64748b", bg: "#64748b18", desc: "Profile created" },
  { stage: 2, label: "HR Docs Submitted", color: "#3b82f6", bg: "#3b82f618", desc: "HR checklist complete, background cleared" },
  { stage: 3, label: "Provisionally Cleared", color: "#64748b", bg: "#64748b18", desc: "Required for Clearance complete — supervised work" },
  { stage: 4, label: "Fully Cleared", color: "#2563eb", bg: "#2563eb18", desc: "Pre-Service complete — independent, counted in ratio" },
];

const HR_DOC_CATEGORIES = ["Identity & Background", "Forms & Consents", "Other"];

const STAFF_TYPES = [
  "Caregiver",
  "Shift Supervisor",
  "Case Manager",
  "Treatment Director",
  "Program Director",
  "Licensed Child Care Administrator (LCCA)",
  "Registered Nurse",
  "Licensed Therapist",
  "Behavior Support Specialist",
  "Admissions / Placement Staff",
  "Administrative / HR Staff",
  "PRN / Part-Time Staff",
  "Contractor / Volunteer",
];

const MS_CITATIONS = [
  {group:"Core Training Citations", options:[
    "TAC §748.601 – Supervision of Children",
    "TAC §748.603 – Definition of Caregiver",
    "TAC §748.1003 – Staff Responsibilities",
    "TAC §748.1101 – Caregiver Responsibilities",
    "TAC §748.1203 – Behavior Management and Discipline",
    "TAC §748.2613 – Confidentiality of Records",
    "TAC §748.2401 – Required Records",
    "TAC §748.2405 – Accuracy of Records",
    "TAC §748.2607 – Incident Reports",
    "TAC §748.307 – Ethical Responsibilities",
    "TAC §748.1201 – Program Services",
    "TAC §748.1211 – Basic Care Requirements",
    "TAC §748.1221 – Children's Rights",
    "TAC §748.1207 – Recreation and Activities",
    "TAC §748.3351 – Service Planning",
  ]},
  {group:"DERP / Emergency / Safety", options:[
    "TAC §748.305 – Emergency Plans",
    "TAC §748.307 – Emergency Drills",
    "TAC §748.801 – Emergency Behavior Intervention (if applicable)",
  ]},
  {group:"Medication", options:[
    "TAC §748.301 – Medication Administration",
    "TAC §748.309 – Medication Records",
    "TAC §748.311 – Medication Errors",
  ]},
  {group:"Biohazards / Health & Safety", options:[
    "TAC §748.1201 – Program Services",
    "TAC §748.1101 – Caregiver Responsibilities",
    "TAC §748.1223 – Health Services",
  ]},
  {group:"Global / Applies to All Training", options:[
    "TAC §748.131 – Training Requirements",
    "TAC §748.1001 – Staff Qualifications",
    "TAC §748.101 – Responsibility for Compliance",
  ]},
];

const BADGES=[
  {id:"first",icon:"🌟",label:"First Step",desc:"Completed 1st training"},
  {id:"five",icon:"🎯",label:"On a Roll",desc:"5 trainings done"},
  {id:"ten",icon:"🔟",label:"Double Digits",desc:"10 trainings done"},
  {id:"all",icon:"🏅",label:"All Star",desc:"All trainings complete"},
  {id:"ontime",icon:"⏰",label:"Punctual",desc:"Completed before due date"},
  {id:"streak3",icon:"🔥",label:"On Fire",desc:"3 on-time completions"},
];

const today=new Date();
const todayStr=today.toISOString().split("T")[0];

// ── HOURS / CLEARANCE LOGIC ───────────────────────────────────────

function effectiveHours(libTr,empRecord){
  if(empRecord?.hours_override!==null&&empRecord?.hours_override!==undefined){
    return parseFloat(empRecord.hours_override)||0;
  }
  return parseFloat(libTr?.default_hours)||0;
}

function getYearStart(hireDate){
  try{
    const h=new Date(hireDate),t=new Date();
    let d=new Date(t.getFullYear(),h.getMonth(),h.getDate());
    if(d>t)d=new Date(t.getFullYear()-1,h.getMonth(),h.getDate());
    return d;
  }catch{return new Date(0);}
}
function getPriorYearStart(hireDate){
  try{
    const curr=getYearStart(hireDate);
    return new Date(curr.getFullYear()-1,curr.getMonth(),curr.getDate());
  }catch{return new Date(0);}
}
function getYearEnd(hireDate){
  try{
    const s=getYearStart(hireDate);
    const e=new Date(s.getFullYear()+1,s.getMonth(),s.getDate());
    e.setDate(e.getDate()-1);
    return e;
  }catch{return new Date();}
}
function getPriorYearEnd(hireDate){
  try{
    const s=getYearStart(hireDate);
    const e=new Date(s);
    e.setDate(e.getDate()-1);
    return e;
  }catch{return new Date();}
}
function formatYearLabel(start,end){
  const fmt=d=>d.toLocaleDateString("en-US",{month:"short",year:"numeric"});
  return`${fmt(start)} – ${fmt(end)}`;
}
function getCurrentYearLabel(hireDate){
  return formatYearLabel(getYearStart(hireDate),getYearEnd(hireDate));
}
function getPriorYearLabel(hireDate){
  return formatYearLabel(getPriorYearStart(hireDate),getPriorYearEnd(hireDate));
}
function isOneTime(libTr){
  return libTr?.renewal_cycle==="One Time";
}

function isYear1(hireDate){
  try{
    const diffMs=new Date()-new Date(hireDate);
    return diffMs/(1000*60*60*24*365.25)<1;
  }catch{return false;}
}

function requiredHours(emp){
  if(emp.type==="Direct Care"&&isYear1(emp.hire))return 80;
  return 40;
}

function isAcknowledgement(libTr){
  return !!(libTr?.tags?.includes("Acknowledgement"));
}
function calcCompletedHours(emp,library){
  const yearStart=getYearStart(emp.hire);
  const yearEnd=getYearEnd(emp.hire);
  let total=0;
  Object.entries(emp.trainings||{}).forEach(([id,v])=>{
    if(!v.completed)return;
    const completedDate=new Date(v.completed);
    if(completedDate<yearStart||completedDate>yearEnd)return;
    const libTr=library.find(t=>t.id===id);
    if(isAcknowledgement(libTr))return;
    total+=effectiveHours(libTr,v);
  });
  (emp.bulkHours||[]).forEach(b=>{
    if(!b.entry_date)return;
    const bd=new Date(b.entry_date);
    if(bd<yearStart||bd>yearEnd)return;
    total+=parseFloat(b.hours)||0;
  });
  return Math.round(total*10)/10;
}

function calcPriorYearHours(emp,library){
  const priorStart=getPriorYearStart(emp.hire);
  const priorEnd=getPriorYearEnd(emp.hire);
  let total=0;
  Object.entries(emp.trainings||{}).forEach(([id,v])=>{
    // Check prior year completion
    const comp=v.priorCompleted||null;
    if(!comp)return;
    const completedDate=new Date(comp);
    if(completedDate<priorStart||completedDate>priorEnd)return;
    const libTr=library.find(t=>t.id===id);
    if(isAcknowledgement(libTr))return;
    const hrs=v.priorHoursOverride!==null&&v.priorHoursOverride!==undefined
      ?parseFloat(v.priorHoursOverride)||0
      :parseFloat(libTr?.default_hours)||0;
    total+=hrs;
  });
  (emp.bulkHours||[]).forEach(b=>{
    if(!b.entry_date)return;
    const bd=new Date(b.entry_date);
    if(bd<priorStart||bd>priorEnd)return;
    total+=parseFloat(b.hours)||0;
  });
  return Math.round(total*10)/10;
}

function calcAllTimeHours(emp,library){
  let total=0;
  Object.entries(emp.trainings||{}).forEach(([id,v])=>{
    const libTr=library.find(t=>t.id===id);
    if(isAcknowledgement(libTr))return;
    if(v.completed)total+=effectiveHours(libTr,v);
    if(v.priorCompleted){
      const hrs=v.priorHoursOverride!==null&&v.priorHoursOverride!==undefined
        ?parseFloat(v.priorHoursOverride)||0
        :parseFloat(libTr?.default_hours)||0;
      total+=hrs;
    }
  });
  (emp.bulkHours||[]).forEach(b=>{total+=parseFloat(b.hours)||0;});
  return Math.round(total*10)/10;
}

// Clearance: locked once achieved, stored in emp.cleared_at
// cleared_at = date string when cleared, null = not cleared
function getClearanceStatus(emp,library){
  // If emp has a locked clearance date, they are cleared
  if(emp.cleared_at)return{cleared:true,missing:[],lockedSince:emp.cleared_at};
  // Otherwise calculate live
  const clearanceTrainings=library.filter(t=>t.tags?.includes("Required for Clearance"));
  if(clearanceTrainings.length===0)return{cleared:true,missing:[],lockedSince:null};
  const missing=clearanceTrainings.filter(t=>!emp.trainings?.[t.id]?.completed);
  return{cleared:missing.length===0,missing,lockedSince:null};
}

// Check if clearance was JUST earned (all required done, not yet locked)
function shouldLockClearance(emp,library){
  if(emp.cleared_at)return false; // already locked
  const clearanceTrainings=library.filter(t=>t.tags?.includes("Required for Clearance"));
  if(clearanceTrainings.length===0)return false;
  return clearanceTrainings.every(t=>!!emp.trainings?.[t.id]?.completed);
}

// Calculate expiry date from completion date + renewal cycle
function calcExpiryDate(completed, renewalCycle, expiryOverride){
  if(expiryOverride)return new Date(expiryOverride);
  if(!completed||!renewalCycle||renewalCycle==="One Time")return null;
  const d=new Date(completed);
  if(renewalCycle==="12 Months"){d.setFullYear(d.getFullYear()+1);}
  else if(renewalCycle==="2 Years"){d.setFullYear(d.getFullYear()+2);}
  else if(renewalCycle==="6 Months"){d.setMonth(d.getMonth()+6);}
  return d;
}

// Get days until expiry (negative = already expired)
function daysUntilExpiry(completed, renewalCycle, expiryOverride){
  const expiry=calcExpiryDate(completed,renewalCycle,expiryOverride);
  if(!expiry)return null;
  return Math.ceil((expiry-today)/86400000);
}

// Get renewal alert level for a clearance training
// returns: null | "warning" (60d) | "urgent" (30d) | "expired"
function getRenewalAlert(training, empTraining){
  if(!training?.tags?.includes("Required for Clearance"))return null;
  if(training?.renewal_cycle==="One Time")return null;
  if(training?.tags?.includes("Acknowledgement"))return null;
  const v=empTraining||{};
  if(!v.completed)return null; // not yet done, handled by clearance status
  const days=daysUntilExpiry(v.completed, training.renewal_cycle, v.expiryOverride||null);
  if(days===null)return null;
  if(days<0)return"expired";
  if(days<=30)return"urgent";
  if(days<=60)return"warning";
  return null;
}

// Get all renewal alerts for an employee
function getEmpRenewalAlerts(emp, library){
  const alerts=[];
  const clearanceTrainings=library.filter(t=>t.tags?.includes("Required for Clearance")&&t.renewal_cycle!=="One Time"&&!t.tags?.includes("Acknowledgement"));
  clearanceTrainings.forEach(t=>{
    const v=emp.trainings?.[t.id];
    if(!v?.completed)return;
    const days=daysUntilExpiry(v.completed,t.renewal_cycle,v.expiryOverride||null);
    if(days===null)return;
    const expiry=calcExpiryDate(v.completed,t.renewal_cycle,v.expiryOverride||null);
    if(days<=60){
      alerts.push({
        trainingName:t.name,
        days,
        level:days<0?"expired":days<=30?"urgent":"warning",
        expiryDate:expiry?.toISOString().split("T")[0]||"",
      });
    }
  });
  return alerts.sort((a,b)=>a.days-b.days);
}

function nextAnniv(hire){
  try{
    const h=new Date(hire),t=new Date();
    let d=new Date(t.getFullYear(),h.getMonth(),h.getDate());
    if(d<t)d=new Date(t.getFullYear()+1,h.getMonth(),h.getDate());
    return d.toISOString().split("T")[0];
  }catch{return"";}
}

function getStatus(completed,dueDate,hireDate,renewalCycle,isAck){
  try{
    // Acknowledgements: if ever completed, always complete. Full stop.
    if(isAck)return completed?"complete":"pending";
    if(completed){
      if(hireDate&&renewalCycle&&renewalCycle!=="One Time"){
        const completedDate=new Date(completed);
        if(renewalCycle==="2 Years"){
          // Valid if completed within last 2 years
          const twoYearsAgo=new Date(today);
          twoYearsAgo.setFullYear(twoYearsAgo.getFullYear()-2);
          if(completedDate<twoYearsAgo)return"pending";
        } else if(renewalCycle==="6 Months"){
          const sixMonthsAgo=new Date(today);
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth()-6);
          if(completedDate<sixMonthsAgo)return"pending";
        } else {
          // 12 Months — valid if completed within last 12 months from today
          // This handles pre-hire completions DFPS accepts within 12 months
          const twelveMonthsAgo=new Date(today);
          twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear()-1);
          if(completedDate<twelveMonthsAgo)return"pending";
        }
      }
      return"complete";
    }
    if(!dueDate)return"pending";
    const due=new Date(dueDate);
    const days=Math.ceil((due-today)/86400000);
    if(days<0)return"overdue";
    if(days<=30)return"soon";
    return"pending";
  }catch{return"pending";}
}

function daysLeft(dueDate){
  try{
    const d=Math.ceil((new Date(dueDate)-today)/86400000);
    if(d<0)return`${Math.abs(d)}d overdue`;
    if(d===0)return"Due today";
    return`${d}d left`;
  }catch{return"";}
}

function calcBadges(emp){
  const entries=Object.entries(emp.trainings||{});
  const done=entries.filter(([,v])=>v.completed).length;
  const onTime=entries.filter(([,v])=>v.completed&&v.dueDate&&new Date(v.completed)<=new Date(v.dueDate)).length;
  const out=[];
  if(done>=1)out.push("first");if(done>=5)out.push("five");if(done>=10)out.push("ten");
  if(done===entries.length&&entries.length>0)out.push("all");
  if(onTime>=1)out.push("ontime");if(onTime>=3)out.push("streak3");
  return out;
}

async function uploadWriteUpFile(employeeId, file){
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path = `writeups/${employeeId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from("writeup-attachments").upload(path, file, { upsert: true });
  if(error) throw error;
  return { path, name: file.name };
}
async function downloadWriteUpFile(path, name){
  const { data, error } = await supabase.storage.from("writeup-attachments").download(path);
  if(error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url; a.download = name || "attachment";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
async function uploadEmployeeFile(employeeId, title, file, uploadedBy){
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const filePath = `employee-files/${employeeId}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage.from("employee-files").upload(filePath, file, { upsert: true });
  if(upErr) throw upErr;
  const { error: dbErr } = await supabase.from("employee_files").insert([{
    employee_id: employeeId, title: title||file.name, file_name: file.name,
    file_path: filePath, uploaded_by: uploadedBy||"",
  }]);
  if(dbErr) throw dbErr;
}
async function getEmployeeFiles(employeeId){
  const { data, error } = await supabase.from("employee_files").select("*").eq("employee_id", employeeId).order("created_at",{ascending:false});
  if(error) throw error;
  return data||[];
}
async function downloadEmployeeFile(filePath, fileName){
  const { data, error } = await supabase.storage.from("employee-files").download(filePath);
  if(error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url; a.download = fileName || "document";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
async function deleteEmployeeFile(id, filePath){
  if(filePath){ try{ await supabase.storage.from("employee-files").remove([filePath]); }catch(e){ console.error(e); } }
  const { error } = await supabase.from("employee_files").delete().eq("id", id);
  if(error) throw error;
}

function EmployeeFilesModal({emp, onClose, toast}){
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [uploadedBy, setUploadedBy] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const {toast: localToast} = useToast();
  const notify = toast || localToast;

  useEffect(()=>{load();},[emp.id]);

  async function load(){
    setLoading(true);
    try{ setFiles(await getEmployeeFiles(emp.id)); }
    catch(e){ notify(`Could not load files: ${e.message}`,"error"); }
    setLoading(false);
  }

  async function handleUpload(){
    if(!pendingFile){ notify("Choose a file first","error"); return; }
    if(!title.trim()){ notify("Enter a title for this document","error"); return; }
    setSaving(true);
    try{
      await uploadEmployeeFile(emp.id, title.trim(), pendingFile, uploadedBy.trim());
      await load();
      setTitle(""); setUploadedBy(""); setPendingFile(null);
      if(fileRef.current) fileRef.current.value="";
      notify("Document uploaded ✓","success");
    }catch(e){ notify(`Upload failed: ${e.message}`,"error"); }
    setSaving(false);
  }

  async function handleDelete(f){
    if(!window.confirm(`Remove "${f.title}"?`)) return;
    try{ await deleteEmployeeFile(f.id, f.file_path); await load(); notify("Removed","warn"); }
    catch(e){ notify(`Could not remove: ${e.message}`,"error"); }
  }

  return<Modal title={`📁 Docs — ${emp.name}`} onClose={onClose} wide>
    <p style={{fontSize:12,color:"#64748b",margin:"0 0 14px"}}>Upload titled documents for this employee (ID copies, certifications, signed forms, etc.).</p>
    <div style={{background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:12,marginBottom:14}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
        <div style={{flex:1,minWidth:160}}><label style={S.lbl}>Document Title</label><input style={S.inp} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Driver's License, CPR Card"/></div>
        <div style={{flex:1,minWidth:160}}><label style={S.lbl}>Uploaded By</label><input style={S.inp} value={uploadedBy} onChange={e=>setUploadedBy(e.target.value)} placeholder="Your name"/></div>
      </div>
      <input type="file" ref={fileRef} style={{display:"none"}} onChange={e=>setPendingFile(e.target.files[0]||null)}/>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <button type="button" style={{...S.btn("#64748b"),fontSize:12}} onClick={()=>fileRef.current?.click()}>📎 Choose File</button>
        {pendingFile&&<span style={{fontSize:12,color:"#3b82f6"}}>✓ {pendingFile.name}</span>}
        <button style={{...S.btn("#3b82f6"),fontSize:12}} disabled={saving} onClick={handleUpload}>{saving?"⏳ Uploading…":"⬆ Upload Document"}</button>
      </div>
    </div>
    {loading&&<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>Loading…</div>}
    {!loading&&files.length===0&&<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>No documents on file yet.</div>}
    {!loading&&files.map(f=><div key={f.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"10px 12px",background:"#ffffff",borderRadius:8,border:"1px solid #cbd5e1",marginBottom:8}}>
      <div>
        <div style={{fontWeight:600,fontSize:13}}>{f.title}</div>
        <div style={{fontSize:11,color:"#64748b",marginTop:2}}>📄 {f.file_name}{f.uploaded_by?` · by ${f.uploaded_by}`:""}{f.created_at?` · ${new Date(f.created_at).toLocaleDateString()}`:""}</div>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button style={{...S.btn("#3b82f6"),padding:"4px 10px",fontSize:11}} onClick={()=>downloadEmployeeFile(f.file_path,f.file_name)}>⬇ Download</button>
        <button style={{...S.btn("#7f1d1d"),padding:"4px 8px",fontSize:11}} onClick={()=>handleDelete(f)}>✕</button>
      </div>
    </div>)}
  </Modal>;
}

async function readFileText(file){
  if(file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf")){
    try{
      const arrayBuffer=await file.arrayBuffer();
      if(!window.pdfjsLib){
        await new Promise((resolve,reject)=>{
          if(document.getElementById("pdfjs-script")){resolve();return;}
          const script=document.createElement("script");
          script.id="pdfjs-script";
          script.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          script.onload=resolve;script.onerror=reject;
          document.head.appendChild(script);
        });
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc=
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf=await window.pdfjsLib.getDocument({data:arrayBuffer}).promise;
      let text="";
      for(let i=1;i<=Math.min(pdf.numPages,30);i++){
        const page=await pdf.getPage(i);
        const content=await page.getTextContent();
        text+=content.items.map(item=>item.str||"").join(" ")+"\n";
      }
      const clean=text.replace(/\s+/g," ").trim();
      return clean.length>100?clean.slice(0,8000):`Document: ${file.name}`;
    }catch(e){return`Document: ${file.name} (PDF extraction failed — try a .txt version)`;}
  }
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=e=>res((e.target.result||"").slice(0,8000));
    r.onerror=()=>res(`Document: ${file.name}`);
    r.readAsText(file);
  });
}

function sortLibrary(library){
  const order=(tr)=>{
    const tags=tr.tags||[];
    if(tags.includes("Required for Clearance"))return 0;
    if(tags.includes("Pre-Service"))return 1;
    if(tags.includes("Annual"))return 2;
    if(tags.includes("Acknowledgement"))return 3;
    return 4;
  };
  return [...library].sort((a,b)=>order(a)-order(b));
}

const S={
  page:{minHeight:"100vh",background:"#f1f5f9",color:"#1e293b",fontFamily:"system-ui,sans-serif"},
  card:{background:"#ffffff",border:"1px solid #cbd5e1",borderRadius:12,padding:16},
  inp:{background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:"9px 12px",color:"#1e293b",fontSize:13,width:"100%",boxSizing:"border-box",outline:"none"},
  sel:{background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:"9px 12px",color:"#1e293b",fontSize:13,outline:"none"},
  lbl:{fontSize:11,color:"#64748b",display:"block",marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:.4},
  btn:(bg="#3b82f6",full)=>({padding:"8px 16px",background:bg,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,width:full?"100%":"auto"}),
};

const ST_COLOR={complete:"#2563eb",overdue:"#dc2626",soon:"#d97706",pending:"#64748b"};
const ST_BG={complete:"#dbeafe",overdue:"#fee2e2",soon:"#fef3c7",pending:"#f1f5f9"};
const ST_BDR={complete:"#93c5fd",overdue:"#fca5a5",soon:"#fcd34d",pending:"#cbd5e1"};
const ST_LBL={complete:"✓ Complete",overdue:"✗ Overdue",soon:"⚠ Due Soon",pending:"○ Pending"};
const CT_COLOR={"Read and Acknowledge":"#2563eb","Read and Quiz":"#475569","Link":"#475569","Certificate":"#475569","Webinar":"#2563eb"};
const CT_ICON={"Read and Acknowledge":"✍️","Read and Quiz":"📝","Link":"🔗","Certificate":"🏆","Webinar":"🖥️"};
const TAG_COLOR={"Pre-Service":"#64748b","Annual":"#3b82f6","Required for Clearance":"#ef4444","Acknowledgement":"#64748b","In-Service":"#64748b"};
const TAG_BG={"Pre-Service":"#64748b18","Annual":"#3b82f618","Required for Clearance":"#ef444418","Acknowledgement":"#64748b18","In-Service":"#64748b18"};
const TAG_ICON={"Pre-Service":"🔰","Annual":"📅","Required for Clearance":"🔑","Acknowledgement":"✍️","In-Service":"🏢"};

function Tag({status}){const s=ST_COLOR[status]||"#64748b",bg=ST_BG[status]||"#6b728018",b=ST_BDR[status]||"#6b728040";return<span style={{background:bg,color:s,border:`1px solid ${b}`,padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{ST_LBL[status]||"○ Pending"}</span>;}
function CTag({type}){const c=CT_COLOR[type]||"#64748b";return<span style={{background:`${c}22`,color:c,padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{CT_ICON[type]} {type}</span>;}
function TrainingTags({tags}){
  if(!tags||tags.length===0)return null;
  return<>{tags.map(tag=><span key={tag} style={{background:TAG_BG[tag]||"#94a3b818",color:TAG_COLOR[tag]||"#475569",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{TAG_ICON[tag]} {tag}</span>)}</>;
}

function Bar({val,total,h=7}){
  const pct=total?Math.round(val/total*100):0;
  const c=pct===100?"#3b82f6":pct>60?"#64748b":"#f87171";
  return<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,background:"#f8fafc",borderRadius:99,height:h,overflow:"hidden"}}><div style={{width:`${pct}%`,background:c,height:"100%",borderRadius:99}}/></div><span style={{fontSize:11,color:"#64748b",minWidth:36}}>{val}/{total}</span></div>;
}
function HoursBar({completed,required}){
  const pct=required?Math.min(Math.round(completed/required*100),100):0;
  const c=pct>=100?"#3b82f6":pct>60?"#64748b":"#f87171";
  return<div style={{display:"flex",alignItems:"center",gap:8}}>
    <div style={{flex:1,background:"#f8fafc",borderRadius:99,height:10,overflow:"hidden"}}>
      <div style={{width:`${pct}%`,background:c,height:"100%",borderRadius:99}}/>
    </div>
    <span style={{fontSize:12,color:c,fontWeight:700,minWidth:80,textAlign:"right"}}>{completed}/{required} hrs</span>
  </div>;
}
function ClearanceBadge({cleared,lockedSince}){
  return<span style={{background:cleared?"#2563eb22":"#dc262622",color:cleared?"#3b82f6":"#f87171",border:`1px solid ${cleared?"#2563eb55":"#dc262655"}`,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
    {cleared?`🔑 CLEARED${lockedSince?` since ${lockedSince}`:""}` :"⛔ NOT CLEARED"}
  </span>;
}
function NavBar({title,sub,onBack,onHome,extra}){
  return<div style={{background:"#f1f5f9",borderBottom:"1px solid #cbd5e1",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,position:"sticky",top:0,zIndex:100}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {onBack&&<button style={S.btn("#64748b")} onClick={onBack}>← Back</button>}
      {onHome&&<button style={S.btn("#3b82f6")} onClick={onHome}>🏠 Home</button>}
      <div><div style={{fontWeight:700,fontSize:15}}>{title}</div>{sub&&<div style={{fontSize:11,color:"#64748b"}}>{sub}</div>}</div>
    </div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{extra}</div>
  </div>;
}
function useToast(){
  const [list,setList]=useState([]);
  function toast(msg,type="info"){const id=Date.now();setList(p=>[...p,{id,msg,type}]);setTimeout(()=>setList(p=>p.filter(t=>t.id!==id)),4000);}
  function Toasts(){const cols={success:"#2563eb",error:"#dc2626",warn:"#475569",info:"#3b82f6"};return<div style={{position:"fixed",bottom:16,right:16,zIndex:1000,display:"flex",flexDirection:"column",gap:6,maxWidth:320}}>{list.map(t=><div key={t.id} style={{background:cols[t.type],color:"#fff",padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:600,boxShadow:"0 4px 16px #0006",wordBreak:"break-word"}}>{t.msg}</div>)}</div>;}
  return{toast,Toasts};
}
function Modal({title,onClose,children,wide}){
  return<div style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16,overflowY:"auto"}}>
    <div style={{...S.card,width:"100%",maxWidth:wide?700:460,maxHeight:"92vh",overflowY:"auto"}}>
      {title&&<h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700}}>{title}</h3>}
      {children}
      <button style={{...S.btn("#64748b",true),marginTop:12}} onClick={onClose}>Close</button>
    </div>
  </div>;
}
function Confirm({msg,onYes,onNo,yesLabel="Yes, continue",yesColor="#dc2626"}){
  return<div style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
    <div style={{...S.card,maxWidth:400,width:"100%",textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
      <p style={{fontSize:14,color:"#1e293b",margin:"0 0 20px",lineHeight:1.6}}>{msg}</p>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        <button style={S.btn(yesColor)} onClick={onYes}>{yesLabel}</button>
        <button style={S.btn("#64748b")} onClick={onNo}>Cancel</button>
      </div>
    </div>
  </div>;
}
function TagSelector({value,onChange}){
  return<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
    {ALL_TAGS.map(tag=>{
      const selected=value.includes(tag);
      return<button key={tag} type="button"
        style={{padding:"5px 12px",borderRadius:99,fontSize:12,fontWeight:700,cursor:"pointer",border:`1px solid ${selected?TAG_COLOR[tag]:"#94a3b8"}`,background:selected?TAG_BG[tag]:"transparent",color:selected?TAG_COLOR[tag]:"#64748b"}}
        onClick={()=>onChange(selected?value.filter(t=>t!==tag):[...value,tag])}>
        {TAG_ICON[tag]} {tag}
      </button>;
    })}
  </div>;
}
function Quiz({quiz,name,empId,trId,onPass,onClose}){
  const [ans,setAns]=useState({});const [done,setDone]=useState(false);const [score,setScore]=useState(0);const [saving,setSaving]=useState(false);
  async function submit(){
    let c=0;quiz.forEach((q,i)=>{if(ans[i]===q.answer)c++;});
    const pct=Math.round(c/quiz.length*100);setScore(pct);setSaving(true);
    try{await supabase.from("quiz_attempts").insert([{employee_id:empId,training_id:trId,score:pct,passed:pct>=PASS_SCORE,total_questions:quiz.length,correct_answers:c,year:new Date().getFullYear()}]);}
    catch(e){console.error("quiz save:",e);}
    setSaving(false);setDone(true);if(pct>=PASS_SCORE)setTimeout(()=>onPass(pct),2000);
  }
  const allDone=quiz.every((_,i)=>ans[i]!==undefined);
  return<div style={{position:"fixed",inset:0,background:"#000e",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16,overflowY:"auto"}}>
    <div style={{...S.card,width:"100%",maxWidth:620,maxHeight:"92vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
        <h2 style={{margin:0,fontSize:15,fontWeight:700}}>📝 {name}</h2>
        <span style={{fontSize:12,color:"#64748b"}}>{quiz.length}q · Pass {PASS_SCORE}%</span>
      </div>
      {!done?<>
        {quiz.map((q,i)=><div key={i} style={{marginBottom:12,padding:12,background:"#ffffff",borderRadius:8,border:"1px solid #cbd5e1"}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>{i+1}. {q.question}</div>
          {(q.options||[]).map((o,j)=><label key={j} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,cursor:"pointer",marginBottom:3,background:ans[i]===j?"#3b82f622":"transparent",border:ans[i]===j?"1px solid #3b82f644":"1px solid transparent",fontSize:13}}>
            <input type="radio" name={`q${i}`} checked={ans[i]===j} onChange={()=>setAns(p=>({...p,[i]:j}))} style={{accentColor:"#3b82f6"}}/>{o}
          </label>)}
        </div>)}
        <div style={{display:"flex",gap:8}}>
          <button style={S.btn(allDone?"#475569":"#94a3b8",true)} onClick={submit} disabled={!allDone||saving}>{saving?"Saving…":"Submit Quiz"}</button>
          <button style={S.btn("#64748b")} onClick={onClose}>Cancel</button>
        </div>
      </>:<div style={{textAlign:"center",padding:"28px 0"}}>
        <div style={{fontSize:52,marginBottom:10}}>{score>=PASS_SCORE?"🎉":"😔"}</div>
        <div style={{fontSize:32,fontWeight:800,color:score>=PASS_SCORE?"#3b82f6":"#f87171",marginBottom:8}}>{score}%</div>
        <div style={{fontSize:14,color:"#475569",marginBottom:14}}>{score>=PASS_SCORE?"Passed! Marking complete…":"Need "+PASS_SCORE+"% to pass."}</div>
        {score<PASS_SCORE&&<div style={{display:"flex",gap:8,justifyContent:"center"}}>
          <button style={S.btn()} onClick={()=>{setAns({});setDone(false);}}>Retake</button>
          <button style={S.btn("#64748b")} onClick={onClose}>Close</button>
        </div>}
      </div>}
    </div>
  </div>;
}

function Acknowledge({tr,empName,onDone,onClose}){
  const [initials,setInitials]=useState("");const [checked,setChecked]=useState(false);
  const ok=initials.trim().length>=1&&initials.trim().length<=5&&checked;
  return<div style={{position:"fixed",inset:0,background:"#000e",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16,overflowY:"auto"}}>
    <div style={{...S.card,width:"100%",maxWidth:580,maxHeight:"92vh",overflowY:"auto"}}>
      <h2 style={{margin:"0 0 4px",fontSize:15,fontWeight:700}}>✍️ {tr.name}</h2>
      <p style={{margin:"0 0 14px",fontSize:13,color:"#64748b"}}>Open the document, read it, then enter your initials to acknowledge.</p>
      {tr.link
        ?<a href={tr.link} target="_blank" rel="noreferrer" style={{...S.btn("#3b82f6",true),textDecoration:"none",display:"block",fontSize:13,marginBottom:14,textAlign:"center",padding:"10px 16px"}}>
            📄 Open Document ↗
          </a>
        :<div style={{background:"#f8fafc",border:"1px solid #64748b44",borderRadius:8,padding:14,marginBottom:14,fontSize:13,color:"#64748b",textAlign:"center"}}>
            ⚠️ No document link available yet. Contact your supervisor.
          </div>
      }
      <div style={{background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:14,marginBottom:12,fontSize:13,color:"#475569",lineHeight:1.7}}>
        By entering my initials, I, <strong style={{color:"#1e293b"}}>{empName}</strong>, certify I have read and agree to comply with <strong style={{color:"#1e293b"}}>{tr.name}</strong>.
      </div>
      <label style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:13,marginBottom:14,cursor:"pointer"}}>
        <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} style={{accentColor:"#3b82f6",marginTop:2,flexShrink:0}}/>
        I confirm I have read and understand this document.
      </label>
      <label style={S.lbl}>Your Initials (1–5 characters)</label>
      <input style={{...S.inp,fontSize:24,fontWeight:800,textAlign:"center",letterSpacing:8,marginBottom:10,fontFamily:"Georgia,serif"}} maxLength={5} value={initials} onChange={e=>setInitials(e.target.value.toUpperCase())} placeholder="__"/>
      <p style={{fontSize:11,color:"#475569",margin:"0 0 12px"}}>Date: {new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</p>
      <div style={{display:"flex",gap:8}}>
        <button style={S.btn(ok?"#2563eb":"#94a3b8",true)} disabled={!ok} onClick={()=>onDone(initials.trim())}>✍️ Sign & Acknowledge</button>
        <button style={S.btn("#64748b")} onClick={onClose}>Cancel</button>
      </div>
    </div>
  </div>;
}

function ReadAndQuiz({tr,onTakeQuiz,onClose}){
  const hasQuiz=Array.isArray(tr.quiz)&&tr.quiz.length>0;
  return<div style={{position:"fixed",inset:0,background:"#000e",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16,overflowY:"auto"}}>
    <div style={{...S.card,width:"100%",maxWidth:640,maxHeight:"92vh",overflowY:"auto"}}>
      <h2 style={{margin:"0 0 4px",fontSize:15,fontWeight:700}}>📝 {tr.name}</h2>
      <p style={{margin:"0 0 14px",fontSize:13,color:"#64748b"}}>Open the training material, read it, then take the quiz below.</p>
      {tr.link
        ?<a href={tr.link} target="_blank" rel="noreferrer" style={{...S.btn("#3b82f6",true),textDecoration:"none",display:"block",fontSize:13,marginBottom:14,textAlign:"center",padding:"10px 16px"}}>
            📄 Open Training Material ↗
          </a>
        :<div style={{background:"#f8fafc",border:"1px solid #64748b44",borderRadius:8,padding:14,marginBottom:14,fontSize:13,color:"#64748b",textAlign:"center"}}>
            ⚠️ No training material link available yet. Contact your supervisor.
          </div>
      }
      <div style={{display:"flex",gap:8,marginTop:8}}>
        {hasQuiz?<button style={S.btn("#475569",true)} onClick={onTakeQuiz}>📝 Take Quiz</button>:<div style={{...S.btn("#64748b",true),textAlign:"center",cursor:"default",opacity:.7}}>Quiz not yet available.</div>}
        <button style={S.btn("#64748b")} onClick={onClose}>Close</button>
      </div>
    </div>
  </div>;
}

function QuizHistory({empId,trId,trName,onClose}){
  const [attempts,setAttempts]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{supabase.from("quiz_attempts").select("*").eq("employee_id",empId).eq("training_id",trId).order("attempted_at",{ascending:false}).then(({data})=>{setAttempts(data||[]);setLoading(false);});},[empId,trId]);
  return<Modal title={`📊 Quiz History — ${trName}`} onClose={onClose} wide>
    {loading?<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>Loading…</div>
      :attempts.length===0?<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>No quiz attempts yet.</div>
      :<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12,fontSize:11,color:"#64748b",fontWeight:700,padding:"0 4px"}}><div>DATE</div><div>SCORE</div><div>RESULT</div><div>QUESTIONS</div></div>
        {attempts.map((a,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,padding:"10px 4px",borderBottom:"1px solid #cbd5e1",fontSize:13}}>
          <div style={{color:"#475569"}}>{new Date(a.attempted_at).toLocaleDateString()}</div>
          <div style={{fontWeight:700,color:a.passed?"#3b82f6":"#f87171"}}>{a.score}%</div>
          <div><span style={{background:a.passed?"#2563eb22":"#dc262622",color:a.passed?"#3b82f6":"#f87171",padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:700}}>{a.passed?"✓ Passed":"✗ Failed"}</span></div>
          <div style={{color:"#475569"}}>{a.correct_answers}/{a.total_questions}</div>
        </div>)}
      </div>}
  </Modal>;
}

function Leaderboard({employees,library,selfId,onClose}){
  const ranked=useMemo(()=>[...employees].map(e=>{
    const entries=Object.entries(e.trainings||{});
    const done=entries.filter(([,v])=>v.completed).length;
    const onTime=entries.filter(([,v])=>v.completed&&v.dueDate&&new Date(v.completed)<=new Date(v.dueDate)).length;
    const hrs=calcCompletedHours(e,library);
    return{...e,done,total:entries.length,onTime,hrs,badges:calcBadges(e)};
  }).sort((a,b)=>b.hrs-a.hrs||b.done-a.done),[employees,library]);
  const medals=["🥇","🥈","🥉"];
  return<Modal title="🏆 Leaderboard" onClose={onClose} wide>
    {ranked.map((e,i)=>{
      const me=e.id===selfId;const req=requiredHours(e);
      return<div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:me?"#3b82f615":"#f8fafc",borderRadius:8,border:me?"1px solid #3b82f644":"1px solid #ffffff",marginBottom:6}}>
        <div style={{width:28,textAlign:"center",fontSize:18}}>{i<3?medals[i]:<span style={{fontSize:12,color:"#64748b",fontWeight:700}}>#{i+1}</span>}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:13,color:me?"#60a5fa":"#1e293b"}}>{e.name}{me&&" (you)"}</div>
          <div style={{fontSize:11,color:"#64748b"}}>{e.pos}</div>
          <div style={{marginTop:3}}><Bar val={e.done} total={e.total}/></div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:15,fontWeight:800,color:e.hrs>=req?"#3b82f6":"#1e293b"}}>{e.hrs}h</div>
          <div style={{fontSize:10,color:"#64748b"}}>of {req} required</div>
          <div style={{fontSize:12}}>{e.badges.map(b=>BADGES.find(x=>x.id===b)?.icon||"").join("")}</div>
        </div>
      </div>;
    })}
  </Modal>;
}

// ── SHARED: Collapsible Section ─────────────────────────────────────────────
function CollapsibleSection({label,color,bg,done,total,hours,overdue,dueSoon,isEmpty,children,defaultOpen=false}){
  const [open,setOpen]=useState(defaultOpen);
  const hasUrgent=overdue>0||dueSoon>0;
  const empty=isEmpty||total===0;
  return<div style={{marginBottom:10}}>
    <div onClick={()=>!empty&&setOpen(p=>!p)}
      style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        background:empty?"#ffffff":bg,
        border:`1px solid ${empty?"#94a3b8":color+"33"}`,
        borderRadius:open&&!empty?"10px 10px 0 0":"10px",
        padding:"10px 14px",cursor:empty?"default":"pointer",
        opacity:empty?0.45:1,transition:"all 0.15s"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
        <span style={{fontSize:14,color:empty?"#475569":"#475569",transition:"transform 0.2s",
          display:"inline-block",transform:open&&!empty?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,fontSize:13,color:empty?"#475569":color}}>{label}</span>
            {hasUrgent&&!empty&&<span style={{display:"flex",gap:4}}>
              {overdue>0&&<span style={{background:"#dc262622",color:"#f87171",border:"1px solid #dc262644",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700}}>🚨 {overdue} Overdue</span>}
              {dueSoon>0&&<span style={{background:"#47556922",color:"#64748b",border:"1px solid #47556944",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700}}>⚠️ {dueSoon} Due Soon</span>}
            </span>}
            {empty&&<span style={{fontSize:10,color:"#475569",fontStyle:"italic"}}>None assigned</span>}
          </div>
          {!empty&&<div style={{fontSize:11,color:"#475569",marginTop:2}}>
            {done}/{total} complete{hours>0?` · ${Math.round(hours*10)/10}h earned`:""}
          </div>}
        </div>
        {!empty&&<div style={{minWidth:140,marginLeft:8}}><Bar val={done} total={total} h={6}/></div>}
      </div>
    </div>
    {open&&!empty&&<div style={{background:"#ffffff",border:`1px solid ${color}22`,borderTop:"none",
      borderRadius:"0 0 10px 10px",padding:"10px 10px 4px"}}>
      {children}
    </div>}
  </div>;
}

// ── SHARED: Filter Bar ───────────────────────────────────────────────────────
function FilterBar({search,onSearch,tagFilter,onTagFilter,statusFilter,onStatusFilter,sortMode,onSort,showCategory=false,categoryFilter,onCategoryFilter,resultCount,totalCount,onClear,simplified=false}){
  const hasFilters=search||tagFilter!=="All"||statusFilter!=="All"||(showCategory&&categoryFilter!=="All");
  const tagOpts=["All","✍️ Acknowledgements","🔑 Required for Clearance","🔰 Pre-Service","📅 Annual","📋 Other"];
  const statusOpts=simplified
    ?["All","✓ Complete","○ Pending","⚡ Needs Attention"]
    :["All","✓ Complete","○ Pending","⚠ Due Soon","✗ Overdue"];
  const sortOpts=simplified
    ?["Default","A–Z","Status"]
    :["Default","A–Z","Z–A","Due Date","Recently Completed","Hours"];
  const catOpts=["All","📋 Training","✍️ Acknowledgment"];
  const selStyle={...S.sel,fontSize:12,padding:"7px 10px",minWidth:80};
  return<div style={{marginBottom:12}}>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{flex:1,minWidth:160,position:"relative"}}>
        <input style={{...S.inp,paddingLeft:30,fontSize:12}} placeholder="Search trainings…" value={search} onChange={e=>onSearch(e.target.value)}/>
        <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#64748b",fontSize:13}}>🔍</span>
        {search&&<button style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:14}} onClick={()=>onSearch("")}>✕</button>}
      </div>
      <select style={selStyle} value={tagFilter} onChange={e=>onTagFilter(e.target.value)}>
        {tagOpts.map(o=><option key={o}>{o}</option>)}
      </select>
      {showCategory&&<select style={selStyle} value={categoryFilter} onChange={e=>onCategoryFilter(e.target.value)}>
        {catOpts.map(o=><option key={o}>{o}</option>)}
      </select>}
      <select style={selStyle} value={statusFilter} onChange={e=>onStatusFilter(e.target.value)}>
        {statusOpts.map(o=><option key={o}>{o}</option>)}
      </select>
      <select style={selStyle} value={sortMode} onChange={e=>onSort(e.target.value)}>
        {sortOpts.map(o=><option key={o}>{o}</option>)}
      </select>
      {hasFilters&&<button style={{...S.btn("#64748b"),padding:"7px 10px",fontSize:11,whiteSpace:"nowrap"}} onClick={onClear}>✕ Clear</button>}
    </div>
    {hasFilters&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6,alignItems:"center"}}>
      <span style={{fontSize:10,color:"#64748b"}}>Showing {resultCount}/{totalCount} trainings</span>
      {search&&<span style={{background:"#3b82f622",color:"#60a5fa",border:"1px solid #3b82f644",padding:"1px 8px",borderRadius:99,fontSize:10,fontWeight:700,cursor:"pointer"}} onClick={()=>onSearch("")}>🔍 "{search}" ✕</span>}
      {tagFilter!=="All"&&<span style={{background:"#94a3b822",color:"#475569",border:"1px solid #cbd5e1",padding:"1px 8px",borderRadius:99,fontSize:10,fontWeight:700,cursor:"pointer"}} onClick={()=>onTagFilter("All")}>{tagFilter} ✕</span>}
      {showCategory&&categoryFilter!=="All"&&<span style={{background:"#94a3b822",color:"#475569",border:"1px solid #cbd5e1",padding:"1px 8px",borderRadius:99,fontSize:10,fontWeight:700,cursor:"pointer"}} onClick={()=>onCategoryFilter("All")}>{categoryFilter} ✕</span>}
      {statusFilter!=="All"&&<span style={{background:"#94a3b822",color:"#475569",border:"1px solid #cbd5e1",padding:"1px 8px",borderRadius:99,fontSize:10,fontWeight:700,cursor:"pointer"}} onClick={()=>onStatusFilter("All")}>{statusFilter} ✕</span>}
    </div>}
  </div>;
}


// ── IN-SERVICE SESSION MODAL ─────────────────────────────────────────────────
function InServiceSessionModal({tr,employees,onClose,onSaved}){
  const [date,setDate]=useState(todayStr);
  const [startTime,setStartTime]=useState("");
  const [endTime,setEndTime]=useState("");
  const [facilitator,setFacilitator]=useState("");
  const [facilitatorTitle,setFacilitatorTitle]=useState("");
  const [location,setLocation]=useState("Online");
  const [ceHrs,setCeHrs]=useState(String(tr.default_hours||""));
  const [curriculum,setCurriculum]=useState("");
  const [citation,setCitation]=useState("");
  const [customCitation,setCustomCitation]=useState("");
  const [selectedEmps,setSelectedEmps]=useState([]);
  const [saving,setSaving]=useState(false);
  const [sessions,setSessions]=useState([]);
  const [view,setView]=useState("log"); // "log" | "history" | "print"
  const {toast,Toasts}=useToast();

  useEffect(()=>{
    getInServiceSessions(tr.id).then(setSessions).catch(()=>{});
  },[tr.id]);

  async function handleSave(){
    if(!date){toast("Date required","error");return;}
    if(selectedEmps.length===0){toast("Select at least one attendee","error");return;}
    setSaving(true);
    try{
      await saveInServiceSession({
        trainingId:tr.id,date,startTime,endTime,
        facilitator,facilitatorTitle,location,
        ceHrs,curriculum,
        citation:citation==="Other"?customCitation:citation,
      },selectedEmps);
      toast(`✓ Session logged — ${selectedEmps.length} attendees`,"success");
      // Generate certificates if enabled
      if(tr.generate_cert){
        let certCount=0;
        for(const eid of selectedEmps){
          const emp=employees.find(e=>e.id===eid);
          if(!emp)continue;
          try{
            await createGeneratedCertificate({
              employeeId:eid,trainingId:tr.id,
              trainingName:tr.name,employeeName:emp.name,
              completionDate:date,expiryDate:"",
              hours:parseFloat(ceHrs)||0,certType:"inservice",
              sessionId:null,
            });
            certCount++;
          }catch(e){console.error("inservice cert:",e);}
        }
        if(certCount>0)toast(`🎓 ${certCount} certificate(s) generated`,"success");
      }
      const updated=await getInServiceSessions(tr.id);
      setSessions(updated);
      setView("history");
      if(onSaved)onSaved();
    }catch(e){toast(`Error: ${e.message}`,"error");}
    setSaving(false);
  }

  function printSheet(session){
    const attendees=employees.filter(e=>session.attendeeIds.includes(String(e.id)));
    const rows=attendees.length>0
      ?attendees.map((e,i)=>`<tr><td style="text-align:center">${i+1}</td><td>${e.name}</td><td>${e.pos}</td><td></td><td style="text-align:center">${session.start_time}</td><td style="text-align:center">${session.end_time}</td><td style="text-align:center">${session.ce_hours?session.ce_hours+"h":""}</td></tr>`).join("")
      :Array(20).fill(null).map((_,i)=>`<tr><td style="text-align:center">${i+1}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
    const html=`<!DOCTYPE html><html><head><title>Sign-In Sheet</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px;}h2{text-align:center;font-size:16px;margin:0 0 4px;}h3{text-align:center;font-size:12px;font-weight:normal;margin:0 0 16px;}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}.field{border-bottom:1px solid #000;padding:4px 0;margin-bottom:6px;}.fl{font-size:9px;color:#555;font-weight:bold;text-transform:uppercase;}.fv{font-size:11px;min-height:16px;}table{width:100%;border-collapse:collapse;margin-top:12px;}th{background:#1e293b;color:white;padding:6px 4px;text-align:left;font-size:10px;border:1px solid #000;}td{padding:10px 4px;border:1px solid #ccc;font-size:11px;min-height:28px;}.notice{font-size:9px;color:#333;border:1px solid #ccc;padding:8px;margin:10px 0;background:#f9f9f9;}.sig{display:flex;gap:40px;margin-top:40px;}.sl{flex:1;border-top:1px solid #000;padding-top:4px;font-size:9px;}@media print{@page{margin:0.5in;}}</style>
    </head><body>
    <h2>Staff In-Service Training Sign-In Sheet</h2>
    <h3>Southall Heritage Youth Home | General Residential Operation | TAC §748.131</h3>
    <div class="grid">
      <div>
        <div class="field"><div class="fl">Training / Meeting Topic</div><div class="fv">${tr.name}</div></div>
        <div class="field"><div class="fl">Trainer / Facilitator</div><div class="fv">${session.facilitator}</div></div>
        <div class="field"><div class="fl">Facilitator Title</div><div class="fv">${session.facilitator_title}</div></div>
        <div class="field"><div class="fl">Organization</div><div class="fv">Southall Heritage Youth Home</div></div>
      </div>
      <div>
        <div class="field"><div class="fl">Date</div><div class="fv">${new Date(session.session_date+"T12:00:00").toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</div></div>
        <div class="field"><div class="fl">Start Time</div><div class="fv">${session.start_time}</div></div>
        <div class="field"><div class="fl">End Time</div><div class="fv">${session.end_time}</div></div>
        <div class="field"><div class="fl">Location</div><div class="fv">${session.location}</div></div>
        <div class="field"><div class="fl">CE Hours</div><div class="fv">${session.ce_hours?session.ce_hours+" hour(s)":""}</div></div>
      </div>
    </div>
    <div class="field"><div class="fl">Curriculum / Learning Objectives</div><div class="fv" style="min-height:40px">${session.curriculum}</div></div>
    ${session.citation?`<div class="field"><div class="fl">MS / Contract Citation</div><div class="fv">${session.citation}</div></div>`:""}
    <div class="notice"><strong>ATTENDANCE INSTRUCTIONS:</strong> Each attendee must print their full name legibly, write their job title or role, and sign in their own handwriting. Record Time In and Time Out. This form is a legal compliance document.</div>
    <table><thead><tr><th style="width:4%">#</th><th style="width:28%">Employee Full Name</th><th style="width:18%">Job Title / Role</th><th style="width:22%">Signature</th><th style="width:9%">Time In</th><th style="width:9%">Time Out</th><th style="width:10%">CE Hrs</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="sig"><div class="sl">Facilitator Signature &amp; Date</div><div class="sl">Supervisor Signature &amp; Date</div><div class="sl">Title &amp; Date</div></div>
    </body></html>`;
    const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();
  }

  return<Modal title={`🏢 ${tr.name}`} onClose={onClose} wide>
    <Toasts/>
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <button style={S.btn(view==="log"?"#2563eb":"#94a3b8")} onClick={()=>{setView("log");setDate(todayStr);setSelectedEmps([]);setSaving(false);}}>+ Log Session</button>
      <button style={S.btn(view==="history"?"#3b82f6":"#94a3b8")} onClick={()=>setView("history")}>📋 Sessions ({sessions.length})</button>
    </div>

    {view==="log"&&<div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={S.lbl}>Date *</label><input type="date" style={S.inp} value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div><label style={S.lbl}>CE Hours</label><input type="number" min="0" step="0.5" style={S.inp} value={ceHrs} onChange={e=>setCeHrs(e.target.value)}/></div>
        <div><label style={S.lbl}>Start Time</label><input type="time" style={S.inp} value={startTime} onChange={e=>setStartTime(e.target.value)}/></div>
        <div><label style={S.lbl}>End Time</label><input type="time" style={S.inp} value={endTime} onChange={e=>setEndTime(e.target.value)}/></div>
        <div><label style={S.lbl}>Facilitator Name</label><input style={S.inp} value={facilitator} onChange={e=>setFacilitator(e.target.value)} placeholder="Name"/></div>
        <div><label style={S.lbl}>Facilitator Title</label><input style={S.inp} value={facilitatorTitle} onChange={e=>setFacilitatorTitle(e.target.value)} placeholder="Title"/></div>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Location</label><input style={S.inp} value={location} onChange={e=>setLocation(e.target.value)}/></div>
      </div>
      <div style={{marginBottom:10}}><label style={S.lbl}>Curriculum / Learning Objectives</label><textarea style={{...S.inp,minHeight:60,resize:"vertical"}} value={curriculum} onChange={e=>setCurriculum(e.target.value)} placeholder="What was covered in this session…"/></div>
      <div style={{marginBottom:12}}>
        <label style={S.lbl}>MS / Contract Citation</label>
        <select style={{...S.sel,width:"100%",marginBottom:6}} value={citation} onChange={e=>setCitation(e.target.value)}>
          <option value="">— Select citation —</option>
          {MS_CITATIONS.map(g=><optgroup key={g.group} label={g.group}>{g.options.map(o=><option key={o} value={o}>{o}</option>)}</optgroup>)}
          <option value="Other">Other (write in below)</option>
        </select>
        {citation==="Other"&&<input style={S.inp} value={customCitation} onChange={e=>setCustomCitation(e.target.value)} placeholder="Enter custom citation…"/>}
      </div>
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <label style={S.lbl}>Who Attended? ({selectedEmps.length} selected)</label>
          <div style={{display:"flex",gap:6}}>
            <button style={{...S.btn("#64748b"),padding:"3px 8px",fontSize:11}} onClick={()=>setSelectedEmps(employees.map(e=>e.id))}>All</button>
            <button style={{...S.btn("#64748b"),padding:"3px 8px",fontSize:11}} onClick={()=>setSelectedEmps([])}>None</button>
          </div>
        </div>
        <div style={{maxHeight:220,overflowY:"auto",background:"#f8fafc",borderRadius:8,padding:8,border:"1px solid #cbd5e1"}}>
          {employees.map(e=><label key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 4px",borderBottom:"1px solid #ffffff",cursor:"pointer",fontSize:12}}>
            <input type="checkbox" checked={selectedEmps.includes(e.id)} onChange={ev=>setSelectedEmps(p=>ev.target.checked?[...p,e.id]:p.filter(x=>x!==e.id))} style={{accentColor:"#3b82f6"}}/>
            <span style={{fontWeight:600}}>{e.name}</span>
            <span style={{color:"#64748b",fontSize:11}}>{e.pos}</span>
          </label>)}
        </div>
      </div>
      <button style={S.btn("#2563eb",true)} disabled={saving} onClick={handleSave}>{saving?"⏳ Saving…":"💾 Log This Session"}</button>
    </div>}

    {view==="history"&&<div>
      {sessions.length===0&&<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>No sessions logged yet. Click "+ Log Session" to add one.</div>}
      {sessions.map(s=>{
        const attendees=employees.filter(e=>s.attendeeIds.includes(String(e.id)));
        return<div key={s.id} style={{background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:12,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6,marginBottom:8}}>
            <div>
              <div style={{fontWeight:700,fontSize:13}}>{s.session_date} {s.start_time&&`· ${s.start_time}`}{s.end_time&&`–${s.end_time}`}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{s.facilitator&&`${s.facilitator} · `}{s.ce_hours?`${s.ce_hours}h · `:""}📍 {s.location}</div>
              <div style={{fontSize:11,color:"#3b82f6",marginTop:2}}>✓ {attendees.length} attended</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button style={{...S.btn("#3b82f6"),padding:"4px 10px",fontSize:11}} onClick={()=>printSheet(s)}>🖨️ Print</button>
              <button style={{...S.btn("#7f1d1d"),padding:"4px 10px",fontSize:11}} onClick={async()=>{
                if(!window.confirm("Delete this session?"))return;
                await deleteInServiceSession(s.id);
                setSessions(p=>p.filter(x=>x.id!==s.id));
                toast("Session deleted","warn");
              }}>✕</button>
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {attendees.map(e=><span key={e.id} style={{background:"#2563eb22",color:"#3b82f6",border:"1px solid #2563eb44",padding:"2px 8px",borderRadius:99,fontSize:11}}>{e.name}</span>)}
          </div>
        </div>;
      })}
    </div>}
  </Modal>;
}


// ── CERTIFICATE HELPERS ───────────────────────────────────────────────────────
function generateCertHTML(cert) {
  return `<!DOCTYPE html><html><head><title>Certificate — ${cert.training_name}</title>
  <style>
    body{font-family:Georgia,serif;background:#f8fafc;margin:0;padding:40px;display:flex;justify-content:center;}
    .cert{background:white;border:3px solid #1e293b;border-radius:12px;padding:50px 60px;max-width:680px;width:100%;text-align:center;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.12);}
    .cert::before{content:"";position:absolute;inset:8px;border:1px solid #e2e8f0;border-radius:8px;pointer-events:none;}
    .org{font-size:13px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px;}
    .title{font-size:38px;color:#1e293b;font-weight:bold;margin-bottom:8px;}
    .subtitle{font-size:14px;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:36px;}
    .presented{font-size:13px;color:#94a3b8;margin-bottom:8px;}
    .name{font-size:32px;color:#1e293b;border-bottom:2px solid #1e293b;display:inline-block;padding:0 24px 6px;margin-bottom:28px;}
    .for{font-size:13px;color:#94a3b8;margin-bottom:8px;}
    .training{font-size:20px;color:#1e293b;font-weight:bold;margin-bottom:28px;line-height:1.4;}
    .meta{display:flex;justify-content:center;gap:40px;margin-bottom:32px;flex-wrap:wrap;}
    .meta-item{text-align:center;}
    .meta-label{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;}
    .meta-value{font-size:14px;color:#1e293b;font-weight:bold;margin-top:2px;}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;}
    .cert-id{text-align:left;}
    .cert-id-label{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;}
    .cert-id-value{font-size:11px;color:#1e293b;font-weight:bold;font-family:monospace;}
    .verify{font-size:9px;color:#94a3b8;margin-top:2px;}

    .brand{font-size:9px;color:#94a3b8;text-align:center;margin-top:16px;letter-spacing:1px;}
    @media print{body{padding:0;}@page{margin:0.3in;}}
  </style></head><body>
  <div class="cert">
    <div class="org">Southall Heritage Youth Home · General Residential Operation</div>
    <div class="title">Certificate</div>
    <div class="subtitle">of Completion</div>
    <div class="presented">This certifies that</div>
    <div class="name">${cert.employee_name}</div>
    <div class="for">has successfully completed</div>
    <div class="training">${cert.training_name}</div>
    <div class="meta">
      <div class="meta-item"><div class="meta-label">Date Completed</div><div class="meta-value">${new Date(cert.completion_date+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div></div>
      ${cert.hours>0?`<div class="meta-item"><div class="meta-label">Credit Hours</div><div class="meta-value">${cert.hours}h</div></div>`:''}
      ${cert.expiry_date?`<div class="meta-item"><div class="meta-label">Valid Through</div><div class="meta-value">${new Date(cert.expiry_date+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div></div>`:''}
    </div>
    <div class="footer">
      <div class="cert-id">
        <div class="cert-id-label">Certificate ID</div>
        <div class="cert-id-value">${cert.cert_id}</div>
      </div>
    </div>
    <div class="brand">COMPLIANCEREADY · SOUTHALL HERITAGE YOUTH HOME</div>
  </div>
  </body></html>`;
}

function printCertificate(cert) {
  const html = generateCertHTML(cert);
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

// ── VERIFY SCREEN ─────────────────────────────────────────────────────────────
function VerifyScreen({certId, onClose}){
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(()=>{
    verifyCertificate(certId).then(data=>{
      if(data) setCert(data);
      else setNotFound(true);
      setLoading(false);
    }).catch(()=>{setNotFound(true);setLoading(false);});
  },[certId]);

  const isExpired = cert?.expiry_date && new Date(cert.expiry_date) < new Date();

  return <div style={{minHeight:"100vh",background:"#f8fafc",color:"#1e293b",fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{maxWidth:480,width:"100%",background:"#ffffff",border:"1px solid #cbd5e1",borderRadius:12,padding:28,textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:8}}>🎓</div>
      <div style={{fontWeight:700,fontSize:11,color:"#64748b",letterSpacing:2,textTransform:"uppercase",marginBottom:16}}>ComplianceReady Certificate Verification</div>
      {loading&&<div style={{color:"#64748b",padding:"20px 0"}}>Verifying…</div>}
      {notFound&&<>
        <div style={{fontSize:48,marginBottom:8}}>❌</div>
        <div style={{fontWeight:700,fontSize:16,color:"#f87171",marginBottom:8}}>Certificate Not Found</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Certificate ID <strong>{certId}</strong> could not be verified.</div>
      </>}
      {cert&&<>
        <div style={{background:isExpired?"#dc262618":"#2563eb18",border:`1px solid ${isExpired?"#dc262644":"#2563eb44"}`,borderRadius:8,padding:"12px 16px",marginBottom:16}}>
          <div style={{fontSize:22,fontWeight:800,color:isExpired?"#f87171":"#3b82f6",marginBottom:4}}>{isExpired?"⚠️ Expired":"✅ Valid Certificate"}</div>
          <div style={{fontSize:12,color:isExpired?"#f87171":"#3b82f6"}}>{isExpired?"This certification has expired":"This certification is current and valid"}</div>
        </div>
        <div style={{textAlign:"left",background:"#f8fafc",borderRadius:8,padding:14,marginBottom:16}}>
          {[
            ["Certificate Holder", cert.employee_name],
            ["Training", cert.training_name],
            ["Organization", cert.organization],
            ["Completed", new Date(cert.completion_date+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})],
            cert.expiry_date?["Valid Through", new Date(cert.expiry_date+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})]:null,
            cert.hours>0?["Credit Hours", cert.hours+"h"]:null,
            ["Certificate ID", cert.cert_id],
            ["Status", cert.status==="active"?"Active":"Revoked"],
          ].filter(Boolean).map(([label,value])=><div key={label} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #ffffff",fontSize:13}}>
            <span style={{color:"#64748b",fontWeight:600}}>{label}</span>
            <span style={{color:"#1e293b",fontWeight:label==="Certificate ID"?700:400,fontFamily:label==="Certificate ID"?"monospace":"inherit"}}>{value}</span>
          </div>)}
        </div>
        <div style={{fontSize:11,color:"#475569"}}>Verified by ComplianceReady · Southall Heritage Youth Home</div>
      </>}
      {onClose&&<button style={{...S.btn("#64748b",true),marginTop:16}} onClick={onClose}>← Back to App</button>}
    </div>
  </div>;
}


// ── EMPLOYEE MY DOCUMENTS TAB ────────────────────────────────────────────────

// PASTE THIS ENTIRE BLOCK BEFORE THE EmpMyDocuments function
// in your App.jsx
// ═══════════════════════════════════════════════════════════════════

// ── AUDITOR EMPLOYEE DETAIL ───────────────────────────────────────────────────
function AuditorEmpDetail({emp, library, onBack, printIndividualReport, printAcknowledgementReport, session}){
  const [genCerts, setGenCerts] = useState([]);
  const [certsLoaded, setCertsLoaded] = useState(false);
  const [showCerts, setShowCerts] = useState(false);
  const {toast, Toasts} = useToast();

  const {cleared, lockedSince, missing} = getClearanceStatus(emp, library);
  const hrs = calcCompletedHours(emp, library);
  const req = requiredHours(emp);
  const assignedIds = Object.keys(emp.trainings||{}).sort((a,b)=>{
    const la=library.find(t=>t.id===a)||{};const lb=library.find(t=>t.id===b)||{};
    const ord=t=>{const tgs=t.tags||[];if(tgs.includes('Acknowledgement'))return 0;if(tgs.includes('Required for Clearance'))return 1;if(tgs.includes('Pre-Service'))return 2;if(tgs.includes('Annual'))return 3;return 4;};
    return ord(la)-ord(lb);
  });
  const groups=[
    {label:"✍️ Acknowledgements",key:"Acknowledgement",color:"#64748b",bg:"#64748b15"},
    {label:"🔑 Required for Clearance",key:"Required for Clearance",color:"#ef4444",bg:"#ef444415"},
    {label:"🔰 Pre-Service",key:"Pre-Service",color:"#64748b",bg:"#64748b15"},
    {label:"📅 Annual",key:"Annual",color:"#3b82f6",bg:"#3b82f615"},
    {label:"📋 Other",key:"Other",color:"#64748b",bg:"#64748b15"},
  ];
  function getGKey(id){const tags=library.find(t=>t.id===id)?.tags||[];if(tags.includes('Acknowledgement'))return'Acknowledgement';if(tags.includes('Required for Clearance'))return'Required for Clearance';if(tags.includes('Pre-Service'))return'Pre-Service';if(tags.includes('Annual'))return'Annual';return'Other';}
  const grouped={};groups.forEach(g=>{grouped[g.key]=[];});
  assignedIds.forEach(id=>grouped[getGKey(id)].push(id));

  async function loadCerts(){
    if(certsLoaded){setShowCerts(true);return;}
    try{
      const data = await getEmployeeCertificates(emp.id);
      setGenCerts(data); setCertsLoaded(true); setShowCerts(true);
    }catch(e){toast('Could not load certificates','error');}
  }

  return <>
    <Toasts/>
    <NavBar title={emp.name} sub={`${emp.pos} · ${emp.type} · READ ONLY`} onBack={onBack}
      extra={<>
        <button style={S.btn('#3b82f6')} onClick={()=>printIndividualReport(emp)}>🖨️ Print Record</button>
        <button style={S.btn('#64748b')} onClick={()=>printAcknowledgementReport(emp)}>✍️ Print Ack</button>
        <button style={S.btn('#64748b')} onClick={loadCerts}>🎓 Certs ({genCerts.length||'…'})</button>
        <span style={{background:'#dbeafe',color:'#1d4ed8',padding:'4px 10px',borderRadius:8,fontSize:11,fontWeight:700}}>👁 Auditor View</span>
      </>}/>
    <div style={{padding:16,maxWidth:900,margin:'0 auto'}}>
      {showCerts&&<div style={{...S.card,marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontWeight:700,fontSize:13}}>🎓 ComplianceReady Certificates</div>
          <button style={{...S.btn('#64748b'),padding:'3px 8px',fontSize:11}} onClick={()=>setShowCerts(false)}>✕ Close</button>
        </div>
        {genCerts.length===0&&<div style={{color:'#64748b',fontSize:13,textAlign:'center',padding:'12px 0'}}>No generated certificates on file.</div>}
        {genCerts.map(c=>{
          const isExpired=c.expiry_date&&new Date(c.expiry_date)<new Date();
          return<div key={c.id} style={{padding:'10px 12px',background:'#f8fafc',borderRadius:8,border:`1px solid ${isExpired?'#fca5a5':'#93c5fd'}`,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>{c.training_name}</div>
              <div style={{fontSize:11,color:'#64748b',marginTop:2}}>Completed: {c.completion_date}{c.hours>0?` · ${c.hours}h`:''}{c.expiry_date?` · Valid through: ${c.expiry_date}`:''}</div>
              <div style={{fontSize:10,color:'#94a3b8',fontFamily:'monospace'}}>{c.cert_id}</div>
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              {isExpired?<span style={{background:'#fee2e2',color:'#dc2626',padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700}}>Expired</span>
              :<span style={{background:'#dbeafe',color:'#2563eb',padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700}}>✓ Valid</span>}
              <button style={{...S.btn('#3b82f6'),padding:'4px 10px',fontSize:11}} onClick={()=>printCertificate(c)}>🖨️ Print</button>
            </div>
          </div>;
        })}
      </div>}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        <div style={{background:cleared?'#dbeafe':'#fee2e2',border:`1px solid ${cleared?'#93c5fd':'#fca5a5'}`,borderRadius:10,padding:'12px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><span style={{fontSize:20}}>{cleared?'✅':'⛔'}</span><div style={{fontWeight:700,fontSize:13,color:cleared?'#2563eb':'#dc2626'}}>{cleared?'CLEARED':'NOT CLEARED'}</div></div>
          {cleared&&lockedSince&&<div style={{fontSize:11,color:'#475569'}}>Locked since {lockedSince}</div>}
          {!cleared&&<div style={{fontSize:11,color:'#475569'}}>Missing: {missing.map(t=>t.name).join(', ')}</div>}
        </div>
        <div style={S.card}>
          <div style={{...S.lbl,marginBottom:4}}>Annual Hours · {emp.type}</div>
          <HoursBar completed={hrs} required={req}/>
          <div style={{fontSize:11,color:hrs>=req?'#2563eb':'#64748b',marginTop:4}}>{hrs>=req?'✓ Requirement met':`${(req-hrs).toFixed(1)}h still needed`}</div>
        </div>
      </div>
      <div style={{...S.card,marginBottom:12,display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}>
        <div><div style={S.lbl}>Hire Date</div><div style={{fontWeight:600}}>{emp.hire}</div></div>
        {emp.staff_type&&<div><div style={S.lbl}>Staff Type</div><div style={{fontWeight:600,fontSize:12,color:'#2563eb'}}>{emp.staff_type}</div></div>}
        <div style={{flex:1,minWidth:180}}><div style={S.lbl}>Training Progress</div><Bar val={assignedIds.filter(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate,emp.hire,lt.renewal_cycle,lt.tags?.includes('Acknowledgement'))==='complete';}).length} total={assignedIds.length} h={10}/></div>
      </div>
      <div style={S.card}>
        <div style={{...S.lbl,marginBottom:10}}>Assigned Trainings ({assignedIds.length}) — Read Only</div>
        {groups.map(g=>{
          const grp=grouped[g.key]||[];
          const allInGroup=assignedIds.filter(id=>getGKey(id)===g.key);
          const grpDone=grp.filter(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate,emp.hire,lt.renewal_cycle,lt.tags?.includes('Acknowledgement'))==='complete';}).length;
          const grpHrs=grp.filter(id=>emp.trainings[id]?.completed).reduce((a,id)=>{const lt=library.find(t=>t.id===id)||{};return a+effectiveHours(lt,emp.trainings[id]||{});},0);
          const grpOverdue=grp.filter(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate,emp.hire,lt.renewal_cycle)==='overdue';}).length;
          const grpSoon=grp.filter(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate,emp.hire,lt.renewal_cycle)==='soon';}).length;
          return <CollapsibleSection key={g.key} label={g.label} color={g.color} bg={g.bg} done={grpDone} total={grp.length} hours={grpHrs} overdue={grpOverdue} dueSoon={grpSoon} isEmpty={allInGroup.length===0}>
            {grp.map(id=>{
              const libTr=library.find(t=>t.id===id)||{name:id,ctype:'Read and Acknowledge',tags:[],renewal_cycle:'12 Months',default_hours:0};
              const v=emp.trainings[id]||{};
              const st=getStatus(v.completed,v.dueDate,emp.hire,libTr.renewal_cycle,libTr.tags?.includes('Acknowledgement'));
              const tHrs=effectiveHours(libTr,v);
              return <div key={id} style={{padding:'9px 12px',background:'#f8fafc',borderRadius:8,border:`1px solid ${ST_BDR[st]}`,marginBottom:7}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{libTr.name}</div>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
                      <CTag type={libTr.ctype}/><TrainingTags tags={libTr.tags}/>
                      {tHrs>0&&<span style={{fontSize:10,color:st==='complete'?'#2563eb':'#64748b',background:st==='complete'?'#dbeafe':'#f1f5f9',padding:'1px 6px',borderRadius:99}}>⏱ {tHrs}h</span>}
                      {v.initials&&<span style={{fontSize:10,color:'#2563eb',fontFamily:'Georgia,serif',fontWeight:700}}>✍️ {v.initials}</span>}
                    </div>
                  </div>
                  <Tag status={st}/>
                </div>
                <div style={{fontSize:11,color:'#64748b',marginTop:5,display:'flex',gap:12,flexWrap:'wrap'}}>
                  {v.dueDate&&<span>Due: <span style={{color:ST_COLOR[st]}}>{v.dueDate}</span></span>}
                  {v.completed&&<span>✓ Completed: <span style={{color:'#2563eb'}}>{v.completed}</span></span>}
                </div>
              </div>;
            })}
          </CollapsibleSection>;
        })}
      </div>
    </div>
  </>;
}

// ── AUDITOR DASHBOARD ─────────────────────────────────────────────────────────
function AuditorDashboard({employees, library, session, onSignOut}){
  const [selEmp, setSelEmp] = useState(null);
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('All');
  const {toast, Toasts} = useToast();

  // ── Acknowledgement report (auditor read-only version) ──────────────────────
  function printAcknowledgementReport(emp){
    const ackTrainings=library.filter(t=>t.tags?.includes("Acknowledgement")&&emp.trainings[t.id]);
    const completedCount=ackTrainings.filter(t=>!!emp.trainings[t.id]?.completed).length;
    const totalCount=ackTrainings.length;
    const rows=ackTrainings.map(t=>{
      const v=emp.trainings[t.id]||{};const done=!!v.completed;
      return`<tr><td>${t.name}</td><td>${t.ctype||""}</td><td>${t.renewal_cycle||"One Time"}</td><td>${v.completed||""}</td><td style="font-family:Georgia,serif;font-weight:bold;font-size:14px">${v.initials||""}</td><td style="color:${done?"green":"red"};font-weight:bold">${done?"✅ Signed":"❌ Pending"}</td></tr>`;
    }).join("");
    const html=`<!DOCTYPE html><html><head><title>Acknowledgements — ${emp.name}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px;}h1{font-size:18px;margin:0 0 4px;}h2{font-size:13px;color:#334155;margin:0 0 16px;font-weight:normal;}table{width:100%;border-collapse:collapse;}th{background:#1e293b;color:white;padding:6px 8px;text-align:left;font-size:11px;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;}tr:nth-child(even) td{background:#f8fafc;}.banner{background:#1e3a5f;color:white;padding:6px 12px;border-radius:6px;margin-bottom:12px;font-size:10px;}.sum{display:flex;gap:16px;margin-bottom:16px;}.st{background:#f8fafc;padding:10px 14px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;}.sn{font-size:20px;font-weight:bold;}.sl{font-size:9px;color:#64748b;}.sig{display:flex;gap:36px;margin-top:36px;}.sig-line{flex:1;border-top:1px solid #334155;padding-top:4px;font-size:9px;color:#64748b;}@media print{@page{margin:0.5in;}}</style></head><body>
    <div class="banner">⚠️ AUDITOR COPY — CONFIDENTIAL · Code: ${session.code} · ${new Date().toLocaleDateString()}</div>
    <h1>Acknowledgements Report — ${emp.name}</h1>
    <h2>${emp.pos} · ${emp.type} · Hired ${emp.hire}</h2>
    <div class="sum"><div class="st"><div class="sn" style="color:${completedCount===totalCount?"green":"red"}">${completedCount}/${totalCount}</div><div class="sl">Signed</div></div><div class="st"><div class="sn" style="color:${totalCount-completedCount>0?"red":"green"}">${totalCount-completedCount}</div><div class="sl">Pending</div></div></div>
    <table><thead><tr><th style="width:32%">Document</th><th style="width:14%">Type</th><th style="width:10%">Renewal</th><th style="width:10%">Signed</th><th style="width:8%">Initials</th><th style="width:10%">Status</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="sig"><div class="sig-line">Employee Signature &amp; Date</div><div class="sig-line">Supervisor Signature &amp; Date</div></div>
    </body></html>`;
    const w=window.open('','_blank');w.document.write(html);w.document.close();w.print();
  }

  // ── Individual training record ───────────────────────────────────────────────
  function printIndividualReport(emp){
    const {cleared,lockedSince,missing}=getClearanceStatus(emp,library);
    const hrs=calcCompletedHours(emp,library);const req=requiredHours(emp);
    const assignedIds=Object.keys(emp.trainings||{}).sort((a,b)=>{
      const la=library.find(t=>t.id===a)||{};const lb=library.find(t=>t.id===b)||{};
      const ord=t=>{if(t.tags?.includes('Required for Clearance'))return 0;if(t.tags?.includes('Pre-Service'))return 1;if(t.tags?.includes('Annual'))return 2;return 3;};
      return ord(la)-ord(lb);
    });
    const clearanceTrainings=library.filter(t=>t.tags?.includes('Required for Clearance'));
    const clearanceRows=clearanceTrainings.map(t=>{const v=emp.trainings[t.id]||{};const done=!!v.completed;return`<tr><td>${t.name}</td><td style="color:${done?'green':'red'};font-weight:bold">${done?'✅ Complete':'❌ Incomplete'}</td><td>${v.completed||'—'}</td></tr>`;}).join('');
    const rows=assignedIds.map(id=>{
      const libTr=library.find(t=>t.id===id)||{name:id,ctype:'',tags:[],renewal_cycle:'',default_hours:0};
      const v=emp.trainings[id]||{};
      const st=getStatus(v.completed,v.dueDate,emp.hire,libTr.renewal_cycle,libTr.tags?.includes('Acknowledgement'));
      const h=effectiveHours(libTr,v);
      const sc=st==='complete'?'green':st==='overdue'?'red':'orange';
      return`<tr><td>${libTr.name}</td><td style="font-size:10px">${(libTr.tags||[]).join(', ')}</td><td>${libTr.ctype||''}</td><td style="text-align:right;font-weight:600">${h>0?h+'h':'—'}</td><td>${v.dueDate||''}</td><td>${v.completed||''}</td><td style="font-family:Georgia,serif;font-weight:bold">${v.initials||''}</td><td style="color:${sc};font-weight:bold">${ST_LBL[st]||st}</td></tr>`;
    }).join('');
    const html=`<!DOCTYPE html><html><head><title>Training Record — ${emp.name}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:11px;color:#1e293b;}h1{font-size:16px;margin:0 0 3px;}h2{font-size:11px;color:#334155;margin:0 0 12px;font-weight:normal;}h3{font-size:11px;margin:12px 0 5px;border-bottom:2px solid #e2e8f0;padding-bottom:3px;}table{width:100%;border-collapse:collapse;margin-bottom:8px;}th{background:#1e293b;color:white;padding:4px 6px;text-align:left;font-size:10px;}td{padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:10px;vertical-align:top;}.badge{display:inline-block;padding:3px 10px;border-radius:16px;font-weight:bold;font-size:11px;}.cleared{background:#dcfce7;color:#16a34a;}.notcleared{background:#fee2e2;color:#dc2626;}.sum{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;}.st{background:#f8fafc;padding:8px 12px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;min-width:60px;}.sn{font-size:18px;font-weight:bold;}.sl{font-size:9px;color:#64748b;}.banner{background:#1e3a5f;color:white;padding:6px 12px;border-radius:6px;margin-bottom:10px;font-size:10px;}@media print{@page{margin:0.5in;}}</style></head><body>
    <div class="banner">⚠️ AUDITOR COPY — CONFIDENTIAL · Code: ${session.code} · ${new Date().toLocaleDateString()}</div>
    <h1>Training Record — ${emp.name}</h1>
    <h2>${emp.pos} · ${emp.type} · Hired ${emp.hire} · ${isYear1(emp.hire)?'Year 1 (80h req)':'Year 2+ (40h req)'}</h2>
    <div class="sum"><div class="st"><div class="sn">${hrs}/${req}</div><div class="sl">Hours</div></div><div class="st"><div class="sn" style="color:${cleared?'#16a34a':'#dc2626'}">${cleared?'✅':'⛔'}</div><div class="sl">Clearance</div></div><div class="st"><div class="sn">${assignedIds.length}</div><div class="sl">Trainings</div></div></div>
    <p><span class="badge ${cleared?'cleared':'notcleared'}">${cleared?`✅ CLEARED${lockedSince?` since ${lockedSince}`:''}`:' ⛔ NOT CLEARED'}</span></p>
    <h3>🔑 Required for Clearance</h3>
    <table><thead><tr><th style="width:55%">Training</th><th style="width:20%">Status</th><th style="width:25%">Completed</th></tr></thead><tbody>${clearanceRows}</tbody></table>
    <h3>📋 All Assigned Trainings</h3>
    <table><thead><tr><th style="width:28%">Training</th><th style="width:16%">Tags</th><th style="width:10%">Type</th><th style="width:5%;text-align:right">Hours</th><th style="width:8%">Due</th><th style="width:8%">Completed</th><th style="width:6%">Initials</th><th style="width:9%">Status</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
    const w=window.open('','_blank');w.document.write(html);w.document.close();w.print();
  }

  const allowedEmps = session.employee_ids && session.employee_ids.length > 0
    ? employees.filter(e => session.employee_ids.includes(String(e.id)) || session.employee_ids.includes(e.id))
    : employees;

  const expiresAt = new Date(session.expires_at);
  const daysLeft = Math.ceil((expiresAt - new Date()) / 86400000);
  const hoursLeft = Math.ceil((expiresAt - new Date()) / 3600000);

  const clearedCount = allowedEmps.filter(e => getClearanceStatus(e, library).cleared).length;
  const hoursMetCount = allowedEmps.filter(e => calcCompletedHours(e,library) >= requiredHours(e)).length;
  const totalHrs = allowedEmps.reduce((a,e) => a + calcCompletedHours(e, library), 0);

  const filtered = allowedEmps.filter(e => {
    if(search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    if(fStatus==='Cleared') return getClearanceStatus(e,library).cleared;
    if(fStatus==='Not Cleared') return !getClearanceStatus(e,library).cleared;
    if(fStatus==='Hours Met') return calcCompletedHours(e,library)>=requiredHours(e);
    if(fStatus==='Hours Behind') return calcCompletedHours(e,library)<requiredHours(e);
    return true;
  });


  if(selEmp){
    const emp=selEmp;
    const {cleared,lockedSince,missing}=getClearanceStatus(emp,library);
    const hrs=calcCompletedHours(emp,library);const req=requiredHours(emp);
    const assignedIds=Object.keys(emp.trainings||{}).sort((a,b)=>{
      const la=library.find(t=>t.id===a)||{};const lb=library.find(t=>t.id===b)||{};
      const ord=t=>{const tgs=t.tags||[];if(tgs.includes('Acknowledgement'))return 0;if(tgs.includes('Required for Clearance'))return 1;if(tgs.includes('Pre-Service'))return 2;if(tgs.includes('Annual'))return 3;return 4;};
      return ord(la)-ord(lb);
    });
    const groups=[
      {label:"✍️ Acknowledgements",key:"Acknowledgement",color:"#64748b",bg:"#64748b15"},
      {label:"🔑 Required for Clearance",key:"Required for Clearance",color:"#ef4444",bg:"#ef444415"},
      {label:"🔰 Pre-Service",key:"Pre-Service",color:"#64748b",bg:"#64748b15"},
      {label:"📅 Annual",key:"Annual",color:"#3b82f6",bg:"#3b82f615"},
      {label:"📋 Other",key:"Other",color:"#64748b",bg:"#64748b15"},
    ];
    function getGKey(id){const tags=library.find(t=>t.id===id)?.tags||[];if(tags.includes('Acknowledgement'))return'Acknowledgement';if(tags.includes('Required for Clearance'))return'Required for Clearance';if(tags.includes('Pre-Service'))return'Pre-Service';if(tags.includes('Annual'))return'Annual';return'Other';}
    const grouped={};groups.forEach(g=>{grouped[g.key]=[];});
    assignedIds.forEach(id=>grouped[getGKey(id)].push(id));
    return <div style={S.page}>
      <Toasts/>
      <AuditorEmpDetail emp={emp} library={library} onBack={()=>setSelEmp(null)} printIndividualReport={printIndividualReport} printAcknowledgementReport={printAcknowledgementReport} session={session}/>
    </div>;
  }

  function printGroupReport(){
    const rows = allowedEmps.map(e => {
      const {cleared} = getClearanceStatus(e,library);
      const hrs = calcCompletedHours(e,library);
      const req = requiredHours(e);
      const ts = Object.keys(e.trainings||{});
      const done = ts.filter(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(e.trainings[id]?.completed,e.trainings[id]?.dueDate,e.hire,lt.renewal_cycle)==="complete";}).length;
      const overdue = ts.filter(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(e.trainings[id]?.completed,e.trainings[id]?.dueDate,e.hire,lt.renewal_cycle)==="overdue";}).length;
      return `<tr><td>${e.name}</td><td>${e.pos}</td><td>${e.type}</td><td>${e.hire}</td>
        <td style="color:${cleared?"green":"red"};font-weight:bold">${cleared?"✅ CLEARED":"⛔ NOT CLEARED"}</td>
        <td style="color:${hrs>=req?"green":"red"};font-weight:bold">${hrs}/${req}h</td>
        <td>${Math.round(hrs/req*100)}%</td><td>${done}/${ts.length}</td>
        <td style="color:${overdue>0?"red":"green"};font-weight:bold">${overdue}</td>
        <td>${isYear1(e.hire)?"Year 1 (80h)":"Year 2+ (40h)"}</td></tr>`;
    }).join('');
    const html=`<!DOCTYPE html><html><head><title>SHYH Compliance Report — Auditor Copy</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px;}h1{font-size:17px;margin:0 0 4px;}h2{font-size:12px;color:#334155;margin:0 0 16px;font-weight:normal;}table{width:100%;border-collapse:collapse;margin-top:12px;}th{background:#1e293b;color:white;padding:6px 8px;text-align:left;font-size:11px;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;}tr:nth-child(even){background:#f8fafc;}.sum{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;}.st{background:#f8fafc;padding:10px 16px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;}.sn{font-size:20px;font-weight:bold;}.sl{font-size:10px;color:#64748b;}.banner{background:#1e3a5f;color:white;padding:8px 14px;border-radius:6px;margin-bottom:12px;font-size:11px;}@media print{@page{margin:0.5in;}}</style></head><body>
    <div class="banner">⚠️ AUDITOR COPY — CONFIDENTIAL · Code: ${session.code} · Generated: ${new Date().toLocaleDateString()} · Expires: ${expiresAt.toLocaleDateString()}</div>
    <h1>SHYH Training Compliance Report</h1>
    <h2>Southall Heritage Youth Home · ${session.label?`Audit: ${session.label}`:''}</h2>
    <div class="sum">
      <div class="st"><div class="sn">${allowedEmps.length}</div><div class="sl">Staff Reviewed</div></div>
      <div class="st"><div class="sn" style="color:${clearedCount===allowedEmps.length?"green":"red"}">${clearedCount}/${allowedEmps.length}</div><div class="sl">Cleared</div></div>
      <div class="st"><div class="sn">${hoursMetCount}/${allowedEmps.length}</div><div class="sl">Hours Met</div></div>
      <div class="st"><div class="sn">${totalHrs.toFixed(1)}h</div><div class="sl">Total Hours</div></div>
    </div>
    <table><thead><tr><th>Name</th><th>Position</th><th>Type</th><th>Hire Date</th><th>Clearance</th><th>Hours</th><th>Hrs%</th><th>Trainings</th><th>Overdue</th><th>Year</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
    const w=window.open('','_blank');w.document.write(html);w.document.close();w.print();
  }

  return <div style={S.page}>
    <Toasts/>
    <div style={{background:'#f1f5f9',borderBottom:'1px solid #cbd5e1',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,position:'sticky',top:0,zIndex:100}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{fontSize:20}}>🔍</div>
        <div><div style={{fontWeight:700,fontSize:15}}>Auditor Dashboard</div><div style={{fontSize:11,color:'#64748b'}}>Southall Heritage Youth Home — Read Only</div></div>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{background:daysLeft<=1?'#fee2e2':'#dbeafe',color:daysLeft<=1?'#dc2626':'#1d4ed8',border:`1px solid ${daysLeft<=1?'#fca5a5':'#93c5fd'}`,padding:'4px 10px',borderRadius:8,fontSize:11,fontWeight:700}}>
          {daysLeft>0?`Access expires in ${hoursLeft<24?hoursLeft+'h':daysLeft+'d'}`:'Access expired'}
        </span>
        <button style={S.btn('#3b82f6')} onClick={printGroupReport}>🖨️ Print Group Report</button>
        <button style={S.btn('#64748b')} onClick={onSignOut}>Sign Out</button>
      </div>
    </div>
    <div style={{padding:16,maxWidth:1100,margin:'0 auto'}}>
      <div style={{background:'#dbeafe',border:'1px solid #93c5fd',borderRadius:10,padding:'10px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{fontSize:16}}>📋</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:13,color:'#1d4ed8'}}>{session.label||'Licensing / Audit Review'}</div>
          <div style={{fontSize:11,color:'#64748b'}}>Code: <span style={{fontFamily:'monospace',fontWeight:700,color:'#1e293b'}}>{session.code}</span> · Granted by: {session.created_by||'Leadership'} · Expires: {expiresAt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} · {allowedEmps.length} staff record{allowedEmps.length!==1?'s':''}</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8,marginBottom:14}}>
        {[{l:'Staff Records',v:allowedEmps.length,c:'#2563eb'},{l:'✅ Cleared',v:`${clearedCount}/${allowedEmps.length}`,c:clearedCount===allowedEmps.length?'#2563eb':'#dc2626'},{l:'Hours Met',v:hoursMetCount,c:'#2563eb'},{l:'Hours Behind',v:allowedEmps.length-hoursMetCount,c:allowedEmps.length-hoursMetCount>0?'#d97706':'#2563eb'},{l:'Total Hours',v:totalHrs.toFixed(1)+'h',c:'#475569'}].map(s=><div key={s.l} style={{...S.card,textAlign:'center',padding:12}}><div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:'#64748b',marginTop:2}}>{s.l}</div></div>)}
      </div>
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <input style={{...S.inp,maxWidth:220}} placeholder="Search staff…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={S.sel} value={fStatus} onChange={e=>setFStatus(e.target.value)}>{['All','Cleared','Not Cleared','Hours Met','Hours Behind'].map(s=><option key={s}>{s}</option>)}</select>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:10}}>
        {filtered.map(emp=>{
          const {cleared}=getClearanceStatus(emp,library);
          const hrs=calcCompletedHours(emp,library);const req=requiredHours(emp);
          const ts=Object.keys(emp.trainings||{});
          const done=ts.filter(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate,emp.hire,lt.renewal_cycle)==='complete';}).length;
          const hasOverdue=ts.some(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate,emp.hire,lt.renewal_cycle)==='overdue';});
          const bc=!cleared?'#ef4444':hasOverdue?'#fca5a5':hrs<req?'#fcd34d':'#cbd5e1';
          return <div key={emp.id} style={{...S.card,cursor:'pointer',borderColor:bc,padding:13}} onClick={()=>setSelEmp(emp)}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <div><div style={{fontWeight:700,fontSize:13}}>{emp.name}</div><div style={{fontSize:11,color:'#2563eb',marginTop:1}}>{emp.pos}</div><div style={{fontSize:10,color:'#64748b'}}>{emp.type} · {isYear1(emp.hire)?'Year 1':'Year 2+'}</div></div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}><ClearanceBadge cleared={cleared}/>{hasOverdue&&<span style={{background:'#fee2e2',color:'#dc2626',padding:'1px 6px',borderRadius:99,fontSize:10,fontWeight:700}}>OVERDUE</span>}</div>
            </div>
            <div style={{marginBottom:4}}><div style={{fontSize:10,color:'#64748b',marginBottom:2}}>Training Progress</div><Bar val={done} total={ts.length}/></div>
            <div><div style={{fontSize:10,color:'#64748b',marginBottom:2}}>Annual Hours ({hrs}/{req}h)</div><HoursBar completed={hrs} required={req}/></div>
            <div style={{marginTop:6,fontSize:11,color:'#475569',display:'flex',justifyContent:'space-between'}}><span>Hire: {emp.hire}</span><span style={{color:'#2563eb',fontWeight:700}}>View Details →</span></div>
          </div>;
        })}
      </div>
      {filtered.length===0&&<div style={{textAlign:'center',color:'#64748b',marginTop:40}}>No staff match your filters.</div>}
    </div>
  </div>;
}
function CreateAuditorModal({employees, onClose, toast, onCreated}){
  const [label,setLabel]=useState('');const [createdBy,setCreatedBy]=useState('');
  const [days,setDays]=useState(3);const [selectedEmps,setSelectedEmps]=useState([]);
  const [scope,setScope]=useState('all');const [saving,setSaving]=useState(false);
  const [generatedCode,setGeneratedCode]=useState(null);

  async function handleCreate(){
    if(!createdBy.trim()){toast('Enter who is granting access','error');return;}
    setSaving(true);
    try{
      const empIds=scope==='all'?[]:selectedEmps.map(String);
      const code=await createAuditorSession({createdBy:createdBy.trim(),days:parseInt(days),employeeIds:empIds,label:label.trim()});
      setGeneratedCode(code);
      if(onCreated)onCreated();
      toast(`Auditor access created: ${code}`,'success');
    }catch(e){toast(`Could not create: ${e.message}`,'error');}
    setSaving(false);
  }

  if(generatedCode)return<Modal title="✅ Auditor Access Created" onClose={onClose}>
    <div style={{textAlign:'center',padding:'10px 0'}}>
      <div style={{fontSize:48,marginBottom:8}}>🔑</div>
      <div style={{fontSize:11,color:'#64748b',marginBottom:4,fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Access Code</div>
      <div style={{fontSize:32,fontWeight:800,fontFamily:'monospace',color:'#60a5fa',background:'#dbeafe',border:'2px solid #3b82f644',borderRadius:10,padding:'12px 20px',marginBottom:12,letterSpacing:3}}>{generatedCode}</div>
      <div style={{fontSize:12,color:'#475569',marginBottom:16}}>Expires in {days} day{days!==1?'s':''} · {scope==='all'?'All staff':'Selected staff only'}</div>
      <div style={{background:'#f8fafc',border:'1px solid #cbd5e1',borderRadius:8,padding:12,marginBottom:14,textAlign:'left'}}>
        <div style={{fontSize:11,fontWeight:700,color:'#1e293b',marginBottom:6}}>Instructions for the auditor:</div>
        <div style={{fontSize:12,color:'#475569',lineHeight:1.7}}>
          1. Visit your app URL<br/>
          2. Click <strong style={{color:'#1e293b'}}>"Auditor / Licensing Access"</strong> on the home screen<br/>
          3. Enter code: <strong style={{color:'#60a5fa',fontFamily:'monospace'}}>{generatedCode}</strong><br/>
          4. Read-only access — no editing, PINs hidden
        </div>
      </div>
      <button style={S.btn('#3b82f6',true)} onClick={()=>{navigator.clipboard?.writeText(generatedCode);toast('Code copied!','success');}}>📋 Copy Code</button>
    </div>
  </Modal>;

  return<Modal title="🔍 Create Auditor Access" onClose={onClose} wide>
    <p style={{fontSize:13,color:'#475569',margin:'0 0 14px',lineHeight:1.6}}>Generate a temporary read-only access code for licensing staff or auditors. They can view training records and print reports — cannot edit anything.</p>
    <div style={{marginBottom:12}}><label style={S.lbl}>Audit Label (optional)</label><input style={S.inp} value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. DFPS Annual Inspection 2026, Licensing Visit May 2026"/></div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
      <div><label style={S.lbl}>Granted By (your name)</label><input style={S.inp} value={createdBy} onChange={e=>setCreatedBy(e.target.value)} placeholder="Your name"/></div>
      <div><label style={S.lbl}>Access Duration</label>
        <select style={{...S.sel,width:'100%'}} value={days} onChange={e=>setDays(parseInt(e.target.value))}>
          <option value={1}>1 Day</option><option value={2}>2 Days</option><option value={3}>3 Days</option>
        </select>
      </div>
    </div>
    <div style={{marginBottom:14}}>
      <label style={S.lbl}>Staff Access Scope</label>
      <div style={{display:'flex',gap:8,marginTop:6}}>
        {[['all','👥 All Staff','Auditor sees everyone'],['selected','🔒 Selected Staff Only','Limit what they see']].map(([v,label,sub])=><button key={v} type="button" style={{flex:1,padding:'10px 12px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',border:`1px solid ${scope===v?'#3b82f6':'#cbd5e1'}`,background:scope===v?'#3b82f622':'transparent',color:scope===v?'#60a5fa':'#64748b'}} onClick={()=>setScope(v)}>{label}<div style={{fontSize:10,fontWeight:400,marginTop:2,opacity:.8}}>{sub}</div></button>)}
      </div>
    </div>
    {scope==='selected'&&<div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <label style={S.lbl}>Select Staff ({selectedEmps.length} selected)</label>
        <div style={{display:'flex',gap:6}}>
          <button style={{...S.btn('#64748b'),padding:'3px 8px',fontSize:11}} onClick={()=>setSelectedEmps(employees.map(e=>String(e.id)))}>All</button>
          <button style={{...S.btn('#64748b'),padding:'3px 8px',fontSize:11}} onClick={()=>setSelectedEmps([])}>None</button>
        </div>
      </div>
      <div style={{maxHeight:200,overflowY:'auto',background:'#f8fafc',borderRadius:8,padding:8,border:'1px solid #cbd5e1'}}>
        {employees.map(e=><label key={e.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 4px',borderBottom:'1px solid #ffffff',cursor:'pointer',fontSize:12}}>
          <input type="checkbox" checked={selectedEmps.includes(String(e.id))} onChange={ev=>setSelectedEmps(p=>ev.target.checked?[...p,String(e.id)]:p.filter(x=>x!==String(e.id)))} style={{accentColor:'#3b82f6'}}/>
          <span style={{fontWeight:600,flex:1}}>{e.name}</span><span style={{color:'#64748b',fontSize:11}}>{e.pos}</span>
        </label>)}
      </div>
    </div>}
    <div style={{background:'#f8fafc',border:'1px solid #cbd5e1',borderRadius:8,padding:12,marginBottom:14,fontSize:12,color:'#64748b',lineHeight:1.7}}>
      <strong style={{color:'#1e293b'}}>Auditors CAN see:</strong> Training names, dates, hours, clearance status, initials<br/>
      <strong style={{color:'#1e293b'}}>Auditors CANNOT see:</strong> PINs, write-ups, HR documents, contact info<br/>
      <strong style={{color:'#1e293b'}}>Auditors CAN do:</strong> View records, print compliance reports
    </div>
    <button style={S.btn('#3b82f6',true)} disabled={saving||(scope==='selected'&&selectedEmps.length===0)} onClick={handleCreate}>{saving?'⏳ Creating…':'🔑 Generate Auditor Code'}</button>
  </Modal>;
}

// ── MANAGE AUDITOR SESSIONS MODAL ─────────────────────────────────────────────
function ManageAuditorModal({employees, onClose, toast}){
  const [sessions,setSessions]=useState([]);const [loading,setLoading]=useState(true);
  const [showCreate,setShowCreate]=useState(false);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    try{const data=await getAuditorSessions();setSessions(data);}
    catch(e){toast(`Could not load: ${e.message}`,'error');}
    setLoading(false);
  }

  async function handleRevoke(id,code){
    if(!window.confirm(`Revoke access for ${code}?`))return;
    try{await revokeAuditorSession(id);await load();toast('Access revoked','warn');}
    catch(e){toast(`Could not revoke: ${e.message}`,'error');}
  }

  if(showCreate)return<CreateAuditorModal employees={employees} onClose={()=>{setShowCreate(false);load();}} toast={toast} onCreated={load}/>;

  return<Modal title="🔍 Auditor Access Management" onClose={onClose} wide>
    <button style={{...S.btn('#3b82f6'),marginBottom:14}} onClick={()=>setShowCreate(true)}>+ Create New Auditor Access</button>
    {loading&&<div style={{textAlign:'center',color:'#64748b',padding:'20px 0'}}>Loading…</div>}
    {!loading&&sessions.length===0&&<div style={{textAlign:'center',color:'#64748b',padding:'20px 0'}}>No auditor sessions created yet.</div>}
    {!loading&&sessions.map(s=>{
      const expired=new Date(s.expires_at)<new Date();
      const dLeft=Math.ceil((new Date(s.expires_at)-new Date())/86400000);
      return<div key={s.id} style={{...S.card,marginBottom:10,borderColor:!s.is_active||expired?'#94a3b8':'#3b82f644'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8,marginBottom:6}}>
          <div>
            <div style={{fontFamily:'monospace',fontWeight:800,fontSize:16,color:'#60a5fa',letterSpacing:2}}>{s.code}</div>
            {s.label&&<div style={{fontSize:12,color:'#1e293b',marginTop:2}}>{s.label}</div>}
            <div style={{fontSize:11,color:'#64748b',marginTop:2}}>By: {s.created_by||'—'} · Expires: {new Date(s.expires_at).toLocaleDateString()} · {s.employee_ids?.length>0?`${s.employee_ids.length} selected staff`:'All staff'}</div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            {!s.is_active?<span style={{background:'#f1f5f9',color:'#64748b',border:'1px solid #cbd5e1',padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:700}}>Revoked</span>
              :expired?<span style={{background:'#f1f5f9',color:'#64748b',border:'1px solid #cbd5e1',padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:700}}>Expired</span>
              :<span style={{background:'#2563eb22',color:'#3b82f6',padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:700}}>✓ Active · {dLeft}d left</span>}
            {s.is_active&&!expired&&<button style={{...S.btn('#7f1d1d'),padding:'3px 8px',fontSize:11}} onClick={()=>handleRevoke(s.id,s.code)}>Revoke</button>}
            <button style={{...S.btn('#64748b'),padding:'3px 8px',fontSize:11}} onClick={()=>{navigator.clipboard?.writeText(s.code);toast('Code copied!','success');}}>📋 Copy</button>
          </div>
        </div>
      </div>;
    })}
  </Modal>;
}

// ── AUDITOR LOGIN SCREEN ──────────────────────────────────────────────────────
function AuditorLoginScreen({onSuccess, goHome}){
  const [code,setCode]=useState('');const [err,setErr]=useState('');const [checking,setChecking]=useState(false);

  async function handleVerify(){
    if(!code.trim()){setErr('Enter your access code');return;}
    setChecking(true);setErr('');
    try{
      const session=await verifyAuditorCode(code.trim());
      if(!session){setErr('Code not found or expired. Contact the facility administrator.');}
      else{onSuccess(session);}
    }catch(e){setErr(`Could not verify: ${e.message}`);}
    setChecking(false);
  }

  return(
    <div style={{...S.page,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:8}}>🔍</div>
          <h1 style={{margin:'0 0 4px',fontSize:22,fontWeight:800}}>Auditor Access</h1>
          <p style={{margin:0,color:'#64748b',fontSize:14}}>Southall Heritage Youth Home — Read Only</p>
        </div>
        <div style={S.card}>
          <div style={{background:'#dbeafe',border:'1px solid #93c5fd',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#475569',lineHeight:1.6}}>
            This portal provides read-only access to training compliance records. Enter the temporary access code provided by facility leadership.
          </div>
          <label style={S.lbl}>Access Code</label>
          <input style={{...S.inp,marginBottom:10,fontFamily:'monospace',fontSize:16,fontWeight:700,letterSpacing:3,textAlign:'center',textTransform:'uppercase'}} value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&handleVerify()} placeholder="AUD-2026-XXXXXX"/>
          {err&&<div style={{color:'#f87171',fontSize:13,marginBottom:10,background:'#dc262618',padding:'8px 12px',borderRadius:6}}>{err}</div>}
          <button style={S.btn('#475569',true)} onClick={handleVerify} disabled={checking}>{checking?'Verifying…':'🔍 Access Dashboard'}</button>
          <button style={{...S.btn('#64748b',true),marginTop:8}} onClick={goHome}>🏠 Back to Home</button>
        </div>
        <p style={{textAlign:'center',fontSize:11,color:'#94a3b8',marginTop:12}}>Access codes are temporary and expire automatically.</p>
      </div>
    </div>
  );
}
function EmpMyDocuments({empId, empName}){
  const [wus, setWus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState({});
  const [showResponse, setShowResponse] = useState({});
  const [saving, setSaving] = useState({});
  const {toast, Toasts} = useToast();

  async function load(){
    setLoading(true);
    try{
      const data = await getWriteUps(empId);
      setWus(data.filter(w=>w.status==="delivered"||w.status==="acknowledged"));
    }catch(e){console.error(e);}
    setLoading(false);
  }

  useEffect(()=>{load();},[empId]);

  async function handleAcknowledge(wu){
    setSaving(p=>({...p,[wu.id]:true}));
    try{
      const resp = responses[wu.id]||wu.employee_response||"";
      await saveWriteUp({
        ...wu,
        status:"acknowledged",
        acknowledged_at:todayStr,
        employee_response:resp,
      });
      await load();
      toast("Write-up acknowledged ✓","success");
    }catch(e){toast(`Could not save: ${e.message}`,"error");}
    setSaving(p=>({...p,[wu.id]:false}));
  }

  async function handleSaveResponse(wu){
    setSaving(p=>({...p,[wu.id+"r"]:true}));
    try{
      await saveWriteUp({...wu, employee_response:responses[wu.id]||""});
      await load();
      toast("Statement saved ✓","success");
    }catch(e){toast(`Could not save: ${e.message}`,"error");}
    setSaving(p=>({...p,[wu.id+"r"]:false}));
  }

  const pending = wus.filter(w=>w.status==="delivered");

  return<div>
    <Toasts/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontWeight:700,fontSize:14}}>My Documents</div>
      <button style={{...S.btn("#64748b"),padding:"4px 10px",fontSize:11}} onClick={load}>↻ Refresh</button>
    </div>
    {loading&&<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>Loading…</div>}
    {!loading&&wus.length===0&&<div style={{textAlign:"center",color:"#64748b",padding:"30px 0"}}>
      <div style={{fontSize:32,marginBottom:8}}>📄</div>
      <div>No documents on file.</div>
    </div>}
    {pending.length>0&&<div style={{background:"#dc262618",border:"1px solid #dc262644",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
      <div style={{fontWeight:700,fontSize:13,color:"#f87171"}}>📋 {pending.length} document{pending.length>1?"s":""} require your acknowledgement</div>
    </div>}
    {!loading&&wus.map(wu=>{
      const tc=WU_TIER_COLOR[wu.tier]||"#64748b";
      const isPending=wu.status==="delivered";
      const isAcked=wu.status==="acknowledged";
      const myResponse=responses[wu.id]!==undefined?responses[wu.id]:wu.employee_response||"";
      return<div key={wu.id} style={{...S.card,marginBottom:12,borderColor:isPending?tc+"88":tc+"33"}}>
        {/* Header */}
        <div style={{background:"#f8fafc",borderRadius:6,padding:"8px 12px",marginBottom:10,textAlign:"center"}}>
          <div style={{fontWeight:700,fontSize:11,color:"#475569"}}>SOUTHALL HERITAGE YOUTH HOME</div>
          <div style={{fontSize:10,color:"#475569"}}>Employee Documentation</div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
          <div>
            <span style={{background:tc+"22",color:tc,padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:700,marginRight:8}}>{wu.tier}</span>
            <span style={{background:"#f1f5f9",color:"#475569",border:"1px solid #cbd5e1",padding:"2px 8px",borderRadius:99,fontSize:10}}>{wu.category}</span>
          </div>
          {isAcked&&<span style={{color:"#2563eb",fontSize:11,fontWeight:700}}>✅ Acknowledged {wu.acknowledged_at}</span>}
          {isPending&&<span style={{color:"#dc2626",fontSize:11,fontWeight:700}}>⏳ Pending Your Acknowledgement</span>}
        </div>
        <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>
          Incident: {wu.incident_date} · Documented: {wu.doc_date}
          {wu.action_taken&&` · Action: ${wu.action_taken}`}
        </div>
        <div style={{fontSize:13,color:"#1e293b",marginBottom:8,lineHeight:1.6,whiteSpace:"pre-wrap",background:"#f8fafc",padding:"10px 12px",borderRadius:6}}>{wu.description}</div>
        {wu.attachment_path&&<button style={{...S.btn("#3b82f6"),fontSize:11,padding:"4px 10px",marginBottom:8}} onClick={()=>downloadWriteUpFile(wu.attachment_path,wu.attachment_name)}>⬇ Download Attached File ({wu.attachment_name})</button>}
        {wu.improvement_plan&&<div style={{fontSize:12,color:"#475569",marginBottom:8,lineHeight:1.5,background:"#f8fafc",padding:"10px 12px",borderRadius:6}}>
          <div style={{fontWeight:700,color:"#1e293b",marginBottom:4}}>Expected Actions / Improvement Plan:</div>
          <div style={{whiteSpace:"pre-wrap"}}>{wu.improvement_plan}</div>
        </div>}

        {/* Statement section - always available */}
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <label style={{...S.lbl,margin:0}}>Your Statement (optional)</label>
            {!showResponse[wu.id]&&<button style={{...S.btn("#64748b"),padding:"2px 8px",fontSize:10}} onClick={()=>setShowResponse(p=>({...p,[wu.id]:true}))}>
              {myResponse?"Edit Statement":"Add Statement"}
            </button>}
          </div>
          {myResponse&&!showResponse[wu.id]&&<div style={{fontSize:12,color:"#1e293b",background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:6,padding:"8px 10px",whiteSpace:"pre-wrap"}}>{myResponse}</div>}
          {showResponse[wu.id]&&<div>
            <textarea style={{...S.inp,minHeight:80,resize:"vertical",marginBottom:6}} value={myResponse} onChange={e=>setResponses(p=>({...p,[wu.id]:e.target.value}))} placeholder="Write your optional statement here…"/>
            <div style={{display:"flex",gap:6}}>
              <button style={{...S.btn("#64748b"),padding:"4px 10px",fontSize:11}} disabled={saving[wu.id+"r"]} onClick={()=>handleSaveResponse({...wu,employee_response:myResponse})}>Save Statement</button>
              <button style={{...S.btn("#475569"),padding:"4px 10px",fontSize:11}} onClick={()=>setShowResponse(p=>({...p,[wu.id]:false}))}>Close</button>
            </div>
          </div>}
        </div>

        {/* Acknowledge button */}
        {isPending&&<button style={S.btn("#2563eb",true)} disabled={saving[wu.id]} onClick={()=>handleAcknowledge(wu)}>
          ✅ Acknowledge Receipt
        </button>}
        {isAcked&&<div style={{fontSize:11,color:"#3b82f6"}}>✅ You acknowledged this document on {wu.acknowledged_at}.</div>}
      </div>;
    })}
  </div>;
}


function EmpPortal({employees,library,onRefresh,goHome}){
  const [nameQ,setNameQ]=useState("");const [pinQ,setPinQ]=useState("");
  const [empId,setEmpId]=useState(null);const [err,setErr]=useState("");
  const [tab,setTab]=useState("trainings");
  const [trSearch,setTrSearch]=useState("");
  const [certSearch,setCertSearch]=useState("");
  const [activeQuiz,setActiveQuiz]=useState(null);const [activeAck,setActiveAck]=useState(null);const [activeRQ,setActiveRQ]=useState(null);
  const [showBoard,setShowBoard]=useState(false);const [showHistory,setShowHistory]=useState(null);
  const certRefs=useRef({});const {toast,Toasts}=useToast();
  const [genCerts,setGenCerts]=useState([]);
  const emp=employees.find(e=>e.id===empId);

  useEffect(()=>{
    if(empId){
      const id = typeof empId === 'string' ? parseInt(empId, 10) : empId;
      getEmployeeCertificates(id).then(setGenCerts).catch((e)=>{console.error("cert load error:",e);});
    }
  },[empId]);

  function login(){
    const f=employees.find(e=>e.name.toLowerCase()===nameQ.trim().toLowerCase()&&e.pin===pinQ.trim());
    if(f){setEmpId(f.id);setErr("");}else setErr("Name or passcode not found. Contact your supervisor.");
  }
  async function markDone(trId,extra={}){
    try{
      const existing=emp?.trainings[trId];
      const yearLabel=getCurrentYearLabel(emp.hire);
      await saveCompletion(empId,trId,{completed:todayStr,dueDate:emp.trainings[trId]?.dueDate||"",initials:extra.initials||null,initialsDate:extra.initialsDate||null,yearLabel},existing?.completionId||null);
      const freshEmp={...emp,trainings:{...emp.trainings,[trId]:{...emp.trainings[trId],completed:todayStr}}};
      if(shouldLockClearance(freshEmp,library))await supabase.from("employees").update({cleared_at:todayStr}).eq("id",empId);
      // Generate ComplianceReady certificate if enabled
      const libTrMark=library.find(t=>t.id===trId);
      if(libTrMark?.generate_cert&&libTrMark?.ctype==="Read and Quiz"){
        try{
          const expiryDate=libTrMark.renewal_cycle&&libTrMark.renewal_cycle!=="One Time"?calcExpiryDate(todayStr,libTrMark.renewal_cycle,null)?.toISOString().split("T")[0]||"":"";
          await createGeneratedCertificate({
            employeeId:empId,trainingId:trId,
            trainingName:libTrMark.name,employeeName:emp.name,
            completionDate:todayStr,expiryDate,
            hours:libTrMark.default_hours||0,certType:"completion",
          });
          const updated=await getEmployeeCertificates(empId);
          setGenCerts(updated);
        }catch(e){console.error("cert gen:",e);}
      }
      await onRefresh();toast("Training complete! 🎉","success");
    }catch(e){toast(`Could not save: ${e.message}`,"error");}
  }
  async function handleUploadCert(trId,file){
    if(!file)return;
    if(!["application/pdf","image/jpeg","image/png"].includes(file.type)){toast("PDF, JPG or PNG only","error");return;}
    if(file.size>5*1024*1024){toast("File must be under 5MB","error");return;}
    try{
      await uploadCertificate(empId,trId,file);
      const libTr=library.find(t=>t.id===trId);
      if(libTr?.ctype==="Certificate"){
        const existing=emp?.trainings[trId];
        await saveCompletion(empId,trId,{completed:todayStr,dueDate:emp.trainings[trId]?.dueDate||"",yearLabel:getCurrentYearLabel(emp.hire)},existing?.completionId||null);
        toast("Certificate uploaded & training marked complete! 🎉","success");
      } else {toast("Certificate uploaded ✓","success");}
      await onRefresh();
    }catch(e){toast(`Upload failed: ${e.message}`,"error");}
  }

  if(!emp&&empId){return<div style={{...S.page,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:12}}>⚠️</div><p style={{color:"#64748b",marginBottom:16}}>Could not load your profile. Please try again.</p><button style={{background:"#3b82f6",color:"white",border:"none",borderRadius:8,padding:"10px 24px",fontSize:14,cursor:"pointer"}} onClick={()=>setEmpId(null)}>← Back to Sign In</button></div></div>;}

  if(!emp)return(
    <div style={{...S.page,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <Toasts/>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:8}}>🎓</div>
          <h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>SHYH Training Portal</h1>
          <p style={{margin:0,color:"#64748b",fontSize:14}}>Sign in to view your trainings</p>
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Full Name</label>
          <input style={{...S.inp,marginBottom:12}} value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="Your full name"/>
          <label style={S.lbl}>Passcode</label>
          <input style={{...S.inp,marginBottom:12}} type="password" autoComplete="off" value={pinQ} onChange={e=>setPinQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="Your passcode"/>
          {err&&<div style={{color:"#f87171",fontSize:13,marginBottom:10,background:"#dc262618",padding:"8px 12px",borderRadius:6}}>{err}</div>}
          <button style={S.btn("#3b82f6",true)} onClick={login}>Sign In</button>
          <button style={{...S.btn("#64748b",true),marginTop:8}} onClick={goHome}>🏠 Back to Home</button>
        </div>
      </div>
    </div>
  );

  const sortedLib=sortLibrary(library||[]);
  const assignedIds=Object.keys(emp?.trainings||{});
  const assignedTrainings=(assignedIds||[]).map(id=>{
    const libTr=sortedLib.find(t=>t.id===id)||{id,name:id,ctype:"Read and Acknowledge",link:"",docContent:"",docName:"",quiz:[],tags:[],default_hours:0,renewal_cycle:"12 Months"};
    const empTr=emp?.trainings?.[id]||{};
    return{...libTr,...empTr,id,
      name:libTr.name,ctype:libTr.ctype,quiz:Array.isArray(libTr.quiz)?libTr.quiz:[],
      link:libTr.link||"",tags:Array.isArray(libTr.tags)?libTr.tags:[],
      default_hours:libTr.default_hours||0,
      renewal_cycle:libTr.renewal_cycle||"12 Months",
      completed:empTr.completed||null,dueDate:empTr.dueDate||"",
      initials:empTr.initials||null,certificate:empTr.certificate||null,
      hours_override:empTr.hours_override??null,
      completionId:empTr.completionId||null,
    };
  });

  const groups=[
    {label:"✍️ Acknowledgements",key:"Acknowledgement",color:"#64748b",bg:"#64748b15"},
    {label:"🔑 Required for Clearance",key:"Required for Clearance",color:"#ef4444",bg:"#ef444415"},
    {label:"🔰 Pre-Service",key:"Pre-Service",color:"#64748b",bg:"#64748b15"},
    {label:"📅 Annual",key:"Annual",color:"#3b82f6",bg:"#3b82f615"},
    {label:"📋 Other",key:"Other",color:"#64748b",bg:"#64748b15"},
  ];
  function getGroupKey(t){
    if(t.tags?.includes("Acknowledgement"))return"Acknowledgement";
    if(t.tags?.includes("Required for Clearance"))return"Required for Clearance";
    if(t.tags?.includes("Pre-Service"))return"Pre-Service";
    if(t.tags?.includes("Annual"))return"Annual";
    return"Other";
  }
  const searchLower=(trSearch||"").toLowerCase().trim();
  const filteredTrainings=searchLower?(assignedTrainings||[]).filter(t=>t&&t.name&&t.name.toLowerCase().includes(searchLower)):(assignedTrainings||[]);
  const grouped={};
  groups.forEach(g=>{grouped[g.key]=[];});
  (filteredTrainings||[]).forEach(t=>{if(!t)return;const key=getGroupKey(t);if(!grouped[key])grouped[key]=[];grouped[key].push(t);});

  const done=assignedTrainings.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="complete").length;
  const completedHrs=emp?calcCompletedHours(emp,library):0;
  const reqHrs=emp?requiredHours(emp):40;
  const {cleared,missing,lockedSince}=emp?getClearanceStatus(emp,library):{cleared:false,missing:[],lockedSince:null};
  const badges=emp?calcBadges(emp):[];
  const certCount=(assignedTrainings||[]).filter(t=>t?.certificate).length;
  const quizTr=activeQuiz?(assignedTrainings||[]).find(t=>t.id===activeQuiz):null;
  const ackTr=activeAck?(assignedTrainings||[]).find(t=>t.id===activeAck):null;
  const rqTr=activeRQ?(assignedTrainings||[]).find(t=>t.id===activeRQ):null;

  function TrainingCard({t}){
    if(!t)return null;
    const isAck=t?.tags?.includes("Acknowledgement");
    const st=getStatus(t?.completed,t?.dueDate,emp?.hire,t?.renewal_cycle,isAck);
    const hrs=effectiveHours(t,t)||0;
    const isComplete=st==="complete";
    const hasCert=!!t?.certificate;
    return<div style={{padding:"10px 12px",background:"#f8fafc",borderRadius:8,border:`1px solid ${ST_BDR[st]}`,marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6,marginBottom:4}}>
        <span style={{fontWeight:600,fontSize:13,flex:1}}>{t.name}</span>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
          {hasCert&&<span style={{background:"#2563eb22",color:"#3b82f6",border:"1px solid #2563eb55",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700}}>🏆 Cert ✓</span>}
          <CTag type={t.ctype}/>
          <Tag status={st}/>
        </div>
      </div>
      {hrs>0&&!isAck&&<div style={{marginBottom:4}}>
        <span style={{fontSize:11,fontWeight:700,color:isComplete?"#3b82f6":"#64748b",background:isComplete?"#2563eb18":"#94a3b818",padding:"1px 8px",borderRadius:99}}>⏱ {hrs}h{!isComplete&&<span style={{color:"#475569",fontWeight:400}}> (pending)</span>}</span>
      </div>}
      <div style={{fontSize:11,color:"#64748b",marginBottom:4,display:"flex",gap:12,flexWrap:"wrap"}}>
        {t.dueDate&&<span>Due: <span style={{color:ST_COLOR[st]}}>{t.dueDate}</span></span>}
        {t.completed&&<span>✓ <span style={{color:"#3b82f6"}}>{t.completed}</span></span>}
        {t.initials&&<span>Initials: <span style={{color:"#60a5fa",fontFamily:"Georgia,serif",fontWeight:700}}>{t.initials}</span></span>}
      </div>
      {t.ctype==="Webinar"&&<div style={{marginTop:4,background:"#f8fafc",borderRadius:8,padding:10,border:"1px solid #cbd5e1"}}>
        {t.webinar_description&&<div style={{fontSize:12,color:"#1e293b",marginBottom:6,lineHeight:1.5}}>{t.webinar_description}</div>}
        {t.webinar_host&&<div style={{fontSize:11,color:"#64748b",marginBottom:6}}>Hosted by: <span style={{color:"#1e293b",fontWeight:600}}>{t.webinar_host}</span></div>}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          {(t.webinar_registration_link||t.link)&&<a href={t.webinar_registration_link||t.link} target="_blank" rel="noreferrer" style={{...S.btn("#3b82f6"),textDecoration:"none",display:"inline-block",fontSize:12,padding:"5px 12px"}}>🖥️ Register / Join ↗</a>}
          {!isComplete&&<button style={{...S.btn("#475569"),fontSize:12,padding:"5px 12px"}} onClick={()=>markDone(t.id)}>✓ Mark Attended</button>}
        </div>
      </div>}
      {t.ctype==="Certificate"&&<div style={{marginTop:4}}>
        {t.link&&<a href={t.link} target="_blank" rel="noreferrer" style={{...S.btn("#3b82f6"),textDecoration:"none",display:"inline-block",fontSize:12,padding:"5px 12px",marginBottom:6,marginRight:6}}>🔗 Go to Training ↗</a>}
        {!isComplete&&<div><input type="file" accept=".pdf,.jpg,.jpeg,.png" ref={r=>certRefs.current[t.id]=r} style={{display:"none"}} onChange={e=>handleUploadCert(t.id,e.target.files[0])}/><button style={{...S.btn("#3b82f6"),fontSize:12,padding:"5px 12px"}} onClick={()=>certRefs.current[t.id]?.click()}>🏆 Upload Certificate to Complete</button></div>}
        {isComplete&&hasCert&&<div style={{fontSize:11,color:"#3b82f6"}}>📄 {t.certificate?.name} <input type="file" accept=".pdf,.jpg,.jpeg,.png" ref={r=>certRefs.current[t.id]=r} style={{display:"none"}} onChange={e=>handleUploadCert(t.id,e.target.files[0])}/><button style={{...S.btn("#64748b"),fontSize:11,padding:"2px 8px",marginLeft:6}} onClick={()=>certRefs.current[t.id]?.click()}>🔄</button></div>}
      </div>}
      {t.ctype==="Read and Quiz"&&<button style={{...S.btn("#64748b"),padding:"3px 10px",fontSize:11,marginBottom:isComplete?0:8}} onClick={()=>setShowHistory(t)}>📊 Quiz History</button>}
      {st!=="complete"&&t.ctype!=="Certificate"&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
        {t.ctype==="Read and Acknowledge"&&<button style={{...S.btn("#3b82f6"),fontSize:12,padding:"5px 12px"}} onClick={()=>setActiveAck(t.id)}>✍️ Read & Initial</button>}
        {t.ctype==="Read and Quiz"&&<button style={{...S.btn("#475569"),fontSize:12,padding:"5px 12px"}} onClick={()=>setActiveRQ(t.id)}>📝 Read & Take Quiz</button>}
        {t.ctype==="Link"&&<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {t.link?<a href={t.link} target="_blank" rel="noreferrer" style={{...S.btn("#2563eb"),textDecoration:"none",display:"inline-block",fontSize:12,padding:"5px 12px"}}>🔗 Go to Training ↗</a>:<span style={{fontSize:12,color:"#64748b",fontStyle:"italic"}}>Link coming soon.</span>}
          <span style={{fontSize:11,color:"#64748b",fontStyle:"italic"}}>Leadership marks complete.</span>
        </div>}
      </div>}
    </div>;
  }

  return(
    <div style={S.page}>
      <Toasts/>
      {showBoard&&<Leaderboard employees={employees} library={library} selfId={empId} onClose={()=>setShowBoard(false)}/>}
      {showHistory&&<QuizHistory empId={empId} trId={showHistory.id} trName={showHistory.name} onClose={()=>setShowHistory(null)}/>}
      {activeQuiz&&quizTr&&Array.isArray(quizTr.quiz)&&quizTr.quiz.length>0&&<Quiz quiz={quizTr.quiz} name={quizTr.name} empId={empId} trId={activeQuiz} onPass={async()=>{
        await markDone(activeQuiz);
        // Generate certificate if enabled
        const libTrCert=library.find(t=>t.id===activeQuiz);
        if(libTrCert?.generate_cert){
          try{
            // Check if certificate already exists for this training
            const existing=await getEmployeeCertificates(empId);
            const alreadyHasCert=existing.some(c=>c.training_id===activeQuiz);
            if(!alreadyHasCert){
              const expiryDate=libTrCert.renewal_cycle&&libTrCert.renewal_cycle!=="One Time"?calcExpiryDate(todayStr,libTrCert.renewal_cycle,null)?.toISOString().split("T")[0]||"":"";
              await createGeneratedCertificate({
                employeeId:empId,trainingId:activeQuiz,
                trainingName:libTrCert.name,employeeName:emp.name,
                completionDate:todayStr,expiryDate,
                hours:libTrCert.default_hours||0,certType:"quiz",
              });
              const updated=await getEmployeeCertificates(empId);
              setGenCerts(updated);
              setTab("certs");
              toast(`🎓 Certificate generated! View it in your Certificates tab.`,"success");
            } else {
              const updated=await getEmployeeCertificates(empId);
              setGenCerts(updated);
            }
          }catch(e){
            console.error("cert gen error:",e);
            toast(`Could not generate certificate: ${e.message}`,"error");
          }
        }
        setActiveQuiz(null);setActiveRQ(null);
      }} onClose={()=>setActiveQuiz(null)}/>}
      {activeAck&&ackTr&&<Acknowledge tr={ackTr} empName={emp.name} onDone={i=>{markDone(activeAck,{initials:i,initialsDate:todayStr});setActiveAck(null);}} onClose={()=>setActiveAck(null)}/>}
      {activeRQ&&rqTr&&<ReadAndQuiz tr={rqTr} onTakeQuiz={()=>setActiveQuiz(activeRQ)} onClose={()=>setActiveRQ(null)}/>}
      <NavBar title={emp.name} sub={emp.pos} onHome={()=>{setEmpId(null);setTab("trainings");goHome();}}
        extra={<><button style={S.btn("#3b82f6")} onClick={()=>setShowBoard(true)}>🏆 Board</button><button style={S.btn("#64748b")} onClick={()=>{setEmpId(null);setTab("trainings");}}>Sign Out</button></>}/>
      <div style={{padding:16,maxWidth:780,margin:"0 auto"}}>
        {(()=>{
          const renewalAlerts=getEmpRenewalAlerts(emp,library);
          const hasExpired=renewalAlerts.some(a=>a.level==="expired");
          const hasUrgent=renewalAlerts.some(a=>a.level==="urgent");
          const hasWarning=renewalAlerts.some(a=>a.level==="warning");
          return<>
            <div style={{background:cleared?"#2563eb18":"#dc262618",border:`1px solid ${cleared?"#2563eb44":"#dc262644"}`,borderRadius:10,padding:"12px 16px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:24}}>{cleared?"✅":"⛔"}</span>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:cleared?"#3b82f6":"#f87171"}}>{cleared?"CLEARED — Eligible to work independently":"NOT CLEARED — Missing required training"}</div>
                  {!cleared&&<div style={{fontSize:12,color:"#475569",marginTop:2}}>Missing: {(missing||[]).map(t=>t.name).join(", ")}</div>}
                  {cleared&&lockedSince&&<div style={{fontSize:11,color:"#475569",marginTop:1}}>Cleared since {lockedSince}</div>}
                </div>
              </div>
              <ClearanceBadge cleared={cleared} lockedSince={lockedSince}/>
            </div>
            {renewalAlerts.length>0&&<div style={{marginBottom:12}}>
              {renewalAlerts.map((a,i)=><div key={i} style={{
                background:a.level==="expired"?"#dc262618":a.level==="urgent"?"#dc262612":"#47556912",
                border:`1px solid ${a.level==="expired"?"#dc262644":a.level==="urgent"?"#dc262633":"#47556933"}`,
                borderRadius:8,padding:"8px 12px",marginBottom:4,
                display:"flex",alignItems:"center",gap:8,fontSize:12
              }}>
                <span>{a.level==="expired"?"⛔":a.level==="urgent"?"🚨":"⚠️"}</span>
                <div style={{flex:1}}>
                  <span style={{fontWeight:700,color:a.level==="expired"?"#f87171":a.level==="urgent"?"#f87171":"#64748b"}}>
                    {a.level==="expired"?"Expired — renewal required":a.level==="urgent"?"Complete now — ":"Renewal due soon — "}
                  </span>
                  <span style={{color:"#475569"}}>{a.trainingName}</span>
                  {a.level!=="expired"&&<span style={{color:"#64748b",marginLeft:4}}>· {a.days} days remaining (expires {a.expiryDate})</span>}
                  {a.level==="expired"&&<span style={{color:"#64748b",marginLeft:4}}>· expired {a.expiryDate}</span>}
                </div>
              </div>)}
            </div>}
          </>;
        })()}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
          {[{l:"Done",v:`${done}/${assignedTrainings.length}`,c:done===assignedTrainings.length?"#3b82f6":"#60a5fa"},{l:"Hours Earned",v:`${completedHrs}h`,c:completedHrs>=reqHrs?"#3b82f6":"#64748b"},{l:"Required",v:`${reqHrs}h`,c:"#475569"},{l:"Badges",v:(badges||[]).map(b=>BADGES.find(x=>x.id===b)?.icon||"").join("")||"—",c:"#64748b"}].map(s=>(
            <div key={s.l} style={{...S.card,textAlign:"center",padding:10}}>
              <div style={{fontSize:s.l==="Badges"?16:18,fontWeight:700,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:"#64748b",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{...S.card,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <div style={S.lbl}>Annual Training Hours</div>
            <span style={{fontSize:11,color:"#64748b"}}>{emp.type} · {isYear1(emp.hire)?"Year 1 (80h req)":"Year 2+ (40h req)"}</span>
          </div>
          <HoursBar completed={completedHrs} required={reqHrs}/>
          {completedHrs<reqHrs&&<div style={{fontSize:11,color:"#64748b",marginTop:4}}>{(reqHrs-completedHrs).toFixed(1)} hours still needed this year</div>}
          {completedHrs>=reqHrs&&<div style={{fontSize:11,color:"#3b82f6",marginTop:4}}>✓ Annual hour requirement met!</div>}
        </div>
        {(badges||[]).length>0&&<div style={{...S.card,marginBottom:12}}>
          <div style={{...S.lbl,marginBottom:8}}>🎖️ Your Badges</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {badges.map(bid=>{const b=BADGES.find(x=>x.id===bid);return b?<div key={bid} style={{background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:"8px 10px",textAlign:"center",minWidth:76}}><div style={{fontSize:20}}>{b.icon}</div><div style={{fontSize:10,fontWeight:700,marginTop:2}}>{b.label}</div></div>:null;})}
          </div>
        </div>}
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button style={S.btn(tab==="trainings"?"#3b82f6":"#94a3b8",true)} onClick={()=>setTab("trainings")}>📋 My Trainings</button>
          <button style={{...S.btn(tab==="certs"?"#3b82f6":"#94a3b8",true),position:"relative"}} onClick={()=>setTab("certs")}>
            🏆 Certificates
            {(certCount+genCerts.length)>0&&<span style={{background:"#3b82f6",color:"#f8fafc",borderRadius:99,fontSize:10,fontWeight:800,padding:"1px 6px",marginLeft:6}}>{certCount+genCerts.length}</span>}
          </button>
          <button style={{...S.btn(tab==="mydocs"?"#3b82f6":"#94a3b8",true),position:"relative"}} onClick={()=>setTab("mydocs")}>
            📄 My Documents
          </button>
        </div>
        {tab==="trainings"&&<div>
          <div style={{position:"relative",marginBottom:12}}>
            <input style={{...S.inp,paddingLeft:32,fontSize:13}} placeholder="Search trainings…" value={trSearch} onChange={e=>setTrSearch(e.target.value)}/>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#64748b",fontSize:13}}>🔍</span>
            {trSearch&&<button style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:14}} onClick={()=>setTrSearch("")}>✕</button>}
          </div>
          {searchLower&&filteredTrainings.length===0&&<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>No trainings match "{trSearch}"</div>}
          {groups.map(g=>{
            const grp=grouped[g.key]||[];
            const allInGroup=(assignedTrainings||[]).filter(t=>getGroupKey(t)===g.key);
            const grpDone=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="complete").length;
            const grpHrs=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="complete").reduce((a,t)=>a+effectiveHours(t,t),0);
            const grpOverdue=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="overdue").length;
            const grpSoon=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="soon").length;
            const isEmpty=allInGroup.length===0;
            return<CollapsibleSection key={g.key} label={g.label} color={g.color} bg={g.bg} done={grpDone} total={grp.length} hours={grpHrs} overdue={grpOverdue} dueSoon={grpSoon} isEmpty={isEmpty}>
              {grp.map(t=><TrainingCard key={t.id} t={t}/>)}
            </CollapsibleSection>;
          })}
        </div>}
        {tab==="certs"&&<div style={S.card}>
          {genCerts.length>0&&<>
            <div style={{...S.lbl,marginBottom:10}}>🎓 ComplianceReady Certificates</div>
            {genCerts.map(c=>{
              const isExpired=c.expiry_date&&new Date(c.expiry_date)<new Date();
              return<div key={c.id} style={{padding:"12px 14px",background:"#f8fafc",borderRadius:8,border:`1px solid ${isExpired?"#dc262644":"#2563eb44"}`,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13}}>{c.training_name}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>
                      Completed: {c.completion_date}
                      {c.hours>0&&` · ${c.hours}h`}
                      {c.expiry_date&&` · Valid through: ${c.expiry_date}`}
                    </div>
                    <div style={{fontSize:10,color:"#475569",marginTop:2,fontFamily:"monospace"}}>{c.cert_id}</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {isExpired?<span style={{background:"#dc262622",color:"#f87171",padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700}}>Expired</span>
                    :<span style={{background:"#2563eb22",color:"#3b82f6",padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700}}>✓ Valid</span>}
                    <button style={{...S.btn("#3b82f6"),padding:"4px 10px",fontSize:11}} onClick={()=>printCertificate(c)}>🖨️ Print</button>
                  </div>
                </div>
              </div>;
            })}
            <div style={{borderTop:"1px solid #cbd5e1",margin:"12px 0"}}/>
          </>}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={S.lbl}>📁 Uploaded Certificates</div>
            {certCount>0&&<span style={{background:"#2563eb22",color:"#3b82f6",border:"1px solid #2563eb55",padding:"2px 10px",borderRadius:99,fontSize:12,fontWeight:700}}>🏆 {certCount} uploaded</span>}
          </div>
          <p style={{fontSize:12,color:"#64748b",margin:"0 0 12px"}}>Upload completion certificates (PDF, JPG, PNG — max 5MB).</p>
          <div style={{position:"relative",marginBottom:12}}>
            <input style={{...S.inp,paddingLeft:30,fontSize:12}} placeholder="Search certificates…" value={certSearch||""} onChange={e=>setCertSearch(e.target.value)}/>
            <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#64748b",fontSize:13}}>🔍</span>
            {certSearch&&<button style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:14}} onClick={()=>setCertSearch("")}>✕</button>}
          </div>
          {(certSearch?assignedTrainings.filter(t=>t.name.toLowerCase().includes(certSearch.toLowerCase())):assignedTrainings).map(t=>{
            const cert=t.certificate;
            return<div key={t.id} style={{padding:"10px 12px",background:"#f8fafc",borderRadius:8,border:`1px solid ${cert?"#2563eb44":"#94a3b8"}`,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontWeight:600,fontSize:13}}>{t.name}</span>
                  {cert&&<span style={{background:"#2563eb22",color:"#3b82f6",border:"1px solid #2563eb55",padding:"1px 6px",borderRadius:99,fontSize:10,fontWeight:700}}>🏆 ✓</span>}
                </div>
                {cert?<div style={{fontSize:11,color:"#3b82f6",marginTop:2}}>✓ {cert.name} · {cert.date}</div>:<div style={{fontSize:11,color:"#475569",marginTop:2}}>No certificate uploaded</div>}
              </div>
              <div style={{display:"flex",gap:6}}>
                {cert&&cert.storagePath&&<button style={{...S.btn("#3b82f6"),padding:"4px 10px",fontSize:11}} onClick={()=>downloadCertificate(cert.storagePath,cert.name)}>⬇ View</button>}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" ref={r=>certRefs.current[t.id]=r} style={{display:"none"}} onChange={e=>handleUploadCert(t.id,e.target.files[0])}/>
                <button style={{...S.btn(cert?"#94a3b8":"#3b82f6"),padding:"4px 10px",fontSize:11}} onClick={()=>certRefs.current[t.id]?.click()}>{cert?"🔄 Replace":"⬆ Upload"}</button>
              </div>
            </div>;
          })}
        </div>}
        {tab==="mydocs"&&<EmpMyDocuments empId={empId} empName={emp.name}/>}
      </div>
    </div>
  );
}

// ── WRITE-UP CONSTANTS ────────────────────────────────────────────────────────
const WU_TIERS = ["Coaching Note","Corrective Action","Termination Documentation"];
const WU_CATEGORIES = ["Attendance","Performance","Policy Violation","Conduct","Safety","Other"];
const WU_AREAS_OF_CONCERN = ["Youth Safety","Supervision Ratio","Documentation/Records","Medication Administration","Behavior Management","Boundaries/Professionalism","Punctuality/Attendance","Communication","Policy Compliance","Licensing/Regulatory","Other"];
const WU_ACTIONS = ["No Action — Documentation Only","Verbal Counseling","Written Warning","Performance Improvement Plan (PIP)","Additional Training Required","Removal from Shift","Suspension — With Pay","Suspension — Without Pay","Demotion","Termination","Other"];
const WU_TIER_COLOR = {"Coaching Note":"#3b82f6","Corrective Action":"#64748b","Termination Documentation":"#dc2626"}; const WU_REPORTABLE_TYPES = ["Abuse / Neglect Allegation","Runaway / Missing Child","Serious Injury","Restraint / Emergency Behavior Intervention","Medication Error","Property Damage","Law Enforcement Involvement","Suicide Attempt / Self-Harm","Other Reportable Event"];

function printWriteUp(wu, empName) {
  const tierColor = WU_TIER_COLOR[wu.tier] || "#94a3b8";
  const html = `<!DOCTYPE html><html><head><title>Write-Up — ${empName}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;font-size:13px;color:#1e293b;}
    h1{font-size:20px;margin:0 0 4px;}
    .tier{display:inline-block;background:${tierColor}22;color:${tierColor};border:1px solid ${tierColor}44;padding:3px 12px;border-radius:99px;font-size:12px;font-weight:bold;margin-bottom:16px;}
    .section{margin-bottom:16px;}
    .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:3px;}
    .value{font-size:13px;color:#1e293b;background:#f8fafc;padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;min-height:28px;overflow-wrap:break-word;word-wrap:break-word;}     body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}     .section,.value{page-break-inside:avoid;break-inside:avoid;}
    .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;}
    .sig-row{display:flex;gap:40px;margin-top:32px;}
    .sig{flex:1;border-top:1px solid #1e293b;padding-top:6px;font-size:10px;color:#64748b;}
    @media print{@page{margin:0.5in;}}
  </style></head><body>
  <h1>Employee Documentation — ${wu.tier}</h1>
  <div class="tier">${wu.tier}</div>
  <div class="grid">
    <div><div class="label">Employee</div><div class="value">${empName}</div></div>
    <div><div class="label">Incident Date</div><div class="value">${wu.incident_date}</div></div>
    <div><div class="label">Documentation Date</div><div class="value">${wu.doc_date}</div></div>
  </div>
  <div class="grid">
    <div><div class="label">Category</div><div class="value">${wu.category}</div></div>
    <div><div class="label">Area of Concern</div><div class="value">${wu.area_of_concern||"—"}</div></div>
    <div><div class="label">Action Taken</div><div class="value">${wu.action_taken||"—"}</div></div>
  </div>
  ${wu.followup_date?`<div class="grid"><div><div class="label">Follow-Up Date</div><div class="value">${wu.followup_date}</div></div><div></div><div></div></div>`:""}
  <div class="section"><div class="label">Description of Incident</div><div class="value" style="min-height:80px;white-space:pre-wrap">${wu.description}</div></div>
  ${wu.coaching_notes?`<div class="section"><div class="label">Coaching Discussion / Why This Matters</div><div class="value" style="min-height:60px;white-space:pre-wrap">${wu.coaching_notes}</div></div>`:""}   ${wu.improvement_plan?`<div class="section"><div class="label">Improvement Plan / Expectations</div><div class="value" style="min-height:60px;white-space:pre-wrap">${wu.improvement_plan}</div></div>`:""}
  ${wu.attachment_name?`<div class="section"><div class="label">Attached File</div><div class="value">📎 ${wu.attachment_name}</div></div>`:""}
  ${wu.employee_response?`<div class="section"><div class="label">Employee Statement</div><div class="value" style="min-height:60px;white-space:pre-wrap;background:#fffbeb">${wu.employee_response}</div></div>`:""}
  <div class="sig-row">
    <div class="sig">Supervisor / Created By: ${wu.created_by||""}</div>
    <div class="sig">Employee Signature & Date</div>
    ${wu.acknowledged_at?`<div class="sig">Acknowledged: ${wu.acknowledged_at}</div>`:"<div class='sig'>Date</div>"}
  </div>
  </body></html>`;
  const w = window.open("","_blank"); w.document.write(html); w.document.close(); w.print();
}

// ── WRITE-UP MODAL (Leadership) ───────────────────────────────────────────────
const WU_PROMPTS = {
  "Coaching Note": {
    description: {label:"What behavior or performance concern was observed?", placeholder:"Describe specifically what was observed, when, and in what context. Include any prior conversations if applicable."},
    coaching: {label:"What was discussed with the employee and why it matters?", placeholder:"Summarize the coaching conversation. What did you explain about why this behavior matters — for safety, licensing, the youth, or the team? Include the employee's verbal response if relevant."},
    improvement_plan: {label:"What was discussed and what is the expected change?", placeholder:"Summarize the conversation with the employee. What specific behavior or performance improvement is expected, and by when?"},
  },
"Corrective Action": {
    description: {label:"Describe the policy violation or performance issue", placeholder:"Detail the specific policy, procedure, or performance standard that was not met. Include dates, times, and any witnesses if relevant."},
    coaching: {label:"Coaching discussion and why this matters", placeholder:"What was discussed in the corrective meeting? Why does this behavior matter for youth safety, licensing compliance, or organizational standards? Note the employee's response."},
    improvement_plan: {label:"Required corrective actions and timeline", placeholder:"List specific actions the employee must take, measurable improvement targets, and the timeline. Note any prior coaching or warnings."},
  },
  "Termination Documentation": {
    description: {label:"Reason for separation", placeholder:"State the reason for termination clearly and factually. Reference prior documentation (coaching notes, corrective actions) if applicable."},
    coaching: {label:"Final meeting notes", placeholder:"Document what was communicated to the employee in the termination meeting. Include who was present and any relevant discussion."},
    improvement_plan: {label:"Separation details and next steps", placeholder:"Final date of employment, return of company property (keys, badge, etc.), final pay information, eligibility for rehire, COBRA/benefits notification if applicable."},
 },
};
function WriteUpModal({emp, wu, onClose, onSaved, toast}){
  const isNew = !wu?.id;
  const [form, setForm] = useState({
    tier: wu?.tier || "Coaching Note",
    category: wu?.category || "Attendance",
    area_of_concern: wu?.area_of_concern || "",
    incident_date: wu?.incident_date || todayStr,
    doc_date: wu?.doc_date || todayStr,
    description: wu?.description || "",
    action_taken: wu?.action_taken || "",
    coaching_notes: wu?.coaching_notes || "",
    improvement_plan: wu?.improvement_plan || "",
    reportable_event: wu?.reportable_event || "",
    followup_date: wu?.followup_date || "",
    created_by: wu?.created_by || "",
    status: wu?.status || "draft",
    attachment_path: wu?.attachment_path || "",
    attachment_name: wu?.attachment_name || "",
  });
  const [saving, setSaving] = useState(false);
  const [attachFile, setAttachFile] = useState(null);
  const fileInputRef = useRef(null);
  const prompts = WU_PROMPTS[form.tier] || WU_PROMPTS["Coaching Note"];
  const tierColor = WU_TIER_COLOR[form.tier]||"#94a3b8";

  async function handleSave(deliver=false){
    if(!form.description.trim()){toast("Description required","error");return;}
    setSaving(true);
    try{
      let attachment_path=form.attachment_path, attachment_name=form.attachment_name;
      if(attachFile){
        try{
          const uploaded=await uploadWriteUpFile(emp.id,attachFile);
          attachment_path=uploaded.path;attachment_name=uploaded.name;
        }catch(upErr){toast(`File attached locally but upload failed: ${upErr.message}`,"warn");}
      }
      const payload = {
        ...form,
        attachment_path, attachment_name,
        id: wu?.id,
        employee_id: emp.id,
        status: deliver ? "delivered" : form.status,
        delivered_at: deliver ? todayStr : (wu?.delivered_at||""),
        acknowledged_at: wu?.acknowledged_at||"",
        employee_response: wu?.employee_response||"",
      };
      await saveWriteUp(payload);
      toast(deliver ? "Write-up delivered to employee ✓" : "Write-up saved ✓", "success");
      if(onSaved)await onSaved();
      onClose();
    }catch(e){toast(`Could not save: ${e.message}`,"error");}
    setSaving(false);
  }

  return<Modal title={isNew?`New Write-Up — ${emp.name}`:`Edit Write-Up — ${emp.name}`} onClose={onClose} wide>
    {/* Company header */}
    <div style={{background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:"10px 14px",marginBottom:14,textAlign:"center"}}>
      <div style={{fontWeight:800,fontSize:13,color:"#1e293b"}}>Southall Heritage Youth Home</div>
      <div style={{fontSize:11,color:"#64748b"}}>General Residential Operation · Employee Documentation</div>
    </div>

    {/* Tier selector */}
    <div style={{marginBottom:14}}>
      <label style={S.lbl}>Documentation Type</label>
      <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}>
        {WU_TIERS.map(t=><button key={t} type="button" style={{padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",border:`1px solid ${form.tier===t?WU_TIER_COLOR[t]:"#94a3b8"}`,background:form.tier===t?WU_TIER_COLOR[t]+"22":"transparent",color:form.tier===t?WU_TIER_COLOR[t]:"#64748b",flex:1,minWidth:120}} onClick={()=>setForm(p=>({...p,tier:t}))}>{t}</button>)}
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
      <div><label style={S.lbl}>Category</label>
        <select style={{...S.sel,width:"100%"}} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
          {WU_CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div><label style={S.lbl}>Area of Concern</label>
        <select style={{...S.sel,width:"100%"}} value={form.area_of_concern} onChange={e=>setForm(p=>({...p,area_of_concern:e.target.value}))}>
          <option value="">— Select —</option>
          {WU_AREAS_OF_CONCERN.map(a=><option key={a}>{a}</option>)}
        </select>
      </div>
      <div><label style={S.lbl}>Action Taken</label>
        <select style={{...S.sel,width:"100%"}} value={form.action_taken} onChange={e=>setForm(p=>({...p,action_taken:e.target.value}))}>
          <option value="">— Select —</option>
          {WU_ACTIONS.map(a=><option key={a}>{a}</option>)}
        </select>
      </div>
      <div><label style={S.lbl}>Incident Date</label><input type="date" style={S.inp} value={form.incident_date} onChange={e=>setForm(p=>({...p,incident_date:e.target.value}))}/></div>
      <div><label style={S.lbl}>Documentation Date</label><input type="date" style={{...S.inp}} value={form.doc_date} onChange={e=>setForm(p=>({...p,doc_date:e.target.value}))}/></div>
      <div><label style={S.lbl}>Follow-Up Date (optional)</label><input type="date" style={{...S.inp}} value={form.followup_date} onChange={e=>setForm(p=>({...p,followup_date:e.target.value}))}/></div>
      <div><label style={S.lbl}>Documented By</label><input style={S.inp} value={form.created_by} onChange={e=>setForm(p=>({...p,created_by:e.target.value}))} placeholder="Your name"/></div>
    </div>

    {/* File Attachment */}
    <div style={{marginBottom:12,background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:"10px 12px"}}>
      <label style={S.lbl}>📎 Attach File (optional)</label>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" ref={fileInputRef} style={{display:"none"}} onChange={e=>setAttachFile(e.target.files[0]||null)}/>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:4}}>
        <button type="button" style={{...S.btn("#64748b"),fontSize:12,padding:"5px 12px"}} onClick={()=>fileInputRef.current?.click()}>📎 Choose File</button>
        {attachFile&&<span style={{fontSize:12,color:"#3b82f6"}}>✓ {attachFile.name}</span>}
        {!attachFile&&form.attachment_name&&<span style={{fontSize:12,color:"#475569"}}>📄 {form.attachment_name} on file</span>}
      </div>
    </div>

    {/* Reportable Event */}     <div style={{marginBottom:12}}>       <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 12px",background:form.reportable_event?"#dc262618":"#f8fafc",borderRadius:8,border:`1px solid ${form.reportable_event?"#dc262644":"#94a3b8"}`}}>         <input type="checkbox" checked={!!form.reportable_event} onChange={e=>{if(!e.target.checked)setForm(p=>({...p,reportable_event:""}));else setForm(p=>({...p,reportable_event:"Abuse / Neglect Allegation"}));}} style={{accentColor:"#dc2626",width:16,height:16}}/>         <div>           <div style={{fontWeight:700,fontSize:12,color:form.reportable_event?"#f87171":"#475569"}}>⚠️ Licensing Reportable Event</div>           <div style={{fontSize:11,color:"#64748b",marginTop:1}}>Check if this incident requires DFPS / licensing notification</div>         </div>       </label>       {form.reportable_event&&<select style={{...S.sel,width:"100%",marginTop:8,borderColor:"#dc262644"}} value={form.reportable_event} onChange={e=>setForm(p=>({...p,reportable_event:e.target.value}))}>         {WU_REPORTABLE_TYPES.map(t=><option key={t}>{t}</option>)}       </select>}     </div>      {/* Guided description */}
    <div style={{marginBottom:12}}>
      <label style={S.lbl}>{prompts.description.label}</label>
      <div style={{fontSize:11,color:"#475569",marginBottom:4,fontStyle:"italic"}}>Be specific — include dates, times, locations, and observed behaviors.</div>
      <textarea style={{...S.inp,minHeight:110,resize:"vertical"}} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder={prompts.description.placeholder}/>
    </div>

    {/* Coaching discussion */}     <div style={{marginBottom:12}}>       <label style={S.lbl}>{prompts.coaching?.label||"Coaching discussion and why this matters"}</label>       <div style={{fontSize:11,color:"#475569",marginBottom:4,fontStyle:"italic"}}>Document the conversation — what was said, the employee's response, and why this matters for youth safety, compliance, or the team.</div>       <textarea style={{...S.inp,minHeight:90,resize:"vertical",borderColor:"#3b82f644"}} value={form.coaching_notes} onChange={e=>setForm(p=>({...p,coaching_notes:e.target.value}))} placeholder={prompts.coaching?.placeholder||"What was discussed with the employee?"}/>     </div>      {/* Guided improvement plan */}
    <div style={{marginBottom:14}}>
      <label style={S.lbl}>{prompts.improvement_plan.label}</label>
      <div style={{fontSize:11,color:"#475569",marginBottom:4,fontStyle:"italic"}}>{form.tier==="Termination Documentation"?"Include all separation logistics.":"Be clear and measurable. Vague expectations are not defensible."}</div>
      <textarea style={{...S.inp,minHeight:90,resize:"vertical"}} value={form.improvement_plan} onChange={e=>setForm(p=>({...p,improvement_plan:e.target.value}))} placeholder={prompts.improvement_plan.placeholder}/>
    </div>

    {/* Employee response if exists */}
    {wu?.employee_response&&<div style={{marginBottom:14,background:"#f8fafc11",border:"1px solid #64748b44",borderRadius:8,padding:12}}>
      <div style={{...S.lbl,color:"#64748b",marginBottom:4}}>Employee Statement</div>
      <div style={{fontSize:13,color:"#1e293b",whiteSpace:"pre-wrap"}}>{wu.employee_response}</div>
      {wu.acknowledged_at&&<div style={{fontSize:11,color:"#64748b",marginTop:4}}>Acknowledged: {wu.acknowledged_at}</div>}
    </div>}

    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <button style={S.btn("#64748b")} disabled={saving} onClick={()=>handleSave(false)}>💾 Save Draft</button>
      {wu?.status!=="acknowledged"&&<button style={S.btn("#2563eb")} disabled={saving} onClick={()=>handleSave(true)}>✅ Save & Deliver to Employee</button>}
      {wu?.id&&<button style={S.btn("#3b82f6")} onClick={()=>printWriteUp({...wu,...form},emp.name)}>🖨️ Print</button>}
    </div>
  </Modal>;
}

// ── WRITE-UP LIST (Leadership) ────────────────────────────────────────────────
function QuickAttachModal({emp, onClose, onSaved, toast}){
  const [tier, setTier] = useState("Coaching Note");
  const [note, setNote] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  async function handleSave(){
    if(!file&&!note.trim()){toast("Attach a file or add a quick note","error");return;}
    setSaving(true);
    try{
      let attachment_path="",attachment_name="";
      if(file){
        const uploaded=await uploadWriteUpFile(emp.id,file);
        attachment_path=uploaded.path;attachment_name=uploaded.name;
      }
      await saveWriteUp({
        tier, category:"Other", area_of_concern:"", incident_date:todayStr, doc_date:todayStr,
        description: note.trim()||`Quick attached document: ${attachment_name}`,
        action_taken:"", coaching_notes:"", improvement_plan:"", reportable_event:"",
        followup_date:"", created_by:createdBy, status:"draft",
        attachment_path, attachment_name, employee_id: emp.id,
      });
      toast("Document attached ✓","success");
      if(onSaved)await onSaved();
      onClose();
    }catch(e){toast(`Could not save: ${e.message}`,"error");}
    setSaving(false);
  }

  return<Modal title={`📎 Quick Attach — ${emp.name}`} onClose={onClose}>
    <p style={{fontSize:12,color:"#64748b",margin:"0 0 12px"}}>Fast path for filing a document with minimal data entry — no full write-up form required.</p>
    <label style={S.lbl}>Documentation Type</label>
    <select style={{...S.sel,width:"100%",marginBottom:10}} value={tier} onChange={e=>setTier(e.target.value)}>
      {WU_TIERS.map(t=><option key={t}>{t}</option>)}
    </select>
    <label style={S.lbl}>Quick Note (optional)</label>
    <textarea style={{...S.inp,minHeight:60,resize:"vertical",marginBottom:10}} value={note} onChange={e=>setNote(e.target.value)} placeholder="Brief note about this document…"/>
    <label style={S.lbl}>Documented By</label>
    <input style={{...S.inp,marginBottom:10}} value={createdBy} onChange={e=>setCreatedBy(e.target.value)} placeholder="Your name"/>
    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" ref={fileRef} style={{display:"none"}} onChange={e=>setFile(e.target.files[0]||null)}/>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
      <button type="button" style={{...S.btn("#64748b"),fontSize:12}} onClick={()=>fileRef.current?.click()}>📎 Choose File</button>
      {file&&<span style={{fontSize:12,color:"#3b82f6"}}>✓ {file.name}</span>}
    </div>
    <button style={S.btn("#3b82f6",true)} disabled={saving} onClick={handleSave}>{saving?"⏳ Saving…":"📎 Attach & Save"}</button>
  </Modal>;
}

function WriteUpsPanel({emp, onClose, isHR, toast}){
  const [wus, setWus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null=list, 'new'=new, wu=edit
  const [quickAttach, setQuickAttach] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [refuseModal, setRefuseModal] = useState(null);
  const [refusedBy, setRefusedBy] = useState("");

  useEffect(()=>{load();},[emp.id]);

  async function load(){
    setLoading(true);
    try{const data=await getWriteUps(emp.id);setWus(data);}
    catch(e){toast(`Could not load: ${e.message}`,"error");}
    setLoading(false);
  }

  async function handleDelete(id){
    setConfirm({msg:"Delete this write-up permanently?",onYes:async()=>{
      try{await deleteWriteUp(id);await load();toast("Deleted","warn");}
      catch(e){toast(`Could not delete: ${e.message}`,"error");}
      setConfirm(null);
    }});
  }

  async function handleRefuseToSign(wu){     if(!refusedBy.trim()){toast("Enter who documented the refusal","error");return;}     try{       await saveWriteUp({...wu,refused_to_sign:true,refused_to_sign_at:todayStr,refused_to_sign_by:refusedBy.trim()});       await load();setRefuseModal(null);setRefusedBy("");       toast("Refusal to sign documented ✓","warn");     }catch(e){toast(`Could not save: ${e.message}`,"error");}   }    if(editing!==null)return<WriteUpModal emp={emp} wu={editing==="new"?null:editing} onClose={()=>setEditing(null)} onSaved={load} toast={toast}/>;
  if(quickAttach)return<QuickAttachModal emp={emp} onClose={()=>setQuickAttach(false)} onSaved={load} toast={toast}/>;

  return<Modal title={`📋 Write-Ups — ${emp.name}`} onClose={onClose} wide>
    {confirm&&<Confirm msg={confirm.msg} onYes={confirm.onYes} onNo={()=>setConfirm(null)}/>}
    {refuseModal&&<div style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:16}}>       <div style={{...S.card,maxWidth:420,width:"100%"}}>         <div style={{textAlign:"center",marginBottom:14}}>           <div style={{fontSize:36,marginBottom:8}}>⛔</div>           <h3 style={{margin:"0 0 4px",fontSize:15,fontWeight:700}}>Document Refusal to Sign</h3>           <p style={{margin:0,fontSize:12,color:"#475569"}}>This records that the employee was presented the write-up but refused to acknowledge or sign it.</p>         </div>         <label style={S.lbl}>Documented By (your name)</label>         <input style={{...S.inp,marginBottom:12}} value={refusedBy} onChange={e=>setRefusedBy(e.target.value)} placeholder="Your name" onKeyDown={e=>e.key==="Enter"&&handleRefuseToSign(refuseModal)}/>         <div style={{display:"flex",gap:8}}>           <button style={S.btn("#dc2626",true)} onClick={()=>handleRefuseToSign(refuseModal)}>⛔ Document Refusal</button>           <button style={S.btn("#64748b")} onClick={()=>{setRefuseModal(null);setRefusedBy("");}}>Cancel</button>         </div>       </div>     </div>}
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      <button style={S.btn("#dc2626")} onClick={()=>setEditing("new")}>+ New Write-Up</button>
      <button style={S.btn("#3b82f6")} onClick={()=>setQuickAttach(true)}>📎 Quick Attach</button>
    </div>
    {loading&&<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>Loading…</div>}
    {!loading&&wus.length===0&&<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>No write-ups on file.</div>}
    {!loading&&wus.map(wu=>{
      const tc=WU_TIER_COLOR[wu.tier]||"#64748b";
      return<div key={wu.id} style={{...S.card,marginBottom:10,borderColor:tc+"44"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:6}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <span style={{background:tc+"22",color:tc,padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:700}}>{wu.tier}</span>
            <span style={{background:"#e2e8f0",color:"#475569",padding:"2px 8px",borderRadius:99,fontSize:10}}>{wu.category}</span>
            {wu.area_of_concern&&<span style={{background:"#dc262618",color:"#dc2626",padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700}}>⚠ {wu.area_of_concern}</span>}
          </div>
          <div style={{display:"flex",gap:6}}>
            <span style={{fontSize:11,color:wu.status==="acknowledged"?"#3b82f6":"#64748b",fontWeight:700}}>
              {wu.status==="acknowledged"?"✅ Acknowledged":wu.status==="delivered"?"📬 Delivered":"📝 Draft"}
            </span>
          </div>
        </div>
        <div style={{fontSize:12,color:"#1e293b",marginBottom:4,lineHeight:1.5}}>{wu.description.slice(0,120)}{wu.description.length>120?"…":""}</div>
        <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>
          Incident: {wu.incident_date} · Documented: {wu.doc_date}
          {wu.action_taken&&` · ${wu.action_taken}`}
          {wu.created_by&&` · By: ${wu.created_by}`}
          {wu.attachment_name&&` · 📎 ${wu.attachment_name}`}
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button style={{...S.btn("#64748b"),padding:"4px 10px",fontSize:11}} onClick={()=>setEditing(wu)}>Edit</button>
          <button style={{...S.btn("#3b82f6"),padding:"4px 10px",fontSize:11}} onClick={()=>printWriteUp(wu,emp.name)}>🖨️ Print</button>
          {wu.attachment_path&&<button style={{...S.btn("#3b82f6"),padding:"4px 10px",fontSize:11}} onClick={()=>downloadWriteUpFile(wu.attachment_path,wu.attachment_name)}>⬇ File</button>}
          {wu.status==="delivered"&&!wu.refused_to_sign&&!wu.acknowledged_at&&<button style={{...S.btn("#7f1d1d"),padding:"4px 10px",fontSize:11}} onClick={()=>{setRefuseModal(wu);setRefusedBy("");}}>⛔ Refused to Sign</button>}
          {isHR&&<button style={{...S.btn("#7f1d1d"),padding:"4px 8px",fontSize:11}} onClick={()=>handleDelete(wu.id)}>✕</button>}
        </div>
      </div>;
    })}
  </Modal>;
}


// ── PIPELINE HELPERS ──────────────────────────────────────────────────────────
function calcPipelineStage(emp, library) {
  // Check Required for Clearance trainings
  const clearanceTrainings = library.filter(t => t.tags?.includes("Required for Clearance"));
  const clearanceDone = clearanceTrainings.length > 0 &&
    clearanceTrainings.every(t => {
      const v = emp.trainings?.[t.id];
      if (!v?.completed) return false;
      // Use getStatus to respect renewal cycles
      return getStatus(v.completed, v.dueDate, emp.hire, t.renewal_cycle, t.tags?.includes("Acknowledgement")) === "complete";
    });

  // Check Acknowledgements (only assigned ones)
  const ackTrainings = library.filter(t => t.tags?.includes("Acknowledgement") && emp.trainings?.[t.id]);
  const ackDone = ackTrainings.length === 0 || ackTrainings.every(t => !!emp.trainings?.[t.id]?.completed);

  // Check Pre-Service trainings (only assigned ones, excluding Required for Clearance overlap)
  const psTrainings = library.filter(t => t.tags?.includes("Pre-Service") && emp.trainings?.[t.id]);
  const psDone = psTrainings.length === 0 || psTrainings.every(t => {
    const v = emp.trainings?.[t.id];
    if (!v?.completed) return false;
    return getStatus(v.completed, v.dueDate, emp.hire, t.renewal_cycle, false) === "complete";
  });

  // Stage 4 — Fully Cleared
  // Either leader manually approved OR all three groups complete
  if (emp.fully_cleared_at || (clearanceDone && ackDone && psDone)) return 4;

  // Stage 3 — Provisionally Cleared
  if (clearanceDone && ackDone) return 3;

  // Stage 2 — HR Docs submitted (leader manually advances)
  if (emp.pipeline_stage >= 2) return 2;

  // Stage 1 — Hired
  return 1;
}

function PipelineBadge({stage}){
  const s = PIPELINE_STAGES.find(p => p.stage === stage) || PIPELINE_STAGES[0];
  return <span style={{background:s.bg,color:s.color,border:`1px solid ${s.color}44`,padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{s.label}</span>;
}

// ── PIPELINE PANEL ────────────────────────────────────────────────────────────
function PipelinePanel({employees, library, onRefresh, onBack, goHome}){
  const {toast, Toasts} = useToast();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [confirmModal, setConfirmModal] = useState(null);

  const enriched = employees.map(e => ({
    ...e,
    currentStage: calcPipelineStage(e, library),
  }));

  const filtered = enriched.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (stageFilter !== "All" && String(e.currentStage) !== stageFilter) return false;
    return true;
  });

  const stageCounts = PIPELINE_STAGES.map(s => ({
    ...s,
    count: enriched.filter(e => e.currentStage === s.stage).length,
  }));

  async function handleAdvanceToStage2(emp) {
    try {
      // Try supabase.js helper first, fall back to direct query
      try { await updatePipelineStage(emp.id, 2, emp.pipeline_flags || {}); }
      catch { await supabase.from('employees').update({pipeline_stage:2,pipeline_flags:emp.pipeline_flags||{}}).eq('id',emp.id); }
      await onRefresh();
      toast(`${emp.name} advanced to HR Docs Submitted ✓`, "success");
    } catch(e) { toast(`Error: ${e.message}`, "error"); }
    setConfirmModal(null);
  }

  async function handleFlagBackground(emp) {
    try {
      const flags = { ...(emp.pipeline_flags || {}), backgroundIssue: true };
      try { await updatePipelineStage(emp.id, 2, flags); }
      catch { await supabase.from('employees').update({pipeline_stage:2,pipeline_flags:flags}).eq('id',emp.id); }
      await onRefresh();
      toast(`${emp.name} flagged for background review`, "warn");
    } catch(e) { toast(`Error: ${e.message}`, "error"); }
    setConfirmModal(null);
  }

  async function handleGrantFullClearance(emp) {
    try {
      try { await grantFullClearance(emp.id, "Leadership"); }
      catch { await supabase.from('employees').update({fully_cleared_at:todayStr,pipeline_stage:4}).eq('id',emp.id); }
      await onRefresh();
      toast(`${emp.name} — Fully Cleared ✅`, "success");
    } catch(e) { toast(`Error: ${e.message}`, "error"); }
    setConfirmModal(null);
  }

  function EmpPipelineCard({e}){
    const stage = e.currentStage;
    const stageInfo = PIPELINE_STAGES.find(s => s.stage === stage);
    const flagged = e.pipeline_flags?.backgroundIssue;
    const clearanceTrainings = library.filter(t => t.tags?.includes("Required for Clearance"));
    const clearanceDone = clearanceTrainings.filter(t => !!e.trainings?.[t.id]?.completed).length;
    const ackTrainings = library.filter(t => t.tags?.includes("Acknowledgement") && e.trainings?.[t.id]);
    const ackDone = ackTrainings.filter(t => !!e.trainings?.[t.id]?.completed).length;
    const psTrainings = library.filter(t => t.tags?.includes("Pre-Service") && e.trainings?.[t.id]);
    const psDone = psTrainings.filter(t => !!e.trainings?.[t.id]?.completed).length;

    return <div style={{...S.card, marginBottom:10, borderColor: flagged?"#dc2626":stageInfo.color+"44"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
        <div>
          <div style={{fontWeight:700,fontSize:14}}>{e.name}</div>
          <div style={{fontSize:11,color:"#60a5fa"}}>{e.pos}</div>
          <div style={{fontSize:10,color:"#64748b"}}>{e.staff_type||e.type} · Hired {e.hire}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
          <PipelineBadge stage={stage}/>
          {flagged&&<span style={{background:"#dc262622",color:"#f87171",border:"1px solid #dc262644",padding:"1px 8px",borderRadius:99,fontSize:10,fontWeight:700}}>🚩 Background Issue</span>}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
        {PIPELINE_STAGES.map(s=>{
          const done = e.currentStage >= s.stage;
          const current = e.currentStage === s.stage;
          return <div key={s.stage} style={{textAlign:"center",padding:"6px 4px",borderRadius:6,background:done?s.bg:"#f8fafc",border:`1px solid ${done?s.color+"44":"#94a3b8"}`}}>
            <div style={{fontSize:10,fontWeight:700,color:done?s.color:"#475569"}}>{done?"✓":s.stage}</div>
            <div style={{fontSize:9,color:done?s.color:"#475569",marginTop:1,lineHeight:1.3}}>{s.label}</div>
          </div>;
        })}
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:11,color:"#64748b",marginBottom:8}}>
        <span>🔑 {clearanceDone}/{clearanceTrainings.length} clearance</span>
        <span>✍️ {ackDone}/{ackTrainings.length} ack</span>
        <span>🔰 {psDone}/{psTrainings.length} pre-service</span>
      </div>

      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {stage===1&&<button style={{...S.btn("#3b82f6"),fontSize:11,padding:"4px 10px"}}
          onClick={()=>setConfirmModal({type:"advance2",emp:e})}>
          Mark HR Docs Submitted →
        </button>}
        {stage===2&&!flagged&&<button style={{...S.btn("#dc2626"),fontSize:11,padding:"4px 10px"}}
          onClick={()=>setConfirmModal({type:"flag",emp:e})}>
          🚩 Flag Background Issue
        </button>}
        {stage===2&&flagged&&<button style={{...S.btn("#64748b"),fontSize:11,padding:"4px 10px"}}
          onClick={async()=>{
            const flags={...(e.pipeline_flags||{}),backgroundIssue:false};
            try{ await updatePipelineStage(e.id,2,flags); }
            catch{ await supabase.from('employees').update({pipeline_stage:2,pipeline_flags:flags}).eq('id',e.id); }
            await onRefresh();
            toast("Flag cleared","info");
          }}>
          Clear Flag
        </button>}
        {stage===3&&<button style={{...S.btn("#2563eb"),fontSize:11,padding:"4px 10px"}}
          onClick={()=>setConfirmModal({type:"fullClear",emp:e})}>
          ✅ Grant Full Clearance
        </button>}
        {stage===4&&<span style={{fontSize:11,color:"#3b82f6",fontWeight:700}}>✅ Fully Cleared {e.fully_cleared_at}</span>}
      </div>
    </div>;
  }

  function printPipelineReport(){
    const rows = enriched.map(e => {
      const s = PIPELINE_STAGES.find(p => p.stage === e.currentStage);
      const flagged = e.pipeline_flags?.backgroundIssue;
      const clearanceTrainings = library.filter(t => t.tags?.includes("Required for Clearance"));
      const clearanceDone = clearanceTrainings.filter(t => !!e.trainings?.[t.id]?.completed).length;
      const ackTrainings = library.filter(t => t.tags?.includes("Acknowledgement") && e.trainings?.[t.id]);
      const ackDone = ackTrainings.filter(t => !!e.trainings?.[t.id]?.completed).length;
      const psTrainings = library.filter(t => t.tags?.includes("Pre-Service") && e.trainings?.[t.id]);
      const psDone = psTrainings.filter(t => !!e.trainings?.[t.id]?.completed).length;
      return `<tr>
        <td>${e.name}</td>
        <td>${e.pos}</td>
        <td>${e.staff_type||e.type}</td>
        <td>${e.hire}</td>
        <td style="font-weight:bold;color:${s?.color||'#64748b'}">${s?.label||'Hired'}${flagged?' 🚩':''}</td>
        <td style="text-align:center">${clearanceDone}/${clearanceTrainings.length}</td>
        <td style="text-align:center">${ackDone}/${ackTrainings.length}</td>
        <td style="text-align:center">${psDone}/${psTrainings.length}</td>
        <td>${e.fully_cleared_at||''}</td>
      </tr>`;
    }).join("");
    const stageSummary = PIPELINE_STAGES.map(s => {
      const count = enriched.filter(e => e.currentStage === s.stage).length;
      return `<div class="st"><div class="sn" style="color:${s.color}">${count}</div><div class="sl">${s.label}</div></div>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><title>Hire to Clearance Pipeline Report</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px;}h1{font-size:17px;margin:0 0 4px;}h2{font-size:12px;color:#334155;margin:0 0 16px;font-weight:normal;}table{width:100%;border-collapse:collapse;margin-top:12px;}th{background:#1e293b;color:white;padding:6px 8px;text-align:left;font-size:11px;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;}tr:nth-child(even){background:#f8fafc;}.sum{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;}.st{background:#f8fafc;padding:10px 16px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;min-width:80px;}.sn{font-size:20px;font-weight:bold;}.sl{font-size:10px;color:#64748b;}@media print{@page{margin:0.5in;}}</style>
    </head><body>
    <h1>Hire to Clearance Pipeline Report</h1>
    <h2>Southall Heritage Youth Home | Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})} · CONFIDENTIAL</h2>
    <div class="sum">${stageSummary}</div>
    <table><thead><tr>
      <th>Name</th><th>Position</th><th>Staff Type</th><th>Hire Date</th>
      <th>Pipeline Stage</th><th>Clearance</th><th>Ack</th><th>Pre-Service</th><th>Cleared Date</th>
    </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
    const w = window.open("","_blank"); w.document.write(html); w.document.close(); w.print();
  }

  return <div style={S.page}>
    <Toasts/>
    {confirmModal?.type==="advance2"&&<Confirm
      msg={`Mark HR docs as submitted for ${confirmModal.emp.name}?`}
      yesLabel="Yes, advance" yesColor="#3b82f6"
      onYes={()=>handleAdvanceToStage2(confirmModal.emp)}
      onNo={()=>setConfirmModal(null)}/>}
    {confirmModal?.type==="flag"&&<Confirm
      msg={`Flag ${confirmModal.emp.name} for a background issue? This will stop pipeline advancement until reviewed.`}
      yesLabel="Flag" yesColor="#dc2626"
      onYes={()=>handleFlagBackground(confirmModal.emp)}
      onNo={()=>setConfirmModal(null)}/>}
    {confirmModal?.type==="fullClear"&&<Confirm
      msg={`Grant FULL CLEARANCE to ${confirmModal.emp.name}? This confirms they are cleared to work independently and counted in ratio.`}
      yesLabel="Grant Full Clearance" yesColor="#2563eb"
      onYes={()=>handleGrantFullClearance(confirmModal.emp)}
      onNo={()=>setConfirmModal(null)}/>}

    <NavBar title="Hire to Clearance Pipeline" sub={`${employees.length} staff`} onBack={onBack} onHome={goHome}
      extra={<button style={S.btn("#64748b")} onClick={printPipelineReport}>🖨️ Print Report</button>}/>

    <div style={{padding:16,maxWidth:960,margin:"0 auto"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
        {stageCounts.map(s=><div key={s.stage} style={{...S.card,textAlign:"center",padding:12,borderColor:s.color+"44",cursor:"pointer",opacity:stageFilter===String(s.stage)?1:0.7}} onClick={()=>setStageFilter(stageFilter===String(s.stage)?"All":String(s.stage))}>
          <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.count}</div>
          <div style={{fontSize:11,fontWeight:700,color:s.color,marginTop:2}}>{s.label}</div>
          <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{s.desc}</div>
        </div>)}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:1,minWidth:200}}>
          <input style={{...S.inp,paddingLeft:30}} placeholder="Search staff…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#64748b",fontSize:13}}>🔍</span>
        </div>
        <select style={S.sel} value={stageFilter} onChange={e=>setStageFilter(e.target.value)}>
          <option value="All">All Stages</option>
          {PIPELINE_STAGES.map(s=><option key={s.stage} value={String(s.stage)}>{s.label}</option>)}
        </select>
      </div>

      {filtered.length===0&&<div style={{textAlign:"center",color:"#64748b",padding:"30px 0"}}>No staff match your filters.</div>}
      {filtered.map(e=><EmpPipelineCard key={e.id} e={e}/>)}
    </div>
  </div>;
}


// ── HR DOCUMENT CHECKLIST MODAL ───────────────────────────────────────────────
function HrChecklistModal({emp, onClose, toast}){
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [newDocName, setNewDocName] = useState("");
  const [newDocCategory, setNewDocCategory] = useState("Other");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(()=>{loadDocs();},[emp.id]);

  async function loadDocs(){
    setLoading(true);
    try{
      await initHrDocuments(emp.id);
      const data = await getHrDocuments(emp.id);
      setDocs(data);
    }catch(e){toast(`Could not load HR docs: ${e.message}`,"error");}
    setLoading(false);
  }

  async function handleToggle(doc){
    const newVal = !doc.submitted;
    setSaving(p=>({...p,[doc.id]:true}));
    try{
      await updateHrDocument(doc.id,{
        submitted: newVal,
        submitted_date: newVal ? todayStr : '',
        verified_by: doc.verified_by || '',
        notes: doc.notes || '',
      });
      setDocs(p=>p.map(d=>d.id===doc.id?{...d,submitted:newVal,submitted_date:newVal?todayStr:''}:d));
    }catch(e){toast(`Could not update: ${e.message}`,"error");}
    setSaving(p=>({...p,[doc.id]:false}));
  }

  async function handleDateChange(doc, date){
    try{
      await updateHrDocument(doc.id,{
        submitted: doc.submitted,
        submitted_date: date,
        verified_by: doc.verified_by || '',
        notes: doc.notes || '',
      });
      setDocs(p=>p.map(d=>d.id===doc.id?{...d,submitted_date:date}:d));
    }catch(e){toast(`Could not update: ${e.message}`,"error");}
  }

  async function handleNotesChange(doc, notes){
    try{
      await updateHrDocument(doc.id,{
        submitted: doc.submitted,
        submitted_date: doc.submitted_date || '',
        verified_by: doc.verified_by || '',
        notes,
      });
      setDocs(p=>p.map(d=>d.id===doc.id?{...d,notes}:d));
    }catch(e){console.error(e);}
  }

  async function handleAddDoc(){
    if(!newDocName.trim()){toast("Document name required","error");return;}
    try{
      await addHrDocument(emp.id, newDocName.trim(), newDocCategory);
      await loadDocs();
      setNewDocName("");
      setNewDocCategory("Other");
      setShowAdd(false);
      toast("Document added ✓","success");
    }catch(e){toast(`Could not add: ${e.message}`,"error");}
  }

  async function handleDeleteDoc(id, name){
    if(!window.confirm(`Remove "${name}" from checklist?`))return;
    try{
      await deleteHrDocument(id);
      setDocs(p=>p.filter(d=>d.id!==id));
      toast("Removed","warn");
    }catch(e){toast(`Could not remove: ${e.message}`,"error");}
  }

  const submitted = docs.filter(d=>d.submitted).length;
  const total = docs.length;
  const pct = total ? Math.round(submitted/total*100) : 0;

  // Group docs by category
  const idDocs = docs.filter(d=>(d.category||"Other")==="Identity & Background");
  const formDocs = docs.filter(d=>(d.category||"Other")==="Forms & Consents");
  const otherDocs = docs.filter(d=>(d.category||"Other")==="Other");

  function DocRow({doc}){
    const [editNotes, setEditNotes] = useState(false);
    return<div style={{padding:"8px 10px",background:doc.submitted?"#2563eb08":"#f8fafc",borderRadius:8,border:`1px solid ${doc.submitted?"#2563eb33":"#94a3b8"}`,marginBottom:6}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <input type="checkbox" checked={doc.submitted} disabled={!!saving[doc.id]}
          onChange={()=>handleToggle(doc)}
          style={{accentColor:"#2563eb",width:16,height:16,flexShrink:0,cursor:"pointer"}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:13,color:doc.submitted?"#3b82f6":"#1e293b"}}>{doc.doc_name}</div>
          {doc.submitted&&<div style={{fontSize:11,color:"#64748b",marginTop:1}}>
            Received: <input type="date" value={doc.submitted_date||""} onChange={e=>handleDateChange(doc,e.target.value)}
              style={{background:"transparent",border:"none",color:"#475569",fontSize:11,cursor:"pointer",outline:"none"}}/>
          </div>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {doc.submitted&&<span style={{fontSize:10,color:"#3b82f6",fontWeight:700}}>✓ Received</span>}
          <button style={{...S.btn("#64748b"),padding:"2px 7px",fontSize:10}} onClick={()=>setEditNotes(p=>!p)}>
            {doc.notes?"📝":"Notes"}
          </button>
          <button style={{...S.btn("#7f1d1d"),padding:"2px 6px",fontSize:10}} onClick={()=>handleDeleteDoc(doc.id,doc.doc_name)}>✕</button>
        </div>
      </div>
      {editNotes&&<div style={{marginTop:6,paddingLeft:26}}>
        <input style={{...S.inp,fontSize:12}} value={doc.notes||""} onChange={e=>handleNotesChange(doc,e.target.value)} placeholder="Add notes (e.g. expired, needs renewal, on file)…"/>
      </div>}
      {doc.notes&&!editNotes&&<div style={{marginTop:4,paddingLeft:26,fontSize:11,color:"#475569",fontStyle:"italic"}}>{doc.notes}</div>}
    </div>;
  }

  function DocGroup({label, items}){
    if(items.length===0)return null;
    const done=items.filter(d=>d.submitted).length;
    return<div style={{marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
        <span style={{fontSize:11,color:done===items.length?"#3b82f6":"#64748b"}}>{done}/{items.length}</span>
      </div>
      {items.map(doc=><DocRow key={doc.id} doc={doc}/>)}
    </div>;
  }

  return<Modal title={`HR Document Checklist — ${emp.name}`} onClose={onClose} wide>
    {loading?<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>Loading…</div>:<>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,background:"#f8fafc",borderRadius:8,padding:"10px 14px",border:"1px solid #cbd5e1"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:700}}>Documents Received</span>
            <span style={{fontSize:12,fontWeight:700,color:pct===100?"#3b82f6":pct>50?"#64748b":"#f87171"}}>{submitted}/{total}</span>
          </div>
          <div style={{background:"#ffffff",borderRadius:99,height:8,overflow:"hidden"}}>
            <div style={{width:`${pct}%`,background:pct===100?"#2563eb":pct>50?"#475569":"#dc2626",height:"100%",borderRadius:99,transition:"width 0.3s"}}/>
          </div>
        </div>
        {pct===100&&<span style={{fontSize:20}}>✅</span>}
      </div>

      <DocGroup label="Identity & Background" items={idDocs}/>
      <DocGroup label="Forms & Consents" items={formDocs}/>
      <DocGroup label="Other" items={otherDocs}/>

      {showAdd?<div style={{marginTop:8}}>
        <div style={{display:"flex",gap:8,marginBottom:6}}>
          <input style={{...S.inp,flex:1}} value={newDocName} onChange={e=>setNewDocName(e.target.value)} placeholder="Document name…" onKeyDown={e=>e.key==="Enter"&&handleAddDoc()}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <select style={{...S.sel,flex:1}} value={newDocCategory} onChange={e=>setNewDocCategory(e.target.value)}>
            {HR_DOC_CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
          <button style={S.btn("#2563eb")} onClick={handleAddDoc}>Add</button>
          <button style={S.btn("#64748b")} onClick={()=>{setShowAdd(false);setNewDocName("");setNewDocCategory("Other");}}>Cancel</button>
        </div>
      </div>:<button style={{...S.btn("#64748b",true),marginTop:8,fontSize:12}} onClick={()=>setShowAdd(true)}>+ Add Custom Document</button>}
    </>}
  </Modal>;
}


// ── TRAINING GUIDES PANEL ─────────────────────────────────────────────────────
const PREBUILT_GUIDES = [
  {
    name: "All Staff — Universal",
    description: "Required for every employee regardless of role. Includes mandatory reporting, trauma-informed care, human trafficking prevention, and policy acknowledgements.",
    staff_types: ["Direct Care Caregiver","Non-Caregiver Employee","Shift Supervisor","Case Manager","Treatment Director","Program Director","Licensed Child Care Administrator (LCCA)","Registered Nurse","Licensed Therapist","Behavior Support Specialist","Admissions / Placement Staff","Administrative / HR Staff","PRN / Part-Time Staff","Contractor / Volunteer"],
    training_ids: [],
    is_prebuilt: true,
    sort_order: 1,
  },
  {
    name: "Direct Care Caregiver — Basic (Chapter 748)",
    description: "Chapter 748 baseline pre-service and annual requirements for caregivers counted in ratio. Includes orientation, general pre-service, EBI/CPI, psychotropic medication, and mandatory reporting.",
    staff_types: ["Direct Care Caregiver","Shift Supervisor"],
    training_ids: [],
    is_prebuilt: true,
    sort_order: 2,
  },
  {
    name: "Direct Care Caregiver — T3C Tier I",
    description: "T3C Tier I service package requirements for direct delivery caregivers. Adds trauma-informed treatment model training, STAR Health coordination, and service package-specific training on top of Chapter 748 baseline.",
    staff_types: ["Direct Care Caregiver","Shift Supervisor"],
    training_ids: [],
    is_prebuilt: true,
    sort_order: 3,
  },
  {
    name: "Direct Care Caregiver — T3C Tier II",
    description: "T3C Tier II stabilization support requirements. Highest intensity training track. Includes all Tier I requirements plus specialized stabilization, de-escalation, and crisis response training.",
    staff_types: ["Direct Care Caregiver","Shift Supervisor"],
    training_ids: [],
    is_prebuilt: true,
    sort_order: 4,
  },
  {
    name: "Non-Caregiver Employee — Baseline",
    description: "Minimum required trainings for staff not counted in ratio. Includes orientation, mandatory abuse/neglect reporting, trauma awareness, and policy acknowledgements. Fewer hours required (20h annual).",
    staff_types: ["Non-Caregiver Employee","Administrative / HR Staff","Admissions / Placement Staff"],
    training_ids: [],
    is_prebuilt: true,
    sort_order: 5,
  },
  {
    name: "Human Trafficking Service Package",
    description: "Required for all staff at operations credentialed for Human Trafficking Victim/Survivor services. Includes Universal Human Trafficking Prevention Training, trauma-informed care for trafficking survivors, and specialized caregiver training.",
    staff_types: ["Direct Care Caregiver","Shift Supervisor","Case Manager","Licensed Therapist","Treatment Director"],
    training_ids: [],
    is_prebuilt: true,
    sort_order: 6,
  },
];

function TrainingGuidesPanel({library,employees,onRefresh,onBack,goHome,toast: parentToast}){
  const [guides,setGuides]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null); // guide id or "new"
  const [editData,setEditData]=useState({});
  const [assignModal,setAssignModal]=useState(null); // guide to bulk assign
  const [selectedEmps,setSelectedEmps]=useState([]);
  const [assigning,setAssigning]=useState(false);
  const [confirm,setConfirm]=useState(null);
  const {toast,Toasts}=useToast();

  useEffect(()=>{loadGuides();},[]);

  async function loadGuides(){
    setLoading(true);
    try{
      let g=await getTrainingGuides();
      // If no guides exist yet, seed the prebuilt ones
      if(g.length===0){
        for(const pg of PREBUILT_GUIDES){
          await saveTrainingGuide(pg);
        }
        g=await getTrainingGuides();
      }
      setGuides(g);
    }catch(e){toast(`Could not load guides: ${e.message}`,"error");}
    setLoading(false);
  }

  function startEdit(guide){
    setEditing(guide.id||"new");
    setEditData({
      name:guide.name||"",
      description:guide.description||"",
      staff_types:guide.staff_types||[],
      training_ids:guide.training_ids||[],
      id:guide.id||null,
    });
  }

  async function handleSave(){
    if(!editData.name.trim()){toast("Guide name required","error");return;}
    try{
      await saveTrainingGuide(editData);
      await loadGuides();
      setEditing(null);
      toast("Guide saved ✓","success");
    }catch(e){toast(`Could not save: ${e.message}`,"error");}
  }

  async function handleDelete(id,name){
    setConfirm({msg:`Delete guide "${name}"?`,onYes:async()=>{
      try{await deleteTrainingGuide(id);await loadGuides();toast("Guide deleted","warn");}
      catch(e){toast(`Could not delete: ${e.message}`,"error");}
      setConfirm(null);
    }});
  }

  async function handleBulkAssign(guide,empIds){
    if(!empIds||empIds.length===0){setAssignModal(null);return;}
    setAssigning(true);
    let assigned=0;
    const trainingIds=guide.training_ids||[];
    if(trainingIds.length===0){toast("No trainings in this guide","warn");setAssigning(false);return;}
    for(const eid of empIds){
      const emp=employees.find(e=>e.id===eid);
      if(!emp)continue;
      for(const trId of trainingIds){
        if(emp.trainings[trId])continue; // already assigned
        try{
          await assignTraining(eid,trId,nextAnniv(emp.hire));
          await new Promise(r=>setTimeout(r,80));
          assigned++;
        }catch(err){console.error("assign error:",err);}
      }
    }
    await onRefresh();
    setAssigning(false);
    setAssignModal(null);
    setSelectedEmps([]);
    toast(`✓ Assigned ${assigned} training(s) across ${empIds.length} employee(s)`,"success");
  }

  return(
    <div style={S.page}>
      <Toasts/>
      {confirm&&<Confirm msg={confirm.msg} onYes={confirm.onYes} onNo={()=>setConfirm(null)}/>}

      {assignModal&&<Modal title={`Bulk Assign — ${assignModal.name}`} onClose={()=>{setAssignModal(null);setSelectedEmps([]);}} wide>
        <div style={{background:"#f8fafc",borderRadius:8,padding:10,marginBottom:12,fontSize:12,color:"#475569"}}>
          <div style={{fontWeight:700,color:"#1e293b",marginBottom:4}}>Trainings in this guide ({(assignModal.training_ids||[]).length}):</div>
          {(assignModal.training_ids||[]).length===0
            ?<div style={{color:"#f87171"}}>No trainings added to this guide yet. Edit the guide to add trainings first.</div>
            :(assignModal.training_ids||[]).map(id=>{
              const tr=library.find(t=>t.id===id);
              return<div key={id} style={{marginBottom:2}}>• {tr?.name||id}</div>;
            })
          }
        </div>
        {(assignModal.training_ids||[]).length>0&&<>
          <p style={{fontSize:13,color:"#64748b",margin:"0 0 10px"}}>Select employees to assign these trainings to. Already-assigned trainings are skipped automatically.</p>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <button style={S.btn("#64748b")} onClick={()=>setSelectedEmps(employees.map(e=>e.id))}>All Staff</button>
            {assignModal.staff_types?.length>0&&<button style={S.btn("#3b82f6")} onClick={()=>{
              const matching=employees.filter(e=>assignModal.staff_types.includes(e.staff_type));
              setSelectedEmps(matching.map(e=>e.id));
              toast(`${matching.length} matching staff selected`,"info");
            }}>Matching Staff Types ({assignModal.staff_types.length} types)</button>}
            <button style={S.btn("#64748b")} onClick={()=>setSelectedEmps([])}>None</button>
          </div>
          <div style={{maxHeight:260,overflowY:"auto",background:"#f8fafc",borderRadius:8,padding:8,border:"1px solid #cbd5e1",marginBottom:12}}>
            {employees.map(e=><label key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px",borderBottom:"1px solid #ffffff",cursor:"pointer",fontSize:12}}>
              <input type="checkbox" checked={selectedEmps.includes(e.id)} onChange={ev=>setSelectedEmps(p=>ev.target.checked?[...p,e.id]:p.filter(x=>x!==e.id))} style={{accentColor:"#3b82f6"}}/>
              <span style={{fontWeight:600,flex:1}}>{e.name}</span>
              <span style={{color:"#64748b",fontSize:11}}>{e.staff_type||e.type}</span>
              {assignModal.staff_types?.includes(e.staff_type)&&<span style={{color:"#3b82f6",fontSize:10}}>✓ match</span>}
            </label>)}
          </div>
          <button style={S.btn("#2563eb",true)} disabled={assigning||selectedEmps.length===0} onClick={()=>handleBulkAssign(assignModal,selectedEmps)}>
            {assigning?`⏳ Assigning…`:`Assign to ${selectedEmps.length} Employee(s)`}
          </button>
        </>}
      </Modal>}

      <NavBar title="Training Guides" sub={`${guides.length} guides`} onBack={onBack} onHome={goHome}
        extra={<button style={S.btn("#2563eb")} onClick={()=>{setEditing("new");setEditData({name:"",description:"",staff_types:[],training_ids:[]});}}>+ New Guide</button>}/>

      <div style={{padding:16,maxWidth:900,margin:"0 auto"}}>
        <div style={{...S.card,marginBottom:16,background:"#dbeafe",border:"1px solid #3b82f6"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>What are Training Guides?</div>
          <div style={{fontSize:12,color:"#475569",lineHeight:1.7}}>
            Guides are curated lists of trainings grouped by role or service package. When onboarding a new employee, select the relevant guides and bulk assign all trainings at once. Guides never force assignments — they are recommendations that you act on. You can edit any guide or create custom ones for your SSCC's additional requirements.
          </div>
        </div>

        {loading&&<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>Loading guides…</div>}

        {editing==="new"&&<div style={{...S.card,marginBottom:12,border:"1px solid #2563eb44"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:"#3b82f6"}}>New Guide</div>
          <div style={{marginBottom:10}}><label style={S.lbl}>Guide Name</label><input style={S.inp} value={editData.name} onChange={e=>setEditData(p=>({...p,name:e.target.value}))} placeholder="e.g. My SSCC Custom Requirements"/></div>
          <div style={{marginBottom:10}}><label style={S.lbl}>Description</label><textarea style={{...S.inp,minHeight:60,resize:"vertical"}} value={editData.description} onChange={e=>setEditData(p=>({...p,description:e.target.value}))} placeholder="What this guide covers and who it applies to…"/></div>
          <div style={{marginBottom:10}}>
            <label style={S.lbl}>Applies to Staff Types (select all that apply)</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
              {STAFF_TYPES.map(st=>{
                const sel=editData.staff_types?.includes(st);
                return<button key={st} type="button" style={{padding:"4px 10px",borderRadius:99,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${sel?"#3b82f6":"#94a3b8"}`,background:sel?"#3b82f622":"transparent",color:sel?"#60a5fa":"#64748b"}}
                  onClick={()=>setEditData(p=>({...p,staff_types:sel?p.staff_types.filter(x=>x!==st):[...p.staff_types,st]}))}>
                  {st}
                </button>;
              })}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={S.lbl}>Trainings in this Guide ({editData.training_ids?.length||0} selected)</label>
            <div style={{maxHeight:240,overflowY:"auto",background:"#f8fafc",borderRadius:8,padding:8,border:"1px solid #cbd5e1",marginTop:4}}>
              {library.map(tr=>{
                const sel=editData.training_ids?.includes(tr.id);
                return<label key={tr.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 4px",borderBottom:"1px solid #ffffff",cursor:"pointer",fontSize:12}}>
                  <input type="checkbox" checked={!!sel} onChange={ev=>setEditData(p=>({...p,training_ids:ev.target.checked?[...p.training_ids,tr.id]:p.training_ids.filter(x=>x!==tr.id)}))} style={{accentColor:"#3b82f6"}}/>
                  <span style={{flex:1,fontWeight:600}}>{tr.name}</span>
                  <span style={{color:"#64748b",fontSize:10}}>{tr.tags?.join(", ")}</span>
                </label>;
              })}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={S.btn("#2563eb")} onClick={handleSave}>Save Guide</button>
            <button style={S.btn("#64748b")} onClick={()=>setEditing(null)}>Cancel</button>
          </div>
        </div>}

        {!loading&&guides.map(g=>{
          const isEditing=editing===g.id;
          const trCount=(g.training_ids||[]).length;
          return<div key={g.id} style={{...S.card,marginBottom:10}}>
            {!isEditing&&<div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{g.name}{g.is_prebuilt&&<span style={{fontSize:10,color:"#60a5fa",background:"#3b82f622",padding:"1px 7px",borderRadius:99,marginLeft:8,fontWeight:600}}>Pre-built</span>}</div>
                  {g.description&&<div style={{fontSize:12,color:"#475569",marginTop:3,lineHeight:1.5}}>{g.description}</div>}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6,alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#64748b"}}>📋 {trCount} training{trCount!==1?"s":""}</span>
                    {(g.staff_types||[]).slice(0,3).map(st=><span key={st} style={{background:"#3b82f622",color:"#60a5fa",padding:"1px 8px",borderRadius:99,fontSize:10,fontWeight:600}}>{st}</span>)}
                    {(g.staff_types||[]).length>3&&<span style={{fontSize:10,color:"#64748b"}}>+{g.staff_types.length-3} more</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button style={{...S.btn("#2563eb"),padding:"5px 12px",fontSize:12}} onClick={()=>{setAssignModal(g);setSelectedEmps([]);}}>Bulk Assign</button>
                  <button style={{...S.btn("#64748b"),padding:"5px 10px",fontSize:12}} onClick={()=>startEdit(g)}>Edit</button>
                  {!g.is_prebuilt&&<button style={{...S.btn("#7f1d1d"),padding:"5px 8px",fontSize:12}} onClick={()=>handleDelete(g.id,g.name)}>✕</button>}
                </div>
              </div>
              {trCount>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>
                {(g.training_ids||[]).slice(0,6).map(id=>{
                  const tr=library.find(t=>t.id===id);
                  return tr?<span key={id} style={{background:"#f8fafc",border:"1px solid #cbd5e1",padding:"1px 8px",borderRadius:99,fontSize:10,color:"#475569"}}>{tr.name}</span>:null;
                })}
                {trCount>6&&<span style={{fontSize:10,color:"#64748b",padding:"1px 6px"}}>+{trCount-6} more</span>}
              </div>}
            </div>}

            {isEditing&&<div>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:"#64748b"}}>Editing: {g.name}</div>
              <div style={{marginBottom:10}}><label style={S.lbl}>Guide Name</label><input style={S.inp} value={editData.name} onChange={e=>setEditData(p=>({...p,name:e.target.value}))}/></div>
              <div style={{marginBottom:10}}><label style={S.lbl}>Description</label><textarea style={{...S.inp,minHeight:60,resize:"vertical"}} value={editData.description} onChange={e=>setEditData(p=>({...p,description:e.target.value}))}/></div>
              <div style={{marginBottom:10}}>
                <label style={S.lbl}>Applies to Staff Types</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                  {STAFF_TYPES.map(st=>{
                    const sel=editData.staff_types?.includes(st);
                    return<button key={st} type="button" style={{padding:"4px 10px",borderRadius:99,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${sel?"#3b82f6":"#94a3b8"}`,background:sel?"#3b82f622":"transparent",color:sel?"#60a5fa":"#64748b"}}
                      onClick={()=>setEditData(p=>({...p,staff_types:sel?p.staff_types.filter(x=>x!==st):[...p.staff_types,st]}))}>
                      {st}
                    </button>;
                  })}
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <label style={S.lbl}>Trainings ({editData.training_ids?.length||0} selected)</label>
                <div style={{maxHeight:240,overflowY:"auto",background:"#f8fafc",borderRadius:8,padding:8,border:"1px solid #cbd5e1",marginTop:4}}>
                  {library.map(tr=>{
                    const sel=editData.training_ids?.includes(tr.id);
                    return<label key={tr.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 4px",borderBottom:"1px solid #ffffff",cursor:"pointer",fontSize:12}}>
                      <input type="checkbox" checked={!!sel} onChange={ev=>setEditData(p=>({...p,training_ids:ev.target.checked?[...p.training_ids,tr.id]:p.training_ids.filter(x=>x!==tr.id)}))} style={{accentColor:"#3b82f6"}}/>
                      <span style={{flex:1,fontWeight:600}}>{tr.name}</span>
                      <span style={{color:"#64748b",fontSize:10}}>{(tr.tags||[]).join(", ")}</span>
                    </label>;
                  })}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={S.btn("#2563eb")} onClick={handleSave}>Save</button>
                <button style={S.btn("#64748b")} onClick={()=>setEditing(null)}>Cancel</button>
              </div>
            </div>}
          </div>;
        })}
      </div>
    </div>
  );
}


function TrainingLibrary({library,employees,onRefresh,goBack,goHome}){
  const [editing,setEditing]=useState(null);const [editData,setEditData]=useState({});
  const [quizPreview,setQuizPreview]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [newTr,setNewTr]=useState({name:"",ctype:"Read and Acknowledge",link:"",tags:[],renewalCycle:"12 Months",default_hours:0,provider:""});
  const [showAdd,setShowAdd]=useState(false);const [manualQs,setManualQs]=useState(null);
  const [assignModal,setAssignModal]=useState(null);const [selectedEmps,setSelectedEmps]=useState([]);
  const [libSearch,setLibSearch]=useState("");
  const [sortMode,setSortMode]=useState("tag"); // "tag" | "name" | "category" | "assigned"
  const [signInModal,setSignInModal]=useState(null);
  const [bulkCompleteModal,setBulkCompleteModal]=useState(null);
  const [bulkEmps,setBulkEmps]=useState([]);
  const [bulkDate,setBulkDate]=useState(todayStr);
  const [bulkInitials,setBulkInitials]=useState("");
  const [bulkSaving,setBulkSaving]=useState(false);
  const editCardRef=useRef({});const {toast,Toasts}=useToast();

  // Filter + sort library
  const [libTagFilter,setLibTagFilter]=useState("All");
  const [libStatusFilter,setLibStatusFilter]=useState("All");
  const searchLower=libSearch.toLowerCase().trim();
  const filteredLib=useMemo(()=>{
    let list=[...library];
    if(searchLower)list=list.filter(t=>t.name.toLowerCase().includes(searchLower));
    if(libTagFilter&&libTagFilter!=="All"){
      const tagMap={"✍️ Acknowledgements":"Acknowledgement","🔑 Required for Clearance":"Required for Clearance","🔰 Pre-Service":"Pre-Service","📅 Annual":"Annual","📋 Other":"Other"};
      const key=tagMap[libTagFilter]||libTagFilter;
      list=list.filter(t=>getLibGroupKey(t)===key);
    }
    if(sortMode==="name")return list.sort((a,b)=>a.name.localeCompare(b.name));
    if(sortMode==="category")return list.sort((a,b)=>(a.category||"").localeCompare(b.category||""));
    if(sortMode==="assigned")return list.sort((a,b)=>employees.filter(e=>e.trainings[b.id]).length-employees.filter(e=>e.trainings[a.id]).length);
    return sortLibrary(list);
  },[library,searchLower,sortMode,employees,libTagFilter,libStatusFilter]);

  const showGrouped=!searchLower&&sortMode==="tag"&&libTagFilter==="All";
  const libGroups=[
    {label:"🔑 Required for Clearance",key:"Required for Clearance",color:"#ef4444",bg:"#ef444415"},
    {label:"🔰 Pre-Service",key:"Pre-Service",color:"#64748b",bg:"#64748b15"},
    {label:"📅 Annual",key:"Annual",color:"#3b82f6",bg:"#3b82f615"},
    {label:"✍️ Acknowledgements",key:"Acknowledgement",color:"#64748b",bg:"#64748b15"},
    {label:"🏢 In-Service",key:"In-Service",color:"#64748b",bg:"#64748b15"},
    {label:"📋 Other",key:"Other",color:"#64748b",bg:"#64748b15"},
  ];
  function getLibGroupKey(tr){
    if(tr.tags?.includes("Required for Clearance"))return"Required for Clearance";
    if(tr.tags?.includes("Pre-Service"))return"Pre-Service";
    if(tr.tags?.includes("Annual"))return"Annual";
    if(tr.tags?.includes("Acknowledgement"))return"Acknowledgement";
    if(tr.tags?.includes("In-Service"))return"In-Service";
    return"Other";
  }
  const groupedLib=useMemo(()=>{
    const g={};libGroups.forEach(lg=>{g[lg.key]=[];});
    filteredLib.forEach(t=>g[getLibGroupKey(t)].push(t));
    return g;
  },[filteredLib]);

  async function saveLibraryTr(id,updates){
    try{await updateLibraryTraining(id,updates);await onRefresh();toast("Saved ✓","success");}
    catch(err){toast(`Save failed: ${err?.message||"unknown error"}`,"error");}
  }
  async function handleAdd(){
    if(!newTr.name.trim()){toast("Training name required","error");return;}
    try{
      await addLibraryTraining({name:newTr.name,ctype:newTr.ctype,link:newTr.ctype==="Webinar"?(newTr.webinarRegistrationLink||""):(newTr.link||""),tags:newTr.tags||[],renewal_cycle:newTr.renewalCycle||"12 Months",default_hours:parseFloat(newTr.default_hours)||0,provider:newTr.provider||"",webinar_description:newTr.webinarDescription||"",webinar_host:newTr.webinarHost||"",webinar_registration_link:newTr.webinarRegistrationLink||""});
      await onRefresh();
      const updated=await getLibrary();
      const newLib=updated.find(t=>t.name===newTr.name);
      if(newLib){setAssignModal(newLib);setSelectedEmps([]);}
      setNewTr({name:"",ctype:"Read and Acknowledge",link:"",tags:[],renewalCycle:"12 Months",default_hours:0,provider:"",webinarDescription:"",webinarHost:"",webinarRegistrationLink:""});
      setShowAdd(false);toast("Training added ✓","success");
    }catch(err){toast(`Could not add: ${err?.message}`,"error");}
  }
  async function handleRemove(id,name){
    setConfirm({msg:`Remove "${name}" from the library? This removes it from all employees.`,onYes:async()=>{
      try{await deleteLibraryTraining(id);await onRefresh();toast("Removed","warn");}
      catch(err){toast(`Could not remove: ${err?.message}`,"error");}
      setConfirm(null);
    }});
  }
  async function handleBulkComplete(tr, empIds, date, initials){
    if(!empIds||empIds.length===0){setBulkCompleteModal(null);return;}
    setBulkSaving(true);
    let count=0;
    for(const eid of empIds){
      try{
        const emp=employees.find(e=>e.id===eid);
        if(!emp)continue;
        const existing=emp.trainings[tr.id];
        if(!existing)continue; // not assigned, skip
        const isAck=tr.tags?.includes("Acknowledgement")||tr.ctype==="Read and Acknowledge";
        const yearLabel=getCurrentYearLabel(emp.hire);
        await saveCompletion(eid,tr.id,{
          completed:date||todayStr,
          dueDate:existing.dueDate||"",
          initials:isAck&&initials?initials.toUpperCase():null,
          initialsDate:isAck&&initials?date||todayStr:null,
          yearLabel,
        },existing.completionId||null);
        count++;
        await new Promise(r=>setTimeout(r,80));
      }catch(err){console.error("bulk complete error:",err);}
    }
    await onRefresh();
    setBulkSaving(false);
    setBulkCompleteModal(null);
    setBulkEmps([]);
    toast(`✓ Marked complete for ${count} employee(s)`,"success");
  }

  async function handleAssign(tr,empIds){
    if(!empIds||empIds.length===0){setAssignModal(null);setSelectedEmps([]);return;}
    toast(`Saving ${empIds.length} assignments…`,"info");
    // Close modal immediately so UI doesn't show stale state
    setAssignModal(null);
    setSelectedEmps([]);
    let count=0;
    for(const eid of empIds){
      try{
        const emp=employees.find(e=>e.id===eid);
        if(!emp)continue;
        await assignTraining(eid,tr.id,nextAnniv(emp.hire));
        count++;
        await new Promise(r=>setTimeout(r,100));
      }catch(err){
        console.error(`Assign error:`,err?.message);
      }
    }
    await onRefresh();
    toast(`✓ Assigned ${count} — library updated`,"success");
  }

  function saveManualQuiz(){
    if(!manualQs||manualQs.some(q=>!q.question.trim()||q.options.some(o=>!o.trim()))){toast("Fill in all questions and options","error");return;}
    setEditData(p=>({...p,quiz:manualQs}));setQuizPreview(manualQs);
    toast(`${manualQs.length} questions ready — click 💾 Save`,"success");setQuizTab("ai");
  }
  function startEdit(tr){
    setEditing(tr.id);
    setEditData({name:tr.name,ctype:tr.ctype,link:tr.link||"",docContent:tr.docContent||"",docName:tr.docName||"",quiz:Array.isArray(tr.quiz)?tr.quiz:[],tags:Array.isArray(tr.tags)?tr.tags:[],renewalCycle:tr.renewal_cycle||"12 Months",default_hours:tr.default_hours||0,provider:tr.provider||"",generateCert:tr.generate_cert||false,webinarDescription:tr.webinar_description||"",webinarHost:tr.webinar_host||"",webinarRegistrationLink:tr.webinar_registration_link||tr.link||""});
    setQuizPreview(tr.quiz?.length?tr.quiz:null);setManualQs(null);setQuizTab("ai");
    // Scroll smoothly to the card after React re-renders
    setTimeout(()=>{
      const el=editCardRef.current[tr.id];
      if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
    },50);
  }
  async function saveEdit(tr){
    const payload={name:editData.name,ctype:editData.ctype,link:editData.ctype==="Webinar"?(editData.webinarRegistrationLink||""):(editData.link||""),docContent:editData.docContent||"",docName:editData.docName||"",quiz:editData.quiz||[],tags:editData.tags||[],renewal_cycle:editData.renewalCycle,default_hours:parseFloat(editData.default_hours)||0,provider:editData.provider||"",webinar_description:editData.webinarDescription||"",webinar_host:editData.webinarHost||"",webinar_registration_link:editData.webinarRegistrationLink||""};
    // Save generate_cert separately
    try{await updateLibraryGenerateCert(tr.id,editData.generateCert||false);}catch(e){console.error("cert toggle:",e);}
    const empCount=employees.filter(e=>e.trainings[tr.id]).length;
    if(empCount>0){setConfirm({msg:`Save changes to "${editData.name}"? Updates visible to ${empCount} employees.`,onYes:()=>{saveLibraryTr(tr.id,payload);setEditing(null);setConfirm(null);}});}
    else{saveLibraryTr(tr.id,payload);setEditing(null);}
  }

  // Reusable training card for library
  function LibCard({tr}){
    const assignedCount=employees.filter(e=>e.trainings[tr.id]).length;
    const unassignedCount=employees.length-assignedCount;
    const isEditing=editing===tr.id;
    const isInService=tr.tags?.includes("In-Service");
    return(
      <div ref={el=>editCardRef.current[tr.id]=el} style={{...S.card,marginBottom:8,borderRadius:8,scrollMarginTop:80}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>{tr.name}</div>
            <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
              <CTag type={tr.ctype}/>
              <TrainingTags tags={tr.tags}/>
              <span style={{fontSize:10,color:"#64748b",background:"#e2e8f0",padding:"1px 6px",borderRadius:99}}>{tr.renewal_cycle||"12 Months"}</span>
              {tr.default_hours>0&&<span style={{fontSize:10,color:"#64748b",background:"#47556918",padding:"1px 6px",borderRadius:99}}>⏱ {tr.default_hours}h</span>}
              {tr.provider&&<span style={{fontSize:10,color:"#475569",background:"#94a3b822",padding:"1px 6px",borderRadius:99}}>🏢 {tr.provider}</span>}
              {tr.link&&<span style={{fontSize:10,color:"#64748b"}}>🔗</span>}
              {tr.docContent&&<span style={{fontSize:10,color:"#60a5fa"}}>📄</span>}
              {Array.isArray(tr.quiz)&&tr.quiz.length>0&&<span style={{fontSize:10,color:"#64748b"}}>📝 {tr.quiz.length}q</span>}
              {tr.generate_cert&&<span style={{fontSize:10,color:"#3b82f6",background:"#2563eb18",padding:"1px 6px",borderRadius:99}}>🎓 cert</span>}
              <span style={{fontSize:10,color:"#64748b"}}>{assignedCount}/{employees.length} assigned</span>
              {unassignedCount>0&&<button style={{...S.btn("#3b82f6"),padding:"1px 7px",fontSize:10}} onClick={()=>{setAssignModal(tr);setSelectedEmps([]);}}>+ Assign {unassignedCount}</button>}
            </div>
          </div>
          <div style={{display:"flex",gap:5}}>
            {!isEditing&&isInService&&<button style={{...S.btn("#2563eb"),padding:"5px 10px",fontSize:12}} onClick={()=>setSignInModal(tr)}>🖨️ Sign-In</button>}
            {!isEditing&&<button style={{...S.btn("#64748b"),padding:"5px 10px",fontSize:12}} onClick={()=>startEdit(tr)}>⚙️ Edit</button>}
            {!isEditing&&<button style={{...S.btn("#475569"),padding:"5px 10px",fontSize:12}} onClick={()=>{setBulkCompleteModal(tr);setBulkEmps([]);setBulkDate(todayStr);setBulkInitials("");}}>✓ Bulk</button>}
            {!isEditing&&<button style={{...S.btn("#3b82f6"),padding:"5px 10px",fontSize:12}} onClick={()=>{setAssignModal(tr);setSelectedEmps([]);}}>👥</button>}
            {!isEditing&&!DEMO_MODE&&<button style={{...S.btn("#7f1d1d"),padding:"5px 8px",fontSize:12}} onClick={()=>handleRemove(tr.id,tr.name)}>✕</button>}
            {isEditing&&<button style={S.btn("#3b82f6")} onClick={()=>saveEdit(tr)}>💾 Save</button>}
            {isEditing&&<button style={S.btn("#64748b")} onClick={()=>setEditing(null)}>Cancel</button>}
          </div>
        </div>

        {isEditing&&<div style={{marginTop:12,borderTop:"1px solid #cbd5e1",paddingTop:12}}>
          <div style={{marginBottom:10}}><label style={S.lbl}>Training Name</label><input style={S.inp} value={editData.name} onChange={e=>setEditData(p=>({...p,name:e.target.value}))} onFocus={e=>e.target.scrollIntoView&&e.target.scrollIntoView({behavior:"smooth",block:"nearest"})}/></div>
          <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
  
            <div style={{flex:1,minWidth:110}}><label style={S.lbl}>Renewal Cycle</label><select style={{...S.sel,width:"100%"}} value={editData.renewalCycle} onChange={e=>setEditData(p=>({...p,renewalCycle:e.target.value}))}>{RENEWAL_CYCLES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div style={{flex:1,minWidth:130}}><label style={S.lbl}>Completion Type</label><select style={{...S.sel,width:"100%"}} value={editData.ctype} onChange={e=>setEditData(p=>({...p,ctype:e.target.value}))}>{CTYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div style={{flex:1,minWidth:90}}><label style={S.lbl}>Default Hours</label><input style={S.inp} type="number" min="0" step="0.5" value={editData.default_hours} onChange={e=>setEditData(p=>({...p,default_hours:e.target.value}))}/></div>
          </div>
          <div style={{marginBottom:10}}><label style={S.lbl}>Training Tags</label><TagSelector value={editData.tags||[]} onChange={tags=>setEditData(p=>({...p,tags}))}/></div>
          <div style={{marginBottom:10}}><label style={S.lbl}>Resource Link</label><input style={S.inp} value={editData.link} onChange={e=>setEditData(p=>({...p,link:e.target.value}))} placeholder="https://drive.google.com/…"/></div>
          <div style={{marginBottom:10}}><label style={S.lbl}>Provider / Organization (optional)</label><input style={S.inp} value={editData.provider||""} onChange={e=>setEditData(p=>({...p,provider:e.target.value}))} placeholder="e.g. Red Cross, DFPS, Crisis Prevention Institute"/></div>
          {editData.ctype==="Webinar"&&<div style={{marginBottom:10,background:"#f8fafc",borderRadius:8,padding:10,border:"1px solid #cbd5e1"}}>
            <div style={{...S.lbl,marginBottom:8,color:"#3b82f6"}}>🖥️ Webinar Details</div>
            <div style={{marginBottom:8}}><label style={S.lbl}>Webinar Description</label><textarea style={{...S.inp,minHeight:60,resize:"vertical"}} value={editData.webinarDescription||""} onChange={e=>setEditData(p=>({...p,webinarDescription:e.target.value}))} placeholder="What this webinar covers…"/></div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:160}}><label style={S.lbl}>Host</label><input style={S.inp} value={editData.webinarHost||""} onChange={e=>setEditData(p=>({...p,webinarHost:e.target.value}))} placeholder="Host name / organization"/></div>
              <div style={{flex:1,minWidth:160}}><label style={S.lbl}>Registration Link</label><input style={S.inp} value={editData.webinarRegistrationLink||""} onChange={e=>setEditData(p=>({...p,webinarRegistrationLink:e.target.value}))} placeholder="https://…"/></div>
            </div>
          </div>}
          {(editData.ctype==="Read and Quiz"||editData.tags?.includes("In-Service"))&&<div style={{marginBottom:10}}>
            <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 12px",background:editData.generateCert?"#2563eb18":"#f8fafc",borderRadius:8,border:`1px solid ${editData.generateCert?"#2563eb44":"#94a3b8"}`}}>
              <input type="checkbox" checked={!!editData.generateCert} onChange={e=>setEditData(p=>({...p,generateCert:e.target.checked}))} style={{accentColor:"#2563eb",width:16,height:16}}/>
              <div>
                <div style={{fontWeight:700,fontSize:12,color:editData.generateCert?"#3b82f6":"#475569"}}>Generate Completion Certificate</div>
                <div style={{fontSize:11,color:"#64748b",marginTop:1}}>Auto-generates a ComplianceReady certificate with unique ID when quiz is passed.</div>
              </div>
            </label>
          </div>}
          {(editData.ctype==="Read and Acknowledge"||editData.ctype==="Read and Quiz")&&<div style={{marginBottom:10,background:"#f8fafc",borderRadius:8,padding:10,border:`1px solid ${editData.link?"#2563eb44":"#64748b44"}`,fontSize:12,color:editData.link?"#3b82f6":"#64748b"}}>
            {editData.link?"✓ Document linked via Google Drive — employees will see an Open Document button":"💡 Paste a Google Drive link above so employees can open the document"}
          </div>}
          {editData.ctype==="Read and Quiz"&&<div style={{borderTop:"1px solid #cbd5e1",paddingTop:12}}>
            <div style={{...S.lbl,marginBottom:8}}>Quiz Builder</div>
            {!manualQs&&<button style={{...S.btn("#475569"),marginBottom:10}} onClick={()=>setManualQs(Array.isArray(editData.quiz)&&editData.quiz.length?editData.quiz.map(q=>({...q})):[{question:"",options:["","","",""],answer:0}])}>✏️ Build Quiz Manually</button>}
            {quizPreview&&!manualQs&&<div style={{background:"#f8fafc",borderRadius:8,padding:12,marginBottom:10}}>
              <div style={{fontSize:12,color:"#3b82f6",fontWeight:700,marginBottom:8}}>✓ {quizPreview.length} questions saved</div>
              {quizPreview.slice(0,3).map((q,i)=><div key={i} style={{fontSize:11,color:"#475569",marginBottom:3,paddingLeft:8,borderLeft:"2px solid #cbd5e1"}}>{i+1}. {q.question}</div>)}
              {quizPreview.length>3&&<div style={{fontSize:11,color:"#475569",marginTop:4}}>…and {quizPreview.length-3} more</div>}
              <button style={{...S.btn("#64748b"),fontSize:11,marginTop:8}} onClick={()=>setManualQs(editData.quiz.map(q=>({...q})))}>✏️ Edit Questions</button>
            </div>}
            {manualQs&&<div>
              {manualQs.map((q,qi)=>(
                <div key={qi} style={{background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:12,marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:"#475569"}}>Question {qi+1}</span>
                    {manualQs.length>1&&<button style={{...S.btn("#7f1d1d"),padding:"2px 8px",fontSize:11}} onClick={()=>setManualQs(p=>p.filter((_,i)=>i!==qi))}>✕</button>}
                  </div>
                  <input style={{...S.inp,marginBottom:8}} placeholder="Enter question…" value={q.question} onChange={e=>setManualQs(p=>p.map((x,i)=>i===qi?{...x,question:e.target.value}:x))}/>
                  <label style={{...S.lbl,marginBottom:6}}>Select the correct answer</label>
                  {q.options.map((opt,oi)=>(
                    <div key={oi} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"4px 8px",borderRadius:6,background:q.answer===oi?"#2563eb18":"transparent",border:q.answer===oi?"1px solid #2563eb33":"1px solid transparent"}}>
                      <input type="radio" name={`c${qi}`} checked={q.answer===oi} onChange={()=>setManualQs(p=>p.map((x,i)=>i===qi?{...x,answer:oi}:x))} style={{accentColor:"#3b82f6",flexShrink:0}}/>
                      <input style={S.inp} placeholder={`Option ${String.fromCharCode(65+oi)}`} value={opt} onChange={e=>setManualQs(p=>p.map((x,i)=>i===qi?{...x,options:x.options.map((o,j)=>j===oi?e.target.value:o)}:x))}/>
                      {q.answer===oi&&<span style={{fontSize:10,color:"#3b82f6",whiteSpace:"nowrap",fontWeight:700}}>✓</span>}
                    </div>
                  ))}
                </div>
              ))}
              <div style={{display:"flex",gap:8}}>
                <button style={{...S.btn("#64748b"),flex:1,fontSize:12}} onClick={()=>setManualQs(p=>[...p,{question:"",options:["","","",""],answer:0}])}>+ Add Question</button>
                <button style={{...S.btn("#2563eb"),flex:1,fontSize:12}} onClick={saveManualQuiz}>✓ Done ({manualQs.length}q)</button>
              </div>
              <p style={{fontSize:11,color:"#64748b",marginTop:6}}>Click 💾 Save above to persist.</p>
            </div>}
          </div>}
        </div>}
      </div>
    );
  }

  return(
    <div style={S.page}>
      <Toasts/>
      {confirm&&<Confirm msg={confirm.msg} onYes={confirm.onYes} onNo={()=>setConfirm(null)}/>}
      {assignModal&&<Modal title={`Assign — ${assignModal.name}`} onClose={()=>{setAssignModal(null);setSelectedEmps([]);}} wide>
        <p style={{fontSize:13,color:"#64748b",margin:"0 0 12px"}}>Select employees to assign this training to:</p>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button style={S.btn("#64748b")} onClick={()=>setSelectedEmps(employees.filter(e=>!e.trainings[assignModal.id]).map(e=>e.id))}>Select All Unassigned</button>
          <button style={S.btn("#64748b")} onClick={()=>setSelectedEmps([])}>Clear</button>
        </div>
        <div style={{maxHeight:300,overflowY:"auto",marginBottom:12}}>
          {employees.map(e=>{const alreadyHas=!!e.trainings[assignModal.id];return<label key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",borderBottom:"1px solid #cbd5e1",cursor:alreadyHas?"default":"pointer"}}>
            <input type="checkbox" checked={selectedEmps.includes(e.id)||alreadyHas} disabled={alreadyHas} onChange={ev=>setSelectedEmps(p=>ev.target.checked?[...p,e.id]:p.filter(x=>x!==e.id))} style={{accentColor:"#3b82f6"}}/>
            <span style={{fontSize:13,fontWeight:600,color:alreadyHas?"#94a3b8":"#1e293b"}}>{e.name}</span><span style={{fontSize:11,color:"#94a3b8",marginLeft:4}}>{e.pos}</span>
            {alreadyHas&&<span style={{fontSize:10,color:"#64748b",marginLeft:"auto",fontStyle:"italic"}}>✓ assigned</span>}
          </label>;})}
        </div>
        <button style={S.btn("#2563eb",true)} onClick={()=>handleAssign(assignModal,selectedEmps)} disabled={selectedEmps.length===0}>Assign to {selectedEmps.length} Employee(s)</button>
      </Modal>}

      {signInModal&&<InServiceSessionModal tr={signInModal} employees={employees} onClose={()=>setSignInModal(null)} onSaved={onRefresh}/>}
      {bulkCompleteModal&&(()=>{
        const tr=bulkCompleteModal;
        const isAck=tr.tags?.includes("Acknowledgement")||tr.ctype==="Read and Acknowledge";
        const assignedEmps=employees.filter(e=>e.trainings[tr.id]);
        const alreadyDone=assignedEmps.filter(e=>{
          const v=e.trainings[tr.id];
          return getStatus(v?.completed,v?.dueDate,e.hire,tr.renewal_cycle,tr.tags?.includes("Acknowledgement"))==="complete";
        });
        const notDone=assignedEmps.filter(e=>{
          const v=e.trainings[tr.id];
          return getStatus(v?.completed,v?.dueDate,e.hire,tr.renewal_cycle,tr.tags?.includes("Acknowledgement"))!=="complete";
        });
        return<Modal title={`Bulk Complete — ${tr.name}`} onClose={()=>setBulkCompleteModal(null)} wide>
          <div style={{background:"#f8fafc",borderRadius:8,padding:10,marginBottom:12,fontSize:12,color:"#475569"}}>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <span>📋 {assignedEmps.length} assigned</span>
              <span style={{color:"#3b82f6"}}>✓ {alreadyDone.length} already complete</span>
              <span style={{color:"#64748b"}}>○ {notDone.length} pending</span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <label style={S.lbl}>Completion Date</label>
              <input type="date" style={S.inp} value={bulkDate} onChange={e=>setBulkDate(e.target.value)}/>
            </div>
            {isAck&&<div>
              <label style={S.lbl}>Initials (optional)</label>
              <input style={{...S.inp,fontFamily:"Georgia,serif",fontWeight:700,letterSpacing:4,textAlign:"center"}} maxLength={5} value={bulkInitials} onChange={e=>setBulkInitials(e.target.value.toUpperCase())} placeholder="__"/>
            </div>}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <label style={S.lbl}>Select Employees ({bulkEmps.length} selected)</label>
            <div style={{display:"flex",gap:6}}>
              <button style={{...S.btn("#64748b"),padding:"3px 8px",fontSize:11}} onClick={()=>setBulkEmps(notDone.map(e=>e.id))}>All Pending</button>
              <button style={{...S.btn("#64748b"),padding:"3px 8px",fontSize:11}} onClick={()=>setBulkEmps(assignedEmps.map(e=>e.id))}>All Assigned</button>
              <button style={{...S.btn("#64748b"),padding:"3px 8px",fontSize:11}} onClick={()=>setBulkEmps([])}>None</button>
            </div>
          </div>
          <div style={{maxHeight:280,overflowY:"auto",background:"#f8fafc",borderRadius:8,padding:8,border:"1px solid #cbd5e1",marginBottom:12}}>
            {assignedEmps.map(e=>{
              const v=e.trainings[tr.id];
              const st=getStatus(v?.completed,v?.dueDate,e.hire,tr.renewal_cycle,tr.tags?.includes("Acknowledgement"));
              const isDone=st==="complete";
              return<label key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px",borderBottom:"1px solid #ffffff",cursor:"pointer",fontSize:12}}>
                <input type="checkbox" checked={bulkEmps.includes(e.id)} onChange={ev=>setBulkEmps(p=>ev.target.checked?[...p,e.id]:p.filter(x=>x!==e.id))} style={{accentColor:"#475569"}}/>
                <span style={{fontWeight:600,flex:1}}>{e.name}</span>
                <span style={{fontSize:11,color:"#64748b"}}>{e.staff_type||e.type}</span>
                {isDone
                  ?<span style={{fontSize:10,color:"#3b82f6",fontWeight:700}}>✓ {v?.completed}</span>
                  :<span style={{fontSize:10,color:"#64748b"}}>○ Pending</span>}
              </label>;
            })}
          </div>
          <button style={S.btn("#475569",true)} disabled={bulkSaving||bulkEmps.length===0}
            onClick={()=>handleBulkComplete(tr,bulkEmps,bulkDate,bulkInitials)}>
            {bulkSaving?`⏳ Saving…`:`✓ Mark Complete for ${bulkEmps.length} Employee(s)`}
          </button>
        </Modal>;
      })()}
      <NavBar title="📚 Training Library" sub={`${library.length} trainings`} onBack={goBack} onHome={goHome}
        extra={<button style={S.btn("#2563eb")} onClick={()=>setShowAdd(p=>!p)}>+ Add Training</button>}/>

      <div style={{padding:16,maxWidth:960,margin:"0 auto"}}>
        <FilterBar
          search={libSearch} onSearch={setLibSearch}
          tagFilter={libTagFilter} onTagFilter={setLibTagFilter}
          statusFilter={"All"} onStatusFilter={()=>{}}
          sortMode={sortMode} onSort={setSortMode}
          showCategory={false}
          resultCount={filteredLib.length} totalCount={library.length}
          onClear={()=>{setLibSearch("");setLibTagFilter("All");setSortMode("tag");}}
        />

        {showAdd&&<div style={{...S.card,marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>➕ New Training</div>
          <div style={{marginBottom:10}}><label style={S.lbl}>Training Name</label><input style={S.inp} value={newTr.name} onChange={e=>setNewTr(p=>({...p,name:e.target.value}))} placeholder="Training name"/></div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
            <div style={{flex:1,minWidth:130}}><label style={S.lbl}>Completion Type</label><select style={{...S.sel,width:"100%"}} value={newTr.ctype} onChange={e=>setNewTr(p=>({...p,ctype:e.target.value}))}>{CTYPES.map(t=><option key={t}>{t}</option>)}</select></div>

            <div style={{flex:1,minWidth:110}}><label style={S.lbl}>Renewal Cycle</label><select style={{...S.sel,width:"100%"}} value={newTr.renewalCycle} onChange={e=>setNewTr(p=>({...p,renewalCycle:e.target.value}))}>{RENEWAL_CYCLES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div style={{flex:1,minWidth:90}}><label style={S.lbl}>Default Hours</label><input style={S.inp} type="number" min="0" step="0.5" value={newTr.default_hours} onChange={e=>setNewTr(p=>({...p,default_hours:e.target.value}))} placeholder="0"/></div>
          </div>
          <div style={{marginBottom:10}}><label style={S.lbl}>Training Tags</label><TagSelector value={newTr.tags} onChange={tags=>setNewTr(p=>({...p,tags}))}/></div>
          <div style={{marginBottom:10}}><label style={S.lbl}>Resource Link (optional)</label><input style={S.inp} value={newTr.link} onChange={e=>setNewTr(p=>({...p,link:e.target.value}))} placeholder="https://…"/></div>
          <div style={{marginBottom:10}}><label style={S.lbl}>Provider / Organization (optional)</label><input style={S.inp} value={newTr.provider||""} onChange={e=>setNewTr(p=>({...p,provider:e.target.value}))} placeholder="e.g. Red Cross, DFPS"/></div>
          {newTr.ctype==="Webinar"&&<div style={{marginBottom:10,background:"#f8fafc",borderRadius:8,padding:10,border:"1px solid #cbd5e1"}}>
            <div style={{...S.lbl,marginBottom:8,color:"#3b82f6"}}>🖥️ Webinar Details</div>
            <div style={{marginBottom:8}}><label style={S.lbl}>Webinar Description</label><textarea style={{...S.inp,minHeight:60,resize:"vertical"}} value={newTr.webinarDescription||""} onChange={e=>setNewTr(p=>({...p,webinarDescription:e.target.value}))} placeholder="What this webinar covers…"/></div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:160}}><label style={S.lbl}>Host</label><input style={S.inp} value={newTr.webinarHost||""} onChange={e=>setNewTr(p=>({...p,webinarHost:e.target.value}))} placeholder="Host name / organization"/></div>
              <div style={{flex:1,minWidth:160}}><label style={S.lbl}>Registration Link</label><input style={S.inp} value={newTr.webinarRegistrationLink||""} onChange={e=>setNewTr(p=>({...p,webinarRegistrationLink:e.target.value}))} placeholder="https://…"/></div>
            </div>
          </div>}
          <div style={{display:"flex",gap:8}}><button style={S.btn("#2563eb")} onClick={handleAdd}>Add to Library</button><button style={S.btn("#64748b")} onClick={()=>setShowAdd(false)}>Cancel</button></div>
        </div>}

        {filteredLib.length===0&&<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>No trainings match your filters</div>}
        {showGrouped
          ?libGroups.map(lg=>{
            const grp=groupedLib[lg.key]||[];
            const allInLib=library.filter(t=>getLibGroupKey(t)===lg.key);
            const grpDone=grp.filter(t=>employees.some(e=>Object.values(e.trainings[t.id]||{}).length>0)).length;
            return<CollapsibleSection key={lg.key}
              label={lg.label} color={lg.color} bg={lg.bg}
              done={grp.length} total={grp.length}
              isEmpty={allInLib.length===0}>
              {grp.map(tr=><LibCard key={tr.id} tr={tr}/>)}
            </CollapsibleSection>;
          })
          :<div>{filteredLib.map(tr=><LibCard key={tr.id} tr={tr}/>)}</div>
        }
      </div>
    </div>
  );
}
function AdminPortal({employees,library,onRefresh,goHome,onLibrary,isHR}){
  const [view,setView]=useState("dashboard");const [selId,setSelId]=useState(null);
  const [search,setSearch]=useState("");const [fType,setFType]=useState("All");const [fStatus,setFStatus]=useState("All");
  const [showInactive,setShowInactive]=useState(false);
  const [modal,setModal]=useState(null);const [confirm,setConfirm]=useState(null);
  const [leaderGenCerts,setLeaderGenCerts]=useState([]);
  useEffect(()=>{
    if(selId){
      getEmployeeCertificates(selId).then(setLeaderGenCerts).catch(()=>{});
    } else {
      setLeaderGenCerts([]);
    }
  },[selId]);
  const [markDate,setMarkDate]=useState(todayStr);
  // Detail view filter states
  const [detSearch,setDetSearch]=useState("");
  const [detTagFilter,setDetTagFilter]=useState("All");
  const [detStatusFilter,setDetStatusFilter]=useState("All");
  const [detSortMode,setDetSortMode]=useState("Default");
  const {toast,Toasts}=useToast();

  function stats(e){
    const ts=Object.entries(e.trainings||{});
    const hrs=calcCompletedHours(e,library);
    const req=requiredHours(e);
    const {cleared,lockedSince}=getClearanceStatus(e,library);
    return{done:ts.filter(([,v])=>getStatus(v?.completed,v?.dueDate)==="complete").length,total:ts.length,hrs,req,cleared,lockedSince};
  }

  const filtered=useMemo(()=>employees.filter(e=>{
    if(!showInactive&&e.is_active===false)return false;
    if(fType!=="All"&&e.type!==fType)return false;
    if(search&&!e.name.toLowerCase().includes(search.toLowerCase()))return false;
    if(fStatus==="Overdue")return Object.values(e.trainings||{}).some(v=>getStatus(v?.completed,v?.dueDate)==="overdue");
    if(fStatus==="Due Soon")return Object.values(e.trainings||{}).some(v=>getStatus(v?.completed,v?.dueDate)==="soon");
    if(fStatus==="Complete"){const{done,total}=stats(e);return done===total&&total>0;}
    if(fStatus==="Not Cleared")return!getClearanceStatus(e,library).cleared;
    if(fStatus==="Hours Behind"){const{hrs,req}=stats(e);return hrs<req;}
    if(fStatus==="Has Certs")return Object.values(e.trainings||{}).some(v=>v?.certificate);
    return true;
  }),[employees,library,search,fType,fStatus]);

  async function handleReset(type,empId,trId){
    try{
      const emp=employees.find(e=>e.id===empId);
      if(type==="one-one"){
        const v=emp?.trainings[trId];const libTr=library.find(t=>t.id===trId);
        if(v?.completed)await supabase.from("training_history").insert([{employee_id:empId,training_id:trId,training_name:libTr?.name||trId,completed_date:v.completed,due_date:v.dueDate||"",initials:v.initials||null,period_year:new Date().getFullYear()}]);
        await updateTrainingRecord(empId,trId,{completed:null,dueDate:nextAnniv(emp?.hire||""),initials:null,initialsDate:null});
        await supabase.from("audit_log").insert([{action:"Training Reset",details:`${emp?.name} — ${libTr?.name}`}]);
      }else if(type==="one-all"){
        for(const e of employees){if(e.trainings[trId]){const v=e.trainings[trId];const libTr=library.find(t=>t.id===trId);if(v?.completed)await supabase.from("training_history").insert([{employee_id:e.id,training_id:trId,training_name:libTr?.name||trId,completed_date:v.completed,due_date:v.dueDate||"",initials:v.initials||null,period_year:new Date().getFullYear()}]);await updateTrainingRecord(e.id,trId,{completed:null,dueDate:nextAnniv(e.hire||""),initials:null,initialsDate:null});}}
        await supabase.from("audit_log").insert([{action:"Bulk Reset",details:`All — ${library.find(t=>t.id===trId)?.name||trId}`}]);
      }else if(type==="all-one"){
        for(const trId2 of Object.keys(emp?.trainings||{})){const v=emp.trainings[trId2];const libTr=library.find(t=>t.id===trId2);if(v?.completed)await supabase.from("training_history").insert([{employee_id:empId,training_id:trId2,training_name:libTr?.name||trId2,completed_date:v.completed,due_date:v.dueDate||"",initials:v.initials||null,period_year:new Date().getFullYear()}]);await updateTrainingRecord(empId,trId2,{completed:null,dueDate:nextAnniv(emp?.hire||""),initials:null,initialsDate:null});}
        await supabase.from("audit_log").insert([{action:"Full Reset",details:`${emp?.name}`}]);
      }
      await onRefresh();toast("Reset complete ✓","success");
    }catch(e){toast(`Reset failed: ${e.message}`,"error");}
  }

  // Grant clearance manually
  async function handleGrantClearance(empId,clearanceDate){
    try{
      await supabase.from("employees").update({cleared_at:clearanceDate}).eq("id",empId);
      await supabase.from("audit_log").insert([{action:"Manual Clearance Granted",details:`Employee ${empId} — cleared ${clearanceDate}`}]);
      await onRefresh();toast("Clearance granted ✓","success");
    }catch(e){toast(`Could not grant clearance: ${e.message}`,"error");}
  }

  // Revoke clearance
  async function handleRevokeClearance(empId,trainingIds){
    try{
      await supabase.from("employees").update({cleared_at:null}).eq("id",empId);
      for(const trId of trainingIds){
        const emp=employees.find(e=>e.id===empId);
        const v=emp?.trainings[trId];
        if(v?.completed)await supabase.from("training_history").insert([{employee_id:empId,training_id:trId,training_name:library.find(t=>t.id===trId)?.name||trId,completed_date:v.completed,due_date:v.dueDate||"",initials:v.initials||null,period_year:new Date().getFullYear()}]);
        await updateTrainingRecord(empId,trId,{completed:null,dueDate:nextAnniv(employees.find(e=>e.id===empId)?.hire||""),initials:null,initialsDate:null});
      }
      await supabase.from("audit_log").insert([{action:"Clearance Revoked",details:`Employee ${empId}`}]);
      await onRefresh();toast("Clearance revoked ✓","warn");
    }catch(e){toast(`Could not revoke clearance: ${e.message}`,"error");}
  }

  // Add bulk hours
  async function handleAddBulkHours(empId,entry){
    try{
      await addBulkHours(empId,entry);
      await onRefresh();toast(`${entry.hours}h added ✓`,"success");
    }catch(e){toast(`Could not add hours: ${e.message}`,"error");}
  }

  // Delete bulk hours entry
  async function handleDeleteBulkHours(id){
    try{
      await deleteBulkHours(id);
      await onRefresh();toast("Hours entry removed","warn");
    }catch(e){toast(`Could not remove: ${e.message}`,"error");}
  }

  // Auto-lock clearance when marking training done
  async function handleUpdateTraining(empId,trId,updates,isPrior=false){
    try{
      const emp=employees.find(e=>e.id===empId);
      const existing=emp?.trainings[trId];
      const hire=emp?.hire||"";
      const yearLabel=isPrior?getPriorYearLabel(hire):getCurrentYearLabel(hire);
      const existingId=isPrior?existing?.priorCompletionId:existing?.completionId;
      await saveCompletion(empId,trId,{...updates,yearLabel,expiryOverride:updates.expiryOverride??null},existingId||null);
      if(!isPrior&&updates.completed){
        const freshEmp={...emp,trainings:{...emp.trainings,[trId]:{...existing,...updates}}};
        if(shouldLockClearance(freshEmp,library)){
          await supabase.from("employees").update({cleared_at:updates.completed||todayStr}).eq("id",empId);
          toast("Clearance automatically locked ✓","success");
        }
      }
      await onRefresh();toast("Saved ✓","success");
    }catch(e){toast(`Could not save: ${e.message}`,"error");}
  }

  async function handleClearTraining(empId,trId,isPrior=false){
    try{
      const emp=employees.find(e=>e.id===empId);
      const existing=emp?.trainings[trId];
      const completionId=isPrior?existing?.priorCompletionId:existing?.completionId;
      if(completionId)await clearCompletion(completionId);
      await onRefresh();toast("Cleared ✓","success");
    }catch(e){toast(`Could not clear: ${e.message}`,"error");}
  }

  async function handleDeleteEmp(id,name){setConfirm({msg:`Delete ${name}? This cannot be undone.`,onYes:async()=>{try{await deleteEmployee(id);await onRefresh();setView("dashboard");toast("Deleted","warn");}catch(e){toast(`Could not delete: ${e.message}`,"error");}setConfirm(null);}});}
  async function handleAssignTraining(empId,trId,hire){try{await assignTraining(empId,trId,nextAnniv(hire));await onRefresh();toast("Assigned ✓","success");}catch(e){toast(`Could not assign: ${e.message}`,"error");}}
  async function handleRemoveTraining(empId,trId){try{await removeTrainingFromEmployee(empId,trId);await onRefresh();toast("Removed","warn");}catch(e){toast(`Could not remove: ${e.message}`,"error");}}
  async function handleUpdateEmployee(id,updates){try{await updateEmployee(id,updates);await onRefresh();toast("Profile updated ✓","success");}catch(e){toast(`Could not update: ${e.message}`,"error");}}
  async function handleAddEmployee(data){
    try{
      const id=await addEmployee(data);
      for(const tr of library){
        try{await assignTraining(id,tr.id,nextAnniv(data.hire));await new Promise(r=>setTimeout(r,80));}
        catch(err){console.error("assign failed:",tr.name,err);}
      }
      await onRefresh();toast(`${data.name} added ✓`,"success");
    }catch(e){toast(`Could not add: ${e.message}`,"error");}
  }

  // ── QUIZ SCORES HELPER ─────────────────────────────────────────
  async function getQuizScores(empId,trId){
    const {data}=await supabase.from("quiz_attempts").select("score,passed,attempted_at").eq("employee_id",empId).eq("training_id",trId).order("attempted_at",{ascending:false}).limit(10);
    return data||[];
  }

  // ── PRINT COMPLIANCE REPORT ────────────────────────────────────
  async function printComplianceReport(emp,filter="all"){
    const {cleared,missing,lockedSince}=getClearanceStatus(emp,library);
    const completedHrs=calcCompletedHours(emp,library);
    const allTimeHrs=calcAllTimeHours(emp,library);
    const reqHrs=requiredHours(emp);
    const yr1=isYear1(emp.hire);
    const yearStart=getYearStart(emp.hire);
    const assignedIds=Object.keys(emp.trainings||{});
    const nextAnniversary=nextAnniv(emp.hire);
    const yearsOfService=((new Date()-new Date(emp.hire))/(1000*60*60*24*365.25)).toFixed(1);

    // Fetch quiz attempts
    const quizTrainings=library.filter(t=>t.ctype==="Read and Quiz"&&emp.trainings[t.id]&&emp.trainings[t.id].completed);
    const quizDataMap={};
    for(const t of quizTrainings){
      const {data}=await supabase.from("quiz_attempts").select("score,passed,attempted_at").eq("employee_id",emp.id).eq("training_id",t.id).order("attempted_at",{ascending:false}).limit(10);
      quizDataMap[t.id]=data||[];
    }

    function quizCell(trId){
      const scores=quizDataMap[trId];
      if(!scores||scores.length===0)return"—";
      // Filter out malformed attempts (0 questions or only 1 question with 0% score)
      const validScores=scores.filter(s=>s.total_questions>1||(s.total_questions===1&&s.score>0));
      const displayScores=validScores.length>0?validScores:scores;
      const best=[...displayScores].sort((a,b)=>b.score-a.score)[0];
      const recent=displayScores.slice(0,2);
      if(recent.length===0)return"—";
      if(recent.length===1)return`<span style="color:${best.passed?"green":"red"};font-weight:bold">${best.score}%${best.passed?" ✓":""}</span>`;
      return`<div style="font-size:10px"><div>Recent: ${recent.map(s=>`<span style="color:${s.passed?"green":"red"}">${s.score}%</span>`).join(", ")}</div><div>Best: <strong style="color:${best.passed?"green":"red"}">${best.score}%${best.passed?" ✓":""}</strong></div></div>`;
    }

    const allSorted=[...assignedIds].sort((a,b)=>{
      const la=library.find(t=>t.id===a)||{};const lb=library.find(t=>t.id===b)||{};
      const order=t=>{if(t.tags?.includes("Required for Clearance"))return 0;if(t.tags?.includes("Pre-Service"))return 1;if(t.tags?.includes("Annual"))return 2;return 3;};
      return order(la)-order(lb);
    });
    const filteredIds=allSorted.filter(id=>{
      const libTr=library.find(t=>t.id===id)||{};
      if(filter==="preservice")return libTr.tags?.includes("Pre-Service")||libTr.tags?.includes("Required for Clearance");
      if(filter==="annual")return libTr.tags?.includes("Annual");
      return true;
    });

    // ── Build a training row for the MAIN table ──────────────────
    // Columns: Training | Category | Tags | Type | Hours | Due | Completed | Initials | Quiz | Status | Cert
    function buildTrainingRow(id){
      const libTr=library.find(t=>t.id===id)||{name:id,ctype:"",tags:[],renewal_cycle:"",default_hours:0,category:""};
      const v=emp.trainings[id]||{};
      const st=getStatus(v.completed,v.dueDate,emp?.hire,libTr.renewal_cycle,libTr.tags?.includes("Acknowledgement"));
      const hrs=effectiveHours(libTr,v);
      const tagsStr=(libTr.tags||[]).map(t=>`${TAG_ICON[t]||""} ${t}`).join("<br/>");
      const statusColor=st==="complete"?"green":st==="overdue"?"red":"orange";
      return{
        row:`<tr>
          <td>${libTr.name}</td>
          <td style="font-size:10px">${tagsStr}</td>
          <td>${libTr.ctype||""}</td>
          <td style="text-align:right;font-weight:600">${hrs>0?hrs+"h":"—"}</td>
          <td>${v.dueDate||""}</td>
          <td>${v.completed||""}</td>
          <td>${v.initials||""}</td>
          <td>${libTr.ctype==="Read and Quiz"?quizCell(id):"—"}</td>
          <td style="color:${statusColor};font-weight:bold">${ST_LBL[st]||st}</td>
          <td style="text-align:center">${v.certificate?"✓":""}</td>
        </tr>`,
        hrs,
        completed:!!v.completed,
        thisYear:v.completed&&new Date(v.completed)>=yearStart,
      };
    }

    const mainTableHeader=`<thead><tr style="background:#ffffff;color:white;">
      <th style="width:28%">Training</th>
      <th style="width:14%">Tags</th>
      <th style="width:10%">Type</th>
      <th style="width:5%;text-align:right">Hours</th>
      <th style="width:7%">Due Date</th>
      <th style="width:7%">Completed</th>
      <th style="width:5%">Initials</th>
      <th style="width:9%">Quiz Scores</th>
      <th style="width:8%">Status</th>
      <th style="width:4%;text-align:center">Cert</th>
    </tr></thead>`;

    // ── Clearance table ──────────────────────────────────────────
    // Columns: Training | Status | Completed | Hours | Quiz
    const clearanceTrainings=library.filter(t=>t.tags?.includes("Required for Clearance"));
    let clearanceTotalHrs=0;
    const clearanceRows=clearanceTrainings.map(t=>{
      const v=emp.trainings[t.id]||{};
      const done=!!v.completed;
      const hrs=effectiveHours(t,v);
      if(done)clearanceTotalHrs+=hrs;
      return`<tr>
        <td>${t.name}</td>
        <td style="color:${done?"green":"red"};font-weight:bold">${done?"✅ Complete":"❌ Incomplete"}</td>
        <td>${v.completed||"—"}</td>
        <td style="text-align:right;font-weight:600">${hrs>0?hrs+"h":"—"}</td>
        <td>${t.ctype==="Read and Quiz"?quizCell(t.id):"—"}</td>
      </tr>`;
    }).join("");
    const clearanceTotalRow=`<tr style="background:#f0fdf4;font-weight:bold;border-top:2px solid #2563eb;">
      <td colspan="3" style="text-align:right;padding-right:12px">Total Pre-Service Hours Completed</td>
      <td style="text-align:right;color:#2563eb">${clearanceTotalHrs.toFixed(1)}h</td>
      <td></td>
    </tr>`;
    const clearanceTableHeader=`<thead><tr style="background:#ffffff;color:white;">
      <th style="width:45%">Required Training</th>
      <th style="width:15%">Status</th>
      <th style="width:12%">Completed</th>
      <th style="width:8%;text-align:right">Hours</th>
      <th style="width:20%">Quiz Scores</th>
    </tr></thead>`;

    // ── Annual section ───────────────────────────────────────────
    const annualIds=filteredIds.filter(id=>library.find(t=>t.id===id)?.tags?.includes("Annual"));
    // Acknowledgement ids (always from all assigned, not filtered)
    const ackIds=Object.keys(emp.trainings||{}).filter(id=>library.find(t=>t.id===id)?.tags?.includes("Acknowledgement"));
    let annualTotal=0,annualThisYear=0;
    const annualRowsHtml=annualIds.map(id=>{
      const {row,hrs,completed,thisYear}=buildTrainingRow(id);
      if(completed){annualTotal+=hrs;if(thisYear)annualThisYear+=hrs;}
      return row;
    }).join("");
    const annualSubtotal=`
      <tr style="background:#eff6ff;font-weight:bold;border-top:2px solid #3b82f6;">
        <td colspan="4" style="text-align:right;padding-right:12px">Annual Hours (all completed)</td>
        <td style="text-align:right;color:#3b82f6">${annualTotal.toFixed(1)}h</td>
        <td colspan="6"></td>
      </tr>
      <tr style="background:#dbeafe;font-weight:bold;">
        <td colspan="4" style="text-align:right;padding-right:12px">This Training Year (since ${yearStart.toLocaleDateString()})</td>
        <td style="text-align:right;color:${annualThisYear>=reqHrs?"green":"red"}">${annualThisYear.toFixed(1)}/${reqHrs}h</td>
        <td colspan="6"></td>
      </tr>`;

    // ── Pre-Service only (not clearance) ─────────────────────────
    const psOnlyIds=filteredIds.filter(id=>{const l=library.find(t=>t.id===id)||{};return l.tags?.includes("Pre-Service")&&!l.tags?.includes("Required for Clearance");});
    let psTotal=0;
    const psRowsHtml=psOnlyIds.map(id=>{
      const {row,hrs,completed}=buildTrainingRow(id);
      if(completed)psTotal+=hrs;
      return row;
    }).join("");
    const psSubtotal=`<tr style="background:#f8fafc;font-weight:bold;border-top:2px solid #64748b;">
      <td colspan="4" style="text-align:right;padding-right:12px">Pre-Service Hours Subtotal</td>
      <td style="text-align:right;color:#64748b">${psTotal.toFixed(1)}h</td>
      <td colspan="6"></td>
    </tr>`;

    // ── Other ────────────────────────────────────────────────────
    const otherIds=filter==="all"?filteredIds.filter(id=>{const l=library.find(t=>t.id===id)||{};return!l.tags?.includes("Pre-Service")&&!l.tags?.includes("Required for Clearance")&&!l.tags?.includes("Annual");}):[];
    let otherTotal=0;
    const otherRowsHtml=otherIds.map(id=>{
      const {row,hrs,completed}=buildTrainingRow(id);
      if(completed)otherTotal+=hrs;
      return row;
    }).join("");

    // ── Bulk hours ────────────────────────────────────────────────
    const bulkRows=(emp.bulkHours||[]).map(b=>`<tr><td>${b.period_label||b.entry_date}</td><td>${b.note||""}</td><td style="text-align:right;font-weight:600;color:#475569">${parseFloat(b.hours).toFixed(1)}h</td></tr>`).join("");
    const bulkTotal=(emp.bulkHours||[]).reduce((a,b)=>a+parseFloat(b.hours),0);
    const bulkThisYear=(emp.bulkHours||[]).filter(b=>b.entry_date&&new Date(b.entry_date)>=yearStart).reduce((a,b)=>a+parseFloat(b.hours),0);

    const grandTotal=clearanceTotalHrs+annualTotal+psTotal+otherTotal+bulkTotal;
    const doneCt=filteredIds.filter(id=>getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate)==="complete").length;
    const title=filter==="preservice"?"Pre-Service Report":filter==="annual"?"Annual Training Report":"Full Compliance Report";

    const html=`<!DOCTYPE html><html><head><title>${title} — ${emp.name}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:11px;color:#1e293b;}
      h1{font-size:17px;margin:0 0 3px;}
      h2{font-size:12px;color:#334155;margin:0 0 12px;font-weight:normal;}
      h3{font-size:12px;margin:14px 0 6px;border-bottom:2px solid #e2e8f0;padding-bottom:3px;font-weight:bold;}
      table{width:100%;border-collapse:collapse;margin-bottom:8px;table-layout:fixed;}
      th{background:#1e293b;color:white;padding:5px 6px;text-align:left;font-size:10px;word-wrap:break-word;}
      td{padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:10px;word-wrap:break-word;vertical-align:top;}
      tr:nth-child(even) td{background:#f8fafc;}
      .badge{display:inline-block;padding:3px 10px;border-radius:16px;font-weight:bold;font-size:12px;}
      .cleared{background:#dcfce7;color:#16a34a;}.notcleared{background:#fee2e2;color:#dc2626;}
      .sum{display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;}
      .st{background:#f8fafc;padding:10px 14px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;min-width:72px;}
      .sn{font-size:20px;font-weight:bold;color:#1e293b;}.sl{font-size:9px;color:#64748b;margin-top:2px;}
      .grand{background:#1e293b;color:white;font-weight:bold;font-size:12px;padding:8px 14px;border-radius:6px;margin:10px 0;display:flex;justify-content:space-between;align-items:center;}
      .sig{display:flex;gap:36px;margin-top:36px;}
      .sig-line{flex:1;border-top:1px solid #334155;padding-top:4px;font-size:9px;color:#64748b;}
      @media print{body{padding:10px;}@page{margin:0.5in;}}
    </style></head><body>
    <h1>SHYH Training Compliance Report</h1>
    <h2>${emp.name} · ${emp.pos} · ${emp.type}</h2>
    <p style="font-size:10px;color:#64748b;margin:0 0 12px;">
      Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})} · CONFIDENTIAL &nbsp;|&nbsp;
      Hire Date: ${emp.hire} · Years of Service: ${yearsOfService} · ${yr1?"Year 1 (80hr req)":"Year 2+ (40hr req)"} &nbsp;|&nbsp;
      Training Year: ${yearStart.toLocaleDateString()} – ${nextAnniversary}<br/>
      Email: ${emp.email||"—"} · Phone: ${emp.phone||"—"}
    </p>

    <h3>📊 Compliance Summary</h3>
    <div class="sum">
      <div class="st"><div class="sn">${completedHrs}/${reqHrs}</div><div class="sl">Hours This Year</div></div>
      <div class="st"><div class="sn" style="color:${completedHrs>=reqHrs?"#16a34a":"#dc2626"}">${reqHrs>0?Math.round(completedHrs/reqHrs*100):0}%</div><div class="sl">Hours Compliance</div></div>
      <div class="st"><div class="sn" style="color:${cleared?"#16a34a":"#dc2626"}">${cleared?"✅":"❌"}</div><div class="sl">Clearance</div></div>
      <div class="st"><div class="sn">${doneCt}/${filteredIds.length}</div><div class="sl">Trainings Done</div></div>
      <div class="st"><div class="sn" style="color:${filteredIds.filter(id=>getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate)==="overdue").length>0?"#dc2626":"#16a34a"}">${filteredIds.filter(id=>getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate)==="overdue").length}</div><div class="sl">Overdue</div></div>
      <div class="st"><div class="sn">${grandTotal.toFixed(1)}h</div><div class="sl">Total Hours</div></div>
    </div>

    <h3>🔑 Required for Clearance</h3>
    <p style="margin:0 0 6px"><span class="badge ${cleared?"cleared":"notcleared"}">${cleared?`✅ CLEARED${lockedSince?` since ${lockedSince}`:""} — Eligible to Work Independently`:"⛔ NOT CLEARED — Must Work Under Supervision"}</span></p>
    ${clearanceTrainings.length>0
      ?`<table>${clearanceTableHeader}<tbody>${clearanceRows}${clearanceTotalRow}</tbody></table>`
      :"<p style='color:#64748b;font-size:10px;'>No required clearance trainings defined.</p>"}

    <h3>⏱️ Annual Training Hours</h3>
    <p style="font-size:10px;margin:0 0 8px;">
      <strong>Requirement: ${reqHrs} hours</strong> (${emp.type}, ${yr1?"Year 1":"Year 2+"}) &nbsp;|&nbsp;
      <strong style="color:${completedHrs>=reqHrs?"#16a34a":"#dc2626"}">Completed this year: ${completedHrs}h</strong>
      ${bulkThisYear>0?` (incl. ${bulkThisYear.toFixed(1)}h from prior records)`:""}
      &nbsp;|&nbsp;
      ${completedHrs<reqHrs?`<span style="color:#dc2626;font-weight:bold">⚠️ Still needed: ${(reqHrs-completedHrs).toFixed(1)}h</span>`:`<span style="color:#16a34a;font-weight:bold">✅ Requirement met</span>`}
    </p>

    ${filter!=="preservice"&&annualIds.length>0
      ?`<h3>📅 Annual Trainings</h3><table>${mainTableHeader}<tbody>${annualRowsHtml}${annualSubtotal}</tbody></table>`:""}

    ${filter!=="annual"&&psOnlyIds.length>0
      ?`<h3>🔰 Pre-Service Trainings</h3><table>${mainTableHeader}<tbody>${psRowsHtml}${psSubtotal}</tbody></table>`:""}

    ${otherRowsHtml
      ?`<h3>📋 Other Trainings</h3><table>${mainTableHeader}<tbody>${otherRowsHtml}
        <tr style="background:#f8fafc;font-weight:bold;border-top:2px solid #334155;">
          <td colspan="4" style="text-align:right;padding-right:12px">Subtotal</td>
          <td style="text-align:right">${otherTotal.toFixed(1)}h</td>
          <td colspan="6"></td>
        </tr></tbody></table>`:""}

    ${filter==="all"&&ackIds.length>0
      ?`<h3>✍️ Acknowledgements</h3>
        <table><thead><tr style="background:#1e293b;color:white;">
          <th style="width:35%">Document</th><th style="width:12%">Type</th><th style="width:11%">Renewal</th>
          <th style="width:10%">Signed Date</th><th style="width:8%">Initials</th><th style="width:10%">Status</th>
        </tr></thead>
        <tbody>${ackIds.map(id=>{
          const libTr=library.find(t=>t.id===id)||{name:id,ctype:"",renewal_cycle:"One Time"};
          const v=emp.trainings[id]||{};const done=!!v.completed;
          return'<tr><td>'+libTr.name+'</td><td>'+libTr.ctype+'</td><td>'+libTr.renewal_cycle+'</td><td>'+( v.completed||"—")+'</td><td style="font-family:Georgia,serif;font-weight:bold">'+( v.initials||"")+'</td><td style="color:'+( done?"green":"red")+ ';font-weight:bold">'+( done?"✅ Signed":"❌ Pending")+'</td></tr>';
        }).join("")}
        <tr style="background:#f3e8ff;font-weight:bold;border-top:2px solid #a78bfa;">
          <td colspan="5" style="text-align:right;padding-right:12px">Acknowledgements Signed</td>
          <td style="color:#a78bfa">${ackIds.filter(id=>!!emp.trainings[id]?.completed).length}/${ackIds.length}</td>
        </tr>
        </tbody></table>`
      :""}

    ${(emp.bulkHours||[]).length>0
      ?`<h3>📁 Prior Year Hours (Hard Copy Records)</h3>
        <table style="width:50%">
          <thead><tr style="background:#1e293b;color:white;"><th>Period</th><th>Notes</th><th style="text-align:right">Hours</th></tr></thead>
          <tbody>${bulkRows}
          <tr style="background:#fef9c3;font-weight:bold;border-top:2px solid #ca8a04;">
            <td colspan="2" style="text-align:right;padding-right:12px">Prior Records Total</td>
            <td style="text-align:right;color:#ca8a04">${bulkTotal.toFixed(1)}h</td>
          </tr></tbody>
        </table>`:""}

    <div class="grand">
      <span>📊 Grand Total Hours (All Completed Trainings)</span>
      <span>${grandTotal.toFixed(1)} hours</span>
    </div>

    <h3>📅 Key Dates</h3>
    <p style="font-size:10px;">
      Hire Date: <strong>${emp.hire}</strong> &nbsp;|&nbsp;
      Training Year: <strong>${yearStart.toLocaleDateString()} – ${nextAnniversary}</strong> &nbsp;|&nbsp;
      Report Generated: <strong>${new Date().toLocaleDateString()}</strong>
    </p>
    <div class="sig">
      <div class="sig-line">Employee Signature &amp; Date</div>
      <div class="sig-line">Supervisor Signature &amp; Date</div>
      <div class="sig-line">Title &amp; Date</div>
    </div>
    </body></html>`;
    const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();
  }
  // ── ACKNOWLEDGEMENT REPORT ───────────────────────────────────────
  function printAcknowledgementReport(emp){
    const ackTrainings=library.filter(t=>t.tags?.includes("Acknowledgement")&&emp.trainings[t.id]);
    const allAckInLib=library.filter(t=>t.tags?.includes("Acknowledgement"));
    const completedCount=ackTrainings.filter(t=>!!emp.trainings[t.id]?.completed).length;
    const totalCount=allAckInLib.filter(t=>emp.trainings[t.id]).length;
    const rows=ackTrainings.map(t=>{
      const v=emp.trainings[t.id]||{};
      const done=!!v.completed;
      return`<tr>
        <td>${t.name}</td>
        <td>${t.category||"Acknowledgment"}</td>
        <td>${t.ctype||""}</td>
        <td>${t.renewal_cycle||"One Time"}</td>
        <td>${v.dueDate||""}</td>
        <td>${v.completed||""}</td>
        <td style="font-family:Georgia,serif;font-weight:bold;font-size:14px">${v.initials||""}</td>
        <td style="color:${done?"green":"red"};font-weight:bold">${done?"✅ Signed":"❌ Pending"}</td>
      </tr>`;
    }).join("");
    const html=`<!DOCTYPE html><html><head><title>Acknowledgements — ${emp.name}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#1e293b;}
      h1{font-size:18px;margin:0 0 4px;}h2{font-size:13px;color:#334155;margin:0 0 16px;font-weight:normal;}
      h3{font-size:13px;margin:14px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:3px;}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;}
      th{background:#1e293b;color:white;padding:6px 8px;text-align:left;font-size:11px;}
      td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;vertical-align:top;}
      tr:nth-child(even) td{background:#f8fafc;}
      .sum{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;}
      .st{background:#f8fafc;padding:12px 16px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;min-width:80px;}
      .sn{font-size:22px;font-weight:bold;}.sl{font-size:10px;color:#64748b;margin-top:2px;}
      .sig{display:flex;gap:36px;margin-top:36px;}
      .sig-line{flex:1;border-top:1px solid #334155;padding-top:4px;font-size:9px;color:#64748b;}
      @media print{body{padding:12px;}}
    </style></head><body>
    <h1>SHYH — Acknowledgements Report</h1>
    <h2>${emp.name} · ${emp.pos} · ${emp.type}</h2>
    <p style="font-size:11px;color:#64748b;margin:0 0 14px;">
      Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})} · CONFIDENTIAL &nbsp;|&nbsp;
      Hire Date: ${emp.hire} · Email: ${emp.email||"—"} · Phone: ${emp.phone||"—"}
    </p>
    <div class="sum">
      <div class="st"><div class="sn" style="color:${completedCount===totalCount?"#16a34a":"#dc2626"}">${completedCount}/${totalCount}</div><div class="sl">Signed</div></div>
      <div class="st"><div class="sn" style="color:${totalCount-completedCount>0?"#dc2626":"#16a34a"}">${totalCount-completedCount}</div><div class="sl">Pending</div></div>
    </div>
    <h3>✍️ Policy & Acknowledgement Documents</h3>
    <table>
      <thead><tr>
        <th style="width:30%">Document</th>
        <th style="width:12%">Category</th>
        <th style="width:14%">Type</th>
        <th style="width:10%">Renewal</th>
        <th style="width:9%">Due Date</th>
        <th style="width:9%">Signed</th>
        <th style="width:8%">Initials</th>
        <th style="width:8%">Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:10px;color:#64748b;margin-top:4px;">
      By signing, the employee confirms they have read, understand, and agree to comply with each policy or document listed above.
    </p>
    <div class="sig">
      <div class="sig-line">Employee Signature &amp; Date</div>
      <div class="sig-line">Supervisor Signature &amp; Date</div>
      <div class="sig-line">Title &amp; Date</div>
    </div>
    </body></html>`;
    const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();
  }

    // ── ACKNOWLEDGEMENT REPORT ───────────────────────────────────────
  function printGroupReport(filter="all"){
    const title=filter==="preservice"?"Pre-Service Group Report":filter==="annual"?"Annual Hours Group Report":"Full Group Compliance Report";
    const rows=employees.map(e=>{
      const {cleared}=getClearanceStatus(e,library);const hrs=calcCompletedHours(e,library);const req=requiredHours(e);
      const aIds=Object.keys(e.trainings||{});
      const fIds=aIds.filter(id=>{const l=library.find(t=>t.id===id)||{};if(filter==="preservice")return l.tags?.includes("Pre-Service")||l.tags?.includes("Required for Clearance");if(filter==="annual")return l.tags?.includes("Annual");return true;});
      const done=fIds.filter(id=>getStatus(e.trainings[id]?.completed,e.trainings[id]?.dueDate)==="complete").length;
      const total=fIds.length;const overdue=fIds.filter(id=>getStatus(e.trainings[id]?.completed,e.trainings[id]?.dueDate)==="overdue").length;
      const bulkHrsTotal=(e.bulkHours||[]).reduce((a,b)=>a+parseFloat(b.hours),0);
      return`<tr><td>${e.name}</td><td>${e.pos}</td><td>${e.type}</td><td>${e.hire}</td><td style="color:${cleared?"green":"red"};font-weight:bold">${cleared?"✅ CLEARED":"⛔ NOT CLEARED"}</td><td style="color:${hrs>=req?"green":"red"};font-weight:bold">${hrs}/${req}h</td><td>${Math.round(hrs/req*100)}%</td><td>${done}/${total}</td><td style="color:${overdue>0?"red":"green"};font-weight:bold">${overdue}</td><td>${isYear1(e.hire)?"Year 1 (80h)":"Year 2+ (40h)"}</td>${bulkHrsTotal>0?`<td style="color:#475569">${bulkHrsTotal.toFixed(1)}h prior</td>`:"<td>—</td>"}</tr>`;
    }).join("");
    const clearedCt=employees.filter(e=>getClearanceStatus(e,library).cleared).length;
    const totalHrs=employees.reduce((a,e)=>a+calcCompletedHours(e,library),0);
    const html=`<!DOCTYPE html><html><head><title>SHYH ${title}</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px;}table{width:100%;border-collapse:collapse;margin-top:12px;}th{background:#1e293b;color:white;padding:6px 8px;text-align:left;font-size:11px;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;}tr:nth-child(even){background:#f8fafc;}.sum{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;}.st{background:#f8fafc;padding:10px 16px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;}.sn{font-size:20px;font-weight:bold;}.sl{font-size:10px;color:#64748b;}</style></head><body>
    <h1>SHYH — ${title}</h1>
    <p style="font-size:11px;color:#64748b;">Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})} · CONFIDENTIAL</p>
    <div class="sum">
      <div class="st"><div class="sn">${employees.length}</div><div class="sl">Total Staff</div></div>
      <div class="st"><div class="sn" style="color:${clearedCt===employees.length?"green":"red"}">${clearedCt}/${employees.length}</div><div class="sl">Cleared</div></div>
      <div class="st"><div class="sn">${totalHrs.toFixed(1)}h</div><div class="sl">Total Hours</div></div>
      <div class="st"><div class="sn" style="color:red">${employees.filter(e=>Object.values(e.trainings||{}).some(v=>getStatus(v?.completed,v?.dueDate)==="overdue")).length}</div><div class="sl">Staff w/ Overdue</div></div>
      <div class="st"><div class="sn" style="color:orange">${employees.filter(e=>{const{hrs,req}=stats(e);return hrs<req;}).length}</div><div class="sl">Hours Behind</div></div>
    </div>
    <table><thead><tr><th>Name</th><th>Position</th><th>Type</th><th>Hire Date</th><th>Clearance</th><th>Hours</th><th>Hrs%</th><th>Trainings</th><th>Overdue</th><th>Year</th><th>Prior Records</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
    const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();
  }

  async function printInServiceReport(){
    const year=new Date().getFullYear();
    const yearStart=new Date(year,0,1);
    const yearEnd=new Date(year,11,31);
    // Load all sessions from database
    let allSessions=[];
    try{allSessions=await getAllInServiceSessions();}catch(e){console.error(e);}
    const yearSessions=allSessions.filter(s=>{
      const d=new Date(s.session_date+"T12:00:00");
      return d>=yearStart&&d<=yearEnd;
    });
    const inServiceLib=library.filter(t=>t.tags?.includes("In-Service"));
    const rows=inServiceLib.map(tr=>{
      const trSessions=yearSessions.filter(s=>s.training_id===tr.id);
      const unassigned=[];
      const absent=[];
      const attendees=[];
      if(trSessions.length===0){
        return`<div class="session"><div class="session-header"><div class="session-title">🏢 ${tr.name}</div><div class="session-meta">No sessions logged this year</div></div></div>`;
      }
      return trSessions.map(s=>{
        const sessionAttendees=employees.filter(e=>s.attendeeIds.includes(String(e.id)));
        const sessionDate=new Date(s.session_date+"T12:00:00").toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
        return`<div class="session">
          <div class="session-header">
            <div>
              <div class="session-title">🏢 ${tr.name}</div>
              <div class="session-meta">${sessionDate} · ${s.ce_hours?s.ce_hours+"h · ":""}${s.facilitator?s.facilitator+" · ":""}${sessionAttendees.length} attended</div>
            </div>
          </div>
          <div class="attend-section">
            <div class="attend-label">✓ Attended (${sessionAttendees.length})</div>
            <div class="attend-list">${sessionAttendees.length>0?sessionAttendees.map(e=>`<span class="emp-chip">${e.name}</span>`).join(""):"<span style='color:#666'>None recorded</span>"}</div>
          </div>
          ${s.curriculum?`<div class="attend-section"><div class="attend-label" style="color:#64748b">Curriculum</div><div style="font-size:11px;color:#94a3b8">${s.curriculum}</div></div>`:""}
          ${s.citation?`<div class="attend-section"><div class="attend-label" style="color:#64748b">Citation</div><div style="font-size:11px;color:#94a3b8">${s.citation}</div></div>`:""}
        </div>`;
      }).join("");
    }).join("");

    const html=`<!DOCTYPE html><html><head><title>In-Service Training Report ${year}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px;color:#1e293b;}
      h1{font-size:18px;margin:0 0 4px;}h2{font-size:13px;color:#334155;margin:0 0 16px;font-weight:normal;}
      .session{border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px;overflow:hidden;}
      .session-header{background:#0f172a;color:white;padding:10px 14px;}
      .session-title{font-weight:bold;font-size:13px;}
      .session-meta{font-size:11px;color:#94a3b8;margin-top:2px;}
      .attend-section{padding:8px 14px;border-top:1px solid #e2e8f0;}
      .attend-label{font-size:10px;font-weight:bold;color:#16a34a;text-transform:uppercase;margin-bottom:4px;}
      .absent-label{color:#dc2626;}
      .attend-list{display:flex;flex-wrap:wrap;gap:4px;}
      .emp-chip{background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:99px;font-size:11px;}
      .absent-chip{background:#fee2e2;color:#dc2626;}
      .summary{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;}
      .st{background:#f8fafc;padding:12px 16px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;min-width:80px;}
      .sn{font-size:22px;font-weight:bold;}.sl{font-size:10px;color:#64748b;}
      @media print{body{padding:10px;}@page{margin:0.5in;}}
    </style></head><body>
    <h1>🏢 In-Service Training Report — ${year}</h1>
    <h2>Southall Heritage Youth Home &nbsp;|&nbsp; General Residential Operation</h2>
    <p style="font-size:11px;color:#64748b;margin:0 0 16px;">Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})} · CONFIDENTIAL · Calendar Year ${year}</p>
    <div class="summary">
      <div class="st"><div class="sn">${inServiceLib.length}</div><div class="sl">In-Service Trainings</div></div>
      <div class="st"><div class="sn">${employees.length}</div><div class="sl">Total Staff</div></div>
      <div class="st"><div class="sn">${yearSessions.reduce((a,s)=>a+s.attendeeIds.length,0)}</div><div class="sl">Total Attendances</div></div>
      <div class="st"><div class="sn">${yearSessions.length}</div><div class="sl">Sessions Logged</div></div>
    </div>
    ${inServiceLib.length===0?"<p style='color:#64748b'>No In-Service trainings found in library.</p>":rows}
    </body></html>`;
    const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();
  }

  if(view==="guides")return<TrainingGuidesPanel library={library} employees={employees} onRefresh={onRefresh} onBack={()=>setView("dashboard")} goHome={goHome} toast={toast}/>;
  if(view==="pipeline")return<PipelinePanel employees={employees} library={library} onRefresh={onRefresh} onBack={()=>setView("dashboard")} goHome={goHome}/>;
  if(view==="detail"&&selId){
    const emp=employees.find(e=>e.id===selId);if(!emp){setView("dashboard");return null;}
    const{done,total,hrs,req,cleared,lockedSince}=stats(emp);
    const{missing}=getClearanceStatus(emp,library);
    const assignedIds=Object.keys(emp.trainings||{});
    const empCerts=assignedIds.map(id=>{const v=emp.trainings[id];return v?.certificate?{trId:id,trName:library.find(t=>t.id===id)?.name||id,...v.certificate}:null;}).filter(Boolean);
    const sortedAssigned=[...assignedIds].sort((a,b)=>{
      const la=library.find(t=>t.id===a)||{};const lb=library.find(t=>t.id===b)||{};
      const order=t=>{
        const tags=t.tags||[];
        if(tags.includes("Acknowledgement"))return 0;
        if(tags.includes("Required for Clearance"))return 1;
        if(tags.includes("Pre-Service"))return 2;
        if(tags.includes("Annual"))return 3;
        return 4;
      };
      return order(la)-order(lb);
    });

    // Detail view filtering
    function getDetGroupKey(id){
      const libTr=library.find(t=>t.id===id)||{};
      const tags=libTr.tags||[];
      if(tags.includes("Acknowledgement"))return"Acknowledgement";
      if(tags.includes("Required for Clearance"))return"Required for Clearance";
      if(tags.includes("Pre-Service"))return"Pre-Service";
      if(tags.includes("Annual"))return"Annual";
      return"Other";
    }
    const detGroups=[
      {label:"✍️ Acknowledgements",key:"Acknowledgement",color:"#64748b",bg:"#64748b15"},
      {label:"🔑 Required for Clearance",key:"Required for Clearance",color:"#ef4444",bg:"#ef444415"},
      {label:"🔰 Pre-Service",key:"Pre-Service",color:"#64748b",bg:"#64748b15"},
      {label:"📅 Annual",key:"Annual",color:"#3b82f6",bg:"#3b82f615"},
      {label:"📋 Other",key:"Other",color:"#64748b",bg:"#64748b15"},
    ];
    const detSearchLower=(detSearch||"").toLowerCase().trim();
    const filteredAssigned=sortedAssigned.filter(id=>{
      const libTr=library.find(t=>t.id===id)||{};
      if(detSearchLower&&!libTr.name?.toLowerCase().includes(detSearchLower))return false;
      if(detTagFilter&&detTagFilter!=="All"){
        const tagMap={"✍️ Acknowledgements":"Acknowledgement","🔑 Required for Clearance":"Required for Clearance","🔰 Pre-Service":"Pre-Service","📅 Annual":"Annual","📋 Other":"Other"};
        if(getDetGroupKey(id)!==(tagMap[detTagFilter]||detTagFilter))return false;
      }
      if(detStatusFilter&&detStatusFilter!=="All"){
        const v=emp.trainings[id]||{};
        const st=getStatus(v.completed,v.dueDate);
        if(detStatusFilter==="✓ Complete"&&st!=="complete")return false;
        if(detStatusFilter==="○ Pending"&&st!=="pending")return false;
        if(detStatusFilter==="⚠ Due Soon"&&st!=="soon")return false;
        if(detStatusFilter==="✗ Overdue"&&st!=="overdue")return false;
      }
      return true;
    });
    const detGrouped={};
    detGroups.forEach(g=>{detGrouped[g.key]=[];});
    filteredAssigned.forEach(id=>detGrouped[getDetGroupKey(id)].push(id));
    const clearanceTrainings=library.filter(t=>t.tags?.includes("Required for Clearance"));
    const allTimeHrs=calcAllTimeHours(emp,library);
    const bulkHrsTotal=(emp.bulkHours||[]).reduce((a,b)=>a+parseFloat(b.hours),0);


    return(
      <div style={S.page}>
        <Toasts/>
        {confirm&&<Confirm msg={confirm.msg} onYes={confirm.onYes} onNo={()=>setConfirm(null)}/>}

        {modal?.type==="hrDocs"&&isHR&&<HrChecklistModal emp={emp} onClose={()=>setModal(null)} toast={toast}/>}
        {modal?.type==="writeups"&&<WriteUpsPanel emp={emp} onClose={()=>setModal(null)} isHR={isHR} toast={toast}/>}
        {modal?.type==="empFiles"&&<EmployeeFilesModal emp={emp} onClose={()=>setModal(null)} toast={toast}/>}
        {modal?.type==="archive"&&isHR&&<Confirm
          msg={emp.is_active===false?`Reactivate ${emp.name}? They will reappear on the dashboard.`:`Archive ${emp.name}? They will be hidden from the dashboard. All records are preserved.`}
          yesLabel={emp.is_active===false?"Reactivate":"Archive"}
          yesColor={emp.is_active===false?"#2563eb":"#dc2626"}
          onYes={async()=>{
            try{
              await setEmployeeActive(emp.id, emp.is_active===false);
              await onRefresh();
              setModal(null);
              toast(emp.is_active===false?`${emp.name} reactivated`:`${emp.name} archived`,"warn");
              setView("dashboard");
            }catch(e){toast(`Could not update: ${e.message}`,"error");}
          }}
          onNo={()=>setModal(null)}
        />}

        {modal?.type==="mark"&&<Modal title={`Mark Complete — ${library.find(t=>t.id===modal.trId)?.name||""}`} onClose={()=>setModal(null)}>
          <label style={S.lbl}>Completion Date</label>
          <input type="date" style={{...S.inp,marginBottom:6}} value={markDate} onChange={e=>setMarkDate(e.target.value)}/>
          <p style={{fontSize:11,color:"#64748b",margin:"0 0 12px"}}>You can enter a past date to backfill completions.</p>
          <button style={S.btn("#2563eb",true)} onClick={()=>{handleUpdateTraining(emp.id,modal.trId,{completed:markDate||todayStr,dueDate:emp.trainings[modal.trId]?.dueDate||""});setModal(null);}}>Save</button>
        </Modal>}

        {/* TRAINING HISTORY MODAL - current + prior year */}
        {modal?.type==="history"&&(()=>{
          const libTr=library.find(t=>t.id===modal.trId)||{};
          const v=emp.trainings[modal.trId]||{};
          const oneTime=isOneTime(libTr);
          const currLabel=getCurrentYearLabel(emp.hire);
          const priorLabel=getPriorYearLabel(emp.hire);
          const defaultHrs=libTr.default_hours||0;
          return<Modal title={`📋 Training History — ${libTr.name||""}`} onClose={()=>setModal(null)} wide>
            {/* Current Year */}
            <div style={{background:"#f8fafc",borderRadius:8,border:"1px solid #2563eb44",padding:14,marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:13,color:"#3b82f6",marginBottom:10}}>📅 Current Year: {currLabel}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                <div style={{flex:1,minWidth:130}}>
                  <label style={S.lbl}>Completion Date</label>
                  <input type="date" id="currDate" style={S.inp} defaultValue={v.completed||""}/>
                </div>
                <div style={{flex:1,minWidth:120}}>
                  <label style={S.lbl}>Hours Override</label>
                  <input type="number" min="0" step="0.5" id="currHrs" style={S.inp} defaultValue={v.hours_override??defaultHrs}/>
                </div>
                <div style={{flex:1,minWidth:100}}>
                  <label style={S.lbl}>Initials</label>
                  <input id="currInitials" style={{...S.inp,fontFamily:"Georgia,serif",fontWeight:700,letterSpacing:4,textAlign:"center"}} maxLength={5} defaultValue={v.initials||""} placeholder="__"/>
                </div>
              </div>
              {libTr.tags?.includes("Required for Clearance")&&libTr.renewal_cycle!=="One Time"&&<div style={{marginBottom:8}}>
                <label style={S.lbl}>Expiry Override <span style={{fontSize:10,color:"#64748b",fontWeight:400}}>(optional — overrides automatic calculation)</span></label>
                <input type="date" id="expiryOverride" style={S.inp} defaultValue={v.expiryOverride||""}/>
                <div style={{fontSize:11,color:"#64748b",marginTop:3}}>
                  Auto-calculated: {v.completed?calcExpiryDate(v.completed,libTr.renewal_cycle,null)?.toISOString().split("T")[0]||"—":"complete training first"}
                </div>
              </div>}
              <div style={{display:"flex",gap:8}}>
                <button style={S.btn("#2563eb")} onClick={()=>{
                  const d=document.getElementById("currDate").value;
                  const h=document.getElementById("currHrs").value;
                  const i=document.getElementById("currInitials").value.toUpperCase();
                  const eo=document.getElementById("expiryOverride")?.value||null;
                  handleUpdateTraining(emp.id,modal.trId,{completed:d||null,dueDate:v.dueDate||"",initials:i||null,initialsDate:i?todayStr:null,hours_override:h?parseFloat(h):null,expiryOverride:eo||null},false);
                  setModal(null);
                }}>💾 Save Current Year</button>
                {v.completed&&<button style={S.btn("#64748b")} onClick={()=>{handleClearTraining(emp.id,modal.trId,false);setModal(null);}}>✕ Clear</button>}
              </div>
            </div>

            {/* Prior Year — only for non-one-time trainings */}
            {!oneTime&&<div style={{background:"#f8fafc",borderRadius:8,border:"1px solid #64748b44",padding:14}}>
              <div style={{fontWeight:700,fontSize:13,color:"#64748b",marginBottom:4}}>📅 Prior Year: {priorLabel}</div>
              <p style={{fontSize:11,color:"#64748b",margin:"0 0 10px"}}>Enter prior year completions from hard copy or pre-hire records. These count toward prior year hours only.</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                <div style={{flex:1,minWidth:130}}>
                  <label style={S.lbl}>Completion Date</label>
                  <input type="date" id="priorDate" style={S.inp} defaultValue={v.priorCompleted||""}/>
                </div>
                <div style={{flex:1,minWidth:120}}>
                  <label style={S.lbl}>Hours Override</label>
                  <input type="number" min="0" step="0.5" id="priorHrs" style={S.inp} defaultValue={v.priorHoursOverride??defaultHrs}/>
                </div>
                <div style={{flex:1,minWidth:100}}>
                  <label style={S.lbl}>Initials</label>
                  <input id="priorInitials" style={{...S.inp,fontFamily:"Georgia,serif",fontWeight:700,letterSpacing:4,textAlign:"center"}} maxLength={5} defaultValue={v.priorInitials||""} placeholder="__"/>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={S.btn("#64748b")} onClick={()=>{
                  const d=document.getElementById("priorDate").value;
                  const h=document.getElementById("priorHrs").value;
                  const i=document.getElementById("priorInitials").value.toUpperCase();
                  handleUpdateTraining(emp.id,modal.trId,{completed:d||null,dueDate:v.priorDueDate||"",initials:i||null,initialsDate:i?todayStr:null,hours_override:h?parseFloat(h):null},true);
                  setModal(null);
                }}>💾 Save Prior Year</button>
                {v.priorCompleted&&<button style={S.btn("#64748b")} onClick={()=>{handleClearTraining(emp.id,modal.trId,true);setModal(null);}}>✕ Clear</button>}
              </div>
            </div>}
          </Modal>;
        })()}

        {modal?.type==="due"&&<Modal title={`Set Due Date — ${library.find(t=>t.id===modal.trId)?.name||""}`} onClose={()=>setModal(null)}>
          <label style={S.lbl}>Due Date</label>
          <input type="date" id="newDue" style={{...S.inp,marginBottom:12}} defaultValue={emp.trainings[modal.trId]?.dueDate||""}/>
          <button style={S.btn("#3b82f6",true)} onClick={()=>{handleUpdateTraining(emp.id,modal.trId,{completed:emp.trainings[modal.trId]?.completed||null,dueDate:document.getElementById("newDue").value});setModal(null);}}>Save</button>
        </Modal>}

        {modal?.type==="hours"&&<Modal title={`Override Hours — ${library.find(t=>t.id===modal.trId)?.name||""}`} onClose={()=>setModal(null)}>
          <p style={{fontSize:13,color:"#64748b",margin:"0 0 12px"}}>Default: {library.find(t=>t.id===modal.trId)?.default_hours||0}h. Override for this employee only.</p>
          <label style={S.lbl}>Hours (decimals OK, e.g. 1.5)</label>
          <input type="number" min="0" step="0.5" id="hrsOverride" style={{...S.inp,marginBottom:12}} defaultValue={emp.trainings[modal.trId]?.hours_override??library.find(t=>t.id===modal.trId)?.default_hours??0}/>
          <div style={{display:"flex",gap:8}}>
            <button style={S.btn("#64748b",true)} onClick={()=>{handleUpdateTraining(emp.id,modal.trId,{completed:emp.trainings[modal.trId]?.completed||null,dueDate:emp.trainings[modal.trId]?.dueDate||"",hours_override:parseFloat(document.getElementById("hrsOverride").value)||0});setModal(null);}}>Save Override</button>
            <button style={S.btn("#64748b")} onClick={()=>{handleUpdateTraining(emp.id,modal.trId,{completed:emp.trainings[modal.trId]?.completed||null,dueDate:emp.trainings[modal.trId]?.dueDate||"",hours_override:null});setModal(null);}}>Reset to Default</button>
          </div>
        </Modal>}

        {/* GRANT CLEARANCE MODAL */}
        {modal?.type==="grantClearance"&&<Modal title="✅ Grant Clearance Manually" onClose={()=>setModal(null)}>
          <p style={{fontSize:13,color:"#475569",margin:"0 0 16px",lineHeight:1.6}}>
            Use this when an employee has completed all required pre-service trainings but records are on paper. This marks them as CLEARED without requiring all trainings to be entered individually.
          </p>
          <div style={{background:"#2563eb18",border:"1px solid #2563eb44",borderRadius:8,padding:12,marginBottom:14}}>
            <div style={{fontSize:12,color:"#3b82f6",fontWeight:700,marginBottom:4}}>📋 Required for Clearance ({clearanceTrainings.length} trainings)</div>
            {clearanceTrainings.map(t=>{
              const v=emp.trainings[t.id]||{};const done=!!v.completed;
              return<div key={t.id} style={{fontSize:11,color:done?"#3b82f6":"#475569",marginBottom:2}}>{done?"✅":"○"} {t.name}</div>;
            })}
          </div>
          <label style={S.lbl}>Clearance Date</label>
          <input type="date" id="clearDate" style={{...S.inp,marginBottom:6}} defaultValue={todayStr}/>
          <p style={{fontSize:11,color:"#64748b",margin:"0 0 14px"}}>Enter the date the employee completed pre-service (from hard copy records).</p>
          <button style={S.btn("#2563eb",true)} onClick={()=>{
            const d=document.getElementById("clearDate").value||todayStr;
            setConfirm({msg:`Grant clearance to ${emp.name} effective ${d}? This will mark them as CLEARED.`,yesColor:"#2563eb",yesLabel:"Grant Clearance",
              onYes:()=>{handleGrantClearance(emp.id,d);setModal(null);setConfirm(null);}});
          }}>✅ Grant Clearance</button>
        </Modal>}

        {/* BULK HOURS MODAL */}
        {modal?.type==="bulkHours"&&<Modal title="📁 Prior Year Hours" onClose={()=>setModal(null)} wide>
          <p style={{fontSize:13,color:"#475569",margin:"0 0 14px",lineHeight:1.6}}>
            Log training hours from hard copy records. These count toward this employee's annual hour totals without requiring individual training entries.
          </p>
          {/* Existing entries */}
          {(emp.bulkHours||[]).length>0&&<div style={{marginBottom:14}}>
            <div style={S.lbl}>Existing Entries</div>
            {(emp.bulkHours||[]).map(b=><div key={b.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",background:"#ffffff",borderRadius:8,border:"1px solid #cbd5e1",marginBottom:6}}>
              <div>
                <div style={{fontWeight:600,fontSize:13,color:"#64748b"}}>{parseFloat(b.hours).toFixed(1)}h — {b.period_label||b.entry_date}</div>
                {b.note&&<div style={{fontSize:11,color:"#475569",marginTop:2}}>{b.note}</div>}
              </div>
              <button style={{...S.btn("#7f1d1d"),padding:"3px 8px",fontSize:11}} onClick={()=>setConfirm({msg:`Remove this hours entry (${b.hours}h)?`,onYes:()=>{handleDeleteBulkHours(b.id);setConfirm(null);}})}>✕</button>
            </div>)}
            <div style={{textAlign:"right",fontSize:12,color:"#64748b",fontWeight:700,marginTop:4}}>Total Prior Records: {bulkHrsTotal.toFixed(1)}h</div>
          </div>}

          {/* Add new entry */}
          <div style={{borderTop:"1px solid #cbd5e1",paddingTop:14}}>
            <div style={{...S.lbl,marginBottom:10}}>Add New Entry</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
              <div style={{flex:1,minWidth:100}}>
                <label style={S.lbl}>Hours</label>
                <input type="number" min="0" step="0.5" id="bhHours" style={S.inp} placeholder="e.g. 47.5"/>
              </div>
              <div style={{flex:1,minWidth:140}}>
                <label style={S.lbl}>Period / Year</label>
                <input id="bhPeriod" style={S.inp} placeholder="e.g. 2025 Annual Training"/>
              </div>
              <div style={{flex:1,minWidth:100}}>
                <label style={S.lbl}>Entry Date</label>
                <input type="date" id="bhDate" style={S.inp} defaultValue={todayStr}/>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={S.lbl}>Notes (optional)</label>
              <input id="bhNote" style={S.inp} placeholder="e.g. Hard copy training records on file — verified by supervisor"/>
            </div>
            <button style={S.btn("#64748b",true)} onClick={()=>{
              const hours=parseFloat(document.getElementById("bhHours").value);
              if(!hours||hours<=0){toast("Enter a valid number of hours","error");return;}
              handleAddBulkHours(emp.id,{
                hours,
                period_label:document.getElementById("bhPeriod").value||"",
                note:document.getElementById("bhNote").value||"",
                entry_date:document.getElementById("bhDate").value||todayStr,
              });
              setModal(null);
            }}>➕ Add Hours Entry</button>
          </div>
        </Modal>}

        {modal?.type==="revoke"&&<Modal title="⛔ Revoke Clearance" onClose={()=>setModal(null)} wide>
          <p style={{fontSize:13,color:"#f87171",margin:"0 0 4px",fontWeight:700}}>⚠️ This will remove {emp.name}'s clearance status.</p>
          <p style={{fontSize:13,color:"#64748b",margin:"0 0 14px"}}>Select which Required for Clearance trainings need to be redone.</p>
          <div style={{maxHeight:300,overflowY:"auto",marginBottom:12}}>
            {clearanceTrainings.map(t=>{
              const v=emp.trainings[t.id]||{};const done=!!v.completed;
              const checked=modal.selected?.includes(t.id);
              return<label key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 8px",borderBottom:"1px solid #cbd5e1",cursor:"pointer"}}>
                <input type="checkbox" checked={checked||false} onChange={ev=>setModal(p=>({...p,selected:ev.target.checked?[...(p.selected||[]),t.id]:(p.selected||[]).filter(x=>x!==t.id)}))} style={{accentColor:"#ef4444"}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{t.name}</div>
                  <div style={{fontSize:11,color:done?"#3b82f6":"#64748b",marginTop:1}}>{done?`✓ Completed ${v.completed}`:"Not yet completed"}</div>
                </div>
              </label>;
            })}
          </div>
          <button style={S.btn("#dc2626",true)} disabled={!modal.selected?.length} onClick={()=>{
            setConfirm({msg:`Revoke clearance for ${emp.name} and reset ${modal.selected.length} training(s)?`,
              onYes:()=>{handleRevokeClearance(emp.id,modal.selected);setModal(null);setConfirm(null);}});
          }}>⛔ Revoke Clearance & Reset {modal.selected?.length||0} Training(s)</button>
        </Modal>}

        {modal?.type==="reset"&&<Modal title="🔄 Reset Training(s)" onClose={()=>setModal(null)}>
          <p style={{fontSize:13,color:"#64748b",margin:"0 0 14px"}}>Completed records move to history — nothing deleted.</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {modal.trId&&<button style={S.btn("#475569",true)} onClick={()=>{setConfirm({msg:`Reset "${library.find(t=>t.id===modal.trId)?.name}" for ${emp.name}?`,onYes:()=>{handleReset("one-one",emp.id,modal.trId);setModal(null);setConfirm(null);}});}}>🔄 Reset for {emp.name} only</button>}
            {modal.trId&&<button style={S.btn("#dc2626",true)} onClick={()=>{setConfirm({msg:`Reset "${library.find(t=>t.id===modal.trId)?.name}" for ALL employees?`,onYes:()=>{handleReset("one-all",emp.id,modal.trId);setModal(null);setConfirm(null);}});}}>🔄 Reset for ALL employees</button>}
            <button style={S.btn("#7f1d1d",true)} onClick={()=>{setConfirm({msg:`Reset ALL trainings for ${emp.name}?`,onYes:()=>{handleReset("all-one",emp.id,null);setModal(null);setConfirm(null);}});}}>🔄 Reset ALL trainings for {emp.name}</button>
          </div>
        </Modal>}

        {modal?.type==="assign"&&<Modal title="Assign Training from Master Library" onClose={()=>setModal(null)} wide>
          <div style={{maxHeight:400,overflowY:"auto",marginBottom:12}}>
            {sortLibrary(library).map(t=>{const alreadyHas=!!emp.trainings[t.id];return<div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 10px",borderBottom:"1px solid #cbd5e1"}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{t.name}</div>
                <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                  <CTag type={t.ctype}/><TrainingTags tags={t.tags}/>
                  {t.default_hours>0&&<span style={{fontSize:10,color:"#64748b"}}>⏱ {t.default_hours}h</span>}
                </div>
              </div>
              {alreadyHas?<span style={{fontSize:11,color:"#3b82f6",fontWeight:700,whiteSpace:"nowrap"}}>✓ Assigned</span>:<button style={{...S.btn("#2563eb"),padding:"5px 14px",fontSize:12,whiteSpace:"nowrap"}} onClick={()=>{handleAssignTraining(emp.id,t.id,emp.hire);setModal(null);}}>+ Assign</button>}
            </div>;})}
          </div>
        </Modal>}

        {modal?.type==="profile"&&<Modal title="✏️ Edit Profile" onClose={()=>setModal(null)}>
          {[["pName","Full Name",emp.name],["pPos","Position",emp.pos],["pEmail","Email",emp.email||""],["pPhone","Phone",emp.phone||""],["pPin","Passcode",emp.pin]].map(([id,lbl,val])=>(
            <div key={id} style={{marginBottom:10}}><label style={S.lbl}>{lbl}</label><input id={id} style={S.inp} autoComplete="off" defaultValue={val}/></div>
          ))}
          <label style={S.lbl}>Staff Type</label>
          <select id="pStaffType" style={{...S.sel,width:"100%",marginBottom:10}} defaultValue={emp.staff_type||""}>
            <option value="">— Select staff type —</option>
            {STAFF_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <label style={S.lbl}>Employment Type</label>
          <select id="pType" style={{...S.sel,width:"100%",marginBottom:14}} defaultValue={emp.type}><option>Direct Care</option><option>Non-Caregiver</option></select>
          <button style={S.btn("#3b82f6",true)} onClick={()=>{handleUpdateEmployee(emp.id,{name:document.getElementById("pName").value,pos:document.getElementById("pPos").value,email:document.getElementById("pEmail").value,phone:document.getElementById("pPhone").value,pin:document.getElementById("pPin").value,type:document.getElementById("pType").value,staff_type:document.getElementById("pStaffType").value});setModal(null);}}>Save Changes</button>
        </Modal>}

        {modal?.type==="certs"&&<Modal title={`🏆 Certificates — ${emp.name}`} onClose={()=>setModal(null)} wide>
          {leaderGenCerts.length>0&&<>
            <div style={{...S.lbl,marginBottom:8}}>🎓 ComplianceReady Certificates</div>
            {leaderGenCerts.map(c=>{
              const isExpired=c.expiry_date&&new Date(c.expiry_date)<new Date();
              return<div key={c.id} style={{padding:"10px 12px",background:"#f8fafc",borderRadius:8,border:`1px solid ${isExpired?"#dc262644":"#2563eb44"}`,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>{c.training_name}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{c.completion_date}{c.hours>0?` · ${c.hours}h`:""}{c.expiry_date?` · Valid through: ${c.expiry_date}`:""}</div>
                  <div style={{fontSize:10,color:"#475569",fontFamily:"monospace"}}>{c.cert_id}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {isExpired?<span style={{background:"#dc262622",color:"#f87171",padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700}}>Expired</span>:<span style={{background:"#2563eb22",color:"#3b82f6",padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700}}>✓ Valid</span>}
                  <button style={{...S.btn("#3b82f6"),padding:"4px 10px",fontSize:11}} onClick={()=>printCertificate(c)}>🖨️ Print</button>
                </div>
              </div>;
            })}
            {empCerts.length>0&&<div style={{borderTop:"1px solid #cbd5e1",margin:"12px 0"}}/>}
          </>}
          {empCerts.length===0&&leaderGenCerts.length===0
            ?<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>No certificates yet.</div>
            :<>{empCerts.length>0&&<>
              <div style={{...S.lbl,marginBottom:8}}>📁 Uploaded Certificates</div>
              {empCerts.length>1&&<button style={{...S.btn("#2563eb",true),marginBottom:12}} onClick={()=>{empCerts.forEach((c,i)=>{if(c.storagePath)setTimeout(()=>downloadCertificate(c.storagePath,c.name),i*400);});toast(`Downloading ${empCerts.length} files…`,"info");}}>⬇ Download All</button>}
              {empCerts.map((c,i)=><div key={i} style={{padding:"10px 12px",background:"#f8fafc",borderRadius:8,border:"1px solid #2563eb44",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <div><div style={{fontWeight:600,fontSize:13}}>{c.trName}</div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>📄 {c.name} · {c.date}</div></div>
                {c.storagePath&&<button style={{...S.btn("#3b82f6"),padding:"4px 12px",fontSize:12}} onClick={()=>{downloadCertificate(c.storagePath,c.name);toast("Downloading…","info");}}>⬇ Download</button>}
              </div>)}
            </>}</>}
        </Modal>}

        <NavBar title={emp.name} sub={`${emp.pos} · ${emp.type}`} onBack={()=>setView("dashboard")} onHome={goHome}
          extra={<>
            <button style={S.btn("#64748b")} onClick={()=>setModal({type:"profile"})}>✏️ Edit</button>
            {isHR&&<button style={S.btn("#3b82f6")} onClick={()=>setModal({type:"hrDocs"})}>📄 HR Docs</button>}
            <button style={{...S.btn("#dc2626"),position:"relative"}} onClick={()=>setModal({type:"writeups"})}>
              📋 Write-Ups
              {DEMO_MODE&&<span style={{position:"absolute",top:-4,right:-4,width:10,height:10,borderRadius:"50%",background:"#f59e0b",boxShadow:"0 0 0 0 rgba(245,158,11,0.7)",animation:"demoPulse 1.5s infinite"}}/>}
            </button>
            <button style={S.btn("#475569")} onClick={()=>setModal({type:"empFiles"})}>📁 Docs</button>
            {isHR&&DEMO_MODE&&<button style={{...S.btn("#94a3b8"),fontSize:11,padding:"5px 10px",cursor:"not-allowed"}} onClick={()=>toast("Not available in demo","warn")}>
              {emp.is_active===false?"↩ Reactivate":"Archive"}
            </button>}
            <button style={S.btn("#2563eb")} onClick={()=>setModal({type:"assign"})}>+ Training</button>
            {!cleared&&<button style={S.btn("#2563eb")} onClick={()=>setModal({type:"grantClearance"})}>✅ Grant Clearance</button>}
            {cleared&&isHR&&!DEMO_MODE&&<button style={S.btn("#dc2626")} onClick={()=>setModal({type:"revoke",selected:[]})}>⛔ Revoke Clearance</button>}
            <button style={S.btn("#64748b")} onClick={()=>setModal({type:"bulkHours"})}>📁 Prior Hours</button>
            {isHR&&!DEMO_MODE&&<button style={S.btn("#475569")} onClick={()=>setModal({type:"reset"})}>🔄 Reset</button>}
            <button style={S.btn("#3b82f6")} onClick={()=>setModal({type:"certs"})}>🏆 Certs ({empCerts.length+leaderGenCerts.length})</button>
            <select style={{...S.sel,background:"#64748b",color:"#fff",fontWeight:700,cursor:"pointer"}} onChange={e=>{const v=e.target.value;if(v==="ps")printComplianceReport(emp,"preservice");else if(v==="annual")printComplianceReport(emp,"annual");else if(v==="ack")printAcknowledgementReport(emp);else if(v==="all")printComplianceReport(emp,"all");e.target.value="";}}>
              <option value="">📊 Reports</option><option value="ps">Pre-Service</option><option value="annual">Annual</option><option value="ack">Acknowledgements</option><option value="all">Full Report</option>
            </select>
            {isHR&&DEMO_MODE&&<button style={{...S.btn("#94a3b8"),cursor:"not-allowed"}} onClick={()=>toast("Not available in demo","warn")}>Delete</button>}
          </>}/>

        <div style={{padding:16,maxWidth:940,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
          {/* Clearance + Hours summary */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div style={{background:cleared?"#2563eb18":"#dc262618",border:`1px solid ${cleared?"#2563eb44":"#dc262644"}`,borderRadius:10,padding:"12px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:20}}>{cleared?"✅":"⛔"}</span>
                <div style={{fontWeight:700,fontSize:13,color:cleared?"#3b82f6":"#f87171"}}>{cleared?"CLEARED":"NOT CLEARED"}</div>
              </div>
              {cleared&&lockedSince&&<div style={{fontSize:11,color:"#475569"}}>Locked since {lockedSince}</div>}
              {!cleared&&<div style={{fontSize:11,color:"#475569"}}>Missing: {missing.map(t=>t.name).join(", ")}</div>}
              <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #cbd5e1"}}>
                <div style={{fontSize:10,color:"#64748b",marginBottom:4,fontWeight:700,textTransform:"uppercase",letterSpacing:.4}}>Pipeline Stage</div>
                <PipelineBadge stage={calcPipelineStage(emp,library)}/>
              </div>
            </div>
            <div style={S.card}>
              <div style={{...S.lbl,marginBottom:4}}>Annual Hours · {emp.type} · {isYear1(emp.hire)?"Year 1":"Year 2+"}</div>
              <HoursBar completed={hrs} required={req}/>
              <div style={{fontSize:11,color:hrs>=req?"#3b82f6":"#64748b",marginTop:4}}>{hrs>=req?"✓ Requirement met":`${(req-hrs).toFixed(1)}h still needed`}</div>
              {bulkHrsTotal>0&&<div style={{fontSize:11,color:"#64748b",marginTop:2}}>📁 Includes {bulkHrsTotal.toFixed(1)}h from prior records</div>}
            </div>
          </div>

          <div style={{...S.card,marginBottom:12,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
            <div><div style={S.lbl}>Start Date</div><div style={{fontWeight:600}}>{emp.hire}</div></div>
            {emp.staff_type&&<div><div style={S.lbl}>Staff Type</div><div style={{fontWeight:600,fontSize:12,color:"#60a5fa"}}>{emp.staff_type}</div></div>}
            <div><div style={S.lbl}>Passcode</div><div style={{fontWeight:700,fontFamily:"monospace",fontSize:16,letterSpacing:2}}>{emp.pin}</div></div>
            {emp.email&&<div><div style={S.lbl}>Email</div><div style={{fontSize:13,color:"#475569"}}>{emp.email}</div></div>}
            {emp.phone&&<div><div style={S.lbl}>Phone</div><div style={{fontSize:13,color:"#475569"}}>{emp.phone}</div></div>}
            <div style={{flex:1,minWidth:180}}><div style={S.lbl}>Training Progress</div><Bar val={done} total={total} h={10}/></div>
          </div>

          {/* Bulk hours summary if any */}
          {(emp.bulkHours||[]).length>0&&<div style={{...S.card,marginBottom:12,background:"#f1f5f918",border:"1px solid #47556944"}}>
            <div style={{...S.lbl,marginBottom:8,color:"#64748b"}}>📁 Prior Year Records on File</div>
            {emp.bulkHours.map(b=><div key={b.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4,alignItems:"center"}}>
              <span style={{color:"#475569"}}>{b.period_label||b.entry_date}{b.note?` — ${b.note}`:""}</span>
              <span style={{fontWeight:700,color:"#64748b"}}>{parseFloat(b.hours).toFixed(1)}h</span>
            </div>)}
            <div style={{borderTop:"1px solid #47556944",marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:12}}>
              <span style={{color:"#64748b"}}>Total Prior Records</span>
              <span style={{color:"#64748b"}}>{bulkHrsTotal.toFixed(1)}h</span>
            </div>
          </div>}

          <div style={S.card}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <div style={S.lbl}>Assigned Trainings ({total})</div>
            </div>
            <FilterBar
              search={detSearch||""} onSearch={v=>setDetSearch(v)}
              tagFilter={detTagFilter||"All"} onTagFilter={v=>setDetTagFilter(v)}
              statusFilter={detStatusFilter||"All"} onStatusFilter={v=>setDetStatusFilter(v)}
              sortMode={detSortMode||"Default"} onSort={v=>setDetSortMode(v)}
              showCategory={false}
              resultCount={filteredAssigned.length} totalCount={sortedAssigned.length}
              onClear={()=>{setDetSearch("");setDetTagFilter("All");setDetStatusFilter("All");setDetSortMode("Default");}}
            />
            {sortedAssigned.length===0&&<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>No trainings assigned yet.</div>}
            {detGroups.map(g=>{
              const grp=detGrouped[g.key]||[];
              const allInGroup=sortedAssigned.filter(id=>{
                const libTr=library.find(t=>t.id===id)||{};
                const tags=libTr.tags||[];
                if(g.key==="Acknowledgement")return tags.includes("Acknowledgement");
                if(g.key==="Required for Clearance")return tags.includes("Required for Clearance");
                if(g.key==="Pre-Service")return tags.includes("Pre-Service")&&!tags.includes("Required for Clearance")&&!tags.includes("Acknowledgement");
                if(g.key==="Annual")return tags.includes("Annual")&&!tags.includes("Required for Clearance")&&!tags.includes("Pre-Service")&&!tags.includes("Acknowledgement");
                return!tags.includes("Acknowledgement")&&!tags.includes("Required for Clearance")&&!tags.includes("Pre-Service")&&!tags.includes("Annual");
              });
              const grpDone=grp.filter(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate,emp?.hire,lt.renewal_cycle)==="complete";}).length;
              const grpTotal=grp.length;
              const grpHrs=grp.filter(id=>emp.trainings[id]?.completed).reduce((a,id)=>{const libTr=library.find(t=>t.id===id)||{};return a+effectiveHours(libTr,emp.trainings[id]||{});},0);
              const grpOverdue=grp.filter(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate,emp?.hire,lt.renewal_cycle)==="overdue";}).length;
              const grpSoon=grp.filter(id=>{const lt=library.find(t=>t.id===id)||{};return getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate,emp?.hire,lt.renewal_cycle)==="soon";}).length;
              return<CollapsibleSection key={g.key}
                label={g.label} color={g.color} bg={g.bg}
                done={grpDone} total={grpTotal} hours={grpHrs}
                overdue={grpOverdue} dueSoon={grpSoon}
                isEmpty={allInGroup.length===0}>
                {grp.map(trId=>{
              const libTr=library.find(t=>t.id===trId)||{name:trId,ctype:"Read and Acknowledge",tags:[],renewal_cycle:"12 Months",default_hours:0};
              const v=emp.trainings[trId]||{};const libTr3=library.find(t=>t.id===trId)||{};const st=getStatus(v.completed,v.dueDate,emp?.hire,libTr3.renewal_cycle);
              const tHrs=effectiveHours(libTr,v);
              const hasOverride=v.hours_override!==null&&v.hours_override!==undefined;
              return<div key={trId} style={{padding:"9px 12px",background:"#f8fafc",borderRadius:8,border:`1px solid ${ST_BDR[st]}`,marginBottom:7}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{libTr.name}</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                      <CTag type={libTr.ctype}/>
                      <TrainingTags tags={libTr.tags}/>
                      <span style={{fontSize:10,color:"#64748b",background:"#e2e8f0",padding:"1px 6px",borderRadius:99}}>{libTr.renewal_cycle||"12 Months"}</span>
                      {tHrs>0&&<span style={{fontSize:10,color:st==="complete"?"#3b82f6":"#64748b",background:st==="complete"?"#2563eb18":"#94a3b818",padding:"1px 6px",borderRadius:99}}>⏱ {tHrs}h{hasOverride?" (override)":""}</span>}
                      {libTr.docContent&&<span style={{fontSize:10,color:"#60a5fa"}}>📄</span>}
                      {Array.isArray(libTr.quiz)&&libTr.quiz.length>0&&<span style={{fontSize:10,color:"#64748b"}}>📝 quiz</span>}
                      {v.certificate&&<span style={{fontSize:10,color:"#3b82f6"}}>🏆 cert</span>}
                      {v.initials&&<span style={{fontSize:10,color:"#60a5fa"}}>✍️ {v.initials}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                    <Tag status={st}/>
                    <button style={{...S.btn("#64748b"),padding:"3px 7px",fontSize:11}} title="View/Edit History" onClick={()=>setModal({type:"history",trId})}>📋 History</button>
                    <button style={{...S.btn("#ffffff"),padding:"3px 7px",fontSize:11,border:"1px solid #cbd5e1"}} onClick={()=>setModal({type:"due",trId})}>📅</button>
                    <button style={{...S.btn("#475569"),padding:"3px 7px",fontSize:11}} onClick={()=>setModal({type:"reset",trId})}>🔄</button>
                    {st==="complete"?<button style={{...S.btn("#64748b"),padding:"3px 7px",fontSize:11}} onClick={()=>handleClearTraining(emp.id,trId,false)}>Undo</button>:<button style={{...S.btn("#2563eb"),padding:"3px 7px",fontSize:11}} onClick={()=>{setMarkDate(todayStr);setModal({type:"mark",trId});}}>✓ Done</button>}
                    DEMO_MODE?null:<button style={{...S.btn("#7f1d1d"),padding:"3px 6px",fontSize:11}} onClick={()=>setConfirm({msg:`Remove "${libTr.name}" from ${emp.name}?`,onYes:()=>{handleRemoveTraining(emp.id,trId);setConfirm(null);}})}>✕</button>
                  </div>
                </div>
                <div style={{fontSize:11,color:"#64748b",marginTop:5,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                  {v.dueDate&&<span>Due: <span style={{color:ST_COLOR[st]}}>{v.dueDate}</span> · {daysLeft(v.dueDate)}</span>}
                  {v.completed&&<span>✓ Current: <span style={{color:"#3b82f6"}}>{v.completed}</span></span>}
                  {v.priorCompleted&&<span style={{color:"#64748b"}}>📅 Prior: {v.priorCompleted}</span>}
                </div>
              </div>;
                })}
              </CollapsibleSection>;
            })}
          </div>
        </div>
      </div>
    );
  }

  const empsWith60dWarning=employees.filter(e=>getEmpRenewalAlerts(e,library).some(a=>a.level==="warning")).length;
  const empsWith30dUrgent=employees.filter(e=>getEmpRenewalAlerts(e,library).some(a=>a.level==="urgent")).length;
  const empsExpired=employees.filter(e=>getEmpRenewalAlerts(e,library).some(a=>a.level==="expired")).length;
  const totalDone=employees.reduce((a,e)=>a+stats(e).done,0);
  const totalAll=employees.reduce((a,e)=>a+stats(e).total,0);
  const totalCerts=employees.reduce((a,e)=>a+Object.values(e.trainings||{}).filter(v=>v?.certificate).length,0);
  const overdueEmps=employees.filter(e=>Object.values(e.trainings||{}).some(v=>getStatus(v?.completed,v?.dueDate)==="overdue"));
  const notClearedEmps=employees.filter(e=>!getClearanceStatus(e,library).cleared);
  const hoursBehind=employees.filter(e=>{const{hrs,req}=stats(e);return hrs<req;});

  return(
    <div style={S.page}>
      <Toasts/>
      {confirm&&<Confirm msg={confirm.msg} onYes={confirm.onYes} onNo={()=>setConfirm(null)}/>}
      {modal?.type==="auditor"&&<ManageAuditorModal employees={employees} onClose={()=>setModal(null)} toast={toast}/>}       {modal?.type==="addemp"&&<Modal title="Add Employee" onClose={()=>setModal(null)}>
        {[["eName","Full Name",""],["ePos","Position",""],["eHire","Start Date","","date"],["eEmail","Email","optional"],["ePhone","Phone","optional"],["ePin","Passcode","4-6 digit code"]].map(([id,lbl,ph,type])=>(
          <div key={id} style={{marginBottom:10}}><label style={S.lbl}>{lbl}</label><input id={id} type={type||"text"} style={S.inp} placeholder={ph}/></div>
        ))}
        <label style={S.lbl}>Staff Type</label>
        <select id="eStaffType" style={{...S.sel,width:"100%",marginBottom:10}}>
          <option value="">— Select staff type —</option>
          {STAFF_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <label style={S.lbl}>Employment Type</label>
        <select id="eType" style={{...S.sel,width:"100%",marginBottom:14}}><option>Direct Care</option><option>Non-Caregiver</option></select>
        <button style={S.btn("#3b82f6",true)} onClick={()=>{
          const name=document.getElementById("eName").value.trim();const hire=document.getElementById("eHire").value;const pin=document.getElementById("ePin").value.trim();
          if(!name||!hire||!pin){toast("Name, hire date & passcode required","error");return;}
          if(employees.some(e=>e.pin===pin)){toast("Passcode already in use","error");return;}
          handleAddEmployee({name,pos:document.getElementById("ePos").value,type:document.getElementById("eType").value,staff_type:document.getElementById("eStaffType").value,hire,email:document.getElementById("eEmail").value,phone:document.getElementById("ePhone").value,pin});
          setModal(null);
        }}>Add Employee</button>
      </Modal>}

      <NavBar title={isHR?"SHYH HR Dashboard":"SHYH Leadership Dashboard"} sub={isHR?"HR Access":"Admin Access"} onHome={goHome}
        extra={<>
          <button style={S.btn("#64748b")} onClick={onLibrary}>📚 Library</button>
          <button style={S.btn("#64748b")} onClick={()=>setView("guides")}>📋 Guides</button>
          <button style={S.btn("#64748b")} onClick={()=>setView("pipeline")}>🔄 Pipeline</button>
          <button style={S.btn("#334155")} onClick={()=>{const rows=employees.map(e=>`<tr><td>${e.name}</td><td>${e.pos}</td><td>${e.type}</td><td>${e.hire}</td><td style="font-family:monospace;font-weight:bold">${e.pin}</td><td>${e.email||""}</td><td>${e.phone||""}</td></tr>`).join("");const html=`<!DOCTYPE html><html><head><title>SHYH Staff Roster</title><style>body{font-family:Arial,sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;margin-top:16px;}th{background:#1e293b;color:white;padding:8px 10px;text-align:left;font-size:12px;}td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;}tr:nth-child(even){background:#f8fafc;}</style></head><body><h1>SHYH Staff Roster</h1><p style="font-size:12px;color:#64748b;">Generated: ${new Date().toLocaleDateString()} · CONFIDENTIAL</p><table><thead><tr><th>Name</th><th>Position</th><th>Type</th><th>Start Date</th><th>Passcode</th><th>Email</th><th>Phone</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();}}>🖨️ Roster</button>
          <button style={{...S.btn("#64748b"),padding:"7px 12px",fontSize:12}} onClick={printInServiceReport}>🏢 In-Service</button>
          <select style={{...S.sel,background:"#64748b",color:"#fff",fontWeight:700,cursor:"pointer"}} onChange={e=>{const v=e.target.value;if(v==="group-all")printGroupReport("all");else if(v==="group-ps")printGroupReport("preservice");else if(v==="group-annual")printGroupReport("annual");e.target.value="";}}>
            <option value="">📊 Group Reports</option>
            <option value="group-ps">Pre-Service Report</option>
            <option value="group-annual">Annual Hours Report</option>
            <option value="group-all">Full Group Report</option>
          </select>
          <button style={S.btn("#475569")} onClick={()=>setModal({type:"auditor"})}>🔍 Auditor</button>           <button style={S.btn("#3b82f6")} onClick={()=>setModal({type:"addemp"})}>+ Add Staff</button>
        </>}/>

      <div style={{padding:16,maxWidth:1200,margin:"0 auto"}}>
        {DEMO_MODE&&<div style={{background:"#dbeafe",border:"1px solid #93c5fd",borderRadius:10,padding:"10px 16px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:13,color:"#1d4ed8"}}><strong>🧭 Demo Tip:</strong> Click <strong>Marcus Webb</strong> to see overdue trainings + a Written Warning. Click <strong>Devon Castillo</strong> to see a Coaching Note. Use the <strong style={{background:"#f59e0b",color:"#1e293b",padding:"0 6px",borderRadius:4}}>?</strong> button below for more tips.</div>
          <a href={CALENDLY_URL} target="_blank" rel="noreferrer" style={{fontSize:12,fontWeight:700,color:"#1d4ed8",textDecoration:"none",whiteSpace:"nowrap"}}>📅 Book a Live Demo →</a>
        </div>}
        {notClearedEmps.length>0&&<div style={{background:"#dc262618",border:"1px solid #dc262644",borderRadius:10,padding:"10px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>⛔</span>
          <div><div style={{fontWeight:700,color:"#f87171",fontSize:14}}>{notClearedEmps.length} staff NOT CLEARED to work independently</div><div style={{fontSize:12,color:"#475569"}}>{notClearedEmps.map(e=>e.name).join(", ")}</div></div>
        </div>}
        {overdueEmps.length>0&&<div style={{background:"#dc262618",border:"1px solid #dc262644",borderRadius:10,padding:"10px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>🚨</span>
          <div><div style={{fontWeight:700,color:"#dc2626",fontSize:14}}>{overdueEmps.length} staff with overdue trainings</div><div style={{fontSize:12,color:"#475569"}}>{overdueEmps.map(e=>e.name).join(", ")}</div></div>
        </div>}

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:14}}>
          {[
            {l:"Total Staff",v:employees.length,c:"#60a5fa"},
            {l:"✅ Cleared",v:`${employees.length-notClearedEmps.length}/${employees.length}`,c:notClearedEmps.length===0?"#3b82f6":"#f87171"},
            {l:"Hours Met",v:employees.filter(e=>{const{hrs,req}=stats(e);return hrs>=req;}).length,c:"#3b82f6"},
            {l:"Hours Behind",v:hoursBehind.length,c:hoursBehind.length>0?"#64748b":"#3b82f6"},
            {l:"Overdue",v:overdueEmps.length,c:"#f87171"},
            {l:"Trainings Done",v:`${totalDone}/${totalAll}`,c:"#64748b"},
            {l:"🏆 Certs",v:totalCerts,c:"#64748b"},
          ].map(s=>(
            <div key={s.l} style={{...S.card,textAlign:"center",padding:12}}><div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#64748b",marginTop:2}}>{s.l}</div></div>
          ))}
        </div>

        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <input style={{...S.inp,maxWidth:200}} placeholder="Search staff…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={S.sel} value={fType} onChange={e=>setFType(e.target.value)}><option>All</option><option>Direct Care</option><option>Non-Caregiver</option></select>
          <select style={S.sel} value={fStatus} onChange={e=>setFStatus(e.target.value)}>
            {["All","Not Cleared","Hours Behind","Overdue","Due Soon","Complete","Has Certs"].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
          {filtered.map(emp=>{
            const{done,total,hrs,req,cleared}=stats(emp);
            const hasOver=Object.values(emp.trainings||{}).some(v=>getStatus(v?.completed,v?.dueDate)==="overdue");
            const hasSoon=Object.values(emp.trainings||{}).some(v=>getStatus(v?.completed,v?.dueDate)==="soon");
            const certCt=Object.values(emp.trainings||{}).filter(v=>v?.certificate).length;
            const hasBulk=(emp.bulkHours||[]).length>0;
            const bc=!cleared?"#ef4444":hasOver?"#f87171":hrs<req?"#64748b":hasSoon?"#64748b":done===total&&total>0?"#3b82f6":"#94a3b8";
            return<div key={emp.id} style={{...S.card,cursor:"pointer",borderColor:bc,padding:13}} onClick={()=>{setSelId(emp.id);setView("detail");}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div><div style={{fontWeight:700,fontSize:13}}>{emp.name}</div><div style={{fontSize:11,color:"#60a5fa",marginTop:1}}>{emp.pos}</div><div style={{fontSize:10,color:"#64748b"}}>{emp.type} · {isYear1(emp.hire)?"Year 1":"Year 2+"}</div></div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                  <ClearanceBadge cleared={cleared}/>
                  {hasOver&&<span style={{background:"#dc262622",color:"#f87171",padding:"1px 6px",borderRadius:99,fontSize:10,fontWeight:700}}>OVERDUE</span>}
                  {hasBulk&&<span style={{background:"#47556922",color:"#64748b",padding:"1px 6px",borderRadius:99,fontSize:10,fontWeight:700}}>📁 Prior Records</span>}
                </div>
              </div>
              <div style={{marginBottom:4}}><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>Training Progress</div><Bar val={done} total={total}/></div>
              <div><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>Annual Hours ({hrs}/{req}h)</div><HoursBar completed={hrs} required={req}/></div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,alignItems:"center"}}>
                <span style={{fontSize:10,color:"#475569"}}>PIN: <span style={{fontFamily:"monospace"}}>{emp.pin}</span></span>
                {(certCt+(emp.cert_count||0))>0&&<span style={{fontSize:11,color:"#64748b"}}>🏆 {certCt+(emp.cert_count||0)}</span>}
              </div>
            </div>;
          })}
        </div>
        {filtered.length===0&&<div style={{textAlign:"center",color:"#64748b",marginTop:40}}>No staff match your filters.</div>}
      </div>
      {DEMO_MODE&&<DemoContextHelp portal="leadership"/>}
    </div>
  );
}

if(DEMO_MODE){
  const style=document.createElement("style");
  style.textContent=`@keyframes demoPulse{0%{box-shadow:0 0 0 0 rgba(245,158,11,0.7);}70%{box-shadow:0 0 0 8px rgba(245,158,11,0);}100%{box-shadow:0 0 0 0 rgba(245,158,11,0);}}`;
  document.head.appendChild(style);
}

export default function App(){
  const [employees,setEmployees]=useState([]);const [library,setLibrary]=useState([]);
  const [loading,setLoading]=useState(true);const [screen,setScreen]=useState("home");
  const [isHR,setIsHR]=useState(false);
  const [tourStep,setTourStep]=useState(-1); // -1 = tour off
  const [adminView,setAdminView]=useState("dashboard");   const [auditorSession,setAuditorSession]=useState(null);const [code,setCode]=useState("");const [codeErr,setCodeErr]=useState("");

  async function loadAll(){
    try{const [lib,emps]=await Promise.all([getLibrary(),getEmployees()]);setLibrary(lib);setEmployees(emps);}
    catch(e){console.error("Load error:",e);}finally{setLoading(false);}
  }
  useEffect(()=>{loadAll();},[]);

  // Check for certificate verification URL parameter
  function goHome(){setScreen("home");setCode("");setCodeErr("");setAdminView("dashboard");}
  function tryHR(){     if(code===HR_CODE){setScreen("admin");setIsHR(true);setCodeErr("");}     else setCodeErr("Incorrect HR code. Please try again.");   }   function tryAdmin(){
    if(code===ADMIN_CODE){setScreen("admin");setIsHR(false);setCodeErr("");}
    else if(code===HR_CODE){setScreen("admin");setIsHR(true);setCodeErr("");}
    else setCodeErr("Incorrect code. Please try again.");
  }

  if(loading)return<div style={{...S.page,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:16}}>🎓</div><div style={{fontSize:16,color:"#64748b"}}>Loading SHYH Training Tracker…</div></div></div>;
  // Demo tour overlay — renders on top of any screen
  const tourOverlay = tourStep>=0 ? <DemoTourOverlay step={tourStep} onNext={()=>setTourStep(p=>p+1)} onClose={()=>setTourStep(-1)}/> : null;
  if(screen==="auditor"&&auditorSession)return<ErrorBoundary><><AuditorDashboard employees={employees} library={library} session={auditorSession} onSignOut={()=>{setAuditorSession(null);setScreen("home");}}/>{DEMO_MODE&&<DemoContextHelp portal='auditor'/>}</></ErrorBoundary>;   if(screen==="auditor-login")return(<AuditorLoginScreen onSuccess={(session)=>{setAuditorSession(session);setScreen("auditor");}} goHome={goHome}/>);   if(screen==="hr-login")return(<div style={{...S.page,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{width:"100%",maxWidth:360}}><div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:44,marginBottom:8}}>📋</div><h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>HR Access</h1><p style={{margin:0,color:"#64748b",fontSize:13}}>Enter the HR code to continue</p></div><div style={S.card}><label style={S.lbl}>HR Code</label><input style={{...S.inp,marginBottom:10}} type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryHR()} placeholder="Enter HR code"/>{codeErr&&<div style={{color:"#f87171",fontSize:13,marginBottom:10,background:"#dc262618",padding:"8px 12px",borderRadius:6}}>{codeErr}</div>}<button style={S.btn("#dc2626",true)} onClick={tryHR}>Enter HR Portal</button><button style={{...S.btn("#64748b",true),marginTop:8}} onClick={goHome}>🏠 Back to Home</button></div></div></div>);   if(screen==="employee")return<ErrorBoundary><><EmpPortal employees={employees} library={library} onRefresh={loadAll} goHome={goHome}/>{DEMO_MODE&&<DemoContextHelp portal='employee'/>}</></ErrorBoundary>;
  if(screen==="admin"){
    if(adminView==="library")return<ErrorBoundary><TrainingLibrary library={library} employees={employees} onRefresh={loadAll} goBack={()=>setAdminView("dashboard")} goHome={goHome}/></ErrorBoundary>;
    return<ErrorBoundary><AdminPortal employees={employees} library={library} onRefresh={loadAll} goHome={goHome} onLibrary={()=>setAdminView("library")} isHR={isHR}/></ErrorBoundary>;
  }
  if(screen==="admin-login")return(
    <div style={{...S.page,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:44,marginBottom:8}}>🛡️</div><h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Leadership Access</h1><p style={{margin:0,color:"#64748b",fontSize:13}}>Enter the admin code to continue</p></div>
        <div style={S.card}>
          <label style={S.lbl}>Admin Code</label>
          <input style={{...S.inp,marginBottom:10}} type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryAdmin()} placeholder="Enter code"/>
          {codeErr&&<div style={{color:"#f87171",fontSize:13,marginBottom:10,background:"#dc262618",padding:"8px 12px",borderRadius:6}}>{codeErr}</div>}
          <button style={S.btn("#3b82f6",true)} onClick={tryAdmin}>Enter</button>
          <button style={{...S.btn("#64748b",true),marginTop:8}} onClick={goHome}>🏠 Back to Home</button>
        </div>
      </div>
    </div>
  );
  return(
    <div style={{...S.page,minHeight:"100vh"}}>
      {/* Full-width yellow banner at very top */}
      <div style={{background:"#f59e0b",color:"#1e293b",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>🎓</span>
          <div>
            <span style={{fontWeight:800,fontSize:13}}>ComplianceReady — Interactive Demo</span>
            <span style={{fontSize:12,marginLeft:10,opacity:.8}}>Sample data only · Not a real facility</span>
          </div>
        </div>
        <a href={CALENDLY_URL} target="_blank" rel="noreferrer" style={{display:"inline-block",background:"#1e293b",color:"#fff",padding:"6px 16px",borderRadius:99,fontSize:12,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap"}}>📅 Book a Live Demo</a>
      </div>

      {/* Main content */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:16,minHeight:"calc(100vh - 48px)"}}>
        <div style={{width:"100%",maxWidth:420,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:8}}>🎓</div>
          <h1 style={{margin:"0 0 4px",fontSize:24,fontWeight:800}}>SHYH Training Tracker</h1>
          <p style={{margin:"0 0 20px",color:"#64748b",fontSize:14}}>Stay on top of annual training requirements</p>

          {/* Cheat sheet — compact, right above buttons */}
          <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:10,padding:"10px 14px",marginBottom:16,textAlign:"left"}}>
            <div style={{fontWeight:700,fontSize:11,color:"#92400e",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Demo Access Codes</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 12px",fontSize:12,marginBottom:8}}>
              {[["Priya Nair","8847"],["Devon Castillo","4429"],["Jordan Ellis","3312"],["Marcus Webb","2291"],["Sandra Okafor","6601"],["Amber Nguyen","7753"]].map(([name,pin])=>[
                <span key={name+"-n"} style={{color:"#1e293b",fontWeight:600}}>{name}</span>,
                <span key={name+"-p"} style={{color:"#d97706",fontFamily:"monospace",fontWeight:800}}>{pin}</span>
              ])}
            </div>
            <div style={{borderTop:"1px solid #fde68a",paddingTop:6,fontSize:11,color:"#92400e",display:"flex",gap:16,flexWrap:"wrap"}}>
              <span>Leadership: <strong>demo2026</strong></span>
              <span>HR Portal: <strong>hr2026</strong></span>
            </div>
          </div>

          {/* Start Demo Tour */}
          <button style={{width:"100%",background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#1e293b",border:"none",borderRadius:12,padding:"16px 20px",fontSize:16,fontWeight:800,cursor:"pointer",marginBottom:10,boxShadow:"0 4px 20px rgba(245,158,11,0.35)",display:"flex",alignItems:"center",justifyContent:"center",gap:10}} onClick={()=>{setCode(ADMIN_CODE);setScreen("admin");setIsHR(false);setTourStep(0);}}>
            <span style={{fontSize:20}}>🚀</span>
            <div style={{textAlign:"left"}}>
              <div>Start Demo Tour</div>
              <div style={{fontSize:12,fontWeight:500,opacity:.8}}>Auto-login · Guided walkthrough · No code needed</div>
            </div>
          </button>

          <div style={{display:"flex",alignItems:"center",gap:8,margin:"8px 0"}}>
            <div style={{flex:1,height:1,background:"#e2e8f0"}}/>
            <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>OR EXPLORE ON YOUR OWN</span>
            <div style={{flex:1,height:1,background:"#e2e8f0"}}/>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button style={{...S.btn("#3b82f6",true),padding:"16px 20px",fontSize:15,borderRadius:12}} onClick={()=>setScreen("employee")}>👤 Employee Portal<div style={{fontSize:12,fontWeight:400,marginTop:3,color:"rgba(255,255,255,0.85)"}}>Trainings · Hours · Clearance · Certificates</div></button>
            <button style={{...S.btn("#64748b",true),padding:"16px 20px",fontSize:15,borderRadius:12}} onClick={()=>setScreen("admin-login")}>🛡️ Leadership Dashboard<div style={{fontSize:12,fontWeight:400,marginTop:3,color:"rgba(255,255,255,0.85)"}}>Admin access — code required</div></button>
            <button style={{...S.btn("#dc2626",true),padding:"16px 20px",fontSize:15,borderRadius:12}} onClick={()=>setScreen("hr-login")}>📋 HR Portal<div style={{fontSize:12,fontWeight:400,marginTop:3,color:"rgba(255,255,255,0.85)"}}>Write-ups, HR docs, employee records</div></button>
            <button style={{...S.btn("#475569",true),padding:"16px 20px",fontSize:15,borderRadius:12}} onClick={()=>setScreen("auditor-login")}>🔍 Auditor / Licensing Access<div style={{fontSize:12,fontWeight:400,marginTop:3,color:"rgba(255,255,255,0.85)"}}>Temporary read-only access for inspectors</div></button>
          </div>
          <p style={{marginTop:12,fontSize:11,color:"#94a3b8"}}>🌐 Powered by ComplianceReady · ZeroMissAI Solutions<br/>Demo data resets every Sunday.</p>
        </div>
      </div>
    </div>
  );
}
