import * as Pixi from 'pixi.js';

import { Drawing } from './Drawing'; 
import { DrawingBoard, PinnedDrawing } from './DrawingBoard';

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

class PinnedDrawingView
{
    public readonly pin: PinnedDrawing;
    public readonly sprite: Pixi.Sprite;
    public readonly border: Pixi.Graphics;
    public readonly select: Pixi.Graphics;

    public constructor(pin: PinnedDrawing)
    {
        this.pin = pin;
        this.sprite = new Pixi.Sprite(pin.drawing.texture.texture);
        this.sprite.position = pin.position;

        const width = pin.drawing.texture.data.width;
        const height = pin.drawing.texture.data.height;

        this.border = new Pixi.Graphics();
        this.border.lineStyle(.125, 0xFFFFFF);
        this.border.drawRect(-.5, -.5, width + 1, height + 1);
        this.border.alpha = 0.25;
        this.sprite.addChild(this.border);

        this.select = new Pixi.Graphics();
        this.select.lineStyle(.5, 0xFFFFFF);
        this.select.drawRect(-.5, -.5, width + 1, height + 1);
        this.select.alpha = 0.5;
        this.sprite.addChild(this.select);
        
        this.setSelected(false);
    }

    public setSelected(selected: boolean)
    {
        this.select.visible = selected;
    }

    public destroy(): void
    {
        this.sprite.destroy();
        this.border.destroy();
        this.select.destroy();
    }
}

export default class DrawingBoardsApp
{
    private pixi: Pixi.Application;
    private container: Pixi.Container;

    private pinViews = new Map<PinnedDrawing, PinnedDrawingView>();
    private drawingBoard: DrawingBoard;

    private dragType: "draw" | "move" | undefined;
    private dragOrigin: Pixi.Point;
    private draggedPin: PinnedDrawingView | undefined;
    
    private selectDropdown: HTMLSelectElement;

    public selected: PinnedDrawing | undefined;

    public constructor(pixi: Pixi.Application)
    {
        this.pixi = pixi;
        this.container = new Pixi.Container();
        this.pixi.stage.addChild(this.container);

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

    public refresh(): void
    {
        this.setDrawingBoard(this.drawingBoard);
        this.select(this.selected);
    }

    public select(pin: PinnedDrawing | undefined): void
    {
        this.selected = pin;
        this.pinViews.forEach(view => view.setSelected(view.pin == pin));
    }

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
        }
    }

    private stopDragging(): void
    {
        this.dragType = undefined;
        this.draggedPin = undefined;
    }

    private startDragging(view: PinnedDrawingView, event: Pixi.interaction.InteractionEvent): void
    {
        if (this.draggedPin != undefined)
        {
            this.stopDragging();
        }

        this.draggedPin = view;
        this.dragType = "move";
        this.dragOrigin = sub(view.sprite.position, event.data.getLocalPosition(this.container));
    }

    public updateDragging(event: Pixi.interaction.InteractionEvent): void
    {
        if (this.dragType == "move" && this.draggedPin)
        {
            const position = floor(add(this.dragOrigin, event.data.getLocalPosition(this.container)));

            this.draggedPin.pin.position = position;
            this.draggedPin.sprite.position = position;
        }
    }

    private startDrawing(view: PinnedDrawingView, event: Pixi.interaction.InteractionEvent): void
    {

    }
}
