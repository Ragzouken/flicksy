import * as Pixi from 'pixi.js';

import { Drawing } from './Drawing'; 
import { DrawingBoard, PinnedDrawing } from './DrawingBoard';

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

    public selected: PinnedDrawing | undefined;

    public constructor(pixi: Pixi.Application)
    {
        this.pixi = pixi;
        this.container = new Pixi.Container();
        this.pixi.stage.addChild(this.container);
    }

    private clear(): void
    {
        Array.from(this.pinViews.values()).forEach(view => view.destroy());
        this.pinViews.clear();
    }

    public refresh(): void
    {
        this.setDrawingBoard(this.drawingBoard);
        this.select(this.selected);
    }

    public select(pin: PinnedDrawing): void
    {
        this.selected = pin;
        this.pinViews[pin].select();
    }

    public setDrawingBoard(board: DrawingBoard): void
    {
        this.clear();
        this.drawingBoard = board;
        
        for (let pin of board.pinnedDrawings)
        {
            const view = new PinnedDrawingView(pin);

            this.container.addChild(view.sprite);
            this.pinViews.set(pin, view);
        }
    }
}
