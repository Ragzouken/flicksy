import * as Pixi from 'pixi.js';

import * as utility from './../utility';

import { DrawingBoard, PinnedDrawing } from '../data/DrawingBoard';
import { MTexture } from '../MTexture';
import { Drawing } from '../data/Drawing';
import { FlicksyProject } from '../data/FlicksyProject';
import FlicksyEditor from './FlicksyEditor';

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
    /** The Pixi.Graphics for displaying the hover highlight */
    public readonly hover: Pixi.Graphics;

    public constructor(pin: PinnedDrawing)
    {
        this.pin = pin;
        
        // create the sprite and move it to the pin position
        this.sprite = new Pixi.Sprite(pin.drawing.texture.texture);
        this.sprite.position = pin.position;
        this.sprite.interactive = true;
        this.sprite.cursor = "none";

        const width = pin.drawing.texture.data.width;
        const height = pin.drawing.texture.data.height;

        // create the border as a child of the sprite
        this.border = new Pixi.Graphics();
        this.border.lineStyle(.8, 0xFFFFFF);
        this.border.drawRect(-.5, -.5, width + 1, height + 1);
        this.border.alpha = 0.25;
        this.sprite.addChild(this.border);

        // create the selection highlight as a child of the spirte
        this.select = new Pixi.Graphics();
        this.select.lineStyle(.5, 0xFFFFFF);
        this.select.drawRect(-.5, -.5, width + 1, height + 1);
        this.select.alpha = 0.5;
        this.sprite.addChild(this.select);

        // create the selection highlight as a child of the spirte
        this.hover = new Pixi.Graphics();
        this.hover.lineStyle(.5, 0xFF0000);
        this.hover.drawRect(-.5, -.5, width + 1, height + 1);
        this.hover.alpha = 0.5;
        this.sprite.addChild(this.hover);
        
        // turn off the selection highlight by default
        this.setSelected(false);

        this.hover.visible = false;
        this.sprite.on("pointerover", () => this.hover.visible = true);
        this.sprite.on("pointerout", () => this.hover.visible = false);
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
        this.hover.destroy();
    }
}

export default class DrawingBoardsPanel
{
    public get activeBoard(): DrawingBoard { return this.drawingBoard }

    private readonly editor: FlicksyEditor;
    private container: Pixi.Container;
    private pinContainer: Pixi.Container;

    private pinViews = new Map<PinnedDrawing, PinnedDrawingView>();
    private drawingBoard: DrawingBoard;

    private dragType: "draw" | "move" | "pan" | undefined;
    private dragOrigin: Pixi.Point;
    private dragPrev: Pixi.Point;
    private draggedPin: PinnedDrawingView | undefined;

    public brush: MTexture;
    public erasing: boolean; 

    public selected: PinnedDrawing | undefined;

    // create drawing ui
    private createWidthInput: HTMLSelectElement;
    private createHeightInput: HTMLSelectElement;

    private selectModeButton: HTMLButtonElement;
    private drawModeButton: HTMLButtonElement;

    // selected drawing ui
    private drawingSectionDiv: HTMLDivElement;
    private drawingNameInput: HTMLInputElement;

    private cursorSprite: Pixi.Sprite;
    private mode: "draw" | "select" = "select";

    private pan = new Pixi.Point(0, 0);
    private zoom = 0;

    private pickerCallback: ((drawing: Drawing | undefined) => void) | undefined;

    public constructor(editor: FlicksyEditor)
    {
        this.editor = editor;

        this.container = new Pixi.Container();
        editor.pixi.stage.addChild(this.container);
        this.pinContainer = new Pixi.Container();
        this.container.addChild(this.pinContainer);

        this.container.interactive = true;
        //this.container.cursor = "none";
        this.container.hitArea = new Pixi.Rectangle(-1000, -1000, 2000, 2000);
        this.container.pivot = new Pixi.Point(80, 50);

        this.selectModeButton = document.getElementById("drawing-select-button")! as HTMLButtonElement;
        this.drawModeButton = document.getElementById("drawing-draw-button")! as HTMLButtonElement;

        this.selectModeButton.addEventListener("click", () => this.setMode("select"));
        this.drawModeButton.addEventListener("click", () => this.setMode("draw"));

        const getMouseViewPosition = () =>
        {
            return editor.pixi.renderer.plugins.interaction.mouse.global as Pixi.Point;
        }

        const getCenterScenePosition = () =>
        {
            const view = new Pixi.Point(editor.pixi.view.width / 2, editor.pixi.view.height / 2);
            const scene = this.container.toLocal(view);

            return scene;
        }

        document.getElementById("container")!.addEventListener("wheel", event =>
        {
            if (!this.container.visible) return;

            const wheel = event as WheelEvent;
            this.zoom += wheel.deltaY * -0.005;
            this.zoom = utility.clamp(-2, 1, this.zoom);
            const scale = Math.pow(2, this.zoom);

            const mouseView = getMouseViewPosition();
            const mouseScenePrev = this.container.toLocal(mouseView);
            
            this.container.scale = new Pixi.Point(scale, scale);

            const mouseSceneNext = this.container.toLocal(mouseView);
            const delta = utility.mul(utility.sub(mouseSceneNext, mouseScenePrev), scale);

            this.container.position = utility.add(this.container.position, delta);
        });

        this.container.on("pointerdown", (event: Pixi.interaction.InteractionEvent) =>
        {
            this.stopDragging();
            this.dragType = "pan";
            this.dragOrigin = utility.sub(this.container.position, event.data.getLocalPosition(this.container.parent));
            event.stopPropagation();
        });

        // scene bounds
        const bounds = new Pixi.Graphics();
        bounds.lineStyle(1, 0xFFFFFF);
        bounds.drawRect(-.5, -.5, 160 + 1, 100 + 1);
        bounds.alpha = .125;
        this.container.addChild(bounds);

        document.addEventListener("pointerup", () => this.stopDragging());
        
        this.drawingSectionDiv = document.getElementById("selected-drawing-section")! as HTMLDivElement;
        this.createWidthInput = document.getElementById("create-drawing-width")! as HTMLSelectElement;
        this.createHeightInput = document.getElementById("create-drawing-height")! as HTMLSelectElement;

        utility.buttonClick("create-drawing-button", () =>
        {
            const width = +this.createWidthInput.options[this.createWidthInput.selectedIndex].value;
            const height = +this.createHeightInput.options[this.createHeightInput.selectedIndex].value;

            const position = getCenterScenePosition();
            position.x = Math.floor(position.x - width / 2);
            position.y = Math.floor(position.y - height / 2);

            const drawing = this.editor.project.createDrawing(width, height);
            drawing.name = `drawing ${this.activeBoard.pinnedDrawings.length}`;
            const pin = this.activeBoard.pinDrawing(drawing, position);
            this.select(pin);
            this.refresh();
        });

        utility.buttonClick("pin-higher", () =>
        {
            if (this.selected)
            {
                const index = this.activeBoard.pinnedDrawings.indexOf(this.selected);
                const next = index + 1;

                if (next < this.activeBoard.pinnedDrawings.length)
                {
                    this.activeBoard.pinnedDrawings[index] = this.activeBoard.pinnedDrawings[next];
                    this.activeBoard.pinnedDrawings[next] = this.selected;
                    this.refresh();
                }
            }
        });

        utility.buttonClick("pin-lower", () =>
        {
            if (this.selected)
            {
                const index = this.activeBoard.pinnedDrawings.indexOf(this.selected);
                const next = index - 1;

                if (next >= 0)
                {
                    this.activeBoard.pinnedDrawings[index] = this.activeBoard.pinnedDrawings[next];
                    this.activeBoard.pinnedDrawings[next] = this.selected;
                    this.refresh();
                }
            }
        });

        this.drawingNameInput = document.getElementById("drawing-name")! as HTMLInputElement;
        
        this.drawingNameInput.addEventListener("input", () =>
        {
            if (this.selected)
            {
                this.selected.drawing.name = this.drawingNameInput.value;
            }
        });

        utility.buttonClick("delete-drawing-button", () =>
        {
            if (this.selected) this.removePin(this.selected);
        });

        this.cursorSprite = new Pixi.Sprite();
        this.cursorSprite.visible = true;
        this.cursorSprite.interactive = false;
        this.container.addChild(this.cursorSprite);

        this.select(undefined);
    }

    public show(): void
    {
        this.container.visible = true;
        this.container.position = new Pixi.Point(0, 0);
        document.getElementById("drawing-sidebar")!.hidden = false;
        this.refresh();
    }

    public hide(): void
    {
        this.container.visible = false;
        document.getElementById("drawing-sidebar")!.hidden = true;
    }

    public setMode(mode: "select" | "draw"): void
    {
        this.mode = mode;
        this.refresh();
    }

    private clear(): void
    {
        this.pinViews.forEach(view => view.destroy());
        this.pinViews.clear();
    }

    /** Resynchronise this display to the data in the underlying DrawingBoard */
    public refresh(): void
    {
        this.cursorSprite.texture = new Pixi.Texture(this.brush.base);
        this.cursorSprite.pivot = new Pixi.Point(Math.floor(this.brush.data.width / 2),
                                                 Math.floor(this.brush.data.height / 2));

        this.setDrawingBoard(this.drawingBoard);
        this.select(this.mode == "select" ? this.selected : undefined);

        this.selectModeButton.disabled = (this.mode == "select");
        this.drawModeButton.disabled = (this.mode == "draw");

        document.getElementById("brush-settings")!.hidden = (this.mode == "select");
        
        this.cursorSprite.visible = (this.mode == "draw");
        this.pinViews.forEach(view => view.sprite.cursor = (this.mode == "select" ? "pointer" : "none"));
    }

    /** Switch the currently selected pin, or select nothing if undefined */
    public select(pin: PinnedDrawing | undefined): void
    {
        this.selected = pin;
        this.pinViews.forEach(view => view.setSelected(view.pin == pin));

        this.drawingSectionDiv.hidden = !pin;

        if (pin)
        {
            this.drawingNameInput.value = pin.drawing.name;
        }
    }

    public removePin(pin: PinnedDrawing)
    {
        if (pin == this.selected)
        {
            this.select(undefined);
        }

        this.drawingBoard.removePin(pin);

        if (this.pinViews.has(pin))
        {
            this.pinViews.get(pin)!.destroy();
            this.pinViews.delete(pin);
        }

        this.editor.project.removeOrphans();
    }

    /** Replace the DrawingBoard that should be displayed */
    public setDrawingBoard(board: DrawingBoard): void
    {
        this.clear();
        this.drawingBoard = board;
        
        for (let pin of board.pinnedDrawings)
        {
            const view = new PinnedDrawingView(pin);

            view.sprite.interactive = true;
            view.sprite.on("pointerdown", (event: Pixi.interaction.InteractionEvent) =>
            {
                if (event.data.button == 1) return;

                if (this.pickerCallback)
                {
                    this.pickDrawing(view.pin.drawing);
                    return;
                }
             
                if (this.mode == "select" || event.data.button === 2)
                {
                    this.startDragging(view, event);
                    
                    if (this.mode == "select") 
                    {
                        this.select(view.pin);
                    }

                    event.stopPropagation();
                }
                else
                {
                    this.startDrawing(view, event);
                    event.stopPropagation();
                }
            });

            this.pinContainer.addChild(view.sprite);
            this.pinViews.set(pin, view);
        }
    }

    public pickDrawingForScene(callback: (drawing: Drawing | undefined) => void,
                               context: string): void
    {
        this.setMode("select");
        this.pickerCallback = callback;
        document.getElementById("drawing-sidebar")!.hidden = true;
        document.getElementById("pick-drawing")!.hidden = false;
        document.getElementById("pick-drawing-context")!.innerHTML = context;
    }

    private pickDrawing(drawing: Drawing | undefined): void
    {
        const callback = this.pickerCallback;

        document.getElementById("drawing-sidebar")!.hidden = false;
        document.getElementById("pick-drawing")!.hidden = true;
        this.pickerCallback = undefined;

        if (callback) callback(drawing);
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
        this.dragOrigin = utility.sub(view.sprite.position, event.data.getLocalPosition(this.container));
    }

    /** 
     * Update the dragging (pin moving or pin drawing) based on a mouse 
     * movement event
     */
    public updateDragging(event: Pixi.interaction.InteractionEvent): void
    {
        this.cursorSprite.position = utility.floor(event.data.getLocalPosition(this.container));

        if (this.dragType == "move" && this.draggedPin)
        {
            const position = utility.floor(utility.add(this.dragOrigin, event.data.getLocalPosition(this.container)));

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
        else if (this.dragType == "pan")
        {
            const position = utility.floor(utility.add(this.dragOrigin, event.data.getLocalPosition(this.container.parent)));

            this.container.position = position;
        }
    }

    private startDrawing(view: PinnedDrawingView, event: Pixi.interaction.InteractionEvent): void
    {
        this.stopDragging();

        this.draggedPin = view;
        this.dragType = "draw";
        this.dragPrev = event.data.getLocalPosition(view.sprite);

        this.draw(this.dragPrev, this.dragPrev, view.pin.drawing.texture);
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
