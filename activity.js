'use strict';

async function api(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error),{status:response.status});
  return result;
}

async function loadActivityPhotos() {
  const gallery = document.querySelector('#activityGallery');
  if (!gallery) return;
  if (location.protocol === 'file:') {
    gallery.textContent = document.documentElement.lang==='ko' ? '로컬 서버에서 회원으로 로그인하면 활동사진을 볼 수 있습니다.' : 'Open the local server and sign in to view activity photos.';
    return;
  }
  try {
    const records = await api('/api/photos');
    const photos = gallery.dataset.limit ? records.slice(0,Number(gallery.dataset.limit)) : records;
    if (!photos.length) return;
    gallery.replaceChildren(...photos.map(photo => {
      const figure = document.createElement('figure');
      figure.className = 'card';
      const image = document.createElement('img');
      image.src = photo.src;
      image.alt = photo.title;
      image.loading = 'lazy';
      image.style.cssText = 'width:100%;height:auto;border-radius:10px;display:block';
      const caption = document.createElement('figcaption');
      caption.textContent = photo.title;
      figure.append(image,caption);
      return figure;
    }));
  } catch(error) {
    if (error.status===401) {
      gallery.textContent = document.documentElement.lang==='ko' ? '회원으로 로그인하면 활동사진을 볼 수 있습니다.' : 'Sign in as a member to view activity photos.';
      return;
    }
    gallery.textContent = document.documentElement.lang==='ko' ? '활동사진을 불러오지 못했습니다.' : 'Activity photos could not be loaded.';
  }
}

function setupAdmin() {
  const login = document.querySelector('#login');
  if (!login) return;
  const upload = document.querySelector('#upload');
  const logout = document.querySelector('#logout');
  const message = document.querySelector('#message');
  const management=document.querySelector('#memberManagement');
  const usernameLabel=document.querySelector('#memberUsername');
  const currentRole=document.querySelector('#currentRole');
  const galleryLink=document.querySelector('#galleryLink');
  function show(role,name='') {
    login.hidden = !!role;
    logout.hidden = currentRole.hidden = galleryLink.hidden = !role;
    upload.hidden = role!=='admin' && role!=='regular';
    management.hidden = role!=='admin';
    currentRole.textContent = role ? '로그인 권한 · '+{admin:'관리자',regular:'정회원',general:'일반회원'}[role]+(name?' · '+name:'') : '';
  }
  async function run(button, action) {
    button.disabled = true;
    message.textContent = '';
    try { await action(); }
    catch(error) {
      if (login.hidden && error.status===401) show(null);
      message.textContent = error.message || '요청을 처리하지 못했습니다.';
    } finally { button.disabled = false; }
  }
  if (location.protocol==='file:') {
    message.textContent = '관리자 기능은 서버에서 사용할 수 있습니다. 서버를 시작한 뒤 http://127.0.0.1:8766/admin.html 을 여세요.';
    return;
  }
  api('/api/admin/session').then(result=>show(result.role,result.name))
    .catch(()=>{message.textContent='관리자 서버에 연결할 수 없습니다.';});
  function syncLoginType() {
    const member=login.elements.role.value==='member';
    usernameLabel.hidden=!member;
    login.elements.username.required=member;
  }
  login.elements.role.addEventListener('change',syncLoginType);
  syncLoginType();
  login.addEventListener('submit',event=>{
    event.preventDefault();
    run(event.submitter,async ()=>{
      const result=await api('/api/admin/login?'+new URLSearchParams({role:login.elements.role.value,username:login.elements.username.value}),{method:'POST',body:login.elements.password.value});
      login.reset();
      syncLoginType();
      show(result.role,result.name);
    });
  });
  upload.addEventListener('submit',event=>{
    event.preventDefault();
    run(event.submitter,async ()=>{
      const file=upload.elements.photo.files[0];
      if (!file || file.size>25*1024*1024) throw new Error('25MB 이하의 사진을 선택해 주세요.');
      const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('사진 파일을 읽을 수 없습니다.');});
      const scale=Math.min(1,1920/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext('2d',{alpha:false});
      context.fillStyle='white';
      context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      bitmap.close();
      const jpeg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.87));
      if (!jpeg) throw new Error('사진을 변환하지 못했습니다.');
      const query=new URLSearchParams({title:upload.elements.title.value});
      await api('/api/photos?'+query,{method:'POST',body:jpeg});
      upload.reset();
      message.textContent='사진을 등록했습니다. 소식·일정에서 확인할 수 있습니다.';
    });
  });
  logout.addEventListener('click',()=>run(logout,async ()=>{
    await api('/api/admin/logout',{method:'POST'});
    show(null);
    message.textContent='로그아웃했습니다.';
  }));
}
setupAdmin();
