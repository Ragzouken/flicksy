import { Graphics, Sprite } from "pixi.js";
import { PositionedDrawing } from "../data/PositionedDrawing";
import { View } from "../tools/ModelViewMapping";

export default class PositionedDrawingView<TObject extends PositionedDrawing> implements View<TObject>
{
    public object: TObject;
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
        // create the sprite
        this.sprite = new Sprite();
        this.sprite.interactive = true;
        this.sprite.cursor = "none";

        this.border = new Graphics();
        this.sprite.addChild(this.border);

        this.select = new Graphics();
        this.sprite.addChild(this.select);

        this.hover = new Graphics();
        this.sprite.addChild(this.hover);
        
        // turn off the selection highlight by default
        this.setSelected(false);

        this.hover.visible = false;
        this.sprite.on("pointerover", () => this.hover.visible = true);
        this.sprite.on("pointerout", () => this.hover.visible = false);
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
        this.sprite.position = this.object.position;
    }

    /** Set whether this view should display the selection highlight or not */
    public setSelected(selected: boolean)
    {
        this.select.visible = selected;
    }

    public setDimmed(dimmed: boolean)
    {
        this.sprite.alpha = dimmed ? .1 : 1;
    }

    /** Destroy the contained pixi state */
    public destroy(): void
    {
        this.sprite.destroy();
        this.border.destroy();
        this.select.destroy();
        this.hover.destroy();
    }
}