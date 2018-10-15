import * as Pixi from 'pixi.js';
import * as uuid from 'uuid/v4';
import { Drawing } from '../data/Drawing';
import { HitPrecision, pageFirstObjectUnderPoint } from '../data/PositionedDrawing';
import { Scene, SceneObject } from '../data/Scene';
import ModelViewMapping from '../tools/ModelViewMapping';
import * as utility from '../tools/utility';
import DialogueView from './DialogueView';
import FlicksyEditor from './FlicksyEditor';
import Panel from './Panel';
import PositionedDrawingView from './PositionedDrawingView';

export type SceneObjectView = PositionedDrawingView<SceneObject>;

export default class ScenesPanel implements Panel
{
    public get activeScene(): Scene { return this.scene }

    public selected: SceneObject | undefined;

    private readonly container: Pixi.Container;
    private readonly overlayContainer: Pixi.Container;
    private readonly objectContainer: Pixi.Container;

    private readonly objectViews: ModelViewMapping<SceneObject, SceneObjectView>;

    private scene: Scene;

    private dragOrigin: Pixi.Point;
    private draggedObject: SceneObjectView | undefined;

    // scenes ui
    private readonly createSceneButton: HTMLButtonElement;
    private readonly activeSceneSelect: HTMLSelectElement;
    private readonly sceneNameInput: HTMLInputElement;
    private readonly sceneDeleteButton: HTMLButtonElement;

    // selected object ui
    private readonly objectSection: HTMLDivElement;
    private readonly objectNameInput: HTMLInputElement;
    private readonly objectDeleteButton: HTMLButtonElement;
    private readonly objectDialogueInput: HTMLTextAreaElement;
    private readonly objectDialogueShowToggle: HTMLInputElement;
    private readonly objectSceneChangeSelect: HTMLSelectElement;
    
    private readonly objectDialoguePreview: DialogueView;

    private playModeTest: boolean;
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

        this.objectDialoguePreview = new DialogueView();
        this.overlayContainer.addChild(this.objectDialoguePreview.container);

        this.container.pivot = new Pixi.Point(80, 50);
        this.container.interactive = true;
        this.container.hitArea = new Pixi.Rectangle(0, 0, 160, 100);
        
        const mask = new Pixi.Graphics();
        mask.beginFill(0x000000);
        mask.drawRect(0, 0, 160, 100);
        this.container.addChild(mask);
        this.objectContainer.mask = mask;

        // scene bounds
        const bounds = new Pixi.Graphics();
        bounds.lineStyle(1, 0xFFFFFF);
        bounds.drawRect(-.5, -.5, 160 + 1, 100 + 1);
        bounds.alpha = 1;
        this.overlayContainer.addChild(bounds);

        document.addEventListener("pointerup", () => this.stopDragging());

        this.objectSection = utility.getElement("selected-object-section");
        this.activeSceneSelect = utility.getElement("active-scene-select");
        this.createSceneButton = utility.getElement("create-scene-button");
        this.sceneNameInput = utility.getElement("scene-name-input");
        this.sceneDeleteButton = utility.getElement("delete-scene-button");

        this.createSceneButton.addEventListener("click", () => this.createNewScene());
        this.sceneDeleteButton.addEventListener("click", () => this.deleteOpenScene());

        this.sceneNameInput.addEventListener("input", () => this.scene.name = this.sceneNameInput.value);
        
        this.activeSceneSelect.addEventListener("change", () =>
        {
            const scene = this.editor.project.scenes[this.activeSceneSelect.selectedIndex];

            this.setScene(scene);
        });

        utility.buttonClick("object-higher", () => this.shiftSelectedObjectUp());
        utility.buttonClick("object-lower", () => this.shiftSelectedObjectDown());

        utility.buttonClick("create-object-drawing-picker-button", () => this.createObjectFromPicker());
        utility.buttonClick("object-pick-drawing-button", () => this.changeSelectedObjectDrawingFromPicker());

        this.objectNameInput = utility.getElement("object-name");
        this.objectDeleteButton = utility.getElement("delete-object-button");
        this.objectDialogueInput = utility.getElement("object-dialogue-input");
        this.objectDialogueShowToggle = utility.getElement("show-dialogue-toggle");
        this.objectSceneChangeSelect = utility.getElement("object-scene-select");

        this.objectNameInput.addEventListener("input", () => 
        {
            if (this.selected) { this.selected.name = this.objectNameInput.value; }
        });

        this.objectSceneChangeSelect.addEventListener("change", () =>
        {
            if (!this.selected) { return; }

            const scene = this.editor.project.getSceneByUUID(this.objectSceneChangeSelect.value);

            this.selected.sceneChange = scene ? scene.uuid : undefined;
        });

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
        this.sceneNameInput.value = this.scene.name;
        this.refreshObjectViews();

        utility.repopulateSelect(this.activeSceneSelect,
                                 this.editor.project.scenes.map(scene => ({ label: scene.name, value: scene.uuid })));
        this.activeSceneSelect.selectedIndex = this.editor.project.scenes.indexOf(this.scene);

        const scenes = this.editor.project.scenes.map(scene => ({ label: `go to: ${scene.name}`, value: scene.uuid }));
        scenes.splice(0, 0, { label: "nothing", value: "" });

        utility.repopulateSelect(this.objectSceneChangeSelect, scenes);

        if (this.selected && this.selected.sceneChange)
        {
            const scene = this.editor.project.getSceneByUUID(this.selected.sceneChange)!;
            this.objectSceneChangeSelect.selectedIndex = this.editor.project.scenes.indexOf(scene);
        }

        this.select(this.selected);
    }

    /** Switch the currently selected object, or select nothing if undefined */
    public select(object: SceneObject | undefined): void
    {
        this.selected = object;
        this.objectViews.forEach(view => view.setSelected(view.object === object));

        this.objectSection.hidden = !object;
        this.objectNameInput.disabled = !object;
        this.objectDeleteButton.disabled = !object;
        this.objectDialogueInput.disabled = !object;
        this.objectSceneChangeSelect.disabled = !object;

        if (object)
        {
            if (object.sceneChange)
            {
                this.objectSceneChangeSelect.value = object.sceneChange;
            }
            else
            {
                this.objectSceneChangeSelect.selectedIndex = 0;
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
        const position = new Pixi.Point(utility.randomInt(48, 128), utility.randomInt(2, 96));

        const object = new SceneObject();
        object.uuid = uuid();
        object.name = `object ${this.activeScene.objects.length}`;
        object.position = position;
        object.drawing = this.editor.project.drawings[0];
        object.dialogue = "";
        object.drawing = drawing;

        this.scene.addObject(object);

        this.select(object);
        this.refresh();

        return object;
    }

    public updateDragging(event: Pixi.interaction.InteractionEvent): void
    {
        if (this.draggedObject)
        {
            const position = utility.floor(utility.add(this.dragOrigin, event.data.getLocalPosition(this.overlayContainer)));

            this.draggedObject.object.position = position;
            this.draggedObject.sprite.position = position;
        }
    }

    private onPointerDown(event: Pixi.interaction.InteractionEvent): void
    {
        if (this.dialoguingObject)
        {
            if (this.dialoguingObject.sceneChange)
            {
                this.setScene(this.editor.project.getSceneByUUID(this.dialoguingObject.sceneChange)!);
                this.setPlayTestMode(true);
            };

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
            else if (object.sceneChange)
            {
                this.setScene(this.editor.project.getSceneByUUID(object.sceneChange)!);
                this.setPlayTestMode(true);
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
            this.container.cursor = this.playModeTest && interactable
                                    ? "pointer"
                                    : "grab";
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

    private createNewScene(): void
    {
        const scene = this.editor.project.createScene();
        scene.name = `scene ${this.editor.project.scenes.length}`;

        this.setScene(scene);
    }

    private deleteOpenScene(): void
    {
        if (this.editor.project.scenes.length === 1) { return; }

        const index = this.editor.project.scenes.indexOf(this.scene);
        this.editor.project.scenes.splice(index, 1);

        this.setScene(this.editor.project.scenes[0]);
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

    private changeSelectedObjectDrawingFromPicker(): void 
    {
        if (!this.selected) { return; }

        this.editor.drawingBoardsPanel.show();
        this.hide();
        this.editor.drawingBoardsPanel.pickDrawingForScene(drawing =>
        {
            if (drawing && this.selected)
            {
                this.selected.drawing = drawing;
            }

            this.editor.drawingBoardsPanel.hide();
            this.show();
        }, `pick the drawing for the object <em>${this.selected.name}</em> in the scene <em>${this.scene.name}</em>`);
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
}
