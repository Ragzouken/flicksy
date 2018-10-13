import { Point } from "pixi.js";
import { FlicksyProject } from "./FlicksyProject";

export interface FlicksyElement
{
    uuid: string;
    name: string;
}

export interface FlicksyData<T, TData>
{
    fromData(data: TData, project: FlicksyProject): T;
    toData(): TData;
}


export interface ElementPin<TElement extends FlicksyElement>
{
    element: TElement;
    position: Point;
}

export interface ElementBoardData extends FlicksyElement
{
    pins: ElementPinData[];
}

export interface ElementPinData
{
    element: string;
    position: [number, number];
}
