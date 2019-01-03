import { Container, Graphics, interaction, Point, Rectangle, Sprite, Texture } from 'pixi.js';
import { Drawing } from '../data/Drawing';
import { DrawingBoard, PinnedDrawing } from '../data/DrawingBoard';
import { HitPrecision, pageBounds, pageFirstObjectUnderPoint } from '../data/PositionedDrawing';
import ModelViewMapping from '../tools/ModelViewMapping';
import { MTexture } from '../tools/MTexture';
import { randomisePalette } from '../tools/saving';
import * as utility from '../tools/utility';
import FlicksyEditor from './FlicksyEditor';
import Panel from './Panel';
import PositionedDrawingView from './PositionedDrawingView';

export type PinnedDrawingView = PositionedDrawingView<PinnedDrawing>;

class DragState
{
    public current: Point;

    public constructor(public readonly type: "move" | "draw" | "pan",
                       public readonly pointer: number,
                       public readonly start: Point,
                       public readonly view?: PinnedDrawingView)
    {
        this.current = start;
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

    private readonly container: Container;
    private readonly pinContainer: Container;
    private readonly pinViews: ModelViewMapping<PinnedDrawing, PinnedDrawingView>;
    
    private drawingBoard: DrawingBoard;

    private brushColor: number; 
    private brushSize: number;

    private readonly cursorSprite: Sprite;
    private mode: "draw" | "select" = "select";

    private zoom = 0;

    private pickerCallback: ((drawing: Drawing | undefined) => void) | undefined;

    private readonly selectModeButton: HTMLButtonElement;
    private readonly drawModeButton: HTMLButtonElement;

    private readonly drawingSectionDiv: HTMLDivElement;
    private readonly drawingNameInput: HTMLInputElement;

    private readonly drags = new Map<number, DragState>();

    public constructor(private readonly editor: FlicksyEditor)
    {
        this.sidebar = utility.getElement("drawing-sidebar");

        this.pinViews = new ModelViewMapping<PinnedDrawing, PinnedDrawingView>(
            () => this.createPinView(),
            (view, active) => view.sprite.visible = active,
        ); 

        // containers
        this.container = new Container();
        editor.pixi.stage.addChild(this.container);
        this.pinContainer = new Container();
        this.container.addChild(this.pinContainer);

        this.container.interactive = true;
        this.container.hitArea = new Rectangle(-1000, -1000, 2000, 2000);

        // modes
        this.selectModeButton = utility.getElement("drawing-select-button");
        this.drawModeButton = utility.getElement("drawing-draw-button");

        this.selectModeButton.addEventListener("click", () => this.setMode("select"));
        this.drawModeButton.addEventListener("click", () => this.setMode("draw"));

        // mouse controls
        this.container.on("pointerdown",      (event: interaction.InteractionEvent) => this.onPointerDown(event));
        this.container.on("pointermove",      (event: interaction.InteractionEvent) => this.onPointerMove(event));
        this.container.on("pointerup",        (event: interaction.InteractionEvent) => this.drags.delete(event.data.identifier));
        this.container.on("pointerupoutside", (event: interaction.InteractionEvent) => this.drags.delete(event.data.identifier));
        utility.getElement("container").addEventListener("wheel", event => this.onWheel(event));

        // scene bounds
        const bounds = new Graphics();
        bounds.lineStyle(1, 0xFFFFFF);
        bounds.drawRect(-.5, -.5, 160 + 1, 100 + 1);
        bounds.alpha = .125;
        this.container.addChild(bounds);
        
        this.drawingSectionDiv = utility.getElement("selected-drawing-section");
        const widthInput = utility.getElement<HTMLSelectElement>("create-drawing-width");
        const heightInput = utility.getElement<HTMLSelectElement>("create-drawing-height");

        utility.buttonClick("create-drawing-button", () =>
        {
            const width = +widthInput.options[widthInput.selectedIndex].value;
            const height = +heightInput.options[heightInput.selectedIndex].value;

            this.createNewDrawing(width, height);
        });

        utility.buttonClick("pin-higher", () => this.shiftSelectedPinUp());
        utility.buttonClick("pin-lower", () => this.shiftSelectedPinDown());

        utility.buttonClick("duplicate-drawing-button", () =>
        {
            if (this.selected)
            {
                const drawing = this.selected.drawing;
                drawing.texture.fetch();
                const copy = this.createNewDrawing(drawing.width, drawing.height);
                copy.drawing.texture.context.drawImage(drawing.texture.canvas, 0, 0);
                copy.drawing.texture.update();
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

        // brushes
        this.brushSize = 1;
        this.brushColor = 0xFFFFFFFF;
        const brushes = utility.getElement("brushes");
  
        for (let i = 0; i < brushes.children.length; ++i)
        {
            brushes.children[i].children[0].addEventListener("click", () => 
            {
                this.brushSize = i + 1;
                this.setBrushColor(this.paletteIndex);
                this.refresh();
            });
        }

        // palette
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

        // paint cursor
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

        this.pickerCallback = undefined;
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
        this.pinViews.forEach(view => view.setSelected(view.object === pin));

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
        this.show();
        this.sidebar.hidden = true;

        this.setMode("select");
        this.pickerCallback = callback;
        this.editor.pickerPanel.pick("pick drawing", context, query => this.setSearchQuery(query));
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
        const viewPoint = event.data.getLocalPosition(this.container.parent);
        const pagePoint = event.data.getLocalPosition(this.container);

        this.cursorSprite.position = utility.floor(pagePoint);

        const drag = this.drags.get(event.data.identifier);

        if (drag)
        {
            if (drag.type === "pan")
            {
                const offset = utility.sub(this.container.position,
                                           utility.transform(drag.start, this.container, this.container.parent));

                this.container.position = utility.add(offset, viewPoint);
            }
            else if (drag.type === "move")
            {
                drag.view!.model.position = utility.round(utility.sub(pagePoint, drag.start));
                drag.view!.refresh();
            }
            else if (drag.type === "draw")
            {
                const localPrev = drag.current || drag.start;
                const localNext = event.data.getLocalPosition(drag.view!.sprite);

                this.draw(localPrev, localNext, drag.view!.model.drawing.texture);

                drag.current = localNext;
            }
        }
    }

    /**
     * Respond to a pointer-down in the board -- begin a drag, brush stroke,
     * selection, etc.
     */
    private onPointerDown(event: interaction.InteractionEvent): void
    {
        // assume a pointer-down means any existing dragging must be over
        this.drags.delete(event.data.identifier);

        // convert the pointer position into a pixel coordinate within the page
        const page = utility.floor(event.data.getLocalPosition(this.pinContainer));
        // find the first object, if any, at this position
        const object = pageFirstObjectUnderPoint(this.drawingBoard.pinnedDrawings, page, HitPrecision.Bounds);

        const middle = event.data.originalEvent instanceof MouseEvent
                    && event.data.originalEvent.button === 1;

        // if there's no object under the pointer, or the pointer is a 
        // middle-click, then begin a panning drag
        if (!object || middle)
        {
            const drag = new DragState("pan", 
                                       event.data.identifier, 
                                       event.data.getLocalPosition(this.container));
            this.drags.set(event.data.identifier, drag);
        }
        // if we're in picker mode, then pick the drawing under the pointer
        else if (this.pickerCallback)
        {
            this.pickDrawing(object.drawing);
        }
        // if we're selecting or the pointer is a right-click then begin an
        // object moving drag
        else if (this.mode === "select" || event.data.button === 2)
        {
            const view = this.pinViews.get(object)!;
            const drag = new DragState("move", 
                                       event.data.identifier, 
                                       event.data.getLocalPosition(view.sprite), 
                                       view);
            this.drags.set(event.data.identifier, drag);

            if (this.mode === "select") 
            {
                this.select(object);
            }
        }
        // if we're drawing, then begin a drawing drag
        else if (this.mode === "draw")
        {
            const view = this.pinViews.get(object)!;
            const drag = new DragState("draw", 
                                       event.data.identifier, 
                                       event.data.getLocalPosition(view.sprite), 
                                       view);
            this.drags.set(event.data.identifier, drag);

            this.draw(drag.current, drag.current, object.drawing.texture);
        }

        event.stopPropagation();
    }

    private onPointerMove(event: interaction.InteractionEvent): void
    {
        const page = utility.floor(event.data.getLocalPosition(this.pinContainer));
        const object = pageFirstObjectUnderPoint(this.drawingBoard.pinnedDrawings, page, HitPrecision.Bounds);
        
        this.pinViews.forEach(v => v.hover.visible = v.object === object);
        
        const cursor = this.drags.size > 0 ? "grabbing" : "grab";
        const grab = object && this.mode === "select";
        this.container.cursor = grab ? cursor : "initial";
    }

    private onWheel(event: WheelEvent): void
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
    }

    private shiftSelectedPinUp(): void
    {
        if (this.selected)
        {
            const index = this.activeBoard.pinnedDrawings.indexOf(this.selected);
            
            utility.swapArrayElements(this.activeBoard.pinnedDrawings, index, index + 1);
            this.refreshPinViews();
        }
    }

    private shiftSelectedPinDown(): void
    {
        if (this.selected)
        {
            const index = this.activeBoard.pinnedDrawings.indexOf(this.selected);
            
            utility.swapArrayElements(this.activeBoard.pinnedDrawings, index, index - 1);
            this.refreshPinViews();
        }
    }

    private setSearchQuery(query: string): void
    {
        this.pinViews.forEach((view, model) =>
        {
            view.setDimmed(query.length > 0 ? !model.drawing.name.includes(query) : false); 
        });
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

    private createNewDrawing(width: number, height: number): PinnedDrawing
    {
        // center
        const view = new Point(this.editor.pixi.view.width / 2, this.editor.pixi.view.height / 2);
        const position = this.container.toLocal(view);

        position.x = Math.floor(position.x - width / 2);
        position.y = Math.floor(position.y - height / 2);

        const drawing = this.editor.project.createDrawing(width, height);
        drawing.name = `drawing ${this.activeBoard.pinnedDrawings.length}`;
        const pin = this.activeBoard.pinDrawing(drawing, position);
        
        this.refreshPinViews();
        this.select(pin);

        return pin;
    }

    private createPinView(): PinnedDrawingView
    {
        const view = new PositionedDrawingView<PinnedDrawing>();

        this.pinContainer.addChild(view.sprite);
        
        return view;
    }

    private pickDrawing(drawing: Drawing | undefined): void
    {
        const callback = this.pickerCallback;

        this.editor.pickerPanel.hide();
        this.hide();
        this.pickerCallback = undefined;

        if (callback) { callback(drawing); }
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
