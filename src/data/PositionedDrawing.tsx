import { Point, Rectangle } from "pixi.js";
import { Drawing } from "./Drawing";

export enum HitPrecision
{
    Bounds,
    Pixel,
}

export interface PositionedDrawing
{
    drawing: Drawing;
    position: Point;
}

export function positionedDrawingRect(drawing: PositionedDrawing): Rectangle
{
    return new Rectangle(drawing.position.x, 
                         drawing.position.y, 
                         drawing.drawing.width, 
                         drawing.drawing.height);
}

export function positionedDrawingContains(drawing: PositionedDrawing,
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
        || drawing.drawing.getPixel(lx, ly) > 0;
}

export function pageBounds(drawings: PositionedDrawing[]): Rectangle
{
    const bounds = positionedDrawingRect(drawings[0]);
    
    for (const drawing of drawings)
    {
        bounds.enlarge(positionedDrawingRect(drawing));
    }

    return bounds;
}

export function pageFirstObjectUnderUnderPoint<TDrawing extends PositionedDrawing>(objects: TDrawing[],
                                                                                   point: Point,
                                                                                   precision: HitPrecision): TDrawing | undefined
{
    for (let i = objects.length - 1; i >= 0; i -= 1)
    {
        const object = objects[i];

        if (positionedDrawingContains(object, point, precision))
        {
            return object;
        }
    }

    return undefined;
}
