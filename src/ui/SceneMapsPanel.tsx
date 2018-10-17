import { Container, Graphics, interaction, Point, Sprite, Text } from "pixi.js";
import { pageFirstBoundsUnderPoint } from "src/data/PositionedDrawing";
import { Scene, SceneObject } from "src/data/Scene";
import { MTexture } from "src/tools/MTexture";
import SceneBoard, { PinnedScene } from "../data/SceneBoard";
import ModelViewMapping, { View } from "../tools/ModelViewMapping";
import * as utility from '../tools/utility';
import FlicksyEditor from "./FlicksyEditor";
import Panel from "./Panel";

class DragState
{
    public current: Point;

    public constructor(public readonly type: "move" | "pan",
                       public readonly pointer: number,
                       public readonly start: Point,
                       public readonly view?: PinnedSceneView)
    {
        this.current = start;
    }
}

// tslint:disable-next-line:max-classes-per-file
class PinnedSceneView implements View<PinnedScene>
{
    public model: PinnedScene;    

    public readonly container: Container;
    public readonly preview: MTexture;

    private readonly labelText: Text;
    private readonly border: Graphics;

    private hovered: boolean;
    private selected: boolean;

    public constructor()
    {
        this.container = new Container();

        this.preview = new MTexture(160, 100);
        this.preview.fill(0xFF000000);
        const sprite = new Sprite(this.preview.texture);
        sprite.scale.set(1 / 4);
        this.container.addChild(sprite);
        
        this.border = new Graphics();
        this.border.lineStyle(1, 0xFFFFFFFF, 1);
        this.border.drawRect(-.5, -.5, 40 + 1, 25 + 1);
        this.container.addChild(this.border);

        const scale = 16;
        this.labelText = new Text("scene name", {
            fill:  0xffffff,
            wordWrap: true, 
            wordWrapWidth: (32 - 2) * scale, 
            fontSize: 50,
        });
        this.labelText.position.set(1);
        this.labelText.scale.set(1 / scale);
        this.container.addChild(this.labelText);
    }

    public setSelected(selected: boolean)
    {
        this.selected = selected;
        this.refresh();
    }

    public setHovered(hovered: boolean)
    {
        this.hovered = hovered;
        this.refresh();
    }

    public refresh(): void 
    {
        this.container.position = this.model.position;
        this.labelText.text = this.model.element.name;

        this.border.tint = this.hovered ? 0xFFFF0000 : 0xFFFFFFFF;
        this.border.alpha = (this.hovered || this.selected) ? 1 : .25;
    }
}

// tslint:disable-next-line:max-classes-per-file
export default class SceneMapsPanel implements Panel
{
    private readonly sidebar: HTMLElement;
    private readonly container: Container;
    private readonly pinContainer: Container;
    private readonly sceneViews: ModelViewMapping<PinnedScene, PinnedSceneView>;
    private readonly drags = new Map<number, DragState>();
    
    private readonly linkGraphic = new Graphics();
    private readonly linksGraphic = new Graphics();

    private sceneMap: SceneBoard;
    private selected: PinnedScene | undefined;
    private zoom = 0;
    private doubleClick: PinnedScene | undefined;
    private doubleTimeout: number;

    private pickerCallback: ((drawing: Scene | undefined) => void) | undefined;
    private pickerObject: SceneObject | undefined;

    private readonly startSceneButton: HTMLButtonElement;
    private readonly sceneNameInput: HTMLInputElement;

    public constructor(private readonly editor: FlicksyEditor)
    {
        this.sceneViews = new ModelViewMapping<PinnedScene, PinnedSceneView>(
            () => this.createSceneView(),
            (view, active) => view.container.visible = active,
        );

        this.sidebar = utility.getElement("scene-maps-sidebar");
        this.container = new Container();
        this.container.interactive = true;
        this.editor.pixi.stage.addChild(this.container);
        
        this.pinContainer = new Container();
        this.container.addChild(this.pinContainer);
        this.container.addChild(this.linksGraphic);
        this.container.addChild(this.linkGraphic);

        this.container.position.set(-80, -50);
        this.container.hitArea = utility.infiniteHitArea;

        this.startSceneButton = utility.getElement("project-start-scene");
        this.startSceneButton.addEventListener("click", () => this.pickSceneForStart());

        utility.buttonClick("create-scene-button", () => this.createNewScene());
        utility.buttonClick("delete-scene-button", () => this.deleteSelectedScene());
        utility.buttonClick("scene-map-open-button", () =>
        {   
            if (this.selected)
            {
                this.editor.openScene(this.selected.element);
            }
        });

        utility.buttonClick("scene-map-regenerate", () => this.regeneratePreviews());

        this.sceneNameInput = utility.getElement("scene-name2");
        this.sceneNameInput.addEventListener("input", () => 
        {
            if (this.selected)
            {
                this.selected.element.name = this.sceneNameInput.value;
            }
        });

        utility.buttonClick("scene-higher", () => this.shiftSelectedSceneUp());
        utility.buttonClick("scene-lower", () => this.shiftSelectedSceneDown());

        // mouse controls
        this.container.on("pointerdown", (event: interaction.InteractionEvent) => this.onPointerDown(event));
        this.container.on("pointermove", (event: interaction.InteractionEvent) => this.onPointerMove(event));
        document.addEventListener("pointerup", event => this.drags.delete(event.pointerId));
        document.addEventListener("wheel", event => this.onWheel(event));
    }

    public show(): void
    {
        this.container.visible = true;
        this.sidebar.hidden = false;
        this.refresh();
        this.reframe();
        this.regeneratePreviews();
    }

    public hide(): void
    {
        this.container.visible = false;
        this.sidebar.hidden = true;

        this.clearPicking();
    }

    public setMap(map: SceneBoard): void
    {
        this.sceneMap = map;

        this.editor.project.scenes.forEach((scene, index) =>
        {
            if (!map.pins.find(pin => pin.element === scene))
            {
                const pin = new PinnedScene();
                pin.element = scene;
                pin.position = new Point((index % 4) * 50, Math.floor(index / 4) * 30);

                map.pins.push(pin);
            }
        });

        this.refresh();
    }

    public refresh(): void
    {
        this.sceneViews.setModels(this.sceneMap.pins);

        // reorder pins
        this.sceneMap.pins.forEach((pin, index) => 
        {
            this.pinContainer.setChildIndex(this.sceneViews.get(pin)!.container, index);
        });

        const scene = this.editor.project.getSceneByUUID(this.editor.project.startScene)!;
        this.startSceneButton.innerText = scene.name;
    }

    public select(pin: PinnedScene | undefined): void
    {
        this.selected = pin;
        this.sceneViews.forEach(view => view.setSelected(view.model === pin));

        // TODO: show/hide selected panel

        if (this.selected)
        {
            this.sceneNameInput.value = this.selected.element.name;
        }
    }

    /**
     * Update the panning and zoom of the page so that the elements are
     * centered within the viewport.
     */
    public reframe(): void
    {
        // compute bounds
        const bounds = this.sceneMap.pins[0].bounds;
    
        for (const pin of this.sceneMap.pins)
        {
            bounds.enlarge(pin.bounds);
        }

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

    public pickSceneForObject(callback: (scene: Scene | undefined) => void,
                              context: string,
                              object?: SceneObject): void
    {
        this.pickerCallback = callback;
        this.pickerObject = object;
        this.sidebar.hidden = true;
        this.editor.pickerPanel.pick("pick scene", context, query => query);
    }

    public pickSceneForStart(): void
    {
        this.pickerCallback = (scene: Scene | undefined) =>
        {
            if (scene)
            {
                this.editor.project.startScene = scene.uuid;
                this.show();
            }
        };

        this.sidebar.hidden = true;
        this.editor.pickerPanel.pick("pick scene", "pick starting scene for this project", query => query);
    }

    private pickScene(scene: Scene | undefined): void
    {
        const callback = this.pickerCallback;

        this.hide();
        this.editor.pickerPanel.hide();
        this.clearPicking();

        if (callback) { callback(scene); }
    }

    private createNewScene(): void
    {
        // center
        const view = new Point(this.editor.pixi.view.width / 2, this.editor.pixi.view.height / 2);
        const position = this.container.toLocal(view);

        position.x = Math.floor(position.x - 40 / 2);
        position.y = Math.floor(position.y - 25 / 2);

        const scene = this.editor.project.createScene();
        scene.name = `scene ${this.editor.project.scenes.length}`;

        this.sceneMap.pins.find(pin => pin.element === scene)!.position = position;

        this.refresh();
    }

    private deleteSelectedScene(): void
    {
        if (this.selected)
        {
            this.editor.project.deleteScene(this.selected.element);
            this.select(undefined);
            this.refresh();
        }
    }

    private createSceneView(): PinnedSceneView
    {
        const view = new PinnedSceneView();

        this.pinContainer.addChild(view.container);

        return view;
    }

    private onPointerDown(event: interaction.InteractionEvent): void
    {
        // assume a pointer-down means any existing dragging must be over
        this.drags.delete(event.data.identifier);

        // convert the pointer position into a pixel coordinate within the page
        const page = utility.floor(event.data.getLocalPosition(this.container));
        // find the first object, if any, at this position
        const object = pageFirstBoundsUnderPoint(this.sceneMap.pins, page);

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
        // if we're in picking mode, pick either the object or nothing
        else if (this.pickerCallback)
        {
            this.pickScene(object ? object.element : undefined);
        }
        // else begin an object moving drag
        else if (object)
        {
            const view = this.sceneViews.get(object)!;
            const drag = new DragState("move", 
                                       event.data.identifier, 
                                       event.data.getLocalPosition(view.container), 
                                       view);
            this.drags.set(event.data.identifier, drag);
            this.select(object);

            if (this.doubleClick !== object)
            {
                window.clearTimeout(this.doubleTimeout);
                this.doubleClick = object;
                this.doubleTimeout = window.setTimeout(() => {
                    this.doubleClick = undefined;
                }, 500);
            }
            else
            {
                this.editor.openScene(object.element);
            }
        }

        event.stopPropagation();
    }

    private onPointerMove(event: interaction.InteractionEvent): void
    {
        if (!this.sceneMap) { return; }

        const page = utility.floor(event.data.getLocalPosition(this.container));
        const object = pageFirstBoundsUnderPoint(this.sceneMap.pins, page);

        this.sceneViews.forEach(s => s.setHovered(s.model === object));
        
        const cursor = this.drags.size > 0 ? "grabbing" : "grab";
        this.container.cursor = object ? cursor : "initial";

        // update dragging
        const viewPoint = event.data.getLocalPosition(this.container.parent);
        const pagePoint = event.data.getLocalPosition(this.container);
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
        }

        if (this.pickerObject)
        {
            this.showLinkLine(page, this.getSceneObjectPosition(this.pickerObject));
        }
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

    private getPinForScene(scene: Scene): PinnedScene
    {
        return this.sceneMap.pins.find(pin => pin.element === scene)!;
    }

    /**
     * Compute the page location of a scene object within its corresponding
     * pinned scene.
     */
    private getSceneObjectPosition(object: SceneObject): Point
    {
        const center = utility.rectCenter(object.bounds);
        
        const pin = this.sceneMap.pins.find(p => !!p.element.objects.find(o => o === object))!;
        const pinView = this.sceneViews.get(pin)!;
        const pinWorld = pinView.container.toGlobal(utility.mul(center, 1/4));
        const pinPage = this.container.toLocal(pinWorld);

        return pinPage;
    }

    /**
     * Clear all picking data and interface without calling back with a choice.
     */
    private clearPicking(): void
    {
        this.linkGraphic.visible = false;
        this.pickerCallback = undefined;
        this.pickerObject = undefined;   
    }

    /**
     * Show the link line and position it so that it is between the given
     * points.
     */
    private showLinkLine(start: Point, end: Point)
    {
        // redraw the link line
        this.linkGraphic.clear();
        this.linkGraphic.lineStyle(.5, 0xFF0000);
        this.linkGraphic.moveTo(start.x, start.y);
        this.linkGraphic.lineTo(end.x, end.y);
        this.linkGraphic.beginFill(0xFF0000);
        this.linkGraphic.drawCircle(start.x, start.y, 1)
        this.linkGraphic.drawCircle(end.x, end.y, 1)
        this.linkGraphic.visible = true;
    }

    private regeneratePreviews(): void
    {
        const scale = 1;

        this.linksGraphic.clear();
        this.linksGraphic.lineStyle(.25, 0x00FF00);

        this.sceneViews.forEach((view, pin) =>
        {
            view.preview.fill(0xFF000000);
            pin.element.objects.forEach(object =>
            {
                view.preview.context.drawImage(object.drawing.texture.canvas, 
                                               object.position.x / scale,
                                               object.position.y / scale,
                                               object.drawing.width / scale,
                                               object.drawing.height / scale);
                
                /*
                if (object.sceneChange)
                {
                    const tscene = this.editor.project.getSceneByUUID(object.sceneChange)!;
                    const tpin = this.getPinForScene(tscene);
                    const center = utility.rectCenter(tpin.bounds);
                    const scenter = this.getSceneObjectPosition(object);

                    this.linksGraphic.moveTo(center.x, center.y);
                    this.linksGraphic.lineTo(scenter.x, scenter.y);
                }
                */
            });
            view.preview.update();
        });
    }

    private shiftSelectedSceneUp(): void
    {
        if (this.selected)
        {
            const index = this.sceneMap.pins.indexOf(this.selected);
            
            utility.swapArrayElements(this.sceneMap.pins, index, index + 1);
            this.refresh();
        }
    }

    private shiftSelectedSceneDown(): void
    {
        if (this.selected)
        {
            const index = this.sceneMap.pins.indexOf(this.selected);
            
            utility.swapArrayElements(this.sceneMap.pins, index, index - 1);
            this.refresh();
        }
    }
}
