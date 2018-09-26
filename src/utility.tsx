import { Point, PointLike } from 'pixi.js'

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
