import {zoomAt,clampCamera,type Camera,type Bounds} from './math';
import type {XY} from './types';
export function pinchCamera(c:Camera,b:Bounds,before:XY[],after:XY[]):Camera{
 if(before.length<2||after.length<2)return c;
 const mid=(a:XY[])=>({x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2});
 const old=mid(before),next=mid(after),distance=(a:XY[])=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
 const target=zoomAt(c,b,distance(after)/Math.max(1,distance(before)),old);
 return clampCamera({...target,x:target.x+next.x-old.x,y:target.y+next.y-old.y},b);
}
