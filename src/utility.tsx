import { Point, PointLike } from 'pixi.js'

export function clamp(min: number, max: number, value: number): number
{
    return Math.max(min, Math.min(max, value));
}

export function lerp(v0: number, v1: number, t: number): number
{
    return (1 - t) * v0 + t * v1;
}

export function invLerp(v0: number, v1: number, v: number): number
{
    return (v - v0) / (v1 - v0);
}

export function mul(point: PointLike, factor: number): Point
{
    return new Point(point.x * factor, point.y * factor);
}

export function add(a: PointLike, b: PointLike)
{
  return new Point(a.x + b.x, a.y + b.y);
}

export function sub(a: PointLike, b: PointLike)
{
  return new Point(a.x - b.x, a.y - b.y);
}

export function floor(point: Point)
{
  return new Point(Math.floor(point.x), Math.floor(point.y));
}

export function randomInt(min: number, max: number)
{
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function repopulateSelect(select: HTMLSelectElement,
                                 options: {"label": string, "value": string}[])
{
    const index = select.selectedIndex;

    while (select.lastChild)
    {
        select.removeChild(select.lastChild);
    }

    options.forEach(option => 
    {
        const child = document.createElement("option");
        child.text = option.label;
        child.value = option.value;

        select.appendChild(child);
    });

    select.selectedIndex = index;
}
