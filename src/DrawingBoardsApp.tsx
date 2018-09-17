import * as Pixi from 'pixi.js';

import { Drawing } from './Drawing'; 
import { DrawingBoard } from './DrawingBoard';

export default class DrawingBoardsApp
{
    private pixi: Pixi.Application;
    private container: Pixi.Container;

    private sprites = new Map<Drawing, Pixi.Sprite>();
    private drawingBoard: DrawingBoard;

    public constructor(pixi: Pixi.Application)
    {
        this.pixi = pixi;
        this.container = new Pixi.Container();
        this.pixi.stage.addChild(this.container);
    }

    private Reset(): void
    {
        Array.from(this.sprites.values()).forEach(sprite => sprite.destroy());
        this.sprites.clear();
    }

    public SetDrawingBoard(board: DrawingBoard): void
    {
        this.Reset();
        this.drawingBoard = board;
        
        for (let pin of board.pinnedDrawings)
        {
            const sprite = new Pixi.Sprite(pin.drawing.texture.texture);
            sprite.position = pin.position;

            this.container.addChild(sprite);
            this.sprites.set(pin.drawing, sprite);
        }
    }
}
