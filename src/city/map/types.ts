import type {WindowZone,effectTypes} from './visuals';
export type XY={x:number;y:number};
export type MapEffect=typeof effectTypes[number];
export type Placement={buildingId:string;slot:number;title:string;position:XY;width:number;anchor:XY;platform:XY[];entry:XY;hit:{x:number;y:number;width:number;height:number};windows:WindowZone[];effect:{type:MapEffect;enabled:boolean;point:XY}};
export type MapLayout={version:number;width:number;height:number;placements:Placement[]};
export type MapAsset={url:string;sourceFile:string;sha256:string;width:number;height:number;optimized:boolean;bytes:number;sourceWidth?:number;sourceHeight?:number;crop?:number[];alphaBounds?:number[]};
export type MapAssets={base:{url:string;width:number;height:number;sha256:string};buildings:Record<string,MapAsset|null>};
export type Reveal={activationId:string;buildingId:string;newDistrictId?:string};
