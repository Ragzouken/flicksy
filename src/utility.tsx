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
