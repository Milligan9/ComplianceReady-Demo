import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase.js";

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
            <p style={{color:"#64748b",fontSize:13,margin:"0 0 20px",lineHeight:1.6}}>Please refresh the page to continue.</p>
            <button style={{background:"#3b82f6",color:"white",border:"none",borderRadius:8,padding:"10px 24px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"}} onClick={()=>window.location.reload()}>🔄 Refresh Page</button>
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

function DisabledBanner({items}) {
  return (
    <div style={{background:"#1e3a5f",border:"1px solid #3b82f644",borderRadius:10,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"flex-start",gap:10}}>
      <span style={{fontSize:16,marginTop:2}}>🔒</span>
      <div>
        <div style={{fontWeight:700,fontSize:13,color:"#60a5fa",marginBottom:4}}>Disabled in Demo Mode</div>
        <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.8}}>
          {items.map((item,i)=><span key={i}>• {item}&nbsp;&nbsp;</span>)}
        </div>
      </div>
    </div>
  );
}

function DisabledButton({label,icon}) {
  return (
    <div title="Disabled in demo mode" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,fontSize:12,color:"#475569",cursor:"not-allowed",userSelect:"none"}}>
      <span style={{fontSize:11}}>🔒</span>{icon} {label}
    </div>
  );
}

const ADMIN_CODE = "demo2026";
const PASS_SCORE = 70;
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
function getYearEnd(hireDate){
  try{const s=getYearStart(hireDate);const e=new Date(s.getFullYear()+1,s.getMonth(),s.getDate());e.setDate(e.getDate()-1);return e;}catch{return new Date();}
}
function isYear1(hireDate){
  try{return(new Date()-new Date(hireDate))/(1000*60*60*24*365.25)<1;}catch{return false;}
}
function requiredHours(emp){if(emp.type==="Direct Care"&&isYear1(emp.hire))return 80;return 40;}
function isAcknowledgement(libTr){return !!(libTr?.tags?.includes("Acknowledgement"));}
function calcCompletedHours(emp,library){
  const yearStart=getYearStart(emp.hire);const yearEnd=getYearEnd(emp.hire);let total=0;
  Object.entries(emp.trainings||{}).forEach(([id,v])=>{
    if(!v.completed)return;const cd=new Date(v.completed);
    if(cd<yearStart||cd>yearEnd)return;
    const libTr=library.find(t=>t.id===id);if(isAcknowledgement(libTr))return;
    total+=effectiveHours(libTr,v);
  });
  (emp.bulkHours||[]).forEach(b=>{
    if(!b.entry_date)return;const bd=new Date(b.entry_date);
    if(bd<yearStart||bd>yearEnd)return;total+=parseFloat(b.hours)||0;
  });
  return Math.round(total*10)/10;
}
function getClearanceStatus(emp,library){
  if(emp.cleared_at)return{cleared:true,missing:[],lockedSince:emp.cleared_at};
  const ct=library.filter(t=>t.tags?.includes("Required for Clearance"));
  if(ct.length===0)return{cleared:true,missing:[],lockedSince:null};
  const missing=ct.filter(t=>!emp.trainings?.[t.id]?.completed);
  return{cleared:missing.length===0,missing,lockedSince:null};
}
function getStatus(completed,dueDate,hireDate,renewalCycle,isAck){
  try{
    if(isAck)return completed?"complete":"pending";
    if(completed){
      if(hireDate&&renewalCycle&&renewalCycle!=="One Time"){
        const cd=new Date(completed);
        if(renewalCycle==="2 Years"){const d=new Date(today);d.setFullYear(d.getFullYear()-2);if(cd<d)return"pending";}
        else if(renewalCycle==="6 Months"){const d=new Date(today);d.setMonth(d.getMonth()-6);if(cd<d)return"pending";}
        else{const d=new Date(today);d.setFullYear(d.getFullYear()-1);if(cd<d)return"pending";}
      }
      return"complete";
    }
    if(!dueDate)return"pending";
    const due=new Date(dueDate);const days=Math.ceil((due-today)/86400000);
    if(days<0)return"overdue";if(days<=30)return"soon";return"pending";
  }catch{return"pending";}
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

function Tag({status}){const s=ST_COLOR[status]||"#9ca3af",bg=ST_BG[status]||"#6b728018",b=ST_BDR[status]||"#6b728040";return<span style={{background:bg,color:s,border:`1px solid ${b}`,padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{ST_LBL[status]||"○ Pending"}</span>;}
function CTag({type}){const c=CT_COLOR[type]||"#9ca3af";return<span style={{background:`${c}22`,color:c,padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{CT_ICON[type]} {type}</span>;}
function TrainingTags({tags}){if(!tags||tags.length===0)return null;return<>{tags.map(tag=><span key={tag} style={{background:TAG_BG[tag]||"#33415518",color:TAG_COLOR[tag]||"#94a3b8",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{TAG_ICON[tag]} {tag}</span>)}</>;}
function Bar({val,total,h=7}){const pct=total?Math.round(val/total*100):0;const c=pct===100?"#4ade80":pct>60?"#fbbf24":"#f87171";return<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,background:"#0f172a",borderRadius:99,height:h,overflow:"hidden"}}><div style={{width:`${pct}%`,background:c,height:"100%",borderRadius:99}}/></div><span style={{fontSize:11,color:"#64748b",minWidth:36}}>{val}/{total}</span></div>;}
function HoursBar({completed,required}){   const pct=required?Math.min(Math.round(completed/required*100),100):0;   const c=pct>=100?"#4ade80":pct>60?"#fbbf24":"#f87171";   return<div style={{width:"100%"}}>     <div style={{background:"#0f172a",borderRadius:99,height:8,overflow:"hidden",width:"100%"}}>       <div style={{width:`${pct}%`,background:c,height:"100%",borderRadius:99}}/>     </div>     <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>       <span style={{fontSize:10,color:c,fontWeight:700}}>{completed}/{required} hrs</span>       <span style={{fontSize:10,color:"#475569"}}>{pct}%</span>     </div>   </div>; }{const pct=required?Math.min(Math.round(completed/required*100),100):0;const c=pct>=100?"#4ade80":pct>60?"#fbbf24":"#f87171";return<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,background:"#0f172a",borderRadius:99,height:10,overflow:"hidden"}}><div style={{width:`${pct}%`,background:c,height:"100%",borderRadius:99}}/></div><span style={{fontSize:12,color:c,fontWeight:700,minWidth:80,textAlign:"right"}}>{completed}/{required} hrs</span></div>;}
function ClearanceBadge({cleared,lockedSince}){return<span style={{background:cleared?"#16a34a22":"#dc262622",color:cleared?"#4ade80":"#f87171",border:`1px solid ${cleared?"#16a34a55":"#dc262655"}`,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{cleared?`🔑 CLEARED${lockedSince?` since ${lockedSince}`:""}` :"⛔ NOT CLEARED"}</span>;}
function NavBar({title,sub,onBack,onHome,extra}){return<div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,position:"sticky",top:0,zIndex:100}}><div style={{display:"flex",alignItems:"center",gap:8}}>{onBack&&<button style={S.btn("#334155")} onClick={onBack}>← Back</button>}{onHome&&<button style={S.btn("#1e3a5f")} onClick={onHome}>🏠 Home</button>}<div><div style={{fontWeight:700,fontSize:15}}>{title}</div>{sub&&<div style={{fontSize:11,color:"#64748b"}}>{sub}</div>}</div></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{extra}</div></div>;}
function useToast(){
  const [list,setList]=useState([]);
  function toast(msg,type="info"){const id=Date.now();setList(p=>[...p,{id,msg,type}]);setTimeout(()=>setList(p=>p.filter(t=>t.id!==id)),4000);}
  function Toasts(){const cols={success:"#16a34a",error:"#dc2626",warn:"#ca8a04",info:"#3b82f6"};return<div style={{position:"fixed",bottom:16,right:16,zIndex:1000,display:"flex",flexDirection:"column",gap:6,maxWidth:320}}>{list.map(t=><div key={t.id} style={{background:cols[t.type],color:"#fff",padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:600,boxShadow:"0 4px 16px #0006",wordBreak:"break-word"}}>{t.msg}</div>)}</div>;}
  return{toast,Toasts};
}
function Modal({title,onClose,children,wide}){return<div style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16,overflowY:"auto"}}><div style={{...S.card,width:"100%",maxWidth:wide?700:460,maxHeight:"92vh",overflowY:"auto"}}>{title&&<h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700}}>{title}</h3>}{children}<button style={{...S.btn("#334155",true),marginTop:12}} onClick={onClose}>Close</button></div></div>;}

function CollapsibleSection({label,color,bg,done,total,hours,overdue,dueSoon,isEmpty,children}){
  const [open,setOpen]=useState(false);
  const hasUrgent=overdue>0||dueSoon>0;const empty=isEmpty||total===0;
  return<div style={{marginBottom:10}}><div onClick={()=>!empty&&setOpen(p=>!p)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:empty?"#1e293b":bg,border:`1px solid ${empty?"#334155":color+"33"}`,borderRadius:open&&!empty?"10px 10px 0 0":"10px",padding:"10px 14px",cursor:empty?"default":"pointer",opacity:empty?0.45:1}}><div style={{display:"flex",alignItems:"center",gap:10,flex:1}}><span style={{fontSize:14,color:empty?"#475569":"#94a3b8",display:"inline-block",transform:open&&!empty?"rotate(90deg)":"rotate(0deg)"}}>▶</span><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontWeight:700,fontSize:13,color:empty?"#475569":color}}>{label}</span>{hasUrgent&&!empty&&<span style={{display:"flex",gap:4}}>{overdue>0&&<span style={{background:"#dc262622",color:"#f87171",border:"1px solid #dc262644",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700}}>🚨 {overdue} Overdue</span>}{dueSoon>0&&<span style={{background:"#ca8a0422",color:"#fbbf24",border:"1px solid #ca8a0444",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700}}>⚠️ {dueSoon} Due Soon</span>}</span>}{empty&&<span style={{fontSize:10,color:"#475569",fontStyle:"italic"}}>None assigned</span>}</div>{!empty&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{done}/{total} complete{hours>0?` · ${Math.round(hours*10)/10}h earned`:""}</div>}</div>{!empty&&<div style={{minWidth:140,marginLeft:8}}><Bar val={done} total={total} h={6}/></div>}</div></div>{open&&!empty&&<div style={{background:"#1e293b",border:`1px solid ${color}22`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:"10px 10px 4px"}}>{children}</div>}</div>;
}

// ── EMPLOYEE PORTAL ───────────────────────────────────────────────────────────
function EmpPortal({employees,library,goHome}){
  const [nameQ,setNameQ]=useState("");const [pinQ,setPinQ]=useState("");
  const [empId,setEmpId]=useState(null);const [err,setErr]=useState("");
  const [tab,setTab]=useState("trainings");const [trSearch,setTrSearch]=useState("");
  const {toast,Toasts}=useToast();
  const emp=employees.find(e=>e.id===empId);

  function login(){const f=employees.find(e=>e.name.toLowerCase()===nameQ.trim().toLowerCase()&&e.pin===pinQ.trim());if(f){setEmpId(f.id);setErr("");}else setErr("Name or passcode not found. Contact your supervisor.");}

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
    const libTr=sortedLib.find(t=>t.id===id)||{id,name:id,ctype:"Read and Acknowledge",link:"",quiz:[],tags:[],default_hours:0,category:"Training",renewal_cycle:"12 Months"};
    const empTr=emp?.trainings?.[id]||{};
    return{...libTr,...empTr,id,name:libTr.name,ctype:libTr.ctype,quiz:Array.isArray(libTr.quiz)?libTr.quiz:[],link:libTr.link||"",tags:Array.isArray(libTr.tags)?libTr.tags:[],default_hours:libTr.default_hours||0,category:libTr.category||"Training",renewal_cycle:libTr.renewal_cycle||"12 Months",completed:empTr.completed||null,dueDate:empTr.dueDate||"",initials:empTr.initials||null,certificate:empTr.certificate||null,hours_override:empTr.hours_override??null};
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
  const filteredTrainings=searchLower?assignedTrainings.filter(t=>t?.name?.toLowerCase().includes(searchLower)):assignedTrainings;
  const grouped={};groups.forEach(g=>{grouped[g.key]=[];});filteredTrainings.forEach(t=>{if(!t)return;const key=getGroupKey(t);if(!grouped[key])grouped[key]=[];grouped[key].push(t);});

  const done=assignedTrainings.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="complete").length;
  const completedHrs=calcCompletedHours(emp,library);const reqHrs=requiredHours(emp);
  const {cleared,missing,lockedSince}=getClearanceStatus(emp,library);
  const badges=calcBadges(emp);
  const certCount=assignedTrainings.filter(t=>t?.certificate).length;

  function TrainingCard({t}){
    if(!t)return null;
    const isAck=t?.tags?.includes("Acknowledgement");
    const st=getStatus(t?.completed,t?.dueDate,emp?.hire,t?.renewal_cycle,isAck);
    const hrs=effectiveHours(t,t)||0;
    const isComplete=st==="complete";
    const hasCert=!!t?.certificate;

    return<div style={{padding:"10px 12px",background:"#0f172a",borderRadius:8,border:`1px solid ${ST_BDR[st]}`,marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6,marginBottom:4}}>
        <span style={{fontWeight:600,fontSize:13,flex:1}}>{t.name}</span>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
          {hasCert&&<span style={{background:"#16a34a22",color:"#4ade80",border:"1px solid #16a34a55",padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:700}}>🏆 Cert ✓</span>}
          <CTag type={t.ctype}/><Tag status={st}/>
        </div>
      </div>

      {hrs>0&&!isAck&&<div style={{marginBottom:4}}>
        <span style={{fontSize:11,fontWeight:700,color:isComplete?"#4ade80":"#64748b",background:isComplete?"#16a34a18":"#33415518",padding:"1px 8px",borderRadius:99}}>
          ⏱ {hrs}h{!isComplete&&<span style={{color:"#475569",fontWeight:400}}> (pending)</span>}
        </span>
      </div>}

      <div style={{fontSize:11,color:"#64748b",marginBottom:6,display:"flex",gap:12,flexWrap:"wrap"}}>
        {t.dueDate&&<span>Due: <span style={{color:ST_COLOR[st]}}>{t.dueDate}</span></span>}
        {t.completed&&<span>✓ <span style={{color:"#4ade80"}}>{t.completed}</span></span>}
        {t.initials&&<span>Initials: <span style={{color:"#60a5fa",fontFamily:"Georgia,serif",fontWeight:700}}>{t.initials}</span></span>}
      </div>

      {/* Show completion actions — all disabled in demo */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
        {t.ctype==="Read and Acknowledge"&&(
          isComplete
            ?<span style={{fontSize:11,color:"#4ade80"}}>✍️ Signed & Acknowledged</span>
            :<DisabledButton icon="✍️" label="Read & Sign to Acknowledge"/>
        )}
        {t.ctype==="Read and Quiz"&&<>
          {t.link&&<a href={t.link} target="_blank" rel="noreferrer" style={{...S.btn("#1e3a5f"),textDecoration:"none",display:"inline-block",fontSize:12,padding:"5px 12px"}}>📄 Open Material ↗</a>}
          {isComplete
            ?<span style={{fontSize:11,color:"#4ade80"}}>📝 Quiz Passed</span>
            :<DisabledButton icon="📝" label="Take Quiz"/>}
        </>}
        {t.ctype==="Link"&&<>
          {t.link
            ?<a href={t.link} target="_blank" rel="noreferrer" style={{...S.btn("#16a34a"),textDecoration:"none",display:"inline-block",fontSize:12,padding:"5px 12px"}}>🔗 Go to Training ↗</a>
            :<DisabledButton icon="🔗" label="Link coming soon"/>}
          {!isComplete&&<DisabledButton icon="✓" label="Mark Complete (Leadership only)"/>}
        </>}
        {t.ctype==="Certificate"&&<>
          {t.link&&<a href={t.link} target="_blank" rel="noreferrer" style={{...S.btn("#1e3a5f"),textDecoration:"none",display:"inline-block",fontSize:12,padding:"5px 12px"}}>🔗 Go to Training ↗</a>}
          {isComplete&&hasCert
            ?<span style={{fontSize:11,color:"#4ade80"}}>🏆 Certificate uploaded</span>
            :<DisabledButton icon="🏆" label="Upload Certificate"/>}
        </>}
      </div>
    </div>;
  }

  return(
    <div style={S.page}><DemoBanner/><Toasts/>
      <NavBar
        title={emp.name}
        sub={`${emp.pos} · ${emp.type}`}
        onHome={()=>{setEmpId(null);setTab("trainings");goHome();}}
        extra={<button style={S.btn("#334155")} onClick={()=>{setEmpId(null);setTab("trainings");}}>Sign Out</button>}
      />
      <div style={{padding:16,maxWidth:780,margin:"0 auto"}}>

        {/* Employee Info Card */}
        <div style={{...S.card,marginBottom:12,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
          <div><div style={S.lbl}>Start Date</div><div style={{fontWeight:600,fontSize:13}}>{emp.hire}</div></div>
          {emp.email&&<div><div style={S.lbl}>Email</div><div style={{fontSize:13,color:"#94a3b8"}}>{emp.email}</div></div>}
          {emp.phone&&<div><div style={S.lbl}>Phone</div><div style={{fontSize:13,color:"#94a3b8"}}>{emp.phone}</div></div>}
          <div style={{flex:1,minWidth:180}}><div style={S.lbl}>Training Progress</div><Bar val={done} total={assignedTrainings.length} h={10}/></div>
        </div>

        <DisabledBanner items={[
          "Signing & acknowledging documents",
          "Taking quizzes",
          "Uploading & downloading certificates",
          "Marking Link trainings complete",
          "Saving any completions",
          "Changing passcode",
          "Viewing leaderboard scores",
          "Earning badges (display only)",
        ]}/>

        {/* Clearance Banner */}
        <div style={{background:cleared?"#16a34a18":"#dc262618",border:`1px solid ${cleared?"#16a34a44":"#dc262644"}`,borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:24}}>{cleared?"✅":"⛔"}</span>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:cleared?"#4ade80":"#f87171"}}>{cleared?"CLEARED — Eligible to work independently":"NOT CLEARED — Missing required training"}</div>
              {!cleared&&<div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>Missing: {missing.map(t=>t.name).join(", ")}</div>}
              {cleared&&lockedSince&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>Cleared since {lockedSince}</div>}
            </div>
          </div>
          <ClearanceBadge cleared={cleared} lockedSince={lockedSince}/>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
          {[
            {l:"Done",v:`${done}/${assignedTrainings.length}`,c:done===assignedTrainings.length?"#4ade80":"#60a5fa"},
            {l:"Hours Earned",v:`${completedHrs}h`,c:completedHrs>=reqHrs?"#4ade80":"#fbbf24"},
            {l:"Required",v:`${reqHrs}h`,c:"#94a3b8"},
            {l:"Badges",v:badges.map(b=>BADGES.find(x=>x.id===b)?.icon||"").join("")||"—",c:"#a78bfa"},
          ].map(s=>(
            <div key={s.l} style={{...S.card,textAlign:"center",padding:10}}>
              <div style={{fontSize:s.l==="Badges"?16:18,fontWeight:700,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:"#64748b",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Hours Bar */}
        <div style={{...S.card,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <div style={S.lbl}>Annual Training Hours</div>
            <span style={{fontSize:11,color:"#64748b"}}>{emp.type} · {isYear1(emp.hire)?"Year 1 (80h req)":"Year 2+ (40h req)"}</span>
          </div>
          <HoursBar completed={completedHrs} required={reqHrs}/>
          {completedHrs<reqHrs&&<div style={{fontSize:11,color:"#fbbf24",marginTop:4}}>{(reqHrs-completedHrs).toFixed(1)} hours still needed this year</div>}
          {completedHrs>=reqHrs&&<div style={{fontSize:11,color:"#4ade80",marginTop:4}}>✓ Annual hour requirement met!</div>}
        </div>

        {/* Badges */}
        {badges.length>0&&<div style={{...S.card,marginBottom:12}}>
          <div style={{...S.lbl,marginBottom:8}}>🎖️ Your Badges</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {badges.map(bid=>{const b=BADGES.find(x=>x.id===bid);return b?<div key={bid} style={{background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:"8px 10px",textAlign:"center",minWidth:76}}><div style={{fontSize:20}}>{b.icon}</div><div style={{fontSize:10,fontWeight:700,marginTop:2}}>{b.label}</div></div>:null;})}
          </div>
        </div>}

        {/* Tabs */}
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button style={S.btn(tab==="trainings"?"#3b82f6":"#334155",true)} onClick={()=>setTab("trainings")}>📋 My Trainings</button>
          <button style={{...S.btn(tab==="certs"?"#3b82f6":"#334155",true),position:"relative"}} onClick={()=>setTab("certs")}>
            🏆 Certificates{certCount>0&&<span style={{background:"#4ade80",color:"#0f172a",borderRadius:99,fontSize:10,fontWeight:800,padding:"1px 6px",marginLeft:6}}>{certCount}</span>}
          </button>
        </div>

        {tab==="trainings"&&<div>
          <div style={{position:"relative",marginBottom:12}}>
            <input style={{...S.inp,paddingLeft:32,fontSize:13}} placeholder="Search trainings…" value={trSearch} onChange={e=>setTrSearch(e.target.value)}/>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#64748b",fontSize:13}}>🔍</span>
            {trSearch&&<button style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:14}} onClick={()=>setTrSearch("")}>✕</button>}
          </div>
          {groups.map(g=>{
            const grp=grouped[g.key]||[];
            const allInGroup=assignedTrainings.filter(t=>getGroupKey(t)===g.key);
            const grpDone=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="complete").length;
            const grpHrs=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="complete").reduce((a,t)=>a+effectiveHours(t,t),0);
            const grpOverdue=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="overdue").length;
            const grpSoon=grp.filter(t=>getStatus(t.completed,t.dueDate,emp?.hire,t.renewal_cycle,t.tags?.includes("Acknowledgement"))==="soon").length;
            return<CollapsibleSection key={g.key} label={g.label} color={g.color} bg={g.bg} done={grpDone} total={grp.length} hours={grpHrs} overdue={grpOverdue} dueSoon={grpSoon} isEmpty={allInGroup.length===0}>
              {grp.map(t=><TrainingCard key={t.id} t={t}/>)}
            </CollapsibleSection>;
          })}
        </div>}

        {tab==="certs"&&<div style={S.card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={S.lbl}>Certificate Vault</div>
            {certCount>0&&<span style={{background:"#16a34a22",color:"#4ade80",border:"1px solid #16a34a55",padding:"2px 10px",borderRadius:99,fontSize:12,fontWeight:700}}>🏆 {certCount} on file</span>}
          </div>
          <DisabledBanner items={["Uploading new certificates","Replacing existing certificates","Downloading certificates"]}/>
          <p style={{fontSize:12,color:"#64748b",margin:"0 0 12px",lineHeight:1.6}}>In the full version, employees upload completion certificates (PDF, JPG, PNG — max 5MB) which are stored securely and visible to leadership for compliance audits.</p>
          {assignedTrainings.map(t=>{
            const cert=t.certificate;
            return<div key={t.id} style={{padding:"10px 12px",background:"#0f172a",borderRadius:8,border:`1px solid ${cert?"#16a34a44":"#334155"}`,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontWeight:600,fontSize:13}}>{t.name}</span>
                  {cert&&<span style={{background:"#16a34a22",color:"#4ade80",border:"1px solid #16a34a55",padding:"1px 6px",borderRadius:99,fontSize:10,fontWeight:700}}>🏆 ✓</span>}
                </div>
                {cert
                  ?<div style={{fontSize:11,color:"#4ade80",marginTop:2}}>✓ {cert.name} · {cert.date}</div>
                  :<div style={{fontSize:11,color:"#475569",marginTop:2}}>No certificate uploaded</div>}
              </div>
              <DisabledButton icon={cert?"🔄":"⬆"} label={cert?"Replace":"Upload"}/>
            </div>;
          })}
        </div>}
      </div>
    </div>
  );
}

// ── LEADERSHIP DASHBOARD (DEMO) ───────────────────────────────────────────────
function AdminPortalDemo({employees,library,goHome}){
  const [selId,setSelId]=useState(null);
  const {Toasts}=useToast();

  function stats(e){
    const ts=Object.entries(e.trainings||{});
    const hrs=calcCompletedHours(e,library);const req=requiredHours(e);
    const {cleared}=getClearanceStatus(e,library);
    return{done:ts.filter(([,v])=>getStatus(v?.completed,v?.dueDate)==="complete").length,total:ts.length,hrs,req,cleared};
  }

  function printGroupReport(){
    const rows=employees.map(e=>{
      const {cleared,hrs,req}=stats(e);
      const aIds=Object.keys(e.trainings||{});
      const done=aIds.filter(id=>getStatus(e.trainings[id]?.completed,e.trainings[id]?.dueDate)==="complete").length;
      const overdue=aIds.filter(id=>getStatus(e.trainings[id]?.completed,e.trainings[id]?.dueDate)==="overdue").length;
      return`<tr><td>${e.name}</td><td>${e.pos}</td><td>${e.type}</td><td>${e.hire}</td><td style="color:${cleared?"green":"red"};font-weight:bold">${cleared?"✅ CLEARED":"⛔ NOT CLEARED"}</td><td style="color:${hrs>=req?"green":"red"};font-weight:bold">${hrs}/${req}h</td><td>${done}/${aIds.length}</td><td style="color:${overdue>0?"red":"green"};font-weight:bold">${overdue}</td></tr>`;
    }).join("");
    const clearedCt=employees.filter(e=>getClearanceStatus(e,library).cleared).length;
    const totalHrs=employees.reduce((a,e)=>a+calcCompletedHours(e,library),0);
    const html=`<!DOCTYPE html><html><head><title>ComplianceReady — Group Compliance Report</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px;}h1{font-size:18px;margin:0 0 4px;}table{width:100%;border-collapse:collapse;margin-top:12px;}th{background:#1e293b;color:white;padding:6px 8px;text-align:left;font-size:11px;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;}tr:nth-child(even){background:#f8fafc;}.sum{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;}.st{background:#f8fafc;padding:10px 16px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;min-width:80px;}.sn{font-size:20px;font-weight:bold;}.sl{font-size:10px;color:#64748b;}@media print{@page{margin:0.5in;}}</style>
    </head><body>
    <h1>ComplianceReady — Group Compliance Report</h1>
    <p style="font-size:11px;color:#64748b;margin:0 0 14px;">Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})} · DEMO DATA ONLY</p>
    <div class="sum">
      <div class="st"><div class="sn">${employees.length}</div><div class="sl">Total Staff</div></div>
      <div class="st"><div class="sn" style="color:${clearedCt===employees.length?"green":"red"}">${clearedCt}/${employees.length}</div><div class="sl">Cleared</div></div>
      <div class="st"><div class="sn" style="color:red">${employees.filter(e=>Object.values(e.trainings||{}).some(v=>getStatus(v?.completed,v?.dueDate)==="overdue")).length}</div><div class="sl">Staff w/ Overdue</div></div>
      <div class="st"><div class="sn">${totalHrs.toFixed(1)}h</div><div class="sl">Total Hours</div></div>
    </div>
    <table><thead><tr><th>Name</th><th>Position</th><th>Type</th><th>Hire Date</th><th>Clearance</th><th>Hours</th><th>Trainings Done</th><th>Overdue</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p style="font-size:10px;color:#999;margin-top:20px;">This report was generated from ComplianceReady demo data. Contact us to set up your facility.</p>
    </body></html>`;
    const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();
  }

  function printEmpReport(emp){
    const {cleared,lockedSince,missing}=getClearanceStatus(emp,library);
    const hrs=calcCompletedHours(emp,library);const req=requiredHours(emp);
    const assignedIds=Object.keys(emp.trainings||{});
    const rows=assignedIds.map(id=>{
      const libTr=library.find(t=>t.id===id)||{name:id,ctype:"",tags:[],renewal_cycle:"",default_hours:0};
      const v=emp.trainings[id]||{};
      const st=getStatus(v.completed,v.dueDate,emp.hire,libTr.renewal_cycle,libTr.tags?.includes("Acknowledgement"));
      const statusColor=st==="complete"?"green":st==="overdue"?"red":"orange";
      const hrs2=effectiveHours(libTr,v);
      return`<tr><td>${libTr.name}</td><td>${libTr.ctype||""}</td><td style="text-align:right">${hrs2>0?hrs2+"h":"—"}</td><td>${v.dueDate||""}</td><td>${v.completed||""}</td><td>${v.initials||""}</td><td style="color:${statusColor};font-weight:bold">${ST_LBL[st]||st}</td></tr>`;
    }).join("");
    const html=`<!DOCTYPE html><html><head><title>Compliance Report — ${emp.name}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px;}h1{font-size:18px;margin:0 0 4px;}h2{font-size:13px;color:#334155;margin:0 0 14px;font-weight:normal;}table{width:100%;border-collapse:collapse;margin-top:12px;}th{background:#1e293b;color:white;padding:6px 8px;text-align:left;font-size:11px;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;}tr:nth-child(even){background:#f8fafc;}.badge{padding:3px 10px;border-radius:16px;font-weight:bold;font-size:12px;}.cleared{background:#dcfce7;color:#16a34a;}.notcleared{background:#fee2e2;color:#dc2626;}.sum{display:flex;gap:12px;margin:12px 0;flex-wrap:wrap;}.st{background:#f8fafc;padding:10px 14px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;}.sn{font-size:20px;font-weight:bold;}.sl{font-size:10px;color:#64748b;}.sig{display:flex;gap:36px;margin-top:36px;}.sig-line{flex:1;border-top:1px solid #334155;padding-top:4px;font-size:9px;color:#64748b;}@media print{@page{margin:0.5in;}}</style>
    </head><body>
    <h1>ComplianceReady — Individual Compliance Report</h1>
    <h2>${emp.name} · ${emp.pos} · ${emp.type}</h2>
    <p style="font-size:11px;color:#64748b;margin:0 0 8px;">Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})} · DEMO DATA ONLY · Hire Date: ${emp.hire}</p>
    ${emp.email?`<p style="font-size:11px;color:#64748b;margin:0 0 12px;">Email: ${emp.email} · Phone: ${emp.phone||"—"}</p>`:""}
    <p><span class="badge ${cleared?"cleared":"notcleared"}">${cleared?`✅ CLEARED${lockedSince?` since ${lockedSince}`:""}` :"⛔ NOT CLEARED"}</span></p>
    ${!cleared?`<p style="font-size:11px;color:#dc2626;">Missing for clearance: ${missing.map(t=>t.name).join(", ")}</p>`:""}
    <div class="sum">
      <div class="st"><div class="sn" style="color:${hrs>=req?"green":"red"}">${hrs}/${req}h</div><div class="sl">Annual Hours</div></div>
      <div class="st"><div class="sn">${assignedIds.filter(id=>getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate)==="complete").length}/${assignedIds.length}</div><div class="sl">Trainings Done</div></div>
      <div class="st"><div class="sn" style="color:red">${assignedIds.filter(id=>getStatus(emp.trainings[id]?.completed,emp.trainings[id]?.dueDate)==="overdue").length}</div><div class="sl">Overdue</div></div>
    </div>
    <table><thead><tr><th style="width:30%">Training</th><th style="width:14%">Type</th><th style="width:6%;text-align:right">Hours</th><th style="width:10%">Due Date</th><th style="width:10%">Completed</th><th style="width:7%">Initials</th><th style="width:10%">Status</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="sig"><div class="sig-line">Employee Signature &amp; Date</div><div class="sig-line">Supervisor Signature &amp; Date</div><div class="sig-line">Title &amp; Date</div></div>
    <p style="font-size:10px;color:#999;margin-top:16px;">Generated from ComplianceReady demo data.</p>
    </body></html>`;
    const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();
  }

  const notClearedEmps=employees.filter(e=>!getClearanceStatus(e,library).cleared);
  const overdueEmps=employees.filter(e=>Object.values(e.trainings||{}).some(v=>getStatus(v?.completed,v?.dueDate)==="overdue"));
  const totalDone=employees.reduce((a,e)=>a+stats(e).done,0);
  const totalAll=employees.reduce((a,e)=>a+stats(e).total,0);

  return(
    <div style={S.page}><DemoBanner/><Toasts/>
      <NavBar
        title="ComplianceReady — Leadership Dashboard"
        sub="Demo Mode — read-only view"
        onHome={goHome}
        extra={<button style={S.btn("#1e3a5f")} onClick={printGroupReport}>📊 Print Group Report</button>}
      />
      <div style={{padding:16,maxWidth:1100,margin:"0 auto"}}>

        <DisabledBanner items={[
          "Adding or editing employees",
          "Resetting or clearing trainings",
          "Marking trainings complete",
          "Granting or revoking clearance",
          "Adding prior year / bulk hours",
          "Managing training library",
          "AI compliance assistant",
          "In-service session logging",
          "Uploading or downloading certificates",
          "Exporting full compliance reports (individual reports available below)",
        ]}/>

        {notClearedEmps.length>0&&<div style={{background:"#dc262618",border:"1px solid #dc262644",borderRadius:10,padding:"10px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>⛔</span>
          <div><div style={{fontWeight:700,color:"#f87171",fontSize:14}}>{notClearedEmps.length} staff NOT CLEARED to work independently</div><div style={{fontSize:12,color:"#94a3b8"}}>{notClearedEmps.map(e=>e.name).join(", ")}</div></div>
        </div>}
        {overdueEmps.length>0&&<div style={{background:"#ca8a0418",border:"1px solid #ca8a0444",borderRadius:10,padding:"10px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>🚨</span>
          <div><div style={{fontWeight:700,color:"#fbbf24",fontSize:14}}>{overdueEmps.length} staff with overdue trainings</div><div style={{fontSize:12,color:"#94a3b8"}}>{overdueEmps.map(e=>e.name).join(", ")}</div></div>
        </div>}

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:14}}>
          {[
            {l:"Total Staff",v:employees.length,c:"#60a5fa"},
            {l:"✅ Cleared",v:`${employees.length-notClearedEmps.length}/${employees.length}`,c:notClearedEmps.length===0?"#4ade80":"#f87171"},
            {l:"Overdue",v:overdueEmps.length,c:overdueEmps.length>0?"#f87171":"#4ade80"},
            {l:"Trainings Done",v:`${totalDone}/${totalAll}`,c:"#a78bfa"},
            {l:"Total Hours",v:`${employees.reduce((a,e)=>a+calcCompletedHours(e,library),0).toFixed(1)}h`,c:"#34d399"},
          ].map(s=>(
            <div key={s.l} style={{...S.card,textAlign:"center",padding:12}}>
              <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:"#64748b",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{...S.lbl,marginBottom:8}}>Staff — click any card to view details & print individual report</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
          {employees.map(emp=>{
            const {done,total,hrs,req,cleared}=stats(emp);
            const hasOver=Object.values(emp.trainings||{}).some(v=>getStatus(v?.completed,v?.dueDate)==="overdue");
            const bc=!cleared?"#ef4444":hasOver?"#f87171":hrs<req?"#fbbf24":done===total&&total>0?"#4ade80":"#334155";
            return<div key={emp.id} style={{...S.card,cursor:"pointer",borderColor:bc,padding:13}} onClick={()=>setSelId(emp.id)}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13}}>{emp.name}</div>
                  <div style={{fontSize:11,color:"#60a5fa",marginTop:1}}>{emp.pos}</div>
                  <div style={{fontSize:10,color:"#64748b"}}>{emp.type} · {isYear1(emp.hire)?"Year 1":"Year 2+"}</div>
                  {emp.email&&<div style={{fontSize:10,color:"#64748b",marginTop:2}}>✉ {emp.email}</div>}
                  {emp.phone&&<div style={{fontSize:10,color:"#64748b"}}>📞 {emp.phone}</div>}
                </div>
                <ClearanceBadge cleared={cleared}/>
              </div>
              <div style={{marginBottom:4}}><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>Training Progress</div><Bar val={done} total={total}/></div>
              <div><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>Annual Hours</div><HoursBar completed={hrs} required={req}/></div>
              {hasOver&&<div style={{marginTop:6}}><span style={{background:"#dc262622",color:"#f87171",padding:"1px 8px",borderRadius:99,fontSize:10,fontWeight:700}}>🚨 Has Overdue Trainings</span></div>}
            </div>;
          })}
        </div>

        {selId&&(()=>{
          const emp=employees.find(e=>e.id===selId);if(!emp)return null;
          const {cleared,lockedSince,missing}=getClearanceStatus(emp,library);
          const hrs=calcCompletedHours(emp,library);const req=requiredHours(emp);
          const assignedIds=Object.keys(emp.trainings||{});
          return<Modal title={`📋 ${emp.name} — Training Detail`} onClose={()=>setSelId(null)} wide>
            <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
              <ClearanceBadge cleared={cleared} lockedSince={lockedSince}/>
              <span style={{fontSize:13,color:hrs>=req?"#4ade80":"#fbbf24",fontWeight:700}}>{hrs}/{req}h Annual Hours</span>
              <button style={{...S.btn("#1e3a5f"),marginLeft:"auto",fontSize:12,padding:"5px 14px"}} onClick={()=>printEmpReport(emp)}>📊 Print Individual Report</button>
            </div>
            {emp.email&&<div style={{fontSize:12,color:"#64748b",marginBottom:4}}>✉ {emp.email} {emp.phone&&`· 📞 ${emp.phone}`}</div>}
            {!cleared&&<div style={{fontSize:12,color:"#f87171",marginBottom:8,background:"#dc262618",padding:"8px 10px",borderRadius:6}}>⛔ Missing for clearance: {missing.map(t=>t.name).join(", ")}</div>}
            <DisabledBanner items={["Editing completions","Resetting trainings","Granting or revoking clearance","Adding hours"]}/>
            <div style={{maxHeight:400,overflowY:"auto"}}>
              {assignedIds.map(id=>{
                const libTr=library.find(t=>t.id===id)||{name:id,ctype:"",tags:[],renewal_cycle:"12 Months",default_hours:0};
                const v=emp.trainings[id]||{};
                const st=getStatus(v.completed,v.dueDate,emp.hire,libTr.renewal_cycle,libTr.tags?.includes("Acknowledgement"));
                const tHrs=effectiveHours(libTr,v);
                return<div key={id} style={{padding:"8px 10px",background:"#0f172a",borderRadius:8,border:`1px solid ${ST_BDR[st]}`,marginBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:12}}>{libTr.name}</div>
                    <div style={{fontSize:11,color:"#64748b",display:"flex",gap:8,marginTop:2,flexWrap:"wrap"}}>
                      <CTag type={libTr.ctype}/>
                      {tHrs>0&&<span style={{color:st==="complete"?"#4ade80":"#64748b"}}>⏱ {tHrs}h</span>}
                      {v.completed&&<span>✓ {v.completed}</span>}
                      {v.dueDate&&!v.completed&&<span>Due: {v.dueDate}</span>}
                      {v.initials&&<span>Initials: <span style={{fontFamily:"Georgia,serif",fontWeight:700,color:"#60a5fa"}}>{v.initials}</span></span>}
                    </div>
                  </div>
                  <Tag status={st}/>
                </div>;
              })}
            </div>
          </Modal>;
        })()}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [employees,setEmployees]=useState([]);
  const [library,setLibrary]=useState([]);
  const [loading,setLoading]=useState(true);
  const [screen,setScreen]=useState("home");
  const [code,setCode]=useState("");
  const [codeErr,setCodeErr]=useState("");

  async function loadAll(){
    try{
      const [libData,empData]=await Promise.all([
        supabase.from('training_library').select('*').order('sort_order'),
        supabase.from('employees').select('*').order('name'),
      ]);
      const lib=(libData.data||[]).map(t=>({
        id:t.id,name:t.name,ctype:t.ctype,link:t.link||'',
        docContent:t.doc_content||'',docName:t.doc_name||'',
        quiz:Array.isArray(t.quiz)?t.quiz:[],
        category:t.category||'Training',
        tags:Array.isArray(t.tags)?t.tags:[],
        renewal_cycle:t.renewal_cycle||'12 Months',
        default_hours:t.default_hours||0,
        provider:t.provider||'',
      }));
      const emps=await Promise.all((empData.data||[]).map(async e=>{
        const eid=e.id;
        const [assignRes,compRes,bulkRes]=await Promise.all([
          supabase.from('employee_trainings').select('*').eq('employee_id',eid),
          supabase.from('training_completions').select('*').eq('employee_id',eid),
          supabase.from('bulk_hours').select('*').eq('employee_id',eid),
        ]);
        const trainings={};
        (assignRes.data||[]).forEach(a=>{
          const trCompletions=(compRes.data||[])
            .filter(c=>c.training_id===a.training_id)
            .sort((x,y)=>(y.completed||'').localeCompare(x.completed||''));
          const current=trCompletions[0]||null;
          trainings[a.training_id]={
            completed:current?.completed||null,
            dueDate:current?.due_date||a.due_date||'',
            initials:current?.initials||null,
            hours_override:current?.hours_override??null,
            completionId:current?.id||null,
            certificate:null,
          };
        });
        return{
          id:e.id,name:e.name,pos:e.pos,type:e.type,
          hire:e.hire,email:e.email,phone:e.phone,pin:e.pin,
          cleared_at:e.cleared_at||null,
          trainings,
          bulkHours:bulkRes.data||[],
        };
      }));
      setLibrary(lib);setEmployees(emps);
    }catch(e){console.error("Load error:",e);}
    finally{setLoading(false);}
  }

  useEffect(()=>{loadAll();},[]);
  function goHome(){setScreen("home");setCode("");setCodeErr("");}
  function tryAdmin(){code===ADMIN_CODE?(setScreen("admin"),setCodeErr("")):setCodeErr("Incorrect code. Please try again.");}

  if(loading)return(
    <div style={{...S.page,display:"flex",flexDirection:"column"}}>
      <DemoBanner/>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>🎓</div>
          <div style={{fontSize:16,color:"#64748b"}}>Loading ComplianceReady Demo…</div>
        </div>
      </div>
    </div>
  );

  if(screen==="employee")return<ErrorBoundary><EmpPortal employees={employees} library={library} goHome={goHome}/></ErrorBoundary>;
  if(screen==="admin")return<ErrorBoundary><AdminPortalDemo employees={employees} library={library} goHome={goHome}/></ErrorBoundary>;

  if(screen==="admin-login")return(
    <div style={S.page}><DemoBanner/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:16,minHeight:"calc(100vh - 60px)"}}>
        <div style={{width:"100%",maxWidth:360}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:44,marginBottom:8}}>🛡️</div>
            <h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Leadership Access</h1>
            <p style={{margin:0,color:"#64748b",fontSize:13}}>Enter the admin code to continue</p>
          </div>
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
            <button style={{...S.btn("#3b82f6",true),padding:"16px 20px",fontSize:15,borderRadius:12}} onClick={()=>setScreen("employee")}>
              👤 Employee Portal
              <div style={{fontSize:12,fontWeight:400,marginTop:3,opacity:.8}}>Trainings · Hours · Clearance · Certificates</div>
            </button>
            <button style={{...S.btn("#334155",true),padding:"16px 20px",fontSize:15,borderRadius:12}} onClick={()=>setScreen("admin-login")}>
              🛡️ Leadership Dashboard
              <div style={{fontSize:12,fontWeight:400,marginTop:3,opacity:.8}}>Staff overview · Reports · Compliance tracking</div>
            </button>
          </div>
          <p style={{marginTop:16,fontSize:11,color:"#334155"}}>🌐 Connected to Supabase · Demo Environment</p>
        </div>
      </div>
    </div>
  );
}
