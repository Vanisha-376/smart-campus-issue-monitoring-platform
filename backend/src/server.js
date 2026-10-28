import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const app = express();
const port = Number(process.env.PORT || 5000);
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data');
const dataFile = path.join(dataDir, 'store.json');
const secret = process.env.JWT_SECRET || 'smart-campus-local-dev-secret';
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

async function saveStore() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}
let store;
async function initialize() {
  await fs.mkdir(dataDir, { recursive: true });
  try { store = JSON.parse(await fs.readFile(dataFile, 'utf8')); }
  catch { store = { users: [], issues: [], moduleRecords: [] }; }
  store.users ||= []; store.issues ||= []; store.moduleRecords ||= [];
  if (!store.users.some(u => u.email === 'admin@smartcampus.local')) {
    store.users.push({
      id: randomUUID(), name: 'Campus Administrator', email: 'admin@smartcampus.local',
      password: await bcrypt.hash('Admin@123', 10), department: 'Administration',
      year: 'Staff', roll_number: 'ADMIN001', phone: '', role: 'admin',
      created_at: new Date().toISOString()
    });
  }
  if (!store.users.some(u => u.email === 'student@smartcampus.local')) {
    store.users.push({
      id: randomUUID(), name: 'Vanisha Student', email: 'student@smartcampus.local',
      password: await bcrypt.hash('Student@123', 10), department: 'Computer Science and Engineering',
      year: 'III Year', roll_number: '24CSE001', phone: '', role: 'student',
      created_at: new Date().toISOString()
    });
  }
  if (store.issues.length === 0) {
    const student = store.users.find(u => u.email === 'student@smartcampus.local');
    const now = Date.now();
    store.issues = [
      {id:now-10000,user_id:student.id,title:'Wi-Fi not working in lab',category:'IT & Network',location:'Engineering Block, Lab 2',description:'The campus Wi-Fi disconnects repeatedly during lab sessions.',priority:'High',status:'Pending',assignedTo:'IT Department',reportedBy:student.name,contact:'',admin_note:'',created_at:new Date(now-86400000*2).toISOString(),updated_at:new Date(now-86400000*2).toISOString()},
      {id:now-9000,user_id:student.id,title:'Hostel water pressure issue',category:'Maintenance',location:'Hostel, Block A',description:'Water pressure is very low on the second floor.',priority:'Medium',status:'In Progress',assignedTo:'Maintenance Department',reportedBy:student.name,contact:'',admin_note:'Maintenance team has been assigned.',created_at:new Date(now-86400000).toISOString(),updated_at:new Date(now-3600000).toISOString()},
      {id:now-8000,user_id:student.id,title:'Projector connection problem',category:'Classroom Equipment',location:'Academic Block, Room 104',description:'The classroom projector does not detect HDMI input.',priority:'Low',status:'Resolved',assignedTo:'Electrical Team',reportedBy:student.name,contact:'',admin_note:'Cable replaced and tested.',created_at:new Date(now-86400000*4).toISOString(),updated_at:new Date(now-86400000).toISOString()}
    ];
  }
  await saveStore();
}
await initialize();

const categories = ['IT & Network','Maintenance','Electrical','Classroom Equipment','Hostel & Facilities','Cleanliness','Transport','Safety','Other'];
const priorities = ['Low','Normal','High','Urgent'];
const statuses = ['Pending','In Progress','Resolved','Rejected'];
const publicUser = u => ({id:u.id,name:u.name,email:u.email,department:u.department,year:u.year,roll_number:u.roll_number,phone:u.phone||'',role:u.role,created_at:u.created_at});
const tokenFor = u => jwt.sign({id:u.id,email:u.email,role:u.role,name:u.name},secret,{expiresIn:'7d'});
function auth(req,res,next) {
  const h=req.headers.authorization||'';
  if(!h.startsWith('Bearer ')) return res.status(401).json({message:'Please sign in to continue.'});
  try { req.user=jwt.verify(h.slice(7),secret); next(); }
  catch { return res.status(401).json({message:'Your session expired. Please sign in again.'}); }
}
function admin(req,res,next) { if(req.user?.role!=='admin') return res.status(403).json({message:'Admin access required.'}); next(); }

app.get('/api/health',(_req,res)=>res.json({status:'ok',storage:'local-json',service:'Smart Campus Issue Monitoring Platform'}));
app.post('/api/auth/register',async(req,res)=>{
  const {name,email,password,department,year,roll_number,phone='',role='student'}=req.body||{};
  if(!name||String(name).trim().length<2) return res.status(400).json({message:'Enter your full name.'});
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({message:'Enter a valid email.'});
  if(!password||String(password).length<6) return res.status(400).json({message:'Password must be at least 6 characters.'});
  if(!department||!year||!roll_number) return res.status(400).json({message:'Complete all required details.'});
  if(!['student','faculty','staff'].includes(role)) return res.status(400).json({message:'Choose a valid account type.'});
  if(store.users.some(u=>u.email===email.toLowerCase()||u.roll_number===roll_number)) return res.status(409).json({message:'That email or ID is already registered.'});
  const user={id:randomUUID(),name:String(name).trim(),email:email.toLowerCase(),password:await bcrypt.hash(password,10),department,year,roll_number,phone,role,created_at:new Date().toISOString()};
  store.users.push(user); await saveStore();
  res.status(201).json({message:'Account created successfully.',token:tokenFor(user),user:publicUser(user)});
});
app.post('/api/auth/login',async(req,res)=>{
  const email=String(req.body?.email||'').toLowerCase(), password=String(req.body?.password||'');
  const user=store.users.find(u=>u.email===email);
  if(!user||!(await bcrypt.compare(password,user.password))) return res.status(401).json({message:'Email or password is incorrect.'});
  res.json({message:'Signed in successfully.',token:tokenFor(user),user:publicUser(user)});
});
app.get('/api/auth/me',auth,(req,res)=>{
  const user=store.users.find(u=>u.id===req.user.id);
  if(!user) return res.status(404).json({message:'Account not found.'});
  res.json({user:publicUser(user)});
});
app.patch('/api/auth/profile',auth,async(req,res)=>{
  const user=store.users.find(u=>u.id===req.user.id);
  if(!user) return res.status(404).json({message:'Account not found.'});
  const {name,department,year,phone}=req.body||{};
  if(name!==undefined && String(name).trim().length<2) return res.status(400).json({message:'Name must contain at least 2 characters.'});
  if(name!==undefined) user.name=String(name).trim();
  if(department!==undefined) user.department=String(department);
  if(year!==undefined) user.year=String(year);
  if(phone!==undefined) user.phone=String(phone);
  await saveStore(); res.json({message:'Profile updated successfully.',user:publicUser(user)});
});

function issueForViewer(i, user) {
  const reporter=store.users.find(u=>u.id===i.user_id);
  return {...i,reportedBy:reporter?.name||i.reportedBy||'Campus user',reporterEmail:reporter?.email||''};
}
app.get('/api/issues',auth,(req,res)=>{
  let rows=store.issues.filter(i=>req.user.role==='admin'||i.user_id===req.user.id);
  if(req.query.status&&statuses.includes(req.query.status)) rows=rows.filter(i=>i.status===req.query.status);
  if(req.query.q) { const q=String(req.query.q).toLowerCase(); rows=rows.filter(i=>[i.title,i.category,i.location,i.description,i.reportedBy,i.assignedTo].some(v=>String(v||'').toLowerCase().includes(q))); }
  rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  res.json({issues:rows.map(i=>issueForViewer(i,req.user))});
});
app.post('/api/issues',auth,async(req,res)=>{
  const {title,category,location,description,priority='Normal',contact='',assignedTo='Not Assigned'}=req.body||{};
  if(!title||String(title).trim().length<4) return res.status(400).json({message:'Issue title must be at least 4 characters.'});
  if(!categories.includes(category)) return res.status(400).json({message:'Choose a valid category.'});
  if(!location||String(location).trim().length<2) return res.status(400).json({message:'Enter the issue location.'});
  if(!description||String(description).trim().length<10) return res.status(400).json({message:'Description must be at least 10 characters.'});
  if(!priorities.includes(priority)) return res.status(400).json({message:'Choose a valid priority.'});
  const user=store.users.find(u=>u.id===req.user.id), now=new Date().toISOString();
  const issue={id:Date.now(),user_id:user.id,title:String(title).trim(),category,location:String(location).trim(),description:String(description).trim(),priority,status:'Pending',assignedTo:String(assignedTo||'Not Assigned'),contact,admin_note:'',reportedBy:user.name,created_at:now,updated_at:now};
  store.issues.push(issue); await saveStore(); res.status(201).json({message:'Issue reported successfully.',issue:issueForViewer(issue,user)});
});
app.patch('/api/issues/:id',auth,async(req,res)=>{
  const issue=store.issues.find(i=>String(i.id)===String(req.params.id));
  if(!issue) return res.status(404).json({message:'Issue not found.'});
  if(req.user.role!=='admin' && issue.user_id!==req.user.id) return res.status(403).json({message:'You can only edit your own report.'});
  const {status,assignedTo,priority,admin_note,title,category,location,description}=req.body||{};
  if(req.user.role==='admin') {
    if(status!==undefined){if(!statuses.includes(status))return res.status(400).json({message:'Invalid status.'});issue.status=status;}
    if(assignedTo!==undefined)issue.assignedTo=String(assignedTo);
    if(admin_note!==undefined)issue.admin_note=String(admin_note);
    if(priority!==undefined&&priorities.includes(priority))issue.priority=priority;
  } else if(issue.status==='Pending') {
    if(title!==undefined)issue.title=String(title);
    if(category!==undefined&&categories.includes(category))issue.category=category;
    if(location!==undefined)issue.location=String(location);
    if(description!==undefined)issue.description=String(description);
  } else return res.status(400).json({message:'Only Pending reports can be edited by the reporter.'});
  issue.updated_at=new Date().toISOString(); await saveStore();
  res.json({message:'Issue updated successfully.',issue:issueForViewer(issue,req.user)});
});
app.delete('/api/issues/:id',auth,async(req,res)=>{
  const idx=store.issues.findIndex(i=>String(i.id)===String(req.params.id));
  if(idx<0)return res.status(404).json({message:'Issue not found.'});
  const issue=store.issues[idx];
  if(req.user.role!=='admin' && issue.user_id!==req.user.id)return res.status(403).json({message:'You can only delete your own report.'});
  if(req.user.role!=='admin' && issue.status!=='Pending')return res.status(400).json({message:'Only Pending reports can be withdrawn.'});
  store.issues.splice(idx,1);await saveStore();res.json({message:'Issue deleted successfully.'});
});
app.get('/api/analytics',auth,(req,res)=>{
  const rows=store.issues.filter(i=>req.user.role==='admin'||i.user_id===req.user.id);
  const total=rows.length, pending=rows.filter(i=>i.status==='Pending').length, inProgress=rows.filter(i=>i.status==='In Progress').length, resolved=rows.filter(i=>i.status==='Resolved').length, rejected=rows.filter(i=>i.status==='Rejected').length;
  const byCategory={}; rows.forEach(i=>byCategory[i.category]=(byCategory[i.category]||0)+1);
  res.json({total,pending,inProgress,resolved,rejected,resolutionRate:total?Math.round(resolved/total*100):0,byCategory,latest:rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6)});
});
app.get('/api/notifications',auth,(req,res)=>{
  const rows=store.issues.filter(i=>req.user.role==='admin'||i.user_id===req.user.id).map(i=>({
    id:`issue-${i.id}-${i.updated_at}`,issueId:i.id,title:i.title,status:i.status,assignedTo:i.assignedTo,
    message:req.user.role==='admin'?`${i.title} was reported by ${issueForViewer(i,req.user).reportedBy}.`:`Your report "${i.title}" is currently ${i.status}${i.assignedTo&&i.assignedTo!=='Not Assigned'?` and assigned to ${i.assignedTo}`:''}.`,
    created_at:i.updated_at||i.created_at,read:false
  })).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  res.json({notifications:rows});
});
app.get('/api/modules/records',auth,(req,res)=>{
  const rows=store.moduleRecords.filter(r=>req.user.role==='admin'||r.user_id===req.user.id||r.visibility==='campus');
  res.json({records:rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))});
});
app.post('/api/modules/records',auth,async(req,res)=>{
  const {module,title,details='',visibility='private'}=req.body||{};
  if(!module||!title||String(title).trim().length<2)return res.status(400).json({message:'Enter a module and record title.'});
  const record={id:randomUUID(),module:String(module),title:String(title).trim(),details:String(details).trim(),visibility:visibility==='campus'?'campus':'private',user_id:req.user.id,created_by:req.user.name,created_at:new Date().toISOString()};
  store.moduleRecords.push(record);await saveStore();res.status(201).json({message:'Module record saved.',record});
});
app.delete('/api/modules/records/:id',auth,async(req,res)=>{
  const idx=store.moduleRecords.findIndex(r=>r.id===req.params.id);
  if(idx<0)return res.status(404).json({message:'Record not found.'});
  if(req.user.role!=='admin'&&store.moduleRecords[idx].user_id!==req.user.id)return res.status(403).json({message:'You cannot delete this record.'});
  store.moduleRecords.splice(idx,1);await saveStore();res.json({message:'Record deleted.'});
});
app.get('/api/admin/users',auth,admin,(_req,res)=>res.json({users:store.users.map(publicUser)}));
app.patch('/api/admin/users/:id/role',auth,admin,async(req,res)=>{
  const user=store.users.find(u=>u.id===req.params.id);
  if(!user)return res.status(404).json({message:'User not found.'});
  if(!['student','faculty','staff','admin'].includes(req.body?.role))return res.status(400).json({message:'Invalid role.'});
  user.role=req.body.role;await saveStore();res.json({message:'User role updated.',user:publicUser(user)});
});
app.use((req,res)=>res.status(404).json({message:'Route not found.'}));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({message:'Unexpected server error.'});});
app.listen(port,()=>console.log(`Smart Campus API running at http://localhost:${port}`));
