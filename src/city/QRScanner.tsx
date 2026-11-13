import { useEffect, useRef, useState } from 'react';

type Detector = { detect:(source:HTMLVideoElement)=>Promise<{rawValue:string}[]> };
type DetectorClass = new(options:{formats:string[]})=>Detector;
export function tokenFromLink(value:string) {
 const url=new URL(value,location.origin);
 if(url.origin!==location.origin) throw Error('Этот QR относится к другому сайту.');
 const token=new URLSearchParams(url.hash.slice(1)).get('qr');
 if(!token || !/^pg1_[A-Za-z0-9_-]{43}$/.test(token)) throw Error('В QR нет игрового токена.');
 return token;
}
export function QRScanner({activate}:{activate:(token:string)=>Promise<void>}) {
 const video=useRef<HTMLVideoElement>(null);
 const running=useRef(false);
 const media=useRef<MediaStream|null>(null);
 const timeout=useRef<number|undefined>(undefined);
 const [status,setStatus]=useState('');
 const [scanning,setScanning]=useState(false);
 function stop() {
  running.current=false;clearTimeout(timeout.current);
  media.current?.getTracks().forEach(track=>track.stop());media.current=null;
  setScanning(false);
 }
 useEffect(()=>()=>{running.current=false;clearTimeout(timeout.current);media.current?.getTracks().forEach(track=>track.stop());},[]);
 async function start() {
  const Constructor=(window as Window & {BarcodeDetector?:DetectorClass}).BarcodeDetector;
  if(!Constructor) {setStatus('В этом браузере камера QR не поддерживается. Откройте игровую ссылку, закодированную в QR.');return;}
  try {
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
   if(!video.current){stream.getTracks().forEach(track=>track.stop());return;}
   media.current=stream;video.current.srcObject=stream;await video.current.play();
   running.current=true;setScanning(true);setStatus('Наведите камеру на QR стикера.');
   const detector=new Constructor({formats:['qr_code']});
   const scan=async()=>{
    if(!running.current||!video.current)return;
    try {
     const codes=await detector.detect(video.current);
     if(codes.length) {
      const token=tokenFromLink(codes[0].rawValue);
      stop();await activate(token);return;
     }
    } catch(error){setStatus((error as Error).message);}
    if(running.current)timeout.current=window.setTimeout(()=>void scan(),250);
   };
   void scan();
  }catch(error){stop();setStatus((error as Error).message);}
 }
 return <section className="scanner">
  <span className="eyebrow">КОЛЛЕКЦИОННЫЙ СТИКЕР</span><h2>Откройте новую дверь</h2>
  <p>Каждый действительный QR можно активировать один раз. Новый код знакомого дизайна приносит городские монеты.</p>
  <video ref={video} playsInline muted hidden={!scanning} aria-label="Предпросмотр камеры"/>
  <button onClick={()=>scanning?stop():void start()}>{scanning?'Остановить камеру':'Сканировать QR камерой'}</button>
  <p role="status">{status}</p>
 </section>;
}