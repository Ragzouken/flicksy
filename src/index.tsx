import './index.css';

import * as utility from './tools/utility';
import FlicksyEditor from './ui/FlicksyEditor';
import { jsonToProject, findProject, saveProject } from './tools/saving';

const editor = new FlicksyEditor(document.getElementById("root")!,
                                 document.getElementById("root")!);

async function start()
{
    // tabs
    utility.buttonClick("editor-button",      () => editor.enterEditor());
    utility.buttonClick("playtest-button",    () => editor.enterPlayback(true));
    utility.buttonClick("info-tab-button",    () => editor.setActivePanel(editor.projectsPanel));
    utility.buttonClick("publish-tab-button", () => editor.setActivePanel(editor.publishPanel));
    utility.buttonClick("drawing-tab-button", () => editor.setActivePanel(editor.drawingBoardsPanel));
    utility.buttonClick("scene-tab-button",   () => editor.setActivePanel(editor.scenesPanel));

    // play embeded game or open editor
    const embed = document.getElementById("flicksy-data");

    if (embed)
    {
        editor.setProject(jsonToProject(embed.innerHTML));
        editor.enterPlayback(false);
    }
    else
    {
        const project = await findProject();
        editor.setProject(project);
        editor.enterEditor();
    }
}

start();
