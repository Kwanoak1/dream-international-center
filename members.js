'use strict';

const controls=document.querySelector('#memberControls');
const list=document.querySelector('#members');
const form=document.querySelector('#createMember');
const message=document.querySelector('#memberMessage');
const dialog=document.querySelector('#deleteDialog');
let pendingDelete;
const phoneDialog=document.querySelector('#phoneDialog');
const phoneForm=document.querySelector('#editPhone');
let phoneMember;
document.querySelector('#cancelPhone').onclick=()=>phoneDialog.close();
phoneForm.addEventListener('submit',async event=>{
  event.preventDefault();
  await submit(event.submitter,{action:'phone',id:phoneMember,phone:phoneForm.elements.phone.value},'전화번호를 저장했습니다.');
  phoneDialog.close();
});
const roleLabel={regular:'정회원',general:'일반회원'};

async function refresh() {
  const members=await api('/api/members');
  const rows=members.map(member=>{
    const row=document.createElement('div');
    row.className='row';
    const label=document.createElement('span');
    label.textContent=member.name+' ('+member.username+') · '+roleLabel[member.role]+' · '+(member.phone || '전화번호 미등록');
    row.append(label);
    if (member.role==='general') {
      const promote=document.createElement('button');
      promote.textContent='정회원으로 승급';
      promote.onclick=()=>submit(promote,{action:'promote',id:member.id},'정회원으로 승급했습니다.');
      row.append(promote);
    }
    const edit=document.createElement('button');
    edit.textContent='전화번호 수정';
    edit.onclick=()=>{
      phoneMember=member.id;
      phoneForm.elements.phone.value=member.phone;
      phoneDialog.showModal();
    };
    row.append(edit);
    const remove=document.createElement('button');
    remove.className='delete';
    remove.textContent='삭제';
    remove.onclick=()=>{
      pendingDelete={member,button:remove};
      document.querySelector('#deleteMessage').textContent=member.name+' 회원을 삭제하시겠습니까? 이 회원은 즉시 로그인 권한을 잃습니다.';
      dialog.showModal();
    };
    row.append(remove);
    return row;
  });
  list.replaceChildren(...(rows.length?rows:[document.createTextNode('등록된 회원이 없습니다.')]));
}
async function submit(button,payload,success) {
  button.disabled=true;
  message.textContent='';
  try {
    await api('/api/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if (payload.action==='create') form.reset();
    await refresh();
    message.textContent=success;
  } catch(error) {
    message.textContent=error.message;
    if (error.status===401 || error.status===403) controls.hidden=true;
  } finally { button.disabled=false; }
}
form.addEventListener('submit',event=>{
  event.preventDefault();
  submit(event.submitter,{action:'create',...Object.fromEntries(new FormData(form))},'회원을 등록했습니다.');
});
dialog.addEventListener('close',()=>{
  if (dialog.returnValue==='delete' && pendingDelete) {
    submit(pendingDelete.button,{action:'delete',id:pendingDelete.member.id},'회원을 삭제했습니다.');
  }
  pendingDelete=null;
  dialog.returnValue='';
});
refresh().then(()=>{
  controls.hidden=false;
  message.textContent='';
}).catch(error=>{
  message.textContent=error.status===403?'활동사진 관리 화면에서 관리자로 로그인해 주세요.':'회원 목록을 불러오지 못했습니다.';
});
