import * as Pixi from 'pixi.js';
import { MTexture } from "./MTexture";

export class Drawing
{
    public name: string = "unnamed drawing";

    public readonly texture: MTexture;
    public readonly sprite: Pixi.Sprite;

    public highlight: Pixi.DisplayObject;

    constructor(texture: MTexture, sprite: Pixi.Sprite)
    {
        this.texture = texture;
        this.sprite = sprite;
    }
}