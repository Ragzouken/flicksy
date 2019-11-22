import * as FileSaver from 'file-saver';
import JSZip from 'jszip';
import { exportPlayable, filesafeName, playableHTMLBlob, projectToJson } from '../tools/saving';
import { buttonClick, getElement } from "../tools/utility";
import FlicksyEditor from "./FlicksyEditor";
import Panel from './Panel';
import { convertIndexed } from '../draw';

async function fileToBlob(file: File): Promise<Blob>
{
    const reader = new FileReader();
    const promise = new Promise<Blob>(resolve =>
    {
        reader.onloadend = progress =>
        {
            const data = reader.result as ArrayBuffer;
            const blob = new Blob([data], {type: file.type});

            resolve(blob);
        };
    });

    reader.readAsArrayBuffer(file);

    return promise;
}

export default class PublishPanel implements Panel
{
    private readonly sidebar: HTMLElement;

    public constructor(private readonly editor: FlicksyEditor)
    {
        this.sidebar = document.getElementById("publish")! as HTMLDivElement;

        const audioInput: HTMLInputElement = getElement("export-audio");

        buttonClick("export-playable", () => exportPlayable(editor.project));
        buttonClick("download-data", () => 
        {
            const json = projectToJson(editor.project);
            const blob = new Blob([json], {type: "application/json"});
            FileSaver.saveAs(blob, "project.flicksy.json");
        });
        buttonClick("download", () =>
        {
            const zip = new JSZip();
            const drawings = zip.folder("drawings");
            
            editor.project.palette[0] = 0;

            for (const drawing of editor.project.drawings)
            {
                const name = drawing.name + ".png";
                const converted = convertIndexed(drawing.texture.context, editor.project.palette);
                const url = converted.canvas.toDataURL("image/png");
                const data = url.substring(22);

                drawings.file(name, data, {base64: true});
            }

            zip.generateAsync({type: "blob"})
            .then(content => FileSaver.saveAs(content, "drawings.zip"));
        });
        buttonClick("export-zip", () =>
        {
            const name = filesafeName(editor.project);

            const zip = new JSZip();
            const folder = zip.folder(name);
            
            const audio = audioInput.files![0];
            const htmlblob = playableHTMLBlob(editor.project, audio.name);

            folder.file("index.html", htmlblob);

            fileToBlob(audio)
            .then(audioblob => folder.file(audio.name, audioblob))
            .then(_ => zip.generateAsync({type: "blob"}))
            .then(content => FileSaver.saveAs(content, `${name}.zip`));
        });
    }

    public refresh(): void
    {
        return;
    }

    public show(): void
    {
        this.sidebar.hidden = false;
    }

    public hide(): void
    {
        this.sidebar.hidden = true;
    }
}
