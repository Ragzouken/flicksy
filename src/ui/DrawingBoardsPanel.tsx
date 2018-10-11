import { Container, Graphics, interaction, Point, Rectangle, Sprite, Texture } from 'pixi.js';
import { Drawing } from '../data/Drawing';
import { DrawingBoard, PinnedDrawing } from '../data/DrawingBoard';
import { pageBounds } from '../data/PositionedDrawing';
import ModelViewMapping, { View } from '../tools/ModelViewMapping';
import { MTexture } from '../tools/MTexture';
import { randomisePalette } from '../tools/saving';
import * as utility from '../tools/utility';
import FlicksyEditor from './FlicksyEditor';
import Panel from './Panel';

/** Manages the pixi state for displaying a PinnedDrawing */
class PinnedDrawingView implements View<PinnedDrawing>
{
    /** The pinned drawing that this view corresponds to */
    public pin: PinnedDrawing;
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

    public get model(): PinnedDrawing
    {
        return this.pin;
    }

    public set model(model: PinnedDrawing)
    {
        this.pin = model;

        this.refreshBorders();
    }

    public refreshBorders(): void
    {
        const width = this.pin.drawing.width;
        const height = this.pin.drawing.height;

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
        this.sprite.texture = this.pin.drawing.texture.texture;
        this.sprite.position = this.pin.position;
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

// tslint:disable-next-line:max-classes-per-file
export default class DrawingBoardsPanel implements Panel
{
    public get activeBoard(): DrawingBoard { return this.drawingBoard }

    public selected: PinnedDrawing | undefined;
    public brush: MTexture;
    public erasing: boolean;
    public paletteIndex: number;

    private readonly sidebar: HTMLElement;
    private readonly pickSiderbar: HTMLElement;

    private readonly container: Container;
    private readonly pinContainer: Container;
    private readonly pinViews: ModelViewMapping<PinnedDrawing, PinnedDrawingView>;
    
    private drawingBoard: DrawingBoard;

    private dragType: "draw" | "move" | "pan" | undefined;
    private dragOrigin: Point;
    private dragPrev: Point;
    private draggedPin: PinnedDrawingView | undefined;

    private brushColor: number; 
    private brushSize: number;

    private readonly cursorSprite: Sprite;
    private mode: "draw" | "select" = "select";

    private zoom = 0;

    private pickerCallback: ((drawing: Drawing | undefined) => void) | undefined;

    // create drawing ui
    private readonly createWidthInput: HTMLSelectElement;
    private readonly createHeightInput: HTMLSelectElement;

    private readonly selectModeButton: HTMLButtonElement;
    private readonly drawModeButton: HTMLButtonElement;

    // selected drawing ui
    private readonly drawingSectionDiv: HTMLDivElement;
    private readonly drawingNameInput: HTMLInputElement;

    public constructor(private readonly editor: FlicksyEditor)
    {
        this.sidebar = utility.getElement("drawing-sidebar");
        this.pickSiderbar = utility.getElement("pick-drawing");

        this.pinViews = new ModelViewMapping<PinnedDrawing, PinnedDrawingView>(
            () => this.createPinView(),
            (view, active) => view.sprite.visible = active,
        ); 

        this.container = new Container();
        editor.pixi.stage.addChild(this.container);
        this.pinContainer = new Container();
        this.container.addChild(this.pinContainer);

        this.container.interactive = true;
        // this.container.cursor = "none";
        this.container.hitArea = new Rectangle(-1000, -1000, 2000, 2000);
        // this.container.pivot = new Pixi.Point(80, 50);

        this.selectModeButton = utility.getElement("drawing-select-button");
        this.drawModeButton = utility.getElement("drawing-draw-button");

        this.selectModeButton.addEventListener("click", () => this.setMode("select"));
        this.drawModeButton.addEventListener("click", () => this.setMode("draw"));

        const getCenterScenePosition = () =>
        {
            const view = new Point(editor.pixi.view.width / 2, editor.pixi.view.height / 2);
            const scene = this.container.toLocal(view);

            return scene;
        }

        document.getElementById("container")!.addEventListener("wheel", event =>
        {
            if (!this.container.visible) { return; }

            const wheel = event as WheelEvent;
            this.zoom += wheel.deltaY * -0.005;
            this.zoom = utility.clamp(-2, 1, this.zoom);
            const scale = Math.pow(2, this.zoom);

            const mouseView = this.editor.getMousePositionView();
            const mouseScenePrev = this.container.toLocal(mouseView);
            
            this.container.scale = new Point(scale, scale);

            const mouseSceneNext = this.container.toLocal(mouseView);
            const delta = utility.mul(utility.sub(mouseSceneNext, mouseScenePrev), scale);

            this.container.position = utility.add(this.container.position, delta);
        });

        this.container.on("pointerdown", (event: interaction.InteractionEvent) =>
        {
            this.stopDragging();
            this.dragType = "pan";
            this.dragOrigin = utility.sub(this.container.position, event.data.getLocalPosition(this.container.parent));
            event.stopPropagation();
        });

        // search
        const searchInput = utility.getElement<HTMLInputElement>("pick-drawing-search-input");

        searchInput.addEventListener("input", () =>
        {
            const query = searchInput.value;

            this.pinViews.forEach((view, model) =>
            {
               view.setDimmed(query.length > 0 ? !model.drawing.name.includes(query) : false); 
            });
        });

        utility.buttonClick("pick-drawing-search-reset", () =>
        {
            searchInput.value = "";
            this.pinViews.forEach(view => view.setDimmed(false));
        });

        // scene bounds
        const bounds = new Graphics();
        bounds.lineStyle(1, 0xFFFFFF);
        bounds.drawRect(-.5, -.5, 160 + 1, 100 + 1);
        bounds.alpha = .125;
        this.container.addChild(bounds);

        document.addEventListener("pointerup", () => this.stopDragging());
        
        this.drawingSectionDiv = utility.getElement("selected-drawing-section");
        this.createWidthInput = utility.getElement("create-drawing-width");
        this.createHeightInput = utility.getElement("create-drawing-height");

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
            
            this.refreshPinViews();
            this.select(pin);
        });

        utility.buttonClick("pin-higher", () =>
        {
            if (this.selected)
            {
                const index = this.activeBoard.pinnedDrawings.indexOf(this.selected);
                
                utility.swapArrayElements(this.activeBoard.pinnedDrawings, index, index + 1);
                this.refreshPinViews();
            }
        });

        utility.buttonClick("pin-lower", () =>
        {
            if (this.selected)
            {
                const index = this.activeBoard.pinnedDrawings.indexOf(this.selected);
                utility.swapArrayElements(this.activeBoard.pinnedDrawings, index, index - 1);
                this.refresh();
            }
        });

        this.drawingNameInput = utility.getElement("drawing-name");
        this.drawingNameInput.addEventListener("input", () =>
        {
            if (this.selected)
            {
                this.selected.drawing.name = this.drawingNameInput.value;
            }
        });

        utility.buttonClick("delete-drawing-button", () =>
        {
            if (this.selected) { this.removePin(this.selected); }
        });

        this.brushSize = 1;
        this.brushColor = 0xFFFFFFFF;
        const brushes = utility.getElement("brushes");
  
        for (let i = 0; i < brushes.children.length; ++i)
        {
            const cell = brushes.children[i];
            const button = cell.children[0];
            button.addEventListener("click", () => 
            {
                this.brushSize = i + 1;
                this.setBrushColor(this.paletteIndex);
                this.refresh();
            });
        }

        const palette = utility.getElement("palette");

        for (let i = 0; i < palette.children.length; ++i)
        {
            palette.children[i].addEventListener("click", () => editor.drawingBoardsPanel.setBrushColor(i));
        }

        const input = utility.getElement<HTMLInputElement>("color-input");
        input.addEventListener("change", () =>
        {
            const [r, g, b] = utility.hex2rgb(input.value);

            editor.project.palette[editor.drawingBoardsPanel.paletteIndex] = utility.rgb2num(r, g, b);
            
            this.refreshPalette();
            this.setBrushColor(this.paletteIndex);
        });

        this.refreshPalette();

        utility.buttonClick("reset-palette", () =>
        {
            randomisePalette(editor.project);
            this.refresh();
        });

        this.cursorSprite = new Sprite();
        this.cursorSprite.visible = true;
        this.cursorSprite.interactive = false;
        this.container.addChild(this.cursorSprite);

        this.select(undefined);
    }

    public show(): void
    {
        this.container.visible = true;
        this.sidebar.hidden = false;
        this.refresh();
        this.reframe();
    }

    public hide(): void
    {
        this.container.visible = false;
        this.sidebar.hidden = true;
    }

    public setMode(mode: "select" | "draw"): void
    {
        this.mode = mode;
        this.refresh();
    }

    /** Resynchronise this display to the data in the underlying DrawingBoard */
    public refresh(): void
    {
        if (this.brush)
        {
            this.cursorSprite.texture = new Texture(this.brush.base);
            this.cursorSprite.pivot.set(Math.floor(this.brush.data.width / 2),
                                        Math.floor(this.brush.data.height / 2));
        }

        this.refreshPinViews();
        this.select(this.mode === "select" ? this.selected : undefined);

        this.selectModeButton.disabled = (this.mode === "select");
        this.drawModeButton.disabled = (this.mode === "draw");

        document.getElementById("brush-settings")!.hidden = (this.mode === "select");
        
        this.cursorSprite.visible = (this.mode === "draw");
        this.pinViews.forEach(view => view.sprite.cursor = (this.mode === "select" ? "pointer" : "none"));

        this.refreshPalette();
    }

    /** Switch the currently selected pin, or select nothing if undefined */
    public select(pin: PinnedDrawing | undefined): void
    {
        this.selected = pin;
        this.pinViews.forEach(view => view.setSelected(view.pin === pin));

        this.drawingSectionDiv.hidden = !pin;

        if (pin)
        {
            this.drawingNameInput.value = pin.drawing.name;
        }
    }

    /**
     * Update the panning and zoom of the scene so that the drawings are
     * centered within the viewport.
     */
    public reframe(): void
    {
        if (this.drawingBoard.pinnedDrawings.length === 0)
        {
            this.container.scale.set(1);
            this.container.position.set(-80, -50);

            return;
        }

        // compute bounds
        const bounds = pageBounds(this.drawingBoard.pinnedDrawings);

        // fit bounds
        const hscale = this.editor.resolution[0] / bounds.width;
        const vscale = this.editor.resolution[1] / bounds.height;
        
        let scale = Math.min(hscale, vscale);
        this.zoom = Math.log2(scale); 
        this.zoom = utility.clamp(-2, 1, this.zoom);
        scale = Math.pow(2, this.zoom);

        this.container.scale.set(scale);

        // center bounds
        const cx = bounds.left + bounds.width  / 2;
        const cy = bounds.top  + bounds.height / 2;

        this.container.position.set(-cx * scale, -cy * scale);
    }

    public removePin(pin: PinnedDrawing)
    {
        if (pin === this.selected)
        {
            this.select(undefined);
        }

        this.drawingBoard.removePin(pin);
        this.refreshPinViews();

        this.editor.project.removeOrphans();
    }

    /** Replace the DrawingBoard that should be displayed */
    public setDrawingBoard(board: DrawingBoard): void
    {
        this.drawingBoard = board;
        this.refresh();
    }

    public pickDrawingForScene(callback: (drawing: Drawing | undefined) => void,
                               context: string): void
    {
        this.setMode("select");
        this.pickerCallback = callback;
        this.sidebar.hidden = true;
        this.pickSiderbar.hidden = false;
        utility.getElement("pick-drawing-context").innerHTML = context;
    }

    public setBrushColor(index: number)
    {
        this.paletteIndex = index;

        this.erasing = (index === 0);
        this.brushColor = (index === 0) ? 0xFFFFFFFF : this.editor.project.palette[index];

        this.brush = new MTexture(this.brushSize, this.brushSize);
        this.brush.circleTest(this.brushColor === 0 ? 0xFFFFFFFF : this.brushColor);

        const input = utility.getElement<HTMLInputElement>("color-input");
        input.hidden = (index === 0);
        input.value = utility.rgb2hex(utility.num2rgb(this.editor.project.palette[index]));

        this.refresh();
    }

    public refreshPalette(): void
    {
        if (!this.editor.project) { return; }

        const palette = document.getElementById("palette")!;

        for (let i = 0; i < palette.children.length; ++i)
        {
            const hex = (i === 0) ? "#000000" : utility.num2hex(this.editor.project.palette[i]);
            const button = palette.children[i];

            button.setAttribute("style", `background-color: ${hex};`);
        }
    }

    /** 
     * Update the dragging (pin moving or pin drawing) based on a mouse 
     * movement event
     */
    public updateDragging(event: interaction.InteractionEvent): void
    {
        this.cursorSprite.position = utility.floor(event.data.getLocalPosition(this.container));

        if (this.dragType === "move" && this.draggedPin)
        {
            const position = utility.floor(utility.add(this.dragOrigin, event.data.getLocalPosition(this.container)));

            this.draggedPin.pin.position = position;
            this.draggedPin.sprite.position = position;
        }
        else if (this.dragType === "draw" && this.draggedPin)
        {
            const base = this.draggedPin.pin.drawing.texture;
            const m = event.data.getLocalPosition(this.draggedPin.sprite);

            this.draw(this.dragPrev, m, base);

            this.dragPrev = m;
        }
        else if (this.dragType === "pan")
        {
            const position = utility.floor(utility.add(this.dragOrigin, event.data.getLocalPosition(this.container.parent)));

            this.container.position = position;
        }
    }

    private refreshPinViews(): void
    {
        this.pinViews.setModels(this.drawingBoard.pinnedDrawings);
        this.pinViews.refresh();
        
        // reorder the sprites so 
        this.drawingBoard.pinnedDrawings.forEach((pin, index) => 
        {
            this.pinContainer.setChildIndex(this.pinViews.get(pin)!.sprite, index);
        });
    }

    private createPinView(): PinnedDrawingView
    {
        const view = new PinnedDrawingView();

        view.sprite.on("pointerdown", (event: interaction.InteractionEvent) =>
        {
            if (event.data.button === 1) { return; }

            if (this.pickerCallback)
            {
                this.pickDrawing(view.pin.drawing);
            }
            else if (this.mode === "select" || event.data.button === 2)
            {
                this.startDragging(view, event);
                
                if (this.mode === "select") 
                {
                    this.select(view.pin);
                }
            }
            else
            {
                this.startDrawing(view, event);
            }

            event.stopPropagation();
        });

        this.pinContainer.addChild(view.sprite);
        
        return view;
    }

    private pickDrawing(drawing: Drawing | undefined): void
    {
        const callback = this.pickerCallback;

        this.sidebar.hidden = false;
        this.pickSiderbar.hidden = true;
        this.pickerCallback = undefined;

        if (callback) { callback(drawing); }
    }

    private stopDragging(): void
    {
        this.dragType = undefined;
        this.draggedPin = undefined;
    }

    private startDragging(view: PinnedDrawingView, event: interaction.InteractionEvent): void
    {
        this.stopDragging();

        this.draggedPin = view;
        this.dragType = "move";
        this.dragOrigin = utility.sub(view.sprite.position, event.data.getLocalPosition(this.container));
    }

    private startDrawing(view: PinnedDrawingView, event: interaction.InteractionEvent): void
    {
        this.stopDragging();

        this.draggedPin = view;
        this.dragType = "draw";
        this.dragPrev = event.data.getLocalPosition(view.sprite);

        this.draw(this.dragPrev, this.dragPrev, view.pin.drawing.texture);
    }

    private draw(prev: Point, 
                 next: Point,
                 canvas: MTexture): void
    {
        canvas.context.globalCompositeOperation = this.erasing ? "destination-out" : "source-over";
        canvas.sweepTest(Math.floor(prev.x), Math.floor(prev.y), 
                         Math.floor(next.x), Math.floor(next.y), 
                         this.brush);

        canvas.context.globalCompositeOperation = "source-over";
        canvas.update();
    }
}
