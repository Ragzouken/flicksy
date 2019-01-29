import * as Pixi from 'pixi.js';
import { v4 as uuid } from 'uuid';
import { Drawing } from '../data/Drawing';
import { HitPrecision, pageFirstObjectUnderPoint } from '../data/PositionedDrawing';
import { Scene, SceneObject } from '../data/Scene';
import ModelViewMapping from '../tools/ModelViewMapping';
import * as utility from '../tools/utility';
import DialogueView from './DialogueView';
import FlicksyEditor from './FlicksyEditor';
import Panel from './Panel';
import PositionedDrawingView from './PositionedDrawingView';
import { FlicksyVariable } from '../data/FlicksyProject';

export type SceneObjectView = PositionedDrawingView<SceneObject>;

export default class ScenesPanel implements Panel
{
    public get activeScene(): Scene { return this.scene }

    public selected: SceneObject | undefined;

    private readonly container: Pixi.Container;
    private readonly overlayContainer: Pixi.Container;
    private readonly objectContainer: Pixi.Container;
    
    private readonly mask: Pixi.Graphics;
    private readonly bounds: Pixi.Graphics;

    private readonly objectViews: ModelViewMapping<SceneObject, SceneObjectView>;

    private scene: Scene;

    private dragOrigin: Pixi.Point;
    private draggedObject: SceneObjectView | undefined;
    
    private readonly sceneNameHeading: HTMLElement;

    // selected object ui
    private readonly objectSection: HTMLDivElement;
    private readonly objectNameInput: HTMLInputElement;
    private readonly objectDeleteButton: HTMLButtonElement;
    private readonly objectDialogueInput: HTMLTextAreaElement;
    private readonly objectDialogueShowToggle: HTMLInputElement;
    private readonly objectSceneChangeButton: HTMLButtonElement;
    
    private readonly objectDialoguePreview: DialogueView;

    private playModeTest: boolean;
    public playModeVariables: FlicksyVariable[] = [];

    private dialoguingObject: SceneObject | undefined;

    public constructor(private readonly editor: FlicksyEditor)
    {
        this.objectViews = new ModelViewMapping<SceneObject, SceneObjectView>(
            () => this.createSceneObjectView(),
            (view, active) => view.sprite.visible = active  
        );

        this.container = new Pixi.Container();
        editor.pixi.stage.addChild(this.container);
        this.objectContainer = new Pixi.Container();
        this.container.addChild(this.objectContainer);
        this.overlayContainer = new Pixi.Container();
        this.container.addChild(this.overlayContainer);

        this.objectDialoguePreview = new DialogueView(editor);
        this.overlayContainer.addChild(this.objectDialoguePreview.container);

        this.container.interactive = true;
        // set with project
        // this.container.hitArea = new Pixi.Rectangle(0, 0, 160, 100);
        // this.container.pivot = new Pixi.Point(80, 50);

        this.mask = new Pixi.Graphics();
        // set with project
        // this.mask.beginFill(0x000000);
        // this.mask.drawRect(0, 0, 160, 100);
        this.container.addChild(this.mask);
        this.objectContainer.mask = this.mask;

        // scene bounds
        this.bounds = new Pixi.Graphics();
        // set with project
        // this.bounds.lineStyle(1, 0xFFFFFF);
        // this.bounds.drawRect(-.5, -.5, 160 + 1, 100 + 1);
        this.bounds.alpha = 1;
        this.overlayContainer.addChild(this.bounds);

        utility.buttonClick("scene-view-in-map-button", () => 
        {
            this.editor.openSceneMap(this.scene);
        });

        this.objectSection = utility.getElement("selected-object-section");
        this.sceneNameHeading = utility.getElement("scene-tab-scene-name");

        utility.buttonClick("object-higher", () => this.shiftSelectedObjectUp());
        utility.buttonClick("object-lower", () => this.shiftSelectedObjectDown());

        utility.buttonClick("create-object-drawing-picker-button", () => this.createObjectFromPicker());
        utility.buttonClick("object-pick-drawing-button", () => this.startPickingSelectedObjectDrawing());

        this.objectNameInput = utility.getElement("object-name");
        this.objectDeleteButton = utility.getElement("delete-object-button");
        this.objectDialogueInput = utility.getElement("object-dialogue-input");
        this.objectDialogueShowToggle = utility.getElement("show-dialogue-toggle");
        this.objectSceneChangeButton = utility.getElement("object-scene-change-button");

        this.objectNameInput.addEventListener("input", () => 
        {
            if (this.selected) { this.selected.name = this.objectNameInput.value; }
        });

        this.objectSceneChangeButton.addEventListener("click", () => this.changeSelectedObjectSceneChangeFromPicker());

        this.objectDeleteButton.addEventListener("click", () =>
        {
            if (this.selected) { this.removeObject(this.selected); }
        });

        this.objectDialogueInput.addEventListener("input", () =>
        {
            if (this.selected)
            {
                this.selected.dialogue = this.objectDialogueInput.value;
                this.objectDialoguePreview.text.text = this.selected.dialogue;
            }
        });

        this.objectDialogueShowToggle.addEventListener("change", () =>
        {
            this.objectDialoguePreview.container.visible = this.objectDialogueShowToggle.checked
                                                        && this.selected !== undefined
                                                        && this.selected.dialogue.length > 0;
        });

        this.select(undefined);

        this.container.on("pointerdown", (event: Pixi.interaction.InteractionEvent) => this.onPointerDown(event));
        this.container.on("pointermove", (event: Pixi.interaction.InteractionEvent) => this.onPointerMove(event));
        this.container.on("pointerup",        (event: Pixi.interaction.InteractionEvent) => this.stopDragging());
        this.container.on("pointerupoutside", (event: Pixi.interaction.InteractionEvent) => this.stopDragging());
    }

    public show(): void
    {
        this.container.visible = true;
        document.getElementById("scene-sidebar")!.hidden = false;
        this.refresh();
    }

    public hide(): void
    {
        this.container.visible = false;
        document.getElementById("scene-sidebar")!.hidden = true;
    }

    public setPlayTestMode(on: boolean): void
    {
        this.playModeTest = on;
        this.select(undefined);
        this.refresh();
    }

    public hideDialogue(): void
    {
        this.objectDialoguePreview.container.visible = false;
    }

    public showDialogue(object: SceneObject): void
    {
        if (this.playModeTest)
        {
            this.dialoguingObject = object;
        }

        this.objectDialoguePreview.container.visible = object.dialogue.length > 0;
        this.objectDialoguePreview.text.text = object.dialogue;
    }

    /** Resynchronise this display to the data in the underlying Scene */
    public refresh(): void
    {
        this.refreshObjectViews();
        this.refreshBounds();

        this.sceneNameHeading.innerText = `scene: ${this.scene.name}`;

        const scenes = this.editor.project.scenes.map(scene => ({ label: `go to: ${scene.name}`, value: scene.uuid }));
        scenes.splice(0, 0, { label: "nothing", value: "" });

        if (this.selected)
        {
            if (this.selected.sceneChange)
            {
                const scene = this.editor.project.getSceneByUUID(this.selected.sceneChange)!;
                this.objectSceneChangeButton.innerText = `go to: ${scene.name}`;
            }
            else
            {
                this.objectSceneChangeButton.innerText = "nothing";
            }
        }

        this.select(this.selected);
    }

    /** Switch the currently selected object, or select nothing if undefined */
    public select(object: SceneObject | undefined): void
    {
        this.selected = object;
        this.objectViews.forEach(view => view.setSelected(view.object === object));

        this.objectSection.hidden = !object;

        if (object)
        {
            if (object.sceneChange)
            {
                const scene = this.editor.project.getSceneByUUID(object.sceneChange)!;
                this.objectSceneChangeButton.innerText = `go to: ${scene.name}`;
            }
            else
            {
                this.objectSceneChangeButton.innerText = "nothing";
            }

            this.objectNameInput.value = object.name;
            this.objectDialogueInput.value = object.dialogue;
            this.objectDialoguePreview.text.text = object.dialogue;
            this.objectDialoguePreview.container.visible = this.objectDialogueShowToggle.checked 
                                                        && object.dialogue.length > 0;
        }
        else
        {
            this.objectDialoguePreview.container.visible = false;
        }
    }

    public removeObject(object: SceneObject)
    {
        if (object === this.selected)
        {
            this.select(undefined);
        }

        this.scene.removeObject(object);
        this.refreshObjectViews();
    }

    public setScene(scene: Scene): void
    {
        this.scene = scene;
        this.select(undefined);
        this.refresh();
    }

    public createObject(drawing: Drawing): SceneObject
    {
        const object = new SceneObject();
        object.uuid = uuid();
        object.name = `object ${this.activeScene.objects.length}`;
        object.dialogue = "";
        object.drawing = drawing;
        object.position = new Pixi.Point(80 - drawing.width / 2, 
                                         50 - drawing.height / 2);

        this.scene.addObject(object);

        this.select(object);
        this.refresh();

        return object;
    }

    public updateDragging(event: Pixi.interaction.InteractionEvent): void
    {
        if (this.draggedObject)
        {
            const position = utility.round(utility.add(this.dragOrigin, event.data.getLocalPosition(this.overlayContainer)));

            this.draggedObject.object.position = position;
            this.draggedObject.sprite.position = position;
        }
    }

    private testRunObjectScripts(object: SceneObject): void
    {
        if (object.sceneChange)
        {
            this.setScene(this.editor.project.getSceneByUUID(object.sceneChange)!);
            this.setPlayTestMode(true);
        }

        for (let page of object.scriptPages)
        {
            if (page.condition) continue;

            for (let action of page.actions)
            {
                if (action.type == "switch_scene")
                {
                    this.setScene(this.editor.project.getSceneByUUID(action.scene)!);
                    this.setPlayTestMode(true);
                }
                else if (action.type == "change_variable")
                {
                    const source = action.source;
                    const target = action.target;

                    const value = this.playModeVariables.find(variable => variable.uuid == source)!.value;
                    let result = this.playModeVariables.find(variable => variable.uuid == target)!.value;

                    if (action.action == "add")
                    {
                        result += value;
                    }
                    else if (action.action == "sub")
                    {
                        result -= value;
                    }
                    else if (action.action == "set")
                    {
                        result = value;
                    }

                    this.playModeVariables.find(variable => variable.uuid == source)!.value = result;
                }
            }
        }
    }

    private onPointerDown(event: Pixi.interaction.InteractionEvent): void
    {
        if (this.dialoguingObject)
        {
            this.testRunObjectScripts(this.dialoguingObject);

            this.dialoguingObject = undefined;
            this.hideDialogue();
            event.stopPropagation();
            return;
        }

        const page = utility.floor(event.data.getLocalPosition(this.objectContainer));
        const object = pageFirstObjectUnderPoint(this.scene.objects, page, HitPrecision.Pixel);
        
        if (!object) 
        {
            this.select(undefined); 
            return; 
        }

        if (this.playModeTest)
        {
            if (object.dialogue.length > 0)
            {
                this.showDialogue(object);
            }
            else
            {
                this.testRunObjectScripts(object);
            }
        }
        else
        {
            this.startDragging(this.objectViews.get(object)!, event);
        }

        event.stopPropagation();
    }

    private onPointerMove(event: Pixi.interaction.InteractionEvent): void
    {
        const page = utility.floor(event.data.getLocalPosition(this.objectContainer));
        const object = pageFirstObjectUnderPoint(this.scene.objects, page, HitPrecision.Pixel);
        
        this.objectViews.forEach(v => v.hover.visible = false);

        if (object)
        {
            const interactable = object.dialogue.length > 0 
                              || object.sceneChange;

            this.objectViews.get(object)!.hover.visible = !this.playModeTest;
            
            if (this.playModeTest)
            {
                this.container.cursor = interactable ? "pointer" : "initial";
            }
            else
            {
                this.container.cursor = "grab";
            }
        }
        else
        {
            this.container.cursor = "initial";
        }
    }

    private shiftSelectedObjectUp(): void
    {
        if (this.selected)
        {
            const index = this.scene.objects.indexOf(this.selected);
            
            utility.swapArrayElements(this.scene.objects, index, index + 1);
            this.refresh();
        }
    }

    private shiftSelectedObjectDown(): void
    {
        if (this.selected)
        {
            const index = this.scene.objects.indexOf(this.selected);
            
            utility.swapArrayElements(this.scene.objects, index, index - 1);
            this.refresh();
        }
    }

    private createObjectFromPicker(): void 
    {
        this.editor.drawingBoardsPanel.show();
        this.hide();
        this.editor.drawingBoardsPanel.pickDrawingForScene(drawing => 
        {
            if (drawing) 
            {
                this.createObject(drawing);
            }
            
            this.editor.drawingBoardsPanel.hide();
            this.show();
        }, `pick a drawing for a new object in the scene <em>${this.scene.name}</em>`);
    }

    /**
     * 
     */
    private endPickingSelectedObjectDrawing(drawing: Drawing | undefined): void
    {
        if (drawing && this.selected)
        {
            this.selected.drawing = drawing;
        }

        this.show();
    }

    /**
     * Open the drawing picker to select a drawing to use for the currently
     * selected SceneObject
     */
    private startPickingSelectedObjectDrawing(): void 
    {
        if (!this.selected) { return; }

        const context = `pick the drawing for the object <em>${this.selected.name}</em> in the scene <em>${this.scene.name}</em>`;

        this.hide();
        this.editor.drawingBoardsPanel.pickDrawingForScene(drawing => this.endPickingSelectedObjectDrawing(drawing), context);
    }

    private changeSelectedObjectSceneChangeFromPicker(): void 
    {
        if (!this.selected) { return; }

        const pin = this.editor.project.sceneBoards[0].pins.find(p => p.element.uuid === this.selected!.sceneChange);

        this.editor.sceneMapsPanel.select(pin);
        this.editor.sceneMapsPanel.show();
        this.hide();
        this.editor.sceneMapsPanel.pickSceneForObject(scene =>
        {
            if (scene && this.selected)
            {
                this.selected.sceneChange = scene.uuid;
            }

            this.editor.drawingBoardsPanel.hide();
            this.show();
        }, `pick the scene to got to after clicking the object <em>${this.selected.name}</em> in the scene <em>${this.scene.name}</em>`,
        this.selected);
    }

    private createSceneObjectView(): SceneObjectView
    {
        const view = new PositionedDrawingView<SceneObject>();
        view.sprite.interactive = false;

        this.objectContainer.addChild(view.sprite);

        return view;
    }

    private refreshObjectViews(): void
    {
        this.objectViews.setModels(this.scene.objects);
        this.objectViews.forEach(view => view.border.visible = false);
        this.objectViews.refresh();
        
        // reorder the sprites
        this.scene.objects.forEach((object, index) => 
        {
            this.objectContainer.setChildIndex(this.objectViews.get(object)!.sprite, index);
        });
    }

    private stopDragging(): void
    {
        this.draggedObject = undefined;
    }

    private startDragging(view: SceneObjectView, event: Pixi.interaction.InteractionEvent): void
    {
        this.stopDragging();

        this.draggedObject = view;
        this.dragOrigin = utility.sub(view.sprite.position, event.data.getLocalPosition(this.overlayContainer));

        this.select(view.object);
    }

    private refreshBounds(): void
    {
        const [width, height] = this.editor.project.resolution;

        this.container.pivot = new Pixi.Point(width / 2, height / 2);
        this.container.hitArea = new Pixi.Rectangle(0, 0, width, height);

        this.mask.clear();
        this.mask.beginFill(0x000000);
        this.mask.drawRect(0, 0, width, height);

        this.bounds.clear();
        this.bounds.lineStyle(1, 0xFFFFFF);
        this.bounds.drawRect(-.5, -.5, width + 1, height + 1);
        this.bounds.alpha = 1;

        this.objectDialoguePreview.refreshBounds();
    }
}
