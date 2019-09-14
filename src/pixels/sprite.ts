import { MAGENTA_CANVAS_4x4 } from "./canvas";

export type Vector2 = { x: number, y: number };
export type Rect = { x: number, y: number, w: number, h: number };
export type Sprite = { image: CanvasImageSource, rect: Rect };

export const MAGENTA_SPRITE_4x4 = makeSprite(MAGENTA_CANVAS_4x4, 
                                             makeRect(0, 0, 4, 4));

export function makeVector2(x: number, y: number): Vector2
{
    return { x, y };
}

export function makeRect(x: number, y: number, w: number, h: number): Rect
{
    return { x, y, w, h };
}

export function makeSprite(image: CanvasImageSource, rect: Rect): Sprite
{
    return { image, rect };
}

export function drawSprite(context: CanvasDrawImage, 
                           sprite: Sprite, 
                           x: number, y: number): void
{
    const [sx, sy] = [sprite.rect.x, sprite.rect.y];
    const [sw, sh] = [sprite.rect.w, sprite.rect.h];
    context.drawImage(sprite.image, sx, sy, sw, sh, x, y, sw, sh);
}
