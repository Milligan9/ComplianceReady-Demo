import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase, getLibrary, updateLibraryTraining, addLibraryTraining, deleteLibraryTraining, getEmployees, addEmployee, updateEmployee, deleteEmployee, assignTraining, saveCompletion, clearCompletion, removeTrainingFromEmployee, uploadCertificate, downloadCertificate, addBulkHours, deleteBulkHours, getInServiceSessions, getAllInServiceSessions, saveInServiceSession, deleteInServiceSession } from "./supabase.js";

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
        <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9",fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{maxWidth:400,width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:24,textAlign:"center"}}>
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

function DemoBanner() {
  return (
    <div style={{background:"#fbbf24",color:"#0f172a",textAlign:"center",padding:"10px 16px",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:12,flexWrap:"wrap"}}>
      <span>🎯 DEMO MODE — Sample data only. Not a real facility.</span>
      <span style={{fontWeight:400,fontSize:12}}>
        Employee logins: <strong>Priya Nair / 8847</strong> · <strong>Devon Castillo / 4429</strong> · <strong>Jordan Ellis / 3312</strong> &nbsp;|&nbsp; Leadership code: <strong>demo2026</strong>
      </span>
    </div>
  );
}

const ADMIN_CODE = "demo2026";
const PASS_SCORE = 70;
const CTYPES = ["Read and Acknowledge","Read and Quiz","Link","Certificate"];
const CATEGORIES = ["Training","Acknowledgment","In-Service"];
const ALL_TAGS = ["Pre-Service","Annual","Required for Clearance","Acknowledgement"];
const RENEWAL_CYCLES = ["One Time","6 Months","12 Months","2 Years"];
const MS_CITATIONS = [
  {group:"Core Training Citations", options:[
    "TAC §748.601 – Supervision of Children","TAC §748.603 – Definition of Caregiver",
    "TAC §748.1003 – Staff Responsibilities","TAC §748.1101 – Caregiver Responsibilities",
    "TAC §748.1203 – Behavior Management and Discipline","TAC §748.2613 – Confidentiality of Records",
    "TAC §748.2401 – Required Records","TAC §748.2405 – Accuracy of Records",
    "TAC §748.2607 – Incident Reports","TAC §748.307 – Ethical Responsibilities",
    "TAC §748.1201 – Program Services","TAC §748.1211 – Basic Care Requirements",
    "TAC §748.1221 – Children's Rights","TAC §748.1207 – Recreation and Activities",
    "TAC §748.3351 – Service Planning",
  ]},
  {group:"DERP / Emergency / Safety", options:[
    "TAC §748.305 – Emergency Plans","TAC §748.307 – Emergency Drills",
    "TAC §748.801 – Emergency Behavior Intervention (if applicable)",
  ]},
  {group:"Medication", options:[
    "TAC §748.301 – Medication Administration","TAC §748.309 – Medication Records","TAC §748.311 – Medication Errors",
  ]},
  {group:"Biohazards / Health & Safety", options:[
    "TAC §748.1201 – Program Services","TAC §748.1101 – Caregiver Responsibilities","TAC §748.1223 – Health Services",
  ]},
  {group:"Global / Applies to All Training", options:[
    "TAC §748.131 – Training Requirements","TAC §748.1001 – Staff Qualifications","TAC §748.101 – Responsibility for Compliance",
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

function effectiveHours(libTr,empRecord){
  if(empRecord?.hours_override!==null&&empRecord?.hours_override!==undefined) return parseFloat(empRecord.hours_override)||0;
  return parseFloat(libTr?.default_hours)||0;
}
function getYearStart(hireDate){
  try{const h=new Date(hireDate),t=new Date();let d=new Date(t.getFullYear(),h.getMonth(),h.getDate());if(d>t)d=new Date(t.getFullYear()-1,h.getMonth(),h.getDate());return d;}catch{return new Date(0);}
}
function getPriorYearStart(hireDate){
  try{const curr=getYearStart(hireDate);return new Date(curr.getFullYear()-1,curr.getMonth(),curr.getDate());}catch{return new Date(0);}
}
function getYearEnd(hireDate){
  try{const s=getYearStart(hireDate);const e=new Date(s.getFullYear()+1,s.getMonth(),s.getDate());e.setDate(e.getDate()-1);return e;}catch{return new Date();}
}
function getPriorYearEnd(hireDate){
  try{const s=getYearStart(hireDate);const e=new Date(s);e.setDate(e.getDate()-1);return e;}catch{return new Date();}
}
function formatYearLabel(start,end){
  const fmt=d=>d.toLocaleDateString("en-US",{month:"short",year:"numeric"});
  return`${fmt(start)} – ${fmt(end)}`;
}
function getCurrentYearLabel(hireDate){return formatYearLabel(getYearStart(hireDate),getYearEnd(hireDate));}
function getPriorYearLabel(hireDate){return formatYearLabel(getPriorYearStart(hireDate),getPriorYearEnd(hireDate));}
function isOneTime(libTr){return libTr?.renewal_cycle==="One Time";}
function isYear1(hireDate){
  try{const diffMs=new Date()-new Date(hireDate);return diffMs/(1000*60*60*24*365.25)<1;}catch{return false;}
}
function requiredHours(emp){if(emp.type==="Direct Care"&&isYear1(emp.hire))return 80;return 40;}
function isAcknowledgement(libTr){return !!(libTr?.tags?.includes("Acknowledgement"));}
function calcCompletedHours(emp,library){
  const yearStart=getYearStart(emp.hire);const yearEnd=getYearEnd(emp.hire);let total=0;
  Object.entries(emp.trainings||{}).forEach(([id,v])=>{
    if(!v.completed)return;const completedDate=new Date(v.completed);
    if(completedDate<yearStart||completedDate>yearEnd)return;
    const libTr=library.find(t=>t.id===id);if(isAcknowledgement(libTr))return;
    total+=effectiveHours(libTr,v);
  });
  (emp.bulkHours||[]).forEach(b=>{
    if(!b.entry_date)return;const bd=new Date(b.entry_date);
    if(bd<yearStart||bd>yearEnd)return;total+=parseFloat(b.hours)||0;
  });
  return Math.round(total*10)/10;
}
function calcAllTimeHours(emp,library){
  let total=0;
  Object.entries(emp.trainings||{}).forEach(([id,v])=>{
    const libTr=library.find(t=>t.id===id);if(isAcknowledgement(libTr))return;
    if(v.completed)total+=effectiveHours(libTr,v);
    if(v.priorCompleted){
      const hrs=v.priorHoursOverride!==null&&v.priorHoursOverride!==undefined?parseFloat(v.priorHoursOverride)||0:parseFloat(libTr?.default_hours)||0;
      total+=hrs;
    }
  });
  (emp.bulkHours||[]).forEach(b=>{total+=parseFloat(b.hours)||0;});
  return Math.round(total*10)/10;
}
function getClearanceStatus(emp,library){
  if(emp.cleared_at)return{cleared:true,missing:[],lockedSince:emp.cleared_at};
  const clearanceTrainings=library.filter(t=>t.tags?.includes("Required for Clearance"));
  if(clearanceTrainings.length===0)return{cleared:true,missing:[],lockedSince:null};
  const missing=clearanceTrainings.filter(t=>!emp.trainings?.[t.id]?.completed);
  return{cleared:missing.length===0,missing,lockedSince:null};
}
function shouldLockClearance(emp,library){
  if(emp.cleared_at)return false;
  const clearanceTrainings=library.filter(t=>t.tags?.includes("Required for Clearance"));
  if(clearanceTrainings.length===0)return false;
  return clearanceTrainings.every(t=>!!emp.trainings?.[t.id]?.completed);
}
function nextAnniv(hire){
  try{const h=new Date(hire),t=new Date();let d=new Date(t.getFullYear(),h.getMonth(),h.getDate());if(d<t)d=new Date(t.getFullYear()+1,h.getMonth(),h.getDate());return d.toISOString().split("T")[0];}catch{return"";}
}
function getStatus(completed,dueDate,hireDate,renewalCycle,isAck){
  try{
    if(isAck)return completed?"complete":"pending";
    if(completed){
      if(hireDate&&renewalCycle&&renewalCycle!=="One Time"){
        const completedDate=new Date(completed);
        if(renewalCycle==="2 Years"){const twoYearsAgo=new Date(today);twoYearsAgo.setFullYear(twoYearsAgo.getFullYear()-2);if(completedDate<twoYearsAgo)return"pending";}
        else if(renewalCycle==="6 Months"){const sixMonthsAgo=new Date(today);sixMonthsAgo.setMonth(sixMonthsAgo.getMonth()-6);if(completedDate<sixMonthsAgo)return"pending";}
        else{const twelveMonthsAgo=new Date(today);twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear()-1);if(completedDate<twelveMonthsAgo)return"pending";}
      }
      return"complete";
    }
    if(!dueDate)return"pending";
    const due=new Date(dueDate);const days=Math.ceil((due-today)/86400000);
    if(days<0)return"overdue";if(days<=30)return"soon";return"pending";
  }catch{return"pending";}
}
function daysLeft(dueDate){
  try{const d=Math.ceil((new Date(dueDate)-today)/86400000);if(d<0)return`${Math.abs(d)}d overdue`;if(d===0)return"Due today";return`${d}d left`;}catch{return"";}
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
function sortLibrary(library){
  const order=(tr)=>{const tags=tr.tags||[];if(tags.includes("Required for Clearance"))return 0;if(tags.includes("Pre-Service"))return 1;if(tags.includes("Annual"))return 2;if(tags.includes("Acknowledgement"))return 3;return 4;};
  return [...library].sort((a,b)=>order(a)-order(b));
}

const S={
  page:{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9",fontFamily:"system-ui,sans-serif"},
  card:{background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:16},
  inp:{background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:"9px 12px",color:"#f1f5f9",fontSize:13,width:"100%",boxSizing:"border-box",outline:"none"},
  sel:{background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:"9px 12px",color:"#f1f5f9",fontSize:13,outline:"none"},
  lbl:{fontSize:11,color:"#64748b",display:"block",marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:.4},
  btn:(bg="#3b82f6",full)=>({padding:"8px 16px",background:bg,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,width:full?"100%":"auto"}),
};

const ST_COLOR={complete:"#4ade80",overdue:"#f87171",soon:"#fbbf24",pending:"#9ca3af"};
const ST_BG={complete:"#16a34a22",overdue:"#dc262622",soon:"#ca8a0422",pending:"#6b728018"};
const ST_BDR={complete:"#16a34a55",overdue:"#dc262655",soon:"#ca8a0455",pending:"#6b728040"};
const ST_LBL={complete:"✓ Complete",overdue:"✗ Overdue",soon:"⚠ Due Soon",pending:"○ Pending"};
const CT_COLOR={"Read and Acknowledge":"#60a5fa","Read and Quiz":"#a78bfa","Link":"#34d399","Certificate":"#fbbf24"};
const CT_ICON={"Read and Acknowledge":"✍️","Read and Quiz":"📝","Link":"🔗","Certificate":"🏆"};
const TAG_COLOR={"Pre-Service":"#f97316","Annual":"#3b82f6","Required for Clearance":"#ef4444","Acknowledgement":"#a78bfa"};
const TAG_BG={"Pre-Service":"#f9731618","Annual":"#3b82f618","Required for Clearance":"#ef444418","Acknowledgement":"#a78bfa18"};
const TAG_ICON={"Pre-Service":"🔰","Annual":"📅","Required for Clearance":"🔑","Acknowledgement":"✍️"};
const CAT_COLOR={"Training":"#60a5fa","Acknowledgment":"#a78bfa","In-Service":"#34d399"};
const CAT_ICON={"Training":"📋","Acknowledgment":"✍️","In-Service":"🏢"};

function Tag({status}){const s=ST_COLOR[status]||"#9ca3af",bg=ST_BG[status]||"#6b728018",b=ST_BDR[status]||"#6b728040";return<span style={{background:bg,color:s,border:`1px solid ${b}`,padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{ST_LBL[status]||"○ Pending"}</span>;}
function CTag({type}){const c=CT_COLOR[type]||"#9ca3af";return<span style={{background:`${c}22`,color:c,padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{CT_ICON[type]} {type}</span>;}
function TrainingTags({tags}){if(!tags||tags.length===0)return null;return<>{tags.map(tag=><span key={tag} style={{background:TAG_BG[tag]||"#33415518",color:TAG_COLOR[tag]||"#94a3b8",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{TAG_ICON[tag]} {tag}</span>)}</>;}
function CatTag({category}){const c=CAT_COLOR[category]||"#94a3b8";const icon=CAT_ICON[category]||"📋";return<span style={{background:`${c}18`,color:c,padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{icon} {category}</span>;}
function Bar({val,total,h=7}){const pct=total?Math.round(val/total*100):0;const c=pct===100?"#4ade80":pct>60?"#fbbf24":"#f87171";return<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,background:"#0f172a",borderRadius:99,height:h,overflow:"hidden"}}><div style={{width:`${pct}%`,background:c,height:"100%",borderRadius:99}}/></div><span style={{fontSize:11,color:"#64748b",minWidth:36}}>{val}/{total}</span></div>;}
function HoursBar({completed,required}){const pct=required?Math.min(Math.round(completed/required*100),100):0;const c=pct>=100?"#4ade80":pct>60?"#fbbf24":"#f87171";return<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,background:"#0f172a",borderRadius:99,height:10,overflow:"hidden"}}><div style={{width:`${pct}%`,background:c,height:"100%",borderRadius:99}}/></div><span style={{fontSize:12,color:c,fontWeight:700,minWidth:80,textAlign:"right"}}>{completed}/{required} hrs</span></div>;}
function ClearanceBadge({cleared,lockedSince}){return<span style={{background:cleared?"#16a34a22":"#dc262622",color:cleared?"#4ade80":"#f87171",border:`1px solid ${cleared?"#16a34a55":"#dc262655"}`,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{cleared?`🔑 CLEARED${lockedSince?` since ${lockedSince}`:""}` :"⛔ NOT CLEARED"}</span>;}
function NavBar({title,sub,onBack,onHome,extra}){return<div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,position:"sticky",top:0,zIndex:100}}><div style={{display:"flex",alignItems:"center",gap:8}}>{onBack&&<button style={S.btn("#334155")} onClick={onBack}>← Back</button>}{onHome&&<button style={S.btn("#1e3a5f")} onClick={onHome}>🏠 Home</button>}<div><div style={{fontWeight:700,fontSize:15}}>{title}</div>{sub&&<div style={{fontSize:11,color:"#64748b"}}>{sub}</div>}</div></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{extra}</div></div>;}
function useToast(){
  const [list,setList]=useState([]);
  function toast(msg,type="info"){const id=Date.now();setList(p=>[...p,{id,msg,type}]);setTimeout(()=>setList(p=>p.filter(t=>t.id!==id)),4000);}
  function Toasts(){const cols={success:"#16a34a",error:"#dc2626",warn:"#ca8a04",info:"#3b82f6"};return<div style={{position:"fixed",bottom:16,right:16,zIndex:1000,display:"flex",flexDirection:"column",gap:6,maxWidth:320}}>{list.map(t=><div key={t.id} style={{background:cols[t.type],color:"#fff",padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:600,boxShadow:"0 4px 16px #0006",wordBreak:"break-word"}}>{t.msg}</div>)}</div>;}
  return{toast,Toasts};
}
function Modal({title,onClose,children,wide}){return<div style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16,overflowY:"auto"}}><div style={{...S.card,width:"100%",maxWidth:wide?700:460,maxHeight:"92vh",overflowY:"auto"}}>{title&&<h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700}}>{title}</h3>}{children}<button style={{...S.btn("#334155",true),marginTop:12}} onClick={onClose}>Close</button></div></div>;}
function Confirm({msg,onYes,onNo,yesLabel="Yes, continue",yesColor="#dc2626"}){return<div style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}><div style={{...S.card,maxWidth:400,width:"100%",textAlign:"center"}}><div style={{fontSize:36,marginBottom:12}}>⚠️</div><p style={{fontSize:14,color:"#f1f5f9",margin:"0 0 20px",lineHeight:1.6}}>{msg}</p><div style={{display:"flex",gap:8,justifyContent:"center"}}><button style={S.btn(yesColor)} onClick={onYes}>{yesLabel}</button><button style={S.btn("#334155")} onClick={onNo}>Cancel</button></div></div></div>;}
function TagSelector({value,onChange}){return<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{ALL_TAGS.map(tag=>{const selected=value.includes(tag);return<button key={tag} type="button" style={{padding:"5px 12px",borderRadius:99,fontSize:12,fontWeight:700,cursor:"pointer",border:`1px solid ${selected?TAG_COLOR[tag]:"#334155"}`,background:selected?TAG_BG[tag]:"transparent",color:selected?TAG_COLOR[tag]:"#64748b"}} onClick={()=>onChange(selected?value.filter(t=>t!==tag):[...value,tag])}>{TAG_ICON[tag]} {tag}</button>;})}</div>;}

function Quiz({quiz,name,empId,trId,onPass,onClose}){
  const [ans,setAns]=useState({});const [done,setDone]=useState(false);const [score,setScore]=useState(0);const [saving,setSaving]=useState(false);
  async function submit(){let c=0;quiz.forEach((q,i)=>{if(ans[i]===q.answer)c++;});const pct=Math.round(c/quiz.length*100);setScore(pct);setSaving(true);try{await supabase.from("quiz_attempts").insert([{employee_id:empId,training_id:trId,score:pct,passed:pct>=PASS_SCORE,total_questions:quiz.length,correct_answers:c,year:new Date().getFullYear()}]);}catch(e){console.error("quiz save:",e);}setSaving(false);setDone(true);if(pct>=PASS_SCORE)setTimeout(()=>onPass(pct),2000);}
  const allDone=quiz.every((_,i)=>ans[i]!==undefined);
  return<div style={{position:"fixed",inset:0,background:"#000e",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16,overflowY:"auto"}}><div style={{...S.card,width:"100%",maxWidth:620,maxHeight:"92vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><h2 style={{margin:0,fontSize:15,fontWeight:700}}>📝 {name}</h2><span style={{fontSize:12,color:"#64748b"}}>{quiz.length}q · Pass {PASS_SCORE}%</span></div>{!done?<>{quiz.map((q,i)=><div key={i} style={{marginBottom:12,padding:12,background:"#0f172a",borderRadius:8,border:"1px solid #334155"}}><div style={{fontWeight:600,fontSize:13,marginBottom:8}}>{i+1}. {q.question}</div>{(q.options||[]).map((o,j)=><label key={j} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,cursor:"pointer",marginBottom:3,background:ans[i]===j?"#3b82f622":"transparent",border:ans[i]===j?"1px solid #3b82f644":"1px solid transparent",fontSize:13}}><input type="radio" name={`q${i}`} checked={ans[i]===j} onChange={()=>setAns(p=>({...p,[i]:j}))} style={{accentColor:"#3b82f6"}}/>{o}</label>)}</div>)}<div style={{display:"flex",gap:8}}><button style={S.btn(allDone?"#7c3aed":"#334155",true)} onClick={submit} disabled={!allDone||saving}>{saving?"Saving…":"Submit Quiz"}</button><button style={S.btn("#334155")} onClick={onClose}>Cancel</button></div></>:<div style={{textAlign:"center",padding:"28px 0"}}><div style={{fontSize:52,marginBottom:10}}>{score>=PASS_SCORE?"🎉":"😔"}</div><div style={{fontSize:32,fontWeight:800,color:score>=PASS_SCORE?"#4ade80":"#f87171",marginBottom:8}}>{score}%</div><div style={{fontSize:14,color:"#94a3b8",marginBottom:14}}>{score>=PASS_SCORE?"Passed! Marking complete…":"Need "+PASS_SCORE+"% to pass."}</div>{score<PASS_SCORE&&<div style={{display:"flex",gap:8,justifyContent:"center"}}><button style={S.btn()} onClick={()=>{setAns({});setDone(false);}}>Retake</button><button style={S.btn("#334155")} onClick={onClose}>Close</button></div>}</div>}</div></div>;
}

function Acknowledge({tr,empName,onDone,onClose}){
  const [initials,setInitials]=useState("");const [checked,setChecked]=useState(false);
  const ok=initials.trim().length>=1&&initials.trim().length<=5&&checked;
  return<div style={{position:"fixed",inset:0,background:"#000e",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16,overflowY:"auto"}}><div style={{...S.card,width:"100%",maxWidth:580,maxHeight:"92vh",overflowY:"auto"}}><h2 style={{margin:"0 0 4px",fontSize:15,fontWeight:700}}>✍️ {tr.name}</h2><p style={{margin:"0 0 14px",fontSize:13,color:"#64748b"}}>Open the document, read it, then enter your initials to acknowledge.</p>{tr.link?<a href={tr.link} target="_blank" rel="noreferrer" style={{...S.btn("#1e3a5f",true),textDecoration:"none",display:"block",fontSize:13,marginBottom:14,textAlign:"center",padding:"10px 16px"}}>📄 Open Document ↗</a>:<div style={{background:"#0f172a",border:"1px solid #fbbf2444",borderRadius:8,padding:14,marginBottom:14,fontSize:13,color:"#fbbf24",textAlign:"center"}}>⚠️ No document link available yet.</div>}<div style={{background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:14,marginBottom:12,fontSize:13,color:"#94a3b8",lineHeight:1.7}}>By entering my initials, I, <strong style={{color:"#f1f5f9"}}>{empName}</strong>, certify I have read and agree to comply with <strong style={{color:"#f1f5f9"}}>{tr.name}</strong>.</div><label style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:13,marginBottom:14,cursor:"pointer"}}><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} style={{accentColor:"#3b82f6",marginTop:2,flexShrink:0}}/>I confirm I have read and understand this document.</label><label style={S.lbl}>Your Initials (1–5 characters)</label><input style={{...S.inp,fontSize:24,fontWeight:800,textAlign:"center",letterSpacing:8,marginBottom:10,fontFamily:"Georgia,serif"}} maxLength={5} value={initials} onChange={e=>setInitials(e.target.value.toUpperCase())} placeholder="__"/><p style={{fontSize:11,color:"#475569",margin:"0 0 12px"}}>Date: {new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</p><div style={{display:"flex",gap:8}}><button style={S.btn(ok?"#16a34a":"#334155",true)} disabled={!ok} onClick={()=>onDone(initials.trim())}>✍️ Sign & Acknowledge</button><button style={S.btn("#334155")} onClick={onClose}>Cancel</button></div></div></div>;
}

function ReadAndQuiz({tr,onTakeQuiz,onClose}){
  const hasQuiz=Array.isArray(tr.quiz)&&tr.quiz.length>0;
  return<div style={{position:"fixed",inset:0,background:"#000e",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16,overflowY:"auto"}}><div style={{...S.card,width:"100%",maxWidth:640,maxHeight:"92vh",overflowY:"auto"}}><h2 style={{margin:"0 0 4px",fontSize:15,fontWeight:700}}>📝 {tr.name}</h2><p style={{margin:"0 0 14px",fontSize:13,color:"#64748b"}}>Open the training material, read it, then take the quiz below.</p>{tr.link?<a href={tr.link} target="_blank" rel="noreferrer" style={{...S.btn("#1e3a5f",true),textDecoration:"none",display:"block",fontSize:13,marginBottom:14,textAlign:"center",padding:"10px 16px"}}>📄 Open Training Material ↗</a>:<div style={{background:"#0f172a",border:"1px solid #fbbf2444",borderRadius:8,padding:14,marginBottom:14,fontSize:13,color:"#fbbf24",textAlign:"center"}}>⚠️ No training material link available yet.</div>}<div style={{display:"flex",gap:8,marginTop:8}}>{hasQuiz?<button style={S.btn("#7c3aed",true)} onClick={onTakeQuiz}>📝 Take Quiz</button>:<div style={{...S.btn("#334155",true),textAlign:"center",cursor:"default",opacity:.7}}>Quiz not yet available.</div>}<button style={S.btn("#334155")} onClick={onClose}>Close</button></div></div></div>;
}

function QuizHistory({empId,trId,trName,onClose}){
  const [attempts,setAttempts]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{supabase.from("quiz_attempts").select("*").eq("employee_id",empId).eq("training_id",trId).order("attempted_at",{ascending:false}).then(({data})=>{setAttempts(data||[]);setLoading(false);});},[empId,trId]);
  return<Modal title={`📊 Quiz History — ${trName}`} onClose={onClose} wide>{loading?<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>Loading…</div>:attempts.length===0?<div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>No quiz attempts yet.</div>:<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12,fontSize:11,color:"#64748b",fontWeight:700,padding:"0 4px"}}><div>DATE</div><div>SCORE</div><div>RESULT</div><div>QUESTIONS</div></div>{attempts.map((a,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,padding:"10px 4px",borderBottom:"1px solid #334155",fontSize:13}}><div style={{color:"#94a3b8"}}>{new Date(a.attempted_at).toLocaleDateString()}</div><div style={{fontWeight:700,color:a.passed?"#4ade80":"#f87171"}}>{a.score}%</div><div><span style={{background:a.passed?"#16a34a22":"#dc262622",color:a.passed?"#4ade80":"#f87171",padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:700}}>{a.passed?"✓ Passed":"✗ Failed"}</span></div><div style={{color:"#94a3b8"}}>{a.correct_answers}/{a.total_questions}</div></div>)}</div>}</Modal>;
}

function Leaderboard({employees,library,selfId,onClose}){
  const ranked=useMemo(()=>[...employees].map(e=>{const entries=Object.entries(e.trainings||{});const done=entries.filter(([,v])=>v.completed).length;const onTime=entries.filter(([,v])=>v.completed&&v.dueDate&&new Date(v.completed)<=new Date(v.dueDate)).length;const hrs=calcCompletedHours(e,library);return{...e,done,total:entries.length,onTime,hrs,badges:calcBadges(e)};}).sort((a,b)=>b.hrs-a.hrs||b.done-a.done),[employees,library]);
  const medals=["🥇","🥈","🥉"];
  return<Modal title="🏆 Leaderboard" onClose={onClose} wide>{ranked.map((e,i)=>{const me=e.id===selfId;const req=requiredHours(e);return<div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:me?"#3b82f615":"#0f172a",borderRadius:8,border:me?"1px solid #3b82f644":"1px solid #1e293b",marginBottom:6}}><div style={{width:28,textAlign:"center",fontSize:18}}>{i<3?medals[i]:<span style={{fontSize:12,color:"#64748b",fontWeight:700}}>#{i+1}</span>}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:me?"#60a5fa":"#f1f5f9"}}>{e.name}{me&&" (you)"}</div><div style={{fontSize:11,color:"#64748b"}}>{e.pos}</div><div style={{marginTop:3}}><Bar val={e.done} total={e.total}/></div></div><div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:800,color:e.hrs>=req?"#4ade80":"#f1f5f9"}}>{e.hrs}h</div><div style={{fontSize:10,color:"#64748b"}}>of {req} required</div><div style={{fontSize:12}}>{e.badges.map(b=>BADGES.find(x=>x.id===b)?.icon||"").join("")}</div></div></div>;})};</Modal>;
}

function CollapsibleSection({label,color,bg,done,total,hours,overdue,dueSoon,isEmpty,children}){
  const [open,setOpen]=useState(false);
  const hasUrgent=overdue>0||dueSoon>0;const empty=isEmpty||total===0;
  return<div style={{marginBottom:10}}><div onClick={()=>!empty&&setOpen(p=>!p)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:empty?"#1e293b":bg,border:`1px solid ${empty?"#334155":color+"33"}`,borderRadius:open&&!empty?"10px 10px 0 0":"10px",padding:"10px 14px",cursor:empty?"default":"pointer",opacity:empty?0.45:1}}><div style={{display:"flex",alignItems:"center",gap:10,flex:1}}><span style={{fontSize:14,color:empty?"#475569":"#94a3b8",display:"inline-block",transform:open&&!empty?"rotate(90deg)":"rotate(0deg)"}}>▶</span><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontWeight:700,fontSize:13,color:empty?"#475569":color}}>{label}</span>{hasUrgent&&!empty&&<span style={{display:"flex",gap:4}}>{overdue>0&&<span style={{background:"#dc262622",color:"#f87171",border:"1px solid #dc262644",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700}}>🚨 {overdue} Overdue</span>}{dueSoon>0&&<span style={{background:"#ca8a0422",color:"#fbbf24",border:"1px solid #ca8a0444",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700}}>⚠️ {dueSoon} Due Soon</span>}</span>}{empty&&<span style={{fontSize:10,color:"#475569",fontStyle:"italic"}}>None assigned</span>}</div>{!empty&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{done}/{total} complete{hours>0?` · ${Math.round(hours*10)/10}h earned`:""}</div>}</div>{!empty&&<div style={{minWidth:140,marginLeft:8}}><Bar val={done} total={total} h={6}/></div>}</div></div>{open&&!empty&&<div style={{background:"#1e293b",border:`1px solid ${color}22`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:"10px 10px 4px"}}>{children}</div>}</div>;
}

function FilterBar({search,onSearch,tagFilter,onTagFilter,statusFilter,onStatusFilter,sortMode,onSort,showCategory=false,categoryFilter,onCategoryFilter,resultCount,totalCount,onClear}){
  const hasFilters=search||tagFilter!=="All"||statusFilter!=="All"||(showCategory&&categoryFilter!=="All");
  const tagOpts=["All","✍️ Acknowledgements","🔑 Required for Clearance","🔰 Pre-Service","📅 Annual","📋 Other"];
  const statusOpts=["All","✓ Complete","○ Pending","⚠ Due Soon","✗ Overdue"];
  const sortOpts=["Default","A–Z","Z–A","Due Date","Recently Completed","Hours"];
  const catOpts=["All","📋 Training","✍️ Acknowledgment"];
  const selStyle={...S.sel,fontSize:12,padding:"7px 10px",minWidth:80};
  return<div style={{marginBottom:12}}><div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}><div style={{flex:1,minWidth:160,position:"relative"}}><input style={{...S.inp,paddingLeft:30,fontSize:12}} placeholder="Search trainings…" value={search} onChange={e=>onSearch(e.target.value)}/><span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#64748b",fontSize:13}}>🔍</span>{search&&<button style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:14}} onClick={()=>onSearch("")}>✕</button>}</div><select style={selStyle} value={tagFilter} onChange={e=>onTagFilter(e.target.value)}>{tagOpts.map(o=><option key={o}>{o}</option>)}</select>{showCategory&&<select style={selStyle} value={categoryFilter} onChange={e=>onCategoryFilter(e.target.value)}>{catOpts.map(o=><option key={o}>{o}</option>)}</select>}<select style={selStyle} value={statusFilter} onChange={e=>onStatusFilter(e.target.value)}>{statusOpts.map(o=><option key={o}>{o}</option>)}</select><select style={selStyle} value={sortMode} onChange={e=>onSort(e.target.value)}>{sortOpts.map(o=><option key={o}>{o}</option>)}</select>{hasFilters&&<button style={{...S.btn("#334155"),padding:"7px 10px",fontSize:11,whiteSpace:"nowrap"}} onClick={onClear}>✕ Clear</button>}</div></div>;
}

function EmpPortal({employees,library,onRefresh,goHome}){
  const [nameQ,setNameQ]=useState("");const [pinQ,setPinQ]=useState("");
  const [empId,setEmpId]=useState(null);const [err,setErr]=useState("");
  const [tab,setTab]=useState("trainings");const [trSearch,setTrSearch]=useState("");
  const [activeQuiz,setActiveQuiz]=useState(null);const [activeAck,setActiveAck]=useState(null);const [activeRQ,setActiveRQ]=useState(null);
  const [showBoard,setShowBoard]=useState(false);const [showHistory,setShowHistory]=useState(null);
  const certRefs=useRef({});const {toast,Toasts}=useToast();
  const emp=employees.find(e=>e.id===empId);

  function login(){const f=employees.find(e=>e.name.toLowerCase()===nameQ.trim().toLowerCase()&&e.pin===pinQ.trim());if(f){setEmpId(f.id);setErr("");}else setErr("Name or passcode not found. Contact your supervisor.");}

  async function markDone(trId,extra={}){
    try{const existing=emp?.trainings[trId];const yearLabel=getCurrentYearLabel(emp.hire);await saveCompletion(empId,trId,{completed:todayStr,dueDate:emp.trainings[trId]?.dueDate||"",initials:extra.initials||null,initialsDate:extra.initialsDate||null,yearLabel},existing?.completionId||null);const freshEmp={...emp,trainings:{...emp.trainings,[trId]:{...emp.trainings[trId],completed:todayStr}}};if(shouldLockClearance(freshEmp,library))await supabase.from("employees").update({cleared_at:todayStr}).eq("id",empId);await onRefresh();toast("Training complete! 🎉","success");}catch(e){toast(`Could not save: ${e.message}`,"error");}
  }

  if(!emp&&empId)return<div style={S.page}><DemoBanner/><div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><div style={{textAlign:"center"}}><p style={{color:"#64748b",marginBottom:16}}>Could not load your profile.</p><button style={{background:"#3b82f6",color:"white",border:"none",borderRadius:8,padding:"10px 24px",fontSize:14,cursor:"pointer"}} onClick={()=>setEmpId(null)}>← Back</button></div></div></div>;

  if(!emp)return(
    <div style={S.page}><DemoBanner/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:16,minHeight:"calc(100vh - 60px)"}}>
        <Toasts/><div style={{width:"100%",maxWidth:380}}>
          <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:48,marginBottom:8}}>🎓</div><h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>ComplianceReady Demo</h1><p style={{margin:0,color:"#64748b",fontSize:14}}>Sign in to view your trainings</p></div>
          <div style={S.card}>
            <label style={S.lbl}>Full Name</label><input style={{...S.inp,marginBottom:12}} value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="Your full name"/>
            <label style={S.lbl}>Passcode</label><input style={{...S.inp,marginBottom:12}} type="password" value={pinQ} onChange={e=>setPinQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="Your passcode"/>
            {err&&<div style={{color:"#f87171",fontSize:13,marginBottom:10,background:"#dc262618",padding:"8px 12px",borderRadius:6}}>{err}</div>}
            <button style={S.btn("#3b82f6",true)} onClick={login}>Sign In</button>
            <button style={{...S.btn("#334155",true),marginTop:8}} onClick={goHome}>🏠 Back to Home</button>
          </div>
        </div>
      </div>
    </div>
  );

  const sortedLib=sortLibrary(library||[]);
  const assignedIds=Object.keys(emp?.trainings||{});
  const assignedTrainings=assignedIds.map(id=>{
    const libTr=sortedLib.find(t=>t.id===id)||{id,name:id,ctype:"Read and Acknowledge",link:"",docContent:"",docName:"",quiz:[],tags:[],default_hours:0,category:"Training",renewal_cycle:"12 Months"};
    const empTr=emp?.trainings?.[id]||{};
    return{...libTr,...empTr,id,name:libTr.name,ctype:libTr.ctype,quiz:Array.isArray(libTr.quiz)?libTr.quiz:[],link:libTr.link||"",tags:Array.isArray(libTr.tags)?libTr.tags:[],default_hours:libTr.default_hours||0,category:libTr.category||"Training",renewal_cycle:libTr.renewal_cycle||"12 Months",completed:empTr.completed||null,dueDate:empTr.dueDate||"",initials:empTr.initials||null,certificate:empTr.certificate||null,hours_override:empTr.hours_override??null,completionId:empTr.completionId||null};
  });

  const groups=[
    {label:"✍️ Acknowledgements",key:"Acknowledgement",color:"#a78bfa",bg:"#a78bfa15"},
    {label:"🔑 Required for Clearance",key:"Required for Clearance",color:"#ef4444",bg:"#ef444415"},
    {label:"🔰 Pre-Service",key:"Pre-Service",color:"#f97316",bg:"#f9731615"},
    {label:"📅 Annual",key:"Annual",color:"#3b82f6",bg:"#3b82f615"},
    {label:"📋 Other",key:"Other",color:"#64748b",bg:"#64748b15"},
  ];
  function getGroupKey(t){if(t.tags?.includes("Acknowledgement"))return"Acknowledgement";if(t.tags?.includes("Required for Clearance"))return"Required for Clearance";if(t.tags?.includes("Pre-Service"))return"Pre-Service";if(t.tags?.includes("Annual"))return"Annual";return"Other";}
  const searchLower=(trSearch||"").toLowerCase().trim();
  const filteredTrainings=searchLower?assignedTrainings.filter(t=>t&&t.name&&t.name.toLowerCase().includes(searchLower)):assignedTrainings;
  const grouped={};groups.forEach(g=>{grouped[g.key]=[];});filteredTrainings.forEach(t=>{if(!t)return;const key=getGroupKey(t);if(!grouped[key])grouped[key]=[];grouped[key].push(t);});

  const done=assignedTrainings.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="complete").length;
  const completedHrs=calcCompletedHours(emp,library);const reqHrs=requiredHours(emp);
  const {cleared,missing,lockedSince}=getClearanceStatus(emp,library);
  const badges=calcBadges(emp);
  const quizTr=activeQuiz?assignedTrainings.find(t=>t.id===activeQuiz):null;
  const ackTr=activeAck?assignedTrainings.find(t=>t.id===activeAck):null;
  const rqTr=activeRQ?assignedTrainings.find(t=>t.id===activeRQ):null;

  function TrainingCard({t}){
    if(!t)return null;
    const isAck=t?.tags?.includes("Acknowledgement");
    const st=getStatus(t?.completed,t?.dueDate,emp?.hire,t?.renewal_cycle,isAck);
    const hrs=effectiveHours(t,t)||0;const isComplete=st==="complete";const hasCert=!!t?.certificate;
    return<div style={{padding:"10px 12px",background:"#0f172a",borderRadius:8,border:`1px solid ${ST_BDR[st]}`,marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6,marginBottom:4}}>
        <span style={{fontWeight:600,fontSize:13,flex:1}}>{t.name}</span>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>{hasCert&&<span style={{background:"#16a34a22",color:"#4ade80",border:"1px solid #16a34a55",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700}}>🏆 Cert ✓</span>}<CTag type={t.ctype}/><Tag status={st}/></div>
      </div>
      {hrs>0&&!isAck&&<div style={{marginBottom:4}}><span style={{fontSize:11,fontWeight:700,color:isComplete?"#4ade80":"#64748b",background:isComplete?"#16a34a18":"#33415518",padding:"1px 8px",borderRadius:99}}>⏱ {hrs}h{!isComplete&&<span style={{color:"#475569",fontWeight:400}}> (pending)</span>}</span></div>}
      <div style={{fontSize:11,color:"#64748b",marginBottom:4,display:"flex",gap:12,flexWrap:"wrap"}}>
        {t.dueDate&&<span>Due: <span style={{color:ST_COLOR[st]}}>{t.dueDate}</span></span>}
        {t.completed&&<span>✓ <span style={{color:"#4ade80"}}>{t.completed}</span></span>}
        {t.initials&&<span>Initials: <span style={{color:"#60a5fa",fontFamily:"Georgia,serif",fontWeight:700}}>{t.initials}</span></span>}
      </div>
      {t.ctype==="Read and Quiz"&&<button style={{...S.btn("#334155"),padding:"3px 10px",fontSize:11,marginBottom:isComplete?0:8}} onClick={()=>setShowHistory(t)}>📊 Quiz History</button>}
      {st!=="complete"&&t.ctype!=="Certificate"&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
        {t.ctype==="Read and Acknowledge"&&<button style={{...S.btn("#3b82f6"),fontSize:12,padding:"5px 12px"}} onClick={()=>setActiveAck(t.id)}>✍️ Read & Initial</button>}
        {t.ctype==="Read and Quiz"&&<button style={{...S.btn("#7c3aed"),fontSize:12,padding:"5px 12px"}} onClick={()=>setActiveRQ(t.id)}>📝 Read & Take Quiz</button>}
        {t.ctype==="Link"&&<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{t.link?<a href={t.link} target="_blank" rel="noreferrer" style={{...S.btn("#16a34a"),textDecoration:"none",display:"inline-block",fontSize:12,padding:"5px 12px"}}>🔗 Go to Training ↗</a>:<span style={{fontSize:12,color:"#64748b",fontStyle:"italic"}}>Link coming soon.</span>}<span style={{fontSize:11,color:"#64748b",fontStyle:"italic"}}>Leadership marks complete.</span></div>}
      </div>}
    </div>;
  }

  return(
    <div style={S.page}><DemoBanner/><Toasts/>
      {showBoard&&<Leaderboard employees={employees} library={library} selfId={empId} onClose={()=>setShowBoard(false)}/>}
      {showHistory&&<QuizHistory empId={empId} trId={showHistory.id} trName={showHistory.name} onClose={()=>setShowHistory(null)}/>}
      {activeQuiz&&quizTr&&Array.isArray(quizTr.quiz)&&quizTr.quiz.length>0&&<Quiz quiz={quizTr.quiz} name={quizTr.name} empId={empId} trId={activeQuiz} onPass={()=>{markDone(activeQuiz);setActiveQuiz(null);setActiveRQ(null);}} onClose={()=>setActiveQuiz(null)}/>}
      {activeAck&&ackTr&&<Acknowledge tr={ackTr} empName={emp.name} onDone={i=>{markDone(activeAck,{initials:i,initialsDate:todayStr});setActiveAck(null);}} onClose={()=>setActiveAck(null)}/>}
      {activeRQ&&rqTr&&<ReadAndQuiz tr={rqTr} onTakeQuiz={()=>setActiveQuiz(activeRQ)} onClose={()=>setActiveRQ(null)}/>}
      <NavBar title={emp.name} sub={emp.pos} onHome={()=>{setEmpId(null);setTab("trainings");goHome();}} extra={<><button style={S.btn("#1e3a5f")} onClick={()=>setShowBoard(true)}>🏆 Board</button><button style={S.btn("#334155")} onClick={()=>{setEmpId(null);setTab("trainings");}}>Sign Out</button></>}/>
      <div style={{padding:16,maxWidth:780,margin:"0 auto"}}>
        <div style={{background:cleared?"#16a34a18":"#dc262618",border:`1px solid ${cleared?"#16a34a44":"#dc262644"}`,borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{cleared?"✅":"⛔"}</span><div><div style={{fontWeight:700,fontSize:14,color:cleared?"#4ade80":"#f87171"}}>{cleared?"CLEARED — Eligible to work independently":"NOT CLEARED — Missing required training"}</div>{!cleared&&<div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>Missing: {missing.map(t=>t.name).join(", ")}</div>}{cleared&&lockedSince&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>Cleared since {lockedSince}</div>}</div></div>
          <ClearanceBadge cleared={cleared} lockedSince={lockedSince}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
          {[{l:"Done",v:`${done}/${assignedTrainings.length}`,c:done===assignedTrainings.length?"#4ade80":"#60a5fa"},{l:"Hours Earned",v:`${completedHrs}h`,c:completedHrs>=reqHrs?"#4ade80":"#fbbf24"},{l:"Required",v:`${reqHrs}h`,c:"#94a3b8"},{l:"Badges",v:badges.map(b=>BADGES.find(x=>x.id===b)?.icon||"").join("")||"—",c:"#a78bfa"}].map(s=>(
            <div key={s.l} style={{...S.card,textAlign:"center",padding:10}}><div style={{fontSize:s.l==="Badges"?16:18,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#64748b",marginTop:2}}>{s.l}</div></div>
          ))}
        </div>
        <div style={{...S.card,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><div style={S.lbl}>Annual Training Hours</div><span style={{fontSize:11,color:"#64748b"}}>{emp.type} · {isYear1(emp.hire)?"Year 1 (80h req)":"Year 2+ (40h req)"}</span></div>
          <HoursBar completed={completedHrs} required={reqHrs}/>
          {completedHrs<reqHrs&&<div style={{fontSize:11,color:"#fbbf24",marginTop:4}}>{(reqHrs-completedHrs).toFixed(1)} hours still needed this year</div>}
          {completedHrs>=reqHrs&&<div style={{fontSize:11,color:"#4ade80",marginTop:4}}>✓ Annual hour requirement met!</div>}
        </div>
        {badges.length>0&&<div style={{...S.card,marginBottom:12}}><div style={{...S.lbl,marginBottom:8}}>🎖️ Your Badges</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{badges.map(bid=>{const b=BADGES.find(x=>x.id===bid);return b?<div key={bid} style={{background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:"8px 10px",textAlign:"center",minWidth:76}}><div style={{fontSize:20}}>{b.icon}</div><div style={{fontSize:10,fontWeight:700,marginTop:2}}>{b.label}</div></div>:null;})}</div></div>}
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button style={S.btn(tab==="trainings"?"#3b82f6":"#334155",true)} onClick={()=>setTab("trainings")}>📋 My Trainings</button>
        </div>
        <div>
          <div style={{position:"relative",marginBottom:12}}><input style={{...S.inp,paddingLeft:32,fontSize:13}} placeholder="Search trainings…" value={trSearch} onChange={e=>setTrSearch(e.target.value)}/><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#64748b",fontSize:13}}>🔍</span>{trSearch&&<button style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:14}} onClick={()=>setTrSearch("")}>✕</button>}</div>
          {groups.map(g=>{
            const grp=grouped[g.key]||[];const allInGroup=assignedTrainings.filter(t=>getGroupKey(t)===g.key);
            const grpDone=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="complete").length;
            const grpHrs=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="complete").reduce((a,t)=>a+effectiveHours(t,t),0);
            const grpOverdue=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="overdue").length;
            const grpSoon=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="soon").length;
            return<CollapsibleSection key={g.key} label={g.label} color={g.color} bg={g.bg} done={grpDone} total={grp.length} hours={grpHrs} overdue={grpOverdue} dueSoon={grpSoon} isEmpty={allInGroup.length===0}>{grp.map(t=><TrainingCard key={t.id} t={t}/>)}</CollapsibleSection>;
          })}
        </div>
      </div>
    </div>
  );
}

export default function App(){
  const [employees,setEmployees]=useState([]);const [library,setLibrary]=useState([]);
  const [loading,setLoading]=useState(true);const [screen,setScreen]=useState("home");
  const [code,setCode]=useState("");const [codeErr,setCodeErr]=useState("");

  async function loadAll(){
    try{const [lib,emps]=await Promise.all([getLibrary(),getEmployees()]);setLibrary(lib);setEmployees(emps);}
    catch(e){console.error("Load error:",e);}finally{setLoading(false);}
  }
  useEffect(()=>{loadAll();},[]);
  function goHome(){setScreen("home");setCode("");setCodeErr("");}
  function tryAdmin(){code===ADMIN_CODE?(setScreen("admin"),setCodeErr("")):setCodeErr("Incorrect code. Please try again.");}

  if(loading)return<div style={{...S.page,display:"flex",flexDirection:"column"}}><DemoBanner/><div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:16}}>🎓</div><div style={{fontSize:16,color:"#64748b"}}>Loading ComplianceReady Demo…</div></div></div></div>;
  if(screen==="employee")return<ErrorBoundary><EmpPortal employees={employees} library={library} onRefresh={loadAll} goHome={goHome}/></ErrorBoundary>;
  if(screen==="admin")return<div style={S.page}><DemoBanner/><div style={{padding:32,textAlign:"center"}}><div style={{fontSize:48,marginBottom:16}}>🛡️</div><div style={{fontSize:16,color:"#64748b",marginBottom:24}}>Leadership Dashboard — Demo Mode</div><div style={{...S.card,maxWidth:400,margin:"0 auto",textAlign:"left"}}><p style={{fontSize:13,color:"#94a3b8",marginBottom:16}}>The full leadership dashboard is available in the production version. This demo focuses on the employee experience.</p><p style={{fontSize:13,color:"#94a3b8",marginBottom:16}}>Try logging in as an employee to see the full training portal experience.</p><button style={S.btn("#3b82f6",true)} onClick={()=>setScreen("employee")}>👤 Try Employee Portal</button><button style={{...S.btn("#334155",true),marginTop:8}} onClick={goHome}>🏠 Back to Home</button></div></div></div>;
  if(screen==="admin-login")return(
    <div style={S.page}><DemoBanner/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:16,minHeight:"calc(100vh - 60px)"}}>
        <div style={{width:"100%",maxWidth:360}}>
          <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:44,marginBottom:8}}>🛡️</div><h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Leadership Access</h1><p style={{margin:0,color:"#64748b",fontSize:13}}>Enter the admin code to continue</p></div>
          <div style={S.card}>
            <label style={S.lbl}>Admin Code</label>
            <input style={{...S.inp,marginBottom:10}} type="password" value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryAdmin()} placeholder="Enter code"/>
            {codeErr&&<div style={{color:"#f87171",fontSize:13,marginBottom:10,background:"#dc262618",padding:"8px 12px",borderRadius:6}}>{codeErr}</div>}
            <button style={S.btn("#3b82f6",true)} onClick={tryAdmin}>Enter</button>
            <button style={{...S.btn("#334155",true),marginTop:8}} onClick={goHome}>🏠 Back to Home</button>
          </div>
        </div>
      </div>
    </div>
  );
  return(
    <div style={S.page}><DemoBanner/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:16,minHeight:"calc(100vh - 60px)"}}>
        <div style={{width:"100%",maxWidth:400,textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:12}}>🎓</div>
          <h1 style={{margin:"0 0 6px",fontSize:24,fontWeight:800}}>ComplianceReady</h1>
          <p style={{margin:"0 0 28px",color:"#64748b",fontSize:14}}>Staff training compliance for residential care</p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button style={{...S.btn("#3b82f6",true),padding:"16px 20px",fontSize:15,borderRadius:12}} onClick={()=>setScreen("employee")}>👤 Employee Portal<div style={{fontSize:12,fontWeight:400,marginTop:3,opacity:.8}}>Trainings · Hours · Clearance · Certificates</div></button>
            <button style={{...S.btn("#334155",true),padding:"16px 20px",fontSize:15,borderRadius:12}} onClick={()=>setScreen("admin-login")}>🛡️ Leadership Dashboard<div style={{fontSize:12,fontWeight:400,marginTop:3,opacity:.8}}>Admin access · code required</div></button>
          </div>
          <p style={{marginTop:16,fontSize:11,color:"#334155"}}>🌐 Connected to Supabase · Demo Environment</p>
        </div>
      </div>
    </div>
  );
}
