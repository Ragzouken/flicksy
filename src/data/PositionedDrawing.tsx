import { Point, Rectangle } from "pixi.js";
import { Drawing } from "./Drawing";

export enum HitPrecision
{
    Bounds,
    Pixel,
}

export interface BoundedObject
{
    bounds: Rectangle;
}

export interface PositionedDrawing extends BoundedObject
{
    drawing: Drawing;
    position: Point;
}

export function positionDrawingContains(drawing: PositionedDrawing,
                                        point: Point,
                                        precision: HitPrecision)
{
    const lx = point.x - drawing.position.x;
    const ly = point.y - drawing.position.y;

    const bounded = lx >= 0
                 && ly >= 0
                 && lx < drawing.drawing.width
                 && ly < drawing.drawing.height;
    
    if (!bounded) { return false; }

    return precision === HitPrecision.Bounds 
        || drawing.drawing.anyPixel(lx, ly, 2);
}

export function pageBounds(drawings: PositionedDrawing[]): Rectangle
{
    const bounds = drawings[0].bounds;
    
    for (const drawing of drawings)
    {
        bounds.enlarge(drawing.bounds);
    }

    return bounds;
}

export function pageFirstBoundsUnderPoint<TObject extends BoundedObject>(objects: TObject[],
                                                                         point: Point): TObject | undefined
{
    for (let i = objects.length - 1; i >= 0; i -= 1)
    {
        const object = objects[i];

        if (object.bounds.contains(point.x, point.y))
        {
            return object;
        }
    }

    return undefined;
}

export function pageFirstObjectUnderPoint<TDrawing extends PositionedDrawing>(objects: TDrawing[],
                                                                              point: Point,
                                                                              precision: HitPrecision): TDrawing | undefined
{
    for (let i = objects.length - 1; i >= 0; i -= 1)
    {
        const object = objects[i];

        if (positionDrawingContains(object, point, precision))
        {
            return object;
        }
    }

    return undefined;
}
