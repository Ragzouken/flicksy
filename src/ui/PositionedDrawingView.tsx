import { Graphics, Sprite, Filter, Texture, SCALE_MODES, MIPMAP_MODES, Container } from "pixi.js";
import { PositionedDrawing } from "../data/PositionedDrawing";
import { View } from "../tools/ModelViewMapping";
import paletteFrag from "../resources/palette_frag";
import { createContext2D, rgbaToColor } from "blitsy";
import { randomInt } from "../tools/utility";

const paletteDraw = createContext2D(256, 1);
const data = paletteDraw.getImageData(0, 0, 256, 1);
const buffer = new Uint32Array(data.data.buffer);
const texture = Texture.from(paletteDraw.canvas, { scaleMode: SCALE_MODES.NEAREST });
texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
texture.baseTexture.mipmap = MIPMAP_MODES.OFF;
texture.baseTexture.anisotropicLevel = 0;

setPalette(new Array(2).fill(0).map(i => {
    return rgbaToColor({
        r: randomInt(128, 255),
        g: randomInt(128, 255),
        b: randomInt(128, 255),
        a: 255,
    });
}));

export function setPalette(palette: number[]) {
    for (let i = 0; i < 256; ++i) {
        buffer[i] = palette[i % palette.length];
    }
    buffer[0] = 0;
    paletteDraw.putImageData(data, 0, 0);
    texture.baseTexture.update();
};

export const paletteFilter = new Filter(undefined, paletteFrag, {
    uPalette: texture,
    uAlpha: 1,
});

const paletteFilterDimmed = new Filter(undefined, paletteFrag, {
    uPalette: texture,
    uAlpha: .1, 
});

export default class PositionedDrawingView<TObject extends PositionedDrawing> implements View<TObject>
{
    public object: TObject;
    public readonly root: Container;
    /** The Pixi.Sprite for displaying the drawing content */
    public readonly sprite: Sprite;
    /** The Pixi.Graphics for displaying the drawing border */
    public readonly border: Graphics;
    /** The Pixi.Graphics for displaying the selection highlight */
    public readonly select: Graphics;
    /** The Pixi.Graphics for displaying the hover highlight */
    public readonly hover: Graphics;

    public constructor()
    {
        this.root = new Container();
        this.root.cursor = "none";

        // create the sprite
        this.sprite = new Sprite();
        this.sprite.filters = [paletteFilter];
        this.root.addChild(this.sprite);

        this.border = new Graphics();
        this.root.addChild(this.border);

        this.select = new Graphics();
        this.root.addChild(this.select);

        this.hover = new Graphics();
        this.root.addChild(this.hover);
        
        // turn off the selection highlight by default
        this.setSelected(false);

        this.hover.visible = false;
    }

    public get model(): TObject
    {
        return this.object;
    }

    public set model(model: TObject)
    {
        this.object = model;

        this.refreshBorders();
    }

    public refreshBorders(): void
    {
        const width = this.object.drawing.width;
        const height = this.object.drawing.height;

        // border
        this.border.clear();
        this.border.lineStyle(.8, 0xFFFFFF);
        this.border.drawRect(-.5, -.5, width + 1, height + 1);
        this.border.alpha = 0.25;

        // selection highlight
        this.select.clear();
        this.select.lineStyle(.5, 0xFFFFFF);
        this.select.drawRect(-.5, -.5, width + 1, height + 1);
        this.select.alpha = 0.5;
        // hover
        this.hover.clear();
        this.hover.lineStyle(.5, 0xFF0000);
        this.hover.drawRect(-.5, -.5, width + 1, height + 1);
        this.hover.alpha = 0.5;
    }

    public refresh(): void
    {
        this.sprite.texture = this.object.drawing.texture.texture;
        this.root.position = this.object.position;

        this.refreshBorders();
    }

    /** Set whether this view should display the selection highlight or not */
    public setSelected(selected: boolean)
    {
        this.select.visible = selected;
    }

    public setDimmed(dimmed: boolean)
    {
        this.sprite.filters = [dimmed ? paletteFilterDimmed : paletteFilter];
    }

    /** Destroy the contained pixi state */
    public destroy(): void
    {
        this.root.destroy();
        this.sprite.destroy();
        this.border.destroy();
        this.select.destroy();
        this.hover.destroy();
    }
}