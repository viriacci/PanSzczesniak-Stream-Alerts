import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { clampWidth } from '../../../shared/layout'
export function ResizeHandle({ label, value, range, direction=1, onChange, onCommit }: {label:string;value:number;range:readonly [number,number];direction?:1|-1;onChange:(n:number)=>void;onCommit:(n:number)=>void}) {
  const drag = useRef<{x:number;start:number;last:number}|null>(null)
  function start(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId)
    drag.current={x:e.clientX,start:value,last:value}
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    const n=clampWidth(drag.current.start+(e.clientX-drag.current.x)*direction,range)
    drag.current.last=n;onChange(n)
  }
  function end() { if(drag.current){const n=drag.current.last;drag.current=null;onCommit(n)} }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    const next=e.key==='Home'?range[0]:e.key==='End'?range[1]:e.key==='ArrowLeft'?value-16*direction:e.key==='ArrowRight'?value+16*direction:null
    if(next!==null){e.preventDefault();const n=clampWidth(next,range);onChange(n);onCommit(n)}
  }
  return <div className="resize-handle" role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-valuemin={range[0]} aria-valuemax={range[1]} aria-valuenow={value} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={key}/>
}
