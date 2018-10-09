import { Container, Graphics, Point, Sprite } from "pixi.js";
import { Drawing } from "../data/Drawing";
import * as utility from '../tools/utility';

export interface DisplayableDrawing
{
    position: Point;
    drawing: Drawing;
}

export function getFirstDrawingUnderPixel(displayables: DisplayableDrawing[],
                                          x: number, 
                                          y: number, 
                                          precision: "bounds" | "pixels"): DisplayableDrawing | undefined
{
    // front to back
    for (let i = displayables.length - 1; i >= 0; i -= 1)
    {
        const displayable = displayables[i];

        const w = displayable.drawing.width;
        const h = displayable.drawing.height;
        const lx = x - displayable.position.x;
        const ly = y - displayable.position.y;

        const bounded = lx >= 0 && ly >= 0 && lx < w && ly < h;

        if (bounded && (precision === "bounds" || displayable.drawing.getPixel(lx, ly) > 0))
        {
            return displayable; 
        }
    }

    return undefined;
}

export class DisplayedDrawing
{
    public readonly sprite = new Sprite();
    private readonly border = new Graphics();

    private display: DisplayableDrawing;

    public constructor()
    {
        this.sprite.addChild(this.border);
    }

    public show(): void
    {
        this.sprite.visible = true;
    }

    public hide(): void
    {
        this.sprite.visible = false;
    }

    public setDisplayable(display: DisplayableDrawing)
    {
        this.display = display;
        this.refresh();
    }

    public setBorder(width: number, 
                     color: number,
                     alpha: number)
    {
        this.border.clear();
        this.border.lineStyle(width, color, alpha, .5);
        this.border.drawRect(-.5, -.5, this.display.drawing.width + 1, this.display.drawing.height + 1);
    }

    public setBrightness(value: number): void
    {
        this.sprite.tint = utility.rgb2num(value, value, value);
    }

    public refresh(): void
    {
        this.sprite.position = this.display.position;
        this.sprite.texture = this.display.drawing.texture.texture;
    }
}

// tslint:disable-next-line:max-classes-per-file
export default class DrawingDisplay
{
    public readonly container = new Container();

    private readonly mapping = new Map<DisplayableDrawing, DisplayedDrawing>();
    private readonly spares = new Array<DisplayedDrawing>();

    private readonly remove = new Set<DisplayableDrawing>();
    private readonly add = new Set<DisplayableDrawing>();

    public setDisplay(display: DisplayableDrawing[]): void
    {
        this.remove.clear();
        this.add.clear();

        this.mapping.forEach((_, displayable) => this.remove.add(displayable));
        
        for (const displayable of display)
        {
            // if we can't remove the displayable from the remove list then
            // it must be new
            if (!this.remove.delete(displayable))
            {
                this.add.add(displayable);
            }
        }

        this.remove.forEach(displayable => 
        {
            this.removeEntry(displayable);     
        });

        this.add.forEach(displayable => 
        {
            this.addEntry(displayable);
        });

        this.refresh();
    }

    public refresh(): void
    {
        this.mapping.forEach(displayed => displayed.refresh());
        this.mapping.forEach(displayed => 
        {
            const light = Math.random() > .5;

            displayed.setBrightness(light ? 255 : 32);
            displayed.setBorder(.75, 0xFFFFFFFF, light ? .25 : .1);
        });
    }

    private addEntry(displayable: DisplayableDrawing)
    {
        let displayed = this.spares.pop();

        if (!displayed)
        {
            displayed = new DisplayedDrawing();
            this.container.addChild(displayed.sprite);
        }

        displayed.setDisplayable(displayable);
        displayed.show();

        this.mapping.set(displayable, displayed);
    }

    private removeEntry(displayable: DisplayableDrawing): void
    {
        const sprite = this.mapping.get(displayable)!;

        sprite.hide();

        this.spares.push(sprite);
        this.mapping.delete(displayable);
    }
}
