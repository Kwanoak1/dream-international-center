const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {randomBytes, randomUUID, createHash, timingSafeEqual, scryptSync} = require('node:crypto');

const password = process.env.DREAM_ADMIN_PASSWORD;
if (password && password.length < 9) throw Error('Set DREAM_ADMIN_PASSWORD (at least 9 characters).');
const port = Number(process.env.DREAM_PORT || 8765);
const origin = 'http://127.0.0.1:' + port;
const data = path.resolve(process.env.DREAM_DATA_DIR || path.join(__dirname,'activity-data'));
fs.mkdirSync(data,{recursive:true});
const publicFiles = {'/':'index.html','/index.html':'index.html','/design.html':'design.html','/design.js':'design.js','/admin.html':'admin.html','/activity.js':'activity.js','/members.html':'members.html','/members.js':'members.js'};
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const sessions = new Map();
const memberFile = path.join(data,'members.json');
let members = fs.existsSync(memberFile) ? JSON.parse(fs.readFileSync(memberFile,'utf8')) : [];
const publicMember = ({id,username,name,role,phone}) => ({id,username,name,role,phone:phone || ""});
function saveMembers(next) {
  const temporary=memberFile+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify(next));
  fs.renameSync(temporary,memberFile);
  members=next;
}
function memberHash(password,salt) {
  return scryptSync(password,salt,32);
}
const digest = value => createHash('sha256').update(value).digest();
if (!password) throw Error('Set DREAM_ADMIN_PASSWORD to start the local server.');
const expected = digest(password);
const duration = 8*60*60*1000;
let loginAfter = 0;

function send(res,status,body,headers={}) {
  res.writeHead(status,{'X-Content-Type-Options':'nosniff',...headers});
  res.end(body);
}
function json(res,status,body,headers={}) {
  send(res,status,JSON.stringify(body),{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
}
function session(req) {
  const id = /(?:^|;\s*)dream_admin=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  const record=id && sessions.get(id);
  if (!record || record.expiry<=Date.now()) return null;
  if (!record.memberId) return {id,role:'admin'};
  const member=members.find(item=>item.id===record.memberId);
  return member ? {id,role:member.role,name:member.name} : null;
}
function cookie(id,seconds) {
  return 'dream_admin='+id+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+seconds;
}
async function readBody(req,limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= limit) chunks.push(chunk);
  }
  if (size > limit) throw Object.assign(Error('too large'),{status:413});
  return Buffer.concat(chunks);
}
function gallery() {
  return fs.readdirSync(data).filter(name=>/^[0-9a-f-]{36}\.json$/.test(name))
    .map(name=>JSON.parse(fs.readFileSync(path.join(data,name),'utf8')))
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
const server = http.createServer({requestTimeout:30000},async (req,res)=>{
  try {
    if (req.headers.host !== '127.0.0.1:'+port) return send(res,403,'Forbidden');
    const url = new URL(req.url,origin);
    const route = url.pathname;
    if (req.method === 'GET' && Object.hasOwn(publicFiles,route)) {
      const file = publicFiles[route];
      return send(res,200,fs.readFileSync(path.join(__dirname,file)),{
        'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache'
      });
    }
    if (req.method === 'GET' && route === '/api/members') {
      if (session(req)?.role!=='admin') return json(res,403,{error:'관리자만 회원 목록을 볼 수 있습니다.'});
      return json(res,200,members.map(publicMember));
    }
    if (req.method === 'GET' && route === '/api/photos') return session(req) ? json(res,200,gallery()) : json(res,401,{error:'회원 로그인이 필요합니다.'});
    if (req.method === 'GET' && route === '/api/admin/session') return json(res,200,{role:session(req)?.role || null,name:session(req)?.name || ''});
    if (req.method === 'GET' && /^\/activity-photo\/[a-f0-9-]{36}\.jpg$/.test(route)) {
      if (!session(req)) return send(res,401,'Login required',{'Cache-Control':'no-store'});
      const file = path.join(data,path.basename(route));
      if (fs.existsSync(file)) return send(res,200,fs.readFileSync(file),{'Content-Type':'image/jpeg','Cache-Control':'private, no-store'});
    }
    if (req.method === 'POST') {
      if (req.headers.origin !== origin) return json(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
      if (route === '/api/admin/login') {
        const supplied = await readBody(req,1024);
        if (Date.now()<loginAfter) return json(res,429,{error:'잠시 후 다시 시도해 주세요.'});
        const admin=(url.searchParams.get('role') || 'admin')==='admin';
        const username=(url.searchParams.get('username') || '').trim().toLowerCase();
        const member=admin ? null : members.find(item=>item.username===username);
        const valid=admin ? timingSafeEqual(expected,digest(supplied)) :
          member && timingSafeEqual(Buffer.from(member.hash,'hex'),memberHash(supplied,member.salt));
        if (!valid) {
          loginAfter = Date.now()+1500;
          return json(res,401,{error:'아이디 또는 비밀번호를 확인해 주세요.'});
        }
        for (const [id,record] of sessions) if (record.expiry<=Date.now() || id===session(req)?.id) sessions.delete(id);
        const id=randomBytes(32).toString('hex');
        sessions.set(id,{expiry:Date.now()+duration,memberId:member?.id});
        return json(res,200,{loggedIn:true,role:member?.role || 'admin',name:member?.name || ''},{'Set-Cookie':cookie(id,duration/1000)});
      }
      const active = session(req);
      if (!active) return json(res,401,{error:'회원 로그인이 필요합니다.'});
      if (route === '/api/admin/logout') {
        sessions.delete(active.id);
        return json(res,200,{loggedIn:false},{'Set-Cookie':cookie('',0)});
      }
      if (route === '/api/members') {
        if (active.role!=='admin') return json(res,403,{error:'관리자만 회원을 관리할 수 있습니다.'});
        let input;
        try { input=JSON.parse((await readBody(req,2048)).toString('utf8')); }
        catch(error) {
          if (error.status) throw error;
          return json(res,400,{error:'회원 정보를 확인해 주세요.'});
        }
        if (session(req)?.role!=='admin') return json(res,401,{error:'다시 로그인해 주세요.'});
        if (!input || typeof input!=='object') return json(res,400,{error:'회원 정보를 확인해 주세요.'});
        const phone=typeof input.phone==='string' ? input.phone.trim() : '';
        if (['create','phone'].includes(input.action) && phone && !/^\+?[0-9 ()-]{7,24}$/.test(phone)) {
          return json(res,400,{error:'전화번호를 확인해 주세요.'});
        }
        if (input.action==='create') {
          const name=typeof input.name==='string' ? input.name.trim() : '';
          const username=typeof input.username==='string' ? input.username.trim().toLowerCase() : '';
          if (!name || name.length>60 || !/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) ||
              !['general','regular'].includes(input.role) || typeof input.password!=='string' ||
              input.password.length<12 || input.password.length>128) {
            return json(res,400,{error:'이름, 아이디, 등급과 12자 이상의 비밀번호를 확인해 주세요.'});
          }
          if (members.some(item=>item.username===username)) return json(res,409,{error:'이미 사용 중인 아이디입니다.'});
          const salt=randomBytes(16).toString('hex');
          const member={id:randomUUID(),name,username,phone,role:input.role,salt,hash:memberHash(input.password,salt).toString('hex')};
          saveMembers([...members,member]);
          return json(res,201,publicMember(member));
        }
        const member=members.find(item=>item.id===input.id);
        if (!member) return json(res,404,{error:'회원을 찾을 수 없습니다.'});
        if (input.action==='phone') {
          saveMembers(members.map(item=>item.id===member.id ? {...item,phone} : item));
          return json(res,200,{ok:true});
        }
        if (input.action==='promote' && member.role==='general') {
          saveMembers(members.map(item=>item.id===member.id ? {...item,role:'regular'} : item));
          return json(res,200,{ok:true});
        }
        if (input.action==='delete') {
          saveMembers(members.filter(item=>item.id!==member.id));
          for (const [id,record] of sessions) if (record.memberId===member.id) sessions.delete(id);
          return json(res,200,{ok:true});
        }
        return json(res,409,{error:'회원 등급 또는 작업을 확인해 주세요.'});
      }
      if (route === '/api/photos') {
        if (active.role==='general') return json(res,403,{error:'정회원과 관리자만 사진을 등록할 수 있습니다.'});
        const title=(url.searchParams.get('title') || '').trim();
        if (!title || title.length>80) return json(res,400,{error:'사진 제목을 80자 이내로 입력해 주세요.'});
        const photo=await readBody(req,5*1024*1024);
        if (!session(req)) return json(res,401,{error:'다시 로그인해 주세요.'});
        if (req.headers['content-type']!=='image/jpeg' || photo.length<4 ||
            !photo.subarray(0,3).equals(Buffer.from([255,216,255])) ||
            !photo.subarray(-2).equals(Buffer.from([255,217]))) {
          return json(res,400,{error:'JPEG 사진을 선택해 주세요.'});
        }
        const id=randomUUID();
        const record={id,title,src:'/activity-photo/'+id+'.jpg',createdAt:new Date().toISOString()};
        fs.writeFileSync(path.join(data,id+'.jpg'),photo,{flag:'wx'});
        const pending=path.join(data,id+'.tmp');
        fs.writeFileSync(pending,JSON.stringify(record),{flag:'wx'});
        fs.renameSync(pending,path.join(data,id+'.json'));
        return json(res,201,record);
      }
    }
    return send(res,404,'Not found');
  } catch (error) {
    if (!error.status) console.error(error);
    if (!res.headersSent) json(res,error.status || 500,{error:error.status===413?'사진 파일은 5MB 이하여야 합니다.':'요청을 처리하지 못했습니다.'});
  }
});
server.listen(port,'127.0.0.1',()=>console.log(origin+'/#news'));
