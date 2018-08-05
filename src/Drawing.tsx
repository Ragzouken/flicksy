import * as Pixi from 'pixi.js';
import { MTexture } from "./MTexture";

export class Drawing
{
    public readonly texture: MTexture;
    public readonly sprite: Pixi.Sprite;

    constructor(texture: MTexture, sprite: Pixi.Sprite)
    {
        this.texture = texture;
        this.sprite = sprite;
    }
}