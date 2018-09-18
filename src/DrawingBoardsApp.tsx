import * as Pixi from 'pixi.js';

import { DrawingBoard, PinnedDrawing } from './DrawingBoard';
import { MTexture } from './MTexture';

function add(a: Pixi.Point | Pixi.ObservablePoint, b: Pixi.Point | Pixi.ObservablePoint)
{
  return new Pixi.Point(a.x + b.x, a.y + b.y);
}

function sub(a: Pixi.Point | Pixi.ObservablePoint, b: Pixi.Point | Pixi.ObservablePoint)
{
  return new Pixi.Point(a.x - b.x, a.y - b.y);
}

function floor(point: Pixi.Point)
{
  return new Pixi.Point(Math.floor(point.x), Math.floor(point.y));
}

/** Manages the pixi state for displaying a PinnedDrawing */
class PinnedDrawingView
{
    /** The pinned drawing that this view corresponds to */
    public readonly pin: PinnedDrawing;
    /** The Pixi.Sprite for displaying the drawing content */
    public readonly sprite: Pixi.Sprite;
    /** The Pixi.Graphics for displaying the drawing border */
    public readonly border: Pixi.Graphics;
    /** The Pixi.Graphics for displaying the selection highlight */
    public readonly select: Pixi.Graphics;

    public constructor(pin: PinnedDrawing)
    {
        this.pin = pin;
        
        // create the sprite and move it to the pin position
        this.sprite = new Pixi.Sprite(pin.drawing.texture.texture);
        this.sprite.position = pin.position;

        const width = pin.drawing.texture.data.width;
        const height = pin.drawing.texture.data.height;

        // create the border as a child of the sprite
        this.border = new Pixi.Graphics();
        this.border.lineStyle(.125, 0xFFFFFF);
        this.border.drawRect(-.5, -.5, width + 1, height + 1);
        this.border.alpha = 0.25;
        this.sprite.addChild(this.border);

        // create the selection highlight as a child of the spirte
        this.select = new Pixi.Graphics();
        this.select.lineStyle(.5, 0xFFFFFF);
        this.select.drawRect(-.5, -.5, width + 1, height + 1);
        this.select.alpha = 0.5;
        this.sprite.addChild(this.select);
        
        // turn off the selection highlight by default
        this.setSelected(false);
    }

    /** Set whether this view should display the selection highlight or not */
    public setSelected(selected: boolean)
    {
        this.select.visible = selected;
    }

    /** Destroy the contained pixi state */
    public destroy(): void
    {
        this.sprite.destroy();
        this.border.destroy();
        this.select.destroy();
    }
}

export default class DrawingBoardsApp
{
    public get activeBoard(): DrawingBoard { return this.drawingBoard }

    private pixi: Pixi.Application;
    private container: Pixi.Container;

    private pinViews = new Map<PinnedDrawing, PinnedDrawingView>();
    private drawingBoard: DrawingBoard;

    private dragType: "draw" | "move" | undefined;
    private dragOrigin: Pixi.Point;
    private dragPrev: Pixi.Point;
    private draggedPin: PinnedDrawingView | undefined;

    public brush: MTexture;
    public erasing: boolean;
    
    private selectDropdown: HTMLSelectElement;

    public selected: PinnedDrawing | undefined;

    public constructor(pixi: Pixi.Application)
    {
        this.pixi = pixi;
        this.container = new Pixi.Container();
        this.pixi.stage.addChild(this.container);

        document.onpointerup = () => this.stopDragging();

        this.selectDropdown = document.getElementById("select-drawing")! as HTMLSelectElement;
        this.selectDropdown.addEventListener("change", () =>
        {
            let pin: PinnedDrawing | undefined;
            const index = this.selectDropdown.selectedIndex;

            if (index >= 0)
            {
                pin = this.drawingBoard.pinnedDrawings[index];
            }

            this.select(pin);
        });
    }

    private clear(): void
    {
        this.pinViews.forEach(view => view.destroy());
        this.pinViews.clear();
    }

    /** Resynchronise this display to the data in the underlying DrawingBoard */
    public refresh(): void
    {
        this.setDrawingBoard(this.drawingBoard);
        this.select(this.selected);
    }

    /** Switch the currently selected pin, or select nothing if undefined */
    public select(pin: PinnedDrawing | undefined): void
    {
        this.selected = pin;
        this.pinViews.forEach(view => view.setSelected(view.pin == pin));
    }

    /** Replace the DrawingBoard that should be displayed */
    public setDrawingBoard(board: DrawingBoard): void
    {
        this.clear();
        this.drawingBoard = board;
        
        while (this.selectDropdown.lastChild)
        {
            this.selectDropdown.removeChild(this.selectDropdown.lastChild);
        }

        for (let pin of board.pinnedDrawings)
        {
            const view = new PinnedDrawingView(pin);

            view.sprite.interactive = true;
            view.sprite.on("pointerdown", (event: Pixi.interaction.InteractionEvent) =>
            {
                if (event.data.button === 2)
                {
                    this.startDragging(view, event);
                    event.stopPropagation();
                }
                else
                {
                    this.startDrawing(view, event);
                    event.stopPropagation();
                }
            });

            this.container.addChild(view.sprite);
            this.pinViews.set(pin, view);

            const option = document.createElement("option");
            option.text = pin.drawing.name;
            option.value = board.pinnedDrawings.indexOf(pin).toString();

            this.selectDropdown.appendChild(option);
        }
    }

    private stopDragging(): void
    {
        this.dragType = undefined;
        this.draggedPin = undefined;
    }

    private startDragging(view: PinnedDrawingView, event: Pixi.interaction.InteractionEvent): void
    {
        this.stopDragging();

        this.draggedPin = view;
        this.dragType = "move";
        this.dragOrigin = sub(view.sprite.position, event.data.getLocalPosition(this.container));
    }

    /** 
     * Update the dragging (pin moving or pin drawing) based on a mouse 
     * movement event
     */
    public updateDragging(event: Pixi.interaction.InteractionEvent): void
    {
        if (this.dragType == "move" && this.draggedPin)
        {
            const position = floor(add(this.dragOrigin, event.data.getLocalPosition(this.container)));

            this.draggedPin.pin.position = position;
            this.draggedPin.sprite.position = position;
        }
        else if (this.dragType == "draw" && this.draggedPin)
        {
            const base = this.draggedPin.pin.drawing.texture;
            const m = event.data.getLocalPosition(this.draggedPin.sprite);

            this.draw(this.dragPrev, m, base);

            this.dragPrev = m;
        }
    }

    private startDrawing(view: PinnedDrawingView, event: Pixi.interaction.InteractionEvent): void
    {
        this.stopDragging();

        this.draggedPin = view;
        this.dragType = "draw";
        this.dragPrev = event.data.getLocalPosition(view.sprite);
    }

    private draw(prev: Pixi.Point, 
                 next: Pixi.Point,
                 canvas: MTexture): void
    {
        if (this.erasing)
        {
            canvas.context.globalCompositeOperation = "destination-out";
        }
        else
        {
            canvas.context.globalCompositeOperation = "source-over";
        }

        canvas.sweepTest(Math.floor(prev.x), Math.floor(prev.y), 
                         Math.floor(next.x), Math.floor(next.y), 
                         this.brush);

        canvas.context.globalCompositeOperation = "source-over";
        canvas.update();
    }
}