export type District = { id:string; name:string; position:number };
export type Brand = { id:string; name:string; mascot:string; archetype:string; personality:string; worldRole:string; theme:string; sourceRef:string };
export type Building = { id:string; brandId:string; districtId:string; name:string; position:number; moduleId:string; provisional:boolean };
export type Design = { id:string; brandId:string; slot:number; name:string; image:string|null };
export type Catalog = { districts:District[]; brands:Brand[]; buildings:Building[]; designs:Design[] };
export type StoryNode = { id:string; speaker:string; portrait:string|null; text:string; choices:{id:string;text:string;next:string}[] };
export type Scene = { id:string; brandId:string; kind:'intro'|'meeting'; script:{temporary:boolean;start:string;nodes:StoryNode[]}; completedAt:string|null };
export type World = {
 user:{id:string;firstBuilding:string|null;isTest:boolean}; balance:string;
 collection:string[];buildings:string[];districts:string[];scenes:Scene[];dev:boolean;
};
export type Redemption = { activationId:string;buildingId:string;designId:string;duplicate:boolean;reward:string;sceneId:string|null };
export type ModuleSave = { save:{data:Record<string,unknown>;revision:number}|null;events:{id:string;data:unknown}[] };