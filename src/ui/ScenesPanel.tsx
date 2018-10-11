import * as Pixi from 'pixi.js';
import * as uuid from 'uuid/v4';
import { Drawing } from '../data/Drawing';
import { HitPrecision, positionedDrawingContains } from '../data/PositionedDrawing';
import { Scene, SceneObject } from '../data/Scene';
import ModelViewMapping, { View } from '../tools/ModelViewMapping';
import * as utility from '../tools/utility';
import FlicksyEditor from './FlicksyEditor';
import Panel from './Panel';

class DialogueView
{
    public readonly container: Pixi.Container;
    public readonly panel: Pixi.Graphics;
    public readonly text: Pixi.Text;

    public constructor()
    {
        this.container = new Pixi.Container();
        this.container.width = 160;
        this.container.height = 100;
        this.container.hitArea = new Pixi.Rectangle(0, 0, 160, 100);
        this.container.interactive = true;
        this.container.cursor = "pointer";

        this.panel = new Pixi.Graphics();
        this.panel.clear();
        this.panel.beginFill(0x000000);
        this.panel.drawRect(0, 0, 100 * 8, 30 * 8);
        this.panel.endFill();
        this.panel.lineStyle(8, 0xFFFFFF, 1);
        this.panel.drawRect(4, 4, 100 * 8 - 8, 30 * 8 - 8);
        this.panel.position = new Pixi.Point(30, 60);
        this.panel.scale = new Pixi.Point(.125, .125);


        this.text = new Pixi.Text("test test test test test test test test test test test test test test test ", {
            fill : 0xffffff,
            fontFamily: 'Arial', 
            fontSize: 32, 
            wordWrap: true,
            wordWrapWidth: 100 * 8 - 8 * 8,
        });
        this.text.position = new Pixi.Point(4 * 8, 4 * 8);
        // this.text.texture.baseTexture.scaleMode = 1;

        this.panel.addChild(this.text);
        this.container.addChild(this.panel);
    }
}

// tslint:disable-next-line:max-classes-per-file
class SceneObjectView implements View<SceneObject>
{
    /** The SceneObject that this view corresponds to */
    public object: SceneObject;
    /** The Pixi.Sprite for displaying the drawing content */
    public readonly sprite: Pixi.Sprite;
    /** The Pixi.Graphics for displaying the selection highlight */
    public readonly select: Pixi.Graphics;
    /** The Pixi.Graphics for displaying the hover highlight */
    public readonly hover: Pixi.Graphics;

    public get model(): SceneObject
    {
        return this.object;
    }

    public set model(object: SceneObject)
    {
        this.object = object;
        this.refresh();
    }

    public constructor()
    {
        // create the sprite and move it to the pin position
        this.sprite = new Pixi.Sprite();
        this.sprite.interactive = true;

        // create the selection highlight as a child of the sprite
        this.select = new Pixi.Graphics();
        this.sprite.addChild(this.select);

        // create the selection highlight as a child of the sprite
        this.hover = new Pixi.Graphics();
        this.sprite.addChild(this.hover);

        // turn off the selection highlight by default
        this.setSelected(false);

        this.hover.visible = false;
    }

    public refresh()
    {
        this.sprite.texture = this.object.drawing.texture.texture;
        this.sprite.position = this.object.position;

        const width = this.object.drawing.width;
        const height = this.object.drawing.height;

        this.select.clear();
        this.select.lineStyle(.5, 0xFFFFFF);
        this.select.drawRect(-.5, -.5, width + 1, height + 1);
        this.select.alpha = 0.5;

        this.hover.clear();
        this.hover.lineStyle(.5, 0xFF0000);
        this.hover.drawRect(-.5, -.5, width + 1, height + 1);
        this.hover.alpha = 0.5;
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
        this.select.destroy();
        this.hover.destroy();
    }
}

// tslint:disable-next-line:max-classes-per-file
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
    private createSceneButton: HTMLButtonElement;
    private activeSceneSelect: HTMLSelectElement;
    private sceneNameInput: HTMLInputElement;
    private sceneDeleteButton: HTMLButtonElement;

    // selected object ui
    private objectSection: HTMLDivElement;
    private objectNameInput: HTMLInputElement;
    private objectDeleteButton: HTMLButtonElement;
    private objectDialogueInput: HTMLTextAreaElement;
    private objectDialogueShowToggle: HTMLInputElement;
    private objectSceneChangeSelect: HTMLSelectElement;
    
    private objectDialoguePreview: DialogueView;

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
        this.container.on("pointerdown", () => this.select(undefined));
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

        this.objectSection = document.getElementById("selected-object-section")! as HTMLDivElement;
        this.activeSceneSelect = document.getElementById("active-scene-select")! as HTMLSelectElement;
        this.createSceneButton = document.getElementById("create-scene-button")! as HTMLButtonElement;
        this.sceneNameInput = document.getElementById("scene-name-input")! as HTMLInputElement;
        this.sceneDeleteButton = document.getElementById("delete-scene-button")! as HTMLButtonElement;

        this.createSceneButton.addEventListener("click", () =>
        {
            const scene = this.editor.project.createScene();
            scene.name = `scene ${this.editor.project.scenes.length}`;

            this.select(undefined);
            this.setScene(scene);
            this.refresh();
        });

        this.sceneNameInput.addEventListener("input", () => this.scene.name = this.sceneNameInput.value);

        this.sceneDeleteButton.addEventListener("click", () =>
        {
            if (this.editor.project.scenes.length === 1) { return; }

            const index = this.editor.project.scenes.indexOf(this.scene);
            this.editor.project.scenes.splice(index, 1);

            this.setScene(this.editor.project.scenes[0]);
            this.refresh();
        });

        this.activeSceneSelect.addEventListener("change", () =>
        {
            const scene = this.editor.project.scenes[this.activeSceneSelect.selectedIndex];

            this.select(undefined);
            this.setScene(scene);
            this.refresh();
        });

        utility.buttonClick("object-higher", () =>
        {
            if (this.selected)
            {
                const index = this.scene.objects.indexOf(this.selected);
                const next = index + 1;

                if (next < this.scene.objects.length)
                {
                    this.scene.objects[index] = this.scene.objects[next];
                    this.scene.objects[next] = this.selected;
                    this.refresh();
                }
            }
        });

        utility.buttonClick("object-lower", () =>
        {
            if (this.selected)
            {
                const index = this.scene.objects.indexOf(this.selected);
                const next = index - 1;

                if (next >= 0)
                {
                    this.scene.objects[index] = this.scene.objects[next];
                    this.scene.objects[next] = this.selected;
                    this.refresh();
                }
            }
        });

        utility.buttonClick("create-object-drawing-picker-button", () =>
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
        });

        utility.buttonClick("object-pick-drawing-button", () =>
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
        });

        this.objectNameInput = utility.getElement("object-name");
        this.objectDeleteButton = utility.getElement("delete-object-button");
        this.objectDialogueInput = utility.getElement("object-dialogue-input");
        this.objectDialogueShowToggle = utility.getElement("show-dialogue-toggle");
        this.objectSceneChangeSelect = utility.getElement("object-scene-select");

        this.objectNameInput.addEventListener("input", () => 
        {
            if (this.selected) { this.selected.name = this.objectNameInput.value; }
        });

        this.objectDialoguePreview.container.on("pointerdown", () => 
        {
            if (this.dialoguingObject
             && this.dialoguingObject.sceneChange)
            {
                this.setScene(this.editor.project.getSceneByUUID(this.dialoguingObject.sceneChange)!);
                this.setPlayTestMode(true);
            }

            this.dialoguingObject = undefined;

            this.hideDialogue();
        });

        this.objectSceneChangeSelect.addEventListener("change", () =>
        {
            if (!this.selected) { return; }

            const scene = this.editor.project.getSceneByUUID(this.objectSceneChangeSelect.value);

            if (scene)
            {
                this.selected.sceneChange = scene.uuid;
            }
            else
            {
                this.selected.sceneChange = undefined;
            }
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

        this.container.on("pointermove", (event: Pixi.interaction.InteractionEvent) => 
        {
            const view = this.getFirstViewUnderEvent(event);

            this.objectViews.forEach(v => v.hover.visible = false);

            if (view)
            {
                const interactable = view.object.dialogue.length > 0 
                                  || view.object.sceneChange;

                view.hover.visible = !this.playModeTest;
                this.container.cursor = this.playModeTest && interactable
                                      ? "pointer"
                                      : "grab";
            }
            else
            {
                this.container.cursor = "initial";
            }
        });

        this.container.on("pointerdown", (event: Pixi.interaction.InteractionEvent) => 
        {
            const view = this.getFirstViewUnderEvent(event);

            if (view)
            {
                if (this.playModeTest)
                {
                    if (view.object.dialogue.length > 0)
                    {
                        this.showDialogue(view.object);
                    }
                    else if (view.object.sceneChange)
                    {
                        this.setScene(this.editor.project.getSceneByUUID(view.object.sceneChange)!);
                        this.setPlayTestMode(true);
                    }
                }
                else
                {
                    this.startDragging(view, event);
                }

                event.stopPropagation();
            }
        });
    }

    public getFirstViewUnderEvent(event: Pixi.interaction.InteractionEvent): SceneObjectView | undefined
    {
        const page = utility.floor(event.data.getLocalPosition(this.objectContainer));

        for (let i = this.scene.objects.length - 1; i >= 0; i -= 1)
        {
            const object = this.scene.objects[i];
            const view = this.objectViews.get(object)!;

            if (positionedDrawingContains(object, page, HitPrecision.Pixel))
            {
                return view;
            }
        }

        return undefined;
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

    private createSceneObjectView(): SceneObjectView
    {
        const view = new SceneObjectView();

        this.objectContainer.addChild(view.sprite);

        return view;
    }

    private refreshObjectViews(): void
    {
        this.objectViews.setModels(this.scene.objects);
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
