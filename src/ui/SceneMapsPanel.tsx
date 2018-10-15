import { Container, Graphics, interaction, Point, Rectangle, Text } from "pixi.js";
import { BoundedObject, pageFirstBoundsUnderPoint } from "src/data/PositionedDrawing";
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

    public set selected(value: boolean)
    {
        this.border.alpha = value ? 1 : .25;
    }

    public set hovered(value: boolean)
    {
        this.border.tint = value ? 0xFFFF0000 : 0xFFFFFFFF;
        this.border.alpha = value ? 1 : .25;
    }

    public readonly container: Container;

    private readonly labelText: Text;
    private readonly border: Graphics;

    public constructor()
    {
        this.container = new Container();

        this.border = new Graphics();
        this.border.lineStyle(1, 0xFFFFFFFF, 1);
        this.border.drawRect(-.5, -.5, 32 + 1, 20 + 1);
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

        this.selected = false;
        this.hovered = false;
    }

    public refresh(): void 
    {
        this.container.position = this.model.position;
        this.labelText.text = this.model.element.name;
    }
}

// tslint:disable-next-line:max-classes-per-file
export default class SceneMapsPanel implements Panel
{
    private readonly sidebar: HTMLElement;
    private readonly container: Container;
    private readonly sceneViews: ModelViewMapping<PinnedScene, PinnedSceneView>;
    private readonly drags = new Map<number, DragState>();

    private sceneMap: SceneBoard;
    private selected: PinnedScene | undefined;

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

        this.container.position.set(-80, -50);
        this.container.hitArea = utility.infiniteHitArea;

        utility.buttonClick("create-scene-button2", () =>
        {
            return;
        });

        // mouse controls
        this.container.on("pointerdown", (event: interaction.InteractionEvent) => this.onPointerDown(event));
        this.container.on("pointermove", (event: interaction.InteractionEvent) => this.onPointerMove(event));
        document.addEventListener("pointerup", event => this.drags.delete(event.pointerId));
    }

    public show(): void
    {
        this.container.visible = true;
        this.sidebar.hidden = false;
        this.refresh();
    }

    public hide(): void
    {
        this.container.visible = false;
        this.sidebar.hidden = true;
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
                pin.position = new Point((index % 4) * 37, Math.floor(index / 4) * 25);

                map.pins.push(pin);
            }
        });

        this.refresh();
    }

    public refresh(): void
    {
        this.sceneViews.setModels(this.sceneMap.pins);
    }

    public select(pin: PinnedScene | undefined): void
    {
        this.selected = pin;
        this.sceneViews.forEach(view => view.selected = (view.model === pin));

        // TODO: show/hide selected panel, update selected name
    }

    private createSceneView(): PinnedSceneView
    {
        const view = new PinnedSceneView();

        this.container.addChild(view.container);

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
        // else begin an object moving drag
        else if (object)
        {
            const view = this.sceneViews.get(object)!;
            const drag = new DragState("move", 
                                       event.data.identifier, 
                                       event.data.getLocalPosition(view.container), 
                                       view);
            this.drags.set(event.data.identifier, drag);
            // this.select(object);
        }

        event.stopPropagation();
    }

    private onPointerMove(event: interaction.InteractionEvent): void
    {
        if (!this.sceneMap) { return; }

        const page = utility.floor(event.data.getLocalPosition(this.container));
        const object = pageFirstBoundsUnderPoint(this.sceneMap.pins, page);

        this.sceneViews.forEach(s => s.hovered = s.model === object);
        
        const cursor = "grab";// this.drags.size > 0 ? "grabbing" : "grab";
        const grab = object; // && this.mode === "select";
        this.container.cursor = grab ? cursor : "initial";

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
                drag.view!.model.position = utility.floor(utility.sub(pagePoint, drag.start));
                drag.view!.refresh();
            }
        }
    }
}
