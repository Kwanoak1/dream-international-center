'use strict';

const defaults = {
  ppt: {name:'센터 그린', bg:'#14392f', fg:'#ffffff', accent:'#b8e895', align:'left'},
  poster: {name:'문화 교류', bg:'#fff1db', fg:'#352019', accent:'#ab3e32', align:'center'},
  landing: {name:'행사 안내', bg:'#eef4fb', fg:'#152a43', accent:'#215da0', align:'left'}
};
const formats = {
  ppt: {size:[1280,720], ext:'pptx', help:'PowerPoint에서 편집할 수 있는 한 장짜리 PPT입니다.'},
  poster: {size:[900,1260], ext:'png', help:'인쇄하거나 공유할 수 있는 PNG 이미지입니다.'},
  landing: {size:[1280,760], ext:'html', help:'브라우저에서 열 수 있는 반응형 HTML 파일입니다.'}
};
const kind = document.querySelector('#kind');
const picker = document.querySelector('#template');
const registry = document.querySelector('#register');
const content = document.querySelector('#content');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const art = document.querySelector('#art');
const ctx = art.getContext('2d');
const key = 'dream-promotion-designs-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; }
catch { status.textContent = '저장된 디자인을 읽을 수 없습니다.'; }

const templates = () => [defaults[kind.value], ...(saved[kind.value] || [])];
const style = () => templates()[Number(picker.value)];
const values = form => Object.fromEntries(new FormData(form));
const escapeMarkup = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'})[char]);

function choose(index = 0) {
  picker.replaceChildren(...templates().map((item, i) => new Option(item.name, i)));
  picker.value = index;
  selectStyle();
}
function selectStyle() {
  for (const field of ['bg','fg','accent','align']) registry.elements[field].value = style()[field];
  render();
}
function layout(data, compact) {
  return [
    {text:data.title || '행사 제목', size:compact ? 54 : 64, bold:true},
    {text:[data.date,data.place].filter(Boolean).join('  ·  '), size:26, bold:true},
    {text:data.description, size:23, bold:false}
  ].filter(item => item.text);
}
function wrap(text, width) {
  return text.split(/\r?\n/).flatMap(paragraph => {
    const lines = [''];
    for (const char of paragraph) {
      const last = lines.length - 1;
      if (lines[last] && ctx.measureText(lines[last] + char).width > width) lines.push(char.trimStart());
      else lines[last] += char;
    }
    return lines;
  });
}
function render() {
  const format = formats[kind.value];
  const design = style();
  const data = values(content);
  const [width,height] = format.size;
  art.width = width;
  art.height = height;
  const center = design.align === 'center';
  const margin = Math.round(width * .09);
  const x = center ? width / 2 : margin;
  ctx.fillStyle = design.bg;
  ctx.fillRect(0,0,width,height);
  ctx.fillStyle = design.accent;
  ctx.fillRect(center ? x-36 : x, height*.13,72,8);
  ctx.fillStyle = design.fg;
  ctx.textAlign = design.align;
  ctx.textBaseline = 'top';
  let y = height*.20;
  for (const item of layout(data, kind.value === 'poster')) {
    ctx.font = (item.bold ? '700 ' : '400 ') + item.size + 'px "Malgun Gothic", sans-serif';
    for (const line of wrap(item.text,width-margin*2)) {
      ctx.fillText(line,x,y);
      y += item.size*1.35;
    }
    y += 22;
  }
  download.textContent = format.ext.toUpperCase() + ' 다운로드';
  download.disabled = !data.title.trim();
  document.querySelector('#help').textContent = format.help;
}
registry.addEventListener('submit', event => {
  event.preventDefault();
  const item = values(registry);
  item.name = item.name.trim();
  if (!item.name) { status.textContent = '디자인 이름을 입력해 주세요.'; return; }
  const items = saved[kind.value] || [];
  const next = {...saved,[kind.value]:[...items,item]};
  try {
    localStorage.setItem(key, JSON.stringify(next));
    saved = next;
    choose(items.length + 1);
    status.textContent = '이 브라우저에 표준디자인을 저장했습니다.';
  } catch { status.textContent = '브라우저가 저장을 허용하지 않습니다.'; }
});
kind.addEventListener('change', () => { status.textContent = ''; choose(); });
picker.addEventListener('change', selectStyle);
content.addEventListener('input', render);
content.addEventListener('submit', event => event.preventDefault());

function landing(data, design) {
  const text = layout(data,false);
  return '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+
    escapeMarkup(data.title)+'</title><style>body{margin:0;background:'+design.bg+';color:'+design.fg+
    ';font:clamp(16px,2.4vw,24px)/1.55 "Malgun Gothic",sans-serif}main{max-width:960px;margin:auto;padding:12vh 8vw;text-align:'+
    design.align+';overflow-wrap:anywhere}h1{font-size:clamp(34px,6vw,72px);line-height:1.2;margin:24px 0}p{white-space:pre-wrap}.mark{display:inline-block;background:'+
    design.accent+';width:72px;height:8px}</style><main><span class="mark" aria-hidden="true"></span><h1>'+
    escapeMarkup(text[0].text)+'</h1>'+text.slice(1).map(item => '<p>'+(item.bold?'<strong>':'')+
    escapeMarkup(item.text)+(item.bold?'</strong>':'')+'</p>').join('')+'</main></html>';
}
download.addEventListener('click', async () => {
  const data = values(content);
  const design = style();
  const format = formats[kind.value];
  if (!data.title.trim()) return;
  try {
    const blob = format.ext === 'png' ? await new Promise(resolve => art.toBlob(resolve,'image/png')) :
      format.ext === 'html' ? new Blob([landing(data,design)],{type:'text/html;charset=utf-8'}) :
      makePptx(data,design);
    if (!blob) throw new Error('Empty output');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (data.title.trim().replace(/[\\/:*?"<>|]/g,'_') || '홍보자료')+'.'+format.ext;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url),30000);
    status.textContent = '다운로드를 시작했습니다.';
  } catch { status.textContent = '파일 생성에 실패했습니다. 다시 시도해 주세요.'; }
});

function makePptx(data, design) {
  const office = 'http://schemas.openxmlformats.org/';
  const drawing = office + 'drawingml/2006/main';
  const presentation = office + 'presentationml/2006/main';
  const rel = office + 'officeDocument/2006/relationships';
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const ns = ' xmlns:p="'+presentation+'" xmlns:a="'+drawing+'" xmlns:r="'+rel+'"';
  const solid = color => '<a:solidFill><a:srgbClr val="'+color.slice(1).toUpperCase()+'"/></a:solidFill>';
  const group = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>';
  const emu = px => Math.round(px * 9525);
  function shape(id, x, y, width, height, fill, paragraphs = '') {
    return '<p:sp><p:nvSpPr><p:cNvPr id="'+id+'" name="Design '+id+'"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'+
      '<p:spPr><a:xfrm><a:off x="'+emu(x)+'" y="'+emu(y)+'"/><a:ext cx="'+emu(width)+'" cy="'+emu(height)+'"/></a:xfrm>'+
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'+fill+'</p:spPr>'+
      (paragraphs ? '<p:txBody><a:bodyPr lIns="0" rIns="0" tIns="0" bIns="0"/><a:lstStyle/>'+paragraphs+'</p:txBody>' : '')+'</p:sp>';
  }
  const centered = design.align === 'center';
  let y = 144;
  const text = layout(data,false).map((item,index) => {
    ctx.font = (item.bold ? '700 ' : '400 ') + item.size + 'px "Malgun Gothic", sans-serif';
    const lines = wrap(item.text,1050);
    const paragraphs = lines.map(line => '<a:p><a:pPr algn="'+(centered?'ctr':'l')+'"/><a:r><a:rPr lang="ko-KR" sz="'+
      item.size*75+'" b="'+Number(item.bold)+'">'+solid(design.fg)+'<a:latin typeface="Malgun Gothic"/><a:ea typeface="Malgun Gothic"/></a:rPr>'+
      '<a:t xml:space="preserve">'+escapeMarkup(line)+'</a:t></a:r></a:p>').join('');
    const height = lines.length*item.size*1.35;
    const result = shape(index+3,115,y,1050,height,'<a:noFill/>',paragraphs);
    y += height+22;
    return result;
  }).join('');
  const slide = '<p:sld'+ns+'><p:cSld><p:bg><p:bgPr>'+solid(design.bg)+'<a:effectLst/></p:bgPr></p:bg><p:spTree>'+group+
    shape(2,centered?604:115,94,72,8,solid(design.accent))+text+'</p:spTree></p:cSld></p:sld>';
  const types = {
    'ppt/presentation.xml':'presentation.main',
    'ppt/slides/slide1.xml':'slide',
    'ppt/slideMasters/slideMaster1.xml':'slideMaster',
    'ppt/slideLayouts/slideLayout1.xml':'slideLayout'
  };
  const rels = (...entries) => '<Relationships xmlns="'+office+'package/2006/relationships">'+
    entries.map(([type,target],i) => '<Relationship Id="rId'+(i+1)+'" Type="'+rel+'/'+type+'" Target="'+target+'"/>').join('')+'</Relationships>';
  const mapping = '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>';
  const empty = '<p:cSld><p:spTree>'+group+'</p:spTree></p:cSld>';
  return zipXml({
    '[Content_Types].xml':'<Types xmlns="'+office+'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
      Object.entries(types).map(([file,type]) => '<Override PartName="/'+file+'" ContentType="application/vnd.openxmlformats-officedocument.presentationml.'+type+'+xml"/>').join('')+'</Types>',
    '_rels/.rels':rels(['officeDocument','ppt/presentation.xml']),
    'ppt/presentation.xml':'<p:presentation'+ns+'><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>',
    'ppt/_rels/presentation.xml.rels':rels(['slideMaster','slideMasters/slideMaster1.xml'],['slide','slides/slide1.xml']),
    'ppt/slides/slide1.xml':slide,
    'ppt/slides/_rels/slide1.xml.rels':rels(['slideLayout','../slideLayouts/slideLayout1.xml']),
    'ppt/slideMasters/slideMaster1.xml':'<p:sldMaster'+ns+'>'+empty+mapping+'<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>',
    'ppt/slideMasters/_rels/slideMaster1.xml.rels':rels(['slideLayout','../slideLayouts/slideLayout1.xml']),
    'ppt/slideLayouts/slideLayout1.xml':'<p:sldLayout'+ns+' type="blank">'+empty+'<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>',
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels':rels(['slideMaster','../slideMasters/slideMaster1.xml'])
  },xml);
}

// Store each UTF-8 XML part in the ZIP container used by PowerPoint.
function zipXml(files, declaration) {
  const encoder = new TextEncoder();
  const local = [];
  const central = [];
  let offset = 0;
  let directorySize = 0;
  function header(size, signature) {
    const view = new DataView(new ArrayBuffer(size));
    view.setUint32(0,signature,true);
    return view;
  }
  for (const [file, xml] of Object.entries(files)) {
    const name = encoder.encode(file);
    const data = encoder.encode(declaration+xml);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit=0; bit<8; bit++) crc = (crc>>>1)^((crc&1)?0xedb88320:0);
    }
    crc ^= 0xffffffff;
    const part = header(30,0x04034b50);
    part.setUint16(4,20,true);
    part.setUint32(14,crc,true);
    part.setUint32(18,data.length,true);
    part.setUint32(22,data.length,true);
    part.setUint16(26,name.length,true);
    local.push(part.buffer,name,data);
    const entry = header(46,0x02014b50);
    entry.setUint16(4,20,true);
    entry.setUint16(6,20,true);
    entry.setUint32(16,crc,true);
    entry.setUint32(20,data.length,true);
    entry.setUint32(24,data.length,true);
    entry.setUint16(28,name.length,true);
    entry.setUint32(42,offset,true);
    central.push(entry.buffer,name);
    offset += part.byteLength+name.length+data.length;
    directorySize += entry.byteLength+name.length;
  }
  const end = header(22,0x06054b50);
  const count = Object.keys(files).length;
  end.setUint16(8,count,true);
  end.setUint16(10,count,true);
  end.setUint32(12,directorySize,true);
  end.setUint32(16,offset,true);
  return new Blob([...local,...central,end.buffer],{
    type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });
}

choose();
