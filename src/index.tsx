import './index.css';
import { findProject, jsonToProject } from './tools/saving';
import * as utility from './tools/utility';
import ErrorPanel from './ui/ErrorPanel';
import FlicksyEditor from './ui/FlicksyEditor';

async function start()
{
    const error = new ErrorPanel();

    window.addEventListener("unhandledrejection", event =>
    {
        error.show((event as any).reason);
    });

    window.addEventListener("error", event =>
    {
        const detail = `${event.message}\n${event.filename}:${event.lineno}`;

        error.show(detail);
    });

    const editor = new FlicksyEditor(utility.getElement("sidebar"), 
                                     utility.getElement("root"),
                                     [160, 100]);

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

    console.log(localStorage.getItem("game_data"));
}

start();
