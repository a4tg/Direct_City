import type { ComponentType } from 'react';

export type ModuleEvent = {id:string;data:unknown};
export type ModuleProps = {buildingId:string;userId:string};
export interface GameModule {
 id:string;
 characterBrandId:string;
 entry:string;
 Screen:ComponentType<ModuleProps>;
 collection: {accepts:'moduleEvent';catalogBrandId:string};
 load:(buildingId:string)=>Promise<unknown>;
 save:(buildingId:string,data:Record<string,unknown>,revision:number)=>Promise<{revision:number}>;
 handleEvent:(event:ModuleEvent)=>void;
}

const delivered = new Set<string>();
export function handleModuleEvent(event:ModuleEvent) {
 if(delivered.has(event.id))return;
 delivered.add(event.id);
 // Modules may observe these durable, server-created events.
 window.dispatchEvent(new CustomEvent('pryamogorod-module-event',{detail:event}));
}